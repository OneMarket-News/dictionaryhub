// Command srgds-core is the SourceRoot governed development system trust core.
//
// It exists because the previous implementation of these decisions lived in
// PowerShell, and four independent audits kept finding the same class of defect
// underneath the same class of language behaviour: pipelines that collapse a
// one-element collection to a scalar, comparisons that are case-insensitive by
// default, a JSON reader that silently merges duplicate names, an encoder that
// substitutes U+FFFD for malformed input, and native output decoded through a
// console code page. None of those is a bug in PowerShell. They are properties
// of a language built for interactive administration, and they are the wrong
// properties for the component that decides whether a change is authorized.
//
// This binary answers questions and prints machine-readable verdicts. It never
// grants authority; authority is the Product Authority's signature over bytes
// in an external ACL-protected store. PowerShell orchestrates and reports, and
// MUST NOT independently re-derive any decision made here.
//
// Exit codes are part of the contract:
//
//	0  ACCEPT  the question was answered affirmatively
//	3  REJECT  the question was answered negatively, with a reason
//	2  ERROR   the question could not be answered at all
//
// A caller that cannot distinguish 3 from 2 must treat both as failure. There
// is no exit code that means "probably fine".
package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"sourceroot.local/srgds-core/internal/authority"
	"sourceroot.local/srgds-core/internal/candidate"
	"sourceroot.local/srgds-core/internal/canonical"
	"sourceroot.local/srgds-core/internal/gitexec"
	"sourceroot.local/srgds-core/internal/jsonstrict"
	"sourceroot.local/srgds-core/internal/lifecycle"
)

// Version identifies the contract this binary implements. It is reported in
// every verdict so a stale binary cannot be mistaken for a current one.
const Version = "srgds-core/1.0.0 (gds-authority-lifecycle-v1)"

const (
	exitAccept = 0
	exitError  = 2
	exitReject = 3
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(exitError)
	}
	command := os.Args[1]
	args := os.Args[2:]

	switch command {
	case "version":
		os.Exit(cmdVersion())
	case "authority-verify":
		os.Exit(cmdAuthorityVerify(args))
	case "candidate-manifest":
		os.Exit(cmdCandidateManifest(args))
	case "path-check":
		os.Exit(cmdPathCheck(args))
	case "release-gate":
		os.Exit(cmdReleaseGate(args))
	case "lifecycle-check":
		os.Exit(cmdLifecycleCheck(args))
	case "canonical-digest":
		os.Exit(cmdCanonicalDigest(args))
	case "-h", "--help", "help":
		usage()
		os.Exit(exitAccept)
	default:
		usage()
		emit(exitError, command, "ERROR", fmt.Sprintf("unknown command %q", command))
	}
}

// cmdVersion reports the contract version AND the identity of the executable
// answering. The second is what an auditor records and what a release
// authorization is later bound to.
func cmdVersion() int {
	digest, err := authority.SelfBinaryDigest()
	if err != nil {
		return emitReturn(exitError, "version", "ERROR", err.Error())
	}
	// The governed Git executable is part of the decision procedure, so its
	// identity is reported alongside the core's own. An auditor records both.
	gitPath, gitVersion, gitDigest, gitErr := gitexec.GovernedGitIdentity()
	members := []jsonstrict.Member{
		jsonstrict.P("coreBinarySha256", jsonstrict.String(digest)),
		jsonstrict.P("gitExecutable", jsonstrict.String(gitPath)),
		jsonstrict.P("gitVersion", jsonstrict.String(gitVersion)),
		jsonstrict.P("gitSha256", jsonstrict.String(gitDigest)),
	}
	if gitErr != nil {
		return emitReturn(exitReject, "version", "REJECT",
			"the governed Git executable did not verify: "+gitErr.Error(), members...)
	}
	return emitReturn(exitAccept, "version", "ACCEPT", Version, members...)
}

