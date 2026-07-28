# SourceRoot Lossless Context Collection Support Contract

## Purpose

SourceRoot Repeatable Source Preparation Workflow v1.1 is a maintenance
release of the accepted Chunk 7 preparation workflow. It closes the loss-of-
data defect discovered while evaluating HistoryRoot corpus expansion. It is
not a numbered roadmap chunk and adds no historical or customer content.

## Accepted starting checkpoint

- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `7eef6b27f5c97a3e0de82a457ca06c828f9fe3df`
- Tag: `sourceroot-repeatable-source-preparation-workflow-v1`
- Chunk 7 ZIP SHA-256:
  `018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC`
- Chunk 6 bundle SHA-256:
  `D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`
- Database: `sourceroot_test`
- Migration ceiling: 012

## Accepted defect

Schema `1.0.0` did not expose claim attributions, interpretations,
perspectives, perspective links, causal links, or cultural memories. Its
bundle builder therefore omitted accepted records in those collections.
Because the accepted importer deletes normalized contextual rows owned by a
bundle before inserting its replacement, importing such output under the
accepted bundle ID would remove customer-visible attribution and context. A
new bundle ID is not safe because contextual IDs are global.

## Supported workspace versions

Schema `1.0.0` remains accepted without reinterpretation. Its types,
validation semantics, canonical serialization, golden workspace, and output
hash remain unchanged.

Schema `1.1.0` adds explicit prepared collections for:

1. claim attributions
2. interpretations
3. perspectives
4. perspective links
5. causal links
6. cultural memories

Perspective links have no accepted bundle-level `id`; their wrapper therefore
uses `preparationId` solely for preparation status and duplicate validation.
That wrapper field never enters generated output.

## Lossless bundle fields

Schema `1.1.0` explicitly represents accepted top-level bundle type, nodes,
assertions, edges, revisions, and extensions. These are not an opaque embedded
bundle. Every contextual collection remains independently visible and
reviewable. The accepted property order, array order, omitted-versus-present
fields, null values, and empty arrays are preserved for exact generation.

## Dependency validation

Approved references must resolve to approved prepared objects. Validation
covers sources, accounts, subjects, objects, entities, claims, evidence,
temporal assertions, attribution actors, record and perspective endpoints,
and causal endpoints. Duplicate preparation IDs and duplicate record-
perspective endpoint pairs are blockers. Accepted contextual schema
validation supplies the authoritative field, enum, nullability, and
collection semantics.

Schema `1.1.0` generation rejects draft or needs-review objects. Omitted
objects remain preparation-only and require reasons.

## Deterministic generation

Schema `1.0.0` continues using the accepted canonical key and ID-array
ordering. Schema `1.1.0` uses deterministic input-preserving serialization so
the human-readable workspace can reproduce accepted bundle bytes without
changing field or collection order. Generation uses UTF-8, two-space JSON
indentation, LF line endings, and one final newline. It introduces no runtime
timestamp, random ID, machine path, or environment value.

The lossless fixture must generate exactly 493,760 bytes with SHA-256
`D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`.
Repeated generation and comparison with the accepted Chunk 6 file must be
byte-identical.

## Preparation metadata boundary

Preparation status, approval, rights review, content-use review, source-
identity review, reviewer notes, unresolved questions, omission reasons, and
link preparation IDs never enter the SourceRoot bundle.

## Rights, attribution, and version preservation

The fixture derives only from accepted local material. Source objects,
edition distinctions, attribution fields, evidence roles, locators,
uncertain dates, relationship direction, perspective linkage, causal
semantics, and cultural-memory linkage remain byte-identical. No new rights
or legal conclusion is made. Existing claim and evidence version arrays and
all version fields are preserved exactly; no version is fabricated.

## Importer and database boundary

The single accepted `saveImportedBundle` implementation remains unchanged.
Automated import and verification require the database name to resolve
exactly to `sourceroot_test`; blank, development, production, or unknown
database names are refused. Replacement import and duplicate reimport must
preserve every accepted contextual row and leave the accepted Chunk 6 state
installed.

## No-new-research and no-customer-change boundaries

This release performs no web research, scraping, retrieval, OCR, AI
extraction, summarization, historical inference, or truth scoring. It changes
no HTML, CSS, frontend JavaScript, API route, navigation, or customer-visible
content. No browser-visible difference or browser certification is claimed.

## Explicit exclusions

This release adds no importer, migration, schema table, route, public write
surface, contributor workflow, production queue, background worker, corpus
expansion, quality score, reliability rank, legal certification, or
production-readiness claim.

## Verification

Acceptance requires:

- the original Chunk 7 suite at 40/40 and its golden hash unchanged
- the maintenance suite at 50/50
- the Chunk 6 suite at 30/30
- exact repeated generation and accepted-bundle byte equality
- accepted schema, importer, search, and Context Review preservation
- complete backend and named historical regressions
- SourceRoot, DictionaryRoot, and root verifiers with zero warnings/failures
- immutable Chunk 0–7 replay
- package, installer, installed-byte, database, and `git diff --check` gates

## Known limitations

The workflow validates supplied accepted material; it does not establish
historical truth, source credibility, rights ownership, or legal status.
Schema `1.1.0` is intentionally bounded to the currently accepted SourceRoot
bundle model. Broader collection changes require a separately governed
maintenance stage.

The next dependency is **HistoryRoot corpus expansion and quality review**.
