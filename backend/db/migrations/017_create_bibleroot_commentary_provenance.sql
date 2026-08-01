CREATE TABLE bibleroot_commentary_works (
  work_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id),
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  rights_component_id TEXT NOT NULL REFERENCES bibleroot_source_artifact_rights_components(component_id),
  title TEXT NOT NULL,
  attribution TEXT NOT NULL,
  work_date_identity TEXT NOT NULL,
  edition_identity TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dataset_id, display_order),
  UNIQUE (artifact_id, edition_identity)
);

CREATE TABLE bibleroot_commentary_sections (
  section_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES bibleroot_commentary_works(work_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id),
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  rights_component_id TEXT NOT NULL REFERENCES bibleroot_source_artifact_rights_components(component_id),
  section_order INTEGER NOT NULL CHECK (section_order > 0),
  heading TEXT,
  exact_text TEXT NOT NULL CHECK (length(exact_text) > 0),
  source_markup TEXT NOT NULL CHECK (length(source_markup) > 0),
  source_locator TEXT NOT NULL,
  source_text_sha256 CHAR(64) NOT NULL,
  source_markup_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (work_id, section_order),
  UNIQUE (work_id, source_locator)
);

CREATE TABLE bibleroot_commentary_section_anchors (
  anchor_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES bibleroot_commentary_sections(section_id) ON DELETE CASCADE,
  anchor_order INTEGER NOT NULL CHECK (anchor_order > 0),
  anchor_type TEXT NOT NULL,
  canonical_start_reference_id TEXT REFERENCES bibleroot_canonical_verses(canonical_reference_id),
  canonical_end_reference_id TEXT REFERENCES bibleroot_canonical_verses(canonical_reference_id),
  source_supplied_marker TEXT,
  mapping_status TEXT NOT NULL,
  mapping_note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (section_id, anchor_order),
  CONSTRAINT ck_bibleroot_commentary_anchor_type
    CHECK (anchor_type IN ('canonical-verse', 'canonical-verse-range', 'chapter', 'source-heading-range', 'unresolved')),
  CONSTRAINT ck_bibleroot_commentary_anchor_shape CHECK (
    (anchor_type = 'unresolved' AND canonical_start_reference_id IS NULL AND canonical_end_reference_id IS NULL)
    OR
    (anchor_type <> 'unresolved' AND canonical_start_reference_id IS NOT NULL AND canonical_end_reference_id IS NOT NULL)
  ),
  CONSTRAINT ck_bibleroot_commentary_single_verse CHECK (
    anchor_type <> 'canonical-verse'
    OR canonical_start_reference_id = canonical_end_reference_id
  )
);

CREATE TABLE bibleroot_commentary_statements (
  statement_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES bibleroot_commentary_sections(section_id) ON DELETE CASCADE,
  anchor_id TEXT NOT NULL REFERENCES bibleroot_commentary_section_anchors(anchor_id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES bibleroot_commentary_works(work_id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES bibleroot_source_publications(publication_id),
  artifact_id TEXT NOT NULL REFERENCES bibleroot_source_artifacts(artifact_id),
  rights_component_id TEXT NOT NULL REFERENCES bibleroot_source_artifact_rights_components(component_id),
  statement_order INTEGER NOT NULL CHECK (statement_order > 0),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  exact_text TEXT NOT NULL CHECK (length(exact_text) > 0),
  content_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (section_id, statement_order),
  UNIQUE (section_id, start_offset, end_offset)
);

CREATE INDEX idx_bibleroot_commentary_works_dataset
  ON bibleroot_commentary_works(dataset_id, display_order);
CREATE INDEX idx_bibleroot_commentary_sections_work
  ON bibleroot_commentary_sections(work_id, section_order);
CREATE INDEX idx_bibleroot_commentary_anchors_canonical
  ON bibleroot_commentary_section_anchors(canonical_start_reference_id, canonical_end_reference_id);
CREATE INDEX idx_bibleroot_commentary_statements_section
  ON bibleroot_commentary_statements(section_id, statement_order);