func usage() {
	fmt.Fprint(os.Stderr, `srgds-core - SourceRoot GDS trust core

  version             report the contract version and this binary's SHA-256
  authority-verify    -repo DIR -stage SLUG -authorization-id UUID
                      -expected-digest SHA256 -signer-fingerprint SHA256:...
                      [-repository-id ID] [-signer-principal NAME] [-control-store DIR]
  candidate-manifest  <authority flags> [-out FILE]
  path-check          <authority flags> -path PATH [-path PATH ...]
  release-gate        <authority flags> -audit-digest SHA256 -release-digest SHA256
                      -auditor-principal NAME -auditor-fingerprint SHA256:...
  lifecycle-check     -from STATE -to STATE
  canonical-digest    -file FILE

Exit codes: 0 ACCEPT, 3 REJECT, 2 ERROR.
`)
}

// authorityFlags binds the execution context that selects one exact issuance.
// Every field is required; there is no defaulting, because a defaulted trust
// decision is a decision nobody made.
type authorityFlags struct {
	repo         string
	repositoryID string
	stage        string
	authID       string
	digest       string
	fingerprint  string
	principal    string
	controlStore string
}

func bind(fs *flag.FlagSet) *authorityFlags {
	f := &authorityFlags{}
	fs.StringVar(&f.repo, "repo", "", "repository working tree root")
	fs.StringVar(&f.repositoryID, "repository-id", "", "control store repository id (derived from origin when omitted)")
	fs.StringVar(&f.stage, "stage", "", "stage slug")
	fs.StringVar(&f.authID, "authorization-id", "", "exact authorizationId to select")
	fs.StringVar(&f.digest, "expected-digest", "", "exact SHA-256 of the signed authorization bytes")
	fs.StringVar(&f.fingerprint, "signer-fingerprint", "", "expected Product Authority key fingerprint")
	fs.StringVar(&f.principal, "signer-principal", "", "allowed_signers principal")
	fs.StringVar(&f.controlStore, "control-store", "", "control store root")
	return f
}

func (f *authorityFlags) load() (authority.Authorization, *gitexec.Runner, error) {
	if f.repo == "" {
		return authority.Authorization{}, nil, fmt.Errorf("-repo is required")
	}
	git := gitexec.New(f.repo)
	repositoryID := f.repositoryID
	if repositoryID == "" {
		derived, err := git.RepositoryID()
		if err != nil {
			return authority.Authorization{}, nil, err
		}
		repositoryID = derived
	}
	auth := authority.Load(authority.Request{
		ControlStoreRoot: f.controlStore,
		RepositoryID:     repositoryID,
		StageSlug:        f.stage,
		AuthorizationID:  f.authID,
		ExpectedDigest:   f.digest,
		ExpectedSigner:   f.fingerprint,
		SignerPrincipal:  f.principal,
		RepositoryRoot:   f.repo,
		Git:              git,
	})
	return auth, git, nil
}

func cmdAuthorityVerify(args []string) int {
	fs := flag.NewFlagSet("authority-verify", flag.ContinueOnError)
	f := bind(fs)
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "authority-verify", "ERROR", err.Error())
	}
	auth, _, err := f.load()
	if err != nil {
		return emitReturn(exitError, "authority-verify", "ERROR", err.Error())
	}
	if !auth.Valid {
		return emitReturn(exitReject, "authority-verify", "REJECT", auth.Reason,
			jsonstrict.P("selection", jsonstrict.String(auth.Selection)),
			jsonstrict.P("path", jsonstrict.String(auth.Path)),
			jsonstrict.P("digest", jsonstrict.String(auth.Digest)))
	}
	return emitReturn(exitAccept, "authority-verify", "ACCEPT", auth.Reason, authorityMembers(auth)...)
}

