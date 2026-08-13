# SRGDS-CORE BUILD CONTRACT

`srgds-core` is the SourceRoot Governed Development System trust core. It owns
every security-critical decision in GDS v1.1. PowerShell orchestrates it and
must not re-derive anything it decides.

This document is TOOLING, not authority. Authority is the Product Authority's
signature over bytes in the external ACL-protected control store.

---

## 1. Why the trust core is not written in PowerShell

Four independent Tier-3 audits of the PowerShell implementation found the same
class of defect each time, and in every case the defect sat directly on top of a
documented PowerShell behaviour:

| Behaviour | What it produced |
|---|---|
| A pipeline yielding 0 or 1 element collapses to `$null` or a scalar | `.Count` threw under StrictMode, or a string was indexed as if it were a collection |
| `-eq` is case-insensitive by default | Two distinct identities compared equal |
| `ConvertFrom-Json` merges duplicate property names | A document with two conflicting values read as one |
| `UTF8Encoding` without `throwOnInvalidBytes` substitutes U+FFFD | U+D800 and U+D801 produced identical canonical bytes and one digest |
| Native output is decoded through a console code page | Non-ASCII paths and NUL-delimited records were corrupted |
| `Out-String` hard-wraps at the console width | Newlines were injected into `-z` output, splitting object ids |
| `>` writes UTF-16 | A redirected blob doubled in size |

None of these is a bug. They are properties of a language designed for
interactive administration, and they are the wrong properties for the component
that decides whether a change is authorized. The Principal Architect's ruling
moved the trust core to Go and reduced PowerShell to orchestration.

---

## 2. Toolchain

| | |
|---|---|
| Go | **1.26.5** (`go1.26.5 windows/amd64`) |
| Dependencies | **standard library only** |
| `go.sum` | **must not exist.** It is not an authorized path. If Go ever produces one, STOP and request authorization rather than adding it |
| Module path | `sourceroot.local/srgds-core` — deliberately non-fetchable, so no build can resolve this module from a network |

The toolchain is not on `PATH` in every environment. Where it is not, invoke it
by absolute path: `C:\Program Files\Go\bin\go.exe`.

### The deterministic build recipe

The binary is a **build artifact and is never committed**. It is built OUTSIDE
the repository, so that a candidate cannot supply the executable that judges it.

Plain `go build` is **not reproducible**. An audit proved it: identical module
bytes produced three different binaries from three different directories. Two
independent sources of variability were then measured directly:

| Source of variability | Evidence | Removed by |
|---|---|---|
| Source location baked into the binary | two disposable copies at different paths differed | `-trimpath` |
| VCS context stamped when building inside a work tree | with `-trimpath` alone the two copies agreed but the **repository** build still differed | `-buildvcs=false` |

Linker build-id suppression (`-ldflags=-buildid=`) was also tested. It is **not
required**: once path and VCS variability are removed the build id is already a
deterministic function of the inputs, and all three locations agree. It is
therefore not used, because a flag that changes the output without being
necessary is one more thing that must stay in sync with whatever the auditor ran.

### The governed build environment

Pinning the platform triple and inheriting everything else is **not sufficient**,
and a second audit proved it: the same source produced different executables
under an inherited `GOFLAGS` and `GOAMD64`. The builder therefore **owns** every
variable that can select a compiler, alter code generation, or inject flags.

| Variable | Value | Why, verified under go1.26.5 |
|---|---|---|
| `GOOS` | `windows` | platform |
| `GOARCH` | `amd64` | platform |
| `GOAMD64` | `v1` | unset resolves to `v1`; pinned so the recipe **states** the microarchitecture. `v3` was measured to change the binary |
| `CGO_ENABLED` | `0` | no C toolchain participates |
| `GOENV` | `off` | a hostile `go env` file was measured injecting `GOFLAGS` **and** `GOAMD64`; `off` neutralizes it |
| `GOTOOLCHAIN` | `local` | **defaults to `auto`**, which permits selecting or downloading a different compiler |
| `GOWORK` | `off` | a stray workspace file changes module resolution |
| `GOFLAGS` | *(cleared)* | inherited flags are injected into the build |
| `GOEXPERIMENT` | *(cleared)* | measured to change code generation |
| `GODEBUG`, `CC`, `CXX`, `SOURCE_DATE_EPOCH` | *(cleared)* | neutralized rather than trusted |

