CREATE TABLE bibleroot_source_artifact_rights_components (
  component_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  rights_status TEXT NOT NULL,
  license_name TEXT,
  license_url TEXT,
  rights_statement TEXT NOT NULL,
  attribution TEXT NOT NULL,
  territorial_limitation TEXT NOT NULL,
  evidence_document TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (artifact_id, component_type)
);

CREATE TABLE bibleroot_original_language_editions (
  original_edition_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id),
  language_code TEXT NOT NULL,
  display_title TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  version_identity TEXT NOT NULL,
  immutable_source_ref TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (publication_id, language_code, version_identity)
);

CREATE TABLE bibleroot_original_language_edition_artifacts (
  original_edition_id TEXT NOT NULL REFERENCES bibleroot_original_language_editions(original_edition_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (original_edition_id, artifact_id)
);

CREATE TABLE bibleroot_original_language_verses (
  source_verse_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  original_edition_id TEXT NOT NULL REFERENCES bibleroot_original_language_editions(original_edition_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  source_book TEXT NOT NULL,
  source_chapter INTEGER NOT NULL CHECK (source_chapter > 0),
  source_verse_identifier TEXT NOT NULL,
  source_native_citation TEXT NOT NULL,
  source_native_versification TEXT NOT NULL,
  surface_text TEXT NOT NULL,
  sourceroot_identity TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (original_edition_id, source_book, source_chapter, source_verse_identifier)
);

CREATE TABLE bibleroot_original_language_tokens (
  token_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  source_native_token_id TEXT,
  original_edition_id TEXT NOT NULL REFERENCES bibleroot_original_language_editions(original_edition_id) ON DELETE CASCADE,
  source_verse_id TEXT NOT NULL REFERENCES bibleroot_original_language_verses(source_verse_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  sequence_position INTEGER NOT NULL CHECK (sequence_position > 0),
  surface_form TEXT NOT NULL CHECK (surface_form <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_verse_id, sequence_position),
  UNIQUE (original_edition_id, source_native_token_id)
);

CREATE TABLE bibleroot_original_language_token_lemmas (
  token_id TEXT PRIMARY KEY REFERENCES bibleroot_original_language_tokens(token_id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  verbatim_lemma TEXT,
  source_native_lemma_identifier TEXT,
  analysis_status TEXT NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_bibleroot_original_lemma_analysis_status
    CHECK (analysis_status IN ('analyzed', 'not_yet_analyzed', 'ambiguous'))
);

CREATE TABLE bibleroot_original_language_token_morphologies (
  morphology_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  token_id TEXT NOT NULL REFERENCES bibleroot_original_language_tokens(token_id) ON DELETE CASCADE,
  morphology_ordinal INTEGER NOT NULL CHECK (morphology_ordinal > 0),
  verbatim_morphology_code TEXT,
  morphology_system TEXT NOT NULL,
  analysis_status TEXT NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (token_id, morphology_ordinal),
  CONSTRAINT ck_bibleroot_original_morphology_analysis_status
    CHECK (analysis_status IN ('analyzed', 'not_yet_analyzed', 'ambiguous'))
);

CREATE TABLE bibleroot_original_language_verse_mappings (
  mapping_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  source_verse_id TEXT NOT NULL REFERENCES bibleroot_original_language_verses(source_verse_id) ON DELETE CASCADE,
  target_canonical_reference_id TEXT,
  mapping_type TEXT NOT NULL,
  factual_explanation TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  review_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_verse_id, target_canonical_reference_id, mapping_type),
  CONSTRAINT ck_bibleroot_original_mapping_type
    CHECK (mapping_type IN (
      'one_to_one', 'shifted', 'split', 'merged',
      'omitted_or_untranslated', 'disputed'
    )),
  CONSTRAINT ck_bibleroot_original_mapping_review_status
    CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_review'))
);

CREATE INDEX idx_bibleroot_original_editions_language
  ON bibleroot_original_language_editions(language_code);
CREATE INDEX idx_bibleroot_original_verses_lookup
  ON bibleroot_original_language_verses(source_book, source_chapter, source_verse_identifier);
CREATE INDEX idx_bibleroot_original_tokens_verse_order
  ON bibleroot_original_language_tokens(source_verse_id, sequence_position);
CREATE INDEX idx_bibleroot_original_morphologies_token
  ON bibleroot_original_language_token_morphologies(token_id);
CREATE INDEX idx_bibleroot_original_mappings_target
  ON bibleroot_original_language_verse_mappings(target_canonical_reference_id);
