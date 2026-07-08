# SourceRoot Relationship-Level Credibility Model

## Purpose

SourceRoot should not only evaluate the credibility of sources and assertions.

It also needs to evaluate the credibility of relationships between nodes.

A relationship may be direct, inferred, symbolic, contextual, disputed, or prototype-level.

Example:

- `truth` relates to `fact` directly.
- `light` relates to `truth` symbolically.
- `Wikidata light` and `BibleRoot light` are the same term in different contexts.
- `knowledge` depends on `evidence` philosophically.
- `claim` may require `verification`.
- A relationship may be useful but still need review.

Relationship-level credibility allows SourceRoot to explain how strongly two ideas are connected.

---

## Core Principle

A relationship is a claim.

```text
Node credibility = What is this thing?
Assertion credibility = How reliable is this claim?
Relationship credibility = How reliable is this connection?

Edges should not be treated as simple lines on a graph.

Every edge should eventually explain:

Why are these two nodes connected?
How strong is the connection?
Is the connection direct or inferred?
Is it symbolic, contextual, or disputed?
Which sources support it?
Does it need review?
Current SourceRoot Chain
Node
  ↓
Assertion
  ↓
Edge
  ↓
Source
  ↓
Revision

The edge is where SourceRoot models meaning between things.

Therefore, edges need credibility metadata.

Relationship Credibility Fields

Every relationship should eventually support these fields:

{
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "inferred",
  "reviewStatus": "needs-review",
  "supportLevel": "inferred",
  "relationshipStrength": "medium",
  "interpretationLevel": "medium",
  "sourceIds": ["example-source-id"]
}
credibilityTier

The credibilityTier field describes the overall trust level of the relationship.

Recommended values:

very-high
high
medium
low
unknown
disputed
prototype
very-high

Use when the relationship is directly stated by an authoritative source.

Example:

A standard explicitly defines a formal relationship between two technical terms.
high

Use when the relationship is well-supported and low-risk.

Example:

A dictionary or encyclopedia clearly connects knowledge, belief, evidence, and justification.
medium

Use when the relationship is useful but partly interpreted or synthesized.

Example:

Light relates to truth through the metaphor of illumination.
low

Use when the relationship is tentative or loosely supported.

unknown

Use when the relationship has not been reviewed.

disputed

Use when credible sources disagree about the relationship.

prototype

Use when the relationship is part of early modeling.

confidence

The confidence field describes how confident SourceRoot is in the relationship.

Recommended values:

strong
moderate
weak
working
disputed
unknown
strong

The relationship is direct, obvious, or strongly supported.

moderate

The relationship is reasonable but involves synthesis or interpretation.

weak

The relationship is exploratory or lightly supported.

working

The relationship is still being modeled.

disputed

The relationship is contested.

unknown

The relationship has not been evaluated.

verificationStatus

The verificationStatus field describes how the relationship has been checked.

Recommended values:

verified
reviewed
source-backed
inferred
interpretive
symbolic
prototype
needs-review
unverified
disputed
deprecated
verified

The relationship has been checked and accepted.

reviewed

The relationship has been reviewed but may not be final.

source-backed

The relationship has at least one supporting source.

inferred

The relationship is inferred from one or more sources.

interpretive

The relationship depends on human interpretation.

symbolic

The relationship is symbolic, metaphorical, theological, literary, or conceptual.

prototype

The relationship is part of early prototype modeling.

needs-review

The relationship should be checked before production use.

unverified

The relationship has not been reviewed.

disputed

The relationship is contested.

deprecated

The relationship should no longer be used.

supportLevel

The supportLevel field explains how directly sources support the edge.

Recommended values:

direct
derived
inferred
symbolic
contextual
unsupported
direct

The source directly states the relationship.

Example:

A source says knowledge requires justification.
derived

The relationship is derived from source material.

Example:

A technical model converts source language into structured graph form.
inferred

The relationship is inferred from definitions, assertions, or surrounding context.

Example:

Evidence relates to verification because evidence is used to verify claims.
symbolic

The relationship is symbolic or metaphorical.

Example:

Light relates to truth because light reveals what is hidden.
contextual

The relationship is valid only within a specific context.

Example:

Light in BibleRoot is connected to divine presence in a theological/literary context.
unsupported

The relationship currently has no source support.

relationshipStrength

The relationshipStrength field describes how strong the connection is.

Recommended values:

core
strong
medium
weak
contextual
experimental
core

The relationship is central to the meaning of the node.

Example:

Knowledge relates to belief, truth, and justification.
strong

The relationship is important and well-supported.

medium

The relationship is useful but not central.

weak

The relationship is loose or secondary.

contextual

The relationship is meaningful only in a specific domain.

experimental

The relationship is exploratory.

interpretationLevel

The interpretationLevel field describes how much human interpretation is involved.

Recommended values:

none
low
medium
high
speculative
none

The relationship is directly stated or structural.

low

The relationship is lightly rephrased or normalized.

medium

The relationship depends on synthesis.

high

The relationship depends heavily on interpretation.

speculative

The relationship is exploratory and should not be treated as verified.

Suggested Relationship Shape
{
  "id": "dictionary-edge-knowledge-evidence",
  "fromNodeId": "dictionary-knowledge",
  "toNodeId": "dictionary-evidence",
  "relationshipType": "SUPPORTED_BY",
  "label": "supported by",
  "summary": "Knowledge is supported by evidence because evidence helps justify belief.",
  "domain": "DictionaryHub",
  "sourceIds": [
    "sep-knowledge-analysis",
    "sep-evidence"
  ],
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "source-backed",
  "reviewStatus": "reviewed",
  "supportLevel": "derived",
  "relationshipStrength": "strong",
  "interpretationLevel": "low"
}
BibleRoot Relationship Example
{
  "id": "bibleroot-edge-light-truth",
  "fromNodeId": "bible-symbol-light",
  "toNodeId": "dictionary-truth",
  "relationshipType": "SYMBOLIC_OF",
  "label": "symbolically relates to",
  "summary": "Light is modeled as symbolically related to truth because light reveals, illuminates, and makes things visible.",
  "domain": "SourceRoot",
  "sourceIds": [
    "kjv-public-domain",
    "bibleroot-alpha-notes"
  ],
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "symbolic",
  "reviewStatus": "needs-review",
  "supportLevel": "symbolic",
  "relationshipStrength": "contextual",
  "interpretationLevel": "high"
}
Wikidata Relationship Example
{
  "id": "wikidata-light-same-term-bible-light",
  "fromNodeId": "wikidata-light",
  "toNodeId": "bible-symbol-light",
  "relationshipType": "SAME_TERM_DIFFERENT_CONTEXT",
  "label": "same term, different context",
  "summary": "WikidataRoot defines light as a structured public entity. BibleRoot uses light as a symbolic and theological concept. These are not identical meanings, but they are connected views of the same term.",
  "domain": "SourceRoot",
  "sourceIds": [
    "wikidata-q9128",
    "bibleroot-alpha-notes"
  ],
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "reviewed",
  "reviewStatus": "reviewed",
  "supportLevel": "contextual",
  "relationshipStrength": "contextual",
  "interpretationLevel": "medium"
}
Relationship Trust Rule

SourceRoot should show whether a relationship is:

directly stated
derived
inferred
symbolic
contextual
prototype-only
disputed
unsupported

This allows SourceRoot to avoid treating every graph connection as equally true.

Why This Matters for AI

An AI using SourceRoot should not simply see:

light → truth

It should see:

light symbolically relates to truth
support level: symbolic
interpretation level: high
review status: needs-review
source support: BibleRoot alpha notes + primary text

That lets the AI answer honestly:

In a symbolic or theological context, light can be connected to truth, but this is an interpretive relationship rather than a scientific identity.
Relationship Credibility vs Assertion Credibility

Assertion credibility answers:

Can I trust this claim?

Relationship credibility answers:

Can I trust this connection between two ideas?

A relationship can be useful even when it is not direct.

The goal is not to remove interpretation.

The goal is to label interpretation honestly.

Future UI Targets

The Edge Registry should eventually show relationship credibility fields:

Credibility Tier
Confidence
Verification Status
Review Status
Support Level
Relationship Strength
Interpretation Level
Source IDs

The Inspector should also show relationship credibility on outgoing and incoming relationship cards.

The API Preview should expose these fields in /edges.

Current Prototype Next Steps
Add default relationship credibility fields to DictionaryHub generated edges.
Add default relationship credibility fields to BibleRoot edges.
Add default relationship credibility fields to Wikidata edges.
Add default relationship credibility fields to cross-hub edges.
Display relationship credibility in the Edge Registry.
Display relationship credibility in the Inspector.
Add relationship credibility fields to the API Preview.
Eventually add credibility filters to Edge Registry.