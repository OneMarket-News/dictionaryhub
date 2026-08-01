# BibleRoot Original-Language Token and Mapping Contract

## Token identity

- A SourceRoot token ID is deterministic from source edition, source verse, and
  one-based sequence position.
- `sourceNativeTokenId` is the verbatim immutable OSHB `<w id>` for Hebrew and
  null for Nestle1904 Greek.
- `surfaceForm`, lemma, Strong's/OSHB lemma identifier, and morphology code are
  verbatim source fields. They are not normalized, translated, glossed, or
  interpreted.
- Analysis status is `analyzed`, `not_yet_analyzed`, or `ambiguous`. The seven
  differing functional/form-oriented Greek tag pairs are ambiguous; the pinned
  bounded corpus has zero missing analyses, while the parser and schema preserve
  the explicit missing state.
- Hebrew and Greek morphology systems remain separate. A code is not a
  human-readable description unless the source documentation itself supplies
  that interpretation.

## Verse mapping

Each source segment has a mapping row with a stable source verse ID, nullable
Chunk 12 canonical reference ID, mapping type, factual explanation, evidence,
and review status. Supported types are `one_to_one`, `shifted`, `split`,
`merged`, `omitted_or_untranslated`, and `disputed`.

The OSHB `Ps.23.1` element contains a Hebrew superscription, then the preserved
`<note>KJV:Ps.23.1</note>` marker, then the source text mapped to KJV Psalm 23:1.
Preparation splits these into transparent source segments. The superscription
has an `omitted_or_untranslated` mapping with no target; the following text has
an explicit one-to-one mapping. No numeric-offset rule or word-level alignment
is inferred.
