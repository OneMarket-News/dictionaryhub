package gitexec

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func newRepo(t *testing.T) string {
	t.Helper()
	if _, err := os.Stat(GovernedGitExecutable); err != nil {
		t.Skipf("the governed Git executable is not installed: %v", err)
	}
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		// Fixture setup uses the governed executable too, so a hostile PATH in
		// one test cannot break another test's setup.
		cmd := exec.Command(GovernedGitExecutable, append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init", "-q")
	run("config", "user.email", "core@test")
	run("config", "user.name", "core")
	run("remote", "add", "origin", "https://github.com/OneMarket-News/dictionaryhub.git")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("base"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "-A")
	run("commit", "-q", "-m", "base")
	return dir
}

// ORIGINAL G3. A tool that cannot run must never look like a repository with
// nothing in it. Every authority-sensitive call fails closed: a non-zero exit
// is an error, not an empty result, and a missing executable is an error, not
// an exit code of zero.
func TestFailsClosed(t *testing.T) {
	// A directory that is not a repository makes real Git exit non-zero.
	notRepo := t.TempDir()
	r := New(notRepo)

	if out, err := r.Checked(nil, "rev-parse", "HEAD"); err == nil {
		t.Errorf("Checked treated a failure as success, returning %q", out)
	}
	if _, err := r.HeadCommit(); err == nil {
		t.Error("HeadCommit succeeded outside a repository")
	}
	if _, err := r.RepositoryID(); err == nil {
		t.Error("RepositoryID succeeded outside a repository")
	}
	if _, err := r.AbsoluteGitDir(); err == nil {
		t.Error("AbsoluteGitDir succeeded outside a repository")
	}

	// Run itself reports the exit code without judging it, and does not
	// pretend the command succeeded.
	res, err := r.Run(nil, "rev-parse", "HEAD")
	if err != nil {
		t.Fatalf("Run returned a start error for a runnable command: %v", err)
	}
	if res.ExitCode == 0 {
		t.Error("Run reported exit 0 for a command that failed")
	}
	if len(res.Stderr) == 0 {
		t.Error("Run discarded the diagnostic output")
	}

	// A missing executable is a start failure, which is an error rather than
	// any exit code at all.
	missing := &Runner{Repo: notRepo, Git: "srgds-definitely-not-git"}
	if _, err := missing.Run(nil, "status"); err == nil {
		t.Error("a missing executable produced a result instead of an error")
	}
	if _, err := missing.Checked(nil, "status"); err == nil {
		t.Error("Checked accepted a missing executable")
	}
}

// ===========================================================================
// PATH IS NOT AUTHORITY
//
// An audit sanitized every Git environment variable and still substituted the
// candidate: the core resolved "git" through ambient PATH, so a wrapper placed
// earlier in PATH received the sanitized environment, reintroduced
// GIT_WORK_TREE, called the real Git, and produced a substituted candidate that
// was ACCEPTED. Sanitizing the environment says nothing about which executable
// receives it.
//
// These tests make that attack a permanent regression.
// ===========================================================================

// plantHostileGit puts a fake `git` FIRST in PATH and returns the directory and
// the marker file the fake would create if it were ever executed.
func plantHostileGit(t *testing.T) (dir string, marker string) {
	t.Helper()
	dir = t.TempDir()
	marker = filepath.Join(dir, "INVOKED")

	// A .cmd wrapper (which PATHEXT resolves) that records the invocation, and
	// a git.exe that is not a valid executable image. Either one being reached
	// is a failure: the .cmd leaves evidence, the .exe cannot run at all.
	wrapper := "@echo off\r\necho invoked >> \"" + marker + "\"\r\nexit /b 0\r\n"
	if err := os.WriteFile(filepath.Join(dir, "git.cmd"), []byte(wrapper), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "git.exe"), []byte("this is not a PE image"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	return dir, marker
}

func TestHostilePathIsPotentButNeverReached(t *testing.T) {
	repo := newRepo(t)
	clean := New(repo)
	expectedHead, err := clean.HeadCommit()
	if err != nil {
		t.Fatalf("baseline HEAD: %v", err)
	}

	dir, marker := plantHostileGit(t)

	// POTENCY. Anything that resolves Git through PATH now gets the fake.
	resolved, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("LookPath found no git at all: %v", err)
	}
	if !strings.HasPrefix(strings.ToLower(resolved), strings.ToLower(dir)) {
		t.Fatalf("hostile PATH is not potent: LookPath resolved %q, expected something under %q", resolved, dir)
	}
	// And a PATH-resolved invocation genuinely misbehaves: the planted git.exe
	// is not a valid image, so any caller relying on PATH breaks outright.
	if out, err := exec.Command("git", "--version").CombinedOutput(); err == nil {
		t.Fatalf("the planted git was expected to be unusable, but ran: %q", out)
	}

	// GOVERNED. The runner must be entirely unaffected.
	r := New(repo)
	if got := r.exe(); got != GovernedGitExecutable {
		t.Errorf("runner executable is %q, want the governed %q", got, GovernedGitExecutable)
	}
	if !filepath.IsAbs(r.exe()) {
		t.Errorf("runner executable %q is not absolute", r.exe())
	}
	head, err := r.HeadCommit()
	if err != nil {
		t.Fatalf("governed runner failed under hostile PATH: %v", err)
	}
	if head != expectedHead {
		t.Errorf("HEAD under hostile PATH = %q, want %q", head, expectedHead)
	}

	// The wrapper must have received ZERO governed invocations.
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		raw, _ := os.ReadFile(marker)
		t.Fatalf("the hostile wrapper WAS executed by the governed runner:\n%s", raw)
	}
}

