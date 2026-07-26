# SourceRoot Contextual Identity and Time Contract

## Contract Identity

- Contract: SourceRoot Contextual Identity and Time Refinement
- Version: v1
- Stage: SourceRoot Chunk 3 - Contextual Identity and Time Refinement v1
- Required previous stage: SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability v1
- API family: `/api/v1/context`
- Compatibility policy: additive
- Observer authority: Level 1, deterministic and read-only

## Existing Contextual Foundation

This contract extends the existing contextual knowledge system. It does not replace it.

The existing `context_records` registry and its ten record kinds remain authoritative:

- `entity`
- `temporal_assertion`
- `account`
- `claim`
- `evidence`
- `interpretation`
- `perspective`
- `causal_link`
- `relationship`
- `cultural_memory`

Existing subtype tables, record-level sources, perspectives, transactional import, search, public reads, governed proposals, publication snapshots, rollback, HistoryRoot consumers, stable IDs, and `raw_data` behavior remain.

## Stage Refinements

Chunk 3 adds:

- normalized aliases and alias-source links;
- normalized external entity identifiers and identifier-source links;
- semantic temporal roles;
- structured historical, partial, BCE/CE, named-period, and calendar-qualified dates;
- normalized proposed-date records and proposal-specific source links;
- relationship-to-temporal validity links and their sources;
- field-level provenance;
- controlled identity-relationship semantics on the existing contextual relationship model;
- first-class alias and identifier search;
- additive identity/time/provenance API projections; and
- deterministic Level 1 findings for contextual identity and chronology review.

No refinement changes an entity ID, rewrites a foreign key, redirects a URL, merges search results, chooses a canonical identity, or resolves conflicting chronology.

## Alias Contract

First-class aliases are supplied through `context.aliases`.

Each alias has:

- caller-supplied stable `id`;
- `entityId`;
- exact `text`;
- controlled or bounded custom `aliasType`;
- optional `languageTag`;
- optional `scriptIdentifier`;
- optional `notes`;
- optional `uncertainty`;
- optional `status`;
- optional `temporalAssertionId`;
- optional `sourceIds`; and
- database lifecycle timestamps on read.

Core alias types are:

- `alternate`
- `historical`
- `abbreviation`
- `acronym`
- `title`
- `transliteration`
- `translation`
- `endonym`
- `exonym`
- `former_name`
- `disputed`

An extension may use `custom:<lowercase-key>` within the bounded validation rule. Exact spelling and case in `text` are never normalized on storage. An exact duplicate for one entity, alias type, language, and script is rejected. Reimport replaces the owning bundle atomically, so it cannot accumulate duplicate alias rows.

Alias sources are optional because legacy or incomplete evidence must not be fabricated. Missing support is a review finding, not an invented link.

### Historical Organization Name Example

```json
{
  "id": "alias-organization-former-name",
  "entityId": "entity-organization-1",
  "text": "Cedar Reach Survey Circle",
  "aliasType": "former_name",
  "languageTag": "en",
  "temporalAssertionId": "time-organization-name-validity",
  "sourceIds": ["source-archive-1"],
  "uncertainty": "The exact first-use day is unknown."
}
```

## Legacy alternateNames Compatibility

Existing imports using:

```json
{
  "alternateNames": ["North Bend Reach"]
}
```

continue to validate and import unchanged. Existing entity responses continue to expose `alternateNames` as the same simple string array. New responses add `aliases` as a detailed array.

Chunk 3 performs no automatic legacy backfill. A legacy alternate name therefore remains in `alternateNames` without a fabricated alias ID, alias type, validity period, or source. A later governed change may add a first-class alias only when those facts are actually supplied.

## External Identifier Contract

First-class external identifiers are supplied through `context.externalIdentifiers`.

Each record has:

- caller-supplied stable `id`;
- `entityId`;
- `scheme`;
- exact original `value`;
- optional `normalizedValue`;
- optional `uri`;
- optional `label`;
- optional `status`;
- optional `notes`;
- optional `uncertainty`;
- optional `sourceIds`; and
- database lifecycle timestamps on read.

The scheme is provider-neutral. No import or test dereferences the URI, calls an authority service, or validates through a network.

The same scheme and original value cannot be duplicated on one entity. The same scheme/value on different entities is legal, remains visible as separate data, and produces an observer finding for identity review. It never merges the entities.

### Person External Identifier Example

```json
{
  "id": "identifier-person-authority",
  "entityId": "entity-person-1",
  "scheme": "customer-authority",
  "value": "Authority-0001",
  "normalizedValue": "authority-0001",
  "uri": "https://example.invalid/authority/Authority-0001",
  "status": "active",
  "sourceIds": ["source-register-1"]
}
```

