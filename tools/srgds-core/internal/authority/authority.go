// Package authority owns the complete validation of a signed StageAuthorization.
//
// AUTHORITY LIVES OUTSIDE THE CANDIDATE. Authoritative objects live in an
// ACL-protected external control store and are signed by the Product Authority.
// Repository files - including this source file - are TOOLING, not authority. A
// repository file may be edited by the very stage it governs, so a repository
// file can never be the trust root. This package reads authority; it never
// confers it.
//
// Selection is made by the CALLER, in execution context, and is stated as a
// pair that must BOTH hold: which issuance (authorizationId) and which exact
// signed bytes (expected digest). One stage slug can have more than one signed
// issuance, so resolving a stage to "the file named after it" is not a decision
// at all - it silently returns whichever issuance occupies a filename. Nothing
// here is selected because it exists, because it is newest, or because its UUID
// sorts highest, and there is no enumeration of the store.
//
// Signature verification is implemented directly against the SSHSIG wire format
// rather than by running ssh-keygen and reading its English output. Parsing a
// human-readable success message is the same class of mistake that produced the
// original candidate-path corruption, and it would put an exit code and a
// sentence between this core and the only question that matters: do these exact
// bytes carry a valid signature from the expected key over the expected
// namespace.
package authority

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"sourceroot.local/srgds-core/internal/canonical"
	"sourceroot.local/srgds-core/internal/gitexec"
	"sourceroot.local/srgds-core/internal/jsonstrict"
	"sourceroot.local/srgds-core/internal/lifecycle"
	"sourceroot.local/srgds-core/internal/pathgrammar"
)

const (
	// SchemaVersion is the only schema this core reads.
	SchemaVersion = "gds-authority-lifecycle-v1"
	// Namespace is the SSHSIG namespace every governance signature must carry.
	Namespace = "sourceroot-gds-v1"
	// DefaultControlStoreRoot is the ACL-protected external store.
	DefaultControlStoreRoot = `C:\ProgramData\SourceRoot\GDS`
	// ObjectType is the object this package validates.
	ObjectType = "StageAuthorization"
)

