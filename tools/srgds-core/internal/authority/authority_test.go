package authority

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"sourceroot.local/srgds-core/internal/canonical"
	"sourceroot.local/srgds-core/internal/gitexec"
	"sourceroot.local/srgds-core/internal/jsonstrict"
)

// ===========================================================================
// An independent SSHSIG producer.
//
// The verifier is tested against signatures built here from the wire format
// directly, not against signatures made by the same code that verifies them.
// The complementary proof lives in the canonical package, where the REAL
// Product Authority object - produced by a separate PowerShell implementation -
// must re-serialize to its own signed bytes.
// ===========================================================================

func sshString(b *bytes.Buffer, v []byte) {
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(v)))
	b.Write(length[:])
	b.Write(v)
}

func pubBlobOf(pub ed25519.PublicKey) []byte {
	var b bytes.Buffer
	sshString(&b, []byte("ssh-ed25519"))
	sshString(&b, pub)
	return b.Bytes()
}

func armorSignature(priv ed25519.PrivateKey, message []byte, namespace string) []byte {
	pub := priv.Public().(ed25519.PublicKey)
	hashed := sha512.Sum512(message)

	var signed bytes.Buffer
	signed.WriteString("SSHSIG")
	sshString(&signed, []byte(namespace))
	sshString(&signed, nil)
	sshString(&signed, []byte("sha512"))
	sshString(&signed, hashed[:])

	var sigBlob bytes.Buffer
	sshString(&sigBlob, []byte("ssh-ed25519"))
	sshString(&sigBlob, ed25519.Sign(priv, signed.Bytes()))

	var outer bytes.Buffer
	outer.WriteString("SSHSIG")
	var version [4]byte
	binary.BigEndian.PutUint32(version[:], 1)
	outer.Write(version[:])
	sshString(&outer, pubBlobOf(pub))
	sshString(&outer, []byte(namespace))
	sshString(&outer, nil)
	sshString(&outer, []byte("sha512"))
	sshString(&outer, sigBlob.Bytes())

	encoded := base64.StdEncoding.EncodeToString(outer.Bytes())
	var out bytes.Buffer
	out.WriteString("-----BEGIN SSH SIGNATURE-----\n")
	for len(encoded) > 70 {
		out.WriteString(encoded[:70] + "\n")
		encoded = encoded[70:]
	}
	out.WriteString(encoded + "\n-----END SSH SIGNATURE-----\n")
	return out.Bytes()
}

// ===========================================================================
// Fixture
// ===========================================================================

const (
	testPrincipal = "test-product-authority"
	testStage     = "SOURCEROOT-TEST-STAGE-V1"
	testRepoID    = "github.com-OneMarket-News-dictionaryhub"
	newID         = "a8f6cf37-225b-42f6-a4ea-a333935825d4"
	oldID         = "b7a1c3e2-5d94-4f8a-9c16-3e0a72d5f481"
)

type fixture struct {
	t            *testing.T
	storeRoot    string
	store        string
	repo         string
	git          *gitexec.Runner
	baseline     string
	priv         ed25519.PrivateKey
	fingerprint  string
	otherPriv    ed25519.PrivateKey
	allowedPaths []string
	protected    []string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not available")
	}
	repo := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init", "-q")
	run("config", "user.email", "core@test")
	run("config", "user.name", "core")
	run("remote", "add", "origin", "https://github.com/OneMarket-News/dictionaryhub.git")
	os.WriteFile(filepath.Join(repo, "a.txt"), []byte("base"), 0o644)
	run("add", "-A")
	run("commit", "-q", "-m", "base")

	git := gitexec.New(repo)
	head, err := git.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}

	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	_, otherPriv, _ := ed25519.GenerateKey(rand.Reader)

	storeRoot := t.TempDir()
	store := filepath.Join(storeRoot, testRepoID)
	if err := os.MkdirAll(filepath.Join(store, "authorizations"), 0o700); err != nil {
		t.Fatal(err)
	}

	f := &fixture{
		t: t, storeRoot: storeRoot, store: store, repo: repo, git: git, baseline: head,
		priv: priv, otherPriv: otherPriv,
		fingerprint:  Fingerprint(pubBlobOf(priv.Public().(ed25519.PublicKey))),
		allowedPaths: []string{"a.txt", "docs/build/note.md", "tools/x.go"},
		protected:    []string{"backend", "secrets/"},
	}
	f.writeSigners(fmt.Sprintf("%s namespaces=%q ssh-ed25519 %s",
		testPrincipal, Namespace, base64.StdEncoding.EncodeToString(pubBlobOf(priv.Public().(ed25519.PublicKey)))))
	return f
}