func authorityMembers(auth authority.Authorization) []jsonstrict.Member {
	allowed := make([]*jsonstrict.Value, 0, len(auth.AllowedPaths))
	for _, p := range auth.AllowedPaths {
		allowed = append(allowed, jsonstrict.String(p))
	}
	protected := make([]*jsonstrict.Value, 0, len(auth.ProtectedPaths))
	for _, p := range auth.ProtectedPaths {
		protected = append(protected, jsonstrict.String(p))
	}
	return []jsonstrict.Member{
		jsonstrict.P("authorizationId", jsonstrict.String(auth.AuthorizationID)),
		jsonstrict.P("selection", jsonstrict.String(auth.Selection)),
		jsonstrict.P("path", jsonstrict.String(auth.Path)),
		jsonstrict.P("digest", jsonstrict.String(auth.Digest)),
		jsonstrict.P("repositoryId", jsonstrict.String(auth.RepositoryID)),
		jsonstrict.P("stageSlug", jsonstrict.String(auth.StageSlug)),
		jsonstrict.P("riskTier", jsonstrict.Int(auth.RiskTier)),
		jsonstrict.P("baselineCommit", jsonstrict.String(auth.BaselineCommit)),
		jsonstrict.P("lifecycleState", jsonstrict.String(auth.LifecycleState)),
		jsonstrict.P("signerFingerprint", jsonstrict.String(auth.SignerFingerprint)),
		jsonstrict.P("signerPrincipal", jsonstrict.String(auth.SignerPrincipal)),
		jsonstrict.P("signatureNamespace", jsonstrict.String(auth.SignatureNamespace)),
		jsonstrict.P("allowedPaths", jsonstrict.ArrayOf(allowed)),
		jsonstrict.P("protectedPaths", jsonstrict.ArrayOf(protected)),
	}
}

func cmdCandidateManifest(args []string) int {
	fs := flag.NewFlagSet("candidate-manifest", flag.ContinueOnError)
	f := bind(fs)
	out := fs.String("out", "", "write the canonical manifest bytes to this file")
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
	}
	auth, git, err := f.load()
	if err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
	}
	if !auth.Valid {
		return emitReturn(exitReject, "candidate-manifest", "REJECT", "authorization rejected: "+auth.Reason)
	}
	manifest, err := candidate.Build(git, auth)
	if err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
	}
	value := manifest.Value()
	if err := candidate.Validate(value); err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", "manifest failed its own contract: "+err.Error())
	}
	bytes, err := canonical.Marshal(value)
	if err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
	}
	if *out != "" {
		if err := os.WriteFile(*out, bytes, 0o600); err != nil {
			return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
		}
	}
	unauthorized, err := candidate.AuthorizedAgainst(value, auth)
	if err != nil {
		return emitReturn(exitError, "candidate-manifest", "ERROR", err.Error())
	}
	list := make([]*jsonstrict.Value, 0, len(unauthorized))
	for _, p := range unauthorized {
		list = append(list, jsonstrict.String(p))
	}
	members := []jsonstrict.Member{
		jsonstrict.P("candidateDigest", jsonstrict.String(manifest.CandidateDigest)),
		jsonstrict.P("baselineTree", jsonstrict.String(manifest.BaselineTree)),
		jsonstrict.P("candidateTree", jsonstrict.String(manifest.CandidateTree)),
		jsonstrict.P("entryCount", jsonstrict.Int(int64(len(manifest.Entries)))),
		jsonstrict.P("unauthorizedPaths", jsonstrict.ArrayOf(list)),
		jsonstrict.P("manifest", value),
	}
	if len(unauthorized) > 0 {
		return emitReturn(exitReject, "candidate-manifest", "REJECT",
			fmt.Sprintf("%d candidate path(s) are outside the signed authority", len(unauthorized)), members...)
	}
	return emitReturn(exitAccept, "candidate-manifest", "ACCEPT", "every candidate path is within the signed authority", members...)
}

type multiFlag []string

func (m *multiFlag) String() string     { return strings.Join(*m, ",") }
func (m *multiFlag) Set(v string) error { *m = append(*m, v); return nil }

