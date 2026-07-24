# Governed HistoryRoot Alpha v1

## Purpose and alpha boundary

Governed HistoryRoot Alpha v1 connects the public HistoryRoot customer
experience to the existing SourceRoot identity, organization, permission,
proposal, review, publication, revision, audit, moderation-lock, and rollback
architecture.

The alpha supports structured correction and new-record proposals for
contextual entities, chronology, accounts, claims, evidence, sources,
relationships, interpretations, perspectives, qualified causal links, and
cultural memory. It is not a public collaboration network, a historical-truth
engine, an enterprise assignment system, or a substitute for historical,
editorial, academic, legal, security, accessibility, or tribal review.

Public HistoryRoot pages and contextual APIs remain readable without a
SourceRoot session. Drafts, rejected proposals, private notes, organization
details, and review activity are available only through authenticated,
server-authorized governance routes.

## Architecture reused

The implementation reuses these existing generic capabilities:

- HTTP-only `dr_session` cookies, session expiry, and per-session CSRF tokens
- email, Google, Apple, and explicitly enabled local-development identity
  providers; no new identity provider or password database
- `dr_users`, linked identities, organizations, active memberships, roles, and
  permission aggregation
- `dr_change_proposals`, proposal evidence, private comments, proposal events,
  publications, active overlays, and moderation record locks
- the existing workflow states and transitions
- the generic `revisions` table and `dr_audit_events`
- SourceRoot contextual schemas, normalized contextual tables, source registry,
  search, record, and revision APIs

The workflow remains available at its backward-compatible
`/api/v1/dictionaryroot/workflow` mount and at the domain-neutral
`/api/v1/governance` mount used by HistoryRoot. There are no
HistoryRoot-specific proposal, revision, review, publication, or rollback
tables.

## Universal gaps and migration 010

Migration `010_extend_contextual_governance.sql` is required because the
existing generic workflow could not represent contextual targets, identify a
Root or dataset, classify a structured change, persist validation state, detect
a canonical stale base, or retain the pre-publication snapshot needed to
restore materialized contextual data.

The migration is backward compatible and domain neutral. It:

- extends the existing proposal target constraint with contextual record kinds
- adds `root_key`, `bundle_id`, `change_type`, `base_version_token`,
  `validation_result`, and `last_validated_at` to proposals
- adds `root_key`, `bundle_id`, and `prior_snapshot` to publications
- adds queue and publication lookup indexes

Legacy target types, columns, statuses, routes, and stored proposals remain
valid. Migration 009 remains the sole contextual-knowledge persistence model.

## Actual roles and permissions

The current roles are:

- `registered` — account and organization reads
- `contributor` — `revision.create`, `revision.submit`, and
  `revision.comment` within an organization
- `reviewer` — contributor permissions plus `revision.review`
- `publisher` — reviewer permissions plus `revision.publish`
- `organization_admin` — organization management, review, and audit access;
  this role does not implicitly publish
- `system_admin` — system-scoped permissions including create, submit, comment,
  review, publish, rollback, edit-any, import, moderation, and audit

Rollback uses the existing elevated `revision.publish` permission. The alpha
does not create a second HistoryRoot permission vocabulary.

Every protected route validates both the effective permission and organization
scope on the server. Contributors can read their own proposals. Reviewers and
publishers can read proposals only in organizations where their active
membership grants review permission. An unauthorized proposal or publication
identifier returns the same not-found response as an unknown identifier.
Hiding an interface action is only a usability measure and is never the
authorization boundary.

## Lifecycle mapping

The interface uses the repository's actual state model:

1. `draft`
2. `submitted`
3. optional `under_review`
4. `changes_requested`, `rejected`, or `approved`
5. `published`
6. optional `superseded` after rollback

`withdrawn` remains available for contributor-controlled draft or submitted
work. Approval and publication are separate actions. Self-approval is blocked
unless the existing explicit `ALLOW_SELF_APPROVAL` override is enabled.
Publication is never triggered by automated validation alone.