func (f *fixture) writeSigners(line string) {
	f.t.Helper()
	if err := os.WriteFile(filepath.Join(f.store, "allowed_signers"), []byte(line+"\n"), 0o600); err != nil {
		f.t.Fatal(err)
	}
}

type overrides struct {
	authorizationID string
	stageSlug       string
	repositoryID    string
	baseline        string
	riskTier        int64
	lifecycleState  string
	namespace       string
	fingerprint     string
	allowed         []string
	protectedPaths  []string
	extraField      bool
	dropRequestedBy bool
}

func (f *fixture) payload(o overrides) []byte {
	f.t.Helper()
	pick := func(v, fallback string) string {
		if v == "" {
			return fallback
		}
		return v
	}
	allowed := o.allowed
	if allowed == nil {
		allowed = f.allowedPaths
	}
	protected := o.protectedPaths
	if protected == nil {
		protected = f.protected
	}
	tier := o.riskTier
	if tier == 0 {
		tier = 3
	}
	toArray := func(items []string) *jsonstrict.Value {
		out := make([]*jsonstrict.Value, 0, len(items))
		for _, item := range items {
			out = append(out, jsonstrict.String(item))
		}
		return jsonstrict.ArrayOf(out)
	}

	members := []jsonstrict.Member{
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String(ObjectType)),
		jsonstrict.P("authorizationId", jsonstrict.String(pick(o.authorizationID, newID))),
		jsonstrict.P("repositoryId", jsonstrict.String(pick(o.repositoryID, testRepoID))),
		jsonstrict.P("stageSlug", jsonstrict.String(pick(o.stageSlug, testStage))),
		jsonstrict.P("riskTier", jsonstrict.Int(tier)),
		jsonstrict.P("baselineCommit", jsonstrict.String(pick(o.baseline, f.baseline))),
		jsonstrict.P("lifecycleState", jsonstrict.String(pick(o.lifecycleState, "DEFINED"))),
		jsonstrict.P("allowedPaths", toArray(allowed)),
		jsonstrict.P("protectedPaths", toArray(protected)),
		jsonstrict.P("issuedAt", jsonstrict.String("2026-08-12T05:11:30Z")),
		jsonstrict.P("signerKeyFingerprint", jsonstrict.String(pick(o.fingerprint, f.fingerprint))),
		jsonstrict.P("signatureNamespace", jsonstrict.String(pick(o.namespace, Namespace))),
	}
	if !o.dropRequestedBy {
		members = append(members, jsonstrict.P("requestedBy", jsonstrict.String("Principal Architect")))
	}
	if o.extraField {
		members = append(members, jsonstrict.P("zzzExtra", jsonstrict.String("unexpected")))
	}
	value, err := jsonstrict.Object(members...)
	if err != nil {
		f.t.Fatal(err)
	}
	raw, err := canonical.Marshal(value)
	if err != nil {
		f.t.Fatal(err)
	}
	return raw
}

// issue writes an authorization and its signature, returning the digest.
func (f *fixture) issue(filename string, raw []byte, signer ed25519.PrivateKey, namespace string) string {
	f.t.Helper()
	path := filepath.Join(f.store, "authorizations", filename)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(path+".sig", armorSignature(signer, raw, namespace), 0o600); err != nil {
		f.t.Fatal(err)
	}
	return canonical.Digest(raw)
}

func (f *fixture) versionedName(id string) string {
	return fmt.Sprintf("%s.%s.authorization.json", testStage, id)
}

func (f *fixture) legacyName() string {
	return fmt.Sprintf("%s.authorization.json", testStage)
}

func (f *fixture) load(id, digest string) Authorization {
	return Load(Request{
		ControlStoreRoot: f.storeRoot,
		RepositoryID:     testRepoID,
		StageSlug:        testStage,
		AuthorizationID:  id,
		ExpectedDigest:   digest,
		ExpectedSigner:   f.fingerprint,
		SignerPrincipal:  testPrincipal,
		RepositoryRoot:   f.repo,
		Git:              f.git,
	})
}

// ===========================================================================
// Tests
// ===========================================================================

