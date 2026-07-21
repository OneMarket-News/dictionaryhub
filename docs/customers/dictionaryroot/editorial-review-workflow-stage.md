# DictionaryRoot Editorial and Review Workflow v1

## Purpose

This stage converts visible coverage gaps into a meaning-level editorial workflow backed by SourceRoot. It does not add authentication yet. It establishes the data model, API, audit trail, queue, and curated-graph promotion behavior that later user and permission work can secure.

## Capabilities

- Live review queue derived from complete lexical coverage.
- Queue categories for lexical-only meanings, missing concept history, review needs, promotion candidates, and source issues.
- Meaning-level statuses: unreviewed, in review, approved, flagged, and rejected.
- Reviewer name, notes, annotations, and promotion recommendation.
- Immutable timestamped review events.
- Approved lexical-only meanings can be promoted into the curated graph without rebuilding the Open English WordNet index.
- Promotion creates a persistent node, source link, concept revision, review event, and graph membership update.
- Coverage review counts include approved editorial records.
- Direct context links to Concept, Knowledge Sphere, Sources, History, and Coverage.
- URL state, Back/Forward, loading, empty, and SourceRoot-offline states.

## Promotion boundary

Promotion adds the approved meaning to the persistent curated node registry. Its official lexical relationships remain available from the complete lexical relation index and can be expanded on demand. This avoids copying every lexical relationship into the bounded graph while still making the promoted node a core graph member.

## Deliberate limitations

- No login, role, permission, assignment, or reviewer identity validation yet.
- No destructive unpromotion action.
- No automatic promotion merely because a review is approved.
- No fallback editorial records or invented queue counts.

## Main files

- `editorial-v2.html`
- `assets/css/dictionaryroot-editorial.css`
- `assets/js/dictionaryroot-editorial.js`
- `backend/db/migrations/004_create_dictionaryroot_editorial_reviews.sql`
- `backend/src/routes/editorial.ts`
- `backend/src/services/editorial-store.ts`
- `VERIFY-DICTIONARYROOT-EDITORIAL-REVIEW.ps1`
