# BibleRoot Original-Language Import Notes

- Dataset: `br-dataset-original-language-foundation-v1`, version `1.0.0`.
- Target database: `sourceroot_test` only.
- Preparation first validates all raw/document byte lengths and SHA-256 values,
  then parses only Genesis 1, Psalm 23, Ecclesiastes 3, and John 1.
- The importer deletes only its own imported bundle inside one transaction,
  inserts normalized rows, compares Chunk 12 and unrelated-bundle fingerprints,
  and rolls back on any mismatch or error.
- Repeated import is duplicate-safe and returns the same counts/fingerprints.
- The mapping target is a validated stable canonical-reference ID rather than a
  cross-bundle foreign key because the protected Chunk 12 importer deletes and
  recreates its bundle in separate transactions.
- No reset helper, static language fallback, other database, migration 017, or
  external package is used.
