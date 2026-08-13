package candidate

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"sourceroot.local/srgds-core/internal/authority"
	"sourceroot.local/srgds-core/internal/canonical"
	"sourceroot.local/srgds-core/internal/gitexec"
	"sourceroot.local/srgds-core/internal/jsonstrict"
)

type repo struct {
	t        *testing.T
	dir      string
	git      *gitexec.Runner
	baseline string
}

func newRepo(t *testing.T) *repo {
	t.Helper()
	if _, err := os.Stat(gitexec.GovernedGitExecutable); err != nil {
		t.Skipf("the governed Git executable is not installed: %v", err)
	}
	dir := t.TempDir()
	r := &repo{t: t, dir: dir, git: gitexec.New(dir)}
	r.run("init", "-q")
	r.run("config", "user.email", "core@test")
	r.run("config", "user.name", "core")
	r.run("remote", "add", "origin", "https://github.com/OneMarket-News/dictionaryhub.git")
	for _, name := range []string{"a.txt", "b.txt", "exec.sh"} {
		r.write(name, "base")
	}
	r.write("backend/db/migrations/001_init.sql", "-- base")
	r.run("add", "-A")
	r.run("commit", "-q", "-m", "base")
	head, err := r.git.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}
	r.baseline = head
	return r
}

func (r *repo) run(args ...string) {
	r.t.Helper()
	// Fixture setup uses the governed executable, not PATH.
	cmd := exec.Command(gitexec.GovernedGitExecutable, append([]string{"-C", r.dir}, args...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		r.t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func (r *repo) write(name, content string) {
	r.t.Helper()
	full := filepath.Join(r.dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		r.t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		r.t.Fatal(err)
	}
}

func (r *repo) remove(name string) {
	r.t.Helper()
	if err := os.Remove(filepath.Join(r.dir, filepath.FromSlash(name))); err != nil {
		r.t.Fatal(err)
	}
}

func (r *repo) auth() authority.Authorization {
	return authority.Authorization{
		Valid:          true,
		Digest:         strings.Repeat("A", 64),
		StageSlug:      "SOURCEROOT-TEST-STAGE-V1",
		BaselineCommit: r.baseline,
		AllowedPaths:   []string{"a.txt", "b.txt", "backend/db/migrations/001_init.sql", "exec.sh", "n2.txt", "new.txt", "renamed.txt"},
	}
}

func (r *repo) manifest() *Manifest {
	r.t.Helper()
	m, err := Build(r.git, r.auth())
	if err != nil {
		r.t.Fatalf("Build: %v", err)
	}
	return m
}

func (m *Manifest) entry(path string) *Entry {
	for i := range m.Entries {
		if m.Entries[i].Path == path {
			return &m.Entries[i]
		}
	}
	return nil
}

func sha256Of(s string) string {
	sum := sha256.Sum256([]byte(s))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func deref(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

// ===========================================================================
// ORIGINAL F3 / G2. The previous model synthesized each entry from a filesystem
// digest, a staged object and a worktree object at once, and the result did not
// describe any single repository state. Each case below is one of the mixed
// states that exposed it.
// ===========================================================================

func TestStagedValueWithDifferentWorktreeValue(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "STAGED")
	r.run("add", "a.txt")
	r.write("a.txt", "WORKTREE")

	m := r.manifest()
	e := m.entry("a.txt")
	if e == nil {
		t.Fatal("a.txt is absent from the candidate")
	}
	if e.Change != "modify" {
		t.Errorf("change = %s", e.Change)
	}
	// The bound bytes are the FINAL worktree bytes, and the object id and the
	// digest describe the same content.
	if deref(e.Sha256) != sha256Of("WORKTREE") {
		t.Errorf("sha256 does not describe the worktree bytes: %s", deref(e.Sha256))
	}
	if e.GitObject == nil || e.Mode == nil {
		t.Fatal("candidate identity is incomplete")
	}
}

func TestStagedThenRevertedToBaseline(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "STAGED")
	r.run("add", "a.txt")
	r.write("a.txt", "base")

	if e := r.manifest().entry("a.txt"); e != nil {
		t.Errorf("a reverted file is reported as %s; no stale staged content may survive", e.Change)
	}
}

func TestStagedAdditionDeletedInWorktree(t *testing.T) {
	r := newRepo(t)
	r.write("new.txt", "x")
	r.run("add", "new.txt")
	r.remove("new.txt")

	if e := r.manifest().entry("new.txt"); e != nil {
		t.Errorf("a file that does not exist is reported as %s", e.Change)
	}
}

func TestStagedDeletionRecreatedInWorktree(t *testing.T) {
	r := newRepo(t)
	r.run("rm", "-q", "--cached", "b.txt")
	r.remove("b.txt")
	r.write("b.txt", "RECREATED")

	e := r.manifest().entry("b.txt")
	if e == nil {
		t.Fatal("b.txt is absent")
	}
	if e.Change != "modify" || deref(e.Sha256) != sha256Of("RECREATED") {
		t.Errorf("change=%s sha256=%s", e.Change, deref(e.Sha256))
	}
}

func TestStagedAdditionThenUnstagedEdit(t *testing.T) {
	r := newRepo(t)
	r.write("n2.txt", "FIRST")
	r.run("add", "n2.txt")
	r.write("n2.txt", "SECOND")

	m := r.manifest()
	count := 0
	for _, e := range m.Entries {
		if e.Path == "n2.txt" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("n2.txt appears %d times", count)
	}
	e := m.entry("n2.txt")
	if e.Change != "add" || deref(e.Sha256) != sha256Of("SECOND") {
		t.Errorf("change=%s sha256=%s", e.Change, deref(e.Sha256))
	}
	if e.BaselineObject != nil || e.BaselineMode != nil {
		t.Error("an add bound a baseline side")
	}
}

func TestStagedModeOnlyChange(t *testing.T) {
	r := newRepo(t)
	// A Windows worktree cannot express the executable bit, so this intent
	// exists only in the index. Copying the real index is what preserves it.
	r.run("update-index", "--chmod=+x", "exec.sh")

	e := r.manifest().entry("exec.sh")
	if e == nil {
		t.Fatal("a mode-only change is invisible in the candidate")
	}
	if deref(e.Mode) != "100755" {
		t.Errorf("mode = %s, want 100755", deref(e.Mode))
	}
	if deref(e.BaselineMode) != "100644" {
		t.Errorf("baseline mode = %s, want 100644", deref(e.BaselineMode))
	}
}

func TestStagedModeWithUnstagedEdit(t *testing.T) {
	r := newRepo(t)
	r.run("update-index", "--chmod=+x", "exec.sh")
	r.write("exec.sh", "EDITED")

	m := r.manifest()
	e := m.entry("exec.sh")
	if e == nil {
		t.Fatal("exec.sh is absent")
	}
	if deref(e.Mode) != "100755" {
		t.Errorf("intended mode was lost: %s", deref(e.Mode))
	}
	if deref(e.Sha256) != sha256Of("EDITED") {
		t.Errorf("final bytes were lost: %s", deref(e.Sha256))
	}

	// Same bytes, different mode, different identity.
	withExec := m.CandidateDigest
	r.run("update-index", "--chmod=-x", "exec.sh")
	withoutExec := r.manifest().CandidateDigest
	if withExec == withoutExec {
		t.Error("a mode change did not change the candidate digest")
	}
}

func TestCleanTreeYieldsEmptyCandidate(t *testing.T) {
	r := newRepo(t)
	m := r.manifest()
	if len(m.Entries) != 0 {
		t.Errorf("a clean tree produced %d entries", len(m.Entries))
	}
	if m.BaselineTree != m.CandidateTree {
		t.Errorf("a clean tree produced different trees: %s vs %s", m.BaselineTree, m.CandidateTree)
	}
	if len(m.MigrationIdentity) != 0 {
		t.Error("a clean tree produced migration identity")
	}
}

// A rename is DELETE + ADD. Rename detection is a similarity heuristic, and a
// heuristic that decides which two paths are the same file is not a judgement
// this system makes on a governance record.
func TestRenameIsDeleteAndAdd(t *testing.T) {
	r := newRepo(t)
	r.run("mv", "b.txt", "renamed.txt")

	m := r.manifest()
	deleted := m.entry("b.txt")
	added := m.entry("renamed.txt")
	if deleted == nil || added == nil {
		t.Fatalf("rename produced %d entries", len(m.Entries))
	}
	if deleted.Change != "delete" || added.Change != "add" {
		t.Errorf("rename produced %s and %s", deleted.Change, added.Change)
	}
	// A delete carries no candidate identity and binds what was removed.
	if deleted.Mode != nil || deleted.GitObject != nil || deleted.Sha256 != nil {
		t.Error("a delete carried candidate identity")
	}
	if deref(deleted.BaselineObject) == "<nil>" || deref(deleted.BaselineMode) != "100644" {
		t.Errorf("a delete did not bind its baseline: %s / %s", deref(deleted.BaselineObject), deref(deleted.BaselineMode))
	}
	// No pseudo-path anywhere.
	for _, e := range m.Entries {
		if strings.Contains(e.Path, "->") {
			t.Errorf("entry path is a rename pseudo-path: %q", e.Path)
		}
	}
}

func TestDeleteBindsBaseline(t *testing.T) {
	r := newRepo(t)
	r.remove("a.txt")

	e := r.manifest().entry("a.txt")
	if e == nil || e.Change != "delete" {
		t.Fatal("a worktree deletion is not recorded as a delete")
	}
	if deref(e.BaselineObject) == "<nil>" {
		t.Error("a delete did not identify what was removed")
	}
}

func TestMigrationIdentityIsRecorded(t *testing.T) {
	r := newRepo(t)
	r.write("backend/db/migrations/001_init.sql", "-- CHANGED")

	m := r.manifest()
	if len(m.MigrationIdentity) != 1 {
		t.Fatalf("migration identity has %d entries", len(m.MigrationIdentity))
	}
	mig := m.MigrationIdentity[0]
	if mig.Path != "backend/db/migrations/001_init.sql" || mig.Change != "modify" {
		t.Errorf("migration identity = %+v", mig)
	}
	if deref(mig.Sha256) != sha256Of("-- CHANGED") {
		t.Errorf("migration digest does not describe the file: %s", deref(mig.Sha256))
	}
}

// ===========================================================================
// Determinism and the read-only guarantee
// ===========================================================================

func TestCandidateDigestDeterminismAndRestoration(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")

	first := r.manifest().CandidateDigest
	for i := 0; i < 3; i++ {
		if next := r.manifest().CandidateDigest; next != first {
			t.Fatalf("digest changed between identical runs: %s then %s", first, next)
		}
	}

	// Mutation changes the digest.
	r.write("a.txt", "CHANGED AGAIN")
	mutated := r.manifest().CandidateDigest
	if mutated == first {
		t.Error("a content change did not change the candidate digest")
	}

	// EXACT restoration restores the digest. This is what makes the digest an
	// identity rather than a timestamp.
	r.write("a.txt", "CHANGED")
	if restored := r.manifest().CandidateDigest; restored != first {
		t.Errorf("restoring the exact bytes produced %s, want %s", restored, first)
	}
}

// The candidate identity is a statement about Runner.Repo, not about ambient
// Git routing supplied by the host process. A Tier-3 audit proved that an
// inherited GIT_WORK_TREE could previously hide every untracked addition while
// leaving an apparently authorized candidate. Exercise the full Build boundary
// so that sanitizing only a subset of the candidate's Git calls cannot pass.
func TestBuildIgnoresAmbientGitRepositoryRouting(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.write("new.txt", "NEW")
	want := r.manifest()

	hostile := t.TempDir()
	for key, value := range map[string]string{
		"GIT_WORK_TREE":        hostile,
		"GIT_DIR":              filepath.Join(hostile, "fake-git-dir"),
		"GIT_COMMON_DIR":       filepath.Join(hostile, "fake-common-dir"),
		"GIT_INDEX_FILE":       filepath.Join(hostile, "fake-index"),
		"GIT_OBJECT_DIRECTORY": filepath.Join(hostile, "fake-objects"),
		"GIT_CONFIG":           filepath.Join(hostile, "fake-config"),
		"GIT_CONFIG_COUNT":     "1",
		"GIT_CONFIG_KEY_0":     "core.bare",
		"GIT_CONFIG_VALUE_0":   "true",
	} {
		t.Setenv(key, value)
	}

	got := r.manifest()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ambient Git repository routing changed candidate identity:\nwant %#v\n got %#v", want, got)
	}
}

// Computing a candidate must not modify the repository in any way. The earlier
// implementation wrote new blobs and trees into the repository's own object
// database on every manifest, leaving unreferenced loose objects behind.
func TestBuildIsReadOnly(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.write("brand-new.txt", "content that has never been hashed")

	gitDir := filepath.Join(r.dir, ".git")
	indexBefore, err := os.ReadFile(filepath.Join(gitDir, "index"))
	if err != nil {
		t.Fatal(err)
	}
	objectsBefore := countFiles(t, filepath.Join(gitDir, "objects"))
	headBefore, _ := os.ReadFile(filepath.Join(gitDir, "HEAD"))
	refsBefore := countFiles(t, filepath.Join(gitDir, "refs"))
	statusBefore := r.status()

	if _, err := Build(r.git, r.auth()); err != nil {
		// brand-new.txt is outside the authorization, which is a manifest-level
		// verdict, not a build failure.
		t.Fatalf("Build: %v", err)
	}

	indexAfter, _ := os.ReadFile(filepath.Join(gitDir, "index"))
	if string(indexBefore) != string(indexAfter) {
		t.Error("the canonical index was modified")
	}
	if after := countFiles(t, filepath.Join(gitDir, "objects")); after != objectsBefore {
		t.Errorf("the object database grew from %d to %d entries", objectsBefore, after)
	}
	headAfter, _ := os.ReadFile(filepath.Join(gitDir, "HEAD"))
	if string(headBefore) != string(headAfter) {
		t.Error("HEAD was modified")
	}
	if after := countFiles(t, filepath.Join(gitDir, "refs")); after != refsBefore {
		t.Error("refs were modified")
	}
	if r.status() != statusBefore {
		t.Error("the working tree status changed")
	}
}

func (r *repo) status() string {
	r.t.Helper()
	out, err := r.git.Run(nil, "status", "--porcelain", "--untracked-files=all")
	if err != nil || out.ExitCode != 0 {
		r.t.Fatalf("status: %v", err)
	}
	return string(out.Stdout)
}

func countFiles(t *testing.T, root string) int {
	t.Helper()
	count := 0
	filepath.Walk(root, func(_ string, info os.FileInfo, err error) error {
		if err == nil && info != nil && !info.IsDir() {
			count++
		}
		return nil
	})
	return count
}

func TestWorkspaceIsRemoved(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")

	trees, ws, err := BuildTrees(r.git, r.baseline)
	if err != nil {
		t.Fatal(err)
	}
	dir := ws.Dir
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("workspace does not exist while in use: %v", err)
	}
	if trees.BaselineTree == trees.CandidateTree {
		t.Error("a modified tree matched the baseline")
	}
	ws.Close()
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("workspace survived Close: %v", err)
	}
	ws.Close() // idempotent

	// A failed build leaves nothing behind either.
	before := countTempWorkspaces(t)
	if _, _, err := BuildTrees(r.git, strings.Repeat("0", 40)); err == nil {
		t.Error("BuildTrees accepted a baseline that is not HEAD")
	}
	if after := countTempWorkspaces(t); after != before {
		t.Errorf("a failed build leaked a workspace: %d then %d", before, after)
	}
}

