# SourceRoot V2 Plan

## Phase Name

SourceRoot V2 — Knowledge Quality Layer

## Purpose

SourceRoot V1 proved that the prototype works: pages exist, concepts connect, the graph is navigable, sources and revisions have a home, and the SourceRoot idea is visible.

V2 improves the quality of the knowledge inside the system.

The goal is not to add more pages first. The goal is to make every important concept more useful, more traceable, and more connected.

## V2 Focus Areas

### 1. Better Definitions

Each important concept should have:

- Short definition
- Full definition
- Plain-English explanation
- Technical explanation when useful
- Examples
- Common confusions
- Origin or etymology when useful

### 2. Better Relationship Details

Relationships should explain why two concepts are connected.

A relationship should include:

- Target concept
- Relationship type
- Direction
- Strength
- Explanation
- Source support
- Bridge concept when useful

Example:

Truth → Evidence should not only be a line. It should explain that evidence supports truth by providing observations, records, or reasoning used to judge whether a claim corresponds to reality.

### 3. Better Source Logic

Sources should not only exist as a list. They should identify what they support:

- Definition
- Origin
- Relationship
- Example
- Common confusion
- Revision

### 4. Better Revision Logic

Revisions should explain:

- What changed
- Why it changed
- Which fields changed
- Whether the change affected definitions, relationships, or sources

### 5. Smaller High-Quality Root Set

V2 should begin with 25 root concepts instead of trying to upgrade all current concepts at once.

The first goal is quality, not quantity.

## V2 Root Concepts

1. Truth
2. Knowledge
3. Evidence
4. Verification
5. Source
6. Reference
7. Data
8. Information
9. Meaning
10. Context
11. Claim
12. Fact
13. Belief
14. Trust
15. Provenance
16. Origin
17. Revision
18. Authority
19. Reliability
20. Validity
21. Accuracy
22. Interpretation
23. Relationship
24. Definition
25. Concept

## Recommended Build Order

1. Create V2 node schema.
2. Create `data/nodes-v2-root.json`.
3. Upgrade Truth first.
4. Upgrade the remaining 24 root concepts.
5. Update concept page to display V2 fields.
6. Update graph relationship detail panel to use richer relationship explanations.
7. Update sources page to show what each source supports.
8. Update revisions page to show changed fields.
9. Merge V2 content into the main site once stable.

## V2 Success Criteria

V2 succeeds when a user can open a concept and understand:

- What the concept means
- Why it matters
- Where it came from
- Which concepts it connects to
- Why those connections exist
- What sources support it
- How the entry changed over time
