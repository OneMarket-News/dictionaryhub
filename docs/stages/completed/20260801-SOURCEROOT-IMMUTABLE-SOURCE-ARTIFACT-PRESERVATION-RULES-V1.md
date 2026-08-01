# SourceRoot Immutable Source Artifact Preservation Rules v1

## Stage identity

- Name: SourceRoot Immutable Source Artifact Preservation Rules v1
- Slug: SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1
- Status: active
- Started: 2026-08-01

## Objective

Commit narrowly scoped Git attributes that preserve immutable upstream source
artifacts and pinned source documentation byte-for-byte without changing
protected sources or ordinary project-authored text.

## Business value

Every clone receives the same portable byte-preservation policy. Provenance
hashes and source identities no longer depend on a contributor's line-ending
configuration or checkout-only attributes.

## Current source of truth

The checked-out repository at release commit
`8afb1bae19dc93e18e89351958defcf960e8c7c6` is canonical. Its parent is
`b149b6bb2d39ee78557f7716975a07d1a84fcc06`, and tag
`sourceroot-bibleroot-original-language-foundation-v1` points at HEAD. No
backup, package, archive, or other checkout is an implementation source.

Preflight found a clean worktree, empty index, inactive Root stage, migration
016 present, migration 017 absent, `core.autocrlf=false`, `core.eol` unset, no
`.git/info/attributes`, and no committed root `.gitattributes`.

## Allowed files