Proposal creation loads the canonical current target on the server. Client
supplied base snapshots cannot replace it. Existing records receive a
deterministic SHA-256 version token; new-record proposals receive an
absence-token. Submit, approval, publication, and rollback recheck the current
target under transactional locking. A concurrent publication therefore makes
the older proposal stale instead of allowing a last-write-wins overwrite.

## Structured editing and review

The proposal editor presents human-readable, record-aware fields rather than
database columns or raw JSON as the primary workflow. It supports stable IDs,
names and aliases, classifications, dates and precision, uncertainty,
attribution, claims, evidence, source locators and limitations, relationships,
causal qualification, and cultural-memory classification.

The review page compares current and proposed values field by field. Additions,
removals, and high-risk fields have text labels and structural treatment, so
meaning does not depend on color. A secondary developer payload is read-only
and cannot bypass API validation.

Private review notes use the existing proposal-comment table and retain author,
type, timestamp, and proposal association. Request-changes, rejection,
approval, publication, and rollback also append immutable proposal events and
route-level audit events.

## Historical validation

The validator runs when a draft is created or saved and again at submit,
approval, and publication. It checks process safety, not historical truth.

Blocking checks include:

- contextual Zod structure and stable target ID
- same-dataset references and bundle ownership
- evidence for a new substantive claim
- existing evidence sources and inspected locators
- source type, classification, limitation, and safe HTTP(S) URL
- false `accessed-and-inspected` claims without inspected locators
- rationale and evidence when uncertain chronology becomes exact
- rationale when published uncertainty is removed
- source or perspective attribution for an interpretation
- attributable source support for a perspective
- qualification for causal relationships
- source or perspective attribution for cultural memory
- duplicate canonical names and aliases within a dataset

Prominent warnings identify uncertainty removal, cultural-memory
reclassification, record removals, colonial-source dependency, and missing
source limitations. These warnings require human review; they do not prove or
disprove a historical claim.

The validator preserves the structural separation among account, claim,
evidence, interpretation, perspective, causal assessment, and cultural memory.
A cultural-memory record is not published as an event merely by changing a
label in the interface.

## Publication, public/private separation, and search

Publication requires an approved proposal plus `revision.publish` in the
proposal organization. The service:

1. locks the proposal and target
2. checks moderation locks
3. compares the canonical version token
4. revalidates the proposed record
5. materializes the structured record and normalized subtype in one database
   transaction
6. replaces only that record's source and perspective links
7. writes publication, overlay, generic revision, and proposal-event rows
8. commits before public APIs can observe the result

Failure rolls back every operation. Stable IDs and bundle ownership cannot be
changed through the proposed patch. Unrelated records, bundles, and
DictionaryRoot tables are not rewritten.

Draft and rejected proposals never enter the contextual or source tables and
therefore cannot appear in public records, search, timeline, sources, graph, or
counts. A newly published record becomes public only on commit.

## Revision history and rollback

Each publication creates a `governed-publication` revision containing the
proposal and publication identifiers, change type, before and after snapshots,
and validation result. The public revision page reads only published revision
rows. It does not query proposal comments or private organization membership.

Rollback requires `revision.publish`, an active current publication, a reason,
and an unchanged target version. It restores the retained prior snapshot
transactionally and writes a separate `governed-rollback` revision. The
replaced revision, publication, proposal, comments, and audit events are never
deleted.

When a rollback concerns a newly created contextual record, the record is
retained with `governance-withdrawn` status and excluded from public contextual
reads and search. A newly created source is retained with withdrawn governance
visibility and excluded from public source reads and search. This avoids
destructive deletion while restoring the public absence that preceded
publication.

## Pages and deep links

- `history-governance-v1.html` — contributor dashboard and authorized proposal
  list
- `history-proposal-v1.html` — new proposal, owned draft editing, evidence, and
  proposal activity
- `history-review-queue-v1.html` — organization-scoped review queue
- `history-review-v1.html` — structured comparison, validation, notes, and
  authorized decisions
- `history-revisions-v1.html` — public published revision history

