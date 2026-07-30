ALTER TABLE dictionaryroot_lexical_senses
  ADD CONSTRAINT uq_dictionaryroot_lexical_sense_dataset
  UNIQUE (sense_id, dataset_id);

ALTER TABLE dictionaryroot_lexical_evidence_sources
  ADD CONSTRAINT uq_dictionaryroot_lexical_source_dataset
  UNIQUE (source_id, dataset_id);

CREATE TABLE dictionaryroot_lexical_relationship_types (
  relationship_type TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  directionality TEXT NOT NULL,
  inverse_relationship_type TEXT,
  self_relationship_permitted BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_dictionaryroot_lexical_relationship_type_directionality
    CHECK (directionality IN ('directional', 'symmetric')),
  CONSTRAINT uq_dictionaryroot_lexical_relationship_type_direction
    UNIQUE (relationship_type, directionality),
  CONSTRAINT fk_dictionaryroot_lexical_relationship_type_inverse
    FOREIGN KEY (inverse_relationship_type)
    REFERENCES dictionaryroot_lexical_relationship_types(relationship_type)
    DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO dictionaryroot_lexical_relationship_types
  (relationship_type, display_name, directionality, inverse_relationship_type,
   description)
VALUES
  ('substantially_equivalent', 'Synonym or substantially equivalent',
   'symmetric', 'substantially_equivalent',
   'Reviewed evidence supports substantially equivalent lexical meaning.'),
  ('antonym', 'Antonym', 'symmetric', 'antonym',
   'Reviewed evidence supports lexical opposition.'),
  ('broader', 'Broader', 'directional', 'narrower',
   'The source sense is broader than the target sense.'),
  ('narrower', 'Narrower', 'directional', 'broader',
   'The source sense is narrower than the target sense.'),
  ('related', 'Related', 'symmetric', 'related',
   'The senses have a sourced lexical relationship not expressed more narrowly.'),
  ('derivationally_related', 'Derivationally related', 'symmetric',
   'derivationally_related',
   'The senses participate in a sourced derivational family.'),
  ('historical_predecessor', 'Historical predecessor', 'directional',
   'historical_successor',
   'The source sense precedes the target sense in the supported historical account.'),
  ('historical_successor', 'Historical successor', 'directional',
   'historical_predecessor',
   'The source sense succeeds the target sense in the supported historical account.'),
  ('technical_specialization', 'Technical specialization', 'directional',
   'generalization',
   'The source sense is a sourced technical specialization of the target sense.'),
  ('generalization', 'Generalization', 'directional',
   'technical_specialization',
   'The source sense is a sourced generalization of the target sense.'),
  ('translation_related', 'Translation-related', 'symmetric',
   'translation_related',
   'Sources support a qualified cross-language or translation relationship.'),
  ('disputed', 'Disputed relationship', 'symmetric', 'disputed',
   'Sources or reviewers explicitly dispute the proposed relationship.'),
  ('unresolved', 'Unresolved relationship', 'symmetric', 'unresolved',
   'Evidence records a relationship candidate without resolving its semantics.');

CREATE TABLE dictionaryroot_lexical_relationships (
  relationship_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  source_sense_id TEXT NOT NULL,
  target_sense_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  directionality TEXT NOT NULL,
  relationship_status TEXT NOT NULL,
  review_status TEXT NOT NULL,
  qualification TEXT,
  uncertainty TEXT,
  chronology_context TEXT,
  domain_context TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_source_sense
    FOREIGN KEY (source_sense_id, dataset_id)
    REFERENCES dictionaryroot_lexical_senses(sense_id, dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_target_sense
    FOREIGN KEY (target_sense_id, dataset_id)
    REFERENCES dictionaryroot_lexical_senses(sense_id, dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_type
    FOREIGN KEY (relationship_type, directionality)
    REFERENCES dictionaryroot_lexical_relationship_types(
      relationship_type, directionality
    ),
  CONSTRAINT uq_dictionaryroot_lexical_relationship_identity
    UNIQUE (
      dataset_id, source_sense_id, target_sense_id, relationship_type
    ),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_distinct
    CHECK (source_sense_id <> target_sense_id),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_symmetric_order
    CHECK (
      directionality = 'directional'
      OR source_sense_id < target_sense_id
    ),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_status
    CHECK (relationship_status IN ('asserted', 'qualified', 'disputed', 'unresolved', 'archived')),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_review_status
    CHECK (review_status IN ('reviewed', 'needs_review', 'disputed', 'unresolved')),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_version
    CHECK (record_version > 0)
);

CREATE TABLE dictionaryroot_lexical_relationship_evidence (
  evidence_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  relationship_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  provenance_identity TEXT NOT NULL,
  evidence_role TEXT NOT NULL,
  source_wording TEXT,
  normalized_summary TEXT,
  normalization_label TEXT,
  review_status TEXT NOT NULL,
  uncertainty TEXT,
  qualification TEXT,
  edition_context TEXT,
  version_context TEXT,
  page TEXT,
  entry_headword TEXT,
  sense_number TEXT,
  section TEXT,
  paragraph TEXT,
  dataset_record_id TEXT,
  stable_fragment TEXT,
  canonical_url TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_evidence_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_evidence_relationship
    FOREIGN KEY (relationship_id)
    REFERENCES dictionaryroot_lexical_relationships(relationship_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_relationship_evidence_source
    FOREIGN KEY (source_id, dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id, dataset_id),
  CONSTRAINT uq_dictionaryroot_lexical_relationship_evidence_identity
    UNIQUE (relationship_id, source_id, provenance_identity),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_evidence_content
    CHECK (source_wording IS NOT NULL OR normalized_summary IS NOT NULL),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_evidence_locator
    CHECK (NUM_NONNULLS(
      page, entry_headword, sense_number, section, paragraph,
      dataset_record_id, stable_fragment
    ) > 0),
  CONSTRAINT ck_dictionaryroot_lexical_relationship_evidence_version
    CHECK (record_version > 0)
);

CREATE INDEX idx_dictionaryroot_lexical_relationship_source
  ON dictionaryroot_lexical_relationships(
    dataset_id, source_sense_id, relationship_type, relationship_id
  );
CREATE INDEX idx_dictionaryroot_lexical_relationship_target
  ON dictionaryroot_lexical_relationships(
    dataset_id, target_sense_id, relationship_type, relationship_id
  );
CREATE INDEX idx_dictionaryroot_lexical_relationship_evidence_relationship
  ON dictionaryroot_lexical_relationship_evidence(
    relationship_id, evidence_id
  );
