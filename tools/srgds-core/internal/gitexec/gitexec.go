// Package gitexec runs Git and fails closed.
//
// An audit forced `git ls-files` and `git hash-object` to exit non-zero and the
// previous implementation read "non-zero with no stdout" as a valid EMPTY
// RESULT, and "non-zero with partial stdout" as a valid partial result. A tool
// that cannot run must never look like a repository with nothing in it, because
// a candidate with nothing in it is a candidate that changed nothing, and that
// is precisely the answer an attacker wants.
//
// Two further rules follow from the same audit:
//
//   - Output is bytes, never decoded text. Machine-readable Git output is
//     NUL-delimited and contains raw path bytes; decoding it through a console
//     code page corrupts object ids, modes and non-ASCII paths.
//   - Human-readable porcelain is never parsed. The root cause of the original
//     path corruption was trimming display text: " M sample.txt" became
//     "M sample.txt", and a fixed-offset substring then yielded "ample.txt".
package gitexec

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// ===========================================================================
// GOVERNED GIT EXECUTABLE IDENTITY
//
// PATH IS NOT AUTHORITY.
//
// An audit sanitized every Git environment variable and still substituted the
// candidate. The reason is that sanitizing the ENVIRONMENT says nothing about
// WHICH EXECUTABLE receives it: this package resolved "git" through ambient
// PATH, so a wrapper placed earlier in PATH received the carefully sanitized
// environment, reintroduced GIT_WORK_TREE, invoked the real Git, and returned a
// substituted candidate that the core ACCEPTED.
//
// The boundary is therefore not "clean environment" but:
//
//	explicit executable identity + direct invocation
//	+ sanitized environment + explicit Git configuration
//
// The values below are OBSERVED FACTS about the governed workstation, measured
// rather than assumed, and recorded in docs/build/SRGDS-CORE-BUILD-CONTRACT.md.
// Upgrading Git is expected to require updating them: that is the point. A
// change of the executable that decides candidate identity is a change that
// must be noticed, and because the pins live in the core's own source, changing
// them changes the core binary's SHA-256 - which the audit binding is bound to.
const (
	// GovernedGitExecutable is the absolute path of the Git this core runs.
	GovernedGitExecutable = `C:\Program Files\Git\cmd\git.exe`
	// GovernedGitVersion is the exact `git --version` output required.
	GovernedGitVersion = "git version 2.52.0.windows.1"
	// GovernedGitSHA256 is the SHA-256 of the executable at that path.
	GovernedGitSHA256 = "3CBD024D9D11EF08BD6A0CB5A973613C50825B4952BC6006F3F4222F436091E5"
)

// Runner executes Git against one repository.
type Runner struct {
	// Repo is the working tree root.
	Repo string
	// Git is the ABSOLUTE path of the Git executable. Empty means the governed
	// executable. It is never a bare name, and it is never resolved by
	// searching PATH.
	Git string
	// Config carries additional -c settings appended to the candidate-byte
	// contract, for settings whose value is only known at run time - such as
	// the path of a GDS-controlled empty attributes file.
	Config []string
	// SkipVerification is for the package's own tests, which must be able to
	// point at a deliberately wrong executable to prove it is REFUSED. It is
	// unexported so no other package - and no command line - can set it.
	skipVerification bool
}

// New returns a Runner for a repository root.
func New(repo string) *Runner { return &Runner{Repo: repo} }

// With returns a copy of the Runner carrying additional -c settings. The
// original is unchanged, so a caller cannot widen another caller's contract.
func (r *Runner) With(config ...string) *Runner {
	next := &Runner{Repo: r.Repo, Git: r.Git, skipVerification: r.skipVerification}
	next.Config = append(append([]string(nil), r.Config...), config...)
	return next
}

// exe returns the ABSOLUTE executable path. There is no bare-name branch, so
// there is nothing for PATH to resolve.
func (r *Runner) exe() string {
	if r.Git == "" {
		return GovernedGitExecutable
	}
	return r.Git
}

var (
	verifiedMu    sync.Mutex
	verifiedPaths = map[string]error{}
)