// PATH containing only the fake, and PATH empty entirely. The governed
// executable is absolute, so neither can matter.
func TestGovernedRunnerIgnoresPathEntirely(t *testing.T) {
	repo := newRepo(t)
	expectedHead, err := New(repo).HeadCommit()
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		label string
		path  func(t *testing.T) string
	}{
		{"PATH is empty", func(t *testing.T) string { return "" }},
		{"PATH contains only a fake git", func(t *testing.T) string {
			dir := t.TempDir()
			os.WriteFile(filepath.Join(dir, "git.exe"), []byte("not a PE image"), 0o700)
			return dir
		}},
		{"hostile PATHEXT", func(t *testing.T) string {
			t.Setenv("PATHEXT", ".CMD;.BAT;.EXE")
			dir := t.TempDir()
			os.WriteFile(filepath.Join(dir, "git.cmd"), []byte("@echo off\r\nexit /b 1\r\n"), 0o700)
			return dir
		}},
	} {
		t.Run(tc.label, func(t *testing.T) {
			t.Setenv("PATH", tc.path(t))
			head, err := New(repo).HeadCommit()
			if err != nil {
				t.Fatalf("governed runner failed: %v", err)
			}
			if head != expectedHead {
				t.Errorf("HEAD = %q, want %q", head, expectedHead)
			}
		})
	}
}

// The governed executable must prove its own identity, and a failure to do so
// must FAIL CLOSED rather than fall back to anything.
func TestGovernedExecutableVerification(t *testing.T) {
	repo := newRepo(t)

	t.Run("the contracted executable verifies", func(t *testing.T) {
		path, version, digest, err := GovernedGitIdentity()
		if err != nil {
			t.Fatalf("the governed Git executable did not verify: %v", err)
		}
		if path != GovernedGitExecutable || version != GovernedGitVersion || digest != GovernedGitSHA256 {
			t.Errorf("identity = %q / %q / %q", path, version, digest)
		}
	})

	t.Run("a relative path is refused", func(t *testing.T) {
		r := &Runner{Repo: repo, Git: "git"}
		_, err := r.HeadCommit()
		if err == nil {
			t.Fatal("a bare executable name was accepted")
		}
		if !strings.Contains(err.Error(), "absolute") {
			t.Errorf("refusal was not about PATH resolution: %v", err)
		}
	})

	t.Run("a missing executable is refused", func(t *testing.T) {
		r := &Runner{Repo: repo, Git: filepath.Join(t.TempDir(), "no-such-git.exe")}
		if _, err := r.HeadCommit(); err == nil {
			t.Fatal("a missing governed executable was accepted")
		}
	})

	t.Run("a real Git that is not the contracted bytes is refused", func(t *testing.T) {
		// mingw64 Git is genuine, reports the SAME version, and works - and is
		// still refused, because it is not the executable that was audited.
		other := `C:\Program Files\Git\mingw64\bin\git.exe`
		if _, err := os.Stat(other); err != nil {
			t.Skipf("second Git build not present: %v", err)
		}
		r := &Runner{Repo: repo, Git: other}
		_, err := r.HeadCommit()
		if err == nil {
			t.Fatal("an unaudited Git build was accepted")
		}
		if !strings.Contains(err.Error(), "SHA-256") {
			t.Errorf("refusal was not about the digest: %v", err)
		}
	})

	t.Run("an executable that is not Git is refused on version", func(t *testing.T) {
		notGit := `C:\Windows\System32\hostname.exe`
		if _, err := os.Stat(notGit); err != nil {
			t.Skipf("probe executable not present: %v", err)
		}
		r := &Runner{Repo: repo, Git: notGit}
		_, err := r.HeadCommit()
		if err == nil {
			t.Fatal("a non-Git executable was accepted")
		}
		if !strings.Contains(err.Error(), "not the contracted") && !strings.Contains(err.Error(), "would not report") {
			t.Errorf("refusal was not about the version: %v", err)
		}
	})
}

