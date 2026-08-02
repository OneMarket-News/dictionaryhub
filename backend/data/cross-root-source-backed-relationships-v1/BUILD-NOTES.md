# Build notes

Dataset: `sourceroot-cross-root-source-backed-relationships-v1`
Version: `1.0.0`
Algorithm: `released-historyroot-relationship-projection-v1`

Run from `backend/` with `npm.cmd run cross-root:relationships:prepare`. Preparation is offline, deterministic, ordered, database-independent, and network-independent. It reads only the four files recorded in `input-fingerprints.json`: the released HistoryRoot 1.3.0 bundle and the Chunk 14A resource-registry manifest, dataset manifest, and hashes manifest. It deliberately does not read Chunk 14A links or evidence.

The builder validates every source endpoint against the existing resource registry, retains source-native predicates, maps only the released relationship and causal-link records, and writes exact excerpts with UTF-16 offsets from each source record's `explanation` field. Output files are written in stable order, followed by `hashes.json`. Re-running preparation must produce byte-identical output.

No resource addition file exists because every assertion endpoint and source record already has an exact registered resource. The corpus uses 280 existing resources and adds zero. No network source, mutable database state, inferred identity, inferred geography, lexical link, generated prose, or hidden fallback knowledge participates.