// VerifyExecutable establishes the identity of the Git that will run.
//
// Checked in this order, so each failure names its own cause:
//
//	absolute      a relative path is resolved against a working directory, and
//	              this must not depend on where the process happens to be
//	regular file  a directory or device is not an executable
//	version       run THROUGH THAT EXACT PATH, never through PATH resolution,
//	              because a PATH-resolved binary must not be able to vouch for
//	              the pinned one
//	digest        the bytes are the audited bytes
//
// Results are cached per path: the version check spawns a process, and this
// runs before every authority-sensitive invocation.
func (r *Runner) VerifyExecutable() error {
	if r.skipVerification {
		return nil
	}
	path := r.exe()

	verifiedMu.Lock()
	cached, seen := verifiedPaths[path]
	verifiedMu.Unlock()
	if seen {
		return cached
	}

	err := verifyGitExecutable(path)

	verifiedMu.Lock()
	verifiedPaths[path] = err
	verifiedMu.Unlock()
	return err
}

func verifyGitExecutable(path string) error {
	if !filepath.IsAbs(path) {
		return fmt.Errorf("governed Git executable %q is not an absolute path; PATH is not authority", path)
	}
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("governed Git executable %q is unavailable: %w", path, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("governed Git executable %q is not a regular file", path)
	}

	// Executed through the exact path, with a controlled environment, and NOT
	// through a shell: no cmd.exe, no PowerShell, no shell association, no
	// PATHEXT resolution.
	cmd := exec.Command(path, "--version")
	cmd.Env = controlledEnv(os.Environ(), nil)
	out, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("governed Git executable %q would not report its version: %w", path, err)
	}
	version := strings.TrimSpace(string(out))
	if version != GovernedGitVersion {
		return fmt.Errorf("governed Git executable %q reports %q, not the contracted %q", path, version, GovernedGitVersion)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("governed Git executable %q could not be read for hashing: %w", path, err)
	}
	sum := sha256.Sum256(raw)
	digest := strings.ToUpper(hex.EncodeToString(sum[:]))
	if digest != GovernedGitSHA256 {
		return fmt.Errorf("governed Git executable %q is SHA-256 %s, not the contracted %s", path, digest, GovernedGitSHA256)
	}
	return nil
}

// GovernedGitIdentity reports the verified executable, for the version command
// and for the record an auditor keeps.
func GovernedGitIdentity() (path, version, digest string, err error) {
	r := &Runner{}
	if err := r.VerifyExecutable(); err != nil {
		return r.exe(), "", "", err
	}
	return r.exe(), GovernedGitVersion, GovernedGitSHA256, nil
}

// CandidateByteContract is the complete Git configuration under which candidate
// identity is defined. It is passed on EVERY invocation, so the answer does not
// depend on system, global, or repository-local configuration anywhere.
//
// This is not defensive tidiness. Git for Windows ships a SYSTEM-level
// core.autocrlf=true, so a fresh clone silently checks out CRLF while a governed
// repository pins false. `git status` in that clone still reports clean, because
// it applies the same normalization when it compares - so the corruption is
// invisible to the obvious check and only appears as unexplained candidate
// drift. An audit reproduced exactly that: 36 entries and a different digest in
// a clone of an identical tree.
//
//	core.excludesFile=   a personal global ignore file cannot hide a change
//	core.autocrlf=false  content identity never depends on a checkout setting
//	core.eol=lf          the same, for files .gitattributes marks as text
//	core.filemode=false  Windows cannot express the executable bit in the
//	                     worktree; mode intent lives in the index
//	core.symlinks=false  a symlink is content, not a followed link
var CandidateByteContract = []string{
	"core.excludesFile=",
	"core.autocrlf=false",
	"core.eol=lf",
	"core.filemode=false",
	"core.symlinks=false",
}

// baseArgs pins the candidate-byte contract for one invocation.
func (r *Runner) baseArgs(args []string) []string {
	all := make([]string, 0, (len(CandidateByteContract)+len(r.Config))*2+2+len(args))
	for _, setting := range CandidateByteContract {
		all = append(all, "-c", setting)
	}
	for _, setting := range r.Config {
		all = append(all, "-c", setting)
	}
	all = append(all, "-C", r.Repo)
	return append(all, args...)
}

// contractEnv is applied to every invocation.
//
// GIT_ATTR_NOSYSTEM disables the SYSTEM gitattributes file, which no -c setting
// can reach. Without it, a machine-wide attributes file can assign `text`,
// `eol` or a `filter` to paths in a governed repository, and the bytes entering
// the candidate change because of something installed on the workstation.
//
// The remaining variables stop Git from consulting per-user identity or hooks
// state that could otherwise run code during an operation this core performs.
var contractEnv = map[string]string{
	"GIT_ATTR_NOSYSTEM":   "1",
	"GIT_TERMINAL_PROMPT": "0",
	"GIT_OPTIONAL_LOCKS":  "0",
}