func TestRequiredLineRejectsEmptyOutput(t *testing.T) {
	repo := newRepo(t)
	r := New(repo)
	// `git config --get-all` on an unset key exits 1 with no output. The point
	// is that neither the exit code nor the empty output is read as a value.
	if line, err := r.RequiredLine(nil, "config", "--get-all", "srgds.absent"); err == nil {
		t.Errorf("RequiredLine returned %q where no value exists", line)
	}
}

func TestRepositoryIDDerivation(t *testing.T) {
	repo := newRepo(t)
	id, err := New(repo).RepositoryID()
	if err != nil {
		t.Fatal(err)
	}
	const want = "github.com-OneMarket-News-dictionaryhub"
	if id != want {
		t.Errorf("RepositoryID = %q, want %q", id, want)
	}
}

func TestHeadAndGitDir(t *testing.T) {
	repo := newRepo(t)
	r := New(repo)
	head, err := r.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}
	if len(head) != 40 {
		t.Errorf("HeadCommit = %q, want a full object id", head)
	}
	dir, err := r.AbsoluteGitDir()
	if err != nil {
		t.Fatal(err)
	}
	if dir == "" {
		t.Error("AbsoluteGitDir returned nothing")
	}
}

// NUL-delimited output must be split on NUL alone, with no trimming. A path may
// legitimately begin or end with a space, and trimming one would silently
// rename it. The original defect was the mirror image of this: display text was
// trimmed and a fixed-offset substring then cut into the path.
func TestSplitNUL(t *testing.T) {
	in := []byte(":100644 100644 aaa bbb M\x00 spaced path.txt \x00:000000 100644 ccc ddd A\x00new.txt\x00")
	got := SplitNUL(in)
	want := []string{
		":100644 100644 aaa bbb M",
		" spaced path.txt ",
		":000000 100644 ccc ddd A",
		"new.txt",
	}
	if len(got) != len(want) {
		t.Fatalf("SplitNUL produced %d records, want %d: %q", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("record %d = %q, want %q", i, got[i], want[i])
		}
	}
	if len(SplitNUL(nil)) != 0 || len(SplitNUL([]byte(""))) != 0 || len(SplitNUL([]byte("\n"))) != 0 {
		t.Error("empty output must produce no records")
	}
	// A record containing a newline survives intact: only a trailing newline is
	// incidental.
	multi := SplitNUL([]byte("a\nb\x00c\x00\n"))
	if len(multi) != 2 || multi[0] != "a\nb" || multi[1] != "c" {
		t.Errorf("interior newline was not preserved: %q", multi)
	}
}

func TestLines(t *testing.T) {
	got := Lines([]byte("one\r\ntwo\n\n  three  \n"))
	want := []string{"one", "two", "three"}
	if len(got) != len(want) {
		t.Fatalf("Lines produced %q", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("line %d = %q, want %q", i, got[i], want[i])
		}
	}
	if len(Lines(nil)) != 0 {
		t.Error("no output must produce no lines")
	}
}

func TestPinnedConfiguration(t *testing.T) {
	r := New(`C:\repo`)
	args := r.baseArgs([]string{"status"})
	joined := ""
	for _, a := range args {
		joined += a + " "
	}
	for _, want := range []string{"core.excludesFile=", "core.autocrlf=false", `-C C:\repo`} {
		if !contains(joined, want) {
			t.Errorf("base arguments %q do not pin %q", joined, want)
		}
	}
}