func countTempWorkspaces(t *testing.T) int {
	t.Helper()
	entries, err := os.ReadDir(os.TempDir())
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "gds-candidate-") {
			count++
		}
	}
	return count
}

// ORIGINAL F4, at the candidate layer: identity may only be derived on the
// signed baseline.
func TestWrongBaselineRefused(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.run("add", "-A")
	r.run("commit", "-q", "-m", "moved on")

	if _, _, err := BuildTrees(r.git, r.baseline); err == nil {
		t.Fatal("a candidate was built on a descendant of the signed baseline")
	}
	auth := r.auth() // still names the old baseline
	if _, err := Build(r.git, auth); err == nil {
		t.Fatal("Build accepted a moved HEAD")
	}
}

func TestInvalidAuthorizationRefused(t *testing.T) {
	r := newRepo(t)
	if _, err := Build(r.git, authority.Authorization{Valid: false, Reason: "test"}); err == nil {
		t.Error("a manifest was built from an invalid authorization")
	}
}

func TestBlobSha256Requires(t *testing.T) {
	r := newRepo(t)
	if _, err := BlobSha256(r.git, nil, strings.Repeat("0", 40)); err == nil {
		t.Error("hashing a nonexistent object succeeded")
	}
}

// ===========================================================================
// ORIGINAL G4. Producer, committed schema and validator must agree exactly.
// ===========================================================================

