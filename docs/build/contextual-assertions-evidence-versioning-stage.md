# SourceRoot Chunk 4 — Contextual Assertions, Evidence, and Versioning v1

## Stage identity

- Package: `SourceRoot-Contextual-Assertions-Evidence-Versioning-v1`
- Installer: `INSTALL-SOURCEROOT-CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING.ps1`
- Verifier: `VERIFY-SOURCEROOT-CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING.ps1`
- Migration: `backend/db/migrations/012_refine_contextual_assertions_evidence_versioning.sql`
- Focused suite: `backend/test/contextual-assertions-evidence-versioning.test.ts`
- Contract: `docs/build/CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING-CONTRACT.md`
- Next dependency: SourceRoot Chunk 5 — Context API and Review Experience

## Exact starting checkpoint

- Repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `dfa306c46cdd5ec03f929b84b5ad6042de7d79e7`
- Tag: `sourceroot-contextual-identity-time-refinement-v1`
- Tag target: `dfa306c46cdd5ec03f929b84b5ad6042de7d79e7`
- Starting worktree: clean
- Prior ZIP: `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-Contextual-Identity-Time-Refinement-v1.zip`
- Prior ZIP SHA-256: `1cd1c8e97b99955a84ac1ba46e0fc9405cba786d62ca13b2ed5b016631ddf8ff`

Earlier immutable ZIP digests:

- Chunk 0: `e9cb42323bca5bddf3bcdccefc738f0e96d48289d7a99ddaa35912dc7a24b2bd`
- Chunk 1: `a519114ae8bf7949afd91852bfe03ac19965dc2f975b53363acd38cc65da2980`
- Chunk 2: `00b29762befef901c854944f740ea0c032dd9cc71a9c5cf037ccb13368b9455f`
- Chunk 3: `1cd1c8e97b99955a84ac1ba46e0fc9405cba786d62ca13b2ed5b016631ddf8ff`

## Mandatory inventory findings

Migration 012 was confirmed as the next safe filename. Migrations 001–011, including both migration 005 files, were treated as immutable.

The core SourceRoot `assertions` registry is separate from contextual `claims`. Contextual claims remain one of the ten existing contextual record kinds and retain their account relationship. Accounts, sources proving a claim was recorded, evidence/counterevidence, and interpretations remain distinct.

Existing `context_record_sources` records provenance/association and does not establish evidentiary support. Existing contextual evidence retains its legacy `evidenceType` and at-least-one-basis requirement.

The generic `revisions` ledger is bundle-owned and cascade-deletable. It has no per-parent ordinal, same-parent predecessor constraint, immutable content hash, or current pointer. Governance publications already preserve prior/published snapshots and rollback audit. The architecture therefore reuses revisions and governance for workflow correlation while adding normalized immutable claim/evidence versions for content lineage. No second workflow or duplicate contextual record registry was created.

Bundle replacement previously deleted import-owned contextual rows by bundle. Chunk 4 keeps current normalized children import-owned but deliberately keeps immutable version rows and pointers independent of bundle/parent foreign-key cascades. A narrow transaction-local integration-test override is the only application cleanup path for those rows.

Search previously included core registries plus contextual entities, accounts, claims, interpretations, and relationships. Detail projections were built from `context_records.raw_data` plus normalized children. Both were extended additively.

## Baseline before implementation

The resolved database name was proven to be exactly `sourceroot_test` before database commands.

- Existing Chunk 3 installer syntax: PASS
- Existing Chunk 3 verifier syntax: PASS
- TypeScript: PASS
- Test migration through 011: PASS
- Chunk 3 focused: 13/13
- Legacy contextual: 15/15
- Registry contract: 11/11
- Observability: 10/10
- Governed HistoryRoot: 12/12
- Full backend: 168/168
- SourceRoot baseline: 15 pass, 0 fail, 0 warning
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warning

Exact prior ZIP hashes matched the approved digests. Exact isolated Chunks 0–2 verification passed through the unchanged Chunk 3 chain. The unchanged Chunk 3 current-product, focused, and package checks passed. Composite historical isolation also exposed a pre-existing harness limitation: the unchanged verifier can load newer working-tree tests beside an older runtime, and Git-checkpoint line-ending bytes differ from immutable package bytes for a migration hash check. The old verifier and immutable package were not weakened, rewritten, normalized, or reconstructed.

