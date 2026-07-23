# DictionaryRoot security and governance model

## Identity and authority are separate

Authentication answers who is present. Authorization answers what the account may do. Every protected backend write checks a permission and CSRF token. Frontend buttons are convenience controls only and are never the authority boundary.

## Session controls

- Opaque random session token stored only in an HTTP-only cookie
- SHA-256 token hash stored in PostgreSQL
- Per-session CSRF token required on protected writes, including the initiation of provider identity linking
- Secure-cookie and SameSite configuration
- Session expiry, individual revocation, revoke-other-sessions, suspension revocation, and deletion revocation
- No provider password storage
- The identity that created the current session cannot be unlinked until the user signs in through another linked identity; the final identity can never be removed

## Provider controls

- OAuth state is one-time, hashed, expiring, and provider-bound
- Google uses authorization code, nonce, and PKCE
- Apple identity tokens are verified against Apple signing keys and expected issuer/audience/nonce
- Email magic links are one-time, hashed, expiring, and rate limited by email and IP

## Editorial controls

- Stable proposal IDs and numbered proposals
- Source evidence stored separately from editorial rationale and interpretation disclosure
- State transition validation
- Self-approval blocked by default
- Publication requires approval plus `revision.publish`
- Publication writes an immutable publication and active overlay
- Rollback records reason, actor, and restored prior overlay
- Active moderation locks block publication

## Administrative controls

- Explicit system and organization roles, with organization permissions evaluated against the target organization
- Organization administrators can list their active members and assign or remove organization-scoped roles, but cannot grant system roles or remove the final organization administrator
- Invitation email must match a verified account email
- Account suspension revokes sessions
- Moderation reports remain separate from editorial evidence
- Audit events record the exact session identity, action, organization scope, target, request ID, IP, user agent, result, metadata, and timestamp

## Operator responsibilities

Before public traffic:

- Use HTTPS and a managed secret store
- Configure PostgreSQL backups, off-site copies, retention, and restore drills
- Configure monitoring and alerting
- Review logs for sensitive data
- Run dependency and container scans
- Complete legal, privacy, copyright, and accessibility review
- Establish incident response and administrator recovery procedures
