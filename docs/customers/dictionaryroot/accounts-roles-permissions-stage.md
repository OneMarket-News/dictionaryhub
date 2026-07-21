# DictionaryRoot User Accounts, Roles, Permissions, and Identity Provenance v1

## Purpose

This stage gives DictionaryRoot a provider-neutral identity and authorization foundation. It separates the identity of an actor from the method used to authenticate that actor, the claims that have been verified, and the actions the actor is permitted to perform.

The design anticipates future public identity infrastructure without claiming that local development fixtures prove a real internet user is human.

## Actor model

DictionaryRoot recognizes four actor types:

- `human`
- `organization`
- `service`
- `autonomous_agent`

Each actor has an account status, authentication provider and subject, verification level, roles, effective permissions, and an immutable actor identifier.

## Verification levels

The initial verification vocabulary is:

- `unverified`
- `email_verified`
- `organization_verified`
- `verified_human`
- `registered_service`

Verification claims remain provider-attributed and do not automatically grant permissions.

## Authorization model

Roles are mapped to explicit permission keys:

- Viewer
- Contributor
- Reviewer
- Editor
- Administrator

Sensitive permissions include editorial review, final approval, graph promotion, and identity management.

Final approval or rejection requires both the `editorial.approve` permission and a `human` actor with `verified_human` verification. Curated graph promotion requires both `graph.promote` and the same verified-human policy.

Autonomous agents may submit recommendations through `agent.submit`, but they cannot finalize approvals or graph promotions.

## Delegation and provenance

Delegations identify a principal actor, delegate actor, permission scope, time window, and whether human approval is required. Editorial reviews and review events now preserve:

- actor ID
- actor type
- verification level
- effective roles and permissions
- delegation principal when present
- an actor snapshot stored with the event

This prevents an autonomous system from appearing to be a human reviewer and keeps historical attribution intact if external authentication providers change later.

## Authentication providers

The current implementation exposes a versioned provider registry and adapter boundary for:

- local development identities
- OpenID Connect
- passkeys
- wallets
- proof-of-personhood or verified-human services
- service and autonomous-agent credentials

Only the local development provider is enabled in this stage. It creates short-lived bearer sessions for fixture identities and is disabled when `NODE_ENV=production`.

## Local development identities

Migration `005_create_dictionaryroot_identity_access.sql` creates three fixtures:

- Local Human Administrator
- Local Human Reviewer
- DictionaryRoot Review Agent

These are test identities only. They are explicitly marked as development fixtures and are not public proof-of-personhood.

## Frontend experience

`accounts-v2.html` provides:

- active session inspection
- local development identity switching
- actor type and verification badges
- effective roles and permissions
- provider readiness
- administrator-only actor, role, and delegation registries
- clear policy explanations for humans and autonomous agents

The Editorial page uses the active authenticated actor instead of a free-text reviewer name. Save and promotion controls are permission-aware, and audit events display actor type, verification, and delegation provenance.

## API routes

Base route: `/api/v1/dictionaryroot/auth`

- `GET /providers`
- `GET /development-actors`
- `POST /development-session`
- `GET /me`
- `POST /logout`
- `GET /actors` (`identity.read`)
- `GET /roles` (`identity.read`)
- `GET /delegations` (`identity.read`)

Editorial write routes now require an authenticated session and apply permission and verified-human policy checks.

## Environment

```text
SOURCEROOT_AUTH_MODE=development
SOURCEROOT_AUTH_SESSION_HOURS=12
```

Development sign-in is intentionally unavailable in production mode.

## Out of scope

This stage does not yet provide:

- public registration
- passwords or password recovery
- email delivery
- external OIDC configuration
- passkey enrollment
- wallet verification
- production proof-of-personhood
- organization administration UI
- billing or subscription plans

Those can be added through the provider and policy interfaces without changing the core editorial provenance model.