var (
	uuidRe   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	sha256Re = regexp.MustCompile(`^[0-9A-F]{64}$`)
	hexAnyRe = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)
	gitIDRe  = regexp.MustCompile(`^[0-9a-f]{40}$`)
	stampRe  = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$`)
	fpRe     = regexp.MustCompile(`^SHA256:[A-Za-z0-9+/]{43}$`)
	slugRe   = regexp.MustCompile(`^[A-Z0-9-]+$`)
)

// requiredFields is the complete property set of a StageAuthorization. Both
// directions are enforced: an unknown property is a producer this core does not
// understand, and a missing property is a policy that was never stated.
var requiredFields = []string{
	"schemaVersion", "objectType", "authorizationId", "repositoryId", "stageSlug",
	"riskTier", "baselineCommit", "lifecycleState", "allowedPaths", "protectedPaths",
	"requestedBy", "issuedAt", "signerKeyFingerprint", "signatureNamespace",
}

// Authorization is the result of a load attempt. An invalid result is still
// returned rather than discarded, because the reason is the useful part.
type Authorization struct {
	Valid              bool
	Reason             string
	Path               string
	Selection          string
	Digest             string
	AuthorizationID    string
	RepositoryID       string
	StageSlug          string
	RiskTier           int64
	BaselineCommit     string
	LifecycleState     string
	AllowedPaths       []string
	ProtectedPaths     []string
	RequestedBy        string
	IssuedAt           string
	SignerFingerprint  string
	SignerPrincipal    string
	SignatureNamespace string
}

// Request states, in execution context, exactly which authority is wanted.
//
// There is deliberately no field that skips the baseline check. The PowerShell
// implementation carried a -SkipHeadCheck switch for test convenience, and an
// audit proved it produced a fully authoritative object on the wrong HEAD. A
// bypass that exists for tests is a bypass that exists. Tests here build a real
// repository and sign a real baseline instead.
type Request struct {
	ControlStoreRoot string
	RepositoryID     string
	StageSlug        string
	AuthorizationID  string
	ExpectedDigest   string
	ExpectedSigner   string
	SignerPrincipal  string
	RepositoryRoot   string
	Git              *gitexec.Runner
}

func reject(format string, args ...any) Authorization {
	return Authorization{Valid: false, Reason: fmt.Sprintf(format, args...)}
}

// ControlStore returns the per-repository control store directory.
func ControlStore(root, repositoryID string) string {
	if root == "" {
		root = DefaultControlStoreRoot
	}
	return filepath.Join(root, repositoryID)
}

// Resolve names the file that carries one issuance.
//
// The requested id names at most one file. The historical unversioned name
// remains readable so earlier issuances stay verifiable, but it is consulted
// only when no file carries the requested id, and whatever it holds must still
// prove its own id downstream. A request for one issuance can therefore never
// be answered by another: there is no fallback edge between issuances.
func Resolve(store, stageSlug, authorizationID string) (path string, selection string, err error) {
	dir := filepath.Join(store, "authorizations")
	versioned := filepath.Join(dir, fmt.Sprintf("%s.%s.authorization.json", stageSlug, authorizationID))
	if fileExists(versioned) {
		return versioned, "versioned", nil
	}
	legacy := filepath.Join(dir, fmt.Sprintf("%s.authorization.json", stageSlug))
	if fileExists(legacy) {
		return legacy, "legacy-unversioned", nil
	}
	return "", "", fmt.Errorf("no authority object is bound to authorizationId %s for stage %s", authorizationID, stageSlug)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

// Load selects, verifies and validates one signed StageAuthorization.
//
// Order is deliberate. The requested identity is validated before it is used to
// name a file, so a malformed request never reaches the filesystem as a path
// fragment. The digest is checked before the signature, and the signature
// before the parse, so no unverified byte is ever interpreted as structure.
func loadValidatedObject(req Request) Authorization {
	principal := req.SignerPrincipal
	if principal == "" {
		return reject("no signer principal was supplied; authority cannot be attributed")
	}
	if !uuidRe.MatchString(req.AuthorizationID) {
		return reject("requested authorizationId is not a lowercase UUID")
	}
	if !hexAnyRe.MatchString(req.ExpectedDigest) {
		return reject("expected authorization digest is not a SHA-256 hex digest")
	}
	if !fpRe.MatchString(req.ExpectedSigner) {
		return reject("expected signer fingerprint is not an SSH SHA256 fingerprint")
	}
	if req.RepositoryID == "" {
		return reject("no repository id was supplied")
	}
	if !slugRe.MatchString(req.StageSlug) {
		return reject("stage slug %q is not an upper-case governance slug", req.StageSlug)
	}

	store := ControlStore(req.ControlStoreRoot, req.RepositoryID)
	path, selection, err := Resolve(store, req.StageSlug, req.AuthorizationID)
	if err != nil {
		return reject("%s", err.Error())
	}

	result := Authorization{Path: path, Selection: selection}
	fail := func(format string, args ...any) Authorization {
		result.Valid = false
		result.Reason = fmt.Sprintf(format, args...)
		return result
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return fail("authority object is unreadable: %v", err)
	}
	sigRaw, err := os.ReadFile(path + ".sig")
	if err != nil {
		return fail("authority signature is unreadable: %v", err)
	}
	signersRaw, err := os.ReadFile(filepath.Join(store, "allowed_signers"))
	if err != nil {
		return fail("allowed_signers is unreadable: %v", err)
	}

	digest := canonical.Digest(raw)
	result.Digest = digest
	if digest != strings.ToUpper(req.ExpectedDigest) {
		return fail("authorization digest %s does not match the expected %s", digest, strings.ToUpper(req.ExpectedDigest))
	}

	fingerprint, err := VerifySignature(raw, sigRaw, signersRaw, principal, Namespace)
	if err != nil {
		return fail("signature verification failed: %v", err)
	}
	result.SignerPrincipal = principal
	if fingerprint != req.ExpectedSigner {
		return fail("signature is from key %s, not the expected Product Authority key %s", fingerprint, req.ExpectedSigner)
	}

	payload, err := jsonstrict.Parse(raw)
	if err != nil {
		return fail("authorization payload rejected at the parsing boundary: %v", err)
	}
	if payload.Kind != jsonstrict.KindObject {
		return fail("authorization payload is a %v, not an object", payload.Kind)
	}

	present := map[string]bool{}
	for _, name := range payload.Names() {
		present[name] = true
	}
	var unknown []string
	for name := range present {
		if !contains(requiredFields, name) {
			unknown = append(unknown, name)
		}
	}
	if len(unknown) > 0 {
		return fail("authorization declares unknown properties: %s", strings.Join(sorted(unknown), ", "))
	}
	var missing []string
	for _, name := range requiredFields {
		if !present[name] {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fail("authorization is missing required properties: %s", strings.Join(missing, ", "))
	}

	str := func(name string) string {
		v, _ := payload.Get(name)
		s, _ := v.StringValue()
		return s
	}

	if str("schemaVersion") != SchemaVersion {
		return fail("unsupported schemaVersion %q", str("schemaVersion"))
	}
	if str("objectType") != ObjectType {
		return fail("unexpected objectType %q", str("objectType"))
	}
	if str("repositoryId") != req.RepositoryID {
		return fail("authorization is for repository %q, not %q", str("repositoryId"), req.RepositoryID)
	}
	if str("stageSlug") != req.StageSlug {
		return fail("authorization is for stage %q, not %q", str("stageSlug"), req.StageSlug)
	}

	result.AuthorizationID = str("authorizationId")
	if !uuidRe.MatchString(result.AuthorizationID) {
		return fail("authorizationId is not a lowercase UUID")
	}
	// The signed object must be the issuance execution context asked for. This
	// is what makes the historical unversioned name safe to read: whatever it
	// holds must still prove it is the requested issuance.
	if result.AuthorizationID != req.AuthorizationID {
		return fail("selected object is authorizationId %s, not the requested %s", result.AuthorizationID, req.AuthorizationID)
	}

	tierValue, _ := payload.Get("riskTier")
	tier, ok := tierValue.IntValue()
	if !ok {
		return fail("riskTier is not an integer")
	}
	if tier < 1 || tier > 4 {
		return fail("riskTier %d is outside the supported range 1-4", tier)
	}

	baseline := str("baselineCommit")
	if !gitIDRe.MatchString(baseline) {
		return fail("baselineCommit is not a full Git object id")
	}

	state := lifecycle.State(str("lifecycleState"))
	if !lifecycle.Known(state) {
		return fail("unknown lifecycleState %q", state)
	}
	if state != lifecycle.AuthorizationIssueState {
		return fail("a StageAuthorization must be issued in %s, not %s", lifecycle.AuthorizationIssueState, state)
	}

	if str("signatureNamespace") != Namespace {
		return fail("unexpected signatureNamespace %q", str("signatureNamespace"))
	}
	if str("signerKeyFingerprint") != req.ExpectedSigner {
		return fail("declared signerKeyFingerprint does not match the expected Product Authority key")
	}
	// The declared fingerprint is a claim inside the object; the verified one is
	// a fact about the bytes. They must agree, or the object is describing a key
	// that did not sign it.
	if str("signerKeyFingerprint") != fingerprint {
		return fail("declared signerKeyFingerprint %s is not the key that signed these bytes (%s)", str("signerKeyFingerprint"), fingerprint)
	}
	if strings.TrimSpace(str("requestedBy")) == "" {
		return fail("requestedBy is required")
	}
	if !stampRe.MatchString(str("issuedAt")) {
		return fail("issuedAt is not a second-precision UTC timestamp")
	}

	allowed, err := stringArray(payload, "allowedPaths")
	if err != nil {
		return fail("allowedPaths: %v", err)
	}
	protected, err := stringArray(payload, "protectedPaths")
	if err != nil {
		return fail("protectedPaths: %v", err)
	}
	if len(allowed) == 0 {
		return fail("allowedPaths must not be empty")
	}
	for _, entry := range allowed {
		if !pathgrammar.Safe(entry) {
			return fail("allowedPaths contains an unsafe path: %s", entry)
		}
	}
	for _, entry := range protected {
		if !pathgrammar.Safe(pathgrammar.NormalizeProtected(entry)) {
			return fail("protectedPaths contains an unsafe path: %s", entry)
		}
	}
	if !pathgrammar.OrdinalSorted(allowed) {
		return fail("allowedPaths is not in strict ordinal order, or contains duplicates")
	}
	if !pathgrammar.OrdinalSorted(protected) {
		return fail("protectedPaths is not in strict ordinal order, or contains duplicates")
	}
	if overlaps := pathgrammar.Disjoint(allowed, protected); len(overlaps) > 0 {
		return fail("authorization contradicts itself: %s", strings.Join(overlaps, "; "))
	}

	// Canonical equality. A signature over non-canonical bytes would bind a form
	// this system cannot reproduce and therefore cannot re-verify later.
	reserialized, err := canonical.Marshal(payload)
	if err != nil {
		return fail("authorization cannot be re-serialized canonically: %v", err)
	}
	if !bytes.Equal(reserialized, raw) {
		return fail("signed authorization bytes are not canonical under the committed algorithm")
	}

	result.RepositoryID = str("repositoryId")
	result.StageSlug = str("stageSlug")
	result.RiskTier = tier
	result.BaselineCommit = baseline
	result.LifecycleState = string(state)
	result.AllowedPaths = allowed
	result.ProtectedPaths = protected
	result.RequestedBy = str("requestedBy")
	result.IssuedAt = str("issuedAt")
	result.SignerFingerprint = fingerprint
	result.SignatureNamespace = Namespace
	result.Valid = true
	result.Reason = fmt.Sprintf(
		"authorizationId %s selected explicitly (%s); signed by %s over %s; digest, canonical bytes and full schema verified",
		result.AuthorizationID, selection, principal, Namespace)
	return result
}

// Load selects, verifies and validates one signed StageAuthorization AS
// CURRENT AUTHORITY.
//
// The baseline check is UNCONDITIONAL and has no bypass parameter: an
// authorization governs work built from the commit it names, and nothing else.
// A descendant is not that commit, so a consumed authorization can never
// authorize a mutation on top of the release it produced.
func Load(req Request) Authorization {
	result := loadValidatedObject(req)
	if !result.Valid {
		return result
	}
	if req.Git == nil {
		result.Valid = false
		result.Reason = "no repository was supplied for the baseline check"
		return result
	}
	head, err := req.Git.HeadCommit()
	if err != nil {
		result.Valid = false
		result.Reason = fmt.Sprintf("HEAD is unreadable: %v", err)
		return result
	}
	if head != result.BaselineCommit {
		result.Valid = false
		result.Reason = fmt.Sprintf("HEAD %s is not the authorized baseline %s", head, result.BaselineCommit)
		return result
	}
	result.Reason += "; HEAD equals baseline"
	return result
}

// HistoricalAuthorization is a signed authorization read as EVIDENCE ABOUT THE
// PAST, never as permission in the present.
//
// It deliberately carries NO allowed or protected paths and has NO
// PathAuthorized method. There is therefore nothing it can be used to permit:
// it can answer "which baseline did this govern, and was it genuinely signed"
// and nothing else. That distinction is the whole point. A released commit is a
// descendant of the baseline its authorization named, and if reading that
// authorization after release returned something that could authorize paths,
// every release would silently re-arm the authority it just consumed.
type HistoricalAuthorization struct {
	Valid           bool
	Reason          string
	Path            string
	Digest          string
	AuthorizationID string
	RepositoryID    string
	StageSlug       string
	BaselineCommit  string
	SignerPrincipal string
}

// LoadHistoricalAuthorization validates a signed authorization object without
// asserting anything about the current HEAD.
//
// It performs EXACTLY the same object validation as Load - same digest, same
// signature, same canonical-form requirement, same complete schema check - and
// omits exactly one thing: the HEAD-equals-baseline test. That omission is safe
// only because of the return type. This is not "Load with a flag"; a flag would
// be a bypass, and an earlier bypass of precisely that shape was removed from
// this package after an audit.
func LoadHistoricalAuthorization(req Request) HistoricalAuthorization {
	result := loadValidatedObject(req)
	historical := HistoricalAuthorization{
		Valid:           result.Valid,
		Reason:          result.Reason,
		Path:            result.Path,
		Digest:          result.Digest,
		AuthorizationID: result.AuthorizationID,
		RepositoryID:    result.RepositoryID,
		StageSlug:       result.StageSlug,
		BaselineCommit:  result.BaselineCommit,
		SignerPrincipal: result.SignerPrincipal,
	}
	if historical.Valid {
		historical.Reason += "; read as historical evidence, conferring no authority over HEAD"
	}
	return historical
}

// PathAuthorized decides one candidate path against this authorization.
func (a Authorization) PathAuthorized(path string) bool {
	if !a.Valid {
		return false
	}
	return pathgrammar.Authorized(a.AllowedPaths, a.ProtectedPaths, path)
}

func stringArray(obj *jsonstrict.Value, name string) ([]string, error) {
	v, ok := obj.Get(name)
	if !ok {
		return nil, fmt.Errorf("property is absent")
	}
	if v.Kind != jsonstrict.KindArray {
		return nil, fmt.Errorf("property is a %v, not an array", v.Kind)
	}
	out := make([]string, 0, len(v.Array))
	for i, item := range v.Array {
		s, ok := item.StringValue()
		if !ok {
			return nil, fmt.Errorf("element %d is a %v, not a string", i, item.Kind)
		}
		out = append(out, s)
	}
	return out, nil
}

func contains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}

func sorted(items []string) []string {
	out := append([]string(nil), items...)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j] < out[j-1]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// ===========================================================================
// AUDIT BINDING AND RELEASE AUTHORIZATION
//
// Four objects are bound separately and never conflated:
//
//	StageAuthorization    what a stage MAY change, signed before work begins
//	CandidateManifest     exactly what a stage DID change, deterministic
//	AuditBinding          an independent verdict over ONE exact candidate
//	ReleaseAuthorization  Product Authority release over ONE exact candidate
//	                      and ONE exact PASS audit
//
// The chain is what makes a green result meaningless on its own. An audit
// binding names a candidate digest, so it dies the moment the candidate changes
// by a byte. A release authorization names both a candidate digest and an audit
// binding digest, so release cannot be granted over an unaudited candidate, a
// failed audit, or an audit of something else.
//
// An AuditBinding declares no signer fingerprint, because the schema does not
// give it one: the auditor is an independent party, and which key is acceptable
// is a decision the CALLER states in execution context rather than something
// the audited object asserts about itself.
// ===========================================================================

var auditFields = []string{
	"schemaVersion", "objectType", "repositoryId", "stageSlug",
	"candidateDigest", "binarySha256", "verdict", "auditorIdentity", "auditedAt", "auditReportDigest",
}

var releaseFields = []string{
	"schemaVersion", "objectType", "repositoryId", "stageSlug",
	"candidateDigest", "binarySha256", "auditBindingDigest", "authorizedAt",
	"signerKeyFingerprint", "signatureNamespace",
}

// SelfBinaryDigest returns the SHA-256 of the executable currently running.
//
// An audit is evidence about a specific decision procedure, not about source
// that resembles it. Binding the audited binary's digest into the audit and the
// release authorization, and then requiring the binary that answers the release
// gate to BE that binary, closes the gap between "this source was audited" and
// "this is the thing deciding". The executable is never committed; its identity
// is bound externally, in signed objects, exactly like every other authority
// fact in this system.
func SelfBinaryDigest() (string, error) {
	path, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("the running executable cannot be located: %w", err)
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err == nil {
		path = resolved
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("the running executable cannot be read: %w", err)
	}
	return canonical.Digest(raw), nil
}

// AuditBinding is an independent verdict over one exact candidate.
type AuditBinding struct {
	Valid             bool
	Reason            string
	Path              string
	Digest            string
	RepositoryID      string
	StageSlug         string
	CandidateDigest   string
	BinarySha256      string
	Verdict           string
	AuditorIdentity   string
	AuditedAt         string
	AuditReportDigest string
	SignerFingerprint string
	SignerPrincipal   string
}

// ReleaseAuthorization is the Product Authority's release over one candidate
// and one PASS audit.
type ReleaseAuthorization struct {
	Valid              bool
	Reason             string
	Path               string
	Digest             string
	RepositoryID       string
	StageSlug          string
	CandidateDigest    string
	BinarySha256       string
	AuditBindingDigest string
	AuthorizedAt       string
	SignerFingerprint  string
	SignerPrincipal    string
}

// BindingRequest states which binding object is wanted, and over which
// candidate. Both digests are mandatory: the candidate digest says which
// candidate is being talked about, and the expected object digest says which
// exact signed bytes are allowed to answer.
type BindingRequest struct {
	ControlStoreRoot string
	RepositoryID     string
	StageSlug        string
	CandidateDigest  string
	ExpectedDigest   string
	ExpectedSigner   string
	SignerPrincipal  string
}

// AuditPath and ReleasePath name the binding objects for one candidate.
func AuditPath(store, stageSlug, candidateDigest string) string {
	return filepath.Join(store, "audits", fmt.Sprintf("%s.%s.audit.json", stageSlug, candidateDigest))
}

func ReleasePath(store, stageSlug, candidateDigest string) string {
	return filepath.Join(store, "releases", fmt.Sprintf("%s.%s.release.json", stageSlug, candidateDigest))
}

// loadSigned performs the checks every signed control-store object shares:
// exact bytes, a valid signature from the expected key, strict parsing, and
// canonical form. Object-specific meaning is the caller's job.
func loadSigned(path, expectedDigest, store, principal, expectedSigner string) (payload *jsonstrict.Value, digest, fingerprint string, err error) {
	if !hexAnyRe.MatchString(expectedDigest) {
		return nil, "", "", fmt.Errorf("expected digest is not a SHA-256 hex digest")
	}
	if !fpRe.MatchString(expectedSigner) {
		return nil, "", "", fmt.Errorf("expected signer fingerprint is not an SSH SHA256 fingerprint")
	}
	if principal == "" {
		return nil, "", "", fmt.Errorf("no signer principal was supplied; authority cannot be attributed")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, "", "", fmt.Errorf("object is unreadable: %v", err)
	}
	sigRaw, err := os.ReadFile(path + ".sig")
	if err != nil {
		return nil, "", "", fmt.Errorf("signature is unreadable: %v", err)
	}
	signersRaw, err := os.ReadFile(filepath.Join(store, "allowed_signers"))
	if err != nil {
		return nil, "", "", fmt.Errorf("allowed_signers is unreadable: %v", err)
	}

	digest = canonical.Digest(raw)
	if digest != strings.ToUpper(expectedDigest) {
		return nil, digest, "", fmt.Errorf("digest %s does not match the expected %s", digest, strings.ToUpper(expectedDigest))
	}
	fingerprint, err = VerifySignature(raw, sigRaw, signersRaw, principal, Namespace)
	if err != nil {
		return nil, digest, "", fmt.Errorf("signature verification failed: %v", err)
	}
	if fingerprint != expectedSigner {
		return nil, digest, fingerprint, fmt.Errorf("signature is from key %s, not the expected %s", fingerprint, expectedSigner)
	}
	payload, err = jsonstrict.Parse(raw)
	if err != nil {
		return nil, digest, fingerprint, fmt.Errorf("payload rejected at the parsing boundary: %v", err)
	}
	if payload.Kind != jsonstrict.KindObject {
		return nil, digest, fingerprint, fmt.Errorf("payload is a %v, not an object", payload.Kind)
	}
	reserialized, err := canonical.Marshal(payload)
	if err != nil {
		return nil, digest, fingerprint, fmt.Errorf("payload cannot be re-serialized canonically: %v", err)
	}
	if !bytes.Equal(reserialized, raw) {
		return nil, digest, fingerprint, fmt.Errorf("signed bytes are not canonical under the committed algorithm")
	}
	return payload, digest, fingerprint, nil
}

func exactProperties(payload *jsonstrict.Value, required []string) error {
	present := map[string]bool{}
	for _, name := range payload.Names() {
		present[name] = true
	}
	var unknown []string
	for name := range present {
		if !contains(required, name) {
			unknown = append(unknown, name)
		}
	}
	if len(unknown) > 0 {
		return fmt.Errorf("object declares unknown properties: %s", strings.Join(sorted(unknown), ", "))
	}
	var missing []string
	for _, name := range required {
		if !present[name] {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("object is missing required properties: %s", strings.Join(missing, ", "))
	}
	return nil
}

func property(payload *jsonstrict.Value, name string) string {
	v, _ := payload.Get(name)
	s, _ := v.StringValue()
	return s
}

// LoadAuditBinding verifies an independent audit verdict over one candidate.
func LoadAuditBinding(req BindingRequest) AuditBinding {
	store := ControlStore(req.ControlStoreRoot, req.RepositoryID)
	result := AuditBinding{}
	fail := func(format string, args ...any) AuditBinding {
		result.Valid = false
		result.Reason = fmt.Sprintf(format, args...)
		return result
	}
	if !sha256Re.MatchString(strings.ToUpper(req.CandidateDigest)) {
		return fail("candidate digest is not an uppercase SHA-256")
	}
	if !slugRe.MatchString(req.StageSlug) {
		return fail("stage slug %q is not an upper-case governance slug", req.StageSlug)
	}
	result.Path = AuditPath(store, req.StageSlug, strings.ToUpper(req.CandidateDigest))

	payload, digest, fingerprint, err := loadSigned(result.Path, req.ExpectedDigest, store, req.SignerPrincipal, req.ExpectedSigner)
	result.Digest = digest
	if err != nil {
		return fail("%s", err.Error())
	}
	if err := exactProperties(payload, auditFields); err != nil {
		return fail("%s", err.Error())
	}
	if property(payload, "schemaVersion") != SchemaVersion {
		return fail("unsupported schemaVersion %q", property(payload, "schemaVersion"))
	}
	if property(payload, "objectType") != "AuditBinding" {
		return fail("unexpected objectType %q", property(payload, "objectType"))
	}
	if property(payload, "repositoryId") != req.RepositoryID {
		return fail("audit binding is for repository %q", property(payload, "repositoryId"))
	}
	if property(payload, "stageSlug") != req.StageSlug {
		return fail("audit binding is for stage %q", property(payload, "stageSlug"))
	}
	// The binding must name the candidate the caller is asking about. A binding
	// that names a different candidate is evidence about something else.
	if property(payload, "candidateDigest") != strings.ToUpper(req.CandidateDigest) {
		return fail("audit binding is over candidate %s, not %s", property(payload, "candidateDigest"), strings.ToUpper(req.CandidateDigest))
	}
	if !sha256Re.MatchString(property(payload, "binarySha256")) {
		return fail("binarySha256 is not an uppercase SHA-256")
	}
	verdict := property(payload, "verdict")
	if verdict != "PASS" && verdict != "FAIL" {
		return fail("unknown audit verdict %q", verdict)
	}
	if strings.TrimSpace(property(payload, "auditorIdentity")) == "" {
		return fail("auditorIdentity is required")
	}
	if !stampRe.MatchString(property(payload, "auditedAt")) {
		return fail("auditedAt is not a second-precision UTC timestamp")
	}
	if !sha256Re.MatchString(property(payload, "auditReportDigest")) {
		return fail("auditReportDigest is not an uppercase SHA-256")
	}

	result.RepositoryID = property(payload, "repositoryId")
	result.StageSlug = property(payload, "stageSlug")
	result.CandidateDigest = property(payload, "candidateDigest")
	result.BinarySha256 = property(payload, "binarySha256")
	result.Verdict = verdict
	result.AuditorIdentity = property(payload, "auditorIdentity")
	result.AuditedAt = property(payload, "auditedAt")
	result.AuditReportDigest = property(payload, "auditReportDigest")
	result.SignerFingerprint = fingerprint
	result.SignerPrincipal = req.SignerPrincipal
	result.Valid = true
	result.Reason = fmt.Sprintf("audit binding %s over candidate %s, verdict %s, signed by %s",
		digest, result.CandidateDigest, verdict, req.SignerPrincipal)
	return result
}

// LoadReleaseAuthorization verifies a Product Authority release over one
// candidate and one audit binding.
func LoadReleaseAuthorization(req BindingRequest) ReleaseAuthorization {
	store := ControlStore(req.ControlStoreRoot, req.RepositoryID)
	result := ReleaseAuthorization{}
	fail := func(format string, args ...any) ReleaseAuthorization {
		result.Valid = false
		result.Reason = fmt.Sprintf(format, args...)
		return result
	}
	if !sha256Re.MatchString(strings.ToUpper(req.CandidateDigest)) {
		return fail("candidate digest is not an uppercase SHA-256")
	}
	if !slugRe.MatchString(req.StageSlug) {
		return fail("stage slug %q is not an upper-case governance slug", req.StageSlug)
	}
	result.Path = ReleasePath(store, req.StageSlug, strings.ToUpper(req.CandidateDigest))

	payload, digest, fingerprint, err := loadSigned(result.Path, req.ExpectedDigest, store, req.SignerPrincipal, req.ExpectedSigner)
	result.Digest = digest
	if err != nil {
		return fail("%s", err.Error())
	}
	if err := exactProperties(payload, releaseFields); err != nil {
		return fail("%s", err.Error())
	}
	if property(payload, "schemaVersion") != SchemaVersion {
		return fail("unsupported schemaVersion %q", property(payload, "schemaVersion"))
	}
	if property(payload, "objectType") != "ReleaseAuthorization" {
		return fail("unexpected objectType %q", property(payload, "objectType"))
	}
	if property(payload, "repositoryId") != req.RepositoryID {
		return fail("release authorization is for repository %q", property(payload, "repositoryId"))
	}
	if property(payload, "stageSlug") != req.StageSlug {
		return fail("release authorization is for stage %q", property(payload, "stageSlug"))
	}
	if property(payload, "candidateDigest") != strings.ToUpper(req.CandidateDigest) {
		return fail("release authorization is over candidate %s, not %s", property(payload, "candidateDigest"), strings.ToUpper(req.CandidateDigest))
	}
	if !sha256Re.MatchString(property(payload, "binarySha256")) {
		return fail("binarySha256 is not an uppercase SHA-256")
	}
	if !sha256Re.MatchString(property(payload, "auditBindingDigest")) {
		return fail("auditBindingDigest is not an uppercase SHA-256")
	}
	if !stampRe.MatchString(property(payload, "authorizedAt")) {
		return fail("authorizedAt is not a second-precision UTC timestamp")
	}
	if property(payload, "signatureNamespace") != Namespace {
		return fail("unexpected signatureNamespace %q", property(payload, "signatureNamespace"))
	}
	if property(payload, "signerKeyFingerprint") != fingerprint {
		return fail("declared signerKeyFingerprint %s is not the key that signed these bytes (%s)",
			property(payload, "signerKeyFingerprint"), fingerprint)
	}

	result.RepositoryID = property(payload, "repositoryId")
	result.StageSlug = property(payload, "stageSlug")
	result.CandidateDigest = property(payload, "candidateDigest")
	result.BinarySha256 = property(payload, "binarySha256")
	result.AuditBindingDigest = property(payload, "auditBindingDigest")
	result.AuthorizedAt = property(payload, "authorizedAt")
	result.SignerFingerprint = fingerprint
	result.SignerPrincipal = req.SignerPrincipal
	result.Valid = true
	result.Reason = fmt.Sprintf("release authorization %s over candidate %s and audit binding %s, signed by %s",
		digest, result.CandidateDigest, result.AuditBindingDigest, req.SignerPrincipal)
	return result
}

// ReleaseChain reports whether a candidate may be released.
//
// Every link is checked, and each one alone is insufficient by design:
//
//	the release authorization is over THIS candidate
//	the audit binding is over THIS candidate
//	the release authorization names THIS audit binding, by digest
//	the audit verdict is PASS
//
// A green verifier is evidence, never approval: nothing in this function can be
// satisfied by running a tool. Each link exists because someone signed it.
// ReleaseChain is the GRANTING form, used before a release commit exists. It
// requires everything ReleaseChainHistorical requires, and additionally that
// the binary asking is the binary that was audited.
func ReleaseChain(audit AuditBinding, release ReleaseAuthorization, candidateDigest, binaryDigest string) error {
	if err := ReleaseChainHistorical(audit, release, candidateDigest); err != nil {
		return err
	}
	binaryDigest = strings.ToUpper(binaryDigest)
	if binaryDigest == "" {
		return fmt.Errorf("the identity of the running trust core could not be established")
	}
	if audit.BinarySha256 != binaryDigest {
		return fmt.Errorf("this trust core is binary %s, but the audit and release are bound to %s; a different binary cannot satisfy them",
			binaryDigest, audit.BinarySha256)
	}
	return nil
}

// ReleaseChainHistorical is the READING form, used to verify a release that
// already happened.
//
// It checks every link of the chain EXCEPT that the running binary is the
// audited one, and the omission is deliberate. The audited binarySha256 is a
// fact about the release; requiring the CURRENT process to equal it would mean
// no future version of this core could ever verify a past release - the moment
// the core changes, all its own history becomes unverifiable. That is the
// opposite of what a release record is for.
//
// The binary is still bound: the audit and the release authorization must name
// the SAME binary, and that value is reported as the released identity. What is
// dropped is only the claim that the reader is the writer.
func ReleaseChainHistorical(audit AuditBinding, release ReleaseAuthorization, candidateDigest string) error {
	candidateDigest = strings.ToUpper(candidateDigest)
	if !audit.Valid {
		return fmt.Errorf("audit binding is not valid: %s", audit.Reason)
	}
	if !release.Valid {
		return fmt.Errorf("release authorization is not valid: %s", release.Reason)
	}
	if audit.CandidateDigest != candidateDigest {
		return fmt.Errorf("the audit binding is over candidate %s, not %s", audit.CandidateDigest, candidateDigest)
	}
	if release.CandidateDigest != candidateDigest {
		return fmt.Errorf("the release authorization is over candidate %s, not %s", release.CandidateDigest, candidateDigest)
	}
	if audit.Verdict != "PASS" {
		return fmt.Errorf("the audit verdict over this candidate is %s", audit.Verdict)
	}
	if release.AuditBindingDigest != audit.Digest {
		return fmt.Errorf("the release authorization names audit binding %s, but the audit binding over this candidate is %s",
			release.AuditBindingDigest, audit.Digest)
	}
	if audit.StageSlug != release.StageSlug {
		return fmt.Errorf("the audit binding and the release authorization name different stages")
	}
	if audit.RepositoryID != release.RepositoryID {
		return fmt.Errorf("the audit binding and the release authorization name different repositories")
	}

	// BINARY IDENTITY, chain-internal. An audit is evidence about a specific
	// decision procedure, so the release must name the same procedure the audit
	// judged. Whether the READER is that binary is decided by the caller:
	// ReleaseChain requires it, ReleaseChainHistorical does not.
	if audit.BinarySha256 != release.BinarySha256 {
		return fmt.Errorf("the audit binding names binary %s but the release authorization names %s",
			audit.BinarySha256, release.BinarySha256)
	}
	return nil
}

// ===========================================================================
// SSHSIG VERIFICATION
//
// PROTOCOL.sshsig, implemented against the wire format with the standard
// library only. Ed25519 is the only accepted algorithm: anything else fails
// closed rather than falling through to a weaker check.
// ===========================================================================

const sshsigMagic = "SSHSIG"

// VerifySignature verifies an SSHSIG detached signature over message and
// returns the SHA256 fingerprint of the key that made it.
//
// Every element is bound: the key must be listed for the principal, the
// principal's namespace restriction must admit this namespace, the signature's
// embedded key must be the listed key, and the signed blob must carry the
// expected namespace. A signature valid for a different namespace is not valid
// here, which is what stops a signature made for one purpose from authorizing
// another.
func VerifySignature(message, armored, allowedSigners []byte, principal, namespace string) (string, error) {
	pubBlob, err := lookupSigner(allowedSigners, principal, namespace)
	if err != nil {
		return "", err
	}
	blob, err := decodeArmor(armored)
	if err != nil {
		return "", err
	}

	if len(blob) < len(sshsigMagic) || string(blob[:len(sshsigMagic)]) != sshsigMagic {
		return "", fmt.Errorf("signature does not carry the SSHSIG magic")
	}
	r := &sshReader{buf: blob[len(sshsigMagic):]}
	version, err := r.uint32()
	if err != nil {
		return "", fmt.Errorf("signature version: %w", err)
	}
	if version != 1 {
		return "", fmt.Errorf("unsupported SSHSIG version %d", version)
	}
	sigKey, err := r.str()
	if err != nil {
		return "", fmt.Errorf("signature public key: %w", err)
	}
	sigNamespace, err := r.str()
	if err != nil {
		return "", fmt.Errorf("signature namespace: %w", err)
	}
	reserved, err := r.str()
	if err != nil {
		return "", fmt.Errorf("signature reserved field: %w", err)
	}
	hashAlg, err := r.str()
	if err != nil {
		return "", fmt.Errorf("signature hash algorithm: %w", err)
	}
	sigBlob, err := r.str()
	if err != nil {
		return "", fmt.Errorf("signature body: %w", err)
	}
	if r.remaining() != 0 {
		return "", fmt.Errorf("signature carries %d trailing bytes", r.remaining())
	}

	if string(sigNamespace) != namespace {
		return "", fmt.Errorf("signature namespace %q is not %q", string(sigNamespace), namespace)
	}
	if !bytes.Equal(sigKey, pubBlob) {
		return "", fmt.Errorf("signature was made by a key that is not the one allowed for principal %q", principal)
	}

	hashed, err := hashMessage(message, string(hashAlg))
	if err != nil {
		return "", err
	}

	// The signed blob is rebuilt here rather than taken from the file, so a
	// crafted file cannot present one blob for verification and another for
	// interpretation.
	var signed bytes.Buffer
	signed.WriteString(sshsigMagic)
	writeString(&signed, []byte(namespace))
	writeString(&signed, reserved)
	writeString(&signed, hashAlg)
	writeString(&signed, hashed)

	pub, err := ed25519PublicKey(pubBlob)
	if err != nil {
		return "", err
	}
	sig, err := ed25519Signature(sigBlob)
	if err != nil {
		return "", err
	}
	if !ed25519.Verify(pub, signed.Bytes(), sig) {
		return "", fmt.Errorf("ed25519 signature does not verify over these exact bytes")
	}
	return Fingerprint(pubBlob), nil
}

// Fingerprint returns the OpenSSH SHA256 fingerprint of a public key blob.
func Fingerprint(pubBlob []byte) string {
	sum := sha256.Sum256(pubBlob)
	return "SHA256:" + base64.RawStdEncoding.EncodeToString(sum[:])
}

func hashMessage(message []byte, alg string) ([]byte, error) {
	switch alg {
	case "sha512":
		sum := sha512.Sum512(message)
		return sum[:], nil
	case "sha256":
		sum := sha256.Sum256(message)
		return sum[:], nil
	default:
		return nil, fmt.Errorf("unsupported signature hash algorithm %q", alg)
	}
}

func ed25519PublicKey(blob []byte) (ed25519.PublicKey, error) {
	r := &sshReader{buf: blob}
	kind, err := r.str()
	if err != nil {
		return nil, fmt.Errorf("public key type: %w", err)
	}
	if string(kind) != "ssh-ed25519" {
		return nil, fmt.Errorf("unsupported public key type %q; this core verifies ed25519 only", string(kind))
	}
	key, err := r.str()
	if err != nil {
		return nil, fmt.Errorf("public key body: %w", err)
	}
	if len(key) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("ed25519 public key is %d bytes, not %d", len(key), ed25519.PublicKeySize)
	}
	return ed25519.PublicKey(key), nil
}

func ed25519Signature(blob []byte) ([]byte, error) {
	r := &sshReader{buf: blob}
	kind, err := r.str()
	if err != nil {
		return nil, fmt.Errorf("signature type: %w", err)
	}
	if string(kind) != "ssh-ed25519" {
		return nil, fmt.Errorf("unsupported signature type %q; this core verifies ed25519 only", string(kind))
	}
	sig, err := r.str()
	if err != nil {
		return nil, fmt.Errorf("signature bytes: %w", err)
	}
	if len(sig) != ed25519.SignatureSize {
		return nil, fmt.Errorf("ed25519 signature is %d bytes, not %d", len(sig), ed25519.SignatureSize)
	}
	return sig, nil
}

// lookupSigner finds the public key blob allowed for a principal.
//
// Options are not skipped. An option this core does not implement is a
// restriction the signer file intended to impose, so honouring the line while
// ignoring the option would grant more than was written down. Unknown options
// therefore fail closed.
func lookupSigner(allowedSigners []byte, principal, namespace string) ([]byte, error) {
	lines := strings.Split(strings.ReplaceAll(string(allowedSigners), "\r\n", "\n"), "\n")
	for lineNo, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := splitFields(line)
		if len(fields) < 3 {
			return nil, fmt.Errorf("allowed_signers line %d is malformed", lineNo+1)
		}
		principals := strings.Split(fields[0], ",")
		if !contains(principals, principal) {
			continue
		}
		rest := fields[1:]
		options := ""
		if !isKeyType(rest[0]) {
			options = rest[0]
			rest = rest[1:]
		}
		if len(rest) < 2 {
			return nil, fmt.Errorf("allowed_signers line %d has no key", lineNo+1)
		}
		if !isKeyType(rest[0]) {
			return nil, fmt.Errorf("allowed_signers line %d does not name a supported key type", lineNo+1)
		}
		if err := checkOptions(options, namespace, lineNo+1); err != nil {
			return nil, err
		}
		blob, err := base64.StdEncoding.DecodeString(rest[1])
		if err != nil {
			return nil, fmt.Errorf("allowed_signers line %d has an undecodable key: %w", lineNo+1, err)
		}
		return blob, nil
	}
	return nil, fmt.Errorf("principal %q is not listed in allowed_signers", principal)
}

func isKeyType(field string) bool {
	switch field {
	case "ssh-ed25519", "ssh-rsa", "ssh-dss",
		"ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521",
		"sk-ssh-ed25519@openssh.com", "sk-ecdsa-sha2-nistp256@openssh.com":
		return true
	}
	return false
}

func checkOptions(options, namespace string, lineNo int) error {
	if options == "" {
		return nil
	}
	for _, opt := range splitOptions(options) {
		name, value, hasValue := strings.Cut(opt, "=")
		switch strings.ToLower(name) {
		case "namespaces":
			if !hasValue {
				return fmt.Errorf("allowed_signers line %d declares namespaces with no value", lineNo)
			}
			patterns := strings.Split(strings.Trim(value, `"`), ",")
			if !contains(patterns, namespace) {
				return fmt.Errorf("allowed_signers line %d restricts the key to %s, which does not admit %q", lineNo, value, namespace)
			}
		default:
			return fmt.Errorf("allowed_signers line %d carries option %q, which this core does not implement; refusing to ignore a restriction", lineNo, name)
		}
	}
	return nil
}

