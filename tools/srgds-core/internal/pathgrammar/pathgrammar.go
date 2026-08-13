// Package pathgrammar decides which repository paths a signed authority object
// may name, and what a protected entry protects.
//
// A signed allowed path must denote exactly ONE Git repository path with no
// Windows filesystem reinterpretation. An audit proved the original grammar
// accepted "a.txt:stream", which Win32 resolves as an NTFS alternate data
// stream, and accepted raw control characters.
//
// Validation REJECTS unsafe spellings. It never normalizes them into some other
// path, because normalizing would let two distinct Git paths collapse into one
// identity, and the collapsed one would then be authorized by the other's
// signature.
package pathgrammar

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"sourceroot.local/srgds-core/internal/canonical"
)

// Safe reports whether p is a path a signed object may name.
func Safe(p string) bool {
	if p == "" {
		return false
	}
	if !utf8.ValidString(p) {
		return false
	}
	if p != trimSpace(p) {
		return false
	}
	for _, r := range p {
		switch {
		case r <= 0x1F: // ASCII control, including NUL
			return false
		case r == 0x7F: // DEL
			return false
		case r == ':': // drive-qualified paths and NTFS alternate data streams
			return false
		case r == '\\': // Windows separator
			return false
		}
	}
	if strings.HasPrefix(p, "/") || strings.HasSuffix(p, "/") || strings.Contains(p, "//") {
		return false
	}
	for _, segment := range strings.Split(p, "/") {
		if !safeSegment(segment) {
			return false
		}
	}
	return true
}

func safeSegment(segment string) bool {
	if segment == "" || segment == "." || segment == ".." {
		return false
	}
	if segment != trimSpace(segment) {
		return false
	}
	if strings.HasSuffix(segment, ".") {
		// Win32 strips trailing dots, so "a." and "a" would name one file.
		return false
	}
	// Reserved DOS device names, with or without an extension: writing through
	// Win32 would target a device rather than a file.
	base := segment
	if i := strings.Index(base, "."); i >= 0 {
		base = base[:i]
	}
	return !reservedDevice(base)
}

func reservedDevice(base string) bool {
	switch strings.ToUpper(base) {
	case "CON", "PRN", "AUX", "NUL":
		return true
	}
	upper := strings.ToUpper(base)
	if len(upper) == 4 && (strings.HasPrefix(upper, "COM") || strings.HasPrefix(upper, "LPT")) {
		c := upper[3]
		return c >= '1' && c <= '9'
	}
	return false
}

func trimSpace(s string) string { return strings.TrimFunc(s, unicode.IsSpace) }

// NormalizeProtected removes one trailing slash from a protected entry.
//
// A trailing slash in an ALREADY-SIGNED object is accepted and normalized away
// for matching, because the signed bytes may not be altered to suit a matcher.
func NormalizeProtected(entry string) string {
	return strings.TrimSuffix(entry, "/")
}

// SegmentPrefix reports whether path lies at or beneath prefix, comparing whole
// path segments.
//
// Protection previously depended on an incidental trailing slash: "backend"
// protected only the literal path while "backend/" protected the subtree.
// Signed protection must not hinge on spelling, so one rule applies to every
// protected entry P and candidate path C:
//
//	PROTECTED when C == P, or C starts with P + "/"
//
// so "backend" protects backend, backend/file.txt and backend/sub/file.txt, but
// never backend-old/file.txt, backend2/file.txt or mybackend/file.txt.
func SegmentPrefix(prefix, path string) bool {
	p := NormalizeProtected(prefix)
	if path == p {
		return true
	}
	return strings.HasPrefix(path, p+"/")
}

// Authorized decides one path against a signed authorization's two sets.
//
// The two sets are deliberately asymmetric:
//
//	protected  matches by SEGMENT PREFIX, so a guard covers a whole subtree
//	allowed    matches EXACTLY, so every authorized path is written down
//
// There is no directory grant. An allowed entry spelled "internal/" would
// authorize files nobody enumerated, including files that do not exist yet, and
// the signature would still be valid for all of them. Safe() rejects a trailing
// slash, so such an entry cannot be signed in the first place; matching it here
// would be dead code that quietly describes a capability this system does not
// have. Widening authority requires a new signed issuance, not a spelling.
//
// Protection is evaluated first and always wins, so no ordering of the allowed
// set can defeat it.
func Authorized(allowed, protected []string, path string) bool {
	if !Safe(path) {
		return false
	}
	for _, guard := range protected {
		if SegmentPrefix(guard, path) {
			return false
		}
	}
	for _, entry := range allowed {
		if path == entry {
			return true
		}
	}
	return false
}

// Disjoint reports the allowed entries that fall under a protected entry.
//
// An authorization whose own sets contradict each other is not a policy, so the
// authority loader refuses it rather than resolving the contradiction silently.
func Disjoint(allowed, protected []string) []string {
	var overlaps []string
	for _, entry := range allowed {
		for _, guard := range protected {
			if SegmentPrefix(guard, entry) {
				overlaps = append(overlaps, entry+" falls under "+guard)
			}
		}
	}
	return overlaps
}

// OrdinalSorted reports whether items are in strict ordinal order with no
// duplicates.
//
// Ordinal here means the same thing it means everywhere in this system: UTF-16
// code-unit order, as produced by the .NET StringComparer.Ordinal sort that
// ordered the already-signed path sets. Go's native string comparison orders
// UTF-8 bytes, which agrees for ASCII but disagrees for every supplementary
// character, and a signed set sorted correctly by the issuer must not be
// rejected here because the reader compares differently.
//
// Sortedness is checked, never applied: a signed set that is not sorted is a
// set whose producer disagreed with this contract.
func OrdinalSorted(items []string) bool {
	for i := 1; i < len(items); i++ {
		if canonical.CompareOrdinal(items[i-1], items[i]) >= 0 {
			return false
		}
	}
	return true
}
