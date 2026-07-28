# SourceRoot HistoryRoot packaged installer root discovery correction v1

## Stage identity

- Name: SourceRoot HistoryRoot packaged installer root discovery correction v1
- Slug: SOURCEROOT-HISTORYROOT-PACKAGED-INSTALLER-ROOT-DISCOVERY-CORRECTION-V1
- Status: active
- Started: 2026-07-28

## Objective

Correct packaged installer repository-root discovery, rebuild package identity, and validate one complete packaged installation.

## Business value

The portable package can be installed from its documented package path
without confusing the package directory with the checked-out repository.

## Current source of truth

The checked-out repository, current root installer, and current package
manifest are canonical. The failed packaged invocation is validation
evidence, not an implementation source.

## Allowed files

- `docs/stages/active/CURRENT-STAGE.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `docs/build/historyroot-corpus-expansion-quality-stage.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/PACKAGE-MANIFEST.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1.zip`
- `ROOT-MANIFEST.json`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Current repository installer.
- Current package manifest and packaged installer.
- The supplied packaged-installer validation command and its boundary error.

## Required behavior

- Detect whether the installer is running from the repository root or the
  package folder.
- Resolve the repository to the package folder's parent for packaged
  invocation.
- Preserve repository and package containment validation.
- Produce exactly one backup and a valid installation record.

## Protected behavior

Preserve `ROOT-PROTECTED-FUNCTIONALITY.md`, Windows PowerShell 5.1 support,
the `sourceroot_test` boundary, payload hashes, backup behavior, deterministic
regeneration, and complete verification.

## Non-goals

- No corpus, frontend, API, importer, migration, or historical-content change.
- No Git history operation.

## Dependencies

The completed Chunk 8 package, local accepted release ZIPs, Node.js, Git
read-only identity checks, and `sourceroot_test`.

## Risks

Incorrect root discovery could target the package itself or a directory
outside the checkout. The installer must fail before backup or installation
when boundaries are invalid.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. The supplied packaged invocation exits 0.
2. Exactly one new backup is created.
3. `installation-record.json` exists and reports verifier exit code 0.
4. The root verifier passes while active; the corrected packaged installer
   runs the complete Chunk 8 verifier after this narrow stage is inactive.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

Not applicable; this correction is limited to installer path discovery.

## Live API checks

The installer imports only into `sourceroot_test`; the complete Chunk 8
verifier validates the resulting customer-read state.

## Required output

- Corrected repository and packaged installers.
- Refreshed package manifest and ZIP identity.
- New backup and installation-record paths.
- Exact verifier counts.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-28T10:30:37.2177165-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `backend/data/historyroot-corpus-expansion-quality-v1/corpus-inventory.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/expansion-workspace.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/historyroot-corpus-expansion-quality-v1.bundle.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.md`
- `backend/package.json`
- `backend/src/historyroot/corpus-quality-review.ts`
- `backend/src/scripts/generate-historyroot-corpus-expansion.ts`
- `backend/src/scripts/import-historyroot-corpus-expansion.ts`
- `backend/test/historyroot-corpus-expansion-quality.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/HISTORYROOT-CORPUS-EXPANSION-QUALITY-CONTRACT.md`
- `docs/build/historyroot-corpus-expansion-quality-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1.md`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-PACKAGED-INSTALLER-ROOT-DISCOVERY-CORRECTION-V1.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `ROOT-MANIFEST.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1.zip`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/data/historyroot-corpus-expansion-quality-v1/corpus-inventory.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/data/historyroot-corpus-expansion-quality-v1/expansion-workspace.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/data/historyroot-corpus-expansion-quality-v1/historyroot-corpus-expansion-quality-v1.bundle.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/data/historyroot-corpus-expansion-quality-v1/quality-review.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/data/historyroot-corpus-expansion-quality-v1/quality-review.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/package.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/src/historyroot/corpus-quality-review.ts`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/src/scripts/generate-historyroot-corpus-expansion.ts`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/src/scripts/import-historyroot-corpus-expansion.ts`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/backend/test/historyroot-corpus-expansion-quality.test.ts`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/docs/build/CURRENT-SOURCEROOT-STATE.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/docs/build/HISTORYROOT-CORPUS-EXPANSION-QUALITY-CONTRACT.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/docs/build/historyroot-corpus-expansion-quality-stage.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/PACKAGE-MANIFEST.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/README-FIRST.md`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/ROOT-MANIFEST.json`
- `SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Corrected repository-root discovery for packaged invocation. Root verifier passed active scope; complete Chunk 8 verification is delegated to the corrected packaged installer after stage completion because the original focused lifecycle test intentionally rejects successor active-stage slugs.
