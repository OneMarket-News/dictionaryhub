# Deterministic matching rules

Algorithm: `exact-lexical-observation-js-utf16-v1`.

The matcher applies Unicode NFKC normalization, locale-stable English lowercase case folding, leading/trailing trim, and whitespace-run collapse. A multiword lemma becomes one exact contiguous phrase with flexible whitespace between its words. Unicode letter/number lookarounds enforce punctuation or text boundaries. Target offsets remain JavaScript UTF-16 code-unit offsets into the untouched original field text; the exact original surface is retained.

Each occurrence records its field name, surface substring, normalized match, start/end offset, deterministic 64-code-unit context excerpt on each side, target resource hash, target field hash, source dataset identity, and algorithm identity. Validation reconstructs every substring using `field.text.slice(startOffset, endOffset)`.

There is no stemming, target lemmatization, plural or conjugation reduction, synonym expansion, edit distance, fuzzy matching, spelling correction, translation alignment, embedding, AI classification, or sense disambiguation. A lexical occurrence links to a lemma only. It never selects a DictionaryRoot sense or asserts shared meaning.
