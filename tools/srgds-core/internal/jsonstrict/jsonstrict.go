// Package jsonstrict parses JSON under the narrowest reading a trust core can
// defend, and builds the value tree that canonical serialization consumes.
//
// The permissive readings this package refuses were each proved to be a real
// defect by an independent audit of the PowerShell implementation this core
// replaces:
//
//	F1  A lone UTF-16 surrogate was silently replaced by U+FFFD, so U+D800 and
//	    U+D801 produced identical bytes and therefore identical identity.
//	F2  Duplicate property names were accepted because the host JSON reader
//	    collapsed them before any check could observe them.
//	G1  Duplicate detection compared RAW SPELLING, so "name" and its escaped
//	    spelling (u006Eame with a leading backslash) were treated as different
//	    names and both survived into one object.
//
// Names are therefore compared AFTER escape decoding, byte-exactly, with no
// Unicode normalization: canonically equivalent but byte-distinct names stay
// distinct, because normalizing would let two authored names collapse into one
// identity.
//
// Numbers are integers only. A trust object that says riskTier 3 must never be
// readable as 3.0000000001, and rounding a rejected value into an accepted one
// is a decision this package refuses to make on anyone's behalf.
package jsonstrict

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// Kind enumerates the value forms this package admits. There is no float kind
// and no "raw" kind by construction.
type Kind uint8

const (
	KindNull Kind = iota
	KindBool
	KindInt
	KindString
	KindArray
	KindObject
)

func (k Kind) String() string {
	switch k {
	case KindNull:
		return "null"
	case KindBool:
		return "bool"
	case KindInt:
		return "integer"
	case KindString:
		return "string"
	case KindArray:
		return "array"
	case KindObject:
		return "object"
	}
	return "unknown"
}

// Member is one object property. Declaration order is preserved on parse so a
// producer's ordering can be inspected; canonical serialization sorts.
type Member struct {
	Name  string
	Value *Value
}

// Value is an immutable-by-convention JSON value.
type Value struct {
	Kind   Kind
	Bool   bool
	Int    int64
	Str    string
	Array  []*Value
	Object []Member
}

// maxDepth bounds recursion so a hostile object cannot exhaust the stack. A
// governance object is a handful of levels deep; nothing legitimate approaches
// this.
const maxDepth = 64

// Null returns the JSON null value.
func Null() *Value { return &Value{Kind: KindNull} }

// Bool returns a JSON boolean.
func Bool(b bool) *Value { return &Value{Kind: KindBool, Bool: b} }

// Int returns a JSON integer.
func Int(i int64) *Value { return &Value{Kind: KindInt, Int: i} }

// String returns a JSON string.
func String(s string) *Value { return &Value{Kind: KindString, Str: s} }

// StringOrNull returns null for an empty pointer and a string otherwise. It
// exists so an absent value is spelled null rather than "", which an earlier
// implementation used and which let an empty string masquerade as identity.
func StringOrNull(s *string) *Value {
	if s == nil {
		return Null()
	}
	return String(*s)
}

// Array returns a JSON array preserving the given order. Order is the caller's
// responsibility and therefore a property of the object, never a side effect of
// serialization.
func Array(items ...*Value) *Value {
	if items == nil {
		items = []*Value{}
	}
	return &Value{Kind: KindArray, Array: items}
}

// ArrayOf builds an array from a slice.
func ArrayOf(items []*Value) *Value { return Array(items...) }

// Object returns a JSON object. Duplicate names are rejected here rather than
// at serialization time so a malformed object can never be constructed.
func Object(members ...Member) (*Value, error) {
	seen := make(map[string]struct{}, len(members))
	for _, m := range members {
		if _, dup := seen[m.Name]; dup {
			return nil, fmt.Errorf("object declares duplicate property name %q", m.Name)
		}
		seen[m.Name] = struct{}{}
	}
	if members == nil {
		members = []Member{}
	}
	return &Value{Kind: KindObject, Object: members}, nil
}