func TestValidAuthorizationIsAccepted(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})
	digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)

	auth := f.load(newID, digest)
	if !auth.Valid {
		t.Fatalf("valid authorization was rejected: %s", auth.Reason)
	}
	if auth.Selection != "versioned" {
		t.Errorf("selection = %q", auth.Selection)
	}
	if auth.AuthorizationID != newID || auth.Digest != digest {
		t.Errorf("identity = %s / %s", auth.AuthorizationID, auth.Digest)
	}
	if auth.RiskTier != 3 || auth.BaselineCommit != f.baseline || auth.LifecycleState != "DEFINED" {
		t.Errorf("payload fields were not bound: %+v", auth)
	}
	if auth.SignerFingerprint != f.fingerprint {
		t.Errorf("fingerprint = %s, want %s", auth.SignerFingerprint, f.fingerprint)
	}
	// A lowercase expected digest is accepted; the comparison is on value.
	if !f.load(newID, strings.ToLower(digest)).Valid {
		t.Error("a lowercase expected digest was rejected")
	}
}

// Selection is by explicit id AND digest. Nothing is selected because it
// exists, because it is newest, or because its UUID sorts highest.
func TestSelectionRequiresIdentityAndDigest(t *testing.T) {
	f := newFixture(t)
	newRaw := f.payload(overrides{authorizationID: newID})
	newDigest := f.issue(f.versionedName(newID), newRaw, f.priv, Namespace)
	oldRaw := f.payload(overrides{authorizationID: oldID, allowed: []string{"a.txt"}})
	oldDigest := f.issue(f.legacyName(), oldRaw, f.priv, Namespace)

	if newDigest == oldDigest {
		t.Fatal("the two issuances are not distinct")
	}

	if auth := f.load(newID, newDigest); !auth.Valid || auth.Selection != "versioned" {
		t.Errorf("new issuance: %s", auth.Reason)
	}
	if auth := f.load(oldID, oldDigest); !auth.Valid || auth.Selection != "legacy-unversioned" {
		t.Errorf("old issuance: %s", auth.Reason)
	}
	if auth := f.load(newID, oldDigest); auth.Valid {
		t.Error("new id with the old digest was accepted")
	}
	if auth := f.load(oldID, newDigest); auth.Valid {
		t.Error("old id with the new digest was accepted")
	}

	// NO FALLBACK. An unknown id resolves to the legacy file and is handed that
	// file's OWN digest, so digest, signature, schema and baseline all pass.
	// Only the id binding can refuse it, and it must.
	unknown := "00000000-0000-4000-8000-000000000000"
	auth := f.load(unknown, oldDigest)
	if auth.Valid {
		t.Fatal("an unknown id was answered by a different issuance")
	}
	if auth.Selection != "legacy-unversioned" {
		t.Errorf("the legacy file was not even reached: %s", auth.Selection)
	}
	if !strings.Contains(auth.Reason, "not the requested") {
		t.Errorf("refusal was not on identity: %s", auth.Reason)
	}
	// A request for the new issuance never consults the legacy file at all.
	if got := f.load(newID, newDigest); !strings.HasSuffix(got.Path, f.versionedName(newID)) {
		t.Errorf("new issuance resolved to %s", got.Path)
	}
}

func TestMalformedRequestNeverReachesTheFilesystem(t *testing.T) {
	f := newFixture(t)
	digest := f.issue(f.versionedName(newID), f.payload(overrides{}), f.priv, Namespace)

	for _, tc := range []struct{ label, id, digest string }{
		{"uppercase id", strings.ToUpper(newID), digest},
		{"traversal id", "../../../etc/passwd", digest},
		{"empty id", "", digest},
		{"short digest", newID, "ABC"},
		{"non-hex digest", newID, strings.Repeat("Z", 64)},
		{"empty digest", newID, ""},
	} {
		auth := f.load(tc.id, tc.digest)
		if auth.Valid {
			t.Errorf("%s was accepted", tc.label)
		}
		if auth.Path != "" {
			t.Errorf("%s reached the filesystem: %s", tc.label, auth.Path)
		}
	}
}

