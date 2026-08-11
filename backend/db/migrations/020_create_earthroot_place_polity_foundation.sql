-- Chunk 15A: EarthRoot Place / Geography / Polity semantic foundation.
--
-- SCOPE. This migration establishes EarthRoot-owned persistence for canonical
-- Place and Polity resources, their governed semantic assertions, and the
-- evidence those assertions require. It also widens two Chunk 14A constraints
-- so an EarthRoot resource can be admitted to the cross-Root registry later.
--
-- PRESERVATION. Migrations 018 and 019 are immutable and are NOT edited. This
-- migration performs NO destructive transformation: it drops and re-adds two
-- CHECK constraints as strict supersets of their released predicates, so every
-- existing 14A/14B row remains valid by construction. No row is deleted,
-- rewritten, or reinterpreted.
--
-- DELIBERATELY ABSENT. No coordinate column, no geometry type, no PostGIS,
-- no spatial index, no bounding box, no distance or radius, no real corpus
-- data, and no EarthRoot row of any kind. Chunk 15A defers geometry entirely.
--
-- The released root_id and resource_type CHECK constraints in migration 018 are
-- inline, so PostgreSQL assigned them deterministic auto-generated names of the
-- form <table>_<column>_check. Those names are KNOWN, so they are dropped
-- explicitly.
--
-- An earlier revision of this migration discovered them by scanning
-- pg_constraint with LIKE and LIMIT 1 and no ORDER BY. Two released constraints
-- matched that predicate, catalog order is not contractual, and the scan
-- dropped the wrong one: the narrow released root_id check survived, the
-- widening silently did not happen, and the outcome was query-plan dependent.
-- Deterministic named drops replace it, and a post-condition below proves the
-- intended end state rather than assuming it.

ALTER TABLE cross_root_resources
  DROP CONSTRAINT IF EXISTS cross_root_resources_root_id_check;

ALTER TABLE cross_root_resources
  ADD CONSTRAINT ck_cross_root_resource_root_id
  CHECK (root_id IN ('DictionaryRoot', 'HistoryRoot', 'BibleRoot', 'EarthRoot'));

ALTER TABLE cross_root_resources
  DROP CONSTRAINT IF EXISTS cross_root_resources_resource_type_check;

ALTER TABLE cross_root_resources
  ADD CONSTRAINT ck_cross_root_resource_type_vocabulary
  CHECK (resource_type IN (
    'lemma',
    'accepted-contextual-record',
    'edition-verse-text',
    'place',
    'polity'
  ));

-- The released Root-to-type pairing constraint is replaced by a superset that
-- preserves all three released pairings verbatim and adds only the two
-- EarthRoot pairings.
ALTER TABLE cross_root_resources
  DROP CONSTRAINT IF EXISTS ck_cross_root_resource_type;

ALTER TABLE cross_root_resources
  ADD CONSTRAINT ck_cross_root_resource_type CHECK (
    (root_id = 'DictionaryRoot' AND resource_type = 'lemma')
    OR (root_id = 'HistoryRoot' AND resource_type = 'accepted-contextual-record')
    OR (root_id = 'BibleRoot' AND resource_type = 'edition-verse-text')
    OR (root_id = 'EarthRoot' AND resource_type IN ('place', 'polity'))
  );

-- POST-CONDITION. The previous revision reported success while leaving the
-- narrow released constraint in force, so this migration now proves its own
-- effect instead of assuming it. Any surviving CHECK on cross_root_resources
-- that admits DictionaryRoot but not EarthRoot would AND with the new rule and
-- silently defeat the widening. If one exists, fail and roll back.
DO $$
DECLARE
  offending TEXT;
BEGIN
  -- Two shapes of narrow constraint can defeat the widening, and they look
  -- nothing alike. A Root-shaped one names DictionaryRoot; a vocabulary-shaped
  -- one names only the released resource types and never mentions a Root at
  -- all. Checking for the first alone is blind to the second, which is exactly
  -- the constraint the defective version of this migration failed to drop.
  SELECT string_agg(con.conname, ', ') INTO offending
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'cross_root_resources'
    AND con.contype = 'c'
    AND (
      (pg_get_constraintdef(con.oid) LIKE '%DictionaryRoot%'
        AND pg_get_constraintdef(con.oid) NOT LIKE '%EarthRoot%')
      OR
      (pg_get_constraintdef(con.oid) LIKE '%lemma%'
        AND pg_get_constraintdef(con.oid) NOT LIKE '%place%')
    );

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration 020 post-condition failed: constraint(s) % still exclude EarthRoot from cross_root_resources.',
      offending
      USING ERRCODE = '23514';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- EarthRoot datasets
-- ---------------------------------------------------------------------------