// MustObject is Object for statically known-good members. It panics only on a
// programming error inside this repository, never on external input.
func MustObject(members ...Member) *Value {
	v, err := Object(members...)
	if err != nil {
		panic(err)
	}
	return v
}

// P is shorthand for one member.
func P(name string, value *Value) Member { return Member{Name: name, Value: value} }

// Get returns the named property. The second result reports presence, which is
// distinct from a present null.
func (v *Value) Get(name string) (*Value, bool) {
	if v == nil || v.Kind != KindObject {
		return nil, false
	}
	for _, m := range v.Object {
		if m.Name == name {
			return m.Value, true
		}
	}
	return nil, false
}

// Names returns declared property names in declaration order.
func (v *Value) Names() []string {
	if v == nil || v.Kind != KindObject {
		return nil
	}
	out := make([]string, 0, len(v.Object))
	for _, m := range v.Object {
		out = append(out, m.Name)
	}
	return out
}

// StringValue returns the string content and whether the value is a string.
func (v *Value) StringValue() (string, bool) {
	if v == nil || v.Kind != KindString {
		return "", false
	}
	return v.Str, true
}

// IntValue returns the integer content and whether the value is an integer.
func (v *Value) IntValue() (int64, bool) {
	if v == nil || v.Kind != KindInt {
		return 0, false
	}
	return v.Int, true
}

// IsNull reports whether the value is present and null.
func (v *Value) IsNull() bool { return v != nil && v.Kind == KindNull }

// Parse reads one complete JSON document. Anything the grammar below does not
// explicitly admit is an error; there is no lenient path.
func Parse(src []byte) (*Value, error) {
	if !utf8.Valid(src) {
		return nil, errors.New("input is not valid UTF-8")
	}
	if len(src) >= 3 && src[0] == 0xEF && src[1] == 0xBB && src[2] == 0xBF {
		return nil, errors.New("input carries a UTF-8 BOM; canonical bytes never do")
	}
	p := &parser{src: src}
	p.skipSpace()
	v, err := p.value()
	if err != nil {
		return nil, err
	}
	p.skipSpace()
	if p.pos != len(p.src) {
		return nil, fmt.Errorf("trailing content at offset %d", p.pos)
	}
	return v, nil
}

// DecodeString decodes one JSON string token beginning at the opening quote and
// returns the decoded value and the offset just past the closing quote. It is
// exported because duplicate-name comparison is only meaningful on decoded
// names, and tests assert that directly.
func DecodeString(src []byte, start int) (string, int, error) {
	p := &parser{src: src, pos: start}
	s, err := p.str()
	if err != nil {
		return "", 0, err
	}
	return s, p.pos, nil
}

type parser struct {
	src   []byte
	pos   int
	depth int
}

func (p *parser) skipSpace() {
	for p.pos < len(p.src) {
		switch p.src[p.pos] {
		case ' ', '\t', '\n', '\r':
			p.pos++
		default:
			return
		}
	}
}

func (p *parser) value() (*Value, error) {
	if p.pos >= len(p.src) {
		return nil, errors.New("unexpected end of input where a value was required")
	}
	switch c := p.src[p.pos]; {
	case c == '{':
		return p.object()
	case c == '[':
		return p.array()
	case c == '"':
		s, err := p.str()
		if err != nil {
			return nil, err
		}
		return String(s), nil
	case c == 't':
		return p.literal("true", Bool(true))
	case c == 'f':
		return p.literal("false", Bool(false))
	case c == 'n':
		return p.literal("null", Null())
	case c == '-' || (c >= '0' && c <= '9'):
		return p.number()
	default:
		return nil, fmt.Errorf("unexpected character %q at offset %d", string(rune(c)), p.pos)
	}
}

func (p *parser) literal(word string, v *Value) (*Value, error) {
	if p.pos+len(word) > len(p.src) || string(p.src[p.pos:p.pos+len(word)]) != word {
		return nil, fmt.Errorf("malformed literal at offset %d", p.pos)
	}
	p.pos += len(word)
	return v, nil
}

