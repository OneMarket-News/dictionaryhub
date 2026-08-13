// Package canonical produces the one byte form a governance object is allowed
// to have, so a digest and a signature mean exactly one thing on every machine.
//
// The rules, and why each exists:
//
//   - UTF-8, no BOM, no trailing newline. Bytes that differ are identities that
//     differ; an editor's newline is not part of anyone's intent.
//   - Object keys sorted ORDINAL. Culture-aware sorting makes a digest depend on
//     the operator's locale, which is not an identity.
//   - No insignificant whitespace, so formatting cannot change identity.
//   - Integers only. A non-integral number is rejected, never rounded.
//   - Duplicate property names rejected.
//   - Fixed escape table; control characters below 0x20 as \u00xx, lowercase.
//   - Arrays preserve declared order. The CALLER sorts path sets, because
//     "sorted" must be a property of the object, not of the serializer.
//
// The escape table and the lowercase \u form are not cosmetic choices. The
// Product Authority has already signed bytes produced by the PowerShell
// implementation these rules were lifted from, and this package must reproduce
// those exact bytes or the existing signature would stop verifying.
package canonical

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"sourceroot.local/srgds-core/internal/jsonstrict"
)

// CompareOrdinal orders two strings by UTF-16 CODE UNIT, reproducing .NET's
// StringComparer.Ordinal exactly.
//
// This is the inherited canonical contract: the Product Authority has already
// signed objects whose key order was produced by .NET ordinal sorting, and any
// implementation that orders keys differently would produce different canonical
// bytes and therefore a different digest for the same object.
//
// The two orderings genuinely disagree. .NET compares UTF-16 code units, so a
// supplementary character (U+10000 and above) is a surrogate pair beginning at
// 0xD800 and sorts BEFORE U+E000..U+FFFF. Comparing UTF-8 bytes, or Go runes,
// orders by code point, so the same character sorts AFTER. Concretely:
//
//	UTF-16 ordinal:  U+D7FF  <  U+10000  <  U+E000  <  U+FFFF
//	code point:      U+D7FF  <  U+E000   <  U+FFFF  <  U+10000
//
// An earlier revision of this package resolved the disagreement by REJECTING
// names at or above U+E000, which removed both sides of every divergent pair.
// That made the two implementations agree, but it did so by shrinking the valid
// Unicode input domain to fit an implementation detail. The domain belongs to
// the authority schema, not to the serializer. The ordering is reproduced here
// instead.
//
// Inputs are validated as UTF-8 before they reach this function, so the rune
// decode below cannot silently substitute U+FFFD.
func CompareOrdinal(a, b string) int {
	if a == b {
		return 0
	}
	ua := utf16.Encode([]rune(a))
	ub := utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			if ua[i] < ub[i] {
				return -1
			}
			return 1
		}
	}
	switch {
	case len(ua) < len(ub):
		return -1
	case len(ua) > len(ub):
		return 1
	}
	return 0
}

// Marshal returns the canonical bytes of v.
func Marshal(v *jsonstrict.Value) ([]byte, error) {
	var b strings.Builder
	if err := write(&b, v); err != nil {
		return nil, err
	}
	out := []byte(b.String())
	if !utf8.Valid(out) {
		return nil, fmt.Errorf("canonical output is not valid UTF-8")
	}
	return out, nil
}

// Digest returns the uppercase hex SHA-256 of raw bytes.
func Digest(b []byte) string {
	sum := sha256.Sum256(b)
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

// MarshalDigest canonicalizes and digests in one step.
func MarshalDigest(v *jsonstrict.Value) (string, []byte, error) {
	b, err := Marshal(v)
	if err != nil {
		return "", nil, err
	}
	return Digest(b), b, nil
}

// ValidScalarString reports whether s may appear in canonical output.
//
// Go strings are byte sequences and can hold sequences that are not valid
// UTF-8, including the WTF-8 encoding of an unpaired surrogate. Those are
// exactly the inputs that collided under the previous implementation, so they
// are rejected here rather than repaired into U+FFFD.
func ValidScalarString(s string) error {
	if !utf8.ValidString(s) {
		return fmt.Errorf("string is not valid UTF-8; canonical output never substitutes a replacement character")
	}
	return nil
}

// EncodeString returns the canonical quoted form of s.
func EncodeString(s string) (string, error) {
	if err := ValidScalarString(s); err != nil {
		return "", err
	}
	var b strings.Builder
	b.WriteByte('"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case 0x08:
			b.WriteString(`\b`)
		case 0x0C:
			b.WriteString(`\f`)
		case 0x0A:
			b.WriteString(`\n`)
		case 0x0D:
			b.WriteString(`\r`)
		case 0x09:
			b.WriteString(`\t`)
		default:
			if c < 0x20 {
				b.WriteString(fmt.Sprintf(`\u%04x`, c))
			} else {
				// Every other byte, including continuation bytes of a
				// multi-byte rune, is emitted literally.
				b.WriteByte(c)
			}
		}
	}
	b.WriteByte('"')
	return b.String(), nil
}

func write(b *strings.Builder, v *jsonstrict.Value) error {
	if v == nil {
		return fmt.Errorf("canonical serialization refuses a nil value")
	}
	switch v.Kind {
	case jsonstrict.KindNull:
		b.WriteString("null")
		return nil
	case jsonstrict.KindBool:
		if v.Bool {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
		return nil
	case jsonstrict.KindInt:
		b.WriteString(strconv.FormatInt(v.Int, 10))
		return nil
	case jsonstrict.KindString:
		s, err := EncodeString(v.Str)
		if err != nil {
			return err
		}
		b.WriteString(s)
		return nil
	case jsonstrict.KindArray:
		b.WriteByte('[')
		for i, item := range v.Array {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := write(b, item); err != nil {
				return err
			}
		}
		b.WriteByte(']')
		return nil
	case jsonstrict.KindObject:
		return writeObject(b, v)
	}
	return fmt.Errorf("canonical serialization does not support kind %v", v.Kind)
}

func writeObject(b *strings.Builder, v *jsonstrict.Value) error {
	names := make([]string, 0, len(v.Object))
	index := make(map[string]*jsonstrict.Value, len(v.Object))
	for _, m := range v.Object {
		if err := ValidScalarString(m.Name); err != nil {
			return fmt.Errorf("property name is not serializable: %w", err)
		}
		if _, dup := index[m.Name]; dup {
			return fmt.Errorf("canonical serialization rejects duplicate property name %q", m.Name)
		}
		index[m.Name] = m.Value
		names = append(names, m.Name)
	}
	// Ordinal by UTF-16 code unit, reproducing StringComparer.Ordinal. NOT Go's
	// native string comparison, which orders UTF-8 bytes and therefore code
	// points: the two disagree for every supplementary character.
	sort.Slice(names, func(i, j int) bool { return CompareOrdinal(names[i], names[j]) < 0 })

	b.WriteByte('{')
	for i, name := range names {
		if i > 0 {
			b.WriteByte(',')
		}
		s, err := EncodeString(name)
		if err != nil {
			return err
		}
		b.WriteString(s)
		b.WriteByte(':')
		if err := write(b, index[name]); err != nil {
			return err
		}
	}
	b.WriteByte('}')
	return nil
}

// Reserialize parses bytes strictly and re-emits them canonically. Equality
// between input and output is the test that a signed object is canonical: a
// signature over non-canonical bytes would bind a form that this system cannot
// reproduce, and therefore cannot re-verify later.
func Reserialize(src []byte) ([]byte, error) {
	v, err := jsonstrict.Parse(src)
	if err != nil {
		return nil, err
	}
	return Marshal(v)
}