// splitFields splits on whitespace outside double quotes, so an option value
// containing a space stays one field.
func splitFields(line string) []string {
	var fields []string
	var current strings.Builder
	inQuote := false
	for i := 0; i < len(line); i++ {
		c := line[i]
		switch {
		case c == '"':
			inQuote = !inQuote
			current.WriteByte(c)
		case (c == ' ' || c == '\t') && !inQuote:
			if current.Len() > 0 {
				fields = append(fields, current.String())
				current.Reset()
			}
		default:
			current.WriteByte(c)
		}
	}
	if current.Len() > 0 {
		fields = append(fields, current.String())
	}
	return fields
}

// splitOptions splits an option field on commas outside double quotes.
func splitOptions(options string) []string {
	var out []string
	var current strings.Builder
	inQuote := false
	for i := 0; i < len(options); i++ {
		c := options[i]
		switch {
		case c == '"':
			inQuote = !inQuote
			current.WriteByte(c)
		case c == ',' && !inQuote:
			if current.Len() > 0 {
				out = append(out, current.String())
				current.Reset()
			}
		default:
			current.WriteByte(c)
		}
	}
	if current.Len() > 0 {
		out = append(out, current.String())
	}
	return out
}

func decodeArmor(armored []byte) ([]byte, error) {
	text := strings.ReplaceAll(string(armored), "\r\n", "\n")
	const begin = "-----BEGIN SSH SIGNATURE-----"
	const end = "-----END SSH SIGNATURE-----"
	start := strings.Index(text, begin)
	if start < 0 {
		return nil, fmt.Errorf("signature is missing its BEGIN header")
	}
	stop := strings.Index(text, end)
	if stop < 0 || stop < start {
		return nil, fmt.Errorf("signature is missing its END footer")
	}
	body := text[start+len(begin) : stop]
	body = strings.Join(strings.Fields(body), "")
	blob, err := base64.StdEncoding.DecodeString(body)
	if err != nil {
		return nil, fmt.Errorf("signature body is not decodable base64: %w", err)
	}
	return blob, nil
}