// ORIGINAL F4. Authorization was accepted while HEAD had already moved past the
// signed baseline, so a clean tree on the wrong commit passed.
func TestBaselineIsEnforcedUnconditionally(t *testing.T) {
	f := newFixture(t)
	wrong := strings.Repeat("0", 40)
	raw := f.payload(overrides{baseline: wrong})
	digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)

	auth := f.load(newID, digest)
	if auth.Valid {
		t.Fatal("an authorization for a different baseline was accepted")
	}
	if !strings.Contains(auth.Reason, "not the authorized baseline") {
		t.Errorf("refusal was not about the baseline: %s", auth.Reason)
	}

	// And with no repository at all, the check cannot be skipped by omission.
	res := Load(Request{
		ControlStoreRoot: f.storeRoot, RepositoryID: testRepoID, StageSlug: testStage,
		AuthorizationID: newID, ExpectedDigest: digest, ExpectedSigner: f.fingerprint,
		SignerPrincipal: testPrincipal, RepositoryRoot: f.repo, Git: nil,
	})
	if res.Valid {
		t.Error("omitting the repository produced a valid authorization")
	}
}

func TestTamperedBytesAreRejected(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})
	digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)

	// One byte changed on disk: the digest no longer matches what was asked for.
	path := filepath.Join(f.store, "authorizations", f.versionedName(newID))
	tampered := bytes.Replace(raw, []byte(`"riskTier":3`), []byte(`"riskTier":4`), 1)
	if bytes.Equal(tampered, raw) {
		t.Fatal("tamper did not change the bytes")
	}
	os.WriteFile(path, tampered, 0o600)

	if auth := f.load(newID, digest); auth.Valid {
		t.Error("tampered bytes passed the digest check")
	}
	// Even asking for the TAMPERED digest fails, because the signature covers
	// the original bytes.
	auth := f.load(newID, canonical.Digest(tampered))
	if auth.Valid {
		t.Fatal("tampered bytes passed signature verification")
	}
	if !strings.Contains(auth.Reason, "signature verification failed") {
		t.Errorf("refusal was not on the signature: %s", auth.Reason)
	}
}

func TestSignatureBinding(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})

	t.Run("wrong key", func(t *testing.T) {
		digest := f.issue(f.versionedName(newID), raw, f.otherPriv, Namespace)
		if auth := f.load(newID, digest); auth.Valid {
			t.Error("a signature from an unlisted key was accepted")
		}
	})

	t.Run("wrong namespace", func(t *testing.T) {
		digest := f.issue(f.versionedName(newID), raw, f.priv, "some-other-namespace")
		auth := f.load(newID, digest)
		if auth.Valid {
			t.Fatal("a signature made for another namespace was accepted")
		}
		if !strings.Contains(auth.Reason, "namespace") {
			t.Errorf("refusal was not about the namespace: %s", auth.Reason)
		}
	})

	t.Run("missing signature", func(t *testing.T) {
		digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
		os.Remove(filepath.Join(f.store, "authorizations", f.versionedName(newID)+".sig"))
		if auth := f.load(newID, digest); auth.Valid {
			t.Error("an unsigned object was accepted")
		}
	})

	t.Run("corrupt armor", func(t *testing.T) {
		digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
		sig := filepath.Join(f.store, "authorizations", f.versionedName(newID)+".sig")
		os.WriteFile(sig, []byte("-----BEGIN SSH SIGNATURE-----\nnot base64!!\n-----END SSH SIGNATURE-----\n"), 0o600)
		if auth := f.load(newID, digest); auth.Valid {
			t.Error("corrupt armor was accepted")
		}
	})
}

// An option in allowed_signers is a restriction the file intended to impose.
// Honouring the line while ignoring the option would grant more than was
// written down, so unknown options fail closed.
func TestAllowedSignersOptions(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})
	digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
	encoded := base64.StdEncoding.EncodeToString(pubBlobOf(f.priv.Public().(ed25519.PublicKey)))

	t.Run("namespace restriction admits this namespace", func(t *testing.T) {
		f.writeSigners(fmt.Sprintf("%s namespaces=%q ssh-ed25519 %s", testPrincipal, Namespace, encoded))
		if auth := f.load(newID, digest); !auth.Valid {
			t.Errorf("a correctly namespaced key was rejected: %s", auth.Reason)
		}
	})

	t.Run("namespace restriction excludes this namespace", func(t *testing.T) {
		f.writeSigners(fmt.Sprintf("%s namespaces=%q ssh-ed25519 %s", testPrincipal, "git", encoded))
		auth := f.load(newID, digest)
		if auth.Valid {
			t.Fatal("a key restricted to another namespace was used")
		}
		if !strings.Contains(auth.Reason, "does not admit") {
			t.Errorf("refusal was not about the restriction: %s", auth.Reason)
		}
	})

	t.Run("unimplemented option fails closed", func(t *testing.T) {
		f.writeSigners(fmt.Sprintf("%s valid-before=20200101 ssh-ed25519 %s", testPrincipal, encoded))
		auth := f.load(newID, digest)
		if auth.Valid {
			t.Fatal("an unimplemented restriction was ignored")
		}
		if !strings.Contains(auth.Reason, "does not implement") {
			t.Errorf("refusal was not about the unknown option: %s", auth.Reason)
		}
	})

	t.Run("no options", func(t *testing.T) {
		f.writeSigners(fmt.Sprintf("%s ssh-ed25519 %s", testPrincipal, encoded))
		if auth := f.load(newID, digest); !auth.Valid {
			t.Errorf("an unrestricted line was rejected: %s", auth.Reason)
		}
	})

	t.Run("different principal", func(t *testing.T) {
		f.writeSigners(fmt.Sprintf("someone-else ssh-ed25519 %s", encoded))
		if auth := f.load(newID, digest); auth.Valid {
			t.Error("a key listed for another principal was used")
		}
	})
}

