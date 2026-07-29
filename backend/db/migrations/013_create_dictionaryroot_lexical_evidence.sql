CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_evidence_datasets (
  dataset_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  rights_summary TEXT NOT NULL,
  fixture_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dictionaryroot_lexical_evidence_dataset_status
    CHECK (status IN ('fixture', 'review', 'accepted', 'archived'))
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_evidence_sources (
  source_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  account_id TEXT,
  name TEXT NOT NULL,
  edition TEXT,
  version TEXT,
  rights_class TEXT NOT NULL,
  license TEXT NOT NULL,
  canonical_url TEXT,
  lineage_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_evidence_source_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_dictionaryroot_lexical_evidence_source_dataset_name
    UNIQUE (dataset_id, name, edition)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_lemmas (
  lemma_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  canonical_written_form TEXT NOT NULL,
  normalized_form TEXT NOT NULL,
  language TEXT NOT NULL,
  script TEXT,
  status TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_lemma_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_dictionaryroot_lexical_lemma_identity
    UNIQUE (dataset_id, normalized_form, language, status),
  CONSTRAINT ck_dictionaryroot_lexical_lemma_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_senses (
  sense_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  lexical_category TEXT NOT NULL,
  status TEXT NOT NULL,
  review_status TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_sense_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT ck_dictionaryroot_lexical_sense_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_lemma_senses (
  lemma_id TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  association_type TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lemma_id, sense_id),
  CONSTRAINT fk_dictionaryroot_lexical_lemma_sense_lemma
    FOREIGN KEY (lemma_id) REFERENCES dictionaryroot_lexical_lemmas(lemma_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_lemma_sense_sense
    FOREIGN KEY (sense_id) REFERENCES dictionaryroot_lexical_senses(sense_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_definition_claims (
  claim_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_account_id TEXT,
  exact_wording TEXT,
  normalized_definition TEXT,
  normalization_label TEXT,
  language TEXT NOT NULL,
  claim_status TEXT NOT NULL,
  edition_context TEXT,
  usage_label TEXT,
  domain_label TEXT,
  register_label TEXT,
  uncertainty TEXT,
  qualification TEXT,
  evidence_relationship TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_claim_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_claim_sense
    FOREIGN KEY (sense_id) REFERENCES dictionaryroot_lexical_senses(sense_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_claim_source
    FOREIGN KEY (source_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id),
  CONSTRAINT uq_dictionaryroot_lexical_source_claim
    UNIQUE (sense_id, source_id, edition_context, exact_wording),
  CONSTRAINT ck_dictionaryroot_lexical_claim_content
    CHECK (exact_wording IS NOT NULL OR normalized_definition IS NOT NULL),
  CONSTRAINT ck_dictionaryroot_lexical_claim_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_forms (
  form_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  lemma_id TEXT NOT NULL,
  sense_id TEXT,
  source_id TEXT,
  written_form TEXT NOT NULL,
  normalized_form TEXT NOT NULL,
  form_type TEXT NOT NULL,
  language TEXT NOT NULL,
  script TEXT,
  grammatical_features TEXT,
  chronology_display TEXT,
  usage_context TEXT,
  uncertainty TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_form_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_form_lemma
    FOREIGN KEY (lemma_id) REFERENCES dictionaryroot_lexical_lemmas(lemma_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_form_sense
    FOREIGN KEY (sense_id) REFERENCES dictionaryroot_lexical_senses(sense_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_dictionaryroot_lexical_form_source
    FOREIGN KEY (source_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id),
  CONSTRAINT uq_dictionaryroot_lexical_form_identity
    UNIQUE (dataset_id, lemma_id, normalized_form, form_type, language),
  CONSTRAINT ck_dictionaryroot_lexical_form_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_etymology_proposals (
  proposal_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  subject_lemma_id TEXT,
  subject_form_id TEXT,
  subject_sense_id TEXT,
  source_id TEXT NOT NULL,
  source_account_id TEXT,
  proposed_source_language TEXT,
  proposed_etymon TEXT,
  relationship_type TEXT NOT NULL,
  chronology_display TEXT,
  confidence TEXT NOT NULL,
  qualification TEXT,
  review_status TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_etymology_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_etymology_lemma
    FOREIGN KEY (subject_lemma_id)
    REFERENCES dictionaryroot_lexical_lemmas(lemma_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_etymology_form
    FOREIGN KEY (subject_form_id)
    REFERENCES dictionaryroot_lexical_forms(form_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_etymology_sense
    FOREIGN KEY (subject_sense_id)
    REFERENCES dictionaryroot_lexical_senses(sense_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_etymology_source
    FOREIGN KEY (source_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id),
  CONSTRAINT ck_dictionaryroot_lexical_etymology_subject
    CHECK (NUM_NONNULLS(subject_lemma_id, subject_form_id, subject_sense_id) = 1),
  CONSTRAINT ck_dictionaryroot_lexical_etymology_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_etymology_competitors (
  proposal_id TEXT NOT NULL,
  competing_proposal_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  PRIMARY KEY (proposal_id, competing_proposal_id),
  CONSTRAINT fk_dictionaryroot_lexical_competitor_proposal
    FOREIGN KEY (proposal_id)
    REFERENCES dictionaryroot_lexical_etymology_proposals(proposal_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_competitor_competing
    FOREIGN KEY (competing_proposal_id)
    REFERENCES dictionaryroot_lexical_etymology_proposals(proposal_id)
    ON DELETE CASCADE,
  CONSTRAINT ck_dictionaryroot_lexical_competitor_distinct
    CHECK (proposal_id <> competing_proposal_id)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_source_comparisons (
  comparison_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  left_claim_id TEXT NOT NULL,
  right_claim_id TEXT NOT NULL,
  comparison_type TEXT NOT NULL,
  review_status TEXT NOT NULL,
  explanation TEXT NOT NULL,
  reviewer_identity TEXT,
  algorithmic_suggestion TEXT,
  algorithmic_ruleset_version TEXT,
  source_lineage_relation TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_comparison_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_comparison_sense
    FOREIGN KEY (sense_id) REFERENCES dictionaryroot_lexical_senses(sense_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_comparison_left
    FOREIGN KEY (left_claim_id)
    REFERENCES dictionaryroot_lexical_definition_claims(claim_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_comparison_right
    FOREIGN KEY (right_claim_id)
    REFERENCES dictionaryroot_lexical_definition_claims(claim_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_dictionaryroot_lexical_comparison_claims
    UNIQUE (left_claim_id, right_claim_id, comparison_type),
  CONSTRAINT ck_dictionaryroot_lexical_comparison_distinct
    CHECK (left_claim_id <> right_claim_id),
  CONSTRAINT ck_dictionaryroot_lexical_comparison_version
    CHECK (record_version > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_source_locators (
  locator_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  claim_id TEXT,
  form_id TEXT,
  proposal_id TEXT,
  comparison_id TEXT,
  source_id TEXT NOT NULL,
  edition TEXT,
  volume TEXT,
  page TEXT,
  column_name TEXT,
  entry_headword TEXT,
  sense_number TEXT,
  section TEXT,
  paragraph TEXT,
  dataset_record_id TEXT,
  synset_id TEXT,
  api_object_id TEXT,
  stable_fragment TEXT,
  archive_identifier TEXT,
  canonical_url TEXT,
  access_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_locator_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_locator_claim
    FOREIGN KEY (claim_id)
    REFERENCES dictionaryroot_lexical_definition_claims(claim_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_locator_form
    FOREIGN KEY (form_id)
    REFERENCES dictionaryroot_lexical_forms(form_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_locator_proposal
    FOREIGN KEY (proposal_id)
    REFERENCES dictionaryroot_lexical_etymology_proposals(proposal_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_locator_comparison
    FOREIGN KEY (comparison_id)
    REFERENCES dictionaryroot_lexical_source_comparisons(comparison_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_locator_source
    FOREIGN KEY (source_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id),
  CONSTRAINT ck_dictionaryroot_lexical_locator_subject
    CHECK (NUM_NONNULLS(claim_id, form_id, proposal_id, comparison_id) = 1),
  CONSTRAINT ck_dictionaryroot_lexical_locator_precision
    CHECK (NUM_NONNULLS(
      page, column_name, entry_headword, sense_number, section, paragraph,
      dataset_record_id, synset_id, api_object_id, stable_fragment,
      archive_identifier
    ) > 0)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexical_field_provenance (
  provenance_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  lemma_id TEXT,
  sense_id TEXT,
  claim_id TEXT,
  form_id TEXT,
  proposal_id TEXT,
  comparison_id TEXT,
  subject_field TEXT NOT NULL,
  source_id TEXT NOT NULL,
  locator_id TEXT,
  evidence_role TEXT NOT NULL,
  transformation_type TEXT NOT NULL,
  reviewer_or_process_identity TEXT,
  version_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexical_evidence_datasets(dataset_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_lemma
    FOREIGN KEY (lemma_id) REFERENCES dictionaryroot_lexical_lemmas(lemma_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_sense
    FOREIGN KEY (sense_id) REFERENCES dictionaryroot_lexical_senses(sense_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_claim
    FOREIGN KEY (claim_id)
    REFERENCES dictionaryroot_lexical_definition_claims(claim_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_form
    FOREIGN KEY (form_id) REFERENCES dictionaryroot_lexical_forms(form_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_proposal
    FOREIGN KEY (proposal_id)
    REFERENCES dictionaryroot_lexical_etymology_proposals(proposal_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_comparison
    FOREIGN KEY (comparison_id)
    REFERENCES dictionaryroot_lexical_source_comparisons(comparison_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_lexical_provenance_source
    FOREIGN KEY (source_id)
    REFERENCES dictionaryroot_lexical_evidence_sources(source_id),
  CONSTRAINT fk_dictionaryroot_lexical_provenance_locator
    FOREIGN KEY (locator_id)
    REFERENCES dictionaryroot_lexical_source_locators(locator_id)
    ON DELETE SET NULL,
  CONSTRAINT ck_dictionaryroot_lexical_provenance_subject
    CHECK (NUM_NONNULLS(
      lemma_id, sense_id, claim_id, form_id, proposal_id, comparison_id
    ) = 1)
);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_lemma_normalized
  ON dictionaryroot_lexical_lemmas(normalized_form, lemma_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_lemma_sense_sense
  ON dictionaryroot_lexical_lemma_senses(sense_id, lemma_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_claim_sense
  ON dictionaryroot_lexical_definition_claims(sense_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_form_lemma
  ON dictionaryroot_lexical_forms(lemma_id, form_type, form_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_etymology_lemma
  ON dictionaryroot_lexical_etymology_proposals(subject_lemma_id, proposal_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_comparison_sense
  ON dictionaryroot_lexical_source_comparisons(sense_id, comparison_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_locator_claim
  ON dictionaryroot_lexical_source_locators(claim_id, locator_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexical_provenance_claim
  ON dictionaryroot_lexical_field_provenance(claim_id, provenance_id);