type sshReader struct {
	buf []byte
	pos int
}

func (r *sshReader) uint32() (uint32, error) {
	if r.pos+4 > len(r.buf) {
		return 0, fmt.Errorf("truncated 32-bit field")
	}
	v := binary.BigEndian.Uint32(r.buf[r.pos:])
	r.pos += 4
	return v, nil
}

func (r *sshReader) str() ([]byte, error) {
	n, err := r.uint32()
	if err != nil {
		return nil, err
	}
	if uint64(r.pos)+uint64(n) > uint64(len(r.buf)) {
		return nil, fmt.Errorf("declared length %d exceeds the remaining %d bytes", n, len(r.buf)-r.pos)
	}
	out := r.buf[r.pos : r.pos+int(n)]
	r.pos += int(n)
	return out, nil
}

func (r *sshReader) remaining() int { return len(r.buf) - r.pos }

func writeString(b *bytes.Buffer, value []byte) {
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(value)))
	b.Write(length[:])
	b.Write(value)
}

// ===========================================================================
// RELEASE COMMIT BINDING
//
// An audit found that terminal release state was established from the parent
// commit, the tree, and the signed chain - and that this identifies a COMMIT
// only by accident. Two commits over the same parent and the same tree, made by
// different people at different times with different messages, are different
// commits with different SHAs, and the check accepted both.
//
// The cure is not to compare more Git fields, and it is certainly not to
// hard-code the SHA that happens to be right. Author, committer, timestamps and
// message are exactly the fields an impostor controls. The commit identity has
// to arrive the same way every other authority fact in this system arrives:
// signed, from outside the candidate, in the control store.
//
// It cannot be folded into the ReleaseAuthorization. That object is signed
// BEFORE the release commit exists, so it cannot name a commit SHA without
// predicting one. Hence a separate, post-commit statement.
//
// Like HistoricalAuthorization, this object grants NOTHING. It carries no
// paths, and it has no method that could authorize one.
// ===========================================================================