## Temporal Role Contract

`timeRole` distinguishes the meaning of a temporal assertion:

- `event_time`
- `validity_time`
- `publication_time`
- `observation_time`
- `recording_time`
- `relationship_validity`
- `identity_name_validity`
- `source_creation_time`
- `unspecified`

Legacy assertions without a role read as `unspecified`. The role does not alter the existing `temporalKind`.

`createdAt` and `updatedAt` remain database lifecycle timestamps. They are not event time, source publication time, observation time, or relationship validity.

## Historical and Partial Date Contract

Existing `exactDate`, `startDate`, `endDate`, `beforeDate`, and `afterDate` fields retain strict modern `YYYY-MM-DD` behavior.

`structuredDate` is additive:

```json
{
  "originalLabel": "44 BCE",
  "precision": "year",
  "era": "BCE",
  "year": 44,
  "approximate": true,
  "uncertainty": "The source states only a year."
}
```

Supported precision values are:

- `day`
- `month`
- `year`
- `decade`
- `century`
- `named_period`
- `unknown`

Numeric values use a positive stated `year` plus `era: "BCE"` or `"CE"`. Month and day are optional unless their precision requires them. A named period uses `namedPeriod` and needs no numeric conversion.

The original label is always preserved. JavaScript `Date` is not used to validate BCE, year-only, decade, century, named-period, or unconverted calendar values.

### BCE/CE Representation

The public record preserves the stated era and year. Optional chronology metadata supports deterministic coarse ordering:

- CE years retain their positive number.
- `1 BCE` has chronology key `0`.
- `2 BCE` has chronology key `-1`.
- `44 BCE` has chronology key `-43`.

This signed key is internal ordering metadata, not a claim that the source supplied astronomical numbering and not a conversion to an exact proleptic-Gregorian day.

### Partial Dates

- Day precision requires year, era, month, and day.
- Month precision requires year, era, and month.
- Year precision requires year and era.
- Decade precision interprets `year` as the stated start year of that decade.
- Century precision interprets `year` as the ordinal century.
- Named periods remain label-only unless a separate sourced temporal assertion supplies numeric bounds.

### Calendar Behavior

`calendarSystem` preserves the source's stated calendar. `conversionStatus: "unconverted"` explicitly prevents chronology-key derivation for non-Gregorian values. No Julian, Hebrew, Islamic, regnal, Roman, or other calendar value is silently converted.

Gregorian, proleptic-Gregorian, ISO, or unspecified coarse year/era values may receive signed year bounds when their precision makes that deterministic. A non-Gregorian calendar or explicitly unconverted value remains label-only.

### BCE Event Example

```json
{
  "id": "time-event-bce",
  "label": "BCE event date",
  "subjectId": "entity-event-1",
  "temporalKind": "approximate",
  "timeRole": "event_time",
  "dateLabel": "44 BCE",
  "structuredDate": {
    "originalLabel": "44 BCE",
    "precision": "year",
    "era": "BCE",
    "year": 44,
    "approximate": true
  },
  "sourceIds": ["source-chronicle-1"]
}
```

## Proposed-Date Provenance

Legacy proposed dates without IDs or sources remain valid. A proposed date that supplies `sourceIds` must also supply a stable `id`.

Normalized proposal details preserve:

- proposal ID;
- modern date, original label, or structured date;
- precision;
- uncertainty;
- explanatory note;
- derived chronology bounds when safe; and
- proposal-specific source IDs.

Sources on one proposal do not imply support for another proposal.

### Disputed Event Date Example

```json
{
  "temporalKind": "disputed",
  "timeRole": "event_time",
  "dateLabel": "Either 10 or 17 May 1894",
  "proposedDates": [
    {
      "id": "proposal-field-log",
      "date": "1894-05-10",
      "label": "Date proposed by the field log",
      "sourceIds": ["source-field-log"]
    },
    {
      "id": "proposal-later-summary",
      "date": "1894-05-17",
      "label": "Date proposed by the later summary",
      "sourceIds": ["source-later-summary"]
    }
  ]
}
```

## Relationship Validity Contract

Existing contextual relationships remain valid with no validity data.

Optional `validity` contains:

- optional review `status`;
- optional explanatory `note`;
- record-level validity `sourceIds`; and
- `temporalLinks`.

Each temporal link has:

- `temporalAssertionId`;
- `linkType`;
- optional `sourceIds`; and
- optional `note`.

Link types are:

- `valid_from`
- `valid_until`
- `valid_during`
- `proposed_period`