## Implementation

Added:

- normalized claim attributions and attribution-source links;
- explicit claim relations and relation-source links;
- normalized evidence-to-claim/version links and link-source rows;
- bounded source locators;
- immutable claim/evidence version rows, same-parent lineage constraints, deterministic hashes, current pointers, and mutation-blocking triggers;
- transactional idempotent import and version conflict handling;
- replacement retention and explicit test-only cleanup;
- governed child snapshot preservation and append-only publication/rollback versions;
- claim/evidence detail projections;
- five read-only Registry API Contract 1.0 collections;
- current evidence and historical claim-version search;
- expanded field provenance;
- deterministic Level 1 observer findings and operations categories; and
- 19 focused integration tests.

No frontend file, public contextual write route, truth engine, semantic inference, external lookup, or new governance workflow was added.

## Migration behavior

Migration 012 adds only new tables, constraints, indexes, triggers, and one optional evidence uncertainty column. Legacy rows remain valid and no history is fabricated.

Version rows retain logical IDs and originating bundle/source values without foreign keys to import-owned parents. Same-parent composite foreign keys protect predecessor, current pointer, and targeted claim-version ownership. Version update/delete triggers fail closed except for the transaction-local integration-test cleanup marker.

Migration execution against `sourceroot_test`: PASS.

## Verification results

- TypeScript: PASS
- Migration: PASS
- Chunk 4 focused: 19/19
- Chunk 3 focused: 13/13
- Legacy contextual: 15/15
- Registry: 11/11
- Search/full compatibility: PASS
- Governance: 12/12
- Observability: 10/10
- Full backend: 187/187
- SourceRoot baseline: 15 pass, 0 fail, 0 warning
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warning
- Chunks 0–3 isolated verification: PASS through the unchanged prior verifiers and exact approved ZIP hashes
- Chunk 4 verifier: 45 pass, 0 fail, 0 warning, 7 informational
- Installer: PASS

The first complete post-implementation run exposed one changed legacy search-error message and stopped at 186/187. The exact legacy message was restored; the subsequent authoritative run passed all 187 tests.

## Package and installation

- Package folder: `SourceRoot-Contextual-Assertions-Evidence-Versioning-v1`
- ZIP: `SourceRoot-Contextual-Assertions-Evidence-Versioning-v1.zip`
- Installer-test ZIP SHA-256: `d8d018da20d936fb404c7ca6343156e31d4fb8223780a472158cbeb58af7db32`
- Final ZIP SHA-256: calculated after final archive assembly and reported with the delivered ZIP; it cannot be self-embedded without changing that digest
- Payload: 7 added files and 17 complete replacement files
- Payload hashes: recorded one-per-file in `manifest/stage-manifest.json`
- Installed hashes: PASS, all 24 installed files matched the installer-test payload
- Backup path: `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-contextual-assertions-evidence-versioning-v1-20260726-123751-553`
- Installation record: `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-contextual-assertions-evidence-versioning-v1-20260726-123751-553\installation-record.json`

The installer-test package was verified before these post-installation result lines were written. The final package is rebuilt from the resulting repository files, receives fresh manifest hashes, and is byte-audited after assembly.

## Browser and live API status

- Browser verification: not performed; no frontend files changed.
- Independent live API verification: not performed. API behavior is covered through Supertest integration tests, which is not an independent running-server check.

## Known limitations

- Detail projections are bounded at 10,000 child/history rows; paginated collections provide the complete public history path.
- Import predecessor/version references resolve inside the supplied contextual bundle. Governed append uses existing database current state.
- Rollback of a newly created record retains the governed publication version and generic rollback revision while making the new record nonpublic; no empty restoration version is fabricated.
- Historical verification uses an isolated temporary Git repository fixed to each prior stage's actual starting commit. Already hash-validated prerequisite migration bytes are overlaid where Git-archive line endings differ from the immutable Windows release bytes. Prior verifiers, prior migrations, and prior release artifacts are not modified.
- This stage does not claim production readiness.

## Next dependency

SourceRoot Chunk 5 — Context API and Review Experience

Chunk 5 was not started.