Deliberately **not** pinned: `GOCACHE`, `GOMODCACHE`, `GOPROXY`, `GOSUMDB`,
`TMP`/`TEMP`, locale. This module is standard-library-only with CGO disabled and
no dependencies, so they affect *where work happens*, not what is produced.
Pinning them would force a cold cache every build for no determinism gain.

### The compiler

Bound explicitly — a governed build does **not** resolve `go` from `PATH`:

| | |
|---|---|
| Executable | `C:\Program Files\Go\bin\go.exe` |
| Version | `go version go1.26.5 windows/amd64` |
| `GOROOT` | `C:\Program Files\Go` |

Both the version and `GOROOT` are checked **inside** the governed environment,
after `GOTOOLCHAIN=local` is in force, so a redirected toolchain cannot answer
the question about itself.

### The exact recipe

Run from `tools/srgds-core`, with the environment above:

```bash
go build -trimpath -buildvcs=false -o "C:\ProgramData\SourceRoot\GDS\bin\srgds-core.exe" .
```

`SRGDS_CORE_PATH` overrides the install location; the PowerShell module fails
closed when the binary is absent, with no fallback.

Reproducibility is not trusted because it is written down — it is exercised:

```bash
pwsh ./INSTALL-SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING.ps1 -Action reproducible
```

That control builds the same source from the repository and from two disposable
copies at different filesystem paths, requires one distinct SHA-256 across all
three, requires the resulting binary to answer and self-report that same digest,
and then rebuilds it under a **hostile parent environment** — inherited
`GOFLAGS`, `GOAMD64=v3`, `GOEXPERIMENT`, `GOTOOLCHAIN=auto`, a hostile `GOENV`
file, a stray `GOWORK`, and all of them combined — requiring the same digest
every time. Each of those was measured to be capable of changing the output
before it was pinned; the control exists to prove the pin still holds.

### Binary identity binding

Reproducibility alone only proves that a recipe is stable. It does not connect
the audited decision procedure to the one actually running. That chain is:

```
candidate source identity   (candidateDigest, from the candidate tree)
        |
deterministic build recipe  (pinned above)
        v
binary SHA-256              (srgds-core version -> coreBinarySha256)
        |
independent audit evidence  (the auditor runs THAT binary)
        v
AuditBinding.binarySha256   (signed, external control store)
        |
ReleaseAuthorization.binarySha256
        v
release package
```

`srgds-core version` reports `coreBinarySha256`, the SHA-256 of the executable
that is answering. The auditor records it. `release-gate` then requires all
three to agree: the audit binding's `binarySha256`, the release authorization's
`binarySha256`, and the digest of the binary actually running. A different
binary — even one built from nominally similar source — cannot satisfy a release
authorization bound to the audited one.

The executable is never committed, and no repository-local file is the authority
for its own hash. The hash becomes trustworthy when it is independently
reproduced and then bound into the external signed audit and release objects,
where the candidate that produced it cannot reach.

### Test

```
go vet ./...
gofmt -l .
go test ./...
```

All three must be clean. `gofmt -l` must print nothing.

---

## 3. Package boundaries

