CREATE TABLE IF NOT EXISTS dictionaryroot_editorial_reviews (
  review_id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL UNIQUE,
  dataset_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  reviewer_name TEXT,
  notes TEXT,
  annotation TEXT,
  promotion_recommendation BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dictionaryroot_editorial_review_node
    FOREIGN KEY (node_id)
    REFERENCES dictionaryroot_lexicon_synsets(node_id)
    ON DELETE CASCADE,

  CONSTRAINT ck_dictionaryroot_editorial_review_status
    CHECK (review_status IN ('unreviewed', 'in_review', 'approved', 'flagged', 'rejected'))
);

CREATE TABLE IF NOT EXISTS dictionaryroot_editorial_review_events (
  event_id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reviewer_name TEXT,
  note TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dictionaryroot_editorial_event_review
    FOREIGN KEY (review_id)
    REFERENCES dictionaryroot_editorial_reviews(review_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dictionaryroot_editorial_event_node
    FOREIGN KEY (node_id)
    REFERENCES dictionaryroot_lexicon_synsets(node_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_reviews_bundle
  ON dictionaryroot_editorial_reviews(bundle_id);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_reviews_status
  ON dictionaryroot_editorial_reviews(review_status);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_reviews_promotion
  ON dictionaryroot_editorial_reviews(promotion_recommendation, promoted_at);

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_events_node
  ON dictionaryroot_editorial_review_events(node_id, created_at DESC);