CREATE TABLE earthroot_datasets (
  dataset_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('fixture', 'accepted')),
  fixture_only BOOLEAN NOT NULL,
  contract_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Chunk 15A ships synthetic fixtures only. A dataset that claims released
  -- status while remaining fixture-only would be a false provenance claim.
  CONSTRAINT ck_earthroot_dataset_fixture_coherent
    CHECK ((status = 'fixture') = (fixture_only IS TRUE))
);

-- ---------------------------------------------------------------------------
-- EarthRoot resources: Place and Polity as DISTINCT identity classes
-- ---------------------------------------------------------------------------

CREATE TABLE earthroot_resources (
  resource_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL
    REFERENCES earthroot_datasets(dataset_id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('place', 'polity')),
  -- Opaque, Root-issued, immutable once minted, and independent of name,
  -- classification, polity, language, source locator, and dataset version.
  canonical_public_id TEXT NOT NULL
    CHECK (canonical_public_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_earthroot_resource_canonical
    UNIQUE (dataset_id, canonical_public_id),
  -- Enables typed foreign keys from assertions. This makes SUBJECT-side
  -- predicate endpoint typing enforceable by the database rather than only by
  -- application code. It does NOT do the same for the object side: see the
  -- enforcement-boundary note on ck_earthroot_predicate_typing below.
  CONSTRAINT uq_earthroot_resource_typed UNIQUE (resource_id, entity_type)
);

-- Deleting a resource that still carries assertions must fail loudly rather
-- than silently discarding sourced semantics.
CREATE TABLE earthroot_assertions (
  assertion_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL
    REFERENCES earthroot_datasets(dataset_id) ON DELETE RESTRICT,
  subject_resource_id TEXT NOT NULL
    REFERENCES earthroot_resources(resource_id) ON DELETE RESTRICT,
  subject_entity_type TEXT NOT NULL,
  predicate TEXT NOT NULL CHECK (predicate IN (
    'named_as',
    'classified_as',
    'located_within',
    'governed_by',
    'administered_by'
  )),
  object_resource_id TEXT
    REFERENCES earthroot_resources(resource_id) ON DELETE RESTRICT,
  -- object_entity_type is constrained even when there is no persisted object
  -- resource: the composite foreign key below is MATCH SIMPLE, so a NULL
  -- object_resource_id satisfies it vacuously and would otherwise let a row
  -- carry a dangling entity-class claim about nothing.
  object_entity_type TEXT CHECK (
    object_entity_type IS NULL OR object_entity_type IN ('place', 'polity')
  ),
  -- A blank literal is not a name or a classification.
  object_literal TEXT CHECK (
    object_literal IS NULL OR length(trim(object_literal)) > 0
  ),
  name_type TEXT CHECK (name_type IN (
    'preferred', 'alternate', 'historical', 'former_name',
    'endonym', 'exonym', 'transliteration', 'translation', 'disputed'
  )),
  -- Blank is not a language and blank is not a script. The domain layer
  -- enforces the same rule, so a canonical object cannot exist in a state the
  -- public payload would reject.
  language_tag TEXT CHECK (
    language_tag IS NULL OR length(trim(language_tag)) > 0
  ),
  script_identifier TEXT CHECK (
    script_identifier IS NULL OR script_identifier ~ '^[A-Z][a-z]{3}$'
  ),

  temporal_mode TEXT NOT NULL CHECK (temporal_mode IN ('not_asserted', 'asserted')),
  -- Signed years so BCE is representable without calendar conversion, which
  -- this stage deliberately does not perform.
  valid_from_year INTEGER,
  valid_until_year INTEGER,
  temporal_description TEXT,

  certainty TEXT NOT NULL CHECK (length(trim(certainty)) > 0),
  uncertainty_statement TEXT,
  review_state TEXT NOT NULL CHECK (review_state IN (
    'unreviewed', 'accepted_after_review', 'disputed', 'rejected'
  )),
  dispute_state TEXT NOT NULL CHECK (dispute_state IN ('not_disputed', 'disputed')),
  assertion_status TEXT NOT NULL CHECK (assertion_status IN ('active', 'withdrawn')),
  -- Machine-proposed derivation is absent by design, matching the released
  -- rule that machine-proposed identity is not accepted.
  derivation TEXT NOT NULL CHECK (derivation IN ('directly_sourced', 'human_proposed')),
  assertion_order INTEGER NOT NULL CHECK (assertion_order > 0),

  CONSTRAINT fk_earthroot_assertion_subject_typed
    FOREIGN KEY (subject_resource_id, subject_entity_type)
    REFERENCES earthroot_resources(resource_id, entity_type) ON DELETE RESTRICT,
  CONSTRAINT fk_earthroot_assertion_object_typed
    FOREIGN KEY (object_resource_id, object_entity_type)
    REFERENCES earthroot_resources(resource_id, entity_type) ON DELETE RESTRICT,

  -- A resource is never related to itself.
  CONSTRAINT ck_earthroot_assertion_no_self
    CHECK (object_resource_id IS NULL OR object_resource_id <> subject_resource_id),

  -- Exactly one object form, never both and never neither.
  CONSTRAINT ck_earthroot_assertion_object_exclusive CHECK (
    (object_resource_id IS NOT NULL AND object_literal IS NULL)
    OR (object_resource_id IS NULL AND object_literal IS NOT NULL)
  ),

  -- Typed predicate governance. ENFORCEMENT BOUNDARY, STATED EXACTLY.
  --
  -- SUBJECT-side typing IS enforced here: subject_entity_type is NOT NULL and
  -- is kept truthful by the composite subject foreign key, so a polity can
  -- never be the subject of located_within, governed_by, or administered_by.
  --
  -- OBJECT-side typing is NOT fully enforced by this constraint. When
  -- object_entity_type IS NULL every branch below evaluates to NULL, and a
  -- CHECK that evaluates to NULL PASSES. The composite object foreign key is
  -- MATCH SIMPLE, so it too is satisfied vacuously whenever either column is
  -- NULL. A row may therefore name a place as the object of governed_by, omit
  -- object_entity_type, and be accepted by the database. For that class of
  -- rule the domain validator and the store are the ONLY guard, not defence in
  -- depth.
  --
  -- An earlier revision of this comment read "Typed predicate governance,
  -- enforced in the database" with no qualification. That was FALSE for the
  -- object side and is corrected here rather than left to be discovered.
  -- Closing the gap needs a future governed migration; it is registered as
  -- EARTHROOT TYPED-PREDICATE DB ENFORCEMENT (N9), deferred and blocking
  -- EarthRoot activation. This migration deliberately changes no executable
  -- SQL to close it.
  CONSTRAINT ck_earthroot_predicate_typing CHECK (
    (predicate = 'named_as'
      AND object_literal IS NOT NULL AND name_type IS NOT NULL)
    OR (predicate = 'classified_as'
      AND subject_entity_type = 'place'
      AND object_literal IS NOT NULL AND name_type IS NULL)
    OR (predicate = 'located_within'
      AND subject_entity_type = 'place' AND object_entity_type = 'place'
      AND name_type IS NULL)
    OR (predicate IN ('governed_by', 'administered_by')
      AND subject_entity_type = 'place' AND object_entity_type = 'polity'
      AND name_type IS NULL)
  ),

  -- The honesty invariant: absence of a temporal claim is never a claim.
  CONSTRAINT ck_earthroot_not_asserted_is_empty CHECK (
    temporal_mode <> 'not_asserted'
    OR (valid_from_year IS NULL
        AND valid_until_year IS NULL
        AND temporal_description IS NULL)
  ),
  CONSTRAINT ck_earthroot_asserted_has_content CHECK (
    temporal_mode <> 'asserted'
    OR valid_from_year IS NOT NULL
    OR valid_until_year IS NOT NULL
    OR temporal_description IS NOT NULL
  ),
  CONSTRAINT ck_earthroot_temporal_bounds_ordered CHECK (
    valid_from_year IS NULL
    OR valid_until_year IS NULL
    OR valid_from_year <= valid_until_year
  ),
  CONSTRAINT ck_earthroot_dispute_has_statement CHECK (
    dispute_state <> 'disputed'
    OR (uncertainty_statement IS NOT NULL
        AND length(trim(uncertainty_statement)) > 0)
  ),
  -- Target for the composite evidence foreign key below, so an evidence row can
  -- never claim a dataset other than its parent assertion's.
  CONSTRAINT uq_earthroot_assertion_dataset UNIQUE (assertion_id, dataset_id),
  -- assertion_order is a TOTAL order within a subject and predicate. Without
  -- uniqueness two assertions could tie and be returned in arbitrary order,
  -- which is presentation nondeterminism in a system whose whole claim is
  -- determinism. Mirrors uq_earthroot_evidence_order.
  CONSTRAINT uq_earthroot_assertion_order
    UNIQUE (subject_resource_id, predicate, assertion_order)
);

-- The assertion reference is COMPOSITE, mirroring the released Chunk 14B
-- evidence foreign key. Two independent references would let an evidence row
-- name a dataset different from its parent assertion's, and the two evidence
-- triggers below would then disagree about which rows count as support.
CREATE TABLE earthroot_assertion_evidence (
  evidence_id TEXT PRIMARY KEY,
  assertion_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL
    REFERENCES earthroot_datasets(dataset_id) ON DELETE RESTRICT,
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) > 0),
  source_locator TEXT NOT NULL CHECK (length(trim(source_locator)) > 0),
  statement TEXT NOT NULL CHECK (length(trim(statement)) > 0),
  source_dataset_id TEXT NOT NULL CHECK (length(trim(source_dataset_id)) > 0),
  source_dataset_version TEXT NOT NULL
    CHECK (length(trim(source_dataset_version)) > 0),
  evidence_order INTEGER NOT NULL CHECK (evidence_order > 0),
  CONSTRAINT uq_earthroot_evidence_order UNIQUE (assertion_id, evidence_order),
  CONSTRAINT fk_earthroot_evidence_assertion
    FOREIGN KEY (assertion_id, dataset_id)
    REFERENCES earthroot_assertions(assertion_id, dataset_id) ON DELETE CASCADE
);

