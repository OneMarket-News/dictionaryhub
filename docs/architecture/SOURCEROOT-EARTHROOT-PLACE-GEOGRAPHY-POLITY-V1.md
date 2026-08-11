# SourceRoot EarthRoot Place / Geography / Polity v1

Chunk 15A. Governed under `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`, Tier 3.

## Purpose

Establish the smallest production-quality EarthRoot semantic foundation that
can carry sourced, time-bounded geographic and political claims — and prove it
without weakening anything already released.

## What EarthRoot owns

EarthRoot owns canonical **Place** identity and canonical **Polity** identity.
HistoryRoot continues to own historical events and claims involving polities;
its existing `entity_type = 'place'` contextual records remain valid HistoryRoot
records and are **not** rewritten, migrated, or reinterpreted as canonical
EarthRoot Places. The long-term path from a HistoryRoot contextual place
reference to an EarthRoot canonical Place runs through a governed identity
assertion, and none of that linking happens in 15A.

EarthRoot owns the domain assertion "Polity P governed Place X during interval
I". A future TimeRoot may own reusable temporal primitives; it does not own
this geopolitical claim, and 15A implements no TimeRoot.

## Place and Polity are distinct identity classes

Wave 1 reconnaissance found that released HistoryRoot data types a peninsula, a
harbour, a village, a territory, and a people all as `place`, and that one
canonical label fuses two contested names. 15A does not repeat that. Place and
Polity are separate resource classes with separate identities, and the
separation is enforced by typed foreign keys and a predicate CHECK constraint on
the SUBJECT side, so a Polity can never be contained by a Place at the database
boundary.

The OBJECT side is deliberately reported as it actually is. A Place governing
something is rejected by the domain validator and by the store, but NOT
independently by SQL: `ck_earthroot_predicate_typing` evaluates to NULL when
`object_entity_type` is NULL, and a NULL CHECK passes; the composite object
foreign key is MATCH SIMPLE and is satisfied vacuously when
`object_resource_id` is NULL. For object-side typing the application is the only
guard. No EarthRoot row exists in any environment, and the sole write path
derives `object_entity_type` from the validated resource index, so the gap is
not reachable through supported code. It is recorded as a deferred activation
gate in the "Deferred activation gates" register at the end of this document
(EARTHROOT TYPED-PREDICATE DB ENFORCEMENT) and must be closed by a future
governed migration before EarthRoot serves real canonical data. Migration 020 is
frozen for the 15A audit and is deliberately not amended for it.

## The assertion model

One strict assertion model, not a generic graph:

```
EarthRoot Resource   place | polity
EarthRoot Assertion  subject -> governed predicate -> resource object OR literal
                     + temporal validity + uncertainty + review state
EarthRoot Evidence   assertion -> source, locator, statement, dataset + version
```

Five governed predicates, and no synonyms:

| Predicate | Subject | Object | Meaning |
|---|---|---|---|
| `named_as` | place, polity | literal | A sourced name. Never identity. |
| `classified_as` | place | literal | Geographic classification. No geometry. |
| `located_within` | place | place | The single canonical containment predicate. |
| `governed_by` | place | polity | Political control. |
| `administered_by` | place | polity | Administrative attachment, deliberately distinct from control. |

No unconstrained free-text predicate column functions as the public contract.

## Canonical public identity

`canonicalPublicId` is an opaque Root-issued UUID, immutable once minted, and
independent of name, classification, polity, language, source locator,
coordinates, and dataset version. The same entity keeps the same
`canonicalPublicId` across dataset versions; only the dataset-qualified
SourceRoot address changes, because address v1 is mandatorily dataset-qualified.
The character set is a strict subset of the released address unreserved set, so
no percent-encoding ever occurs and no change to `addressing.ts` was needed.

## Temporal validity

Deliberately bounded. Two modes: `not_asserted` and `asserted`. Signed integer
years make BCE representable without a calendar conversion this stage refuses to
perform. There is no named-era resolution and no interval algebra.

The load-bearing invariant is that **`not_asserted` is not timelessness**. A
`not_asserted` validity may carry no year bounds and no validity description,
enforced in the database and again in the payload, and every payload temporal
block carries an explicit `meaning` string so a consumer cannot render absence
as "always".

## Evidence

A canonical EarthRoot assertion requires at least one evidence record carrying a
source, a locator, a statement, and dataset-plus-version provenance. This is
enforced by a deferred constraint trigger mirroring the released Chunk 14B
pattern: assertion and evidence may be inserted in either order within one
transaction, but a transaction that commits an unsourced assertion fails.
Synthetic fixtures satisfy the real contract shape; provenance is not relaxed
because the data is synthetic.

## Public payload and the result-item adapter

The released shared `rootPayload` denylist is explicitly a floor, not an
authorization boundary. EarthRoot supplies the allowlist that closes it: exactly
six top-level fields, every nested shape checked, and anything unrecognised
fails closed. No database key, raw row, internal timestamp, credential, source
internal, coordinate, geometry, or 15B UI state can cross it.

The adapter builds a released-contract `SourceRootResultItem` and then submits
it to the released validator unchanged. The display label is derived from a
**sourced preferred-name assertion**; there is no unsourced fallback string,
because an unsourced display string must never become de facto identity.