Queue filters use URL parameters for status, record type, validation state,
sort, and query. Proposal and revision pages use stable proposal, record, and
record-type identifiers. Tokens, private notes, payloads, and user information
are never placed in URLs.

The public record page always offers public revision history. It reveals
“Propose a correction” only when the actual SourceRoot session includes
`revision.create`. SourceRoot administration is not added to public
HistoryRoot navigation.

## Accessibility and responsive behavior

Governance pages use semantic headings, forms, labels, buttons, links, status
regions, keyboard-focus styles, descriptive diff sides, and explicit status
text. Final actions use confirmation; rollback and review decisions collect a
reason or note where applicable. The layout collapses comparison grids into
stacked current/proposed values on tablet and mobile, and action targets remain
at least 40 pixels high. Reduced-motion preferences are respected.

All dynamic proposal data is inserted with `textContent` and DOM construction.
The governance scripts do not render API data with `innerHTML`. External source
URLs remain subject to the existing HistoryRoot HTTP(S)-only link policy.

## Security treatment

- HTTP-only session cookie and CSRF header on every mutation
- server-side authentication, permission, and active-organization checks
- canonical server-side base snapshots and protected stable IDs
- request-size limits and Zod request schemas
- parameterized SQL
- transactional publish and rollback
- per-target advisory locks and stale-base conflict errors
- generic not-found responses for inaccessible identifiers
- no credentials, development users, cookies, sessions, or browser profiles in
  the repository
- no public draft or rejected-proposal route
- no direct publish shortcut or direct database editing API
- no AI approval, truth score, analytics, or tracking

This focused review does not constitute complete security certification.
Rate-limiting, production monitoring, penetration testing, retention policy,
and deployment-specific hardening remain required.

## Local setup

From the repository root:

```powershell
npm.cmd --prefix .\backend run db:migrate
npm.cmd --prefix .\backend run historyroot:plymouth:import
npm.cmd --prefix .\backend run dev
```

Serve the repository's static files at an origin allowed by `CORS_ORIGIN`
(local development defaults include `http://localhost:8080` and
`http://127.0.0.1:8080`). Then open:

- `http://localhost:8080/historyroot.html`
- `http://localhost:8080/history-governance-v1.html`
- `http://localhost:8080/history-review-queue-v1.html`

Configure a real email, Google, or Apple provider for shared environments.
`ALLOW_DEVELOPMENT_AUTH=true` is for isolated local development only and must
not be used as production identity.

## Test-user and fixture policy

Integration tests use the dedicated `.env.test` PostgreSQL database, invented
contextual fixture records, generated UUID users and organizations, HTTP-only
test sessions, and transactionally governed proposals. The test reset removes
sessions, identities, users, organizations, role assignments, proposals,
publications, revisions, audits, and fixture knowledge, then restores only
static role and permission definitions. It does not use or rewrite the user's
development dataset.

Browser review should use a temporary development-auth account and an invented
or reversible fixture target. Sign out afterward, stop only the servers started
for the review, and remove the temporary browser profile.

## Known limitations and remaining gaps

- no reviewer assignment/unassignment or escalation action beyond the current
  workflow
- no batch proposal spanning multiple target records
- no rich source picker or stable-ID autocomplete; the alpha accepts stable IDs
  with server validation
- no public contributor profile or public review discussion
- public revision history intentionally omits private reviewer identity and
  notes
- rollback and publication share the existing `revision.publish` permission
- queue summary totals are generic to the user's visible SourceRoot scope,
  while the list is filtered to the configured HistoryRoot dataset
- automated warnings are rule-based and cannot assess completeness, bias,
  historical truth, or community approval
- external contributor admission still requires identity-provider
  configuration, invitation and organization policy, privacy and retention
  policy, rate limiting, monitoring, security review, accessibility review,
  editorial playbooks, incident response, and human historical/tribal review

The domain-neutral target metadata, validator boundary, transactional
materialization, revisions, and rollback path can support additional Root
products whose records are represented by existing SourceRoot contextual
schemas. Each Root still needs its own editorial policy, field vocabulary,
review expertise, and customer interface.
