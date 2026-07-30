CREATE TABLE bibleroot_canons (
  canon_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  scope_note TEXT NOT NULL,
  authority_source_id TEXT NOT NULL REFERENCES sources(source_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bibleroot_books (
  book_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  machine_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  aliases JSONB NOT NULL,
  broad_collection TEXT NOT NULL,
  chapter_count INTEGER NOT NULL CHECK (chapter_count > 0),
  availability_status TEXT NOT NULL,
  authority_source_id TEXT NOT NULL REFERENCES sources(source_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_bibleroot_book_aliases CHECK (jsonb_typeof(aliases) = 'array'),
  CONSTRAINT ck_bibleroot_book_availability
    CHECK (availability_status IN ('text_available', 'metadata_only'))
);

CREATE TABLE bibleroot_canon_books (
  canon_id TEXT NOT NULL REFERENCES bibleroot_canons(canon_id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bibleroot_books(book_id) ON DELETE CASCADE,
  canonical_order INTEGER NOT NULL CHECK (canonical_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (canon_id, book_id),
  UNIQUE (canon_id, canonical_order)
);

CREATE TABLE bibleroot_source_publications (
  publication_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  stable_identifier TEXT NOT NULL UNIQUE,
  publication_date DATE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bibleroot_source_artifacts (
  artifact_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_length BIGINT NOT NULL CHECK (byte_length > 0),
  sha256 CHAR(64) NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  retrieval_timestamp TIMESTAMPTZ NOT NULL,
  rights_status TEXT NOT NULL,
  rights_statement TEXT NOT NULL,
  territorial_limitation TEXT NOT NULL,
  parsing_rules TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bibleroot_editions (
  edition_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id),
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  display_title TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  language_code TEXT NOT NULL,
  translation_name TEXT NOT NULL,
  edition_description TEXT NOT NULL,
  publisher_or_distributor TEXT,
  publication_or_release_date DATE,
  rights_status TEXT NOT NULL,
  territorial_limitation TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  normalized_text_sha256 CHAR(64) NOT NULL,
  provenance_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (artifact_id, dataset_version)
);

CREATE TABLE bibleroot_chapters (
  chapter_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bibleroot_books(book_id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  availability_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, chapter_number),
  CONSTRAINT ck_bibleroot_chapter_availability
    CHECK (availability_status IN ('text_available', 'unavailable'))
);

CREATE TABLE bibleroot_canonical_verses (
  canonical_reference_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES bibleroot_chapters(chapter_id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bibleroot_books(book_id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  verse_number INTEGER NOT NULL CHECK (verse_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, chapter_number, verse_number)
);

CREATE TABLE bibleroot_verse_texts (
  edition_text_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  canonical_reference_id TEXT NOT NULL REFERENCES bibleroot_canonical_verses(canonical_reference_id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES bibleroot_editions(edition_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  exact_text TEXT NOT NULL CHECK (length(exact_text) > 0),
  source_observation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (canonical_reference_id, edition_id)
);

CREATE TABLE bibleroot_phrases (
  phrase_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES bibleroot_editions(edition_id) ON DELETE CASCADE,
  display_text TEXT NOT NULL,
  normalized_lookup_text TEXT NOT NULL,
  provenance_note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, normalized_lookup_text)
);

CREATE TABLE bibleroot_phrase_occurrences (
  occurrence_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  phrase_id TEXT NOT NULL REFERENCES bibleroot_phrases(phrase_id) ON DELETE CASCADE,
  edition_text_id TEXT NOT NULL REFERENCES bibleroot_verse_texts(edition_text_id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  exact_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (phrase_id, edition_text_id, start_offset, end_offset)
);

CREATE INDEX idx_bibleroot_canon_books_order
  ON bibleroot_canon_books(canon_id, canonical_order);
CREATE INDEX idx_bibleroot_books_aliases
  ON bibleroot_books USING GIN(aliases);
CREATE INDEX idx_bibleroot_chapters_lookup
  ON bibleroot_chapters(book_id, chapter_number);
CREATE INDEX idx_bibleroot_verses_order
  ON bibleroot_canonical_verses(book_id, chapter_number, verse_number);
CREATE INDEX idx_bibleroot_texts_reference
  ON bibleroot_verse_texts(canonical_reference_id, edition_id);
CREATE INDEX idx_bibleroot_phrase_lookup
  ON bibleroot_phrases(normalized_lookup_text, phrase_id);
CREATE INDEX idx_bibleroot_phrase_occurrence_text
  ON bibleroot_phrase_occurrences(edition_text_id, start_offset);
