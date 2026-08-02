# Relationship rules

SourceRoot records assertions and their evidence. It does not silently convert an assertion into universal truth.

## Admission

A record is admitted only when its released HistoryRoot record names an explicit subject, object, direction or source-native relation, public source association, uncertainty, dataset identity, and stable endpoint resources. Every assertion must have at least one independently inspectable evidence record. Draft, rejected, private, governance-only, moderation, audit, name-only, generated, and unsupported records are excluded.

## Semantics

The controlled family is a display/query classification; `sourceNativeRelationshipType` preserves the released predicate. Matching names, aliases, dates, places, or exact words do not prove identity. Chunk 14A lexical observations are never input to this build. `directly_sourced` means the released record explicitly states the relationship, not that SourceRoot endorses it.

`pilot-review-required` and `corpus-review-ready` map to `unreviewed`. Only explicit governance evidence of assertion-level acceptance could map to `accepted_after_review`; none does in v1. Rejected records do not ship. Uncertainty and dispute remain independent of publication and review.

Causal-link records alone enter the `causation` family. Their source wording and causal role remain explicit. Association, contribution, temporal sequence, conditions, and responses are never strengthened into proven causation.

## Evidence and identity

Evidence preserves the source Root, source resource and record type, source field, exact excerpt, UTF-16 offsets, source associations, citation/locator/URL when present, record/field/evidence hashes, dataset/version, order, uncertainty, and dispute. For offset evidence, `sourceFieldText.slice(startOffset, endOffset)` must equal `observedExcerpt` exactly. IDs and content hashes are deterministic; duplicate or orphan evidence is invalid.

Registry reuse is addressability, not universal identity. New Root types, including a future EarthRoot, can use the same assertion/evidence model only with their own explicit source-backed evidence, temporal scope, uncertainty, dispute, naming, and review state. This dataset creates no EarthRoot records, coordinates, maps, geocoding, or modern-place resolutions.