The linked temporal assertion carries its own semantic role, date kind, uncertainty, structured value, and record-level sources. Individual link sources remain distinct.

### Time-Bounded Employment Example

```json
{
  "id": "relationship-employment-1",
  "fromId": "entity-person-1",
  "toId": "entity-organization-1",
  "relationshipType": "employed_by",
  "validity": {
    "status": "approximate",
    "temporalLinks": [
      {
        "temporalAssertionId": "time-employment-range",
        "linkType": "valid_during",
        "sourceIds": ["source-payroll-1"]
      }
    ]
  }
}
```

### Validity Filtering Limits

`validAt`, `validFrom`, and `validTo` accept valid modern `YYYY-MM-DD` query values on the contextual relationship collection.

They intentionally match only a `valid_during` link whose linked temporal assertion has deterministic modern `exactDate` or `startDate`/`endDate` values:

- `validAt` requires the date to fall within the interval.
- `validFrom` keeps intervals ending on or after the supplied lower bound.
- `validTo` keeps intervals starting on or before the supplied upper bound.

Named periods, BCE year-only values, partial values without SQL dates, disputed proposed periods, and unconverted calendars are excluded from these filters. Their omission is not a claim that a relationship was inactive.

## Field-Level Provenance Contract

`context.fieldProvenance` complements `context_record_sources`.

Each link has:

- caller-supplied stable `id`;
- contextual `targetId`;
- bounded `fieldPath`;
- optional paired `subrecordType` and `subrecordId`;
- `sourceId`;
- optional `supportType`;
- optional `note`;
- optional `confidence`;
- optional `uncertainty`; and
- created timestamp on read.

Allowed path roots cover canonical name, aliases, external identifiers, temporal role, structured dates, proposed dates, validity, and identity links. Paths are a maximum of five bounded dotted data segments. They cannot contain calls, brackets, wildcards, query syntax, or executable expressions.

Both the target contextual record and source must exist in the imported bundle. When a subrecord is named, the alias, identifier, date proposal, relationship validity record, or identity link must exist. Record-level sources continue to represent support for the whole record; field-level links never replace them.

### Field-Level Attribution Example

```json
{
  "id": "provenance-person-name",
  "targetId": "entity-person-1",
  "fieldPath": "name",
  "sourceId": "source-register-1",
  "supportType": "supports",
  "note": "Supports the canonical-name assertion only."
}
```

## Identity Ambiguity Contract

Identity semantics use the existing contextual relationship record kind:

- `possible_same_as`
- `asserted_same_as`
- `distinct_from`
- `derived_from`
- `successor_of`
- `predecessor_of`

Identity relationship endpoints must be two distinct contextual entities. `possible_same_as`, `asserted_same_as`, and `distinct_from` are symmetric for duplicate detection and deterministic entity detail projection. A reverse duplicate of the same symmetric relation is rejected. `derived_from`, `successor_of`, and `predecessor_of` retain direction.

Identity relations retain stable IDs, record-level sources, explanation, confidence, uncertainty, review status, and optional relationship validity.

### possible_same_as Example

```json
{
  "id": "identity-possible-1",
  "fromId": "entity-person-1",
  "toId": "entity-person-candidate",
  "relationshipType": "possible_same_as",
  "explanation": "The names and authority identifier overlap.",
  "uncertainty": "The records may describe different people.",
  "reviewStatus": "needs-review",
  "sourceIds": ["source-register-1"]
}
```

### distinct_from Example

```json
{
  "id": "identity-distinct-1",
  "fromId": "entity-person-1",
  "toId": "entity-person-candidate",
  "relationshipType": "distinct_from",
  "explanation": "A second source describes incompatible life details.",
  "reviewStatus": "needs-review",
  "sourceIds": ["source-biography-2"]
}
```

Both examples may coexist. That conflict is retained and reported for review.

## Non-Merge Guarantee

No Chunk 3 schema, importer, store, route, search function, governance function, or observer:

- merges entities;
- deletes duplicate-looking entities;
- rewrites entity or foreign-key IDs;
- redirects entity URLs;
- chooses a canonical entity;
- treats a matching name or identifier as proof;
- collapses identity-related search results;
- auto-approves identity conclusions; or
- publishes observer findings.

`asserted_same_as` remains a sourced contextual assertion, not a database merge.

## Import Contract

The contextual bundle contract is additive:

- every legacy field remains;
- `aliases`, `externalIdentifiers`, and `fieldProvenance` are optional bundle-level collections;
- temporal roles and structured dates are optional;
- proposal IDs and sources are optional for legacy proposals;
- relationship validity is optional; and
- identity semantics use existing relationships.

