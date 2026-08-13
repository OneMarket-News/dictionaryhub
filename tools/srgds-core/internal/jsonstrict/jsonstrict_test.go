package jsonstrict

import (
	"fmt"
	"strings"
	"testing"
)

func mustParse(t *testing.T, src string) *Value {
	t.Helper()
	v, err := Parse([]byte(src))
	if err != nil {
		t.Fatalf("Parse(%q) returned %v, want success", src, err)
	}
	return v
}

func mustReject(t *testing.T, label, src string) {
	t.Helper()
	if v, err := Parse([]byte(src)); err == nil {
		t.Errorf("%s: Parse(%q) was ACCEPTED as %v, want rejection", label, src, v.Kind)
	}
}

// ORIGINAL F2 / G1. Duplicate property names must be rejected, and the
// comparison must be made on the DECODED name: JSON defines a property by its
// decoded value, not by how it was spelled. The previous scanner compared raw
// spelling, so an escaped duplicate survived and one of the two values silently
// won.
func TestDuplicatePropertyNames(t *testing.T) {
	// Escaped spellings are BUILT here rather than typed, because an editor or a
	// transport that normalizes escape sequences in this source file would
	// quietly turn each case into the plain spelling and the test would then
	// prove nothing.
	esc := func(r rune) string { return fmt.Sprintf(`\u%04x`, r) }
	escUpper := func(r rune) string { return fmt.Sprintf(`\u%04X`, r) }
	escAll := func(s string) string {
		var b strings.Builder
		for _, r := range s {
			b.WriteString(esc(r))
		}
		return b.String()
	}
	// The surrogate-pair escape for U+1F600, spelled the long way.
	emojiEscaped := esc(0xD83D) + esc(0xDE00)

	cases := []struct {
		label string
		src   string
	}{
		{"escaped first character", `{"name":1,"` + esc('n') + `ame":2}`},
		{"escaped uppercase hex", `{"name":1,"` + escUpper('n') + `ame":2}`},
		{"fully escaped", `{"name":1,"` + escAll("name") + `":2}`},
		{"escaped quote", `{"a\"b":1,"a` + esc('"') + `b":2}`},
		{"surrogate pair spelled two ways", `{"😀":1,"` + emojiEscaped + `":2}`},
		{"identical spelling", `{"name":1,"name":2}`},
		{"escaped solidus", `{"a/b":1,"a\/b":2}`},
		{"nested object", `{"outer":{"dup":1,"dup":2}}`},
		{"inside array", `[{"dup":1,"dup":2}]`},
	}
	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) { mustReject(t, tc.label, tc.src) })
	}

	// Names that merely LOOK similar stay distinct. Case matters, and NO
	// Unicode normalization is applied: precomposed U+00E9 and decomposed
	// e + U+0301 render identically but are DIFFERENT names, and merging them
	// would let two authored names become one identity. Both are built from
	// code points so the source file cannot be normalized into a false pass.
	precomposed := string(rune(0x00E9))
	decomposed := "e" + string(rune(0x0301))
	for _, src := range []string{
		`{"name":1,"Name":2}`,
		`{"a":1,"a ":2}`,
		`{"` + precomposed + `":1,"` + decomposed + `":2}`,
	} {
		if _, err := Parse([]byte(src)); err != nil {
			t.Errorf("Parse(%q) rejected distinct names: %v", src, err)
		}
	}
}

// ORIGINAL F1. A lone surrogate escape must be rejected outright. Substituting
// U+FFFD maps an unbounded family of distinct inputs onto one identity, which
// is how U+D800 and U+D801 came to share a digest.
func TestSurrogateEscapes(t *testing.T) {
	for _, src := range []string{
		`"\ud800"`, `"\udc00"`, `"\ud800abc"`, `"\ud800A"`, `"\ud800\ud800"`,
		`"\udfff\ud800"`, `"\ud83d"`,
	} {
		mustReject(t, "lone surrogate", src)
	}
	v := mustParse(t, `"😀"`)
	if v.Str != "😀" {
		t.Errorf("surrogate pair decoded to %q, want the supplementary character", v.Str)
	}
	// Distinct lone surrogates must not be smoothed into one value. Both are
	// rejected, so the collision cannot exist.
	a, errA := Parse([]byte(`"\ud800"`))
	b, errB := Parse([]byte(`"\ud801"`))
	if errA == nil || errB == nil {
		t.Fatalf("lone surrogates were accepted: %v / %v", a, b)
	}
}

