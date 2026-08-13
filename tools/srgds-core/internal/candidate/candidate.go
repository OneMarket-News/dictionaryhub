// Package candidate derives what a stage actually changed, as ONE coherent
// repository state.
//
// The model this replaces synthesized each entry from three incompatible
// sources at once: a filesystem SHA-256, a staged Git object, and a worktree
// object. An audit proved the result did not describe any single repository
// state - a staged value could be bound to worktree bytes, and a staged
// addition deleted in the worktree was reported as an ADD with empty content.
//
// Identity here is ONE GIT TREE. Every manifest field is a projection of a
// single baseline-tree to candidate-tree transition, so no field can come from
// a different state than its neighbours:
//
//	signed baseline commit
//	      |
//	real index  --copy-->  TEMP INDEX (disposable GIT_INDEX_FILE)
//	      |                   copying preserves staged metadata, in particular
//	      |                   index-level 100644/100755 intent that a Windows
//	      |                   worktree cannot express
//	      v
//	git add -A  overlays the effective worktree: tracked modifications,
//	            worktree deletions, and non-ignored untracked additions
//	      v
//	git write-tree  ->  CANDIDATE TREE
//	      v
//	git diff-tree --raw -r -z --no-renames --no-abbrev  baselineTree candidateTree
//
// The canonical .git/index, HEAD and refs are never touched: every command runs
// with GIT_INDEX_FILE pointed at a temporary file that is removed on success
// and on failure alike, and cleanup never masks an in-flight error.
//
// Renames are DELETE + ADD. Rename detection is a similarity heuristic, and a
// heuristic that decides which two paths are "the same file" is a judgement
// call this system will not make on a governance record.
package candidate

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"sourceroot.local/srgds-core/internal/authority"
	"sourceroot.local/srgds-core/internal/canonical"
	"sourceroot.local/srgds-core/internal/gitexec"
	"sourceroot.local/srgds-core/internal/jsonstrict"
	"sourceroot.local/srgds-core/internal/pathgrammar"
)

const (
	// SchemaVersion matches the committed schema.
	SchemaVersion = "gds-authority-lifecycle-v1"
	// ObjectType is what this package produces.
	ObjectType = "CandidateManifest"
	// MigrationPrefix marks database migrations, whose identity is recorded
	// separately because an applied migration cannot be edited after the fact.
	MigrationPrefix = "backend/db/migrations/"
)

var (
	gitIDRe  = regexp.MustCompile(`^[0-9a-f]{40}$`)
	sha256Re = regexp.MustCompile(`^[0-9A-F]{64}$`)
	modeRe   = regexp.MustCompile(`^[0-7]{6}$`)
)

// Entry is one path's transition from baseline to candidate.
//
// The candidate side (Mode, GitObject, Sha256) is absent for a delete, and the
// baseline side (BaselineMode, BaselineObject) is absent for an add. Absent is
// spelled as a nil pointer and serialized as null, never as "", because an
// empty string in an identity field is indistinguishable from an identity that
// was computed and came out empty.
type Entry struct {
	Path           string
	Change         string
	Mode           *string
	GitObject      *string
	Sha256         *string
	BaselineMode   *string
	BaselineObject *string
}

// Migration is the separately recorded identity of one migration file.
type Migration struct {
	Path      string
	Change    string
	GitObject *string
	Sha256    *string
}

// Manifest is the complete, deterministic record of one candidate.
type Manifest struct {
	SchemaVersion       string
	ObjectType          string
	RepositoryID        string
	StageSlug           string
	AuthorizationDigest string
	BaselineCommit      string
	BaselineTree        string
	CandidateTree       string
	Entries             []Entry
	MigrationIdentity   []Migration
	CandidateDigest     string
}

// Trees is one baseline/candidate tree pair.
type Trees struct {
	BaselineTree  string
	CandidateTree string
}

// Workspace is the disposable state a candidate is computed in.
//
// Two things are redirected, and both matter:
//
//	GIT_INDEX_FILE          a copy of the real index, so staged metadata
//	                        survives while the canonical .git/index is never
//	                        opened for writing
//	GIT_OBJECT_DIRECTORY    a temporary object store, with the repository's own
//	                        object database attached read-only as an alternate
//
// Redirecting the object store is what makes computing a candidate a genuinely
// READ-ONLY operation on the repository. Writing new blobs and trees into the
// repository's own database would leave unreferenced loose objects behind after
// every manifest - a governance tool that inspects a repository should not
// modify it as a side effect of looking at it. It also means the core works
// against a repository the operator has mounted read-only.
type Workspace struct {
	Dir            string
	IndexPath      string
	ObjectDir      string
	AttributesPath string
	Env            map[string]string
}

