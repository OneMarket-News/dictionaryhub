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
	"reflect"
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
	// The independent auditor. A DIFFERENT principal with a DIFFERENT key: the
	// fixture used to sign audits with the Product Authority key, which is the
	// conflation the separation rule now refuses.
	testAuditor = "test-tier3-auditor"
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
	auditorPriv  ed25519.PrivateKey
	auditorFP    string
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
	_, auditorPriv, _ := ed25519.GenerateKey(rand.Reader)

	storeRoot := t.TempDir()
	store := filepath.Join(storeRoot, testRepoID)
	if err := os.MkdirAll(filepath.Join(store, "authorizations"), 0o700); err != nil {
		t.Fatal(err)
	}

	f := &fixture{
		t: t, storeRoot: storeRoot, store: store, repo: repo, git: git, baseline: head,
		priv: priv, otherPriv: otherPriv, auditorPriv: auditorPriv,
		fingerprint:  Fingerprint(pubBlobOf(priv.Public().(ed25519.PublicKey))),
		auditorFP:    Fingerprint(pubBlobOf(auditorPriv.Public().(ed25519.PublicKey))),
		allowedPaths: []string{"a.txt", "docs/build/note.md", "tools/x.go"},
		protected:    []string{"backend", "secrets/"},
	}
	f.writeSigners(fmt.Sprintf("%s namespaces=%q ssh-ed25519 %s\n%s namespaces=%q ssh-ed25519 %s",
		testPrincipal, Namespace, base64.StdEncoding.EncodeToString(pubBlobOf(priv.Public().(ed25519.PublicKey))),
		testAuditor, Namespace, base64.StdEncoding.EncodeToString(pubBlobOf(auditorPriv.Public().(ed25519.PublicKey)))))
	return f
}