func (p *parser) object() (*Value, error) {
	if p.depth++; p.depth > maxDepth {
		return nil, fmt.Errorf("object nesting exceeds the %d level limit", maxDepth)
	}
	defer func() { p.depth-- }()

	p.pos++ // '{'
	members := []Member{}
	// Names are compared AFTER decoding. This is the G1 repair: raw spelling is
	// not identity, the decoded string is.
	seen := make(map[string]struct{})
	p.skipSpace()
	if p.pos < len(p.src) && p.src[p.pos] == '}' {
		p.pos++
		return &Value{Kind: KindObject, Object: members}, nil
	}
	for {
		p.skipSpace()
		if p.pos >= len(p.src) || p.src[p.pos] != '"' {
			return nil, fmt.Errorf("expected a property name at offset %d", p.pos)
		}
		name, err := p.str()
		if err != nil {
			return nil, err
		}
		if _, dup := seen[name]; dup {
			return nil, fmt.Errorf("object declares duplicate property name %q after escape decoding", name)
		}
		seen[name] = struct{}{}

		p.skipSpace()
		if p.pos >= len(p.src) || p.src[p.pos] != ':' {
			return nil, fmt.Errorf("expected ':' after property name %q", name)
		}
		p.pos++
		p.skipSpace()
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		members = append(members, Member{Name: name, Value: v})

		p.skipSpace()
		if p.pos >= len(p.src) {
			return nil, errors.New("unterminated object")
		}
		switch p.src[p.pos] {
		case ',':
			p.pos++
		case '}':
			p.pos++
			return &Value{Kind: KindObject, Object: members}, nil
		default:
			return nil, fmt.Errorf("expected ',' or '}' at offset %d", p.pos)
		}
	}
}

func (p *parser) array() (*Value, error) {
	if p.depth++; p.depth > maxDepth {
		return nil, fmt.Errorf("array nesting exceeds the %d level limit", maxDepth)
	}
	defer func() { p.depth-- }()

	p.pos++ // '['
	items := []*Value{}
	p.skipSpace()
	if p.pos < len(p.src) && p.src[p.pos] == ']' {
		p.pos++
		return &Value{Kind: KindArray, Array: items}, nil
	}
	for {
		p.skipSpace()
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		items = append(items, v)
		p.skipSpace()
		if p.pos >= len(p.src) {
			return nil, errors.New("unterminated array")
		}
		switch p.src[p.pos] {
		case ',':
			p.pos++
		case ']':
			p.pos++
			return &Value{Kind: KindArray, Array: items}, nil
		default:
			return nil, fmt.Errorf("expected ',' or ']' at offset %d", p.pos)
		}
	}
}

// number admits only integers: an optional minus, then 0 or a non-zero leading
// digit run. A fraction or exponent is an error, never a rounding opportunity.
func (p *parser) number() (*Value, error) {
	start := p.pos
	if p.pos < len(p.src) && p.src[p.pos] == '-' {
		p.pos++
	}
	digits := p.pos
	for p.pos < len(p.src) && p.src[p.pos] >= '0' && p.src[p.pos] <= '9' {
		p.pos++
	}
	if p.pos == digits {
		return nil, fmt.Errorf("malformed number at offset %d", start)
	}
	if p.src[digits] == '0' && p.pos-digits > 1 {
		return nil, fmt.Errorf("number at offset %d has a leading zero", start)
	}
	if p.pos < len(p.src) {
		switch p.src[p.pos] {
		case '.':
			return nil, fmt.Errorf("number at offset %d is not an integer; canonical objects carry integers only", start)
		case 'e', 'E':
			return nil, fmt.Errorf("number at offset %d uses an exponent; canonical objects carry integers only", start)
		}
	}
	text := string(p.src[start:p.pos])
	var n int64
	var neg bool
	body := text
	if strings.HasPrefix(body, "-") {
		neg = true
		body = body[1:]
	}
	for i := 0; i < len(body); i++ {
		d := int64(body[i] - '0')
		if n > (math.MaxInt64-d)/10 {
			return nil, fmt.Errorf("integer %s does not fit in 64 bits", text)
		}
		n = n*10 + d
	}
	if neg {
		n = -n
	}
	return Int(n), nil
}