// CommitBindingObjectType is the fifth governed object type.
const CommitBindingObjectType = "ReleaseCommitBinding"

var commitBindingFields = []string{
	"schemaVersion", "objectType", "repositoryId", "stageSlug",
	"authorizationId", "authorizationDigest", "candidateDigest", "candidateTree",
	"auditBindingDigest", "releaseAuthorizationDigest", "binarySha256",
	"releaseCommit", "releaseParent", "releaseTree", "boundAt",
	"signerKeyFingerprint", "signatureNamespace",
}

// ReleaseCommitBinding is the Product Authority's statement that one exact Git
// commit is the release of one exact audited candidate.
//
// Every field is a scalar fact about a release that already happened. There is
// deliberately no allowed-path set, no protected-path set, and no method: a
// binding that could answer a path question would be mutation authority wearing
// a historical label.
type ReleaseCommitBinding struct {
	Valid                      bool
	Reason                     string
	Path                       string
	Digest                     string
	RepositoryID               string
	StageSlug                  string
	AuthorizationID            string
	AuthorizationDigest        string
	CandidateDigest            string
	CandidateTree              string
	AuditBindingDigest         string
	ReleaseAuthorizationDigest string
	BinarySha256               string
	ReleaseCommit              string
	ReleaseParent              string
	ReleaseTree                string
	BoundAt                    string
	SignerFingerprint          string
	SignerPrincipal            string
}

