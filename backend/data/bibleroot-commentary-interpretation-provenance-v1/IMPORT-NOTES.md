# Import notes

The importer validates every raw, source-document, normalized, rights, anchor,
statement-offset, and checksum identity before opening a transaction. It replaces
only this dataset bundle, uses existing SourceRoot/BibleRoot source infrastructure,
and imports works, sections, anchors, and source-authored statements into migration
017 tables. Historical CLIs remain restricted to `sourceroot_test`; authorized
development import is available only through the local-development safety token.

These records are attributed source content. SourceRoot does not endorse,
reconcile, rank, summarize, or determine their theological accuracy. Shared
passage placement does not establish agreement.
