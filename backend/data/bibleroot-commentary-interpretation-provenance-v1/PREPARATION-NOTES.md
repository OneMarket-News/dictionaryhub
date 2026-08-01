# Preparation notes

- Preparation reads only the two already acquired local SWORD archives.
- The parser follows each archive's KJV-versified zCom4 chapter marker and verse-index tuples.
- Consecutive verses that reference one identical compressed source slice become one range anchor. A slice covering the complete selected chapter becomes a chapter anchor.
- A zero-length verse index is not filled or inferred; it becomes a recorded coverage gap.
- The exact decoded OSIS source slice remains in `sourceMarkup`. Display text removes only mechanical XML containers, decodes XML entities, and preserves source wording and order.
- Sentence boundaries are deterministic navigation aids. The full section remains authoritative, and every statement is an exact substring with validated offsets and checksum.