func (f *fixture) writeSigners(line string) {
	f.t.Helper()
	// Option tests replace allowed_signers wholesale to exercise one PA line.
	// The auditor is appended so the role table still resolves; without it every
	// load fails on roles rather than on the option under test.
	if !strings.Contains(line, testAuditor) {
		line = line + "\n" + fmt.Sprintf("%s namespaces=%q ssh-ed25519 %s", testAuditor, Namespace,
			base64.StdEncoding.EncodeToString(pubBlobOf(f.auditorPriv.Public().(ed25519.PublicKey))))
	}
	if err := os.WriteFile(filepath.Join(f.store, "allowed_signers"), []byte(line+"\n"), 0o600); err != nil {
		f.t.Fatal(err)
	}
	// Role occupancy is configured, not caller-supplied, so the fixture must
	// provide a role table alongside allowed_signers or nothing loads at all.
	f.writeRoles(fmt.Sprintf("%s %s\n%s %s\n",
		RoleProductAuthority, testPrincipal, RoleIndependentAuditor, testAuditor))
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

// auditRequest names the AUDITOR, not the Product Authority. Loading an audit
// binding under the Product Authority identity is exactly what the separation
// rule refuses, so the fixture must not do it by default.
func (f *fixture) auditRequest(candidate, expected string) BindingRequest {
	req := f.bindingRequest(candidate, expected)
	req.ExpectedSigner = f.auditorFP
	req.SignerPrincipal = testAuditor
	return req
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
		jsonstrict.P("auditorIdentity", jsonstrict.String(testAuditor)),
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

func (f *fixture) issueReleaseSigner(candidate, auditDigest string, signer ed25519.PrivateKey, declaredFP string) string {
	f.t.Helper()
	value := jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String("ReleaseAuthorization")),
		jsonstrict.P("repositoryId", jsonstrict.String(testRepoID)),
		jsonstrict.P("stageSlug", jsonstrict.String(testStage)),
		jsonstrict.P("candidateDigest", jsonstrict.String(candidate)),
		jsonstrict.P("binarySha256", jsonstrict.String(testBinary)),
		jsonstrict.P("auditBindingDigest", jsonstrict.String(auditDigest)),
		jsonstrict.P("authorizedAt", jsonstrict.String("2026-08-12T07:00:00Z")),
		jsonstrict.P("signerKeyFingerprint", jsonstrict.String(declaredFP)),
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
	auditDigest := f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)

	audit := LoadAuditBinding(f.auditRequest(testCandidate, auditDigest))
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
		failed := f.issueAudit(testCandidate, "FAIL", f.auditorPriv, "")
		bad := LoadAuditBinding(f.auditRequest(testCandidate, failed))
		if !bad.Valid {
			t.Fatalf("a FAIL binding is still a valid object: %s", bad.Reason)
		}
		if err := ReleaseChain(bad, release, testCandidate, testBinary); err == nil {
			t.Error("release was granted over a FAIL audit")
		}
		// Restore the PASS binding for the remaining subtests.
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
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
		mismatched := f.issueAudit(testCandidate, "PASS", f.auditorPriv, strings.Repeat("3", 64))
		got := LoadAuditBinding(f.auditRequest(testCandidate, mismatched))
		if got.Valid {
			t.Error("an audit binding naming another candidate was accepted")
		}
		if !strings.Contains(got.Reason, "is over candidate") {
			t.Errorf("refusal was not about the candidate: %s", got.Reason)
		}
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	})

	t.Run("wrong expected digest is refused", func(t *testing.T) {
		got := LoadAuditBinding(f.auditRequest(testCandidate, strings.Repeat("F", 64)))
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
		if got := LoadAuditBinding(f.auditRequest(testCandidate, digest)); got.Valid {
			t.Error("an audit binding signed by an unlisted key was accepted")
		}
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
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
	auditDigest := f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)
	audit := LoadAuditBinding(f.auditRequest(testCandidate, auditDigest))
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
		digest := f.issueAuditBinary(testCandidate, "PASS", f.auditorPriv, "", "not-a-digest")
		got := LoadAuditBinding(f.auditRequest(testCandidate, digest))
		if got.Valid {
			t.Error("an audit binding with a malformed binarySha256 was accepted")
		}
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
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
		jsonstrict.P("auditorIdentity", jsonstrict.String(testAuditor)),
		jsonstrict.P("auditedAt", jsonstrict.String("2026-08-12T06:00:00Z")),
		jsonstrict.P("auditReportDigest", jsonstrict.String(strings.Repeat("C", 64))),
		jsonstrict.P("zzzExtra", jsonstrict.String("unexpected")),
	)
	raw, _ := canonical.Marshal(value)
	path := AuditPath(f.store, testStage, testCandidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	// Signed by the AUDITOR, so the object reaches the schema check. Signing it
	// with the Product Authority key would now fail on authentication first and
	// this test would pass for the wrong reason.
	os.WriteFile(path+".sig", armorSignature(f.auditorPriv, raw, Namespace), 0o600)

	got := LoadAuditBinding(f.auditRequest(testCandidate, canonical.Digest(raw)))
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

// ===========================================================================
// TERMINAL RELEASE STATE
//
// Five times now the same defect has shipped in a different costume: a fact
// that was true of one commit gets written down as an invariant, and the next
// legitimate commit makes it false. The cure applied here is a SECOND reader
// for the same signed bytes - one that answers "what was released" and is
// structurally incapable of answering "what may change".
//
// These tests exist to keep it that way. The dangerous refactor is not a wrong
// answer; it is someone adding an allowed-paths field, or a descendant
// allowance, to the historical reader because it would be convenient. Each
// test below fails loudly when that happens.
// ===========================================================================

// advance creates a real descendant commit so HEAD is genuinely past the
// signed baseline. Nothing about terminal state may be provable by asserting
// facts against a repository that never moved.
func (f *fixture) advance(message string) string {
	f.t.Helper()
	run := func(args ...string) {
		f.t.Helper()
		cmd := exec.Command("git", append([]string{"-C", f.repo}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			f.t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	os.WriteFile(filepath.Join(f.repo, "a.txt"), []byte(message), 0o644)
	run("add", "-A")
	run("commit", "-q", "-m", message)
	head, err := f.git.HeadCommit()
	if err != nil {
		f.t.Fatal(err)
	}
	return head
}

func (f *fixture) loadHistorical(id, digest string) HistoricalAuthorization {
	return LoadHistoricalAuthorization(Request{
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

// THE CENTRAL INVARIANT. A historical authorization stays readable forever and
// grants nothing, ever, at any distance from its baseline.
func TestHistoricalAuthorizationNeverBecomesCurrentAuthority(t *testing.T) {
	f := newFixture(t)
	digest := f.issue(f.versionedName(newID), f.payload(overrides{}), f.priv, Namespace)

	// At the baseline itself, current authority is available. This is the
	// positive control: without it every assertion below would hold vacuously.
	if auth := f.load(newID, digest); !auth.Valid {
		t.Fatalf("authorization was not valid at its own baseline: %s", auth.Reason)
	}

	// Walk several commits past the baseline. A descendant allowance would show
	// up here as authority quietly coming back.
	for i := 1; i <= 3; i++ {
		head := f.advance(fmt.Sprintf("descendant %d", i))

		auth := f.load(newID, digest)
		if auth.Valid {
			t.Fatalf("descendant %d (%s) regained current authority", i, head)
		}
		if !strings.Contains(auth.Reason, "not the authorized baseline") {
			t.Errorf("descendant %d was refused for the wrong reason: %s", i, auth.Reason)
		}

		historical := f.loadHistorical(newID, digest)
		if !historical.Valid {
			t.Fatalf("descendant %d could not read the historical authorization: %s", i, historical.Reason)
		}
		if historical.BaselineCommit == head {
			t.Fatal("the fixture did not actually move HEAD")
		}

		// Reading history must not be a side channel into authority.
		if after := f.load(newID, digest); after.Valid {
			t.Fatalf("descendant %d gained authority AFTER a historical read", i)
		}
	}
}

// STRUCTURAL. The historical reader cannot answer a path question, because it
// carries no path data and exposes no method to ask. Adding either would
// re-create the mutation authority this stage removed, and this test is what
// tells the person doing it.
func TestHistoricalAuthorizationCarriesNoMutationAuthority(t *testing.T) {
	typ := reflect.TypeOf(HistoricalAuthorization{})

	if n := reflect.PointerTo(typ).NumMethod(); n != 0 {
		for i := 0; i < n; i++ {
			t.Errorf("historical authorization exposes a method: %s", reflect.PointerTo(typ).Method(i).Name)
		}
	}

	// Every field must be a SCALAR fact about the release. This is the load-
	// bearing rule: a permission set has to arrive as a collection, so banning
	// collections outright bans the shape rather than chasing field names.
	//
	// Names are checked too, but only for words that have no innocent reading
	// here. Path and AuthorizationID are deliberately NOT among them - the
	// first is where the object was read from and the second is which object
	// it was, and both are identity rather than permission.
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		switch field.Type.Kind() {
		case reflect.String, reflect.Bool:
		default:
			t.Errorf("field %s is %s; historical state carries scalar facts, never collections", field.Name, field.Type)
		}
		lower := strings.ToLower(field.Name)
		for _, banned := range []string{"allow", "protect", "grant", "permit"} {
			if strings.Contains(lower, banned) {
				t.Errorf("field %s reads as mutation authority (%q)", field.Name, banned)
			}
		}
	}

	// The granting reader still has what it needs, so this is a real separation
	// rather than a general removal.
	current := reflect.TypeOf(Authorization{})
	_, value := current.MethodByName("PathAuthorized")
	_, pointer := reflect.PointerTo(current).MethodByName("PathAuthorized")
	if !value && !pointer {
		t.Error("current authority lost PathAuthorized; the separation removed the wrong side")
	}
}

// The historical reader skips the baseline check and NOTHING ELSE. Every other
// gate protecting the signed bytes must still refuse.
func TestHistoricalAuthorizationEnforcesEveryOtherGate(t *testing.T) {
	f := newFixture(t)
	digest := f.issue(f.versionedName(newID), f.payload(overrides{}), f.priv, Namespace)
	f.advance("past the baseline")

	if got := f.loadHistorical(newID, digest); !got.Valid {
		t.Fatalf("positive control failed: %s", got.Reason)
	}

	for _, tc := range []struct{ label, id, digest string }{
		{"an id that was never issued", "00000000-0000-4000-8000-000000000000", digest},
		{"an id in the wrong case", strings.ToUpper(newID), digest},
		{"a traversal id", "../../../etc/passwd", digest},
		{"an empty id", "", digest},
		{"a digest that is one byte wrong", newID, strings.Repeat("0", 64)},
		{"a digest that is not hex", newID, strings.Repeat("Z", 64)},
		{"an empty digest", newID, ""},
	} {
		if got := f.loadHistorical(tc.id, tc.digest); got.Valid {
			t.Errorf("historical read accepted %s", tc.label)
		}
	}

	t.Run("a foreign signer is refused", func(t *testing.T) {
		other := f.issue(f.versionedName(oldID), f.payload(overrides{authorizationID: oldID}), f.otherPriv, Namespace)
		if got := f.loadHistorical(oldID, other); got.Valid {
			t.Error("historical read accepted an unlisted signer")
		}
	})

	t.Run("a foreign namespace is refused", func(t *testing.T) {
		other := f.issue(f.versionedName(oldID), f.payload(overrides{authorizationID: oldID}), f.priv, "some-other-namespace")
		if got := f.loadHistorical(oldID, other); got.Valid {
			t.Error("historical read accepted a signature from another namespace")
		}
	})

	t.Run("tampered bytes are refused", func(t *testing.T) {
		raw := f.payload(overrides{})
		good := f.issue(f.versionedName(newID), raw, f.priv, Namespace)
		tampered := bytes.Replace(raw, []byte(`"riskTier":3`), []byte(`"riskTier":4`), 1)
		if bytes.Equal(tampered, raw) {
			t.Fatal("tamper did not change the bytes")
		}
		os.WriteFile(filepath.Join(f.store, "authorizations", f.versionedName(newID)), tampered, 0o600)
		if got := f.loadHistorical(newID, good); got.Valid {
			t.Error("historical read accepted bytes that no longer digest to what was asked for")
		}
		// The signature covers the original bytes, so asking for the tampered
		// digest must fail on the signature rather than succeed.
		if got := f.loadHistorical(newID, canonical.Digest(tampered)); got.Valid {
			t.Error("historical read accepted tampered bytes under their own digest")
		}
	})
}

// The two chain forms differ in exactly one way, and it is the load-bearing
// way: only the GRANTING form binds the binary that is running right now.
// Collapsing them back into one function would either let an unaudited binary
// act, or make released history unreadable by any later build.
func TestReleaseChainHistoricalReadsWithoutGranting(t *testing.T) {
	f := newFixture(t)
	auditDigest := f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)
	audit := LoadAuditBinding(f.auditRequest(testCandidate, auditDigest))
	release := LoadReleaseAuthorization(f.bindingRequest(testCandidate, releaseDigest))
	if !audit.Valid || !release.Valid {
		t.Fatalf("fixture invalid: %s / %s", audit.Reason, release.Reason)
	}

	// A later build reading its own history: permitted.
	if err := ReleaseChainHistorical(audit, release, testCandidate); err != nil {
		t.Fatalf("a later binary could not read released history: %v", err)
	}
	// The same later build trying to ACT: refused.
	laterBinary := strings.Repeat("9", 64)
	if err := ReleaseChain(audit, release, testCandidate, laterBinary); err == nil {
		t.Fatal("a binary that was never audited was granted a release")
	}

	// The historical form is not a weaker chain; it is the same chain minus the
	// running-binary question. Every other link must still hold.
	t.Run("a FAIL audit is still not a release", func(t *testing.T) {
		failed := f.issueAudit(testCandidate, "FAIL", f.auditorPriv, "")
		bad := LoadAuditBinding(f.auditRequest(testCandidate, failed))
		if !bad.Valid {
			t.Fatalf("a FAIL binding is still a valid object: %s", bad.Reason)
		}
		if err := ReleaseChainHistorical(bad, release, testCandidate); err == nil {
			t.Error("history was reconstructed over a FAIL audit")
		}
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	})

	t.Run("another candidate is refused", func(t *testing.T) {
		if err := ReleaseChainHistorical(audit, release, strings.Repeat("2", 64)); err == nil {
			t.Error("a chain for one candidate described another")
		}
	})

	t.Run("a release naming another audit is refused", func(t *testing.T) {
		other := audit
		other.Digest = strings.Repeat("D", 64)
		if err := ReleaseChainHistorical(other, release, testCandidate); err == nil {
			t.Error("history accepted a release naming a different audit binding")
		}
	})

	t.Run("an audit and release recording different binaries are refused", func(t *testing.T) {
		other := release
		other.BinarySha256 = strings.Repeat("7", 64)
		if err := ReleaseChainHistorical(audit, other, testCandidate); err == nil {
			t.Error("history accepted a release bound to a binary the audit never saw")
		}
	})

	t.Run("an invalid link never yields history", func(t *testing.T) {
		if err := ReleaseChainHistorical(AuditBinding{Valid: false, Reason: "x"}, release, testCandidate); err == nil {
			t.Error("an invalid audit binding produced a historical chain")
		}
		if err := ReleaseChainHistorical(audit, ReleaseAuthorization{Valid: false, Reason: "x"}, testCandidate); err == nil {
			t.Error("an invalid release authorization produced a historical chain")
		}
	})
}

// ===========================================================================
// RELEASE COMMIT BINDING
//
// An audit constructed two commits over one parent and one tree and showed that
// terminal release state accepted BOTH. Parent and tree do not identify a
// commit: author, committer, message and timestamps are free, and none of them
// was signed anywhere in the chain.
//
// TestImpostorCommitOverSameParentAndTree is that finding, frozen. It builds
// the two commits for real, in a real repository, and requires ACCEPT at the
// bound one and REJECT at the other. If it ever passes vacuously - if the two
// commits come out with the same SHA, or the fixture fails to move HEAD - it
// fails loudly instead of reporting success.
// ===========================================================================

type commitOverrides struct {
	repositoryID      string
	stageSlug         string
	authorizationID   string
	authorizationDgst string
	candidateDigest   string
	candidateTree     string
	auditDigest       string
	releaseDigest     string
	binary            string
	releaseCommit     string
	releaseParent     string
	releaseTree       string
	fingerprint       string
	namespace         string
	boundAt           string
	extraField        bool
	dropReleaseCommit bool
}

func pickOr(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

// issueCommitBinding writes a signed ReleaseCommitBinding into the control
// store and returns its digest.
func (f *fixture) issueCommitBinding(candidate string, o commitOverrides, signer ed25519.PrivateKey) string {
	f.t.Helper()
	members := []jsonstrict.Member{
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String(CommitBindingObjectType)),
		jsonstrict.P("repositoryId", jsonstrict.String(pickOr(o.repositoryID, testRepoID))),
		jsonstrict.P("stageSlug", jsonstrict.String(pickOr(o.stageSlug, testStage))),
		jsonstrict.P("authorizationId", jsonstrict.String(pickOr(o.authorizationID, newID))),
		jsonstrict.P("authorizationDigest", jsonstrict.String(pickOr(o.authorizationDgst, strings.Repeat("A", 64)))),
		jsonstrict.P("candidateDigest", jsonstrict.String(pickOr(o.candidateDigest, candidate))),
		jsonstrict.P("candidateTree", jsonstrict.String(pickOr(o.candidateTree, strings.Repeat("a", 40)))),
		jsonstrict.P("auditBindingDigest", jsonstrict.String(pickOr(o.auditDigest, strings.Repeat("B", 64)))),
		jsonstrict.P("releaseAuthorizationDigest", jsonstrict.String(pickOr(o.releaseDigest, strings.Repeat("C", 64)))),
		jsonstrict.P("binarySha256", jsonstrict.String(pickOr(o.binary, testBinary))),
	}
	if !o.dropReleaseCommit {
		members = append(members, jsonstrict.P("releaseCommit", jsonstrict.String(pickOr(o.releaseCommit, strings.Repeat("b", 40)))))
	}
	members = append(members,
		jsonstrict.P("releaseParent", jsonstrict.String(pickOr(o.releaseParent, strings.Repeat("c", 40)))),
		jsonstrict.P("releaseTree", jsonstrict.String(pickOr(o.releaseTree, strings.Repeat("a", 40)))),
		jsonstrict.P("boundAt", jsonstrict.String(pickOr(o.boundAt, "2026-08-13T08:00:00Z"))),
		jsonstrict.P("signerKeyFingerprint", jsonstrict.String(pickOr(o.fingerprint, f.fingerprint))),
		jsonstrict.P("signatureNamespace", jsonstrict.String(pickOr(o.namespace, Namespace))))
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
	path := CommitBindingPath(f.store, pickOr(o.stageSlug, testStage), candidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	os.WriteFile(path+".sig", armorSignature(signer, raw, Namespace), 0o600)
	return canonical.Digest(raw)
}

// commitAs creates a commit object over an explicit tree and parent, with an
// explicit identity, without touching HEAD or the worktree.
func (f *fixture) commitAs(tree, parent, message, who, when string) string {
	f.t.Helper()
	cmd := exec.Command("git", "-C", f.repo, "commit-tree", tree, "-p", parent, "-m", message)
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME="+who, "GIT_AUTHOR_EMAIL="+who+"@test",
		"GIT_COMMITTER_NAME="+who, "GIT_COMMITTER_EMAIL="+who+"@test",
		"GIT_AUTHOR_DATE="+when, "GIT_COMMITTER_DATE="+when)
	out, err := cmd.CombinedOutput()
	if err != nil {
		f.t.Fatalf("commit-tree: %v\n%s", err, out)
	}
	return strings.TrimSpace(string(out))
}

func (f *fixture) revParse(rev string) string {
	f.t.Helper()
	out, err := exec.Command("git", "-C", f.repo, "rev-parse", rev).CombinedOutput()
	if err != nil {
		f.t.Fatalf("rev-parse %s: %v\n%s", rev, err, out)
	}
	return strings.TrimSpace(string(out))
}

// releaseWorld is a complete, valid, signed historical release chain plus the
// two commits from the audit finding.
type releaseWorld struct {
	f             *fixture
	authDigest    string
	auditDigest   string
	releaseDigest string
	candidate     string
	tree          string
	parent        string
	commitA       string // the real release commit, named by the binding
	commitB       string // the impostor: same parent, same tree, different SHA
	bindingDigest string
	audit         AuditBinding
	release       ReleaseAuthorization
	historical    HistoricalAuthorization
}

func newReleaseWorld(t *testing.T) *releaseWorld {
	t.Helper()
	f := newFixture(t)

	authDigest := f.issue(f.versionedName(newID), f.payload(overrides{}), f.priv, Namespace)
	candidate := testCandidate
	auditDigest := f.issueAudit(candidate, "PASS", f.auditorPriv, "")
	releaseDigest := f.issueRelease(candidate, auditDigest, f.priv)

	// The baseline is the fixture's initial commit. Two DIFFERENT release
	// commits are then built over it, sharing its tree.
	parent := f.baseline
	tree := f.revParse(parent + "^{tree}")

	commitA := f.commitAs(tree, parent, "the governed release", "release-engineer", "2026-08-13T09:00:00 +0000")
	commitB := f.commitAs(tree, parent, "not the governed release", "someone-else", "2026-08-13T10:00:00 +0000")
	if commitA == commitB {
		t.Fatal("the fixture produced one commit twice; the impostor test would be vacuous")
	}

	w := &releaseWorld{
		f: f, authDigest: authDigest, auditDigest: auditDigest, releaseDigest: releaseDigest,
		candidate: candidate, tree: tree, parent: parent, commitA: commitA, commitB: commitB,
	}
	w.bindingDigest = f.issueCommitBinding(candidate, commitOverrides{
		authorizationDgst: authDigest,
		candidateTree:     tree,
		auditDigest:       auditDigest,
		releaseDigest:     releaseDigest,
		releaseCommit:     commitA,
		releaseParent:     parent,
		releaseTree:       tree,
	}, f.priv)

	w.audit = LoadAuditBinding(f.auditRequest(candidate, auditDigest))
	w.release = LoadReleaseAuthorization(f.bindingRequest(candidate, releaseDigest))
	w.historical = f.loadHistorical(newID, authDigest)
	if !w.audit.Valid || !w.release.Valid || !w.historical.Valid {
		t.Fatalf("fixture chain invalid: %s / %s / %s", w.audit.Reason, w.release.Reason, w.historical.Reason)
	}
	return w
}

// observedAt reports what Git says about a commit, the way release-state reads
// it from a checked-out repository.
func (w *releaseWorld) observedAt(commit string) ObservedRelease {
	return ObservedRelease{
		Head:   commit,
		Parent: w.f.revParse(commit + "^"),
		Tree:   w.f.revParse(commit + "^{tree}"),
	}
}

func (w *releaseWorld) binding() ReleaseCommitBinding {
	return LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, w.bindingDigest))
}

func (w *releaseWorld) chainAt(commit string) error {
	return ReleaseCommitChain(w.binding(), w.audit, w.release, w.historical, w.observedAt(commit))
}

// THE AUDIT FINDING, FROZEN AS A REGRESSION.
func TestImpostorCommitOverSameParentAndTree(t *testing.T) {
	w := newReleaseWorld(t)

	// The fixture must genuinely reproduce the reported situation, or the
	// REJECT below would prove nothing.
	a, b := w.observedAt(w.commitA), w.observedAt(w.commitB)
	if a.Parent != b.Parent {
		t.Fatalf("the two commits do not share a parent: %s vs %s", a.Parent, b.Parent)
	}
	if a.Tree != b.Tree {
		t.Fatalf("the two commits do not share a tree: %s vs %s", a.Tree, b.Tree)
	}
	if a.Head == b.Head {
		t.Fatal("the two commits are the same commit")
	}
	t.Logf("same parent %s, same tree %s, different commits %s / %s", a.Parent, a.Tree, a.Head, b.Head)

	if err := w.chainAt(w.commitA); err != nil {
		t.Fatalf("the bound release commit was refused: %v", err)
	}
	err := w.chainAt(w.commitB)
	if err == nil {
		t.Fatal("an impostor commit over the same parent and tree was ACCEPTED as the release")
	}
	if !strings.Contains(err.Error(), "still a different commit") {
		t.Errorf("the impostor was refused for the wrong reason: %v", err)
	}
}

// Every link the binding adds must be load-bearing on its own.
func TestReleaseCommitChainRequiresEveryLink(t *testing.T) {
	w := newReleaseWorld(t)
	if err := w.chainAt(w.commitA); err != nil {
		t.Fatalf("positive control failed: %v", err)
	}

	t.Run("a wrong observed commit is refused", func(t *testing.T) {
		observed := w.observedAt(w.commitA)
		observed.Head = strings.Repeat("d", 40)
		if err := ReleaseCommitChain(w.binding(), w.audit, w.release, w.historical, observed); err == nil {
			t.Error("a commit the binding does not name was accepted")
		}
	})

	t.Run("a wrong observed parent is refused", func(t *testing.T) {
		observed := w.observedAt(w.commitA)
		observed.Parent = strings.Repeat("e", 40)
		if err := ReleaseCommitChain(w.binding(), w.audit, w.release, w.historical, observed); err == nil {
			t.Error("a mismatched parent was accepted")
		}
	})

	t.Run("a wrong observed tree is refused", func(t *testing.T) {
		observed := w.observedAt(w.commitA)
		observed.Tree = strings.Repeat("f", 40)
		if err := ReleaseCommitChain(w.binding(), w.audit, w.release, w.historical, observed); err == nil {
			t.Error("a mismatched tree was accepted")
		}
	})

	t.Run("a binding whose parent is not the signed baseline is refused", func(t *testing.T) {
		other := w.f.commitAs(w.tree, w.commitA, "a grandchild", "release-engineer", "2026-08-13T11:00:00 +0000")
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: other, releaseParent: w.commitA, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if !binding.Valid {
			t.Fatalf("the fixture binding is invalid: %s", binding.Reason)
		}
		err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(other))
		if err == nil {
			t.Error("a descendant that is not the child of the signed baseline was accepted")
		}
		// Restore.
		w.bindingDigest = w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
	})

	t.Run("a binding naming another audit is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: strings.Repeat("9", 64), releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a binding naming a different audit binding was accepted")
		}
	})

	t.Run("a binding naming another release authorization is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: strings.Repeat("8", 64),
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a binding naming a different release authorization was accepted")
		}
	})

	t.Run("a binding naming another authorization is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationID: oldID, authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a binding naming a different authorization id was accepted")
		}
	})

	t.Run("a binding naming other authorization bytes is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: strings.Repeat("7", 64), candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a binding naming a different authorization digest was accepted")
		}
	})

	t.Run("a binding naming another binary is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest, binary: strings.Repeat("6", 64),
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		binding := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if err := ReleaseCommitChain(binding, w.audit, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a binding naming a binary the audit never saw was accepted")
		}
	})

	t.Run("an invalid link never yields a chain", func(t *testing.T) {
		observed := w.observedAt(w.commitA)
		if err := ReleaseCommitChain(ReleaseCommitBinding{Valid: false, Reason: "x"}, w.audit, w.release, w.historical, observed); err == nil {
			t.Error("an invalid commit binding produced a chain")
		}
		if err := ReleaseCommitChain(w.binding(), w.audit, w.release, HistoricalAuthorization{Valid: false, Reason: "x"}, observed); err == nil {
			t.Error("an invalid historical authorization produced a chain")
		}
		if err := ReleaseCommitChain(w.binding(), AuditBinding{Valid: false, Reason: "x"}, w.release, w.historical, observed); err == nil {
			t.Error("an invalid audit binding produced a chain")
		}
		if err := ReleaseCommitChain(w.binding(), w.audit, ReleaseAuthorization{Valid: false, Reason: "x"}, w.historical, observed); err == nil {
			t.Error("an invalid release authorization produced a chain")
		}
	})

	t.Run("a FAIL audit is still not a release", func(t *testing.T) {
		failed := w.f.issueAudit(w.candidate, "FAIL", w.f.auditorPriv, "")
		bad := LoadAuditBinding(w.f.auditRequest(w.candidate, failed))
		if !bad.Valid {
			t.Fatalf("a FAIL binding is still a valid object: %s", bad.Reason)
		}
		if err := ReleaseCommitChain(w.binding(), bad, w.release, w.historical, w.observedAt(w.commitA)); err == nil {
			t.Error("a commit binding was accepted over a FAIL audit")
		}
		w.f.issueAudit(w.candidate, "PASS", w.f.auditorPriv, "")
	})
}