| Package | Owns | Must never |
|---|---|---|
| `internal/jsonstrict` | Strict JSON parsing and the value tree | Accept duplicate names, non-integers, lone surrogates, raw control characters, or a BOM |
| `internal/canonical` | The one byte form, and SHA-256 | Emit whitespace, a trailing newline, or a substituted character |
| `internal/pathgrammar` | Which repository paths a signed object may name | Normalize an unsafe path into a safe one |
| `internal/gitexec` | Running Git | Read a non-zero exit as an empty result, or parse porcelain |
| `internal/authority` | Complete signed authorization validation, including SSHSIG | Select authority by existence, recency, or sort order |
| `internal/candidate` | Candidate tree, manifest, candidate digest | Write to the repository |
| `internal/lifecycle` | The state machine | Allow AUDIT_PASSED to reach RELEASED |

Import direction is one-way: `jsonstrict` → `canonical` → everything else. There
are no cycles and no shared mutable state.

---

## 4. Command and exit-code contract

```
srgds-core version
srgds-core authority-verify    -repo DIR -stage SLUG -authorization-id UUID
                               -expected-digest SHA256 -signer-fingerprint SHA256:...
                               -signer-principal NAME
                               [-repository-id ID] [-control-store DIR]
srgds-core candidate-manifest  <authority flags> [-out FILE]
srgds-core path-check          <authority flags> -path PATH [-path PATH ...]
srgds-core lifecycle-check     -from STATE -to STATE
srgds-core canonical-digest    -file FILE
```

| Exit | Verdict | Meaning |
|---|---|---|
| 0 | `ACCEPT` | The question was answered affirmatively |
| 3 | `REJECT` | The question was answered negatively, with a reason |
| 2 | `ERROR` | The question could not be answered at all |

Every command prints one canonical JSON verdict on stdout carrying at least
`core`, `command`, `verdict` and `reason`. The verdict and the exit code must
agree; a caller that observes them disagreeing must treat the binary as
untrusted. A caller that cannot distinguish 3 from 2 must treat both as failure.
**There is no exit code that means "probably fine".**

---

## 5. Invariants the core enforces

### Authority selection

Selection is stated by the CALLER, in execution context, as a pair that must
BOTH hold: `-authorization-id` and `-expected-digest`. Nothing is selected
because it exists, because it is newest, or because its UUID sorts highest, and
the store is never enumerated.

`<stageSlug>.<authorizationId>.authorization.json` is resolved first. The
historical unversioned `<stageSlug>.authorization.json` is consulted only when
no file carries the requested id, and whatever it holds must still prove its own
id. **A request for one issuance can never be answered by another.**

### Signature

SSHSIG is verified directly against the wire format with `crypto/ed25519`, not
by running `ssh-keygen` and reading its English output. The key must be listed
for the principal, the principal's `namespaces=` restriction must admit the
namespace, the signature's embedded key must be the listed key, and the signed
blob must carry the expected namespace. An `allowed_signers` option this core
does not implement **fails closed**: honouring the line while ignoring the
option would grant more than was written down.

### Canonical form

Signed bytes must re-serialize to themselves. A signature over non-canonical
bytes binds a form the system cannot reproduce and therefore cannot re-verify.

Object keys are ordered by **UTF-16 code unit**, reproducing .NET's
`StringComparer.Ordinal`. That is the inherited contract: the Product Authority
has already signed objects whose key order .NET produced, and an implementation
that ordered keys differently would compute a different digest for the same
object.

The two candidate orderings genuinely disagree. .NET compares UTF-16 code units,
so a supplementary character is a surrogate pair beginning at 0xD800 and sorts
BEFORE U+E000..U+FFFF. Comparing UTF-8 bytes, or Go runes, orders by code point:

```
UTF-16 ordinal:  U+D7FF  <  U+10000  <  U+E000  <  U+FFFF
code point:      U+D7FF  <  U+E000   <  U+FFFF  <  U+10000
```

An earlier revision resolved this by rejecting names at or above U+E000, which
removed both sides of every divergent pair. That made the implementations agree,
but only by shrinking the valid Unicode input domain to fit a serializer detail.
**The domain belongs to the authority schema, not to the serializer.** Valid
Unicode names are accepted and the ordering is reproduced instead;
`canonical.CompareOrdinal` is the single comparator, and `pathgrammar` uses it
for signed path-set ordering for the same reason.

