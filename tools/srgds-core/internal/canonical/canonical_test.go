package canonical

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"sourceroot.local/srgds-core/internal/jsonstrict"
)

func marshal(t *testing.T, v *jsonstrict.Value) string {
	t.Helper()
	b, err := Marshal(v)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	return string(b)
}

// ORIGINAL F1. The encoder must never substitute U+FFFD. Two distinct
// malformed inputs previously produced identical bytes and therefore one
// identity; both are now rejected, so the collision cannot be constructed.
func TestMalformedUnicodeIsRejectedNotSubstituted(t *testing.T) {
	// WTF-8 encodings of the lone surrogates U+D800 and U+D801.
	first := string([]byte{0xED, 0xA0, 0x80})
	second := string([]byte{0xED, 0xA0, 0x81})
	if first == second {
		t.Fatal("test inputs are not distinct")
	}
	for label, bad := range map[string]string{
		"lone high surrogate": first,
		"second surrogate":    second,
		"truncated sequence":  string([]byte{0xE2, 0x82}),
		"invalid start byte":  string([]byte{0xFF}),
	} {
		if _, err := EncodeString(bad); err == nil {
			t.Errorf("%s was encoded instead of rejected", label)
		}
		if _, err := Marshal(jsonstrict.String(bad)); err == nil {
			t.Errorf("%s survived Marshal", label)
		}
	}
	// The proof that matters: neither input can reach a digest at all, so they
	// cannot share one.
	if _, err := Marshal(jsonstrict.String(first)); err == nil {
		t.Error("a malformed string produced canonical bytes")
	}
}