// The loader must refuse a malformed, unsigned, mis-signed or foreign binding
// before any chain reasoning happens.
func TestLoadReleaseCommitBindingRefusals(t *testing.T) {
	w := newReleaseWorld(t)
	if got := w.binding(); !got.Valid {
		t.Fatalf("positive control failed: %s", got.Reason)
	}

	t.Run("a missing binding is refused", func(t *testing.T) {
		other := strings.Repeat("5", 64)
		got := LoadReleaseCommitBinding(w.f.bindingRequest(other, w.bindingDigest))
		if got.Valid {
			t.Error("a binding that does not exist was accepted")
		}
	})

	t.Run("an unsigned binding is refused", func(t *testing.T) {
		path := CommitBindingPath(w.f.store, testStage, w.candidate)
		os.Remove(path + ".sig")
		if got := w.binding(); got.Valid {
			t.Error("a binding with no signature was accepted")
		}
		// Restore for the remaining subtests.
		w.bindingDigest = w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
	})

	t.Run("a binding signed by an unlisted key is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.otherPriv)
		if got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest)); got.Valid {
			t.Error("a binding signed by an unlisted key was accepted")
		}
	})

	t.Run("tampered bytes are refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		path := CommitBindingPath(w.f.store, testStage, w.candidate)
		raw, _ := os.ReadFile(path)
		tampered := bytes.Replace(raw, []byte(w.commitA), []byte(w.commitB), 1)
		if bytes.Equal(tampered, raw) {
			t.Fatal("tamper did not change the bytes")
		}
		os.WriteFile(path, tampered, 0o600)

		if got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest)); got.Valid {
			t.Error("bytes that no longer digest to what was asked for were accepted")
		}
		// Swapping the commit and re-asking under the TAMPERED digest must fail
		// on the signature: this is the whole attack, and it must not work.
		if got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, canonical.Digest(tampered))); got.Valid {
			t.Error("a commit swap re-digested under its own hash was accepted")
		}
	})

	t.Run("a binding for another repository is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			repositoryID:      "github.com-someone-else-otherrepo",
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if got.Valid {
			t.Error("a binding naming another repository was accepted")
		}
		if !strings.Contains(got.Reason, "repository") {
			t.Errorf("refusal was not about the repository: %s", got.Reason)
		}
	})

	t.Run("a binding for another stage is refused", func(t *testing.T) {
		// Written under the other stage's own filename, so this is a real
		// foreign object rather than a mislabelled one.
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			stageSlug:         "SOURCEROOT-SOME-OTHER-STAGE-V1",
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		if got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest)); got.Valid {
			t.Error("a binding issued for another stage was accepted for this one")
		}
	})

	t.Run("a binding over another candidate is refused", func(t *testing.T) {
		digest := w.f.issueCommitBinding(w.candidate, commitOverrides{
			candidateDigest:   strings.Repeat("4", 64),
			authorizationDgst: w.authDigest, candidateTree: w.tree,
			auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest))
		if got.Valid {
			t.Error("a binding over another candidate was accepted")
		}
		if !strings.Contains(got.Reason, "candidate") {
			t.Errorf("refusal was not about the candidate: %s", got.Reason)
		}
	})

	// Digest spelling is part of identity in this system: the canonical form is
	// uppercase, and two spellings of one value must never both be accepted or
	// the same object could be filed under two identities. testCandidate is all
	// digits, so a case test over IT would pass no matter what the loader did -
	// this uses a candidate with letters in it, where the two spellings differ.
	t.Run("a lowercase candidateDigest spelling is refused", func(t *testing.T) {
		upper := "ABCDEF0123456789" + strings.Repeat("0", 48)
		lower := strings.ToLower(upper)
		if upper == lower {
			t.Fatal("the fixture digest has no letters; the case test would be vacuous")
		}
		digest := w.f.issueCommitBinding(upper, commitOverrides{
			candidateDigest: lower, candidateTree: w.tree,
			authorizationDgst: w.authDigest, auditDigest: w.auditDigest, releaseDigest: w.releaseDigest,
			releaseCommit: w.commitA, releaseParent: w.parent, releaseTree: w.tree,
		}, w.f.priv)
		got := LoadReleaseCommitBinding(w.f.bindingRequest(upper, digest))
		if got.Valid {
			t.Error("a binding declaring the lowercase spelling of its candidate was accepted")
		}
		if !strings.Contains(got.Reason, "candidate") {
			t.Errorf("refusal was not about the candidate: %s", got.Reason)
		}
	})

	t.Run("a malformed binding is refused", func(t *testing.T) {
		for _, tc := range []struct {
			label string
			over  commitOverrides
		}{
			{"an undeclared property", commitOverrides{extraField: true}},
			{"a missing releaseCommit", commitOverrides{dropReleaseCommit: true}},
			{"a non-hex releaseCommit", commitOverrides{releaseCommit: strings.Repeat("z", 40)}},
			{"an uppercase releaseCommit", commitOverrides{releaseCommit: strings.Repeat("A", 40)}},
			{"a truncated releaseCommit", commitOverrides{releaseCommit: "abc"}},
			{"a non-UUID authorizationId", commitOverrides{authorizationID: "not-a-uuid"}},
			{"a malformed boundAt", commitOverrides{boundAt: "2026-08-13 08:00:00"}},
			{"a foreign signatureNamespace", commitOverrides{namespace: "some-other-namespace"}},
			{"a declared key that did not sign", commitOverrides{fingerprint: "SHA256:" + strings.Repeat("A", 43)}},
			{"a releaseTree that is not the candidateTree", commitOverrides{releaseTree: strings.Repeat("9", 40)}},
			{"a commit that is its own parent", commitOverrides{releaseCommit: strings.Repeat("b", 40), releaseParent: strings.Repeat("b", 40)}},
		} {
			over := tc.over
			if over.candidateDigest == "" {
				over.candidateDigest = w.candidate
			}
			if over.candidateTree == "" {
				over.candidateTree = w.tree
			}
			if over.releaseTree == "" {
				over.releaseTree = w.tree
			}
			if over.releaseCommit == "" && !over.dropReleaseCommit {
				over.releaseCommit = w.commitA
			}
			if over.releaseParent == "" {
				over.releaseParent = w.parent
			}
			over.authorizationDgst = pickOr(over.authorizationDgst, w.authDigest)
			over.auditDigest = pickOr(over.auditDigest, w.auditDigest)
			over.releaseDigest = pickOr(over.releaseDigest, w.releaseDigest)

			digest := w.f.issueCommitBinding(w.candidate, over, w.f.priv)
			if got := LoadReleaseCommitBinding(w.f.bindingRequest(w.candidate, digest)); got.Valid {
				t.Errorf("a binding with %s was accepted", tc.label)
			}
		}
	})
}