func cmdPathCheck(args []string) int {
	fs := flag.NewFlagSet("path-check", flag.ContinueOnError)
	f := bind(fs)
	var paths multiFlag
	fs.Var(&paths, "path", "repository-relative path to check (repeatable)")
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "path-check", "ERROR", err.Error())
	}
	if len(paths) == 0 {
		return emitReturn(exitError, "path-check", "ERROR", "-path is required at least once")
	}
	auth, _, err := f.load()
	if err != nil {
		return emitReturn(exitError, "path-check", "ERROR", err.Error())
	}
	if !auth.Valid {
		return emitReturn(exitReject, "path-check", "REJECT", "authorization rejected: "+auth.Reason)
	}
	results := make([]*jsonstrict.Value, 0, len(paths))
	denied := 0
	for _, p := range paths {
		ok := auth.PathAuthorized(p)
		if !ok {
			denied++
		}
		results = append(results, jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String(p)),
			jsonstrict.P("authorized", jsonstrict.Bool(ok)),
		))
	}
	members := []jsonstrict.Member{jsonstrict.P("paths", jsonstrict.ArrayOf(results))}
	if denied > 0 {
		return emitReturn(exitReject, "path-check", "REJECT", fmt.Sprintf("%d path(s) are not authorized", denied), members...)
	}
	return emitReturn(exitAccept, "path-check", "ACCEPT", "every path is authorized", members...)
}

// cmdReleaseGate answers the only question that matters at release time: may
// THIS candidate be released?
//
// It recomputes the candidate rather than accepting one, so the answer is about
// the repository as it stands now and not about a digest someone typed. Every
// link in the chain is then checked against that recomputed identity.
func cmdReleaseGate(args []string) int {
	fs := flag.NewFlagSet("release-gate", flag.ContinueOnError)
	f := bind(fs)
	auditDigest := fs.String("audit-digest", "", "exact SHA-256 of the signed audit binding")
	releaseDigest := fs.String("release-digest", "", "exact SHA-256 of the signed release authorization")
	auditorPrincipal := fs.String("auditor-principal", "", "allowed_signers principal of the independent auditor")
	auditorFingerprint := fs.String("auditor-fingerprint", "", "expected auditor key fingerprint")
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "release-gate", "ERROR", err.Error())
	}
	auth, git, err := f.load()
	if err != nil {
		return emitReturn(exitError, "release-gate", "ERROR", err.Error())
	}
	if !auth.Valid {
		return emitReturn(exitReject, "release-gate", "REJECT", "authorization rejected: "+auth.Reason)
	}

	manifest, err := candidate.Build(git, auth)
	if err != nil {
		return emitReturn(exitError, "release-gate", "ERROR", err.Error())
	}
	value := manifest.Value()
	if err := candidate.Validate(value); err != nil {
		return emitReturn(exitError, "release-gate", "ERROR", "manifest failed its own contract: "+err.Error())
	}
	unauthorized, err := candidate.AuthorizedAgainst(value, auth)
	if err != nil {
		return emitReturn(exitError, "release-gate", "ERROR", err.Error())
	}
	members := []jsonstrict.Member{
		jsonstrict.P("candidateDigest", jsonstrict.String(manifest.CandidateDigest)),
		jsonstrict.P("entryCount", jsonstrict.Int(int64(len(manifest.Entries)))),
	}
	if len(unauthorized) > 0 {
		return emitReturn(exitReject, "release-gate", "REJECT",
			fmt.Sprintf("%d candidate path(s) are outside the signed authority", len(unauthorized)), members...)
	}

	request := authority.BindingRequest{
		ControlStoreRoot: f.controlStore,
		RepositoryID:     auth.RepositoryID,
		StageSlug:        auth.StageSlug,
		CandidateDigest:  manifest.CandidateDigest,
	}
	auditReq := request
	auditReq.ExpectedDigest = *auditDigest
	auditReq.ExpectedSigner = *auditorFingerprint
	auditReq.SignerPrincipal = *auditorPrincipal
	audit := authority.LoadAuditBinding(auditReq)
	members = append(members,
		jsonstrict.P("auditBindingDigest", jsonstrict.String(audit.Digest)),
		jsonstrict.P("auditVerdict", jsonstrict.String(audit.Verdict)),
		jsonstrict.P("auditorIdentity", jsonstrict.String(audit.AuditorIdentity)))
	if !audit.Valid {
		return emitReturn(exitReject, "release-gate", "REJECT", "audit binding: "+audit.Reason, members...)
	}

	releaseReq := request
	releaseReq.ExpectedDigest = *releaseDigest
	releaseReq.ExpectedSigner = f.fingerprint
	releaseReq.SignerPrincipal = f.principal
	release := authority.LoadReleaseAuthorization(releaseReq)
	members = append(members, jsonstrict.P("releaseAuthorizationDigest", jsonstrict.String(release.Digest)))
	if !release.Valid {
		return emitReturn(exitReject, "release-gate", "REJECT", "release authorization: "+release.Reason, members...)
	}

	binaryDigest, binaryErr := authority.SelfBinaryDigest()
	if binaryErr != nil {
		return emitReturn(exitError, "release-gate", "ERROR", binaryErr.Error(), members...)
	}
	members = append(members, jsonstrict.P("coreBinarySha256", jsonstrict.String(binaryDigest)))
	if err := authority.ReleaseChain(audit, release, manifest.CandidateDigest, binaryDigest); err != nil {
		return emitReturn(exitReject, "release-gate", "REJECT", "release chain: "+err.Error(), members...)
	}
	return emitReturn(exitAccept, "release-gate", "ACCEPT",
		fmt.Sprintf("candidate %s carries a PASS audit binding and a Product Authority release authorization over that exact audit",
			manifest.CandidateDigest), members...)
}