// Git returns a runner bound to this workspace's attributes file, so external
// per-user attributes cannot reach any operation performed against it.
func (w *Workspace) Git(git *gitexec.Runner) *gitexec.Runner {
	return git.With("core.attributesFile=" + w.AttributesPath)
}

// Close removes the workspace. It is safe to call more than once, and it never
// reports a cleanup failure in place of the caller's original error.
func (w *Workspace) Close() {
	if w == nil || w.Dir == "" {
		return
	}
	_ = os.RemoveAll(w.Dir)
	w.Dir = ""
}

func newWorkspace(git *gitexec.Runner, baselineCommit string) (*Workspace, error) {
	gitDir, err := git.AbsoluteGitDir()
	if err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp("", "gds-candidate-*")
	if err != nil {
		return nil, fmt.Errorf("candidate workspace could not be created: %w", err)
	}
	ws := &Workspace{
		Dir:            dir,
		IndexPath:      filepath.Join(dir, "index"),
		ObjectDir:      filepath.Join(dir, "objects"),
		AttributesPath: filepath.Join(dir, "empty-attributes"),
	}
	// A GDS-controlled EMPTY attributes file. core.attributesFile otherwise
	// points at the operator's per-user attributes, which can assign text, eol
	// or filter to paths in a governed repository. Repository-tracked
	// .gitattributes is governed content and is deliberately left alone; only
	// the external source is neutralized.
	if err := os.WriteFile(ws.AttributesPath, nil, 0o600); err != nil {
		ws.Close()
		return nil, fmt.Errorf("candidate attributes file could not be created: %w", err)
	}
	if err := os.MkdirAll(ws.ObjectDir, 0o700); err != nil {
		ws.Close()
		return nil, fmt.Errorf("candidate object store could not be created: %w", err)
	}
	ws.Env = map[string]string{
		"GIT_INDEX_FILE":                   ws.IndexPath,
		"GIT_OBJECT_DIRECTORY":             ws.ObjectDir,
		"GIT_ALTERNATE_OBJECT_DIRECTORIES": filepath.Join(gitDir, "objects"),
	}

	if data, err := os.ReadFile(filepath.Join(gitDir, "index")); err == nil {
		// Start from the REAL index so legitimate staged metadata survives, in
		// particular index-level 100644/100755 intent that a Windows worktree
		// cannot express.
		if err := os.WriteFile(ws.IndexPath, data, 0o600); err != nil {
			ws.Close()
			return nil, fmt.Errorf("candidate index could not be seeded: %w", err)
		}
		return ws, nil
	}
	if _, err := git.Checked(ws.Env, "read-tree", baselineCommit); err != nil {
		ws.Close()
		return nil, err
	}
	return ws, nil
}