func TestSchemaContract(t *testing.T) {
	f := newFixture(t)
	cases := []struct {
		label  string
		over   overrides
		expect string
	}{
		{"unknown property", overrides{extraField: true}, "unknown properties"},
		{"missing property", overrides{dropRequestedBy: true}, "missing required properties"},
		{"risk tier too low", overrides{riskTier: -1}, "outside the supported range"},
		{"risk tier too high", overrides{riskTier: 9}, "outside the supported range"},
		{"wrong lifecycle state", overrides{lifecycleState: "ACTIVE"}, "must be issued in DEFINED"},
		{"unknown lifecycle state", overrides{lifecycleState: "SHIPPED"}, "unknown lifecycleState"},
		{"wrong namespace field", overrides{namespace: "other"}, "signatureNamespace"},
		{"wrong repository", overrides{repositoryID: "github.com-someone-else"}, "is for repository"},
		{"wrong stage", overrides{stageSlug: "SOME-OTHER-STAGE-V1"}, "is for stage"},
		{"wrong id", overrides{authorizationID: oldID}, "not the requested"},
		{"unsorted allowed paths", overrides{allowed: []string{"b.txt", "a.txt"}}, "ordinal order"},
		{"duplicate allowed paths", overrides{allowed: []string{"a.txt", "a.txt"}}, "ordinal order"},
		{"unsafe allowed path", overrides{allowed: []string{"a.txt:stream"}}, "unsafe path"},
		{"allowed under protected", overrides{allowed: []string{"backend/x.sql"}, protectedPaths: []string{"backend"}}, "contradicts itself"},
		{"empty allowed set", overrides{allowed: []string{}}, "must not be empty"},
	}
	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) {
			raw := f.payload(tc.over)
			digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
			auth := f.load(newID, digest)
			if auth.Valid {
				t.Fatalf("%s was accepted", tc.label)
			}
			if !strings.Contains(auth.Reason, tc.expect) {
				t.Errorf("reason %q does not mention %q", auth.Reason, tc.expect)
			}
		})
	}
}

// A signature over non-canonical bytes would bind a form this system cannot
// reproduce, and therefore cannot re-verify later.
func TestNonCanonicalBytesRejected(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})
	spaced := append([]byte{}, raw...)
	spaced = bytes.Replace(spaced, []byte(`{"allowedPaths"`), []byte(`{ "allowedPaths"`), 1)
	if bytes.Equal(spaced, raw) {
		t.Fatal("could not construct non-canonical bytes")
	}
	digest := f.issue(f.versionedName(newID), spaced, f.priv, Namespace)
	auth := f.load(newID, digest)
	if auth.Valid {
		t.Fatal("non-canonical signed bytes were accepted")
	}
	if !strings.Contains(auth.Reason, "canonical") {
		t.Errorf("refusal was not about canonical form: %s", auth.Reason)
	}
}

func TestAbsentAuthority(t *testing.T) {
	f := newFixture(t)
	auth := f.load(newID, strings.Repeat("A", 64))
	if auth.Valid {
		t.Fatal("a missing authority object produced a valid authorization")
	}
	if !strings.Contains(auth.Reason, "no authority object is bound") {
		t.Errorf("reason = %s", auth.Reason)
	}
}

