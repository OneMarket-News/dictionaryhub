package pathgrammar

import "testing"

// ORIGINAL F5. The grammar accepted "a.txt:stream", which Win32 resolves as an
// NTFS alternate data stream, and accepted raw control characters. Each unsafe
// spelling below would let one signed path name something other than the single
// Git path it appears to name.
func TestUnsafePathsRejected(t *testing.T) {
	cases := map[string]string{
		"empty":                  "",
		"alternate data stream":  "a.txt:stream",
		"drive qualified":        "C:/a.txt",
		"drive relative":         "C:a.txt",
		"backslash separator":    `a\b.txt`,
		"leading slash":          "/a.txt",
		"trailing slash":         "a/",
		"doubled separator":      "a//b.txt",
		"dot segment":            "a/./b.txt",
		"parent segment":         "a/../b.txt",
		"leading parent":         "../a.txt",
		"bare dot":               ".",
		"bare parent":            "..",
		"NUL byte":               "a\x00b.txt",
		"newline":                "a\nb.txt",
		"carriage return":        "a\rb.txt",
		"tab":                    "a\tb.txt",
		"DEL":                    "a\x7fb.txt",
		"leading space":          " a.txt",
		"trailing space":         "a.txt ",
		"segment leading space":  "dir/ a.txt",
		"segment trailing space": "dir /a.txt",
		"trailing dot":           "a.txt.",
		"segment trailing dot":   "dir./a.txt",
		"device CON":             "CON",
		"device con lowercase":   "con",
		"device with extension":  "NUL.txt",
		"device in subdirectory": "dir/AUX.md",
		"device COM1":            "COM1",
		"device LPT9 extension":  "LPT9.log",
		"device mixed case":      "PrN.txt",
		"empty segment at end":   "dir//",
	}
	for label, path := range cases {
		if Safe(path) {
			t.Errorf("%s: Safe(%q) = true, want false", label, path)
		}
	}
}

func TestSafePathsAccepted(t *testing.T) {
	for _, path := range []string{
		"a.txt",
		"dir/a.txt",
		"a/b/c/d.txt",
		"tools/srgds-core/internal/authority/authority.go",
		"backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
		".gitignore",
		"a-b_c.d.txt",
		"CONSOLE.txt",    // not a device name, merely starts like one
		"COM0.txt",       // COM0 is not reserved
		"COM10.txt",      // two digits is not reserved
		"NULL.txt",       // NULL is not NUL
		"dir/CONtext.md", // prefix only
	} {
		if !Safe(path) {
			t.Errorf("Safe(%q) = false, want true", path)
		}
	}
}

// ORIGINAL G6. Protection previously depended on an incidental trailing slash:
// "backend" protected only the literal path while "backend/" protected the
// subtree. Signed protection must not hinge on spelling.
func TestSegmentPrefixSemantics(t *testing.T) {
	protectedBoth := []string{"backend", "backend/"}
	for _, guard := range protectedBoth {
		inside := []string{"backend", "backend/file.txt", "backend/sub/file.txt", "backend/db/migrations/001.sql"}
		for _, path := range inside {
			if !SegmentPrefix(guard, path) {
				t.Errorf("SegmentPrefix(%q, %q) = false, want true", guard, path)
			}
		}
		// Neighbouring names that merely share a character prefix are NOT
		// protected. A string-prefix test would wrongly capture all of these.
		outside := []string{"backend-old/file.txt", "backend2/file.txt", "mybackend/file.txt", "backendfile.txt", "back/end.txt"}
		for _, path := range outside {
			if SegmentPrefix(guard, path) {
				t.Errorf("SegmentPrefix(%q, %q) = true, want false", guard, path)
			}
		}
	}
	if NormalizeProtected("a/b/") != "a/b" {
		t.Error("NormalizeProtected did not remove the trailing slash")
	}
	if NormalizeProtected("a/b") != "a/b" {
		t.Error("NormalizeProtected altered an entry with no trailing slash")
	}
}

func TestAuthorizedProtectionBeatsAllowance(t *testing.T) {
	allowed := []string{"backend/db/migrations/020.sql", "docs/build/note.md", "tools/x.ps1"}
	protected := []string{"backend", "docs/architecture"}

	// Protected wins even when the same path is explicitly allowed, and the
	// order of the allowed set cannot change that.
	if Authorized(allowed, protected, "backend/db/migrations/020.sql") {
		t.Error("an explicitly allowed path under a protected entry was authorized")
	}
	// An enumerated path is authorized.
	if !Authorized(allowed, protected, "docs/build/note.md") {
		t.Error("an enumerated path was refused")
	}
	// There is NO directory grant: a sibling nobody wrote down is not covered,
	// and a trailing-slash allowance cannot be signed at all.
	if Authorized(allowed, protected, "docs/build/other.md") {
		t.Error("a path nobody enumerated was authorized")
	}
	if Authorized([]string{"docs/"}, nil, "docs/build/note.md") {
		t.Error("a directory-spelled allowance granted a subtree")
	}
	if Safe("docs/") {
		t.Error("a directory-spelled allowance is a signable path")
	}
	// An exact allowance matches exactly, and case is significant.
	if !Authorized(allowed, protected, "tools/x.ps1") {
		t.Error("an exactly allowed path was refused")
	}
	for _, path := range []string{"tools/X.ps1", "tools/x.ps1.bak", "tools/sub/x.ps1", "unlisted.txt"} {
		if Authorized(allowed, protected, path) {
			t.Errorf("%q was authorized by an exact-match entry", path)
		}
	}
	// An unsafe path is never authorized, whatever the sets say.
	if Authorized([]string{"a.txt:stream"}, nil, "a.txt:stream") {
		t.Error("an unsafe path was authorized because it was listed")
	}
}

func TestDisjointReportsContradictions(t *testing.T) {
	overlaps := Disjoint([]string{"backend/x.sql", "docs/a.md"}, []string{"backend"})
	if len(overlaps) != 1 {
		t.Fatalf("Disjoint found %d overlaps, want 1: %v", len(overlaps), overlaps)
	}
	if len(Disjoint([]string{"docs/a.md"}, []string{"backend"})) != 0 {
		t.Error("Disjoint reported an overlap between unrelated trees")
	}
	// The trailing-slash spelling must not change the answer.
	if len(Disjoint([]string{"backend/x.sql"}, []string{"backend/"})) != 1 {
		t.Error("Disjoint missed an overlap because the guard ended in a slash")
	}
}

func TestOrdinalSorted(t *testing.T) {
	if !OrdinalSorted([]string{"A", "Z", "_", "a", "b"}) {
		t.Error("an ordinal-sorted set was reported unsorted")
	}
	if OrdinalSorted([]string{"a", "A"}) {
		t.Error("a culture-order set was reported ordinal-sorted")
	}
	if OrdinalSorted([]string{"a", "a"}) {
		t.Error("a duplicate pair was reported sorted; sortedness must be strict")
	}
	if !OrdinalSorted(nil) || !OrdinalSorted([]string{"only"}) {
		t.Error("trivial sets must be sorted")
	}
}