func TestManifestValidatesAgainstItsOwnContract(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.remove("b.txt")
	r.write("n2.txt", "new")
	r.write("backend/db/migrations/001_init.sql", "-- CHANGED")
	r.run("update-index", "--chmod=+x", "exec.sh")

	m := r.manifest()
	value := m.Value()
	if err := Validate(value); err != nil {
		t.Fatalf("the producer emitted a manifest its own validator rejects: %v", err)
	}
	// The manifest must also survive a round trip through canonical bytes and
	// the strict parser, which is how any consumer will read it.
	raw, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	reparsed, err := jsonstrict.Parse(raw)
	if err != nil {
		t.Fatalf("the manifest does not survive strict parsing: %v", err)
	}
	if err := Validate(reparsed); err != nil {
		t.Fatalf("the reparsed manifest fails validation: %v", err)
	}
	again, _ := canonical.Marshal(reparsed)
	if string(again) != string(raw) {
		t.Error("the manifest is not canonical")
	}
	// candidateDigest covers the manifest WITHOUT itself.
	recomputed, _, err := canonical.MarshalDigest(m.digestValue())
	if err != nil {
		t.Fatal(err)
	}
	if recomputed != m.CandidateDigest {
		t.Errorf("candidateDigest %s does not cover the manifest body %s", m.CandidateDigest, recomputed)
	}
}

