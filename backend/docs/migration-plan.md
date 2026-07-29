# SourceRoot localStorage → Backend Migration Plan

## Goal

Move SourceRoot from browser-local storage to a persistent backend without breaking the working front-end lifecycle.

## Current browser storage

| Key | Purpose |
|---|---|
| `sourceroot-staged-bundles-v1` | Staged bundle snapshots and restored embedded bundles |
| `sourceroot-package-inspections-v1` | Saved package review decisions |
| `sourceroot-lifecycle-events-v1` | Append-only lifecycle event history |

## Migration principle

Keep the current JSON contracts at the API boundary first. Normalize storage behind the API gradually.

This avoids rewriting all existing front-end pages at once.

## Phase 0 — Freeze current contract

- Run lifecycle tests.
- Preserve the schema reference.
- Tag the current browser contract as `0.1`.
- Preserve package export version `1.0.0`.
- Add fixture bundles for automated backend tests.

Exit condition:

- All current lifecycle tests pass.
- Current HistoryRoot bundle validates with zero errors and zero warnings.

## Phase 1 — Read-only backend mirror

Create:

- `GET /health`
- `POST /validate`
- `GET /bundles`
- `GET /bundles/:bundleId`
- `GET /nodes/:nodeId`

The browser still uses localStorage for staging and inspections.

Exit condition:

- Import Preview can call server-side validation.
- Server and browser validation results match for fixtures.

## Phase 2 — Persist bundles and snapshots

Create:

- `POST /bundles`
- `POST /bundles/:bundleId/validate`
- `POST /bundles/:bundleId/stage`
- `GET /bundles/:bundleId/events`

Add database persistence for:

- bundles
- nodes
- assertions
- edges
- sources
- revisions
- bundle snapshots
- lifecycle events

Exit condition:

- A validated bundle can be stored and staged without localStorage.
- Hashes match the browser implementation.

## Phase 3 — Persist packages and inspections

Create:

- `POST /packages`
- `GET /packages/:packageId`
- `POST /packages/:packageId/verify`
- `POST /packages/:packageId/inspections`
- `POST /packages/:packageId/restore`

Exit condition:

- The full HistoryRoot package lifecycle succeeds through the API.
- The exported package remains compatible with the browser inspector.

## Phase 4 — Add users, roles, and permissions

Initial roles:

- admin
- creator
- reviewer
- reader

Rules:

- creators can submit and stage their own bundles
- reviewers can inspect packages
- only approved packages may restore into shared storage
- readers can view approved public knowledge
- admins can manage users and revoke packages

Exit condition:

- Every write event has an authenticated actor.
- Inspection decisions are tied to reviewer identity.

## Phase 5 — Front-end cutover

Replace direct localStorage calls with an API client.

Recommended adapter interface:

```js
SourceRootRepository.getStagedRecords()
SourceRootRepository.saveBundle(bundle)
SourceRootRepository.stageBundle(bundleId)
SourceRootRepository.createPackage(snapshotId)
SourceRootRepository.verifyPackage(packageId)
SourceRootRepository.saveInspection(packageId, decision)
SourceRootRepository.restorePackage(packageId)
SourceRootRepository.getLifecycleEvents(filters)
```

Implement two adapters temporarily:

- `LocalStorageRepository`
- `ApiRepository`

This allows safe switching while the backend stabilizes.

Exit condition:

- All lifecycle pages operate through `ApiRepository`.
- LocalStorage remains only as an optional offline cache.

## Phase 6 — Production hardening

Add:

- schema migrations
- request rate limits
- audit-log retention
- automated backups
- digital signatures
- package revocation
- API keys
- observability and alerts
- deployment pipeline
- security review

## First migration script behavior

The browser export tool should create:

```json
{
  "exportType": "sourceroot-browser-storage-migration",
  "exportVersion": "1.0.0",
  "exportedAt": "...",
  "stagedRecords": {},
  "inspectionRecords": {},
  "lifecycleEvents": []
}
```

The backend imports this artifact once, validates each record, preserves original timestamps and hashes, and records a `browser-storage-imported` lifecycle event.

## Non-negotiable integrity rules

- Never overwrite original uploaded package JSON.
- Never replace an audit event in place.
- Recalculate hashes server-side.
- Store calculated and submitted hashes separately.
- Persist migration version and source.
- Reject unsupported major package versions.
- Preserve extension JSON even before it is normalized.

## Implemented governed contextual extension

Migration `010_extend_contextual_governance.sql` extends the existing proposal
and publication tables for any contextual Root. It adds Root and bundle scope,
structured change type, canonical base-version tokens, validation results, and
prior publication snapshots. It also expands the proposal target constraint to
the contextual record kinds introduced by migration 009.

The extension remains backward compatible with the existing DictionaryRoot
workflow mount. It does not add Root-specific proposal or revision tables.

## Migration 013 — DictionaryRoot lexical evidence

`013_create_dictionaryroot_lexical_evidence.sql` adds twelve normalized,
additive tables for lexical-evidence datasets, sources, lemmas, senses,
lemma-sense associations, definition claims, forms, etymology proposals,
etymology competitors, source comparisons, locators, and field provenance.

The migration does not modify or replace the existing OEWN lexicon tables,
contextual/HistoryRoot tables, registry routes, or governed workflow schema.
Public identities are stable text IDs; foreign keys use bounded cascade or
restrict behavior according to record ownership. Read paths ignore archived
lemmas, senses, claims, forms, proposals, and comparisons.

The architecture fixture importer is separately restricted to
`sourceroot_test`, deletes only the exact fixture dataset inside a
transaction, and rolls back failed replacement. A production corpus requires
a later reviewed acquisition, rights, generation, import, and migration plan.