// CommitBindingPath names the binding object for one candidate.
//
// It is keyed by candidate digest rather than by commit SHA on purpose: the
// caller must not be able to select which commit gets validated by choosing a
// filename. The candidate is what the caller legitimately knows in advance; the
// commit is what this object is authoritative about.
func CommitBindingPath(store, stageSlug, candidateDigest string) string {
	return filepath.Join(store, "commits", fmt.Sprintf("%s.%s.commit.json", stageSlug, candidateDigest))
}

// LoadReleaseCommitBinding verifies a Product Authority binding of one exact
// commit to one exact candidate.
func LoadReleaseCommitBinding(req BindingRequest) ReleaseCommitBinding {
	store := ControlStore(req.ControlStoreRoot, req.RepositoryID)
	result := ReleaseCommitBinding{}
	fail := func(format string, args ...any) ReleaseCommitBinding {
		result.Valid = false
		result.Reason = fmt.Sprintf(format, args...)
		return result
	}
	if !sha256Re.MatchString(strings.ToUpper(req.CandidateDigest)) {
		return fail("candidate digest is not an uppercase SHA-256")
	}
	if !slugRe.MatchString(req.StageSlug) {
		return fail("stage slug %q is not an upper-case governance slug", req.StageSlug)
	}
	result.Path = CommitBindingPath(store, req.StageSlug, strings.ToUpper(req.CandidateDigest))

	payload, digest, fingerprint, err := loadSigned(result.Path, req.ExpectedDigest, store, req.SignerPrincipal, req.ExpectedSigner)
	result.Digest = digest
	if err != nil {
		return fail("%s", err.Error())
	}
	if err := exactProperties(payload, commitBindingFields); err != nil {
		return fail("%s", err.Error())
	}
	if property(payload, "schemaVersion") != SchemaVersion {
		return fail("unsupported schemaVersion %q", property(payload, "schemaVersion"))
	}
	if property(payload, "objectType") != CommitBindingObjectType {
		return fail("unexpected objectType %q", property(payload, "objectType"))
	}
	if property(payload, "repositoryId") != req.RepositoryID {
		return fail("release commit binding is for repository %q, not %q", property(payload, "repositoryId"), req.RepositoryID)
	}
	if property(payload, "stageSlug") != req.StageSlug {
		return fail("release commit binding is for stage %q, not %q", property(payload, "stageSlug"), req.StageSlug)
	}
	if property(payload, "candidateDigest") != strings.ToUpper(req.CandidateDigest) {
		return fail("release commit binding is over candidate %s, not %s",
			property(payload, "candidateDigest"), strings.ToUpper(req.CandidateDigest))
	}
	if !uuidRe.MatchString(property(payload, "authorizationId")) {
		return fail("authorizationId is not a lowercase UUID")
	}
	for _, field := range []string{"authorizationDigest", "auditBindingDigest", "releaseAuthorizationDigest", "binarySha256"} {
		if !sha256Re.MatchString(property(payload, field)) {
			return fail("%s is not an uppercase SHA-256", field)
		}
	}
	for _, field := range []string{"candidateTree", "releaseCommit", "releaseParent", "releaseTree"} {
		if !gitIDRe.MatchString(property(payload, field)) {
			return fail("%s is not a lowercase 40-character Git object id", field)
		}
	}
	if !stampRe.MatchString(property(payload, "boundAt")) {
		return fail("boundAt is not a second-precision UTC timestamp")
	}
	if property(payload, "signerKeyFingerprint") != fingerprint {
		return fail("the binding declares signer key %s but was signed by %s",
			property(payload, "signerKeyFingerprint"), fingerprint)
	}
	if property(payload, "signatureNamespace") != Namespace {
		return fail("unexpected signatureNamespace %q", property(payload, "signatureNamespace"))
	}

	// SELF-CONSISTENCY. The thing committed must be the thing audited, and the
	// binding must say so about itself before anything else is compared to it.
	if property(payload, "releaseTree") != property(payload, "candidateTree") {
		return fail("the binding names release tree %s but audited candidate tree %s",
			property(payload, "releaseTree"), property(payload, "candidateTree"))
	}
	// A commit is never its own parent, and a release never lands on its own
	// baseline. Either would mean the release did not move history.
	if property(payload, "releaseCommit") == property(payload, "releaseParent") {
		return fail("the binding names the same commit as both the release and its parent")
	}

	result.RepositoryID = property(payload, "repositoryId")
	result.StageSlug = property(payload, "stageSlug")
	result.AuthorizationID = property(payload, "authorizationId")
	result.AuthorizationDigest = property(payload, "authorizationDigest")
	result.CandidateDigest = property(payload, "candidateDigest")
	result.CandidateTree = property(payload, "candidateTree")
	result.AuditBindingDigest = property(payload, "auditBindingDigest")
	result.ReleaseAuthorizationDigest = property(payload, "releaseAuthorizationDigest")
	result.BinarySha256 = property(payload, "binarySha256")
	result.ReleaseCommit = property(payload, "releaseCommit")
	result.ReleaseParent = property(payload, "releaseParent")
	result.ReleaseTree = property(payload, "releaseTree")
	result.BoundAt = property(payload, "boundAt")
	result.SignerFingerprint = fingerprint
	result.SignerPrincipal = req.SignerPrincipal
	result.Valid = true
	result.Reason = fmt.Sprintf("release commit binding %s binds commit %s to candidate %s, signed by %s",
		digest, result.ReleaseCommit, result.CandidateDigest, req.SignerPrincipal)
	return result
}