func TestValidateRejectsDrift(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	m := r.manifest()

	base := m.Value()
	mutate := func(fn func(members []jsonstrict.Member) []jsonstrict.Member) *jsonstrict.Value {
		return jsonstrict.MustObject(fn(append([]jsonstrict.Member(nil), base.Object...))...)
	}

	t.Run("undocumented top-level property", func(t *testing.T) {
		v := mutate(func(ms []jsonstrict.Member) []jsonstrict.Member {
			return append(ms, jsonstrict.P("extra", jsonstrict.String("x")))
		})
		if err := Validate(v); err == nil {
			t.Error("an undocumented property was accepted")
		}
	})

	t.Run("missing top-level property", func(t *testing.T) {
		v := mutate(func(ms []jsonstrict.Member) []jsonstrict.Member {
			out := ms[:0]
			for _, m := range ms {
				if m.Name != "baselineTree" {
					out = append(out, m)
				}
			}
			return out
		})
		if err := Validate(v); err == nil {
			t.Error("a missing property was accepted")
		}
	})

	t.Run("delete carrying candidate identity", func(t *testing.T) {
		entry := jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("gone.txt")),
			jsonstrict.P("change", jsonstrict.String("delete")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("b", 40))),
		)
		if err := Validate(replaceEntries(base, entry)); err == nil {
			t.Error("a delete with candidate identity was accepted")
		}
	})

	t.Run("add binding a baseline", func(t *testing.T) {
		entry := jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("new.txt")),
			jsonstrict.P("change", jsonstrict.String("add")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("b", 40))),
		)
		if err := Validate(replaceEntries(base, entry)); err == nil {
			t.Error("an add binding a baseline object was accepted")
		}
	})

	t.Run("unsafe entry path", func(t *testing.T) {
		entry := jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt:stream")),
			jsonstrict.P("change", jsonstrict.String("add")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.Null()),
			jsonstrict.P("baselineObject", jsonstrict.Null()),
		)
		if err := Validate(replaceEntries(base, entry)); err == nil {
			t.Error("an unsafe entry path was accepted")
		}
	})

	t.Run("abbreviated object id", func(t *testing.T) {
		entry := jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("new.txt")),
			jsonstrict.P("change", jsonstrict.String("add")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String("abc1234")),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.Null()),
			jsonstrict.P("baselineObject", jsonstrict.Null()),
		)
		if err := Validate(replaceEntries(base, entry)); err == nil {
			t.Error("an abbreviated object id was accepted")
		}
	})

	t.Run("lowercase content digest", func(t *testing.T) {
		entry := jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("new.txt")),
			jsonstrict.P("change", jsonstrict.String("add")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("a", 64))),
			jsonstrict.P("baselineMode", jsonstrict.Null()),
			jsonstrict.P("baselineObject", jsonstrict.Null()),
		)
		if err := Validate(replaceEntries(base, entry)); err == nil {
			t.Error("a lowercase content digest was accepted")
		}
	})
}

// Candidate identity must not move when a hostile Git is planted in PATH. The
// audit that produced this test substituted the whole candidate that way, so
// the assertion is on the tree, the digest, the entry count AND every entry
// identity - not merely on "it still worked".
func TestCandidateIdentityUnaffectedByHostilePath(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.write("n2.txt", "new")
	r.remove("b.txt")

	clean := r.manifest()

	// Plant a fake git FIRST in PATH: a .cmd that records any invocation and a
	// git.exe that is not a valid image.
	dir := t.TempDir()
	marker := filepath.Join(dir, "INVOKED")
	os.WriteFile(filepath.Join(dir, "git.cmd"),
		[]byte("@echo off\r\necho invoked >> \""+marker+"\"\r\nexit /b 0\r\n"), 0o700)
	os.WriteFile(filepath.Join(dir, "git.exe"), []byte("not a PE image"), 0o700)
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))

	if resolved, err := exec.LookPath("git"); err != nil ||
		!strings.HasPrefix(strings.ToLower(resolved), strings.ToLower(dir)) {
		t.Fatalf("hostile PATH is not potent: LookPath gave %q (%v)", resolved, err)
	}

	hostile := r.manifest()

	if hostile.CandidateTree != clean.CandidateTree {
		t.Errorf("candidate tree moved under hostile PATH: %s -> %s", clean.CandidateTree, hostile.CandidateTree)
	}
	if hostile.CandidateDigest != clean.CandidateDigest {
		t.Errorf("candidate digest moved under hostile PATH: %s -> %s", clean.CandidateDigest, hostile.CandidateDigest)
	}
	if len(hostile.Entries) != len(clean.Entries) {
		t.Fatalf("entry count moved under hostile PATH: %d -> %d", len(clean.Entries), len(hostile.Entries))
	}
	for i := range clean.Entries {
		a, b := clean.Entries[i], hostile.Entries[i]
		if a.Path != b.Path || deref(a.Sha256) != deref(b.Sha256) ||
			deref(a.GitObject) != deref(b.GitObject) || deref(a.Mode) != deref(b.Mode) {
			t.Errorf("entry %d identity moved: %+v -> %+v", i, a, b)
		}
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		raw, _ := os.ReadFile(marker)
		t.Fatalf("the hostile wrapper was executed during candidate construction:\n%s", raw)
	}
}