func TestPathAuthorized(t *testing.T) {
	f := newFixture(t)
	raw := f.payload(overrides{})
	digest := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
	auth := f.load(newID, digest)
	if !auth.Valid {
		t.Fatalf("fixture authorization invalid: %s", auth.Reason)
	}
	for path, want := range map[string]bool{
		"a.txt":               true,
		"tools/x.go":          true,
		"docs/build/note.md":  true,
		"docs/build/other.md": false, // no directory grant: only enumerated paths
		"docs/build":          false,
		"b.txt":               false,
		"backend/x.sql":       false,
		"secrets/key.pem":     false,
		"a.txt:stream":        false,
		"../outside.txt":      false,
		"A.TXT":               false,
	} {
		if got := auth.PathAuthorized(path); got != want {
			t.Errorf("PathAuthorized(%q) = %v, want %v", path, got, want)
		}
	}
	// An invalid authorization authorizes nothing at all.
	if (Authorization{Valid: false, AllowedPaths: []string{"a.txt"}}).PathAuthorized("a.txt") {
		t.Error("an invalid authorization authorized a path")
	}
}

// ===========================================================================
// Audit binding and release authorization
// ===========================================================================

const testCandidate = "1111111111111111111111111111111111111111111111111111111111111111"

// testBinary stands in for the SHA-256 of the audited trust-core executable.
const testBinary = "2222222222222222222222222222222222222222222222222222222222222222"

func (f *fixture) issueAudit(candidate, verdict string, signer ed25519.PrivateKey, over string) string {
	return f.issueAuditBinary(candidate, verdict, signer, over, testBinary)
}

func (f *fixture) issueAuditBinary(candidate, verdict string, signer ed25519.PrivateKey, over, binary string) string {
	f.t.Helper()
	if over == "" {
		over = candidate
	}
	value := jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String("AuditBinding")),
		jsonstrict.P("repositoryId", jsonstrict.String(testRepoID)),
		jsonstrict.P("stageSlug", jsonstrict.String(testStage)),
		jsonstrict.P("candidateDigest", jsonstrict.String(over)),
		jsonstrict.P("binarySha256", jsonstrict.String(binary)),
		jsonstrict.P("verdict", jsonstrict.String(verdict)),
		jsonstrict.P("auditorIdentity", jsonstrict.String("Independent Audit")),
		jsonstrict.P("auditedAt", jsonstrict.String("2026-08-12T06:00:00Z")),
		jsonstrict.P("auditReportDigest", jsonstrict.String(strings.Repeat("C", 64))),
	)
	raw, err := canonical.Marshal(value)
	if err != nil {
		f.t.Fatal(err)
	}
	path := AuditPath(f.store, testStage, candidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	os.WriteFile(path+".sig", armorSignature(signer, raw, Namespace), 0o600)
	return canonical.Digest(raw)
}

func (f *fixture) issueRelease(candidate, auditDigest string, signer ed25519.PrivateKey) string {
	return f.issueReleaseBinary(candidate, auditDigest, signer, testBinary)
}

func (f *fixture) issueReleaseBinary(candidate, auditDigest string, signer ed25519.PrivateKey, binary string) string {
	f.t.Helper()
	value := jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String("ReleaseAuthorization")),
		jsonstrict.P("repositoryId", jsonstrict.String(testRepoID)),
		jsonstrict.P("stageSlug", jsonstrict.String(testStage)),
		jsonstrict.P("candidateDigest", jsonstrict.String(candidate)),
		jsonstrict.P("binarySha256", jsonstrict.String(binary)),
		jsonstrict.P("auditBindingDigest", jsonstrict.String(auditDigest)),
		jsonstrict.P("authorizedAt", jsonstrict.String("2026-08-12T07:00:00Z")),
		jsonstrict.P("signerKeyFingerprint", jsonstrict.String(f.fingerprint)),
		jsonstrict.P("signatureNamespace", jsonstrict.String(Namespace)),
	)
	raw, err := canonical.Marshal(value)
	if err != nil {
		f.t.Fatal(err)
	}
	path := ReleasePath(f.store, testStage, candidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	os.WriteFile(path+".sig", armorSignature(signer, raw, Namespace), 0o600)
	return canonical.Digest(raw)
}

func (f *fixture) bindingRequest(candidate, expected string) BindingRequest {
	return BindingRequest{
		ControlStoreRoot: f.storeRoot,
		RepositoryID:     testRepoID,
		StageSlug:        testStage,
		CandidateDigest:  candidate,
		ExpectedDigest:   expected,
		ExpectedSigner:   f.fingerprint,
		SignerPrincipal:  testPrincipal,
	}
}

