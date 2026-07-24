# Platform architecture guide

## Product layering

```text
DictionaryRoot UI ─┐
HistoryRoot UI ────┼─> SourceRoot HTTP API ─> PostgreSQL
Governance UI ─────┘
```

SourceRoot owns generic storage, validation, import, search, identity,
organizations, permissions, proposals, publication, revisions, moderation,
audit, and rollback. DictionaryRoot and HistoryRoot provide product vocabulary,
manifests, navigation, and domain-specific presentation.

## Database and migrations

- Migrations 001–004 establish generic knowledge and DictionaryRoot lexical
  and editorial storage.
- The two historical 005 migrations establish legacy DictionaryRoot identity
  provenance and the current SourceRoot account/organization model.
- Migrations 006–008 add governed workflow, moderation, audit, and hardened
  sessions.
- Migration 009 adds generic contextual records.
- Migration 010 extends generic proposals and publications for contextual
  targets, validation, stale-base tokens, and rollback snapshots.

No HistoryRoot-specific proposal, revision, publication, or rollback table
exists.

## Authentication and authorization

The supported identity path uses `dr_users`, linked external identities,
HTTP-only sessions, CSRF tokens, organizations, memberships, role assignments,
and explicit permissions. Email magic links, Google, Apple, and isolated local
development authentication share this model.

Protected actions enforce permissions and organization scope on the server.
The UI hides unavailable actions only as a usability aid. Unknown and
unauthorized proposal identifiers return indistinguishable not-found responses.

The unused pre-governed bearer-token adapter and its broken development
accounts client were removed during integration. The historical migration is
retained because applied migrations are immutable.

## Governance lifecycle

```text
draft
  -> submitted
  -> under_review
  -> changes_requested -> submitted
  -> rejected
  -> approved
  -> published
  -> optional superseded rollback
```

Publication locks the proposal and target, checks moderation locks and the
canonical version token, revalidates the snapshot, materializes normalized
records, and writes publication, overlay, revision, proposal-event, and audit
rows in one transaction.

Rollback requires `revision.publish`, a reason, the current active publication,
and an unchanged target. It restores the prior snapshot and writes a new
rollback revision without deleting history.

## Public/private boundary

Public routes read only normalized published SourceRoot data. Drafts, rejected
proposals, review notes, organization membership, and private audit detail are
served only by authenticated governance routes. Newly created records rolled
back from publication are retained as `governance-withdrawn` and excluded from
public records, sources, and search.

## Data and search

The Plymouth dataset is one owned SourceRoot bundle. Reimport replaces only
that bundle. DictionaryRoot lexical data and unrelated bundles remain
independent.

Context, graph, timeline, and search queries use bounded pagination. The
current 393-record HistoryRoot dataset is intentionally loaded in a few
parallel, bounded collection requests for client-side graph and timeline
composition. Existing bundle, record-kind, relationship, temporal, source, and
governance queue indexes cover the alpha workload. Before substantially larger
datasets, measure payloads and query plans and add server-composed graph or
timeline endpoints rather than increasing client limits.

## Frontend boundaries

HistoryRoot public pages share `historyroot.css`, `historyroot-api.js`, and
`historyroot-shared.js`. Governance adds one focused stylesheet and script
without duplicating the public visual system. DictionaryRoot retains its
established component styles because its customer experience and information
density differ.

Dynamic governed HistoryRoot data is rendered with DOM construction and
`textContent`. Existing DictionaryRoot templates that use HTML strings escape
API-derived values before insertion.

## Known technical debt

- The two migration 005 filenames cannot be renumbered after release.
- Historical prototype and inspector HTML files remain as non-production
  reference tools.
- Some DictionaryRoot templates predate DOM-only rendering and require
  continued escape-function discipline.
- Graph and timeline composition should move server-side before dataset scale
  materially exceeds the alpha.
- Reviewer assignment, batch proposals, retention automation, rate limiting,
  and production monitoring remain future platform work.