Still rejected: malformed Unicode, lone surrogates, invalid UTF-8 and WTF-8,
structurally invalid JSON.

The expected order in `TestCanonicalKeyOrderIsUTF16Ordinal` is not derived from
reading the spec. It is the order .NET actually produced for those exact strings,
and the test additionally asserts that Go's native comparison *disagrees* — so
the test cannot pass vacuously.

### Paths

`allowedPaths` match **exactly**. `protectedPaths` match by **segment prefix**,
so `backend` covers `backend/file.txt` but never `backend-old/file.txt`.
Protection is evaluated first and always wins.

There is **no directory grant**. An entry spelled `internal/` would authorize
files nobody enumerated, including files that do not exist yet. `Safe()` rejects
a trailing slash, so such an entry cannot be signed at all.

### Candidate identity

```
signed baseline commit
      |
real index --copy--> TEMP INDEX (disposable GIT_INDEX_FILE)
      |
git add -A  overlays the effective worktree
      v
git write-tree -> CANDIDATE TREE   (written to a disposable GIT_OBJECT_DIRECTORY,
      |                             with the repository's object database attached
      |                             as a read-only alternate)
      v
git diff-tree --raw -r -z --no-renames --no-abbrev  baselineTree candidateTree
```

Deriving a candidate is **read-only**: the canonical index, the object database,
HEAD and refs are all left exactly as they were. The workspace is removed on
success and on failure alike, and cleanup never masks an in-flight error.

`sha256` is hashed from the bytes of the blob the CANDIDATE TREE names, so
`gitObject` and `sha256` always describe the same content. Git's own reported
size is checked, so a truncated read is detectable. Renames are **delete + add**:
rename detection is a similarity heuristic, and a heuristic that decides which
two paths are "the same file" is not a judgement to record in a governance
object.

### The governed Git executable — PATH is not authority

An audit sanitized every Git environment variable and **still substituted the
candidate**. The core resolved `git` through ambient `PATH`, so a wrapper placed
earlier in `PATH` received the carefully sanitized environment, reintroduced
`GIT_WORK_TREE`, invoked the real Git, and returned a substituted candidate that
was ACCEPTED.

The lesson is precise and worth stating plainly:

> **Sanitizing environment variables is insufficient when the executable itself
> is selected through ambient PATH.** A clean environment handed to an attacker's
> binary is just a clean environment handed to an attacker.

The governed Git subprocess boundary is therefore four things together:

```
explicit executable identity  +  direct invocation
+  sanitized environment      +  explicit Git configuration
```

| | Observed on the governed workstation |
|---|---|
| Executable | `C:\Program Files\Git\cmd\git.exe` |
| Version | `git version 2.52.0.windows.1` |
| SHA-256 | `3CBD024D9D11EF08BD6A0CB5A973613C50825B4952BC6006F3F4222F436091E5` |

These were **measured, not assumed**. `C:\Program Files\Git\bin\git.exe` is the
same launcher byte-for-byte; `mingw64\bin\git.exe` is the 4.3 MB implementation
and a *different* digest — which is why the pin names one exact path.

`gitexec` enforces, before every authority-sensitive invocation and in this
order so each failure names its own cause:

1. the path is **absolute** — a relative path resolves against a working
   directory, which must not decide anything;
2. it is an existing **regular file**;
3. `--version` executed **through that exact path** matches the contract — a
   PATH-resolved binary is never allowed to vouch for the pinned one;
4. the **SHA-256** matches the audited bytes.

Failure is **fail-closed**. There is no PATH fallback, because there is no
PATH lookup: `exec.LookPath` is never called, `exec.Command("git", …)` never
appears, and Git is never invoked through `cmd.exe`, PowerShell, a shell
association, or `PATHEXT` resolution.