- `.gitattributes`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION.ps1`
- `docs/architecture/SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md`

Only the six paths above may be created, modified, moved, or deleted.

## Required inputs

- `AGENTS.md`, `ROOT-MANIFEST.json`, `ROOT-PROTECTED-FUNCTIONALITY.md`, and
  `ROOT-VERIFICATION.md`
- all tracked `backend/data/**/raw/**` and
  `backend/data/**/source-docs/**` paths
- released Chunk 12 and Chunk 13A manifests, source metadata, and migration 016
- the two accepted external release ZIPs already checked by BibleRoot verifiers

## Pre-stage protected inventory

| Repository path | HEAD blob | Bytes | SHA-256 |
|---|---|---:|---|
| `backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt` | `d3ecab05c777a1b1d765574b5ae51952166a30e5` | 4,336,671 | `6DDEB05FC18E988AB569549603410FECF1A40604D826187C278B3B948A92C0E4` |
| `backend/data/bibleroot-original-language-foundation-v1/raw/Eccl.xml` | `6081b66304dac20272ebfbc7d06e498e9a61c23c` | 288,538 | `28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF` |
| `backend/data/bibleroot-original-language-foundation-v1/raw/Gen.xml` | `5cb3be5f2c65cead706ae6b0592b7a8a60d735ec` | 1,881,356 | `87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4` |
| `backend/data/bibleroot-original-language-foundation-v1/raw/Nestle1904.csv` | `6e2261001636cd9b4b2ad365f3c5bbd0776d085e` | 9,098,651 | `F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0` |
| `backend/data/bibleroot-original-language-foundation-v1/raw/Ps.xml` | `df97a48e7523ad4844feb9caf74c4eb041d22f7e` | 1,949,574 | `6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-README.md` | `fdd28fefd0a4494932192c36a20bea47f47b64d7` | 8,789 | `6B657411F03DA73738C7FF09576AD34BD3BB5575CB4218E1D3445C923C40C710` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-parsing.txt` | `19d266d7cb11ef4ef9e595383e535a833ca23216` | 5,330 | `777B2B93ACDDB162DAD0CFA9AD83C1DBA5064FD5930163704E7DA02F7EEEDDB8` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-HebrewMorphologyCodes.html` | `0b14b1b1aa434e096d67cec35a060fc51d5e56d7` | 18,944 | `4EF067CD9F2508DE19D81AAB93BF2D7E24D1687A7664C5168DE1411ADAF4EE1D` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-LICENSE.md` | `714d9774fab23335b3130543fa1dc33e88f443b5` | 1,505 | `A3572C65155CE4FD7C482F635A7E3A903B69F28051961D1E9CC92AA8A657152C` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-README.md` | `6011ccb0cc2c5b4bd5d0aadd364b0c72be621ef8` | 5,124 | `D0BE8DBBF3BDBA685B1C7C0E6E3C12265D4D113867E43DDA3D9746E6E6BB0F05` |
| `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-parsing-README.md` | `375731d7cce96201323904b744aee097acb862c1` | 7,642 | `EB804C6C7245E323EF451DF0BF5DBD51511F72AFE4DCB48537708C2A43D8515B` |

For all 11 files, the pre-stage `git hash-object --no-filters` result matched
the recorded HEAD blob.

## Required behavior

- The root `.gitattributes` contains only the two approved `-text` rules.
- Every protected source retains its pre-stage blob, byte length, and SHA-256.
- Isolated repositories with empty info attributes preserve protected bytes
  with `core.autocrlf=true` and `core.autocrlf=false`.
- Ordinary project text and normalized data remain outside both patterns.
- Migration, ZIP, index, commit, tag, and package boundaries remain unchanged.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This stage
also forbids any edit, formatting, re-encoding, normalization, staging, or
replacement under either protected path family. Migration 016, normalized
BibleRoot data, APIs, frontend files, database behavior, browser evidence,
historical verifiers, and accepted release ZIPs are immutable inputs.

## Non-goals

- no migration, database, API, frontend, browser, installer, or package work
- no source restoration or re-copy from another checkout
- no broad attributes, global EOL policy, filters, diff/merge drivers, or
  normalized/project-authored binary treatment
- no modification of local Git configuration or `.git/info/attributes`
- no Git history or remote operation

## Dependencies

Windows PowerShell 5.1 and Git are required. The isolated verifier uses only a
temporary repository below the system temp directory and deletes it after use.

## Risks

Broad patterns could silently classify normal project files as binary. Local
attributes could hide a non-portable committed policy. Renormalizing existing
sources could change evidence while appearing semantically equivalent. The
focused verifier tests exact policy text, independent attribute behavior,
scope, and all released identities.

The historical `VERIFY-BIBLEROOT-FOUNDATION.ps1` and
`VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1` encode their own former
starting HEAD, active-stage identity, and tag absence. They are not compatible
with this released maintenance lifecycle and remain unchanged. Their relevant
source, metadata, migration, ZIP, and no-package checks are represented here
with current release-baseline identities.

## Acceptance criteria

1. The root `.gitattributes` has exactly the two approved `-text` patterns.
2. All 11 protected paths retain pre-stage blobs, lengths, SHA-256, and clean
   worktree/index state.
3. Independent true/false autocrlf cases pass exact staging and
   re-materialization checks; adjacent and ordinary files remain unspecified.
4. Chunk 12 and Chunk 13A source records, migration 016, migration 017 absence,
   and accepted release ZIP identities remain unchanged.
5. Only the six allowed maintenance paths change and the index remains empty.
6. The focused and Root repository verifiers pass active and inactive states.
7. No browser or live API check is required because there is no customer,
   database, or API change.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION.ps1`

## Manual browser checks

Not applicable. This stage changes repository Git metadata and documentation
only, with no customer-visible behavior.

## Live API checks

Not applicable. This stage changes no API, service, database, or data model.

## Required output

- committed-policy working-tree file (not committed by this stage)
- architecture/preservation contract and focused verifier
- active and completed verification evidence
- completed stage record and inactive manifest
- final blob, length, SHA-256, migration, ZIP, Git status, and index report

## Completion record

- Completion date: 2026-08-01T10:52:17.6659886-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION.ps1 -> exit 0

### Changed files

- `.gitattributes`
- `docs/architecture/SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md`
- `docs/stages/completed/20260801-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Added two narrowly scoped -text path rules in the working tree, documented portable immutable-source handling, and verified all 11 protected baseline identities plus isolated core.autocrlf true/false behavior. No protected source, migration, database, browser surface, release package, Git index, commit, tag, or remote was changed.