// repositoryLocalEnv is the set Git itself reports through
// `git rev-parse --local-env-vars`. Every one of these variables can redirect
// repository discovery, the worktree, the index, the object store, refs, or
// command-scoped configuration. None is execution context supplied by the
// Product Authority, so none may be inherited from the caller.
//
// A Tier-3 audit set GIT_WORK_TREE to an empty directory and the old runner
// accepted a five-entry candidate while silently omitting all 25 untracked
// additions from the real worktree. `-C <repo>` does not neutralize these
// variables. They must be removed from the child environment before the
// workspace's explicit GIT_INDEX_FILE and object-store values are appended.
var repositoryLocalEnv = map[string]struct{}{
	"GIT_ALTERNATE_OBJECT_DIRECTORIES": {},
	"GIT_CONFIG":                       {},
	"GIT_CONFIG_PARAMETERS":            {},
	"GIT_CONFIG_COUNT":                 {},
	"GIT_OBJECT_DIRECTORY":             {},
	"GIT_DIR":                          {},
	"GIT_WORK_TREE":                    {},
	"GIT_IMPLICIT_WORK_TREE":           {},
	"GIT_GRAFT_FILE":                   {},
	"GIT_INDEX_FILE":                   {},
	"GIT_NO_REPLACE_OBJECTS":           {},
	"GIT_REPLACE_REF_BASE":             {},
	"GIT_PREFIX":                       {},
	"GIT_SHALLOW_FILE":                 {},
	"GIT_COMMON_DIR":                   {},
}

// Result is one completed Git invocation.
type Result struct {
	ExitCode int
	Stdout   []byte
	Stderr   []byte
}

// Run executes Git and returns the result WITHOUT judging the exit code. It
// exists for the few callers that legitimately interpret an exit code
// themselves; every such caller checks. A failure to start is reported as an
// error, never as an exit code of zero.
func (r *Runner) Run(env map[string]string, args ...string) (*Result, error) {
	// Identity before use. A failure here is fatal, never a fallback: there is
	// no PATH search to fall back to, by design.
	if err := r.VerifyExecutable(); err != nil {
		return nil, err
	}
	cmd := exec.Command(r.exe(), r.baseArgs(args)...)
	cmd.Dir = r.Repo
	cmd.Env = controlledEnv(cmd.Environ(), env)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	err := cmd.Run()
	res := &Result{Stdout: out.Bytes(), Stderr: errBuf.Bytes()}
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			res.ExitCode = exit.ExitCode()
			return res, nil
		}
		// Could not start, was killed by a signal, or the executable is
		// missing. There is no exit code to interpret, so this is an error.
		return nil, fmt.Errorf("git %s could not run: %w", strings.Join(args, " "), err)
	}
	res.ExitCode = 0
	return res, nil
}

// RunInput executes Git with stdin supplied, for the plumbing commands that
// take a stream of records. It exists so a large batch is one process rather
// than one process per path: candidate construction hashes every worktree file,
// and doing that individually would be both slow and far more places for a
// partial failure to hide.
func (r *Runner) RunInput(env map[string]string, stdin string, args ...string) (*Result, error) {
	if err := r.VerifyExecutable(); err != nil {
		return nil, err
	}
	cmd := exec.Command(r.exe(), r.baseArgs(args)...)
	cmd.Dir = r.Repo
	cmd.Env = controlledEnv(cmd.Environ(), env)
	cmd.Stdin = strings.NewReader(stdin)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	err := cmd.Run()
	res := &Result{Stdout: out.Bytes(), Stderr: errBuf.Bytes()}
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			res.ExitCode = exit.ExitCode()
			return res, nil
		}
		return nil, fmt.Errorf("git %s could not run: %w", strings.Join(args, " "), err)
	}
	return res, nil
}

// Checked executes Git and treats any non-zero exit as an error.
func (r *Runner) Checked(env map[string]string, args ...string) ([]byte, error) {
	res, err := r.Run(env, args...)
	if err != nil {
		return nil, err
	}
	if res.ExitCode != 0 {
		return nil, fmt.Errorf("git %s failed with exit %d; refusing to treat failure as an empty result: %s",
			strings.Join(args, " "), res.ExitCode, strings.TrimSpace(string(res.Stderr)))
	}
	return res.Stdout, nil
}