// overlayWorktree writes the effective worktree into the temporary index
// WITHOUT letting Git transform a single byte.
//
// This replaces `git add -A`. That command is convenient and wrong for this
// purpose: it runs content through the clean-filter and text-conversion
// machinery, and which transformations apply is decided by attributes and
// filter drivers that can be configured OUTSIDE the repository. An audit proved
// the consequence - the same governed bytes and the same authorized
// modifications produced a different candidate tree and a different digest on a
// machine with hostile external attributes, and it was accepted with zero
// unauthorized paths. A candidate identity a workstation can change is not an
// identity.
//
// So the bytes are placed directly:
//
//	git hash-object -w --no-filters   raw file bytes to a blob, no clean
//	                                  filter, no CRLF conversion, no attribute
//	                                  lookup of any kind
//	git update-index --index-info     mode, object id and path written straight
//	                                  into the temporary index
//
// Neither command consults a filter driver, so an externally configured
// filter.<name>.clean or .process cannot run, and filter.<name>.required
// cannot make the build fail either. Repository-tracked .gitattributes remains
// governed content and still describes the repository; it simply no longer
// decides what the candidate IS. Candidate identity is the raw bytes on disk.
//
// Mode intent comes from the seeded index, which is why a staged chmod +x that
// a Windows worktree cannot express still survives.
func overlayWorktree(git *gitexec.Runner, ws *Workspace) error {
	staged, err := git.Checked(ws.Env, "ls-files", "--stage", "-z")
	if err != nil {
		return err
	}
	type indexEntry struct{ mode string }
	tracked := map[string]indexEntry{}
	order := []string{}
	for _, record := range gitexec.SplitNUL(staged) {
		// "<mode> <object> <stage>\t<path>"
		tab := strings.IndexByte(record, '\t')
		if tab < 0 {
			return fmt.Errorf("malformed ls-files record %q", record)
		}
		fields := strings.Fields(record[:tab])
		if len(fields) < 3 {
			return fmt.Errorf("malformed ls-files metadata %q", record[:tab])
		}
		path := record[tab+1:]
		if _, seen := tracked[path]; !seen {
			order = append(order, path)
		}
		tracked[path] = indexEntry{mode: fields[0]}
	}

	// CANDIDATE DISCOVERY IS NOT AMBIENT.
	//
	// --exclude-standard was wrong here. It combines THREE ignore sources, and
	// two of them are host-local: .git/info/exclude and the global
	// core.excludesFile. Either can make an authorized, existing file vanish
	// from the candidate, which changes the candidate path set, the tree, the
	// digest and the authorization result because of state that lives on one
	// workstation and is not governed by anything.
	//
	// --exclude-per-directory reads ONLY per-directory .gitignore files, which
	// are tracked repository content. Measured behaviour, hostile global config
	// versus clean, with a file hidden by each source in turn:
	//
	//	--exclude-standard              tracked .gitignore, info/exclude AND
	//	                                the global file all take effect, so the
	//	                                answer changes with the workstation
	//	--exclude-per-directory         only tracked .gitignore takes effect;
	//	                                identical output either way
	//
	// The GDS contract therefore defines candidate discovery explicitly:
	// tracked .gitignore is governed repository content and participates;
	// host-local ignore state does not participate at all.
	others, err := git.Checked(ws.Env, "ls-files", "--others", "--exclude-per-directory=.gitignore", "-z")
	if err != nil {
		return err
	}
	for _, path := range gitexec.SplitNUL(others) {
		if _, seen := tracked[path]; !seen {
			tracked[path] = indexEntry{mode: "100644"}
			order = append(order, path)
		}
	}

	var present, absent []string
	for _, path := range order {
		// A path that cannot be safely named cannot be safely hashed either,
		// and --stdin-paths is newline delimited, so an unsafe path is refused
		// rather than smuggled through.
		if !pathgrammar.Safe(path) {
			return fmt.Errorf("worktree contains an unsafe path: %q", path)
		}
		if tracked[path].mode == "160000" {
			// A gitlink has no worktree bytes to hash; the seeded index entry
			// stands. There are none in this repository, and guessing at one
			// would be worse than refusing to touch it.
			continue
		}
		info, err := os.Lstat(filepath.Join(git.Repo, filepath.FromSlash(path)))
		if err == nil && info.Mode().IsRegular() {
			present = append(present, path)
			continue
		}
		if _, isTracked := tracked[path]; isTracked {
			absent = append(absent, path)
		}
	}

	objects := map[string]string{}
	if len(present) > 0 {
		res, err := git.RunInput(ws.Env, strings.Join(present, "\n")+"\n",
			"hash-object", "-w", "--no-filters", "--stdin-paths")
		if err != nil {
			return err
		}
		if res.ExitCode != 0 {
			return fmt.Errorf("git hash-object failed with exit %d: %s", res.ExitCode, strings.TrimSpace(string(res.Stderr)))
		}
		ids := gitexec.Lines(res.Stdout)
		if len(ids) != len(present) {
			return fmt.Errorf("git hash-object returned %d object ids for %d paths", len(ids), len(present))
		}
		for i, id := range ids {
			if !gitIDRe.MatchString(id) {
				return fmt.Errorf("git hash-object returned %q for %s", id, present[i])
			}
			objects[present[i]] = id
		}
	}

	var info strings.Builder
	for _, path := range present {
		mode := tracked[path].mode
		if !modeRe.MatchString(mode) {
			mode = "100644"
		}
		fmt.Fprintf(&info, "%s %s\t%s\n", mode, objects[path], path)
	}
	for _, path := range absent {
		// Mode 0 with the null object removes the entry.
		fmt.Fprintf(&info, "000000 %s\t%s\n", strings.Repeat("0", 40), path)
	}
	if info.Len() == 0 {
		return nil
	}
	res, err := git.RunInput(ws.Env, info.String(), "update-index", "--index-info")
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("git update-index failed with exit %d: %s", res.ExitCode, strings.TrimSpace(string(res.Stderr)))
	}
	return nil
}

// BuildTrees produces the candidate tree without touching the canonical index
// or the repository's object database.
//
// The returned Workspace holds the only copy of the newly written objects, so
// the caller must Close it - and must not do so until every object id derived
// from the candidate tree has been read.
func BuildTrees(git *gitexec.Runner, baselineCommit string) (Trees, *Workspace, error) {
	head, err := git.HeadCommit()
	if err != nil {
		return Trees{}, nil, err
	}
	if head != baselineCommit {
		return Trees{}, nil, fmt.Errorf("refusing to build a candidate tree: HEAD %s is not the authorized baseline %s", head, baselineCommit)
	}

	ws, err := newWorkspace(git, baselineCommit)
	if err != nil {
		return Trees{}, nil, err
	}

	scoped := ws.Git(git)
	if err := overlayWorktree(scoped, ws); err != nil {
		ws.Close()
		return Trees{}, nil, err
	}

	candidateTree, err := scoped.RequiredLine(ws.Env, "write-tree")
	if err != nil {
		ws.Close()
		return Trees{}, nil, err
	}
	if !gitIDRe.MatchString(candidateTree) {
		ws.Close()
		return Trees{}, nil, fmt.Errorf("git write-tree did not return a tree object id")
	}

	baselineTree, err := git.RequiredLine(ws.Env, "rev-parse", baselineCommit+"^{tree}")
	if err != nil {
		ws.Close()
		return Trees{}, nil, err
	}
	if !gitIDRe.MatchString(baselineTree) {
		ws.Close()
		return Trees{}, nil, fmt.Errorf("baseline tree id is not readable")
	}
	return Trees{BaselineTree: baselineTree, CandidateTree: candidateTree}, ws, nil
}