// The binding must not become a way to obtain authority, and establishing it
// must leave the consumed authorization exactly as consumed as it was.
func TestReleaseCommitBindingGrantsNothing(t *testing.T) {
	typ := reflect.TypeOf(ReleaseCommitBinding{})

	if n := reflect.PointerTo(typ).NumMethod(); n != 0 {
		for i := 0; i < n; i++ {
			t.Errorf("release commit binding exposes a method: %s", reflect.PointerTo(typ).Method(i).Name)
		}
	}
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		switch field.Type.Kind() {
		case reflect.String, reflect.Bool:
		default:
			t.Errorf("field %s is %s; a release commit binding carries scalar facts, never collections", field.Name, field.Type)
		}
		lower := strings.ToLower(field.Name)
		for _, banned := range []string{"allow", "protect", "grant", "permit"} {
			if strings.Contains(lower, banned) {
				t.Errorf("field %s reads as mutation authority (%q)", field.Name, banned)
			}
		}
	}

	w := newReleaseWorld(t)
	if err := w.chainAt(w.commitA); err != nil {
		t.Fatalf("positive control failed: %v", err)
	}
	// HEAD is still the baseline in this fixture, so current authority would be
	// VALID here for the wrong reason. Move HEAD onto the release commit first,
	// which is where a released repository actually stands.
	if out, err := exec.Command("git", "-C", w.f.repo, "checkout", "--quiet", w.commitA).CombinedOutput(); err != nil {
		t.Fatalf("checkout: %v\n%s", err, out)
	}
	if current := w.f.load(newID, w.authDigest); current.Valid {
		t.Error("the consumed authorization became current authority at the released commit")
	}
	// And the binding is still readable there: history does not depend on
	// authority being available.
	if err := w.chainAt(w.commitA); err != nil {
		t.Errorf("the release could not be verified at the released commit: %v", err)
	}
}

