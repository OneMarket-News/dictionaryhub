# SourceRoot Chunk 8 post-seal whitespace correction

## Stage identity

- Name: SourceRoot Chunk 8 post-seal whitespace correction
- Slug: SOURCEROOT-CHUNK8-POST-SEAL-WHITESPACE-CORRECTION
- Status: active
- Started: 2026-07-28

## Objective

Remove only three trailing blank lines, refresh the sealed release package, and verify the corrected packaged installation.

## Business value

The sealed release passes both unstaged and staged Git whitespace checks
without changing corpus behavior or documentation meaning.

## Current source of truth

The checked-out repository is canonical. The existing external Chunk 8
package is an output to replace from final repository bytes.

## Allowed files

- `backend/src/scripts/generate-historyroot-corpus-expansion.ts`
- `backend/src/scripts/import-historyroot-corpus-expansion.ts`
- `docs/build/HISTORYROOT-CORPUS-EXPANSION-QUALITY-CONTRACT.md`
- `docs/build/historyroot-corpus-expansion-quality-stage.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `ROOT-MANIFEST.json`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- The three named repository files with one extra blank line at EOF.
- The completed Chunk 8 stage record.
- The current external package manifest, folder, ZIP, and corrected installer.

## Required behavior

- Remove only one extra final newline from each named file.
- Preserve exactly one normal final newline.
- Keep the complete working tree unstaged after temporary index validation.
- Refresh all changed package payloads, manifest hashes, and ZIP bytes.

## Protected behavior

Preserve all behavior in `ROOT-PROTECTED-FUNCTIONALITY.md`, all corpus
semantics, the accepted `sourceroot_test` state, installer behavior, and
immutable prior releases.

## Non-goals

- No semantic code, documentation, corpus, frontend, API, importer, or
  migration changes.
- No repeated backend total, browser smoke, product baseline, or immutable
  replay runs.
- No Git history operation.

## Dependencies

Git index access for the bounded temporary check, the completed Chunk 8
release, Windows PowerShell 5.1, and `sourceroot_test`.

## Risks

Line-ending conversion can produce unrelated Git advisories. Package
self-reference requires the final stage-record snapshot to be refreshed
before the authoritative ZIP is constructed.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Both Git whitespace checks exit 0 with zero output.
2. Nothing remains staged.
3. The external package manifest validates every payload.
4. The corrected packaged installer exits 0, creates exactly one backup,
   writes its installation record, and records verifier exit code 0.
5. The final Chunk 8 and root verifiers pass.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

Not applicable and explicitly excluded from this post-seal correction.

## Live API checks

The packaged installer may import only to `sourceroot_test` and must leave
the accepted Chunk 8 replacement state.

## Required output

- Corrected three repository files.
- Refreshed external package folder, manifest, and ZIP.
- Updated Chunk 8 stage record.
- Authoritative backup, installation record, ZIP size/hash, and verifier
  counts.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-28T13:25:49.9325944-05:00
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
- `docs/stages/completed/20260728-SOURCEROOT-CHUNK8-POST-SEAL-WHITESPACE-CORRECTION.md`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1.md`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-PACKAGED-INSTALLER-ROOT-DISCOVERY-CORRECTION-V1.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Removed only the extra final blank line from the three named files. Both unstaged and temporary-staged whitespace checks passed with zero output; the index was restored empty. External package refresh and installer validation follow in inactive-stage acceptance.