func TestControlledEnvironmentRemovesRepositoryRouting(t *testing.T) {
	base := []string{
		`Path=C:\Windows\System32`,
		`=C:=C:\repo`,
		`git_work_tree=C:\hostile`,
		`GIT_DIR=C:\foreign\.git`,
		`GIT_COMMON_DIR=C:\foreign\.git`,
		`GIT_INDEX_FILE=C:\foreign\index`,
		`GIT_OBJECT_DIRECTORY=C:\foreign\objects`,
		`GIT_CONFIG_COUNT=1`,
		`GIT_CONFIG_KEY_0=core.excludesFile`,
		`GIT_CONFIG_VALUE_0=C:\hostile-ignore`,
		`GIT_ATTR_NOSYSTEM=0`,
	}
	got := controlledEnv(base, map[string]string{
		"GIT_INDEX_FILE":       `C:\controlled\index`,
		"GIT_OBJECT_DIRECTORY": `C:\controlled\objects`,
	})
	joined := strings.Join(got, "\n")

	for _, absent := range []string{
		`git_work_tree=C:\hostile`,
		`GIT_DIR=C:\foreign\.git`,
		`GIT_COMMON_DIR=C:\foreign\.git`,
		`GIT_INDEX_FILE=C:\foreign\index`,
		`GIT_OBJECT_DIRECTORY=C:\foreign\objects`,
		`GIT_CONFIG_COUNT=1`,
		`GIT_CONFIG_KEY_0=core.excludesFile`,
		`GIT_CONFIG_VALUE_0=C:\hostile-ignore`,
		`GIT_ATTR_NOSYSTEM=0`,
	} {
		if strings.Contains(joined, absent) {
			t.Errorf("controlled environment retained %q:\n%s", absent, joined)
		}
	}
	for _, present := range []string{
		`Path=C:\Windows\System32`,
		`=C:=C:\repo`,
		`GIT_INDEX_FILE=C:\controlled\index`,
		`GIT_OBJECT_DIRECTORY=C:\controlled\objects`,
		`GIT_ATTR_NOSYSTEM=1`,
		`GIT_TERMINAL_PROMPT=0`,
		`GIT_OPTIONAL_LOCKS=0`,
	} {
		if !strings.Contains(joined, present) {
			t.Errorf("controlled environment omitted %q:\n%s", present, joined)
		}
	}
}

func TestRepositoryRoutingEnvironmentCannotRedirectGit(t *testing.T) {
	repo := newRepo(t)
	r := New(repo)
	head, err := r.HeadCommit()
	if err != nil {
		t.Fatal(err)
	}

	hostile := t.TempDir()
	for key, value := range map[string]string{
		"GIT_WORK_TREE":        hostile,
		"GIT_DIR":              filepath.Join(hostile, ".git"),
		"GIT_COMMON_DIR":       filepath.Join(hostile, "common"),
		"GIT_INDEX_FILE":       filepath.Join(hostile, "index"),
		"GIT_OBJECT_DIRECTORY": filepath.Join(hostile, "objects"),
		"GIT_CONFIG":           filepath.Join(hostile, "config"),
		"GIT_CONFIG_COUNT":     "1",
		"GIT_CONFIG_KEY_0":     "core.excludesFile",
		"GIT_CONFIG_VALUE_0":   filepath.Join(hostile, "ignore"),
	} {
		t.Setenv(key, value)
	}

	again, err := r.HeadCommit()
	if err != nil {
		t.Fatalf("host routing environment reached HeadCommit: %v", err)
	}
	if again != head {
		t.Errorf("host routing environment changed HEAD from %s to %s", head, again)
	}
	out, err := r.Checked(nil, "ls-files", "--stage", "-z")
	if err != nil {
		t.Fatalf("host routing environment reached ls-files: %v", err)
	}
	if !strings.Contains(string(out), "a.txt") {
		t.Errorf("host routing environment hid the governed index: %q", out)
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (func() bool {
		for i := 0; i+len(needle) <= len(haystack); i++ {
			if haystack[i:i+len(needle)] == needle {
				return true
			}
		}
		return false
	})()
}