// The committed schema must declare this object type exactly as the producer
// emits it. Two descriptions of one object eventually disagree, and the more
// permissive one is the one that matters.
func TestCommittedSchemaDeclaresReleaseCommitBinding(t *testing.T) {
	path := filepath.Join("..", "..", "..", "..", "governance", "schemas", "gds-authority-lifecycle-v1.schema.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("committed schema is not readable from here: %v", err)
	}
	schema, err := jsonstrict.Parse(raw)
	if err != nil {
		t.Fatalf("the committed schema is not strict JSON: %v", err)
	}

	root, ok := schema.Get("properties")
	if !ok {
		t.Fatal("the schema declares no properties")
	}
	objectType, ok := root.Get("objectType")
	if !ok {
		t.Fatal("the schema declares no objectType")
	}
	enum, ok := objectType.Get("enum")
	if !ok || enum.Kind != jsonstrict.KindArray {
		t.Fatal("objectType declares no enum")
	}
	found := false
	for _, item := range enum.Array {
		if s, _ := item.StringValue(); s == CommitBindingObjectType {
			found = true
		}
	}
	if !found {
		t.Errorf("the objectType enum does not admit %q", CommitBindingObjectType)
	}

	oneOf, ok := schema.Get("oneOf")
	if !ok || oneOf.Kind != jsonstrict.KindArray {
		t.Fatal("the schema declares no oneOf")
	}
	referenced := false
	for _, item := range oneOf.Array {
		ref, _ := item.Get("$ref")
		if s, _ := ref.StringValue(); s == "#/$defs/releaseCommitBinding" {
			referenced = true
		}
	}
	if !referenced {
		t.Error("oneOf does not reference #/$defs/releaseCommitBinding")
	}

	defs, ok := schema.Get("$defs")
	if !ok {
		t.Fatal("the schema declares no $defs")
	}
	def, ok := defs.Get("releaseCommitBinding")
	if !ok {
		t.Fatal("the schema declares no releaseCommitBinding definition")
	}
	if additional, ok := def.Get("additionalProperties"); !ok || additional.Kind != jsonstrict.KindBool || additional.Bool {
		t.Error("releaseCommitBinding does not set additionalProperties:false")
	}

	props, ok := def.Get("properties")
	if !ok {
		t.Fatal("releaseCommitBinding declares no properties")
	}
	assertSameSet(t, "releaseCommitBinding.properties", props.Names(), commitBindingFields)

	required, ok := def.Get("required")
	if !ok || required.Kind != jsonstrict.KindArray {
		t.Fatal("releaseCommitBinding declares no required array")
	}
	names := make([]string, 0, len(required.Array))
	for _, item := range required.Array {
		s, _ := item.StringValue()
		names = append(names, s)
	}
	assertSameSet(t, "releaseCommitBinding.required", names, commitBindingFields)
}

func assertSameSet(t *testing.T, what string, got, want []string) {
	t.Helper()
	index := map[string]bool{}
	for _, g := range got {
		index[g] = true
	}
	for _, w := range want {
		if !index[w] {
			t.Errorf("%s does not declare %q, which the producer emits", what, w)
		}
		delete(index, w)
	}
	for extra := range index {
		t.Errorf("%s declares %q, which the producer does not emit", what, extra)
	}
}

// ===========================================================================
// INDEPENDENT AUDITOR AUTHENTICATION
//
// Contract section 2 requires that "the proposing, approving, and reviewing
// functions must be held by distinct actors." The code did not enforce it: an
// AuditBinding could declare any auditorIdentity while verifying under the
// Product Authority key, and every binding issued before this rule did exactly
// that. The audit was authenticated by the party it was supposed to constrain.
//
// The eight properties below are the required model. They are tested against
// two genuinely distinct keys, because a test that used one key for both roles
// would be re-creating the defect inside its own fixture.
// ===========================================================================

func auditorWorld(t *testing.T) (*fixture, string, string) {
	t.Helper()
	f := newFixture(t)
	auditDigest := f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	releaseDigest := f.issueRelease(testCandidate, auditDigest, f.priv)
	return f, auditDigest, releaseDigest
}

// 1. An AuditBinding signed by the independent auditor is ACCEPTED.
// 5. An unknown auditor is REJECTED.
func TestAuditBindingAcceptsOnlyRegisteredAuditor(t *testing.T) {
	f, auditDigest, _ := auditorWorld(t)

	audit := LoadAuditBinding(f.auditRequest(testCandidate, auditDigest))
	if !audit.Valid {
		t.Fatalf("an audit signed by the registered auditor was refused: %s", audit.Reason)
	}
	if audit.SignerPrincipal != testAuditor {
		t.Errorf("audit authenticated as %q, expected %q", audit.SignerPrincipal, testAuditor)
	}
	if audit.SignerFingerprint != f.auditorFP {
		t.Errorf("audit signed by %s, expected %s", audit.SignerFingerprint, f.auditorFP)
	}
	if audit.SignerFingerprint == f.fingerprint {
		t.Fatal("the fixture's auditor and Product Authority share a key; the suite would prove nothing")
	}

	t.Run("an unknown auditor principal is refused", func(t *testing.T) {
		req := f.auditRequest(testCandidate, auditDigest)
		req.SignerPrincipal = "nobody-in-allowed-signers"
		if got := LoadAuditBinding(req); got.Valid {
			t.Error("an unregistered auditor principal was accepted")
		}
	})

	t.Run("an unlisted key is refused", func(t *testing.T) {
		digest := f.issueAudit(testCandidate, "PASS", f.otherPriv, "")
		if got := LoadAuditBinding(f.auditRequest(testCandidate, digest)); got.Valid {
			t.Error("an audit signed by an unlisted key was accepted")
		}
		f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
	})
}

// 2. The same AuditBinding signed by the Product Authority key is REJECTED.
// 8. The Product Authority cannot impersonate the auditor.
func TestProductAuthorityCannotAuthenticateAnAudit(t *testing.T) {
	f, _, _ := auditorWorld(t)

	// Signed by the Product Authority while still naming the auditor: the
	// signature does not verify under the auditor's registered key.
	paSigned := f.issueAudit(testCandidate, "PASS", f.priv, "")
	if got := LoadAuditBinding(f.auditRequest(testCandidate, paSigned)); got.Valid {
		t.Error("an audit signed by the Product Authority key was accepted as the auditor's")
	}

	// And naming the Product Authority as the auditor does not rescue it: the
	// object declares testAuditor, so identity and principal disagree.
	req := f.auditRequest(testCandidate, paSigned)
	req.ExpectedSigner = f.fingerprint
	req.SignerPrincipal = testPrincipal
	got := LoadAuditBinding(req)
	if got.Valid {
		t.Error("the Product Authority was accepted as the auditor of its own audit")
	}
	// Either refusal is correct and both are about role confusion: the role gate
	// fires first because occupancy is configured, and the auditorIdentity gate
	// would fire next. Asserting only the second would fail the moment the
	// stronger check was added, which is exactly what happened.
	if !strings.Contains(got.Reason, "auditorIdentity") && !strings.Contains(got.Reason, "does not hold role") {
		t.Errorf("refusal was not about auditor role or identity: %s", got.Reason)
	}
}

// 3. A declared auditorIdentity that is not the verifying principal is REJECTED.
func TestAuditorIdentityMustBeTheVerifiedPrincipal(t *testing.T) {
	f := newFixture(t)

	// The historical shape: a friendly label that nothing authenticates.
	value := jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String("AuditBinding")),
		jsonstrict.P("repositoryId", jsonstrict.String(testRepoID)),
		jsonstrict.P("stageSlug", jsonstrict.String(testStage)),
		jsonstrict.P("candidateDigest", jsonstrict.String(testCandidate)),
		jsonstrict.P("binarySha256", jsonstrict.String(testBinary)),
		jsonstrict.P("verdict", jsonstrict.String("PASS")),
		jsonstrict.P("auditorIdentity", jsonstrict.String("Codex")),
		jsonstrict.P("auditedAt", jsonstrict.String("2026-08-12T06:00:00Z")),
		jsonstrict.P("auditReportDigest", jsonstrict.String(strings.Repeat("C", 64))),
	)
	raw, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := AuditPath(f.store, testStage, testCandidate)
	os.MkdirAll(filepath.Dir(path), 0o700)
	os.WriteFile(path, raw, 0o600)
	os.WriteFile(path+".sig", armorSignature(f.auditorPriv, raw, Namespace), 0o600)

	got := LoadAuditBinding(f.auditRequest(testCandidate, canonical.Digest(raw)))
	if got.Valid {
		t.Fatal("an audit declaring an identity that did not sign it was accepted")
	}
	if !strings.Contains(got.Reason, "auditorIdentity") {
		t.Errorf("refusal was not about the declared auditor: %s", got.Reason)
	}
}