// ===========================================================================
// ADVERSARIAL SCHEMA AGREEMENT
//
// An audit proved the validator checked field presence and a couple of patterns
// but not types, enums, nullability, path grammar or cross-field consistency: a
// manifest with an empty repository id, an invalid stage slug, a non-SQL
// migration path, change "BOGUS" and null migration identities was ACCEPTED
// while the committed schema rejected all five.
//
// Every case below mutates a REAL generated manifest one field at a time and
// requires FAIL CLOSED. The candidateDigest is recomputed after each mutation,
// so each rule must fire on its own merits rather than being masked by the
// self-consistency check - which is tested separately.
// ===========================================================================

// setMember returns a copy of obj with name set to value, appending it if absent.
func setMember(obj *jsonstrict.Value, name string, value *jsonstrict.Value) *jsonstrict.Value {
	members := make([]jsonstrict.Member, 0, len(obj.Object)+1)
	found := false
	for _, m := range obj.Object {
		if m.Name == name {
			members = append(members, jsonstrict.P(name, value))
			found = true
			continue
		}
		members = append(members, m)
	}
	if !found {
		members = append(members, jsonstrict.P(name, value))
	}
	return jsonstrict.MustObject(members...)
}

// dropMember returns a copy of obj without name.
func dropMember(obj *jsonstrict.Value, name string) *jsonstrict.Value {
	members := make([]jsonstrict.Member, 0, len(obj.Object))
	for _, m := range obj.Object {
		if m.Name != name {
			members = append(members, m)
		}
	}
	return jsonstrict.MustObject(members...)
}

func firstEntry(t *testing.T, manifest *jsonstrict.Value) *jsonstrict.Value {
	t.Helper()
	entries, _ := manifest.Get("entries")
	if entries == nil || len(entries.Array) == 0 {
		t.Fatal("manifest has no entries to mutate")
	}
	return entries.Array[0]
}

// replaceFirstEntry swaps entry 0 for the given value.
func replaceFirstEntry(manifest *jsonstrict.Value, entry *jsonstrict.Value) *jsonstrict.Value {
	entries, _ := manifest.Get("entries")
	updated := append([]*jsonstrict.Value{entry}, entries.Array[1:]...)
	return setMember(manifest, "entries", jsonstrict.ArrayOf(updated))
}

func firstMigration(t *testing.T, manifest *jsonstrict.Value) *jsonstrict.Value {
	t.Helper()
	migs, _ := manifest.Get("migrationIdentity")
	if migs == nil || len(migs.Array) == 0 {
		t.Fatal("manifest has no migration identity to mutate")
	}
	return migs.Array[0]
}

func replaceFirstMigration(manifest *jsonstrict.Value, mig *jsonstrict.Value) *jsonstrict.Value {
	migs, _ := manifest.Get("migrationIdentity")
	updated := append([]*jsonstrict.Value{mig}, migs.Array[1:]...)
	return setMember(manifest, "migrationIdentity", jsonstrict.ArrayOf(updated))
}

// reseal recomputes candidateDigest so the manifest is self-consistent again.
func reseal(t *testing.T, manifest *jsonstrict.Value) *jsonstrict.Value {
	t.Helper()
	body := dropMember(manifest, "candidateDigest")
	digest, _, err := canonical.MarshalDigest(body)
	if err != nil {
		t.Fatalf("reseal: %v", err)
	}
	return setMember(manifest, "candidateDigest", jsonstrict.String(digest))
}

