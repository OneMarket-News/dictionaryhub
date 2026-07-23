# DictionaryRoot Governed Platform Foundation v1

## Stage purpose

This stage turns the refined DictionaryRoot reader into an installable governed-platform foundation without replacing the existing customer experiences or SourceRoot data model.

It adds four connected layers:

1. Authentication and account identity
2. Explicit authorization and organization roles
3. Proposal, review, publication, rollback, and provenance workflow
4. Administration, moderation, audit, deployment, and pilot-readiness tooling

## Preserved behavior

The stage preserves the current homepage, Knowledge Sphere, Concepts, Sources, Coverage, Editorial, History, shared navigation, global search, URL state, SourceRoot API client, live/offline states, identity provenance language, and existing lexical/import data.

Public read endpoints remain readable. Protected writes now require an authenticated session and explicit permissions. Local import compatibility can be enabled only in non-production through `ALLOW_UNAUTHENTICATED_IMPORT=true`; production should use a system administrator session or `IMPORT_SERVICE_TOKEN`.

## New customer experiences

- `account-v1.html` — Google, Apple, email magic-link, and local development sign-in; identity linking; profile; roles; organizations; sessions; invitations; export; deletion.
- `workflow-v1.html` — governed proposals with evidence, comments, review decisions, publication, and rollback.
- `admin-v1.html` — users, system roles, organizations, scoped member roles, invitations, reports, publication locks, and audit events.
- `privacy.html`, `terms.html`, `acceptable-use.html`, `corrections-policy.html` — explicit pre-launch policy drafts.

## New migrations

- `005_create_auth_identity_governance.sql`
- `006_create_governed_editorial_workflow.sql`
- `007_create_moderation_operations.sql`
- `008_strengthen_session_identity.sql`

Migrations create stable IDs and append-only governance records for users, identities, sessions, organizations, roles, permissions, invitations, audit events, proposals, evidence, comments, decisions, publications, overlays, moderation reports, account actions, and record locks. Sessions retain the exact provider identity used to create them so audit provenance does not guess from a user’s most recently used sign-in method.

## Role model

- `registered` — account/profile and organization visibility
- `contributor` — draft, edit, comment, and submit owned proposals
- `reviewer` — contributor rights plus review decisions
- `publisher` — reviewer rights plus publish and rollback
- `organization_admin` — organization membership, invitation, role, and scoped audit management
- `system_admin` — system-wide administration, imports, moderation, publication, and audit access

Authorization is checked by permission keys, not by frontend visibility. Organization permissions are evaluated against the proposal or administration target organization; membership in one organization does not authorize review, publication, invitations, or audit access in another. Organization administrators can assign only organization-scoped roles to active members, and the final organization administrator cannot be removed.

## Workflow state model

`draft → submitted → under_review → changes_requested → submitted → approved → published`

Alternate terminal or history states include `rejected`, `withdrawn`, and `superseded`. Self-approval is blocked unless `ALLOW_SELF_APPROVAL=true`. An active moderation record lock blocks publication with HTTP 423.

## Honest implementation boundaries

- Google and Apple routes are implemented but cannot complete real provider sign-in until credentials and provider callback URLs are configured. Account linking is initiated through a CSRF-protected POST before redirecting to the provider. The sign-in identity that created the active session cannot be unlinked until the user signs in through another linked identity.
- Email is usable locally in console mode. Public delivery requires Resend credentials and a verified sender.
- Policy pages are implementation drafts, not final legal documents.
- Docker and deployment configuration are readiness templates, not a hosting purchase or active production deployment.
- Database backups are scripted, but scheduling, off-site replication, retention, and restore drills must be configured by the operator.

## Verification

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.ps1
```

Use `-RequireDatabase` after PostgreSQL is running and migrations are applied. Use `-RequireBrowser` only when Chrome or Edge is available and local frontend/backend servers are running.

## Installation and local activation

1. Extract the release ZIP outside the repository.
2. Run `INSTALL-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.ps1`.
3. Run `SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 -UseDocker` when Docker Desktop is available, or provide PostgreSQL separately.
4. Start the product with `START-DICTIONARYROOT-GOVERNED-PLATFORM.ps1`.
5. Sign in with the local development adapter using the email configured in `BOOTSTRAP_ADMIN_EMAILS`.

The installer copies code and creates timestamped file backups. It deliberately does not install packages, start infrastructure, modify OAuth provider accounts, or migrate a database without the separate setup step.
