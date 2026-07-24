# Merge checklist

This checklist is for a later authorized merge into `main`. Creating the
integration branch does not authorize that merge.

## Before approval

- [ ] Confirm the release branch tip and reviewed commit range.
- [ ] Confirm all four milestone commits are ancestors.
- [ ] Confirm required checks passed on the exact release tip.
- [ ] Review database migration 010 and confirm no later migration is missing.
- [ ] Review deletions of the broken legacy account client, dead auth adapter,
      unused account assets, and accidental help dump.
- [ ] Review production startup/readiness and logging changes.
- [ ] Confirm public HistoryRoot and DictionaryRoot remain backward compatible.
- [ ] Confirm rollback and bundle-removal smoke tests.
- [ ] Confirm no secrets or generated artifacts.

## Merge method

- [ ] Obtain explicit authorization to modify `main`.
- [ ] Fetch and confirm `origin/main` has not advanced unexpectedly.
- [ ] Prefer a normal merge preserving the release integration history.
- [ ] Do not squash away the four milestone boundaries unless repository policy
      explicitly requires it.
- [ ] Never force push `main`.

## After merge

- [ ] Run migrations in the deployment environment.
- [ ] Validate and import the Plymouth dataset.
- [ ] Re-run health, readiness, public-read, governance, publication, rollback,
      search, and exact-sense smoke tests.
- [ ] Tag the approved release according to repository policy.
- [ ] Record deployment, migration, dataset, and rollback identifiers.