//  4. An auditor fingerprint equal to the Product Authority's is REJECTED, and
//     so is an equal principal. Both dimensions are load-bearing.
func TestSeparationOfDutiesRequiresDistinctPrincipalAndKey(t *testing.T) {
	f, auditDigest, releaseDigest := auditorWorld(t)
	audit := LoadAuditBinding(f.auditRequest(testCandidate, auditDigest))
	release := LoadReleaseAuthorization(f.bindingRequest(testCandidate, releaseDigest))
	if !audit.Valid || !release.Valid {
		t.Fatalf("fixture invalid: %s / %s", audit.Reason, release.Reason)
	}

	// 6. A valid auditor PASS plus a valid Product Authority release: ACCEPTED.
	if err := SeparationOfDuties(audit, release); err != nil {
		t.Fatalf("two genuinely distinct actors were refused: %v", err)
	}
	if err := ReleaseChainHistorical(audit, release, testCandidate); err != nil {
		t.Fatalf("a complete, properly separated chain was refused: %v", err)
	}

	t.Run("identical principals are refused", func(t *testing.T) {
		bad := audit
		bad.SignerPrincipal = release.SignerPrincipal
		if err := SeparationOfDuties(bad, release); err == nil {
			t.Error("one principal filled both roles")
		}
		if err := ReleaseChainHistorical(bad, release, testCandidate); err == nil {
			t.Error("the chain accepted one principal in both roles")
		}
	})

	t.Run("identical fingerprints are refused", func(t *testing.T) {
		bad := audit
		bad.SignerFingerprint = release.SignerFingerprint
		if err := SeparationOfDuties(bad, release); err == nil {
			t.Error("one key filled both roles")
		}
		if err := ReleaseChainHistorical(bad, release, testCandidate); err == nil {
			t.Error("the chain accepted one key in both roles")
		}
	})

	t.Run("an unknown identity cannot establish separation", func(t *testing.T) {
		for _, blank := range []AuditBinding{
			{Valid: true, SignerPrincipal: "", SignerFingerprint: audit.SignerFingerprint},
			{Valid: true, SignerPrincipal: audit.SignerPrincipal, SignerFingerprint: ""},
		} {
			if err := SeparationOfDuties(blank, release); err == nil {
				t.Error("separation was established from an unknown identity")
			}
		}
	})
}

// 7. The auditor cannot occupy Product Authority-only roles.
func TestAuditorCannotHoldProductAuthorityRoles(t *testing.T) {
	f, auditDigest, _ := auditorWorld(t)

	t.Run("auditor cannot issue a ReleaseAuthorization", func(t *testing.T) {
		digest := f.issueRelease(testCandidate, auditDigest, f.auditorPriv)
		if got := LoadReleaseAuthorization(f.bindingRequest(testCandidate, digest)); got.Valid {
			t.Error("a release authorization signed by the auditor was accepted")
		}
	})

	t.Run("auditor cannot issue a StageAuthorization", func(t *testing.T) {
		raw := f.payload(overrides{})
		digest := f.issue(f.versionedName(newID), raw, f.auditorPriv, Namespace)
		if got := f.load(newID, digest); got.Valid {
			t.Error("a stage authorization signed by the auditor was accepted")
		}
	})
}

// writeRoles installs the role table. Tests that need a malformed, missing or
// ambiguous table overwrite or remove it deliberately.
func (f *fixture) writeRoles(body string) {
	f.t.Helper()
	if err := os.WriteFile(RolesPath(f.store), []byte(body), 0o600); err != nil {
		f.t.Fatal(err)
	}
}

// ===========================================================================
// ROLE OCCUPANCY IS CONFIGURED, NOT ASSERTED
//
// The previous version of TestAuditorCannotHoldProductAuthorityRoles loaded an
// auditor-signed object using the PRODUCT AUTHORITY request, so it passed on a
// fingerprint mismatch and proved nothing about role occupancy. An audit caught
// it. These tests load with the auditor's OWN valid principal and fingerprint -
// the case that previously succeeded.
// ===========================================================================

func TestAuditorIsRefusedFromProductAuthorityRolesUsingItsOwnIdentity(t *testing.T) {
	f := newFixture(t)
	auditorReq := func(candidate, expected string) BindingRequest {
		req := f.bindingRequest(candidate, expected)
		req.ExpectedSigner = f.auditorFP
		req.SignerPrincipal = testAuditor
		return req
	}

	t.Run("StageAuthorization", func(t *testing.T) {
		raw := f.payload(overrides{fingerprint: f.auditorFP})
		digest := f.issue(f.versionedName(newID), raw, f.auditorPriv, Namespace)
		got := Load(Request{
			ControlStoreRoot: f.storeRoot, RepositoryID: testRepoID, StageSlug: testStage,
			AuthorizationID: newID, ExpectedDigest: digest,
			ExpectedSigner: f.auditorFP, SignerPrincipal: testAuditor,
			RepositoryRoot: f.repo, Git: f.git,
		})
		if got.Valid {
			t.Error("the auditor authorized a stage using its own valid identity")
		}
		if !strings.Contains(got.Reason, "does not hold role") {
			t.Errorf("refusal was not about role occupancy: %s", got.Reason)
		}
	})

	t.Run("ReleaseAuthorization", func(t *testing.T) {
		auditDigest := f.issueAudit(testCandidate, "PASS", f.auditorPriv, "")
		digest := f.issueReleaseSigner(testCandidate, auditDigest, f.auditorPriv, f.auditorFP)
		got := LoadReleaseAuthorization(auditorReq(testCandidate, digest))
		if got.Valid {
			t.Error("the auditor issued a release authorization using its own valid identity")
		}
		if !strings.Contains(got.Reason, "does not hold role") {
			t.Errorf("refusal was not about role occupancy: %s", got.Reason)
		}
	})
}

// The role table itself fails closed on every ambiguity.
func TestRoleTableFailsClosed(t *testing.T) {
	for _, tc := range []struct{ label, body string }{
		{"missing product-authority", "independent-auditor test-tier3-auditor\n"},
		{"missing independent-auditor", "product-authority test-product-authority\n"},
		{"duplicate assignment", "product-authority test-product-authority\nproduct-authority someone-else\nindependent-auditor test-tier3-auditor\n"},
		{"both roles one principal", "product-authority test-product-authority\nindependent-auditor test-product-authority\n"},
		{"unknown role", "release-authority test-product-authority\nindependent-auditor test-tier3-auditor\n"},
		{"malformed line", "product-authority\nindependent-auditor test-tier3-auditor\n"},
		{"principal absent from allowed_signers", "product-authority nobody-at-all\nindependent-auditor test-tier3-auditor\n"},
		{"empty table", "# nothing configured\n"},
	} {
		f := newFixture(t)
		f.writeRoles(tc.body)
		if _, err := LoadRoles(f.store); err == nil {
			t.Errorf("%s was accepted", tc.label)
		}
	}

	t.Run("a missing table is refused", func(t *testing.T) {
		f := newFixture(t)
		os.Remove(RolesPath(f.store))
		if _, err := LoadRoles(f.store); err == nil {
			t.Error("an absent role table was accepted")
		}
	})

	t.Run("the configured table resolves to distinct principals and keys", func(t *testing.T) {
		f := newFixture(t)
		roles, err := LoadRoles(f.store)
		if err != nil {
			t.Fatalf("the fixture table did not resolve: %v", err)
		}
		if roles.ProductAuthority.Principal == roles.IndependentAuditor.Principal {
			t.Error("roles resolved to one principal")
		}
		if roles.ProductAuthority.Fingerprint == roles.IndependentAuditor.Fingerprint {
			t.Error("roles resolved to one key")
		}
		// Fingerprints are DERIVED from the registered keys, never declared.
		if roles.ProductAuthority.Fingerprint != f.fingerprint {
			t.Errorf("product authority fingerprint %s was not derived from allowed_signers (%s)",
				roles.ProductAuthority.Fingerprint, f.fingerprint)
		}
		if roles.IndependentAuditor.Fingerprint != f.auditorFP {
			t.Errorf("auditor fingerprint %s was not derived from allowed_signers (%s)",
				roles.IndependentAuditor.Fingerprint, f.auditorFP)
		}
	})
}

// ===========================================================================
// RECOVERY ELIGIBILITY IS ADVERSARIALLY BOUNDED
//
// Eligibility is the most dangerous object in this system, because it is the
// only one whose whole purpose is to say "yes" about a chain that failed. Every
// other governed object refuses non-conforming evidence outright; this one
// acknowledges it and permits a bounded step forward anyway. That makes it the
// obvious lever for exactly the laundering the corrected auditor model exists
// to stop.
//
// So it is tested the way an attacker would use it. Each test below takes the
// ONE valid eligibility statement and changes a single thing an attacker would
// want to change - the signer, the predecessor, the recovery stage, the hop
// count, the classification, the binding to a real authorization - and requires
// a refusal. The properties being fixed:
//
//  1. only the CONFIGURED Product Authority can issue one, and the auditor is
//     refused even holding its own entirely valid identity
//  2. it covers exactly ONE predecessor and cannot be replayed onto another
//  3. it covers exactly ONE recovery stage and cannot be replayed into another
//  4. hopLimit is exactly 1, as an integer, with no string coercion
//  5. it is meaningless detached from a StageAuthorization baselined on the
//     predecessor it names
//  6. it never becomes release state, and grants no path and no mutation
// ===========================================================================

const testSupersededStage = "SOURCEROOT-TEST-SUPERSEDED-STAGE-V1"

type eligibilityOverrides struct {
	schemaVersion      string
	objectType         string
	repositoryID       string
	supersededCommit   string
	supersededStage    string
	recoveryStage      string
	classification     string
	reason             string
	issuedAt           string
	fingerprint        string
	namespace          string
	authorizationDig   string
	auditDig           string
	releaseDig         string
	commitDig          string
	hopLimit           int64
	hopLimitAsString   string
	dropReason         bool
	extraField         bool
	dropSupersededSlug bool
}