// ObservedRelease is what the repository itself says, read from Git.
//
// It is passed in rather than read here so that the comparison below is a pure
// function of two inputs: what was signed, and what is actually checked out.
type ObservedRelease struct {
	Head   string
	Parent string
	Tree   string
}

// ReleaseCommitChain binds the exact commit to the complete historical chain.
//
// ReleaseChainHistorical already establishes that a PASS audit and a Product
// Authority release authorization cover one candidate. This adds the fact those
// two objects could not carry, because neither existed after the commit did:
// WHICH COMMIT. Without it, terminal state was satisfied by any commit sharing a
// parent and a tree with the real one.
//
// Nothing here is derived from a command-line argument. The expected commit
// comes from signed bytes; the observed commit comes from Git; the caller
// chooses neither.
func ReleaseCommitChain(
	binding ReleaseCommitBinding,
	audit AuditBinding,
	release ReleaseAuthorization,
	historical HistoricalAuthorization,
	observed ObservedRelease,
) error {
	if !binding.Valid {
		return fmt.Errorf("release commit binding is not valid: %s", binding.Reason)
	}
	if !historical.Valid {
		return fmt.Errorf("historical authorization is not valid: %s", historical.Reason)
	}

	// The chain the binding claims to sit on top of must itself hold.
	if err := ReleaseChainHistorical(audit, release, binding.CandidateDigest); err != nil {
		return err
	}

	// The binding must name the objects that were actually verified, by digest.
	// Otherwise it could vouch for a commit while pointing at some other stage's
	// audit and release.
	if binding.AuditBindingDigest != audit.Digest {
		return fmt.Errorf("the commit binding names audit binding %s, but the verified audit binding is %s",
			binding.AuditBindingDigest, audit.Digest)
	}
	if binding.ReleaseAuthorizationDigest != release.Digest {
		return fmt.Errorf("the commit binding names release authorization %s, but the verified release authorization is %s",
			binding.ReleaseAuthorizationDigest, release.Digest)
	}
	if binding.BinarySha256 != audit.BinarySha256 {
		return fmt.Errorf("the commit binding names binary %s but the audit names %s",
			binding.BinarySha256, audit.BinarySha256)
	}
	if binding.RepositoryID != audit.RepositoryID || binding.RepositoryID != release.RepositoryID {
		return fmt.Errorf("the commit binding names a different repository from the audit and release chain")
	}
	if binding.StageSlug != audit.StageSlug || binding.StageSlug != release.StageSlug {
		return fmt.Errorf("the commit binding names a different stage from the audit and release chain")
	}

	// The binding must name the consumed authorization, exactly.
	if binding.AuthorizationID != historical.AuthorizationID {
		return fmt.Errorf("the commit binding names authorization %s, but the verified authorization is %s",
			binding.AuthorizationID, historical.AuthorizationID)
	}
	if binding.AuthorizationDigest != historical.Digest {
		return fmt.Errorf("the commit binding names authorization bytes %s, but the verified authorization is %s",
			binding.AuthorizationDigest, historical.Digest)
	}
	if binding.StageSlug != historical.StageSlug {
		return fmt.Errorf("the commit binding names stage %s, but the authorization is for %s",
			binding.StageSlug, historical.StageSlug)
	}

	// The release must have landed on the baseline that authorization signed.
	// This is what keeps "descendant" from being a synonym for "authorized":
	// only the immediate child of the signed baseline can be its release.
	if binding.ReleaseParent != historical.BaselineCommit {
		return fmt.Errorf("the commit binding names parent %s, but the authorization's signed baseline is %s",
			binding.ReleaseParent, historical.BaselineCommit)
	}

	// THE CODEX FINDING. Everything above was already true of an impostor commit
	// over the same parent and tree. This is the line that refuses it.
	if observed.Head != binding.ReleaseCommit {
		return fmt.Errorf("HEAD is commit %s, but the signed release commit binding names %s; a commit sharing a parent and a tree is still a different commit",
			observed.Head, binding.ReleaseCommit)
	}
	if observed.Parent != binding.ReleaseParent {
		return fmt.Errorf("HEAD's parent is %s, but the binding names %s", observed.Parent, binding.ReleaseParent)
	}
	if observed.Tree != binding.ReleaseTree {
		return fmt.Errorf("HEAD's tree is %s, but the binding names %s", observed.Tree, binding.ReleaseTree)
	}
	return nil
}
