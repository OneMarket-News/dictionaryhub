# SourceRoot Light MVP Bundle

## Purpose

The Light MVP Bundle is the main SourceRoot demo dataset.

It shows how SourceRoot can model one concept across multiple knowledge contexts:

```text
Light
  ↓
physical phenomenon
dictionary meaning
biblical symbol
truth
knowledge
guidance
revelation
visibility

The goal is not only to define the word “light.”

The goal is to prove that SourceRoot can separate:

the thing
the claim
the relationship
the source
the credibility context
the revision history
the import readiness status
File Location
data/sourceroot-light-mvp-bundle.json
Import Preview Button

The Import Preview page now includes a direct button:

Load Light MVP Bundle

This loads:

data/sourceroot-light-mvp-bundle.json

Expected validation result:

Ready With Warnings
Can Import: Yes
Errors: 0
Warnings: 3
Why This Bundle Matters

This bundle is the first stronger MVP demonstration of SourceRoot.

The earlier example bundle proved that validation worked.

The Light MVP Bundle proves that SourceRoot can model a real cross-domain knowledge topic.

It includes:

nodes
assertions
edges
sources
revisions
credibility metadata
relationship credibility metadata
source license metadata
import validation behavior

This makes it useful for explaining the product.

What the Bundle Contains

Current bundle contents:

8 nodes
10 assertions
9 edges
11 sources
12 revisions
Nodes

The bundle includes these nodes:

light-physical-phenomenon
light-dictionary-meaning
light-biblical-symbol
truth-concept
knowledge-concept
guidance-concept
revelation-concept
visibility-concept

These nodes show that SourceRoot can distinguish between related but different meanings.

For example:

Light as a physical phenomenon

is not the same as:

Light as a biblical symbol

SourceRoot can connect them without incorrectly merging them.

Assertions

Assertions are the claim layer.

The Light MVP Bundle includes assertions such as:

Physical Definition
Dictionary Meaning
Biblical Symbolic Meaning
Creation Context
Light Reveals
Truth Definition
Knowledge Definition
Guidance Definition
Revelation Definition
Visibility Definition

This proves that SourceRoot does not treat a node as one flat paragraph.

Instead, each claim can be inspected separately.

Each assertion can carry its own:

credibilityTier
confidence
verificationStatus
reviewStatus
supportLevel
interpretationLevel
sourceIds

This is important because a source may be reliable, while a specific interpretation may still need review.

Edges

Edges are relationships between nodes.

The Light MVP Bundle includes relationships such as:

Light as Physical Phenomenon → Light as Dictionary Meaning
Light as Dictionary Meaning → Light as Biblical Symbol
Light as Biblical Symbol → Truth
Light as Biblical Symbol → Guidance
Light as Biblical Symbol → Revelation
Light as Physical Phenomenon → Visibility
Visibility → Knowledge
Truth → Knowledge
Revelation → Knowledge

This proves that SourceRoot can model meaning as a graph.

It also proves that relationships are not treated as automatic truth.

Each relationship has its own credibility metadata.

Relationship Credibility

The bundle uses relationship credibility fields such as:

credibilityTier
confidence
verificationStatus
reviewStatus
supportLevel
relationshipStrength
interpretationLevel

This allows SourceRoot to distinguish between:

direct relationships
derived relationships
contextual relationships
symbolic relationships
interpretive relationships
needs-review relationships

Example:

Physical light supports visibility

is stronger and more direct than:

Biblical light is symbolic of truth

Both are useful.

They just should not carry the same trust level.

Sources

The bundle includes source records for:

Wikidata Light
physics reference placeholder
dictionary reference placeholders
KJV Genesis 1
KJV John 1
BibleRoot Alpha Notes

The source layer shows where claims and relationships come from.

Each source can include:

publisher
qualityTier
credibilityTier
verificationStatus
sourceClass
license
licenseStatus
reviewStatus
lastReviewed
url
notes

This is the foundation of SourceRoot’s provenance model.

Why Warnings Are Expected

The Light MVP Bundle should validate as:

Ready With Warnings

That is correct.

The warnings are expected because some sources are still prototype or placeholder sources.

Examples include:

BibleRoot Alpha Notes
prototype dictionary references
placeholder physics references
internal-use-only source status
needs-review source metadata

These warnings are useful because they prove SourceRoot can separate:

safe to preview

from:

ready for public release

The bundle is structurally valid, but some sources still need review before public or commercial use.

What This Proves

The Light MVP Bundle proves that SourceRoot can:

validate a real import bundle
accept structurally safe knowledge
warn about review risks
show nodes
show assertions
show edges
show sources
show revisions
separate physical meaning from symbolic meaning
model trust at the claim level
model trust at the relationship level
model source licensing risk

This is the core MVP proof.

MVP Demo Story

The main demo question is:

What does light mean across sources and contexts?

SourceRoot can answer by showing:

physical light
dictionary light
biblical symbolic light
truth
knowledge
guidance
revelation
visibility

Then SourceRoot can show:

which claims support each meaning
which sources support each claim
which relationships connect the meanings
which relationships are direct
which relationships are interpretive
which sources need review
which data is safe to preview

That is the SourceRoot value proposition.

Demo Flow

Use this demo flow:

1. Open sourceroot-import-preview.html
2. Click Load Light MVP Bundle
3. Confirm Ready With Warnings
4. Show 0 errors
5. Explain the 3 warnings
6. Scroll through nodes, assertions, edges, sources, and revisions
7. Open Assertion Registry
8. Search light
9. Open Edge Registry
10. Search light
11. Open Source Registry
12. Show source usage and license metadata
13. Explain that SourceRoot separates knowledge from trust
Important Distinction

SourceRoot is not just a dictionary.

SourceRoot is not just a Bible study tool.

SourceRoot is not just a wiki viewer.

SourceRoot is the layer underneath them that asks:

What is being claimed?
Where did it come from?
How is it connected?
How trustworthy is it?
Can it be imported safely?
Can it be cited responsibly?

The Light MVP Bundle is the first clean demonstration of that idea.

Current Status
Status: MVP demo bundle
Validation: Ready With Warnings
Import safe: Yes
Public-release ready: Not fully
Needs review: Yes
Purpose: Demo, validation, provenance, and SourceRoot explanation
Future Improvements

Later versions can improve the bundle by adding:

approved dictionary source URLs
approved physics source URLs
more biblical source references
public-domain passage references
stronger source licensing metadata
more identity edges
more revisions
external registry IDs
schema.org compatibility
W3C PROV compatibility
citation examples
Summary

The Light MVP Bundle is the first meaningful SourceRoot dataset.

It proves the system can model one concept across multiple domains while preserving:

meaning
claims
relationships
sources
credibility
identity
revision history
import readiness

The bundle is not perfect, and that is the point.

SourceRoot makes the imperfections visible before the data becomes trusted.