Validation rejects structurally unsafe values: missing child IDs or fields, broken entity/source/temporal targets, exact duplicate children, invalid roles, impossible structured combinations, reversed deterministic ranges, unsafe field paths, self-links, broken identity endpoints, and reverse symmetric duplicates.

Validation permits evidence-preserving ambiguity: cross-entity identifier reuse, multiple proposed dates, contradictory identity relation types, disputed status, and label-only/unconverted chronology.

All contextual data is persisted in the existing bundle import transaction. Any child insert failure rolls back sources, core registries, contextual records, and all new children. Bundle replacement and narrow test-only deletion remove owned child rows through foreign keys and cascades.

## API Contract

All existing context routes and legacy response keys remain.

Entity detail adds:

- `aliases`
- `externalIdentifiers`
- `identityLinks`
- `fieldProvenance`
- `temporalContext`

Temporal detail adds:

- `timeRole`
- `structuredDate`
- `chronology`
- `proposedDateDetails`

Relationship detail adds:

- `reviewStatus`
- `validity`
- `temporalLinks`
- `validitySources`

Every contextual detail may expose `fieldProvenance` and `temporalContext` where relevant.

New read-only collections:

- `GET /api/v1/context/entities/:contextId/aliases`
- `GET /api/v1/context/entities/:contextId/identifiers`

Both use Registry API Contract 1.0:

- `items`
- exact `total`
- `returned`
- `hasMore`
- pagination metadata
- applied filters
- applied sort
- immutable-ID tie-breaker
- route-specific collection key
- ignored unknown query metadata
- safe additive errors
- response `X-Request-ID`

No public write endpoint is added.

## Search Behavior

Contextual entity search includes:

- canonical name;
- legacy `alternateNames`;
- normalized first-class alias text;
- exact external identifier value; and
- scheme plus value text.

Search result shapes and existing ranking remain. Exact identifier and alias matches receive the existing entity exact-alias rank. Stable title/type/ID tie-breaking remains. Two entities with the same identifier or an identity relationship remain two search results.

No external network lookup or unbounded authority scan occurs. Alias and identifier lookup indexes support the new read paths.

## Governance Compatibility

The existing governance state machine, permissions, CSRF, organization scope, separation of duties, validation result, publication, audit, and rollback behavior remain.

Governed entity snapshots include normalized aliases, external identifiers, and field provenance. Temporal and relationship snapshots retain their structured date, proposed-date, identity, and validity data through `raw_data`. Materialization replaces only the governed target's owned normalized children from the snapshot. Rollback rematerializes the prior snapshot.

Identity and chronology changes require the same human approval and publication path as other contextual changes. Chunk 3 creates no second workflow and no auto-approval path.

## Observer Findings

The Data Quality and Provenance Observer may report:

- alias without source support;
- identifier without source support;
- identifier reuse across entities;
- exact duplicate aliases;
- incomplete temporal precision;
- inconsistent or broken relationship validity;
- missing field-provenance target;
- `possible_same_as` without evidence;
- contradictory identity relations;
- entity pairs marked both possible/equivalent and distinct; and
- unsupported calendar conversion claims.

Findings are stable, machine-readable, human-readable, and sorted deterministically. They preserve record/entity/source IDs and recommend human review.

The Platform Operations Observer recognizes contextual validation and persistence failure categories and groups them using existing correlation behavior.

Both observers remain Level 1 and read-only. They have no database, network, filesystem, shell, merge, rewrite, proposal, publication, retry, restart, or mutation authority.

## Migration Behavior

`backend/db/migrations/011_refine_contextual_identity_time.sql`:

- adds only columns, tables, constraints, and indexes;
- uses `IF NOT EXISTS` and safe constraint replacement consistent with the migration runner;
- preserves existing contextual rows;
- defaults existing temporal assertions to `time_role = 'unspecified'`;
- leaves their structured date and chronology bounds null;
- creates no alias, identifier, source, validity, provenance, or identity backfill;
- uses foreign keys and cascading ownership to prevent orphaned children; and
- runs only through explicitly test-scoped migration verification in this stage.

Existing migrations, including both `005` filenames, remain byte-for-byte untouched.

## Deferred Work

Deferred:

- reliable active-at filtering for label-only, BCE partial, named-period, proposed-only, and unconverted-calendar validity;
- calendar conversion;
- authority dereferencing and network validation;
- identity merge or canonicalization;
- public write APIs or a context editor;
- a new governance UI;
- persistent observer storage or production monitoring; and
- SourceRoot Chunk 4 contextual assertions, evidence, and versioning.
