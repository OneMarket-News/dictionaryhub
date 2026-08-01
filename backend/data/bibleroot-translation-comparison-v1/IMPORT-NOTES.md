# BibleRoot Translation Comparison v1 import notes

The three accepted upstream artifacts are exact eBible.org USFM ZIP downloads.
They are preserved under `raw/`; preparation never changes them in place.
The already released KJV edition and its 110 verse rows remain owned by
`bibleroot-foundation-v1` and are not duplicated here.

Preparation validates raw byte lengths and SHA-256 values, reads only Genesis
1, Psalm 23, Ecclesiastes 3, and John 1, removes USFM presentation/annotation
markup mechanically, aligns each result to the existing canonical reference
ID, and writes three deterministic normalized JSON files. Notes and
cross-references are excluded; verse wording is not paraphrased.

Import inserts three source/publication/artifact/rights/edition records and 330
edition verse texts into the existing migration-015 schema. The operation is
transactional and skips an already exact dataset. The historical direct CLI is
restricted to `sourceroot_test`; the released development provisioner supplies
the separate local authorization object.

No commentary, translation ranking, word-level alignment, inferred meaning,
or network access is part of preparation after acquisition, import, server
startup, or frontend runtime.