func TestReleaseChainRequiresEveryLink(t *testing.T) {
	f := newFixture(t)
	auditDigest := f.issueAudit(testCandidate, "PASS", f.priv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)

	audit := LoadAuditBinding(f.bindingRequest(testCandidate, auditDigest))
	if !audit.Valid {
		t.Fatalf("valid audit binding rejected: %s", audit.Reason)
	}
	release := LoadReleaseAuthorization(f.bindingRequest(testCandidate, releaseDigest))
	if !release.Valid {
		t.Fatalf("valid release authorization rejected: %s", release.Reason)
	}
	if err := ReleaseChain(audit, release, testCandidate, testBinary); err != nil {
		t.Fatalf("a complete chain was refused: %v", err)
	}

	t.Run("a FAIL audit blocks release", func(t *testing.T) {
		failed := f.issueAudit(testCandidate, "FAIL", f.priv, "")
		bad := LoadAuditBinding(f.bindingRequest(testCandidate, failed))
		if !bad.Valid {
			t.Fatalf("a FAIL binding is still a valid object: %s", bad.Reason)
		}
		if err := ReleaseChain(bad, release, testCandidate, testBinary); err == nil {
			t.Error("release was granted over a FAIL audit")
		}
		// Restore the PASS binding for the remaining subtests.
		f.issueAudit(testCandidate, "PASS", f.priv, "")
	})

	t.Run("release naming a different audit binding is refused", func(t *testing.T) {
		other := audit
		other.Digest = strings.Repeat("D", 64)
		if err := ReleaseChain(other, release, testCandidate, testBinary); err == nil {
			t.Error("release was granted while naming another audit binding")
		}
	})

	t.Run("a chain over another candidate is refused", func(t *testing.T) {
		otherCandidate := strings.Repeat("2", 64)
		if err := ReleaseChain(audit, release, otherCandidate, testBinary); err == nil {
			t.Error("a chain for one candidate authorized another")
		}
	})

	t.Run("an audit over another candidate cannot be loaded for this one", func(t *testing.T) {
		mismatched := f.issueAudit(testCandidate, "PASS", f.priv, strings.Repeat("3", 64))
		got := LoadAuditBinding(f.bindingRequest(testCandidate, mismatched))
		if got.Valid {
			t.Error("an audit binding naming another candidate was accepted")
		}
		if !strings.Contains(got.Reason, "is over candidate") {
			t.Errorf("refusal was not about the candidate: %s", got.Reason)
		}
		f.issueAudit(testCandidate, "PASS", f.priv, "")
	})

	t.Run("wrong expected digest is refused", func(t *testing.T) {
		got := LoadAuditBinding(f.bindingRequest(testCandidate, strings.Repeat("F", 64)))
		if got.Valid {
			t.Error("an audit binding with the wrong expected digest was accepted")
		}
		gotRelease := LoadReleaseAuthorization(f.bindingRequest(testCandidate, strings.Repeat("F", 64)))
		if gotRelease.Valid {
			t.Error("a release authorization with the wrong expected digest was accepted")
		}
	})

	t.Run("an unlisted signer is refused", func(t *testing.T) {
		digest := f.issueAudit(testCandidate, "PASS", f.otherPriv, "")
		if got := LoadAuditBinding(f.bindingRequest(testCandidate, digest)); got.Valid {
			t.Error("an audit binding signed by an unlisted key was accepted")
		}
		f.issueAudit(testCandidate, "PASS", f.priv, "")
	})

	t.Run("an invalid link never yields a chain", func(t *testing.T) {
		if err := ReleaseChain(AuditBinding{Valid: false, Reason: "x"}, release, testCandidate, testBinary); err == nil {
			t.Error("an invalid audit binding produced a chain")
		}
		if err := ReleaseChain(audit, ReleaseAuthorization{Valid: false, Reason: "x"}, testCandidate, testBinary); err == nil {
			t.Error("an invalid release authorization produced a chain")
		}
	})
}