// BlobSha256 hashes the bytes of the blob the candidate TREE names.
//
// Content identity is never computed from the filesystem independently, because
// gitObject and sha256 must be guaranteed to describe the same content. Git's
// own size is authoritative, so a truncated read is detectable rather than
// silently producing the digest of a shorter file.
func BlobSha256(git *gitexec.Runner, ws *Workspace, objectID string) (string, error) {
	var env map[string]string
	if ws != nil {
		env = ws.Env
	}
	sizeText, err := git.RequiredLine(env, "cat-file", "-s", objectID)
	if err != nil {
		return "", err
	}
	expected, err := strconv.Atoi(strings.TrimSpace(sizeText))
	if err != nil {
		return "", fmt.Errorf("git cat-file -s did not return a size for %s: %w", objectID, err)
	}
	blob, err := git.Checked(env, "cat-file", "blob", objectID)
	if err != nil {
		return "", err
	}
	if len(blob) != expected {
		return "", fmt.Errorf("candidate blob %s read %d bytes but Git reports %d; refusing a truncated identity", objectID, len(blob), expected)
	}
	return canonical.Digest(blob), nil
}

// Build produces the manifest for the current candidate under one valid
// authorization.
func Build(git *gitexec.Runner, auth authority.Authorization) (*Manifest, error) {
	if !auth.Valid {
		return nil, fmt.Errorf("refusing to build a candidate manifest from an invalid authorization: %s", auth.Reason)
	}
	trees, ws, err := BuildTrees(git, auth.BaselineCommit)
	if err != nil {
		return nil, err
	}
	// Every object id below is only resolvable while the workspace lives.
	defer ws.Close()

	repositoryID, err := git.RepositoryID()
	if err != nil {
		return nil, err
	}

	out, err := git.Checked(ws.Env, "diff-tree", "--raw", "-r", "-z", "--no-renames", "--no-abbrev",
		trees.BaselineTree, trees.CandidateTree)
	if err != nil {
		return nil, err
	}
	records := gitexec.SplitNUL(out)

	entries := make([]Entry, 0, len(records)/2)
	seen := map[string]struct{}{}
	for i := 0; i < len(records); {
		meta := records[i]
		if !strings.HasPrefix(meta, ":") {
			i++
			continue
		}
		if i+1 >= len(records) {
			return nil, fmt.Errorf("malformed diff-tree output: metadata without a path")
		}
		path := records[i+1]
		i += 2

		fields := strings.Split(meta[1:], " ")
		if len(fields) < 5 {
			return nil, fmt.Errorf("malformed diff-tree metadata: %q", meta)
		}
		srcMode, dstMode, srcSha, dstSha, status := fields[0], fields[1], fields[2], fields[3], fields[4]

		if !pathgrammar.Safe(path) {
			return nil, fmt.Errorf("candidate contains an unsafe path: %s", path)
		}
		if _, dup := seen[path]; dup {
			return nil, fmt.Errorf("candidate represents %q more than once; refusing to guess", path)
		}
		seen[path] = struct{}{}

		change := "modify"
		switch {
		case strings.HasPrefix(status, "D"):
			change = "delete"
		case strings.HasPrefix(status, "A"):
			change = "add"
		}

		if change == "delete" {
			if !gitIDRe.MatchString(srcSha) {
				return nil, fmt.Errorf("baseline object id for %q is not a full id", path)
			}
			entries = append(entries, Entry{
				Path: path, Change: change,
				BaselineMode: ptr(srcMode), BaselineObject: ptr(srcSha),
			})
			continue
		}
		if !gitIDRe.MatchString(dstSha) {
			return nil, fmt.Errorf("candidate object id for %q is not a full id", path)
		}
		sum, err := BlobSha256(git, ws, dstSha)
		if err != nil {
			return nil, err
		}
		entry := Entry{
			Path: path, Change: change,
			Mode: ptr(dstMode), GitObject: ptr(dstSha), Sha256: ptr(sum),
		}
		if change != "add" {
			entry.BaselineMode = ptr(srcMode)
			entry.BaselineObject = ptr(srcSha)
		}
		entries = append(entries, entry)
	}

	sort.Slice(entries, func(a, b int) bool { return entries[a].Path < entries[b].Path })

	migrations := make([]Migration, 0)
	for _, entry := range entries {
		if strings.HasPrefix(entry.Path, MigrationPrefix) && strings.HasSuffix(entry.Path, ".sql") {
			migrations = append(migrations, Migration{
				Path: entry.Path, Change: entry.Change,
				GitObject: entry.GitObject, Sha256: entry.Sha256,
			})
		}
	}

	m := &Manifest{
		SchemaVersion:       SchemaVersion,
		ObjectType:          ObjectType,
		RepositoryID:        repositoryID,
		StageSlug:           auth.StageSlug,
		AuthorizationDigest: auth.Digest,
		BaselineCommit:      auth.BaselineCommit,
		BaselineTree:        trees.BaselineTree,
		CandidateTree:       trees.CandidateTree,
		Entries:             entries,
		MigrationIdentity:   migrations,
	}
	digest, _, err := canonical.MarshalDigest(m.digestValue())
	if err != nil {
		return nil, err
	}
	m.CandidateDigest = digest
	return m, nil
}