func TestValidateFailsClosedOnEverySchemaRule(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.remove("b.txt")
	r.write("n2.txt", "new")
	r.write("backend/db/migrations/001_init.sql", "-- CHANGED")
	valid := r.manifest().Value()

	if err := Validate(valid); err != nil {
		t.Fatalf("the generated manifest must pass before anything is mutated: %v", err)
	}

	badGitID := "abc1234"
	badSha := strings.Repeat("a", 64) // lowercase, schema demands uppercase
	goodGitID := strings.Repeat("a", 40)

	cases := []struct {
		label  string
		mutate func(*jsonstrict.Value) *jsonstrict.Value
	}{
		// --- top level ---------------------------------------------------
		{"missing required field", func(m *jsonstrict.Value) *jsonstrict.Value { return dropMember(m, "baselineTree") }},
		{"unknown property", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "extra", jsonstrict.String("x"))
		}},
		{"empty repository id", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "repositoryId", jsonstrict.String(""))
		}},
		{"whitespace repository id", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "repositoryId", jsonstrict.String("   "))
		}},
		{"repository id is an integer", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "repositoryId", jsonstrict.Int(7))
		}},
		{"repository id is null", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "repositoryId", jsonstrict.Null())
		}},
		{"malformed stage slug", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "stageSlug", jsonstrict.String("lower-case-slug"))
		}},
		{"empty stage slug", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "stageSlug", jsonstrict.String(""))
		}},
		{"wrong schemaVersion", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "schemaVersion", jsonstrict.String("gds-authority-lifecycle-v2"))
		}},
		{"wrong objectType", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "objectType", jsonstrict.String("StageAuthorization"))
		}},
		{"malformed baseline commit", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "baselineCommit", jsonstrict.String(badGitID))
		}},
		{"uppercase git object id", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "baselineTree", jsonstrict.String(strings.ToUpper(goodGitID)))
		}},
		{"malformed authorization digest", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "authorizationDigest", jsonstrict.String(badSha))
		}},
		{"entries is not an array", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "entries", jsonstrict.String("none"))
		}},
		{"migrationIdentity is not an array", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "migrationIdentity", jsonstrict.Null())
		}},

		// --- entries -----------------------------------------------------
		{"entry unknown property", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "extra", jsonstrict.String("x")))
		}},
		{"entry missing property", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, dropMember(firstEntry(t, m), "baselineMode"))
		}},
		{"entry change is not in the enum", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "change", jsonstrict.String("BOGUS")))
		}},
		{"entry change is an integer", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "change", jsonstrict.Int(1)))
		}},
		{"entry path is unsafe", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "path", jsonstrict.String("a.txt:stream")))
		}},
		{"entry path traverses", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "path", jsonstrict.String("../outside.txt")))
		}},
		{"entry path is a reserved device", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "path", jsonstrict.String("NUL.txt")))
		}},
		{"entry path is null", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "path", jsonstrict.Null()))
		}},
		{"entry mode is malformed", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "mode", jsonstrict.String("999")))
		}},
		{"entry mode is an integer", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "mode", jsonstrict.Int(100644)))
		}},
		{"entry object id is abbreviated", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "gitObject", jsonstrict.String(badGitID)))
		}},
		{"entry content digest is lowercase", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "sha256", jsonstrict.String(badSha)))
		}},
		{"entry identity is null where prohibited", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstEntry(m, setMember(firstEntry(t, m), "sha256", jsonstrict.Null()))
		}},
		{"entries out of ordinal order", func(m *jsonstrict.Value) *jsonstrict.Value {
			entries, _ := m.Get("entries")
			reversed := make([]*jsonstrict.Value, 0, len(entries.Array))
			for i := len(entries.Array) - 1; i >= 0; i-- {
				reversed = append(reversed, entries.Array[i])
			}
			return setMember(m, "entries", jsonstrict.ArrayOf(reversed))
		}},
		{"duplicate entry path", func(m *jsonstrict.Value) *jsonstrict.Value {
			entries, _ := m.Get("entries")
			doubled := append([]*jsonstrict.Value{entries.Array[0]}, entries.Array...)
			return setMember(m, "entries", jsonstrict.ArrayOf(doubled))
		}},

		// --- migration identity ------------------------------------------
		{"non-SQL migration path", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "path", jsonstrict.String("backend/db/migrations/notes.txt")))
		}},
		{"migration path outside the migration tree", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "path", jsonstrict.String("a.txt")))
		}},
		{"nested migration path", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "path", jsonstrict.String("backend/db/migrations/sub/001.sql")))
		}},
		{"migration change is not in the enum", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "change", jsonstrict.String("BOGUS")))
		}},
		{"migration identity is null", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "sha256", jsonstrict.Null()))
		}},
		{"migration object id is null", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "gitObject", jsonstrict.Null()))
		}},
		{"migration unknown property", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "mode", jsonstrict.String("100644")))
		}},
		{"migration missing property", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, dropMember(firstMigration(t, m), "sha256"))
		}},
		{"migration is not an object", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "migrationIdentity", jsonstrict.Array(jsonstrict.String("backend/db/migrations/001_init.sql")))
		}},
		{"migration absent from the record", func(m *jsonstrict.Value) *jsonstrict.Value {
			return setMember(m, "migrationIdentity", jsonstrict.ArrayOf([]*jsonstrict.Value{}))
		}},
		{"migration disagrees with its entry", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "sha256", jsonstrict.String(strings.Repeat("B", 64))))
		}},
		{"migration change disagrees with its entry", func(m *jsonstrict.Value) *jsonstrict.Value {
			return replaceFirstMigration(m, setMember(firstMigration(t, m), "change", jsonstrict.String("add")))
		}},
	}

	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) {
			mutated := reseal(t, tc.mutate(valid))
			if err := Validate(mutated); err == nil {
				t.Errorf("%s was ACCEPTED; the committed schema rejects it", tc.label)
			}
		})
	}

	// The original manifest must be untouched by all that mutation.
	if err := Validate(valid); err != nil {
		t.Fatalf("the valid manifest was mutated in place: %v", err)
	}
}

// Cross-field consistency between change kind and the identity fields.
func TestValidateCrossFieldIdentityRules(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	valid := r.manifest().Value()

	entry := firstEntry(t, valid)
	cases := map[string]*jsonstrict.Value{
		"delete carrying candidate identity": jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt")),
			jsonstrict.P("change", jsonstrict.String("delete")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("b", 40))),
		),
		"delete without a baseline": jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt")),
			jsonstrict.P("change", jsonstrict.String("delete")),
			jsonstrict.P("mode", jsonstrict.Null()),
			jsonstrict.P("gitObject", jsonstrict.Null()),
			jsonstrict.P("sha256", jsonstrict.Null()),
			jsonstrict.P("baselineMode", jsonstrict.Null()),
			jsonstrict.P("baselineObject", jsonstrict.Null()),
		),
		"add binding a baseline": jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt")),
			jsonstrict.P("change", jsonstrict.String("add")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("b", 40))),
		),
		"modify without candidate identity": jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt")),
			jsonstrict.P("change", jsonstrict.String("modify")),
			jsonstrict.P("mode", jsonstrict.Null()),
			jsonstrict.P("gitObject", jsonstrict.Null()),
			jsonstrict.P("sha256", jsonstrict.Null()),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("b", 40))),
		),
		"modify that changes nothing": jsonstrict.MustObject(
			jsonstrict.P("path", jsonstrict.String("a.txt")),
			jsonstrict.P("change", jsonstrict.String("modify")),
			jsonstrict.P("mode", jsonstrict.String("100644")),
			jsonstrict.P("gitObject", jsonstrict.String(strings.Repeat("a", 40))),
			jsonstrict.P("sha256", jsonstrict.String(strings.Repeat("A", 64))),
			jsonstrict.P("baselineMode", jsonstrict.String("100644")),
			jsonstrict.P("baselineObject", jsonstrict.String(strings.Repeat("a", 40))),
		),
	}
	_ = entry
	for label, replacement := range cases {
		t.Run(label, func(t *testing.T) {
			mutated := reseal(t, replaceFirstEntry(valid, replacement))
			if err := Validate(mutated); err == nil {
				t.Errorf("%s was ACCEPTED", label)
			}
		})
	}
}

