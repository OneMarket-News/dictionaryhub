# SourceRoot V2 QA Checklist

## Purpose

This checklist is used to test SourceRoot V2 before any V2 features are merged into the main V1 pages.

The goal is to confirm that the V2 knowledge model, concept page, source registry, and source ID system are working correctly.

---

## Current V2 Status

```text
V2 root concepts: 25 / 25 complete
Source registry: started
Source IDs: added to root concepts
Concept V2 page: connected to source registry
Current phase: Source QA and page polish
```

---

## Core Files to Check

### Data Files

```text
data/nodes-v2-root.json
data/sources-v2.json
```

### Documentation Files

```text
docs/sourceRoot-v2-plan.md
docs/v2-node-schema.md
docs/v2-root-concepts.md
docs/v2-status.md
docs/v2-source-id-map.md
docs/v2-qa-checklist.md
```

### Test Page

```text
concept-v2.html
```

---

## V2 Concept Page Test URLs

Use these pages for QA:

```text
https://dictionaryhub-src.netlify.app/concept-v2.html?id=truth
https://dictionaryhub-src.netlify.app/concept-v2.html?id=knowledge
https://dictionaryhub-src.netlify.app/concept-v2.html?id=evidence
https://dictionaryhub-src.netlify.app/concept-v2.html?id=provenance
https://dictionaryhub-src.netlify.app/concept-v2.html?id=concept
```

Additional spot checks:

```text
https://dictionaryhub-src.netlify.app/concept-v2.html?id=claim
https://dictionaryhub-src.netlify.app/concept-v2.html?id=trust
https://dictionaryhub-src.netlify.app/concept-v2.html?id=reliability
https://dictionaryhub-src.netlify.app/concept-v2.html?id=accuracy
https://dictionaryhub-src.netlify.app/concept-v2.html?id=relationship
```

---

## Page Load QA

Check each test page for the following:

- [ ] Page loads without error
- [ ] Correct concept name appears in the hero section
- [ ] Concept type and domain display correctly
- [ ] Short definition displays
- [ ] Plain-English definition displays
- [ ] Full definition displays
- [ ] Technical definition displays
- [ ] Why It Matters section displays
- [ ] Origin section displays
- [ ] Relationship cards display
- [ ] Selected Relationship sidebar works
- [ ] Examples display
- [ ] Common Confusions display
- [ ] Sources section displays
- [ ] Revisions section displays
- [ ] Other V2 Concepts sidebar displays all 25 concepts

---

## Source Registry QA

The concept page should read:

```text
data/nodes-v2-root.json
data/sources-v2.json
```

Check the Sources section for:

- [ ] Source Registry Matches section appears
- [ ] Real source names appear
- [ ] Source publishers appear
- [ ] Source type appears
- [ ] Source notes appear
- [ ] Open source links appear
- [ ] Source ID pills appear
- [ ] Entry-Level Source Notes still display below registry matches
- [ ] Placeholder notes do not appear more important than real sources

---

## Source ID QA

Each concept should prioritize exact source IDs from the concept entry.

Expected examples:

### Truth

Expected source IDs:

```text
sep-truth
merriam-webster-truth
```

### Knowledge

Expected source IDs:

```text
sep-knowledge-analysis
sep-epistemology
merriam-webster-knowledge
```

### Evidence

Expected source IDs:

```text
sep-evidence
iep-evidence
merriam-webster-evidence
```

### Provenance

Expected source IDs:

```text
w3c-prov-overview
w3c-prov-o
```

### Concept

Expected source IDs:

```text
merriam-webster-definition
sep-epistemology
```

QA checks:

- [ ] Exact source IDs display first
- [ ] Fallback source matches do not duplicate exact source matches
- [ ] Source IDs match records in `data/sources-v2.json`
- [ ] Broken source IDs are not displayed
- [ ] Source links open in a new tab

---

## Relationship QA

For each concept, check:

- [ ] Relationship cards have clear titles
- [ ] Relationship type displays
- [ ] Relationship direction displays
- [ ] Relationship explanation displays
- [ ] Strength dots display
- [ ] Clicking a relationship updates the sidebar
- [ ] Selected relationship sidebar shows type, strength, and bridge
- [ ] Relationship explanation feels meaningful, not generic

Key relationships to test:

```text
Truth → Evidence
Knowledge → Information
Evidence → Verification
Claim → Fact
Trust → Provenance
Concept → Relationship
Definition → Meaning
```

---

## Revision QA

Check that revisions display correctly:

- [ ] Revision version displays
- [ ] Revision type displays
- [ ] Revision summary displays
- [ ] Revision reason displays
- [ ] Changed fields display as pills
- [ ] V2.0 created entry revisions display
- [ ] V2.1 source ID cleanup revisions display

---

## Mobile QA

Test on phone at normal viewing size.

Check:

- [ ] Header is usable
- [ ] Navigation links are tappable
- [ ] Hero section is readable
- [ ] Definition cards stack correctly
- [ ] Sidebar sections move below main content
- [ ] Source cards are readable
- [ ] Relationship cards are tappable
- [ ] Page does not feel broken at mobile width

---

## Desktop QA

Test at 100% browser zoom.

Check:

- [ ] Main content and sidebar layout feel balanced
- [ ] Hero section is not too tall
- [ ] Sources section is readable
- [ ] Relationship cards are easy to scan
- [ ] Other V2 Concepts sidebar is usable
- [ ] Page does not require unnecessary horizontal scrolling

---

## Known Current Limitations

- [ ] Some concept entries still contain legacy placeholder source notes
- [ ] Source quality tiers are basic and need refinement
- [ ] Relationship explanations are not yet deeply source-supported
- [ ] V2 graph integration is not complete
- [ ] V1 pages still use `data/nodes.json`
- [ ] `concept-v2.html` is still a test page, not the main concept page

---

## Next Improvements

### Short-Term

- [ ] Clean up Sources section design
- [ ] Make real registry sources visually stronger than placeholder notes
- [ ] Add source quality badges
- [ ] Add source ID visibility in a cleaner way
- [ ] Add source count by exact source ID

### Medium-Term

- [ ] Add V2 relationship explanations to graph page
- [ ] Add V2 source registry to sources page
- [ ] Add V2 revision data to revisions page
- [ ] Add source quality tiers and source categories

### Long-Term

- [ ] Decide whether V2 replaces the main concept page
- [ ] Build comparison across dictionary sources
- [ ] Add concept confidence / trust scoring
- [ ] Track agreement and disagreement between sources
- [ ] Add user-facing provenance trails

---

## QA Decision Point

Before merging V2 into the main site, confirm:

```text
All 25 concepts load
Source registry displays correctly
Source IDs work
Relationships are meaningful
Mobile layout is usable
No JSON errors exist
V1 remains safe
```

---

## Current Milestone

```text
V2 QA Checklist: Started
V2 Foundation: Complete
Source Registry: Active
Source ID Cleanup: Complete
Next Phase: Source display polish and V2 graph integration
```