func ptr(s string) *string { return &s }

func (e Entry) value() *jsonstrict.Value {
	return jsonstrict.MustObject(
		jsonstrict.P("path", jsonstrict.String(e.Path)),
		jsonstrict.P("change", jsonstrict.String(e.Change)),
		jsonstrict.P("mode", jsonstrict.StringOrNull(e.Mode)),
		jsonstrict.P("gitObject", jsonstrict.StringOrNull(e.GitObject)),
		jsonstrict.P("sha256", jsonstrict.StringOrNull(e.Sha256)),
		jsonstrict.P("baselineMode", jsonstrict.StringOrNull(e.BaselineMode)),
		jsonstrict.P("baselineObject", jsonstrict.StringOrNull(e.BaselineObject)),
	)
}

func (m Migration) value() *jsonstrict.Value {
	return jsonstrict.MustObject(
		jsonstrict.P("path", jsonstrict.String(m.Path)),
		jsonstrict.P("change", jsonstrict.String(m.Change)),
		jsonstrict.P("gitObject", jsonstrict.StringOrNull(m.GitObject)),
		jsonstrict.P("sha256", jsonstrict.StringOrNull(m.Sha256)),
	)
}

// digestValue is the manifest WITHOUT candidateDigest. A digest cannot be one
// of its own inputs.
func (m *Manifest) digestValue() *jsonstrict.Value {
	entries := make([]*jsonstrict.Value, 0, len(m.Entries))
	for _, e := range m.Entries {
		entries = append(entries, e.value())
	}
	migrations := make([]*jsonstrict.Value, 0, len(m.MigrationIdentity))
	for _, mig := range m.MigrationIdentity {
		migrations = append(migrations, mig.value())
	}
	return jsonstrict.MustObject(
		jsonstrict.P("schemaVersion", jsonstrict.String(m.SchemaVersion)),
		jsonstrict.P("objectType", jsonstrict.String(m.ObjectType)),
		jsonstrict.P("repositoryId", jsonstrict.String(m.RepositoryID)),
		jsonstrict.P("stageSlug", jsonstrict.String(m.StageSlug)),
		jsonstrict.P("authorizationDigest", jsonstrict.String(m.AuthorizationDigest)),
		jsonstrict.P("baselineCommit", jsonstrict.String(m.BaselineCommit)),
		jsonstrict.P("baselineTree", jsonstrict.String(m.BaselineTree)),
		jsonstrict.P("candidateTree", jsonstrict.String(m.CandidateTree)),
		jsonstrict.P("entries", jsonstrict.ArrayOf(entries)),
		jsonstrict.P("migrationIdentity", jsonstrict.ArrayOf(migrations)),
	)
}

// Value is the complete manifest, including its own digest.
func (m *Manifest) Value() *jsonstrict.Value {
	v := m.digestValue()
	members := append([]jsonstrict.Member(nil), v.Object...)
	members = append(members, jsonstrict.P("candidateDigest", jsonstrict.String(m.CandidateDigest)))
	return jsonstrict.MustObject(members...)
}

// Bytes returns the canonical serialization of the complete manifest.
func (m *Manifest) Bytes() ([]byte, error) { return canonical.Marshal(m.Value()) }

// TopLevelFields is the complete property set of a manifest, in the order the
// committed schema declares it.
var TopLevelFields = []string{
	"schemaVersion", "objectType", "repositoryId", "stageSlug", "authorizationDigest",
	"baselineCommit", "baselineTree", "candidateTree", "entries", "migrationIdentity",
	"candidateDigest",
}