// RequiredLine executes Git and returns the single line of output the caller
// requires. Absent output where output is required is an error, not "".
func (r *Runner) RequiredLine(env map[string]string, args ...string) (string, error) {
	out, err := r.Checked(env, args...)
	if err != nil {
		return "", err
	}
	lines := Lines(out)
	if len(lines) < 1 {
		return "", fmt.Errorf("git %s produced no output where one line is required", strings.Join(args, " "))
	}
	return lines[0], nil
}

// Lines splits output on newlines and drops empty entries.
func Lines(out []byte) []string {
	text := strings.ReplaceAll(string(out), "\r\n", "\n")
	var kept []string
	for _, line := range strings.Split(text, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			kept = append(kept, trimmed)
		}
	}
	return kept
}

// SplitNUL splits NUL-delimited output.
//
// Records are returned exactly as Git emitted them, with no trimming: a path
// may legitimately begin or end with a space, and trimming one would silently
// rename it.
func SplitNUL(out []byte) []string {
	if len(out) == 0 {
		return nil
	}
	// Only a trailing newline is incidental. Interior bytes are content.
	trimmed := bytes.TrimRight(out, "\r\n")
	if len(trimmed) == 0 {
		return nil
	}
	var kept []string
	for _, rec := range bytes.Split(trimmed, []byte{0}) {
		if len(rec) > 0 {
			kept = append(kept, string(rec))
		}
	}
	return kept
}

// controlledEnv builds the environment for a Git subprocess.
//
// cmd.Environ(), NOT os.Environ(), is the base. On Windows the per-drive
// working directory is carried in hidden "=C:" entries, and Go synthesizes the
// one implied by cmd.Dir. Those entries must survive. Repository-local Git
// variables and keys explicitly owned by the contract are removed
// case-insensitively, then the contract and caller workspace values are
// appended exactly once.
func controlledEnv(base []string, env map[string]string) []string {
	merged := make(map[string]string, len(env)+len(contractEnv))
	for key, value := range contractEnv {
		merged[key] = value
	}
	for key, value := range env {
		merged[key] = value
	}

	replaced := make(map[string]struct{}, len(merged))
	for key := range merged {
		replaced[strings.ToUpper(key)] = struct{}{}
	}

	out := make([]string, 0, len(base)+len(merged))
	for _, entry := range base {
		key := strings.ToUpper(environmentName(entry))
		_, local := repositoryLocalEnv[key]
		_, owned := replaced[key]
		// GIT_CONFIG_COUNT activates this numbered family. Remove the inert
		// entries too, so no future caller can accidentally reactivate ambient
		// command-scoped configuration by supplying only a count.
		numberedConfig := strings.HasPrefix(key, "GIT_CONFIG_KEY_") ||
			strings.HasPrefix(key, "GIT_CONFIG_VALUE_")
		if local || owned || numberedConfig {
			continue
		}
		out = append(out, entry)
	}
	return append(out, flatten(merged)...)
}

func environmentName(entry string) string {
	// Windows per-drive entries have the form "=C:=C:\\path". Their name
	// ends at the second equals sign, not the first.
	start := 0
	if strings.HasPrefix(entry, "=") {
		start = 1
	}
	if index := strings.IndexByte(entry[start:], '='); index >= 0 {
		return entry[:start+index]
	}
	return entry
}

func flatten(env map[string]string) []string {
	keys := make([]string, 0, len(env))
	for key := range env {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	out := make([]string, 0, len(keys))
	for _, key := range keys {
		out = append(out, key+"="+env[key])
	}
	return out
}

// HeadCommit returns the resolved HEAD commit id.
func (r *Runner) HeadCommit() (string, error) {
	return r.RequiredLine(nil, "rev-parse", "HEAD")
}

// AbsoluteGitDir returns the repository's .git directory.
func (r *Runner) AbsoluteGitDir() (string, error) {
	return r.RequiredLine(nil, "rev-parse", "--absolute-git-dir")
}

// RepositoryID derives the control-store key from the origin remote.
//
// The identity of a repository is where it came from, not where it happens to
// be checked out: a copy of the working tree at another path is the same
// governed repository, and must resolve to the same signed authority.
func (r *Runner) RepositoryID() (string, error) {
	url, err := r.RequiredLine(nil, "remote", "get-url", "origin")
	if err != nil {
		return "", err
	}
	id := strings.TrimSuffix(strings.TrimSpace(url), ".git")
	id = strings.TrimPrefix(id, "https://")
	id = strings.TrimPrefix(id, "http://")
	id = strings.TrimPrefix(id, "git@")
	id = strings.ReplaceAll(id, ":", "/")
	return strings.ReplaceAll(id, "/", "-"), nil
}