func cmdLifecycleCheck(args []string) int {
	fs := flag.NewFlagSet("lifecycle-check", flag.ContinueOnError)
	from := fs.String("from", "", "current lifecycle state")
	to := fs.String("to", "", "requested lifecycle state")
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "lifecycle-check", "ERROR", err.Error())
	}
	if err := lifecycle.Transition(lifecycle.State(*from), lifecycle.State(*to)); err != nil {
		return emitReturn(exitReject, "lifecycle-check", "REJECT", err.Error())
	}
	return emitReturn(exitAccept, "lifecycle-check", "ACCEPT", fmt.Sprintf("%s transitions to %s", *from, *to))
}

func cmdCanonicalDigest(args []string) int {
	fs := flag.NewFlagSet("canonical-digest", flag.ContinueOnError)
	file := fs.String("file", "", "file to read")
	if err := fs.Parse(args); err != nil {
		return emitReturn(exitError, "canonical-digest", "ERROR", err.Error())
	}
	raw, err := os.ReadFile(*file)
	if err != nil {
		return emitReturn(exitError, "canonical-digest", "ERROR", err.Error())
	}
	members := []jsonstrict.Member{jsonstrict.P("digest", jsonstrict.String(canonical.Digest(raw)))}
	reserialized, err := canonical.Reserialize(raw)
	if err != nil {
		return emitReturn(exitReject, "canonical-digest", "REJECT", "file is not strict JSON: "+err.Error(), members...)
	}
	members = append(members, jsonstrict.P("canonical", jsonstrict.Bool(string(reserialized) == string(raw))))
	if string(reserialized) != string(raw) {
		return emitReturn(exitReject, "canonical-digest", "REJECT", "file is valid JSON but is not in canonical form", members...)
	}
	return emitReturn(exitAccept, "canonical-digest", "ACCEPT", "file is canonical", members...)
}

// emitReturn prints one machine-readable verdict and returns the exit code.
//
// Output is canonical JSON on stdout. A caller parses it; nothing here prints a
// sentence that a caller is expected to pattern-match, because matching English
// is how a verifier ends up trusting a message instead of a result.
func emitReturn(code int, command, verdict, reason string, extra ...jsonstrict.Member) int {
	members := []jsonstrict.Member{
		jsonstrict.P("core", jsonstrict.String(Version)),
		jsonstrict.P("command", jsonstrict.String(command)),
		jsonstrict.P("verdict", jsonstrict.String(verdict)),
		jsonstrict.P("reason", jsonstrict.String(reason)),
	}
	members = append(members, extra...)
	value, err := jsonstrict.Object(members...)
	if err != nil {
		fmt.Fprintln(os.Stderr, "internal: "+err.Error())
		return exitError
	}
	out, err := canonical.Marshal(value)
	if err != nil {
		fmt.Fprintln(os.Stderr, "internal: "+err.Error())
		return exitError
	}
	os.Stdout.Write(out)
	os.Stdout.Write([]byte("\n"))
	return code
}

func emit(code int, command, verdict, reason string, extra ...jsonstrict.Member) {
	os.Exit(emitReturn(code, command, verdict, reason, extra...))
}
