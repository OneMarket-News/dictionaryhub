# Repeatable Source Preparation Workflow Contract

## Purpose and boundary

SourceRoot source preparation v1 is a deterministic, local, review-first
layer that converts supplied human-reviewed material into the existing
`sourceroot-import-bundle` structure. It performs no research, retrieval,
scraping, OCR, summarization, factual verification, legal determination,
claim generation, inference, import, or network access.

The workspace schema version is `1.0.0`. Preparation-only status, review,
rights, content-use, omission, source-identity, and approval metadata wraps
accepted SourceRoot objects. Those wrappers never enter the generated bundle.
Only accepted bundle fields and a bounded `extensions.sourcePreparation`
identifier are emitted. The existing SourceRoot validator and importer remain
authoritative; this workflow is not a second schema, importer, source
registry, contextual model, public editor, database workflow, queue, or
background worker.

## Workspace and statuses

The workspace envelope contains identity and review metadata plus `sourceSet`,
`accounts`, `records`, `claims`, `historicalNames`, `dateExpressions`,
`relationships`, `sourceLocators`, `evidence`, `evidenceLinks`,
`claimRelations`, and `fieldProvenance`.

Preparation status is exactly `draft`, `needs_review`, `approved`, or
`omitted`. Draft and omitted objects are never emitted. Omitted objects need a
reason. Approved objects need an approval record and may not depend on a
draft, review-blocked, omitted, or missing object. Workspace-level approval is
mandatory for generation.

## Modes

- `validate` reads one workspace, prints a concise result, returns nonzero for
  blockers, writes no output, and never returns an approved bundle.
- `preview` writes deterministic JSON and Markdown validation reports,
  including summaries and the proposed bundle hash, visibly labels them as
  preview material, and writes no importable bundle.
- `generate` writes `sourceroot-approved.bundle.json` and validation reports
  only after every approval, rights, reference, locator, evidence, status, and
  accepted-schema gate passes.

There is no import mode. Importer compatibility is exercised only by
controlled tests against `sourceroot_test`.

## Identity, accounts, and claims

Source review distinguishes original works, archival objects, later
transcriptions, modernized and scholarly editions, compilations, catalog
records, digital surrogates, museum interpretations, tribal and government
institutional accounts, and scholarly analysis. Original-work, edition,
transcription, compilation, catalog, and digital-object identifiers remain
separate when supplied.

Reporting accounts preserve who reported a statement, the source relationship,
the reporting period, editorial context, limitations, and provenance. An
account is not proof that its report is true. Stable semantic record IDs and
accepted contextual kinds are preserved. Duplicate IDs and supplied canonical
identity collisions fail; no automatic identity merge occurs.

Claims retain scoped statements, subjects, reporting accounts, sources,
locators, evidence relationships, claim relationships, and field provenance.
Truth scores, reliability percentages, combined confidence, automatic
conflict resolution, generated conclusions, unattributed claims, and
machine-authored interpretations are rejected.

## Rights and content use

Preparation rights classifications are `public_domain`, `open_license`,
`permission_granted`, `metadata_and_link_only`, `restricted`, and `unknown`.
Content use is `metadata_only`, `paraphrase_only`, `short_quote`, or
`public_domain_excerpt`.

Public-domain review requires a supplied basis; open-license review requires a
license identifier; permission-granted review requires a permission basis.
Unknown, restricted, and metadata-and-link-only sources cannot carry copied
excerpts. Short quotes and public-domain excerpts require a compatible
affirmative supplied basis. The workflow validates supplied review metadata
only and provides no legal certification or external rights verification.

## Locators, evidence, and provenance

Locators use the accepted SourceRoot locator types, require nonempty structured
values, resolve to registered sources and evidence, and retain edition
identity when supplied. The workflow never invents or verifies locator content
over a network.

Evidence roles use the exact accepted enum, including `supports`, `disputes`,
`qualifies`, `contextualizes`, and `neutral_or_background`. Roles and
references are explicit. Reporting provenance remains separate from evidence;
a citation is not automatically supporting evidence.

Historical names retain source provenance. Structured and uncertain dates
retain original labels, precision, calendar context, and uncertainty. No
calendar conversion or external authority dereferencing occurs.

## Versioning and determinism

Preparation v1 emits no claim or evidence version history. Synthetic ordinals,
predecessors, and version-shaped objects are rejected. A current claim without
history is valid; genuine governed revision history remains the responsibility
of the accepted SourceRoot model.

Generation recursively canonicalizes object keys, orders ID-bearing arrays,
uses UTF-8, two-space indentation, LF line endings, and one final newline.
There are no runtime timestamps, random IDs, machine paths, environment
values, or network fields. Identical input produces byte-identical output and
the same SHA-256 without mutating input.

## Paths, integration, and verification

CLI paths must remain within the backend workspace. Parent traversal, missing
inputs, output over the input, and output under the accepted Chunk 6 corpus
directory fail. Runtime output is not committed.

The generated bundle must pass the unchanged accepted validator and can enter
the database only through the existing `saveImportedBundle` path. Tests use
only `sourceroot_test`, prove duplicate-safe reimport, search and Context
Review projection, and restore the accepted Chunk 6 state.

Root-stage scope enforcement, focused tests, TypeScript, CLI smoke checks,
accepted-schema checks, importer integration, complete regression, baselines,
immutable Chunk 0-6 replay, package validation, installer verification, the
root verifier, and `git diff --check` form the acceptance chain.

## Exclusions and limitations

There is no corpus expansion, automated research, AI extraction, legal
certification, contributor workflow, public editing, authentication change,
governance workflow, migration, API route, customer file, external service,
production queue, or browser requirement. The golden workspace is a bounded
accepted Chunk 6 sample, not a new historical corpus. Rights and factual
judgments remain human responsibilities. The next dependency is:

**Corpus expansion and preparation-workflow adoption.**
