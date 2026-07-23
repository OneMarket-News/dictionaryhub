# DictionaryRoot invitation-only pilot checklist

## Account and identity

- [ ] Email sign-in delivered and completed on staging
- [ ] Google callback completed on staging
- [ ] Apple callback completed on staging
- [ ] Multiple providers linked to one account
- [ ] Final identity cannot be removed
- [ ] Session revocation tested
- [ ] Account export reviewed
- [ ] Account deletion and anonymized provenance tested

## Authorization

- [ ] Registered user cannot create proposals
- [ ] Contributor can create and submit only authorized proposals
- [ ] Reviewer can request changes, approve, and reject
- [ ] Contributor cannot self-approve by default
- [ ] Publisher can publish approved proposals and roll back
- [ ] Organization roles remain scoped
- [ ] Unauthorized API calls return 401 or 403

## Governance

- [ ] Evidence and interpretation are visibly separate
- [ ] Audit actor, identity, target, request ID, and time are present
- [ ] Record lock blocks publication
- [ ] Report resolution is audited
- [ ] Suspension revokes active sessions
- [ ] Invitation acceptance requires the invited verified email

## Reliability and product behavior

- [ ] Existing homepage, Sphere, Concepts, Sources, Coverage, Editorial, and History remain functional
- [ ] URL state and global search remain functional
- [ ] Live, empty, loading, and API-offline states remain honest
- [ ] Desktop, tablet, and mobile layouts pass manual review
- [ ] Database backup created and restored into a clean non-production database
- [ ] Error monitoring receives a test event

## Pilot tasks

Ask users to find a concept, inspect sources, identify a coverage gap, submit a sourced correction, respond to review feedback, approve with a second account, publish with a third role, inspect history, and roll back. Record completion time and confusion points.
