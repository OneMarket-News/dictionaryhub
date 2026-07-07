# SourceRoot Identity Resolution Model

## Purpose

SourceRoot must be able to recognize when two nodes are related without incorrectly treating them as identical.

This is important because a single word, phrase, symbol, person, place, product, or concept may appear across many hubs with different meanings, uses, sources, and credibility levels.

Example:

- DictionaryHub may define **light** as illumination or electromagnetic radiation.
- BibleRoot may treat **light** as a symbol of truth, creation, guidance, or divine presence.
- Wiki may model **light** as a structured public entity.
- A business hub may use **light** as a product category, installation feature, or technical specification.

These are connected, but they are not always the same thing.

---

## Core Principle

SourceRoot does not merge concepts automatically.

Instead, it creates explicit identity relationships between nodes.

```text
Node A
  ↓ identity relationship
Node B