// issueEligibility writes an eligibility object at the path keyed by the
// recovery stage and predecessor it is FILED under, which the overrides may
// deliberately disagree with - that is how replay is tested.
func (f *fixture) issueEligibility(fileStage, fileCommit string, o eligibilityOverrides, signer ed25519.PrivateKey) string {
	f.t.Helper()
	pick := func(v, fallback string) string {
		if v == "" {
			return fallback
		}
		return v
	}
	hop := o.hopLimit
	if hop == 0 {
		hop = 1
	}
	members := []jsonstrict.Member{
		jsonstrict.P("schemaVersion", jsonstrict.String(pick(o.schemaVersion, SchemaVersion))),
		jsonstrict.P("objectType", jsonstrict.String(pick(o.objectType, EligibilityObjectType))),
		jsonstrict.P("repositoryId", jsonstrict.String(pick(o.repositoryID, testRepoID))),
		jsonstrict.P("supersededCommit", jsonstrict.String(pick(o.supersededCommit, f.baseline))),
		jsonstrict.P("supersededAuthorizationDigest", jsonstrict.String(pick(o.authorizationDig, strings.Repeat("A", 64)))),
		jsonstrict.P("supersededAuditBindingDigest", jsonstrict.String(pick(o.auditDig, strings.Repeat("B", 64)))),
		jsonstrict.P("supersededReleaseAuthorizationDigest", jsonstrict.String(pick(o.releaseDig, strings.Repeat("C", 64)))),
		jsonstrict.P("supersededCommitBindingDigest", jsonstrict.String(pick(o.commitDig, strings.Repeat("D", 64)))),
		jsonstrict.P("recoveryStageSlug", jsonstrict.String(pick(o.recoveryStage, testStage))),
		jsonstrict.P("classification", jsonstrict.String(pick(o.classification, ClassificationTerminalUnclosed))),
		jsonstrict.P("issuedAt", jsonstrict.String(pick(o.issuedAt, "2026-08-13T20:00:00Z"))),
		jsonstrict.P("signerKeyFingerprint", jsonstrict.String(pick(o.fingerprint, f.fingerprint))),
		jsonstrict.P("signatureNamespace", jsonstrict.String(pick(o.namespace, Namespace))),
	}
	if !o.dropSupersededSlug {
		members = append(members,
			jsonstrict.P("supersededStageSlug", jsonstrict.String(pick(o.supersededStage, testSupersededStage))))
	}
	// hopLimit is written as an INTEGER unless a test is specifically proving
	// that a string is refused. Writing it as a string by default would leave
	// the integer requirement untested.
	if o.hopLimitAsString != "" {
		members = append(members, jsonstrict.P("hopLimit", jsonstrict.String(o.hopLimitAsString)))
	} else {
		members = append(members, jsonstrict.P("hopLimit", jsonstrict.Int(hop)))
	}
	if !o.dropReason {
		members = append(members, jsonstrict.P("reason", jsonstrict.String(pick(o.reason,
			"the predecessor never achieved closure under the corrected auditor model"))))
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
	path := EligibilityPath(f.store, fileStage, fileCommit)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(path+".sig", armorSignature(signer, raw, Namespace), 0o600); err != nil {
		f.t.Fatal(err)
	}
	return canonical.Digest(raw)
}

func (f *fixture) eligibilityRequest(commit, digest string) EligibilityRequest {
	return EligibilityRequest{
		ControlStoreRoot:  f.storeRoot,
		RepositoryID:      testRepoID,
		RecoveryStageSlug: testStage,
		SupersededCommit:  commit,
		ExpectedDigest:    digest,
		ExpectedSigner:    f.fingerprint,
		SignerPrincipal:   testPrincipal,
	}
}

// eligibilityWorld is the one legitimate arrangement: a signed eligibility for
// the fixture's baseline commit, and a recovery StageAuthorization baselined on
// that same commit.
func eligibilityWorld(t *testing.T) (*fixture, string, Authorization) {
	t.Helper()
	f := newFixture(t)
	digest := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.priv)
	authDigest := f.issue(f.versionedName(newID), f.payload(overrides{}), f.priv, Namespace)
	auth := f.load(newID, authDigest)
	if !auth.Valid {
		t.Fatalf("fixture recovery authorization invalid: %s", auth.Reason)
	}
	return f, digest, auth
}

// The one arrangement that must WORK. Without this, every refusal below could
// be a refusal of everything, which proves nothing.
func TestRecoveryEligibilityAcceptsTheOneLegitimateArrangement(t *testing.T) {
	f, digest, auth := eligibilityWorld(t)

	got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
	if !got.Valid {
		t.Fatalf("the one legitimate eligibility was refused: %s", got.Reason)
	}
	if err := EligibleForRecovery(got, auth); err != nil {
		t.Fatalf("eligibility bound to its own recovery authorization was refused: %v", err)
	}
	if got.Classification != ClassificationTerminalUnclosed {
		t.Errorf("classification %q, expected %s", got.Classification, ClassificationTerminalUnclosed)
	}
	if got.SupersededCommit != f.baseline {
		t.Errorf("eligibility named %s, expected %s", got.SupersededCommit, f.baseline)
	}
	if got.SupersededStageSlug != testSupersededStage {
		t.Errorf("superseded stage %q, expected %q", got.SupersededStageSlug, testSupersededStage)
	}
	// The four legacy evidence digests are CARRIED, so the non-conforming chain
	// stays findable. Naming them is not endorsing them.
	for label, value := range map[string]string{
		"authorization": got.SupersededAuthorizationDigest,
		"audit":         got.SupersededAuditBindingDigest,
		"release":       got.SupersededReleaseAuthorizationDigest,
		"commit":        got.SupersededCommitBindingDigest,
	} {
		if !sha256Re.MatchString(value) {
			t.Errorf("legacy %s evidence digest %q is not identifiable", label, value)
		}
	}
	// It says nothing about conformance, and it is not release state.
	if !strings.Contains(got.Reason, "states nothing about whether the predecessor's audit chain conforms") {
		t.Errorf("the accepted reason does not disclaim conformance: %s", got.Reason)
	}
}

// PROPERTY 1. Only the configured Product Authority issues eligibility.
func TestRecoveryEligibilityRefusesEveryoneButProductAuthority(t *testing.T) {
	t.Run("the auditor is refused holding its own valid identity", func(t *testing.T) {
		f := newFixture(t)
		// Signed by the auditor, declaring the auditor's own real fingerprint,
		// loaded under the auditor's own real principal. Everything about this
		// object is internally consistent; it is refused purely on occupancy.
		digest := f.issueEligibility(testStage, f.baseline,
			eligibilityOverrides{fingerprint: f.auditorFP}, f.auditorPriv)
		req := f.eligibilityRequest(f.baseline, digest)
		req.ExpectedSigner = f.auditorFP
		req.SignerPrincipal = testAuditor

		got := LoadRecoveryEligibility(req)
		if got.Valid {
			t.Fatal("the independent auditor issued a recovery eligibility")
		}
		if !strings.Contains(got.Reason, "does not hold role") {
			t.Errorf("refusal was not about role occupancy: %s", got.Reason)
		}
	})

	t.Run("an unlisted key is refused", func(t *testing.T) {
		f := newFixture(t)
		digest := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.otherPriv)
		if got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest)); got.Valid {
			t.Fatal("an eligibility signed by an unlisted key was accepted")
		}
	})

	t.Run("a declared fingerprint that did not sign is refused", func(t *testing.T) {
		f := newFixture(t)
		// Signed by the Product Authority but declaring the auditor's key.
		digest := f.issueEligibility(testStage, f.baseline,
			eligibilityOverrides{fingerprint: f.auditorFP}, f.priv)
		got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
		if got.Valid {
			t.Fatal("an eligibility declaring a key that did not sign it was accepted")
		}
		if !strings.Contains(got.Reason, "signerKeyFingerprint") {
			t.Errorf("refusal was not about the declared key: %s", got.Reason)
		}
	})

	t.Run("a missing role table refuses eligibility outright", func(t *testing.T) {
		f := newFixture(t)
		digest := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.priv)
		os.Remove(RolesPath(f.store))
		got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
		if got.Valid {
			t.Fatal("eligibility was granted with no configured role table")
		}
		if !strings.Contains(got.Reason, "roles") {
			t.Errorf("refusal was not about the role table: %s", got.Reason)
		}
	})
}

// PROPERTY 2. One predecessor, and no replay onto another.
func TestRecoveryEligibilityCoversExactlyOnePredecessor(t *testing.T) {
	f := newFixture(t)
	other := f.advance("a second commit")
	if other == f.baseline {
		t.Fatal("the fixture did not actually advance")
	}

	// Filed under the baseline, so it is the object a request for the baseline
	// finds - but it NAMES the other commit.
	digest := f.issueEligibility(testStage, f.baseline,
		eligibilityOverrides{supersededCommit: other}, f.priv)
	got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
	if got.Valid {
		t.Fatal("an eligibility naming another predecessor answered for this one")
	}
	if !strings.Contains(got.Reason, "is for predecessor") {
		t.Errorf("refusal was not about the predecessor: %s", got.Reason)
	}

	t.Run("the object cannot be moved to cover a different predecessor", func(t *testing.T) {
		// The genuine object for the baseline, copied to the other commit's
		// path. Its bytes and signature are untouched and entirely valid.
		real := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.priv)
		src := EligibilityPath(f.store, testStage, f.baseline)
		dst := EligibilityPath(f.store, testStage, other)
		raw, err := os.ReadFile(src)
		if err != nil {
			t.Fatal(err)
		}
		sig, err := os.ReadFile(src + ".sig")
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(dst, raw, 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(dst+".sig", sig, 0o600); err != nil {
			t.Fatal(err)
		}

		relocated := LoadRecoveryEligibility(f.eligibilityRequest(other, real))
		if relocated.Valid {
			t.Fatal("a validly signed eligibility was relocated onto a different predecessor")
		}
		if !strings.Contains(relocated.Reason, "is for predecessor") {
			t.Errorf("refusal was not about the predecessor: %s", relocated.Reason)
		}
	})

	t.Run("a malformed predecessor id is refused before any load", func(t *testing.T) {
		for _, bad := range []string{"HEAD", strings.ToUpper(f.baseline), f.baseline[:39], f.baseline + "0", ""} {
			if got := LoadRecoveryEligibility(f.eligibilityRequest(bad, strings.Repeat("A", 64))); got.Valid {
				t.Errorf("predecessor id %q was accepted", bad)
			}
		}
	})
}

