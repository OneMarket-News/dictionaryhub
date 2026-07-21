CREATE TABLE IF NOT EXISTS dictionaryroot_lexicon_datasets (
  dataset_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_license TEXT NOT NULL,
  synset_count INTEGER NOT NULL,
  lemma_count INTEGER NOT NULL,
  relation_count INTEGER NOT NULL,
  part_of_speech_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexicon_synsets (
  node_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_synset_key TEXT NOT NULL UNIQUE,
  source_offset TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  title TEXT NOT NULL,
  definition TEXT NOT NULL,
  synset_type TEXT NOT NULL,
  lexicographer_file_number INTEGER NOT NULL,
  lemmas TEXT[] NOT NULL,
  normalized_lemmas TEXT[] NOT NULL,
  examples TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  original_gloss TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dictionaryroot_lexicon_synsets_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexicon_datasets(dataset_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dictionaryroot_lexicon_relations (
  relation_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  pointer_symbol TEXT NOT NULL,
  source_target TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  label TEXT NOT NULL,
  relationship_strength TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dictionaryroot_lexicon_relations_dataset
    FOREIGN KEY (dataset_id)
    REFERENCES dictionaryroot_lexicon_datasets(dataset_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dictionaryroot_lexicon_relations_from
    FOREIGN KEY (from_node_id)
    REFERENCES dictionaryroot_lexicon_synsets(node_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dictionaryroot_lexicon_relations_to
    FOREIGN KEY (to_node_id)
    REFERENCES dictionaryroot_lexicon_synsets(node_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_dataset_bundle
  ON dictionaryroot_lexicon_datasets(bundle_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_synsets_dataset
  ON dictionaryroot_lexicon_synsets(dataset_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_synsets_bundle
  ON dictionaryroot_lexicon_synsets(bundle_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_synsets_pos
  ON dictionaryroot_lexicon_synsets(part_of_speech);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_synsets_title_lower
  ON dictionaryroot_lexicon_synsets(LOWER(title));

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_synsets_lemmas_gin
  ON dictionaryroot_lexicon_synsets USING GIN(normalized_lemmas);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_relations_dataset
  ON dictionaryroot_lexicon_relations(dataset_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_relations_from
  ON dictionaryroot_lexicon_relations(from_node_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_relations_to
  ON dictionaryroot_lexicon_relations(to_node_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_lexicon_relations_type
  ON dictionaryroot_lexicon_relations(relationship_type);