// The digest must cover the manifest. A mutation WITHOUT resealing is caught
// even when every other rule is satisfied.
func TestValidateCatchesMisreportedIdentity(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	valid := r.manifest().Value()

	// A legal-looking change to a field that is otherwise valid.
	tampered := setMember(valid, "repositoryId", jsonstrict.String("github.com-someone-else"))
	err := Validate(tampered)
	if err == nil {
		t.Fatal("a manifest whose digest does not cover it was accepted")
	}
	if !strings.Contains(err.Error(), "does not cover this manifest") {
		t.Errorf("refusal was not about the digest: %v", err)
	}
	// Resealing makes it self-consistent again, proving the check is real and
	// not merely a side effect of some other rule.
	if err := Validate(reseal(t, tampered)); err != nil {
		t.Errorf("a resealed manifest still failed for another reason: %v", err)
	}
}

func replaceEntries(base *jsonstrict.Value, entries ...*jsonstrict.Value) *jsonstrict.Value {
	members := make([]jsonstrict.Member, 0, len(base.Object))
	for _, m := range base.Object {
		if m.Name == "entries" {
			members = append(members, jsonstrict.P("entries", jsonstrict.Array(entries...)))
			continue
		}
		members = append(members, m)
	}
	return jsonstrict.MustObject(members...)
}

// The committed schema is the published contract. This asserts that it declares
// exactly the fields the producer emits and the validator enforces.
//
// It compares declared property sets and required lists; it is not a general
// JSON Schema evaluator, so it proves agreement on the contract's SHAPE, not on
// every pattern constraint. The pattern constraints are enforced separately by
// Validate and tested above.
func TestCommittedSchemaMatchesProducer(t *testing.T) {
	path := filepath.Join("..", "..", "..", "..", "governance", "schemas", "gds-authority-lifecycle-v1.schema.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("committed schema is not readable from here: %v", err)
	}
	schema, err := jsonstrict.Parse(raw)
	if err != nil {
		t.Fatalf("the committed schema is not strict JSON: %v", err)
	}
	defs, ok := schema.Get("$defs")
	if !ok {
		t.Fatal("the schema declares no $defs")
	}
	manifest, ok := defs.Get("candidateManifest")
	if !ok {
		t.Fatal("the schema declares no candidateManifest")
	}

	if additional, ok := manifest.Get("additionalProperties"); !ok || additional.Kind != jsonstrict.KindBool || additional.Bool {
		t.Error("candidateManifest does not set additionalProperties:false")
	}
	assertSet(t, "candidateManifest.properties", propertyNames(t, manifest), TopLevelFields)
	assertSet(t, "candidateManifest.required", stringArray(t, manifest, "required"), TopLevelFields)

	entries, _ := manifest.Get("properties")
	entriesDef, _ := entries.Get("entries")
	items, ok := entriesDef.Get("items")
	if !ok {
		t.Fatal("entries declares no items")
	}
	assertSet(t, "entry.properties", propertyNames(t, items), EntryFields)
	assertSet(t, "entry.required", stringArray(t, items, "required"), EntryFields)

	migDef, _ := entries.Get("migrationIdentity")
	migItems, ok := migDef.Get("items")
	if !ok {
		t.Fatal("migrationIdentity declares no items")
	}
	assertSet(t, "migrationIdentity.properties", propertyNames(t, migItems), MigrationFields)
	assertSet(t, "migrationIdentity.required", stringArray(t, migItems, "required"), MigrationFields)
}

func propertyNames(t *testing.T, node *jsonstrict.Value) []string {
	t.Helper()
	props, ok := node.Get("properties")
	if !ok {
		t.Fatal("node declares no properties")
	}
	return props.Names()
}

func stringArray(t *testing.T, node *jsonstrict.Value, name string) []string {
	t.Helper()
	arr, ok := node.Get(name)
	if !ok || arr.Kind != jsonstrict.KindArray {
		t.Fatalf("%s is not an array", name)
	}
	out := make([]string, 0, len(arr.Array))
	for _, item := range arr.Array {
		s, _ := item.StringValue()
		out = append(out, s)
	}
	return out
}

func assertSet(t *testing.T, what string, got, want []string) {
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

func TestAuthorizedAgainst(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "CHANGED")
	r.write("outside.txt", "not in the authorization")

	m := r.manifest()
	value := m.Value()
	auth := r.auth()
	auth.Digest = m.AuthorizationDigest

	unauthorized, err := AuthorizedAgainst(value, auth)
	if err != nil {
		t.Fatal(err)
	}
	if len(unauthorized) != 1 || unauthorized[0] != "outside.txt" {
		t.Errorf("unauthorized = %v, want [outside.txt]", unauthorized)
	}

	// A manifest bound to different authority is refused outright.
	other := auth
	other.Digest = strings.Repeat("B", 64)
	if _, err := AuthorizedAgainst(value, other); err == nil {
		t.Error("a manifest bound to another authorization was accepted")
	}
	other = auth
	other.BaselineCommit = strings.Repeat("0", 40)
	if _, err := AuthorizedAgainst(value, other); err == nil {
		t.Error("a manifest on another baseline was accepted")
	}
	if _, err := AuthorizedAgainst(value, authority.Authorization{Valid: false}); err == nil {
		t.Error("an invalid authorization produced an authorization decision")
	}
}

// ===========================================================================
// TERMINAL RELEASE STATE
//
// After a release commit there is no index to derive a candidate from and no
// current authorization to derive it under. The manifest must instead be
// rebuilt from two COMMITTED trees, and the whole claim of terminal state
// rests on that reconstruction being the same object the auditor saw.
//
// If BuildFromTrees and Build could ever disagree, terminal state would be a
// second opinion about what shipped rather than a proof of it.
// ===========================================================================

