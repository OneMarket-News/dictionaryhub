# Next Backend Step

1. Apply `docs/database-schema.sql` from the earlier backend blueprint.
2. Add a `lifecycle_events` repository.
3. Persist one `bundle-validated` event for every `POST /api/v1/validate` request.
4. Add `POST /api/v1/bundles` to save validated bundle JSON and its SHA-256 hash.
5. Add browser API adapter and compare browser/server validation fixtures.