CREATE INDEX idx_earthroot_resources_lookup
  ON earthroot_resources(dataset_id, entity_type, canonical_public_id);
CREATE INDEX idx_earthroot_assertions_subject
  ON earthroot_assertions(subject_resource_id, predicate, assertion_order);
CREATE INDEX idx_earthroot_assertions_object
  ON earthroot_assertions(object_resource_id, predicate);
CREATE INDEX idx_earthroot_evidence_assertion
  ON earthroot_assertion_evidence(assertion_id, evidence_order);

-- ---------------------------------------------------------------------------
-- Mandatory evidence, enforced at commit.
--
-- Mirrors the released Chunk 14B pattern: a deferred constraint trigger, so an
-- assertion and its evidence may be inserted in either order within one
-- transaction, but a transaction that commits an assertion with no evidence
-- fails. Unsourced geographic or political truth cannot become canonical.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION require_earthroot_assertion_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM earthroot_assertion_evidence evidence
    WHERE evidence.assertion_id = NEW.assertion_id
      AND evidence.dataset_id = NEW.dataset_id
  ) THEN
    RAISE EXCEPTION 'EarthRoot assertion requires at least one evidence record: %', NEW.assertion_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER earthroot_assertion_requires_evidence
AFTER INSERT OR UPDATE ON earthroot_assertions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION require_earthroot_assertion_evidence();