// The reconstruction is faithful: the manifest rebuilt from committed trees is
// byte-identical to the manifest that was derived from the pending index, so
// the released candidate digest recomputes exactly.
func TestBuildFromTreesReconstructsTheAuditedManifest(t *testing.T) {
	r := newRepo(t)

	// A pending changeset with every change class in it, so the comparison is
	// not a trivial one over additions alone.
	r.write("a.txt", "modified")
	r.remove("b.txt")
	r.write("new.txt", "added")
	r.write("backend/db/migrations/001_init.sql", "-- changed")
	r.run("add", "-A")

	pending, err := Build(r.git, r.auth())
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	if len(pending.Entries) == 0 {
		t.Fatal("the fixture produced an empty candidate; the comparison would be vacuous")
	}

	// Release it: the pending candidate becomes a commit.
	r.run("commit", "-q", "-m", "release")
	head, err := r.git.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}
	if head == r.baseline {
		t.Fatal("the fixture did not actually commit")
	}

	baselineTree, err := r.git.RequiredLine(nil, "rev-parse", r.baseline+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}
	headTree, err := r.git.RequiredLine(nil, "rev-parse", head+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}
	if headTree != pending.CandidateTree {
		t.Fatalf("the released tree %s is not the candidate tree %s", headTree, pending.CandidateTree)
	}

	rebuilt, err := BuildFromTrees(r.git, pending.RepositoryID, pending.StageSlug,
		pending.AuthorizationDigest, r.baseline, baselineTree, headTree)
	if err != nil {
		t.Fatalf("BuildFromTrees: %v", err)
	}

	if rebuilt.CandidateDigest != pending.CandidateDigest {
		t.Errorf("reconstruction changed the candidate digest:\n  audited: %s\n  rebuilt: %s",
			pending.CandidateDigest, rebuilt.CandidateDigest)
	}
	if !reflect.DeepEqual(rebuilt.Entries, pending.Entries) {
		t.Errorf("reconstruction changed the entries:\n  audited: %+v\n  rebuilt: %+v",
			pending.Entries, rebuilt.Entries)
	}
	if !reflect.DeepEqual(rebuilt.MigrationIdentity, pending.MigrationIdentity) {
		t.Errorf("reconstruction changed the migration identity:\n  audited: %+v\n  rebuilt: %+v",
			pending.MigrationIdentity, rebuilt.MigrationIdentity)
	}
	if err := Validate(rebuilt.Value()); err != nil {
		t.Errorf("the reconstructed manifest does not satisfy its own contract: %v", err)
	}

	// The canonical bytes are what an auditor actually saw, so equality is
	// asserted over those rather than over the in-memory structure alone.
	auditedBytes, err := canonical.Marshal(pending.Value())
	if err != nil {
		t.Fatal(err)
	}
	rebuiltBytes, err := canonical.Marshal(rebuilt.Value())
	if err != nil {
		t.Fatal(err)
	}
	if string(auditedBytes) != string(rebuiltBytes) {
		t.Errorf("the reconstructed manifest is not byte-identical to the audited one:\n  audited: %s\n  rebuilt: %s",
			auditedBytes, rebuiltBytes)
	}
}

// Reconstruction reads trees and NOTHING ELSE. It must not consult the index,
// the worktree, or HEAD - a manifest that changed depending on what happened to
// be checked out would be describing the wrong thing entirely.
func TestBuildFromTreesIgnoresIndexAndWorktree(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "modified")
	r.run("add", "-A")
	r.run("commit", "-q", "-m", "release")

	head, err := r.git.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}
	baselineTree, err := r.git.RequiredLine(nil, "rev-parse", r.baseline+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}
	headTree, err := r.git.RequiredLine(nil, "rev-parse", head+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}

	clean, err := BuildFromTrees(r.git, "repo", "STAGE", strings.Repeat("A", 64), r.baseline, baselineTree, headTree)
	if err != nil {
		t.Fatalf("BuildFromTrees: %v", err)
	}

	// Now make the working state loudly disagree with the trees: an unrelated
	// staged change, an unstaged edit, and an untracked file.
	r.write("a.txt", "later unstaged edit")
	r.write("staged-later.txt", "staged after release")
	r.run("add", "staged-later.txt")
	r.write("untracked-later.txt", "never added")

	noisy, err := BuildFromTrees(r.git, "repo", "STAGE", strings.Repeat("A", 64), r.baseline, baselineTree, headTree)
	if err != nil {
		t.Fatalf("BuildFromTrees after local changes: %v", err)
	}

	if noisy.CandidateDigest != clean.CandidateDigest {
		t.Errorf("local working state changed the reconstructed release:\n  clean: %s\n  noisy: %s",
			clean.CandidateDigest, noisy.CandidateDigest)
	}
	for _, entry := range noisy.Entries {
		if entry.Path == "staged-later.txt" || entry.Path == "untracked-later.txt" {
			t.Errorf("post-release local work entered the reconstructed release: %s", entry.Path)
		}
	}

	// And the local state really was dirty, so the assertion above was not
	// passing because there was nothing to notice.
	if strings.TrimSpace(r.status()) == "" {
		t.Fatal("the fixture failed to dirty the working state")
	}
}

// Reconstruction is a reading operation. It must leave no commit, no index
// change and no worktree change behind, because it runs against a repository
// nobody authorized it to touch.
func TestBuildFromTreesIsReadOnly(t *testing.T) {
	r := newRepo(t)
	r.write("a.txt", "modified")
	r.run("add", "-A")
	r.run("commit", "-q", "-m", "release")

	head, err := r.git.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}
	baselineTree, err := r.git.RequiredLine(nil, "rev-parse", r.baseline+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}
	headTree, err := r.git.RequiredLine(nil, "rev-parse", head+"^{tree}")
	if err != nil {
		t.Fatal(err)
	}

	before := r.status()

	if _, err := BuildFromTrees(r.git, "repo", "STAGE", strings.Repeat("A", 64), r.baseline, baselineTree, headTree); err != nil {
		t.Fatalf("BuildFromTrees: %v", err)
	}

	after := r.status()
	if before != after {
		t.Errorf("reconstruction changed the working state:\n  before: %q\n  after:  %q", before, after)
	}
	if nowHead, err := r.git.HeadCommit(); err != nil {
		t.Fatal(err)
	} else if nowHead != head {
		t.Errorf("reconstruction moved HEAD from %s to %s", head, nowHead)
	}
}