**On binding the Git SHA-256.** It was adopted after testing rather than
assumed. The launcher is a stable 46,480-byte file whose digest does not move
between runs, so binding it is practical for this release. The cost is
deliberate and accepted: upgrading Git will fail verification until the contract
is updated. That is the intended behaviour — a change to the executable that
decides candidate identity must be noticed, not absorbed. Because the pins live
in the core's own source, changing them changes the core binary's SHA-256, which
the audit binding is already bound to.

`srgds-core version` reports `gitExecutable`, `gitVersion` and `gitSha256`
alongside `coreBinarySha256`, and REJECTS if the Git identity does not verify.

`-Action routing` proves it. A **fully functional** wrapper — one that logs every
invocation and forwards to the real Git — is planted first in `PATH`, and each
case must first demonstrate that ordinary resolution reaches it and logs. The
assertion is then stronger than "the candidate is unchanged": the wrapper must
receive **zero** governed invocations. An empty log is the proof.

### The overlay does not use `git add`

A second audit proved candidate identity was still host-dependent: the same
governed bytes and the same authorized modifications produced a different
candidate tree and digest on a machine with hostile external attributes, and it
was **accepted with zero unauthorized paths**. A candidate identity a
workstation can change is not an identity.

`git add -A` is convenient and wrong here, because it runs content through the
clean-filter and text-conversion machinery, and *which* transformations apply is
decided by attributes and filter drivers configurable outside the repository.
The overlay therefore places bytes directly:

```
git hash-object -w --no-filters --stdin-paths   raw file bytes to blobs: no clean
                                                filter, no CRLF conversion, no
                                                attribute lookup at all
git update-index --index-info                   mode, object id and path written
                                                straight into the temporary index
```

Neither command consults a filter driver, so an externally configured
`filter.<name>.clean` or `.process` cannot run, and `filter.<name>.required`
cannot break the build either. Both are batched through stdin, so the whole
worktree costs two processes rather than one per path.

Mode intent still comes from the seeded index, which is why a staged `chmod +x`
that a Windows worktree cannot express survives.

**Candidate identity is the raw bytes on disk.** Repository-tracked
`.gitattributes` remains governed content and still describes the repository; it
simply no longer decides what the candidate *is*.

Three further host inputs are neutralized: `core.attributesFile` is redirected to
a GDS-controlled empty file inside the disposable workspace, `GIT_ATTR_NOSYSTEM=1`
disables the system attributes file that no `-c` setting can reach, and the
candidate-byte contract is passed on **every** invocation rather than relying on
repository-local configuration.

`-Action attributes` proves it. Each hostile configuration must first
**demonstrate potency** — that it really does rewrite the object id, or break a
required driver — and only then is the governed candidate required to be
identical in digest, tree, entry count, and every individual entry identity. A
control that cannot demonstrate the attack proves nothing, and an earlier
revision of this control was rejected here for exactly that reason.

### Git subprocess environment is not authority

`git -C <repository>` selects a working directory; it does **not** neutralize
Git's repository-local environment. A Tier-3 audit set `GIT_WORK_TREE` to an
empty disposable directory and the pre-correction core returned `ACCEPT` for a
five-entry candidate, silently omitting all 25 untracked additions in the real
worktree. Its digest and tree were internally consistent and it had zero
unauthorized paths. They simply described the wrong candidate.

Every Git subprocess therefore starts from `cmd.Environ()` — preserving the
Windows hidden per-drive working-directory entries Go derives from `cmd.Dir` —
but removes, case-insensitively, every repository-local variable reported by
`git rev-parse --local-env-vars`:

