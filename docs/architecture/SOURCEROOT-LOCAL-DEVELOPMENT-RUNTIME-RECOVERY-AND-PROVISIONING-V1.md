# SourceRoot Local Development Runtime Recovery and Provisioning v1

## Boundary

This checkpoint restores released repository data to one explicit local
development runtime. It does not create product data, change schema, initialize
the server automatically, or authorize production, staging, remote, or unknown
database targets.

## Artifact recovery

The tracked Project Gutenberg artifact had 99,597 LF-only terminators, no CRLF,
and no lone CR. Inserting CR only before those LF bytes reconstructs the pinned
artifact exactly: 4,436,268 bytes and SHA-256
`0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986`.
No semantic re-encoding or alternate upstream revision is accepted. The root
`.gitattributes` leaves protected raw/source-document artifacts as `-text`.

## Authorization contract

`dev:provision` and `dev:status` obtain an opaque, runtime-issued authorization
only after all of these checks pass:

- `NODE_ENV` is exactly `development` after normalization.
- `DATABASE_URL` uses PostgreSQL, names database `sourceroot`, and names only
  `localhost`, `127.0.0.1`, or IPv6 loopback.
- PostgreSQL independently reports database `sourceroot` and a loopback server
  address.
- migrations 013, 014, 015, and 016 are recorded; migration 017 is absent.

The URL is never rewritten or printed. The authorization is recorded in a
module-private `WeakSet`, so a structurally similar object cannot enable a
development import. Historical BibleRoot importers still default to their
exact `sourceroot_test` guard; only this checked orchestrator can pass the
opaque development authorization. The DictionaryRoot historical CLI is
unchanged.

## Provisioning and idempotency

Before any database mutation, the orchestrator validates the accepted corpus
identities and all pinned file hashes. It reads current readiness and skips an
already exact dataset. Missing data is imported; a partial target dataset is
transactionally replaced by the existing shared import implementation. The
order is DictionaryRoot Core Lexical Corpus v1.0.0, BibleRoot Foundation
v1.0.0, then BibleRoot Original Language Foundation v1.0.0.

HistoryRoot rows in `imported_bundles`, `context_records`, `nodes`,
`assertions`, `edges`, and `sources` are hashed before and after provisioning.
A difference fails the command. Auth and governance tables are never targeted.
The result reports imported, updated, skipped, and failed record counts without
credentials.

## Runtime readiness

`GET /api/v1/runtime-readiness` is read-only and returns a versioned status for
DictionaryRoot, HistoryRoot, and BibleRoot. Readiness requires released dataset
identity plus exact bounded counts, not merely table existence. The shared Root
switcher keeps all registered destinations visible and labels each Root as
`Runtime ready`, `Awaiting provisioned data`, or `Readiness unavailable`.
DictionaryRoot and BibleRoot page-specific API states remain authoritative;
no fallback records are introduced.

The endpoint returns 200 for a connected schema whether data is ready or
awaiting provisioning. Genuine database/configuration failures continue
through the protected API error boundary without stack traces or secrets.
