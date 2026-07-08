# SourceRoot Assertion-Level Credibility Model

## Purpose

SourceRoot credibility should not stop at the source level.

A source may be reliable, but not every assertion built from that source has the same confidence.

Example:

- A dictionary source may strongly support a short definition.
- The same source may only weakly support a symbolic interpretation.
- A Bible text may strongly support the passage wording.
- A BibleRoot note may only provide a prototype interpretation.
- A Wikidata item may support an external identity record, but not a theological meaning.

Assertion-level credibility lets SourceRoot describe the trust level of each claim, definition, interpretation, example, summary, or statement.

---

## Core Principle

Source credibility and assertion credibility are related, but not identical.

```text
Source credibility = How reliable is the source?
Assertion credibility = How strongly does this source support this specific claim?
Current SourceRoot Object Chain
Node
  ↓
Assertion
  ↓
Source

The assertion is the layer where meaning is actually stated.

Therefore, assertions need their own credibility fields.

Assertion Credibility Fields

Every assertion should eventually support these fields:

{
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "reviewed",
  "reviewStatus": "reviewed",
  "supportLevel": "direct",
  "interpretationLevel": "low",
  "sourceIds": ["example-source-id"]
}
credibilityTier

The credibilityTier field describes the overall trust level of the assertion.

Recommended values:

very-high
high
medium
low
unknown
disputed
prototype
very-high

Use when the assertion is directly supported by a primary, official, or highly authoritative source.

Example:

The KJV text of Genesis 1:1 says “In the beginning...”
high

Use when the assertion is well-supported by reliable sources.

Example:

A dictionary short definition supported by Merriam-Webster.
medium

Use when the assertion is useful and reasonable but needs additional support or review.

Example:

A simplified explanation written from multiple sources.
low

Use when the assertion is tentative, indirect, or loosely supported.

unknown

Use when assertion credibility has not been reviewed.

disputed

Use when credible sources disagree.

prototype

Use during early modeling before review.

confidence

The confidence field describes how confident SourceRoot is in the assertion.

Recommended values:

strong
moderate
weak
working
disputed
unknown
strong

The assertion is directly supported and unlikely to be controversial.

moderate

The assertion is likely correct but depends on interpretation or synthesis.

weak

The assertion is speculative, indirect, or lightly supported.

working

The assertion is still being modeled.

disputed

The assertion is contested.

unknown

The confidence has not been evaluated.

verificationStatus

The verificationStatus field describes whether the assertion has been checked.

Recommended values:

verified
reviewed
needs-review
source-backed
inferred
interpretive
prototype
unverified
disputed
deprecated
verified

The assertion has been checked and accepted.

reviewed

The assertion has been reviewed but may not be final.

needs-review

The assertion should be checked before production use.

source-backed

The assertion has at least one supporting source.

inferred

The assertion is inferred from sources, but not directly stated.

interpretive

The assertion is an interpretation, explanation, or symbolic reading.

prototype

The assertion is part of early prototype modeling.

unverified

The assertion has not been reviewed.

disputed

The assertion is contested.

deprecated

The assertion should no longer be used.

supportLevel

The supportLevel field describes how directly the source supports the assertion.

Recommended values:

direct
derived
inferred
interpretive
contextual
unsupported
direct

The source directly states or supports the assertion.

Example:

Dictionary source directly supports a short definition.
derived

The assertion is derived from a source but rephrased or structured.

Example:

A plain-English explanation based on a technical definition.
inferred

The assertion is a reasonable inference from one or more sources.

Example:

A relationship between two concepts inferred from their definitions.
interpretive

The assertion depends on symbolic, theological, literary, philosophical, or human interpretation.

Example:

Light symbolizes truth or divine presence.
contextual

The assertion is supported by surrounding context rather than a direct statement.

unsupported

The assertion currently has no source support and should be treated as a draft.

interpretationLevel

The interpretationLevel field describes how much human interpretation is involved.

Recommended values:

none
low
medium
high
speculative
none

The assertion is a direct quote, exact record, or factual metadata.

low

The assertion is lightly rephrased but close to the source.

medium

The assertion summarizes or synthesizes source material.

high

The assertion depends heavily on interpretation.

speculative

The assertion is exploratory and should not be treated as verified.

Suggested Assertion Shape
{
  "id": "dictionary-assertion-truth-short-definition",
  "nodeId": "dictionary-truth",
  "assertionType": "short-definition",
  "label": "Short Definition",
  "summary": "Truth is what corresponds to reality or fact.",
  "body": "Truth is what corresponds to reality or fact.",
  "sourceIds": [
    "merriam-webster-truth",
    "sep-truth"
  ],
  "domain": "DictionaryHub",
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "source-backed",
  "reviewStatus": "reviewed",
  "supportLevel": "derived",
  "interpretationLevel": "low"
}
BibleRoot Assertion Example
{
  "id": "bibleroot-assertion-light-symbolic-meaning",
  "nodeId": "bible-symbol-light",
  "assertionType": "symbolic-meaning",
  "label": "Symbolic Meaning",
  "summary": "Light is often used symbolically for truth, creation, guidance, and divine presence.",
  "body": "In BibleRoot, light is modeled as a symbolic concept connected to truth, creation, guidance, and divine presence.",
  "sourceIds": [
    "kjv-public-domain",
    "bibleroot-alpha-notes"
  ],
  "domain": "BibleRoot",
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "interpretive",
  "reviewStatus": "needs-review",
  "supportLevel": "interpretive",
  "interpretationLevel": "high"
}
Wikidata Assertion Example
{
  "id": "wikidata-assertion-light-description",
  "nodeId": "wikidata-light",
  "assertionType": "wikidata-description",
  "label": "Wikidata Description",
  "summary": "electromagnetic radiation at or near visible wavelengths",
  "body": "electromagnetic radiation at or near visible wavelengths",
  "sourceIds": [
    "wikidata-q9128"
  ],
  "domain": "Wiki",
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "community-maintained",
  "reviewStatus": "reviewed",
  "supportLevel": "direct",
  "interpretationLevel": "none"
}
Relationship to Source Credibility

Assertion credibility should consider source credibility, but should not blindly copy it.

Example:

High-quality source + direct support = high assertion credibility.
High-quality source + loose interpretation = medium assertion credibility.
Prototype note + no external review = prototype or medium assertion credibility.
Community-maintained source + direct statement = medium assertion credibility.
Assertion Trust Rule

SourceRoot should show whether a claim is:

directly stated
derived
inferred
interpreted
prototype-only
disputed
unsupported

This is what lets AI systems answer with honesty.

Why This Matters for AI

An AI using SourceRoot should not just retrieve a source.

It should know how the source is being used.

Example:

The source directly supports this definition.
The source only indirectly supports this relationship.
This symbolic meaning is interpretive and needs review.
This assertion is prototype-level.
This claim is disputed.

This prevents AI from treating every claim as equally certain.

Future UI Targets

The Inspector should eventually show assertion credibility fields on each assertion card:

Credibility Tier
Confidence
Verification Status
Review Status
Support Level
Interpretation Level
Source IDs

The Source Registry already shows source-level credibility.

The next step is to expose assertion credibility inside:

SourceRoot Inspector
API Preview
Future Assertion Registry
Current Prototype Next Steps
Add default assertion credibility fields to DictionaryHub generated assertions.
Add default assertion credibility fields to BibleRoot assertions.
Add default assertion credibility fields to Wikidata assertions.
Show assertion credibility metadata in SourceRoot Inspector assertion cards.
Add assertion credibility fields to the API Preview.
Eventually add an Assertion Registry page.