func TestEscapeTable(t *testing.T) {
	cases := map[string]string{
		"":             `""`,
		"plain":        `"plain"`,
		`quote"inside`: `"quote\"inside"`,
		`back\slash`:   `"back\\slash"`,
		"tab\there":    `"tab\there"`,
		"nl\nhere":     `"nl\nhere"`,
		"cr\rhere":     `"cr\rhere"`,
		"bs\bhere":     `"bs\bhere"`,
		"ff\fhere":     `"ff\fhere"`,
		"nul\x00here":  `"nul\u0000here"`,
		"soh\x01here":  `"soh\u0001here"`,
		"unit\x1fhere": `"unit\u001fhere"`,
		"del\x7fhere":  "\"del\x7fhere\"",
		"slash/here":   `"slash/here"`,
		"unicode " + string(rune(0x00E9)) + " \U0001F600": "\"unicode " + string(rune(0x00E9)) + " \U0001F600\"",
	}
	for in, want := range cases {
		got, err := EncodeString(in)
		if err != nil {
			t.Errorf("EncodeString(%q): %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("EncodeString(%q) = %s, want %s", in, got, want)
		}
	}
	// Control escapes are LOWERCASE hex. The Product Authority has already
	// signed bytes in this form; emitting \u001F would silently invalidate a
	// signature that is otherwise perfectly good.
	got, _ := EncodeString("\x1b")
	if got != `"\u001b"` {
		t.Errorf("control escape is %s, want lowercase hex", got)
	}
}

func TestOrdinalKeyOrderingAndNoWhitespace(t *testing.T) {
	v := jsonstrict.MustObject(
		jsonstrict.P("b", jsonstrict.Int(2)),
		jsonstrict.P("A", jsonstrict.Int(1)),
		jsonstrict.P("a", jsonstrict.Int(3)),
		jsonstrict.P("Z", jsonstrict.Int(4)),
		jsonstrict.P("_", jsonstrict.Int(5)),
	)
	// Ordinal, not alphabetical: upper case sorts before lower case, and '_'
	// (0x5F) sorts between them. A culture-aware sort would interleave A and a.
	want := `{"A":1,"Z":4,"_":5,"a":3,"b":2}`
	if got := marshal(t, v); got != want {
		t.Errorf("ordering = %s, want %s", got, want)
	}
	if strings.ContainsAny(want, " \t\n\r") {
		t.Error("canonical output contains insignificant whitespace")
	}
}

func TestNoTrailingNewline(t *testing.T) {
	out := marshal(t, jsonstrict.MustObject(jsonstrict.P("a", jsonstrict.Int(1))))
	if strings.HasSuffix(out, "\n") {
		t.Error("canonical output ends with a newline")
	}
}

func TestArraysPreserveDeclaredOrder(t *testing.T) {
	v := jsonstrict.Array(jsonstrict.String("z"), jsonstrict.String("a"), jsonstrict.String("m"))
	if got := marshal(t, v); got != `["z","a","m"]` {
		t.Errorf("array order = %s; sorting is the caller's decision, not the serializer's", got)
	}
}

func TestDeterminism(t *testing.T) {
	build := func() *jsonstrict.Value {
		return jsonstrict.MustObject(
			jsonstrict.P("z", jsonstrict.Array(jsonstrict.Int(1), jsonstrict.Int(2))),
			jsonstrict.P("a", jsonstrict.MustObject(jsonstrict.P("n", jsonstrict.Null()))),
			jsonstrict.P("m", jsonstrict.Bool(true)),
		)
	}
	first, _, err := MarshalDigest(build())
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 50; i++ {
		next, _, err := MarshalDigest(build())
		if err != nil {
			t.Fatal(err)
		}
		if next != first {
			t.Fatalf("digest changed between runs: %s then %s", first, next)
		}
	}
	// A single changed byte must change the digest.
	changed := jsonstrict.MustObject(
		jsonstrict.P("z", jsonstrict.Array(jsonstrict.Int(1), jsonstrict.Int(3))),
		jsonstrict.P("a", jsonstrict.MustObject(jsonstrict.P("n", jsonstrict.Null()))),
		jsonstrict.P("m", jsonstrict.Bool(true)),
	)
	other, _, _ := MarshalDigest(changed)
	if other == first {
		t.Error("distinct objects produced one digest")
	}
}

func TestDigestIsUppercaseHex(t *testing.T) {
	d := Digest([]byte("abc"))
	const want = "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"
	if d != want {
		t.Errorf("Digest(abc) = %s, want %s", d, want)
	}
}

func TestDuplicateNamesRejectedAtSerialization(t *testing.T) {
	// Constructed by hand to bypass the constructor's own check, proving the
	// serializer does not depend on the constructor having been used.
	v := &jsonstrict.Value{Kind: jsonstrict.KindObject, Object: []jsonstrict.Member{
		{Name: "a", Value: jsonstrict.Int(1)},
		{Name: "a", Value: jsonstrict.Int(2)},
	}}
	if _, err := Marshal(v); err == nil {
		t.Error("duplicate names were serialized")
	}
}

// Canonical key order is UTF-16 code-unit order, reproducing .NET's
// StringComparer.Ordinal, because that is what ordered the objects the Product
// Authority has already signed.
//
// The expected sequence below is not derived from reasoning about the spec. It
// is the order .NET actually produced for these exact strings under
// [Array]::Sort($keys, [StringComparer]::Ordinal):
//
//	005A       "Z"
//	0061       "a"
//	00E9
//	0301
//	D7FF
//	D800 DC00  U+10000
//	D83D DE00  U+1F600
//	E000
//	FFFF
//
// Note where the supplementary characters land: BETWEEN U+D7FF and U+E000,
// because their first code unit is a high surrogate. Code-point order - which
// is what comparing UTF-8 bytes or Go runes gives - would put them last.
func TestCanonicalKeyOrderIsUTF16Ordinal(t *testing.T) {
	names := map[string]string{
		"ASCII upper": "Z",
		"ASCII lower": "a",
		"U+00E9":      string(rune(0x00E9)),
		"U+0301":      string(rune(0x0301)),
		"U+D7FF":      string(rune(0xD7FF)),
		"U+10000":     string(rune(0x10000)),
		"U+1F600":     string(rune(0x1F600)),
		"U+E000":      string(rune(0xE000)),
		"U+FFFF":      string(rune(0xFFFF)),
	}
	order := []string{
		"ASCII upper", "ASCII lower", "U+00E9", "U+0301",
		"U+D7FF", "U+10000", "U+1F600", "U+E000", "U+FFFF",
	}

	// Every name must remain a VALID name. The domain belongs to the authority
	// schema, not to the serializer.
	members := make([]jsonstrict.Member, 0, len(names))
	for _, label := range order {
		members = append(members, jsonstrict.P(names[label], jsonstrict.String(label)))
	}
	out := marshal(t, jsonstrict.MustObject(members...))

	// The serialized order is read back by finding each name's position.
	previous := -1
	for i, label := range order {
		encoded, err := EncodeString(names[label])
		if err != nil {
			t.Fatalf("%s is not serializable: %v", label, err)
		}
		at := strings.Index(out, encoded+":")
		if at < 0 {
			t.Fatalf("%s is absent from the canonical output", label)
		}
		if at < previous {
			t.Errorf("%s (position %d) sorts before %s (position %d); canonical order is not UTF-16 ordinal",
				label, i, order[i-1], i-1)
		}
		previous = at
	}

	// The comparator itself, pair by pair, including every divergent pair.
	for _, tc := range []struct {
		a, b string
		want int
	}{
		{"U+D7FF", "U+10000", -1}, // adjacent across the surrogate boundary
		{"U+10000", "U+E000", -1}, // DIVERGENT: code-point order says +1
		{"U+10000", "U+FFFF", -1}, // DIVERGENT: code-point order says +1
		{"U+1F600", "U+E000", -1}, // DIVERGENT
		{"U+1F600", "U+FFFF", -1}, // DIVERGENT
		{"U+10000", "U+1F600", -1},
		{"U+E000", "U+FFFF", -1},
		{"ASCII upper", "ASCII lower", -1},
		{"U+00E9", "U+0301", -1},
		{"U+0301", "U+D7FF", -1},
	} {
		got := CompareOrdinal(names[tc.a], names[tc.b])
		if (got < 0) != (tc.want < 0) || got == 0 {
			t.Errorf("CompareOrdinal(%s, %s) = %d, want sign %d", tc.a, tc.b, got, tc.want)
		}
		if reverse := CompareOrdinal(names[tc.b], names[tc.a]); (reverse > 0) != (tc.want < 0) {
			t.Errorf("CompareOrdinal is not antisymmetric for %s / %s", tc.a, tc.b)
		}
	}

	// The test would be vacuous if Go's native comparison already agreed. It
	// does not, and that is the whole point.
	if (names["U+10000"] < names["U+E000"]) == (CompareOrdinal(names["U+10000"], names["U+E000"]) < 0) {
		t.Error("Go's native comparison agrees with UTF-16 ordinal here, so this test proves nothing")
	}

	if CompareOrdinal("same", "same") != 0 {
		t.Error("equal strings do not compare equal")
	}
	if CompareOrdinal("a", "ab") >= 0 || CompareOrdinal("ab", "a") <= 0 {
		t.Error("a prefix does not sort before its extension")
	}
}

// The correction that produced the comparator above replaced a rule that
// rejected names at or above U+E000. Valid Unicode must not be refused merely
// because two implementations order it differently.
func TestValidUnicodeNamesAreNotRejected(t *testing.T) {
	for _, r := range []rune{0x00E9, 0x0301, 0xD7FF, 0xE000, 0xFFFD, 0xFFFF, 0x10000, 0x1F600, 0x10FFFF} {
		v := jsonstrict.MustObject(jsonstrict.P(string(r), jsonstrict.Int(1)))
		if _, err := Marshal(v); err != nil {
			t.Errorf("valid property name U+%04X was rejected: %v", r, err)
		}
	}
	// Malformed Unicode is still refused.
	surrogate := &jsonstrict.Value{Kind: jsonstrict.KindObject, Object: []jsonstrict.Member{
		{Name: string([]byte{0xED, 0xBF, 0xBF}), Value: jsonstrict.Int(1)},
	}}
	if _, err := Marshal(surrogate); err == nil {
		t.Error("a property name holding a lone surrogate was accepted")
	}
}

func TestReserializeRoundTrip(t *testing.T) {
	canonicalForm := `{"a":1,"b":["x","y"],"c":{"d":null},"e":false}`
	out, err := Reserialize([]byte(canonicalForm))
	if err != nil {
		t.Fatalf("Reserialize: %v", err)
	}
	if string(out) != canonicalForm {
		t.Errorf("round trip changed canonical bytes:\n got %s\nwant %s", out, canonicalForm)
	}
	// Non-canonical input parses but does not round-trip, which is exactly the
	// signal the authority loader uses.
	out, err = Reserialize([]byte(`{ "b":1, "a":2 }`))
	if err != nil {
		t.Fatalf("Reserialize: %v", err)
	}
	if string(out) == `{ "b":1, "a":2 }` {
		t.Error("non-canonical input was reported as canonical")
	}
	if string(out) != `{"a":2,"b":1}` {
		t.Errorf("reserialized to %s", out)
	}
}

// The strongest available proof that this implementation agrees with the one
// the Product Authority actually signed: the real signed authorization must
// re-serialize to its own bytes under THIS code. It was produced by an entirely
// separate PowerShell implementation, so agreement is not circular.
//
// The test is skipped where the control store is absent, because a machine
// without the store is not a machine where this can be proved.
func TestRealSignedAuthorizationIsCanonicalUnderThisImplementation(t *testing.T) {
	dir := filepath.Join(`C:\ProgramData\SourceRoot\GDS`, "github.com-OneMarket-News-dictionaryhub", "authorizations")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skipf("control store is not present on this machine: %v", err)
	}
	checked := 0
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".authorization.json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("reading %s: %v", name, err)
		}
		out, err := Reserialize(raw)
		if err != nil {
			t.Fatalf("%s was rejected by this parser: %v", name, err)
		}
		if string(out) != string(raw) {
			t.Errorf("%s does not re-serialize to its own signed bytes; this implementation disagrees with the one that signed it", name)
		}
		checked++
		t.Logf("%s: %d bytes, digest %s", name, len(raw), Digest(raw))
	}
	if checked == 0 {
		t.Skip("no authorization objects found")
	}
}

func TestNilAndUnsupported(t *testing.T) {
	if _, err := Marshal(nil); err == nil {
		t.Error("nil was serialized")
	}
	if _, err := Marshal(&jsonstrict.Value{Kind: jsonstrict.Kind(200)}); err == nil {
		t.Error("an unknown kind was serialized")
	}
}
