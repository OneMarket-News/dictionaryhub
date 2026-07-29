# DictionaryRoot Corpus Scaling Acquisition Gate — Stage Evidence

## Starting gate

- Canonical repository:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Starting commit:
  `01eab17573f5eb9a6e957093496c500cf67a07db`
- Branch: `release/historyroot-alpha-integration-v1`
- Remote branch: same commit, verified read-only with `git ls-remote`
- Tag: `sourceroot-historyroot-wampanoag-regional-corpus-v1`
- Local and remote dereferenced tag: same commit
- Chunk 9 ZIP:
  `SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip`
- ZIP SHA-256:
  `D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29`
- Initial worktree/index: clean/empty
- Initial root stage: inactive
- Database: exactly `sourceroot_test`
- Migrations: 001–012 present; 013 absent
- HistoryRoot accepted dataset:
  `historyroot-plymouth-knowledge-dataset-v1` `1.3.0`
- Initial root verifier: 51 passes, 0 warnings, 0 failures

No release package folder or ZIP was found inside the repository. Existing
HTML files whose names describe package inspection or registry experiences are
application source, not release packages.

## Stage scope

The active stage authorizes exactly the ten gate deliverables plus
`ROOT-MANIFEST.json` and `docs/stages/active/CURRENT-STAGE.md`. Preflight
changed files were zero.

Production corpus data, imports, migrations, frontend/API/importer changes,
authentication, unrelated HistoryRoot work, packages/installers, and Git
operations are prohibited.

## Research evidence boundary

Rights and access findings use publishers, responsible institutions, official
license/terms pages, and stable public archive catalogs. Candidate records
preserve the evidence URL and do not infer reuse from public visibility.

No source content was scraped or acquired for production. The gate records
only metadata, rights findings, feasibility projections, and modeling
decisions.

## Baseline evidence

The repository bundle metrics were calculated directly from the accepted JSON
artifact. Database identity, applied migrations, HistoryRoot version, and the
absence of a DictionaryRoot lexical dataset row were checked through read-only
SQL. No database statement modified data.

## Determinism contract

The generator writes `candidate-sources.json` and `feasibility-report.json`
with:

- candidate IDs sorted ordinally;
- stable array ordering;
- two-space JSON indentation;
- UTF-8 encoding; and
- exactly one final LF.

Focused tests generate into two independent temporary directories and require
equal byte length, SHA-256, byte equality, and equality with the repository
artifacts.

## Final recommendation

**CONDITIONAL GO**

There are zero acquisition blockers, 17 accepted reusable sources, five
rejected/reference-only sources, a defensible stratified scope, and a path to
every mandatory minimum without restricted modern definition reproduction or
invented lexical certainty.

Production remains conditional on an approved normalized lexical
claim/form/etymology/locator/provenance/comparison model, matching API
contracts, targeted frontend decisions, and license/lineage isolation review.

## Negative confirmations

- No production corpus was generated.
- No database data changed.
- No frontend source changed.
- No API route changed.
- No importer implementation changed.
- No migration was added.
- No package or ZIP was created.
- No Git-history operation was performed.
