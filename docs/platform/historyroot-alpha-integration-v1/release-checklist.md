# Release checklist

## Source control

- [ ] Release branch starts from the approved `main` commit.
- [ ] Foundation, dataset, customer, and governance branches are merged in
      dependency order.
- [ ] Merge conflicts and resolutions are recorded.
- [ ] `main` and `origin/main` remain unchanged.
- [ ] No force push or rewritten feature history occurred.
- [ ] Working tree contains only intended release changes.
- [ ] No environment files, credentials, dependency trees, dumps, archives,
      logs, sessions, or browser profiles are tracked.

## Installation and data

- [ ] Clean `npm ci` succeeds on Node.js 22.
- [ ] A fresh PostgreSQL database accepts every migration.
- [ ] `npm.cmd --prefix .\backend run verify:fresh-install` passes and removes
      its temporary database.
- [ ] HistoryRoot validation and first import succeed.
- [ ] HistoryRoot replacement import is idempotent.
- [ ] Allow-listed HistoryRoot removal preserves unrelated bundles.
- [ ] DictionaryRoot pilot import succeeds.
- [ ] Backend and static frontend startup require no undocumented step.

## Verification

- [ ] TypeScript typecheck
- [ ] Production build
- [ ] Full backend suite
- [ ] HistoryRoot customer tests
- [ ] Plymouth dataset tests and validator
- [ ] Contextual tests
- [ ] Governed lifecycle tests
- [ ] DictionaryRoot exact-sense tests
- [ ] DictionaryRoot and HistoryRoot responsive checks
- [ ] Customer, Plymouth, contextual, governed, and integration verifiers
- [ ] `git diff --check`
- [ ] Clean-clone verification

## Browser

- [ ] Public HistoryRoot while logged out
- [ ] DictionaryRoot search and record navigation
- [ ] Contributor proposal lifecycle
- [ ] Reviewer change request and approval
- [ ] Publisher publication
- [ ] Public revision visibility
- [ ] Rollback and restored public content
- [ ] Unauthorized and cross-organization denial
- [ ] Desktop and narrow-mobile layout
- [ ] No unexpected console or network failures

## Deployment

- [ ] Production environment passes startup validation.
- [ ] Database is reachable before traffic promotion.
- [ ] CORS and secure-cookie behavior match the deployed origins.
- [ ] Health and readiness are monitored separately.
- [ ] Structured logs are collected with restricted access.
- [ ] Backup completed and restore procedure rehearsed.
- [ ] Migration and dataset recovery owners are assigned.