// str decodes one string token starting at the opening quote.
func (p *parser) str() (string, error) {
	if p.pos >= len(p.src) || p.src[p.pos] != '"' {
		return "", fmt.Errorf("expected a string at offset %d", p.pos)
	}
	p.pos++
	var b strings.Builder
	for {
		if p.pos >= len(p.src) {
			return "", errors.New("unterminated string")
		}
		c := p.src[p.pos]
		if c == '"' {
			p.pos++
			return b.String(), nil
		}
		if c < 0x20 {
			return "", fmt.Errorf("raw control character U+%04X in string at offset %d", c, p.pos)
		}
		if c != '\\' {
			b.WriteByte(c)
			p.pos++
			continue
		}
		p.pos++
		if p.pos >= len(p.src) {
			return "", errors.New("truncated escape")
		}
		e := p.src[p.pos]
		p.pos++
		switch e {
		case '"':
			b.WriteByte('"')
		case '\\':
			b.WriteByte('\\')
		case '/':
			b.WriteByte('/')
		case 'b':
			b.WriteByte(0x08)
		case 'f':
			b.WriteByte(0x0C)
		case 'n':
			b.WriteByte(0x0A)
		case 'r':
			b.WriteByte(0x0D)
		case 't':
			b.WriteByte(0x09)
		case 'u':
			r, err := p.unicodeEscape()
			if err != nil {
				return "", err
			}
			b.WriteRune(r)
		default:
			return "", fmt.Errorf("unknown escape \\%s", string(rune(e)))
		}
	}
}

// unicodeEscape decodes \uXXXX, requiring a well-formed surrogate PAIR for any
// surrogate half. This is the F1 repair: a lone surrogate is rejected outright
// rather than substituted with U+FFFD, because substitution maps an unbounded
// family of distinct inputs onto one identity.
func (p *parser) unicodeEscape() (rune, error) {
	u1, err := p.hex4()
	if err != nil {
		return 0, err
	}
	if utf16.IsSurrogate(rune(u1)) {
		if u1 >= 0xDC00 {
			return 0, fmt.Errorf("lone low surrogate escape \\u%04X", u1)
		}
		if p.pos+1 >= len(p.src) || p.src[p.pos] != '\\' || p.src[p.pos+1] != 'u' {
			return 0, fmt.Errorf("high surrogate escape \\u%04X is not followed by a low surrogate escape", u1)
		}
		p.pos += 2
		u2, err := p.hex4()
		if err != nil {
			return 0, err
		}
		if u2 < 0xDC00 || u2 > 0xDFFF {
			return 0, fmt.Errorf("high surrogate escape \\u%04X is followed by \\u%04X, which is not a low surrogate", u1, u2)
		}
		return utf16.DecodeRune(rune(u1), rune(u2)), nil
	}
	return rune(u1), nil
}

func (p *parser) hex4() (int, error) {
	if p.pos+4 > len(p.src) {
		return 0, errors.New("truncated \\u escape")
	}
	n := 0
	for i := 0; i < 4; i++ {
		c := p.src[p.pos+i]
		switch {
		case c >= '0' && c <= '9':
			n = n<<4 | int(c-'0')
		case c >= 'a' && c <= 'f':
			n = n<<4 | int(c-'a'+10)
		case c >= 'A' && c <= 'F':
			n = n<<4 | int(c-'A'+10)
		default:
			return 0, fmt.Errorf("invalid \\u escape %q", string(p.src[p.pos:p.pos+4]))
		}
	}
	p.pos += 4
	return n, nil
}