// PROPERTY 3. One recovery stage, and no replay into another.
func TestRecoveryEligibilityCoversExactlyOneRecoveryStage(t *testing.T) {
	f := newFixture(t)

	digest := f.issueEligibility(testStage, f.baseline,
		eligibilityOverrides{recoveryStage: "SOURCEROOT-SOME-OTHER-RECOVERY-V1"}, f.priv)
	got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
	if got.Valid {
		t.Fatal("an eligibility issued for another recovery stage answered for this one")
	}
	if !strings.Contains(got.Reason, "is for recovery stage") {
		t.Errorf("refusal was not about the recovery stage: %s", got.Reason)
	}

	t.Run("a predecessor cannot be its own recovery", func(t *testing.T) {
		self := f.issueEligibility(testStage, f.baseline,
			eligibilityOverrides{supersededStage: testStage}, f.priv)
		bad := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, self))
		if bad.Valid {
			t.Fatal("a stage was authorized to recover from itself")
		}
		if !strings.Contains(bad.Reason, "same slug") {
			t.Errorf("refusal was not about self-recovery: %s", bad.Reason)
		}
	})

	t.Run("a malformed recovery slug is refused before any load", func(t *testing.T) {
		for _, bad := range []string{"lower-case-slug", "", "Mixed-Case-V1"} {
			req := f.eligibilityRequest(f.baseline, strings.Repeat("A", 64))
			req.RecoveryStageSlug = bad
			if got := LoadRecoveryEligibility(req); got.Valid {
				t.Errorf("recovery slug %q was accepted", bad)
			}
		}
	})
}

// PROPERTY 4. Exactly one hop, as an integer.
func TestRecoveryEligibilityPermitsExactlyOneHop(t *testing.T) {
	f := newFixture(t)

	for _, hop := range []int64{2, 3, 99, -1} {
		digest := f.issueEligibility(testStage, f.baseline,
			eligibilityOverrides{hopLimit: hop, reason: fmt.Sprintf("hop %d", hop)}, f.priv)
		got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
		if got.Valid {
			t.Errorf("hopLimit %d authorized a recovery", hop)
		}
		if !strings.Contains(got.Reason, "hopLimit") {
			t.Errorf("refusal for hopLimit %d was not about the hop count: %s", hop, got.Reason)
		}
	}

	// The reason the field is read from the parsed value rather than as text:
	// a string "1" must not pass for the integer 1.
	for _, text := range []string{"1", "1 ", "01", "+1", "one"} {
		digest := f.issueEligibility(testStage, f.baseline,
			eligibilityOverrides{hopLimitAsString: text}, f.priv)
		got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
		if got.Valid {
			t.Errorf("hopLimit %q was accepted as the integer 1", text)
		}
		if !strings.Contains(got.Reason, "hopLimit") {
			t.Errorf("refusal for hopLimit %q was not about the hop count: %s", text, got.Reason)
		}
	}
}

// PROPERTY 5. Eligibility detached from a real StageAuthorization is nothing.
func TestRecoveryEligibilityIsMeaninglessWithoutItsAuthorization(t *testing.T) {
	f, digest, auth := eligibilityWorld(t)
	eligibility := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
	if !eligibility.Valid {
		t.Fatalf("fixture eligibility invalid: %s", eligibility.Reason)
	}

	t.Run("an invalid authorization carries no recovery", func(t *testing.T) {
		if err := EligibleForRecovery(eligibility, Authorization{Valid: false, Reason: "unsigned"}); err == nil {
			t.Error("recovery proceeded on an invalid authorization")
		}
	})

	t.Run("an invalid eligibility carries no recovery", func(t *testing.T) {
		if err := EligibleForRecovery(RecoveryEligibility{Valid: false, Reason: "unsigned"}, auth); err == nil {
			t.Error("recovery proceeded on an invalid eligibility")
		}
	})

	t.Run("an authorization for another stage is refused", func(t *testing.T) {
		other := auth
		other.StageSlug = "SOURCEROOT-SOME-OTHER-STAGE-V1"
		if err := EligibleForRecovery(eligibility, other); err == nil {
			t.Error("eligibility was bound to an authorization for a different stage")
		}
	})

	t.Run("an authorization baselined elsewhere is refused", func(t *testing.T) {
		// The heart of the binding: the recovery must start FROM the predecessor
		// it claims to recover. An authorization baselined anywhere else is a
		// different piece of work wearing this eligibility.
		elsewhere := auth
		elsewhere.BaselineCommit = strings.Repeat("a", 40)
		err := EligibleForRecovery(eligibility, elsewhere)
		if err == nil {
			t.Fatal("eligibility was bound to an authorization baselined on another commit")
		}
		if !strings.Contains(err.Error(), "baselined on") {
			t.Errorf("refusal was not about the baseline: %v", err)
		}
	})

	t.Run("a different repository is refused", func(t *testing.T) {
		foreign := auth
		foreign.RepositoryID = "github.com-someone-else-other"
		if err := EligibleForRecovery(eligibility, foreign); err == nil {
			t.Error("eligibility crossed a repository boundary")
		}
	})
}

// PROPERTY 6. Eligibility is never release state, and grants nothing.
//
// This is a STRUCTURAL property, not a behavioural one. A statement that could
// be talked into granting a path would be mutation authority under a weaker
// name, so the type is checked for the absence of any means to grant.
func TestRecoveryEligibilityGrantsNothing(t *testing.T) {
	f, digest, _ := eligibilityWorld(t)
	eligibility := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
	if !eligibility.Valid {
		t.Fatalf("fixture eligibility invalid: %s", eligibility.Reason)
	}

	// It exposes no method at all: no path question, no authority question,
	// nothing that could be mistaken for a grant.
	typ := reflect.TypeOf(eligibility)
	if n := typ.NumMethod(); n != 0 {
		t.Errorf("RecoveryEligibility exposes %d method(s); it must expose none", n)
	}
	// And it carries no path set to grant FROM.
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		if field.Type.Kind() == reflect.Slice || field.Type.Kind() == reflect.Map {
			t.Errorf("RecoveryEligibility carries collection field %q; it must carry only scalar facts", field.Name)
		}
		switch field.Name {
		case "AllowedPaths", "ProtectedPaths", "BaselineCommit", "LifecycleState":
			t.Errorf("RecoveryEligibility carries authority field %q", field.Name)
		}
	}

	// A valid eligibility does not make the superseded chain loadable as a
	// release. The four digests it names are labels for finding legacy
	// evidence, and nothing accepts them as evidence of conformance.
	audit := LoadAuditBinding(f.auditRequest(testCandidate, eligibility.SupersededAuditBindingDigest))
	if audit.Valid {
		t.Error("a digest named by eligibility loaded as a valid audit binding")
	}
	release := LoadReleaseAuthorization(f.bindingRequest(testCandidate, eligibility.SupersededReleaseAuthorizationDigest))
	if release.Valid {
		t.Error("a digest named by eligibility loaded as a valid release authorization")
	}
}

// The object schema is exact, like every other governed object.
func TestRecoveryEligibilitySchemaContract(t *testing.T) {
	f := newFixture(t)

	t.Run("an undeclared property is refused", func(t *testing.T) {
		digest := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{extraField: true}, f.priv)
		got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest))
		if got.Valid {
			t.Fatal("an eligibility with an undeclared property was accepted")
		}
	})

	t.Run("a missing required property is refused", func(t *testing.T) {
		for label, o := range map[string]eligibilityOverrides{
			"reason":              {dropReason: true},
			"supersededStageSlug": {dropSupersededSlug: true},
		} {
			digest := f.issueEligibility(testStage, f.baseline, o, f.priv)
			if got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest)); got.Valid {
				t.Errorf("an eligibility missing %s was accepted", label)
			}
		}
	})

	t.Run("every scalar field is validated", func(t *testing.T) {
		for label, o := range map[string]eligibilityOverrides{
			"schemaVersion":     {schemaVersion: "gds-authority-lifecycle-v2"},
			"objectType":        {objectType: "StageAuthorization"},
			"repositoryId":      {repositoryID: "github.com-someone-else-other"},
			"classification":    {classification: "TERMINAL"},
			"namespace":         {namespace: "some-other-namespace"},
			"issuedAt":          {issuedAt: "2026-08-13"},
			"blank reason":      {reason: "   "},
			"supersededStage":   {supersededStage: "not-a-slug"},
			"legacy auth dig":   {authorizationDig: "not-a-digest"},
			"legacy audit dig":  {auditDig: strings.Repeat("z", 64)},
			"legacy rel dig":    {releaseDig: strings.ToLower(strings.Repeat("C", 64))},
			"legacy commit dig": {commitDig: strings.Repeat("D", 63)},
		} {
			digest := f.issueEligibility(testStage, f.baseline, o, f.priv)
			if got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest)); got.Valid {
				t.Errorf("an eligibility with an invalid %s was accepted", label)
			}
		}
	})

	t.Run("a wrong expected digest is refused", func(t *testing.T) {
		f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.priv)
		if got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, strings.Repeat("F", 64))); got.Valid {
			t.Fatal("an eligibility with the wrong expected digest was accepted")
		}
	})

	t.Run("a tampered object is refused", func(t *testing.T) {
		digest := f.issueEligibility(testStage, f.baseline, eligibilityOverrides{}, f.priv)
		path := EligibilityPath(f.store, testStage, f.baseline)
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		// One byte, inside the reason text, with the signature left in place.
		tampered := strings.Replace(string(raw), "never achieved closure", "never Achieved closure", 1)
		if tampered == string(raw) {
			t.Fatal("the fixture text changed; this test tampered with nothing")
		}
		if err := os.WriteFile(path, []byte(tampered), 0o600); err != nil {
			t.Fatal(err)
		}
		if got := LoadRecoveryEligibility(f.eligibilityRequest(f.baseline, digest)); got.Valid {
			t.Fatal("a tampered eligibility was accepted")
		}
	})
}
