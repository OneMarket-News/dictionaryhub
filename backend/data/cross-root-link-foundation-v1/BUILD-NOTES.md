# Cross-Root lexical evidence build notes

This directory is generated offline from eight committed files. No network access or mutable development database is used. Run `npm.cmd run cross-root:lexical-evidence:prepare` from `backend/`.

The preparation reads the accepted DictionaryRoot core corpus (500 production lemmas), the released HistoryRoot 1.3.0 bundle, BibleRoot Foundation KJV verse text, and the normalized ASV, WEB, and YLT Translation Comparison files. Every input byte length, SHA-256, and Git blob identity is recorded in `input-fingerprints.json` and validated before import.

Outputs use formatted JSON with LF endings and a terminal newline. Stable IDs are SHA-256-derived from public identities, not array positions. Running preparation twice produces byte-identical output and identical `hashes.json` values.

Production counts: 1,568 resources (500 DictionaryRoot lemmas, 628 HistoryRoot records, 440 BibleRoot edition verse texts), 2,233 links, and 2,765 evidence occurrences. Links comprise 802 DictionaryRoot-to-BibleRoot links and 1,431 DictionaryRoot-to-HistoryRoot links; evidence comprises 975 BibleRoot occurrences and 1,790 HistoryRoot occurrences.