-- ---------------------------------------------------------------------------
-- Removing evidence may not silently unsource a surviving assertion.
--
-- The assertion-side trigger above fires on INSERT and UPDATE only, so removing
-- the last evidence row would otherwise leave an active, canonical, unsourced
-- assertion. This mirror trigger closes that hole from the evidence side.
--
-- It fires on UPDATE as well as DELETE. Re-pointing the final evidence row at
-- another assertion, or at another dataset, unsources the original just as
-- surely as deleting it; guarding only DELETE would leave the same orphaning
-- reachable through a different verb.
--
-- Both this trigger and the assertion-side trigger qualify support by
-- (assertion_id, dataset_id), so the two can never disagree about which
-- evidence rows count.
--
-- It is deferred, so legitimate teardown still works: removing evidence and its
-- assertion in one transaction leaves no surviving parent at commit and passes.
-- Removing one of several evidence rows also passes while at least one remains.
-- Removing the final evidence row of a surviving assertion fails at COMMIT.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION require_earthroot_evidence_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM earthroot_assertions assertion
    WHERE assertion.assertion_id = OLD.assertion_id
      AND assertion.dataset_id = OLD.dataset_id
  ) AND NOT EXISTS (
    SELECT 1 FROM earthroot_assertion_evidence evidence
    WHERE evidence.assertion_id = OLD.assertion_id
      AND evidence.dataset_id = OLD.dataset_id
  ) THEN
    RAISE EXCEPTION 'EarthRoot assertion would be left unsourced by evidence removal: %', OLD.assertion_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER earthroot_evidence_delete_keeps_assertion_sourced
AFTER DELETE OR UPDATE ON earthroot_assertion_evidence
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION require_earthroot_evidence_on_delete();

-- ---------------------------------------------------------------------------
-- TRUNCATE is a third verb that reaches the same unsourced state.
--
-- A CONSTRAINT TRIGGER is row-level and cannot fire on TRUNCATE, so the two
-- guards above are both blind to it: `TRUNCATE earthroot_assertion_evidence`
-- would leave every surviving assertion active, canonical, and unsourced with
-- no error and no rollback. This statement-level trigger closes that verb.
--
-- Truncating BOTH tables together is still legitimate teardown and passes,
-- because no assertion survives to be left unsourced.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION require_earthroot_evidence_on_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  orphaned BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphaned
  FROM earthroot_assertions assertion
  WHERE NOT EXISTS (
    SELECT 1 FROM earthroot_assertion_evidence evidence
    WHERE evidence.assertion_id = assertion.assertion_id
      AND evidence.dataset_id = assertion.dataset_id
  );

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'Truncating EarthRoot evidence would leave % canonical assertion(s) unsourced.', orphaned
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER earthroot_evidence_truncate_keeps_assertions_sourced
AFTER TRUNCATE ON earthroot_assertion_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION require_earthroot_evidence_on_truncate();