func TestIntegersOnly(t *testing.T) {
	for _, src := range []string{`1.0`, `1.5`, `1e3`, `1E3`, `-0.0`, `01`, `-01`, `+1`, `.5`, `1.`, `0x10`, `Infinity`, `NaN`} {
		mustReject(t, "non-integer", src)
	}
	for _, tc := range []struct {
		src  string
		want int64
	}{{`0`, 0}, {`-0`, 0}, {`3`, 3}, {`-3`, -3}, {`9223372036854775807`, 9223372036854775807}} {
		v := mustParse(t, tc.src)
		if got, ok := v.IntValue(); !ok || got != tc.want {
			t.Errorf("Parse(%s) = %v, want %d", tc.src, got, tc.want)
		}
	}
	// Beyond int64 is rejected rather than silently wrapped or turned into a
	// float, because a riskTier that changes value on the way in is not a tier.
	mustReject(t, "overflow", `9223372036854775808`)
}

func TestRawControlCharactersInStrings(t *testing.T) {
	for _, b := range []byte{0x00, 0x01, 0x09, 0x0A, 0x0D, 0x1F} {
		src := `"a` + string(rune(b)) + `b"`
		mustReject(t, "raw control", src)
	}
	// The escaped forms are fine.
	if v := mustParse(t, `"a\tb\nc"`); v.Str != "a\tb\nc" {
		t.Errorf("escaped controls decoded to %q", v.Str)
	}
}

func TestInvalidUTF8AndBOM(t *testing.T) {
	if _, err := Parse([]byte{'"', 0xFF, 0xFE, '"'}); err == nil {
		t.Error("invalid UTF-8 was accepted")
	}
	// The WTF-8 encoding of a lone surrogate is not valid UTF-8 and must not be
	// read as a character.
	if _, err := Parse([]byte{'"', 0xED, 0xA0, 0x80, '"'}); err == nil {
		t.Error("WTF-8 encoded lone surrogate was accepted")
	}
	if _, err := Parse([]byte("\xef\xbb\xbf{}")); err == nil {
		t.Error("a BOM was accepted; canonical bytes never carry one")
	}
}

func TestStructuralStrictness(t *testing.T) {
	cases := map[string]string{
		"trailing content":      `{} {}`,
		"trailing comma object": `{"a":1,}`,
		"trailing comma array":  `[1,]`,
		"unquoted name":         `{a:1}`,
		"single quotes":         `{'a':1}`,
		"unterminated object":   `{"a":1`,
		"unterminated array":    `[1`,
		"unterminated string":   `"abc`,
		"missing colon":         `{"a" 1}`,
		"bare word":             `undefined`,
		"empty input":           ``,
		"unknown escape":        `"\x41"`,
		"truncated escape":      `"\`,
		"short unicode escape":  `"\u41"`,
		"non-hex unicode":       `"\uZZZZ"`,
		"comment":               `{"a":1} // note`,
	}
	for label, src := range cases {
		t.Run(label, func(t *testing.T) { mustReject(t, label, src) })
	}
	// Insignificant whitespace between tokens is admitted on input; canonical
	// output never emits it.
	mustParse(t, " {\t\"a\" :\n1 ,\r\"b\": [ 1 , 2 ] } ")
}

func TestNestingLimit(t *testing.T) {
	deep := strings.Repeat("[", maxDepth+2) + strings.Repeat("]", maxDepth+2)
	mustReject(t, "deep array", deep)
	ok := strings.Repeat("[", 10) + strings.Repeat("]", 10)
	mustParse(t, ok)
}

func TestObjectConstructionRejectsDuplicates(t *testing.T) {
	if _, err := Object(P("a", Int(1)), P("a", Int(2))); err == nil {
		t.Error("Object accepted a duplicate name; a malformed object must not be constructible")
	}
	if _, err := Object(P("a", Int(1)), P("b", Int(2))); err != nil {
		t.Errorf("Object rejected distinct names: %v", err)
	}
}

func TestAccessors(t *testing.T) {
	v := mustParse(t, `{"s":"x","n":7,"b":true,"z":null,"a":[1],"o":{"k":"v"}}`)
	if s, ok := v.Get("s"); !ok {
		t.Fatal("Get missed a declared property")
	} else if str, ok := s.StringValue(); !ok || str != "x" {
		t.Errorf("string accessor returned %q", str)
	}
	if z, ok := v.Get("z"); !ok || !z.IsNull() {
		t.Error("a present null must be distinguishable from an absent property")
	}
	if _, ok := v.Get("absent"); ok {
		t.Error("Get reported an absent property as present")
	}
	if n, _ := v.Get("n"); func() bool { _, ok := n.StringValue(); return ok }() {
		t.Error("an integer answered a string accessor")
	}
	if got := len(v.Names()); got != 6 {
		t.Errorf("Names returned %d entries, want 6", got)
	}
}

func TestDecodeStringOffsets(t *testing.T) {
	src := []byte(`"ab\ncd" rest`)
	value, next, err := DecodeString(src, 0)
	if err != nil {
		t.Fatalf("DecodeString: %v", err)
	}
	if value != "ab\ncd" {
		t.Errorf("decoded %q", value)
	}
	// The token `"ab\ncd"` is 8 bytes, so the next offset is 8: the escape is
	// two source bytes that decode to one.
	if next != 8 {
		t.Errorf("next offset %d, want 8", next)
	}
}