// BINARY IDENTITY. An audit is evidence about a specific decision procedure.
// A binary built from source that merely resembles the audited source is not
// the binary that produced the verdict, and must not be able to satisfy a
// release authorization bound to it.
func TestReleaseChainBindsTheAuditedBinary(t *testing.T) {
	f := newFixture(t)
	auditDigest := f.issueAudit(testCandidate, "PASS", f.priv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)
	audit := LoadAuditBinding(f.bindingRequest(testCandidate, auditDigest))
	release := LoadReleaseAuthorization(f.bindingRequest(testCandidate, releaseDigest))
	if !audit.Valid || !release.Valid {
		t.Fatalf("fixture invalid: %s / %s", audit.Reason, release.Reason)
	}
	if audit.BinarySha256 != testBinary || release.BinarySha256 != testBinary {
		t.Fatalf("binary identity was not bound: %q / %q", audit.BinarySha256, release.BinarySha256)
	}

	otherBinary := strings.Repeat("9", 64)

	t.Run("a different running binary cannot satisfy the chain", func(t *testing.T) {
		err := ReleaseChain(audit, release, testCandidate, otherBinary)
		if err == nil {
			t.Fatal("a binary that was never audited satisfied the release chain")
		}
		if !strings.Contains(err.Error(), "cannot satisfy") {
			t.Errorf("refusal was not about binary identity: %v", err)
		}
	})

	t.Run("an unidentifiable running binary is refused", func(t *testing.T) {
		if err := ReleaseChain(audit, release, testCandidate, ""); err == nil {
			t.Error("an unidentifiable trust core satisfied the release chain")
		}
	})

	t.Run("audit and release naming different binaries is refused", func(t *testing.T) {
		mismatched := f.issueReleaseBinary(testCandidate, auditDigest, f.priv, otherBinary)
		other := LoadReleaseAuthorization(f.bindingRequest(testCandidate, mismatched))
		if !other.Valid {
			t.Fatalf("fixture invalid: %s", other.Reason)
		}
		if err := ReleaseChain(audit, other, testCandidate, testBinary); err == nil {
			t.Error("a release authorization naming a different binary was accepted")
		}
		// Restore for any later subtest.
		f.issueRelease(testCandidate, auditDigest, f.priv)
	})

	t.Run("a malformed binary digest is refused at load", func(t *testing.T) {
		digest := f.issueAuditBinary(testCandidate, "PASS", f.priv, "", "not-a-digest")
		got := LoadAuditBinding(f.bindingRequest(testCandidate, digest))
		if got.Valid {
			t.Error("an audit binding with a malformed binarySha256 was accepted")
		}
		f.issueAudit(testCandidate, "PASS", f.priv, "")
	})
}

// The core must be able to identify itself, or nothing above can be bound.
func TestSelfBinaryDigest(t *testing.T) {
	digest, err := SelfBinaryDigest()
	if err != nil {
		t.Fatalf("SelfBinaryDigest: %v", err)
	}
	if !sha256Re.MatchString(digest) {
		t.Errorf("SelfBinaryDigest returned %q, want an uppercase SHA-256", digest)
	}
	again, err := SelfBinaryDigest()
	if err != nil || again != digest {
		t.Errorf("SelfBinaryDigest is not stable: %q then %q (%v)", digest, again, err)
	}
}

func TestBindingSchemaContract(t *testing.T) {
	f := newFixture(t)
	// An object with an undeclared property is refused, in both directions.
	value := jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String("AuditBinding")),
		jsonstrict.P("repositoryId", jsonstrict.String(testRepoID)),
		jsonstrict.P("stageSlug", jsonstrict.String(testStage)),
		jsonstrict.P("candidateDigest", jsonstrict.String(testCandidate)),
		jsonstrict.P("binarySha256", jsonstrict.String(testBinary)),
		jsonstrict.P("verdict", jsonstrict.String("PASS")),
		jsonstrict.P("auditorIdentity", jsonstrict.String("Independent Audit")),
		jsonstrict.P("auditedAt", jsonstrict.String("2026-08-12T06:00:00Z")),
		jsonstrict.P("auditReportDigest", jsonstrict.String(strings.Repeat("C", 64))),
		jsonstrict.P("zzzExtra", jsonstrict.String("unexpected")),
	)
	raw, _ := canonical.Marshal(value)
	path := AuditPath(f.store, testStage, testCandidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	os.WriteFile(path+".sig", armorSignature(f.priv, raw, Namespace), 0o600)

	got := LoadAuditBinding(f.bindingRequest(testCandidate, canonical.Digest(raw)))
	if got.Valid {
		t.Fatal("an audit binding with an undeclared property was accepted")
	}
	if !strings.Contains(got.Reason, "unknown properties") {
		t.Errorf("reason = %s", got.Reason)
	}
}

func TestFingerprintFormat(t *testing.T) {
	f := newFixture(t)
	if !fpRe.MatchString(f.fingerprint) {
		t.Errorf("fingerprint %q is not an OpenSSH SHA256 fingerprint", f.fingerprint)
	}
}