```
GIT_ALTERNATE_OBJECT_DIRECTORIES  GIT_OBJECT_DIRECTORY   GIT_SHALLOW_FILE
GIT_CONFIG                        GIT_DIR                GIT_COMMON_DIR
GIT_CONFIG_PARAMETERS             GIT_WORK_TREE          GIT_GRAFT_FILE
GIT_CONFIG_COUNT                  GIT_IMPLICIT_WORK_TREE GIT_INDEX_FILE
GIT_NO_REPLACE_OBJECTS            GIT_REPLACE_REF_BASE   GIT_PREFIX
```

Numbered command-scoped configuration (`GIT_CONFIG_KEY_*` and
`GIT_CONFIG_VALUE_*`) is removed as part of the same boundary. Only values the
core deliberately owns are appended afterward: the fixed Git contract and the
disposable workspace's index/object-store routing. These ambient variables
cannot select the repository, worktree, index, objects, refs, shallow boundary,
replacement objects, or numbered command-scoped configuration used to make a
trust decision.

`-Action environment` proves this at the installed-core boundary. Each hostile
case must first change or break ordinary Git (the potency control), then the
governed candidate must remain authorized and identical in digest, tree, entry
count, and every entry. Unit tests independently exercise both the runner and
the complete candidate builder under combined hostile routing.

### Lifecycle

`AUDIT_PASSED` does not reach `RELEASED`. Release requires a separate,
separately signed `RELEASE_AUTHORIZED` step, because a passing audit is evidence
and never approval. `RELEASED` is terminal.

### No baseline bypass

There is no parameter, switch or struct field that skips the HEAD-equals-
baseline check. The PowerShell implementation carried `-SkipHeadCheck` for test
convenience and an audit proved it produced a fully authoritative object on the
wrong HEAD. **A bypass that exists for tests is a bypass that exists.** Tests
build a real repository and sign a real baseline.

---

## 6. Producer / schema / validator agreement

Three artifacts describe the candidate manifest and must agree exactly:

1. the producer, `internal/candidate`
2. the committed schema, `governance/schemas/gds-authority-lifecycle-v1.schema.json`
3. the validator, `candidate.Validate`

`TestCommittedSchemaMatchesProducer` reads the committed schema and compares its
declared property sets and `required` lists against the producer's field lists in
both directions. That test alone was **not sufficient**, and an audit proved it:
shape agreement said nothing about types, enums, nullability, path grammar or
cross-field consistency, so a manifest with an empty repository id, an invalid
stage slug, a non-SQL migration path, `change: "BOGUS"` and null migration
identities was accepted while the committed schema rejected all five.

`candidate.Validate` now enforces every authority-relevant constraint the schema
declares — required/optional, nullability, type, enum, pattern, length, identity
format and path grammar — in both directions, plus the cross-field invariants
the schema implies but cannot express:

- entries are ordinal-sorted and duplicate-free;
- `migrationIdentity` is exactly the migration subset of `entries`, field for
  field, so two records of one fact cannot disagree;
- `candidateDigest` is recomputed and must cover the manifest, so a manifest
  cannot misreport the identity every downstream binding refers to.

Where the validator is deliberately **stricter** than the schema, it is noted in
code: repository paths are checked against the full safe-path grammar, which
rejects NTFS alternate data streams and reserved device names that the schema's
pattern alone would admit.

`TestValidateFailsClosedOnEverySchemaRule` is table-driven: it mutates a real
generated manifest one field at a time across 42 cases and requires FAIL CLOSED
on each. Every mutation **reseals** the manifest first — recomputing
`candidateDigest` — so each rule must fire on its own merits rather than being
masked by the self-consistency check, which is tested separately. No third-party
JSON Schema dependency was added; typed validation is authoritative because it
demonstrably enforces the committed contract.

---

## 7. Change discipline

The core is authority-adjacent code. Changing it changes what "authorized"
means.

- Every defect repaired here is named at the site of the repair. A defect that is
  silently corrected teaches nothing, and the next implementer reintroduces it.
- New behaviour arrives with the adversary case that would have caught its
  absence.
- No behaviour is added because a test is inconvenient. The bypass field removed
  in Wave G3 is the standing example.