// EntryFields is the complete property set of one entry.
var EntryFields = []string{"path", "change", "mode", "gitObject", "sha256", "baselineMode", "baselineObject"}

// MigrationFields is the complete property set of one migration identity.
var MigrationFields = []string{"path", "change", "gitObject", "sha256"}

// changeKinds is the complete change enum. Anything else is a producer this
// core does not understand, not a value to interpret generously.
var changeKinds = []string{"add", "modify", "delete"}

// migrationPathRe mirrors the committed schema's migrationPath definition. A
// migration identity must actually name a migration; otherwise the separate
// record that exists so a reviewer can find applied migrations is just an
// arbitrary path wearing a migration's label.
var migrationPathRe = regexp.MustCompile(`^backend/db/migrations/[^/]+\.sql$`)

// slugRe and idRe mirror the committed schema's stageSlug and repositoryId
// constraints.
var (
	slugRe  = regexp.MustCompile(`^[A-Z0-9-]+$`)
	fieldRe = map[string]*regexp.Regexp{
		"baselineCommit":      gitIDRe,
		"baselineTree":        gitIDRe,
		"candidateTree":       gitIDRe,
		"authorizationDigest": sha256Re,
		"candidateDigest":     sha256Re,
	}
)

// requireString reads a property that must be a present, non-null string
// matching re. A wrong TYPE is reported as a type error rather than silently
// becoming "", which is how an integer or a null ends up passing a pattern
// check that was only ever applied to the empty string.
func requireString(obj *jsonstrict.Value, name string, re *regexp.Regexp, what string) (string, error) {
	member, ok := obj.Get(name)
	if !ok {
		return "", fmt.Errorf("%s is missing %s", what, name)
	}
	s, ok := member.StringValue()
	if !ok {
		return "", fmt.Errorf("%s %s is a %v, not a string", what, name, member.Kind)
	}
	if re != nil && !re.MatchString(s) {
		return "", fmt.Errorf("%s %s %q does not match its required form", what, name, s)
	}
	return s, nil
}

// nullableString reads a property that is either null or a string matching re.
// Absence is an error; only an explicit null is permitted where the schema
// declares one.
func nullableString(obj *jsonstrict.Value, name string, re *regexp.Regexp, what string) (value string, isNull bool, err error) {
	member, ok := obj.Get(name)
	if !ok {
		return "", false, fmt.Errorf("%s is missing %s", what, name)
	}
	if member.IsNull() {
		return "", true, nil
	}
	s, ok := member.StringValue()
	if !ok {
		return "", false, fmt.Errorf("%s %s is a %v, not a string or null", what, name, member.Kind)
	}
	if re != nil && !re.MatchString(s) {
		return "", false, fmt.Errorf("%s %s %q does not match its required form", what, name, s)
	}
	return s, false, nil
}