## Availability is not implementation

EarthRoot remains a **planned** Root with `networkRuntimeState`
`not-implemented`, no released dataset, and no Root contract version, so the
released registry continues to report that it cannot respond. `place` and
`polity` remain **DEFINED** and are never marked IMPLEMENTED or PROVIDED.

This is not an oversight. The released registry invariant
`planned-root-provides-nothing` forbids a planned Root from holding any
IMPLEMENTED object type, and the released maturity model defines IMPLEMENTED as
adaptation *from released structures* — which 15A deliberately does not ship.
An earlier 15A target of IMPLEMENTED/NOT PROVIDED was withdrawn by the Principal
Architect for exactly these reasons. Maturity promotion belongs to a later
governed Root-activation stage that ships a real dataset.

## Deliberately absent

Coordinates, geometry, geocoding, spatial SQL, spatial indexes, bounding boxes,
distance and radius semantics, map implementation, `spatialQuery` support,
Layer 3 governed shared identity, transitive identity closure, HistoryRoot /
BibleRoot / DictionaryRoot adapters, and any real corpus. Jerusalem and
Plymouth / Patuxet are **not** ingested; the fixtures are synthetic and assert
nothing about actual history or geography.

The released rejection of `coordinate_only_match`, `temporal_overlap_only`, and
`name_only_match` as identity evidence is preserved and mirrored, and EarthRoot
adds `classification_only_match`. EarthRoot defines no identity predicate at
all.

## Migration 020

`020_create_earthroot_place_polity_foundation.sql` adds EarthRoot datasets,
resources, assertions, and assertion evidence, and widens two Chunk 14A CHECK
constraints into strict supersets so an EarthRoot resource can be admitted to
the cross-Root registry later. Migrations 018 and 019 are immutable and were not
edited; the released CHECKs are dropped by their exact deterministic names, so
the migration is deterministic. An earlier candidate located them by
introspection instead, and that is exactly what the Migration / Data Integrity
Reviewer vetoed: a `LIKE` scan with `LIMIT 1` and no `ORDER BY` dropped the
wrong released constraint and failed open. Named drops replaced it, and the
migration proves its own post-condition and rolls back rather than fail open.
No row is
deleted, rewritten, or reinterpreted, and 15A inserts no EarthRoot row into the
cross-Root registry.

## 15A / 15B boundary

15A exposes dataset-qualified addresses, governed payloads, provenance,
temporal state, uncertainty, and review state. 15B owns map rendering, tiles,
spatial indexes, viewport and bbox parameters, zoom, clustering, centroids,
distance ranking, basemaps, and layers. None of that exists here, and the
released place data contains no coordinates by governed decision, so a future
map layer cannot be fed from 15A output without a separate human-authorized
geometry acquisition decision.

## Deferred activation gates

This section IS the register. An earlier draft said the typed-predicate gap
"is recorded as a deferred activation gate" while no register existed anywhere
in the repository — a claim about the governance system's own state that was
not true. It is recorded here now, and the focused verifier asserts that this
section exists so the record cannot quietly disappear.

None of the following blocks the 15A semantic foundation. Each one blocks
EarthRoot becoming operational against real canonical data, and each needs an
explicitly governed stage of its own.

| Gate | What is actually true today | Blocks 15A | Blocks activation |
| --- | --- | --- | --- |
| EARTHROOT TYPED-PREDICATE DB ENFORCEMENT (N9) | Object-side predicate typing is enforced by the domain validator and the store, NOT independently by SQL. `ck_earthroot_predicate_typing` evaluates NULL, and so passes, when `object_entity_type` is NULL; the composite object foreign key is MATCH SIMPLE and is satisfied vacuously when `object_resource_id` is NULL. Subject-side typing IS database-enforced. Zero EarthRoot rows exist anywhere. | No | Yes |
| DATABASE RUNTIME PRIVILEGE HARDENING (N8) | The application database role is a PostgreSQL superuser and owns the canonical tables, so it can TRUNCATE, and can disable or drop any integrity trigger. The evidence and TRUNCATE guards are defence in depth against a non-privileged role. They do NOT constrain a superuser, and nothing in this stage claims otherwise. Production privilege posture was never verified. | No | Yes |
| MIGRATION RUNNER CONTENT-IDENTITY | `migrate.ts` records applied migrations by filename only, with no checksum. A database that ran an earlier candidate of a migration silently skips the corrected one and must be rebuilt from the canonical chain. | No | No |
| GDS STAGE AUTHORIZATION ANCHOR | The GDS verifier cannot bind an authorization anchor the stage itself is authorized to write. Compensating controls for 15A: an external Principal Architect 17-path allowlist, HEAD frozen at the canonical baseline, and no commits before independent audit. | No | Blocks ordinary future stages |
| GDS BASELINE-TO-CANDIDATE CHANGESET AUTHORITY | Stage containment reads the pending changeset only, so committed work is invisible to it. Same compensating controls as above. | No | Blocks ordinary future stages |

## Related

- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md`
- `docs/architecture/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-ARCHITECTURE.md`