func oneOf(value string, allowed []string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

// Validate enforces the committed manifest contract in code.
//
// The producer once emitted fields the committed schema did not declare while
// the schema also set additionalProperties:false, so producer and contract
// disagreed and nothing failed. A later audit found the reverse problem: the
// validator checked field PRESENCE and a couple of patterns, but not types,
// enums, nullability, path grammar or cross-field consistency, so a manifest
// with an empty repository id, an invalid stage slug, a non-SQL migration path,
// change "BOGUS" and null migration identities was accepted while the committed
// schema rejected all five.
//
// Every authority-relevant constraint the schema declares is therefore enforced
// here, in both directions, including the cross-field invariants the schema
// implies but cannot express:
//
//   - entries are ordinal-sorted and duplicate-free, because a candidate that
//     names one path twice has no single identity for it;
//   - migrationIdentity is exactly the migration subset of entries, field for
//     field, because two records of one fact that can disagree will;
//   - candidateDigest is recomputed and must equal the declared value, because
//     a manifest that misreports its own identity is the one thing an audit
//     binding cannot survive.
//
// Where this validator is STRICTER than the schema it is deliberate and noted:
// repository paths are checked against the full safe-path grammar, which
// rejects NTFS alternate data streams and reserved device names that the
// schema's pattern alone would admit.
func Validate(v *jsonstrict.Value) error {
	if v == nil || v.Kind != jsonstrict.KindObject {
		return fmt.Errorf("manifest is not an object")
	}
	if err := exactFields(v.Names(), TopLevelFields, "manifest"); err != nil {
		return err
	}

	if s, err := requireString(v, "schemaVersion", nil, "manifest"); err != nil {
		return err
	} else if s != SchemaVersion {
		return fmt.Errorf("manifest declares schemaVersion %q", s)
	}
	if s, err := requireString(v, "objectType", nil, "manifest"); err != nil {
		return err
	} else if s != ObjectType {
		return fmt.Errorf("manifest declares objectType %q", s)
	}
	if s, err := requireString(v, "repositoryId", nil, "manifest"); err != nil {
		return err
	} else if strings.TrimSpace(s) == "" {
		return fmt.Errorf("manifest repositoryId is empty")
	}
	if _, err := requireString(v, "stageSlug", slugRe, "manifest"); err != nil {
		return err
	}
	for _, field := range []string{"baselineCommit", "baselineTree", "candidateTree", "authorizationDigest", "candidateDigest"} {
		if _, err := requireString(v, field, fieldRe[field], "manifest"); err != nil {
			return err
		}
	}

	entries, ok := v.Get("entries")
	if !ok || entries.Kind != jsonstrict.KindArray {
		return fmt.Errorf("entries is not an array")
	}
	seen := map[string]struct{}{}
	previous := ""
	migrationsFromEntries := map[string]*jsonstrict.Value{}
	for index, entry := range entries.Array {
		if entry.Kind != jsonstrict.KindObject {
			return fmt.Errorf("entry %d is a %v, not an object", index, entry.Kind)
		}
		what := fmt.Sprintf("entry %d", index)
		path, err := requireString(entry, "path", nil, what)
		if err != nil {
			return err
		}
		what = fmt.Sprintf("entry %q", path)
		if err := exactFields(entry.Names(), EntryFields, what); err != nil {
			return err
		}
		if !pathgrammar.Safe(path) {
			return fmt.Errorf("%s has an unsafe path", what)
		}
		if _, duplicate := seen[path]; duplicate {
			return fmt.Errorf("%s appears more than once", what)
		}
		seen[path] = struct{}{}
		if previous != "" && canonical.CompareOrdinal(previous, path) >= 0 {
			return fmt.Errorf("entries are not in strict ordinal order at %s", what)
		}
		previous = path

		change, err := requireString(entry, "change", nil, what)
		if err != nil {
			return err
		}
		if !oneOf(change, changeKinds) {
			return fmt.Errorf("%s has an unknown change kind %q", what, change)
		}

		mode, modeNull, err := nullableString(entry, "mode", modeRe, what)
		if err != nil {
			return err
		}
		object, objectNull, err := nullableString(entry, "gitObject", gitIDRe, what)
		if err != nil {
			return err
		}
		sum, sumNull, err := nullableString(entry, "sha256", sha256Re, what)
		if err != nil {
			return err
		}
		baseMode, baseModeNull, err := nullableString(entry, "baselineMode", modeRe, what)
		if err != nil {
			return err
		}
		baseObject, baseObjectNull, err := nullableString(entry, "baselineObject", gitIDRe, what)
		if err != nil {
			return err
		}
		_, _, _ = mode, object, sum

		switch change {
		case "delete":
			if !modeNull || !objectNull || !sumNull {
				return fmt.Errorf("delete %s must carry no candidate identity", what)
			}
			if baseObjectNull || baseModeNull {
				return fmt.Errorf("delete %s must bind the baseline object and mode it removed", what)
			}
		case "add":
			if modeNull || objectNull || sumNull {
				return fmt.Errorf("add %s must carry a complete candidate identity", what)
			}
			if !baseObjectNull || !baseModeNull {
				return fmt.Errorf("add %s must not bind a baseline object", what)
			}
		case "modify":
			if modeNull || objectNull || sumNull {
				return fmt.Errorf("modify %s must carry a complete candidate identity", what)
			}
			if baseObjectNull || baseModeNull {
				return fmt.Errorf("modify %s must bind the baseline object and mode it replaced", what)
			}
			if baseObject == object && baseMode == mode {
				return fmt.Errorf("modify %s changes neither content nor mode", what)
			}
		}

		if migrationPathRe.MatchString(path) {
			migrationsFromEntries[path] = entry
		}
	}

	migrations, ok := v.Get("migrationIdentity")
	if !ok || migrations.Kind != jsonstrict.KindArray {
		return fmt.Errorf("migrationIdentity is not an array")
	}
	declared := map[string]struct{}{}
	previous = ""
	for index, mig := range migrations.Array {
		if mig.Kind != jsonstrict.KindObject {
			return fmt.Errorf("migration identity %d is a %v, not an object", index, mig.Kind)
		}
		what := fmt.Sprintf("migration identity %d", index)
		path, err := requireString(mig, "path", migrationPathRe, what)
		if err != nil {
			return err
		}
		what = fmt.Sprintf("migration identity %q", path)
		if err := exactFields(mig.Names(), MigrationFields, what); err != nil {
			return err
		}
		if !pathgrammar.Safe(path) {
			return fmt.Errorf("%s has an unsafe path", what)
		}
		if _, duplicate := declared[path]; duplicate {
			return fmt.Errorf("%s appears more than once", what)
		}
		declared[path] = struct{}{}
		if previous != "" && canonical.CompareOrdinal(previous, path) >= 0 {
			return fmt.Errorf("migrationIdentity is not in strict ordinal order at %s", what)
		}
		previous = path

		change, err := requireString(mig, "change", nil, what)
		if err != nil {
			return err
		}
		if !oneOf(change, changeKinds) {
			return fmt.Errorf("%s has an unknown change kind %q", what, change)
		}
		object, objectNull, err := nullableString(mig, "gitObject", gitIDRe, what)
		if err != nil {
			return err
		}
		sum, sumNull, err := nullableString(mig, "sha256", sha256Re, what)
		if err != nil {
			return err
		}
		if change == "delete" {
			if !objectNull || !sumNull {
				return fmt.Errorf("delete %s must carry no candidate identity", what)
			}
		} else if objectNull || sumNull {
			return fmt.Errorf("%s must carry a complete candidate identity", what)
		}

		// Two records of one fact that can disagree eventually will. The
		// migration record must be the entry, field for field.
		entry, present := migrationsFromEntries[path]
		if !present {
			return fmt.Errorf("%s has no corresponding candidate entry", what)
		}
		entryChange, _ := mustString(entry, "change")
		if entryChange != change {
			return fmt.Errorf("%s says %q but its entry says %q", what, change, entryChange)
		}
		entryObject, entryObjectNull, _ := nullableString(entry, "gitObject", nil, what)
		entrySum, entrySumNull, _ := nullableString(entry, "sha256", nil, what)
		if entryObjectNull != objectNull || entryObject != object {
			return fmt.Errorf("%s and its entry name different objects", what)
		}
		if entrySumNull != sumNull || entrySum != sum {
			return fmt.Errorf("%s and its entry name different content", what)
		}
	}
	for path := range migrationsFromEntries {
		if _, present := declared[path]; !present {
			return fmt.Errorf("migration %q is in the candidate but absent from migrationIdentity", path)
		}
	}

	// The manifest must agree with its own identity. Everything downstream -
	// audit binding, release authorization - refers to this digest, so a
	// manifest that misreports it would bind evidence to something that was
	// never derived.
	declaredDigest, _ := mustString(v, "candidateDigest")
	body := make([]jsonstrict.Member, 0, len(v.Object))
	for _, member := range v.Object {
		if member.Name != "candidateDigest" {
			body = append(body, member)
		}
	}
	rebuilt, err := jsonstrict.Object(body...)
	if err != nil {
		return err
	}
	recomputed, _, err := canonical.MarshalDigest(rebuilt)
	if err != nil {
		return fmt.Errorf("manifest cannot be canonicalized: %w", err)
	}
	if recomputed != declaredDigest {
		return fmt.Errorf("candidateDigest %s does not cover this manifest (recomputed %s)", declaredDigest, recomputed)
	}
	return nil
}

// AuthorizedAgainst reports every manifest path the authorization does not
// permit, and refuses a manifest bound to different authority entirely.
func AuthorizedAgainst(v *jsonstrict.Value, auth authority.Authorization) ([]string, error) {
	if !auth.Valid {
		return nil, fmt.Errorf("authorization is not valid: %s", auth.Reason)
	}
	if s, _ := mustString(v, "baselineCommit"); s != auth.BaselineCommit {
		return nil, fmt.Errorf("manifest baseline %s is not the authorized baseline %s", s, auth.BaselineCommit)
	}
	if s, _ := mustString(v, "authorizationDigest"); s != auth.Digest {
		return nil, fmt.Errorf("manifest is bound to authorization %s, not %s", s, auth.Digest)
	}
	entries, ok := v.Get("entries")
	if !ok || entries.Kind != jsonstrict.KindArray {
		return nil, fmt.Errorf("entries is not an array")
	}
	var unauthorized []string
	for _, entry := range entries.Array {
		path, _ := mustString(entry, "path")
		if !auth.PathAuthorized(path) {
			unauthorized = append(unauthorized, path)
		}
	}
	return unauthorized, nil
}

func mustString(v *jsonstrict.Value, name string) (string, bool) {
	member, ok := v.Get(name)
	if !ok {
		return "", false
	}
	return member.StringValue()
}

func exactFields(present, required []string, what string) error {
	declared := map[string]bool{}
	for _, name := range present {
		declared[name] = true
	}
	var unknown []string
	for _, name := range present {
		found := false
		for _, want := range required {
			if name == want {
				found = true
				break
			}
		}
		if !found {
			unknown = append(unknown, name)
		}
	}
	if len(unknown) > 0 {
		return fmt.Errorf("%s declares undocumented properties: %s", what, strings.Join(unknown, ", "))
	}
	var missing []string
	for _, name := range required {
		if !declared[name] {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("%s is missing required properties: %s", what, strings.Join(missing, ", "))
	}
	return nil
}
