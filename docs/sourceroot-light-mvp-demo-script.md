# SourceRoot Light MVP Demo Script

## Purpose

This script is a short walkthrough for explaining the SourceRoot MVP.

The goal is to show that SourceRoot can:

```text
validate knowledge before import
separate nodes from assertions
separate assertions from relationships
attach sources to claims and edges
show credibility metadata
show review warnings
inspect one concept across multiple contexts

The demo topic is:

Light
Demo Length

Target time:

3–5 minutes

Extended version:

10–15 minutes
Core Demo Message

SourceRoot is not just storing information.

SourceRoot is organizing knowledge into a structure that can be inspected, validated, cited, and trusted.

The key idea:

A word or concept is not one flat definition.
It is a network of claims, relationships, sources, and trust context.
Opening Line

Use this:

This demo shows how SourceRoot models the concept of “light” across physical, dictionary, biblical, symbolic, truth, knowledge, guidance, revelation, and visibility contexts.

Then say:

The important part is not just the word light. The important part is that every meaning, claim, relationship, source, and warning is separated into its own inspectable layer.
Step 1 — Open the SourceRoot Dashboard

Open:

sourceroot.html

Point out:

SourceRoot Home
Light MVP Bundle card
Prototype Status
Architecture flow
Next Build Targets

Say:

This is the SourceRoot dashboard. It shows the prototype as a knowledge provenance system, not just a dictionary, Bible tool, or wiki viewer.

Point to the architecture:

Raw Data / Import Bundles / Light MVP Bundle
  ↓
Adapters / Connectors / Validators
  ↓
Nodes → Assertions → Edges → Sources → Credibility → Identity → Revisions
  ↓
Inspector / Assertion Registry / Edge Registry / Source Registry / Identity Registry / Import Preview
  ↓
DictionaryHub / BibleRoot / Wiki / Future Hubs

Say:

This is the main model. SourceRoot breaks knowledge into nodes, assertions, edges, sources, credibility, identity, revisions, and import validation.
Step 2 — Open Import Preview

Open:

sourceroot-import-preview.html

Click:

Load Light MVP Bundle

Expected result:

Ready With Warnings
Can Import: Yes
Errors: 0
Warnings: 3

Say:

Before SourceRoot accepts knowledge into the system, it validates the bundle. This bundle is structurally safe, so it can import. But it still has warnings because some source and relationship metadata needs review.

Important distinction:

Ready With Warnings does not mean bad data.
It means safe to preview, but not fully public-release ready.
Step 3 — Explain the Validation Result

Point out:

Nodes
Assertions
Edges
Sources
Revisions
Errors
Warnings

Say:

This is important because SourceRoot separates technical validity from trust readiness.

Then say:

The data can be structurally valid while still needing human review for source quality, licensing, interpretation level, or relationship confidence.

Use this phrase:

SourceRoot does not hide uncertainty. It makes uncertainty visible.
Step 4 — Open the Inspector

Open:

sourceroot-inspector.html

Point out the engine status:

Loaded Hubs
Node Types
Nodes
Assertions
Relationships
Sources

Say:

The Inspector now loads the Light MVP Bundle directly, so the validated data can also be inspected as part of the universal SourceRoot view.
Step 5 — Use the Light Demo Buttons

In the Inspector, use:

Wiki Light
Dictionary Light
BibleRoot Light
Truth
Knowledge

Start with:

Dictionary Light

Say:

This shows light as a meaning node. The node itself is only the container. The actual claims live below as assertions.

Then point out:

Assertions
Outgoing Relationships
Incoming Relationships
Sources
Revisions
Raw Node Data

Say:

This is the key difference. A normal dictionary might show one page of text. SourceRoot separates the page into claims, sources, relationships, and revisions.
Step 6 — Show Assertions

Scroll to:

Assertions

Say:

Assertions are the claim layer. Each assertion can have its own credibility tier, confidence level, verification status, review status, support level, interpretation level, and source IDs.

Use this phrase:

A source may be reliable, but a specific interpretation may still need review.

Then say:

That is why SourceRoot tracks credibility at the assertion level, not only at the source level.
Step 7 — Show Relationships

Scroll to:

Outgoing Relationships
Incoming Relationships

Say:

Edges are relationships between nodes. They show how meanings connect.

Example:

physical light → visibility
biblical light → truth
truth → knowledge
revelation → knowledge

Say:

Relationships also have credibility metadata. A direct relationship and an interpretive relationship should not carry the same trust level.

Use this contrast:

Physical light supports visibility is more direct.
Biblical light symbolizing truth is more interpretive.
Both are useful, but they should not be treated as the same kind of claim.
Step 8 — Show Sources

Scroll to:

Sources

Say:

Sources show where claims and relationships came from. SourceRoot keeps source metadata visible, including publisher, license status, credibility, verification, and review status.

Then say:

This is the start of the provenance layer. The system can show not only what is claimed, but where it came from and whether it is ready to rely on.
Step 9 — Open Assertion Registry

Open:

sourceroot-assertion-registry.html

Search:

light

Say:

The Assertion Registry lets us inspect claims across the system without being locked into one node page.

Point out filters:

Domain
Assertion Type
Credibility
Verification
Support

Say:

This is useful because SourceRoot can ask: show me all claims about light, or show me only claims that are source-backed, or show me claims that still need review.
Step 10 — Open Edge Registry

Open:

sourceroot-edge-registry.html

Search:

light

Say:

The Edge Registry shows the relationship layer. This is where SourceRoot becomes a graph of meaning, not just a list of definitions.

Point out:

Relationship type
Source
Target
Credibility
Verification
Review
Support
Strength
Interpretation

Say:

This is how SourceRoot can distinguish strong relationships from contextual or interpretive relationships.
Step 11 — Open Source Registry

Open:

sourceroot-source-registry.html

Search:

light

Or search:

BibleRoot

Say:

The Source Registry shows the source layer. It allows the system to inspect source quality, usage, licensing, review status, and provenance.

Use this phrase:

The long-term value is that AI systems, researchers, publishers, and builders could retrieve knowledge with source and trust context attached.
Step 12 — Close with the Big Idea

Say:

The Light MVP proves that SourceRoot can model one concept across multiple domains while preserving the difference between meaning, claims, relationships, sources, credibility, identity, revisions, and import readiness.

Then say:

This is not just a dictionary. It is not just a Bible tool. It is not just a wiki viewer.

Final line:

SourceRoot is the provenance and trust layer underneath knowledge applications.
Short 60-Second Version

Use this when someone only has one minute.

This is SourceRoot. It takes knowledge and breaks it into nodes, assertions, relationships, sources, credibility, identity, revisions, and import validation.

The Light MVP Bundle models “light” across physical, dictionary, biblical, symbolic, truth, knowledge, guidance, revelation, and visibility contexts.

First, Import Preview validates the bundle. It is Ready With Warnings, meaning it is structurally safe but still has review risks.

Then the Inspector shows the imported Light nodes directly. Each node has assertions, relationships, sources, and credibility metadata.

The important point is that SourceRoot does not treat knowledge as flat text. It separates every claim, every relationship, every source, and every warning so the data can be inspected and cited responsibly.

SourceRoot is the provenance and trust layer underneath knowledge applications.
3-Minute Version

Use this for a quick walkthrough.

This demo uses the concept of light.

On the dashboard, SourceRoot shows the system model: raw data and import bundles pass through adapters, connectors, and validators, then become nodes, assertions, edges, sources, credibility, identity, revisions, and import validation.

In Import Preview, I click Load Light MVP Bundle. The bundle validates as Ready With Warnings. That means the data structure is safe, but some source or relationship metadata still needs review.

That distinction matters. SourceRoot separates whether data can load from whether data is fully trustworthy or public-release ready.

Then I open the Inspector. The Inspector loads the Light MVP Bundle directly. I can click Dictionary Light, BibleRoot Light, Truth, and Knowledge.

Each node is not just a paragraph. It has assertions, outgoing relationships, incoming relationships, sources, revisions, and raw data.

Assertions are individual claims. Each claim has its own credibility, confidence, verification, review, support, and interpretation metadata.

Relationships also have trust metadata. Physical light connecting to visibility is a more direct relationship. Biblical light connecting to truth is more interpretive. SourceRoot can show both, but it does not treat them as the same trust level.

Then I can open the Assertion Registry, Edge Registry, and Source Registry to inspect claims, relationships, and sources across the whole system.

The point is simple: SourceRoot turns knowledge into an inspectable graph where meaning, claims, relationships, sources, credibility, and warnings are all visible.
Demo Checklist

Before showing the demo, confirm:

sourceroot.html opens
sourceroot-import-preview.html opens
Load Light MVP Bundle works
Result shows Ready With Warnings
Errors show 0
sourceroot-inspector.html opens
Engine count includes Light MVP data
Dictionary Light button opens a node
BibleRoot Light button opens a node
Truth button opens a node
Knowledge button opens a node
Assertion Registry opens
Edge Registry opens
Source Registry opens
If Something Fails
If Import Preview does not load the Light bundle

Check:

data/sourceroot-light-mvp-bundle.json

Make sure the file exists.

Check the button points to:

loadBundle("data/sourceroot-light-mvp-bundle.json");
If Inspector does not show Light nodes

Check that sourceroot-inspector.html fetches:

fetch("data/sourceroot-light-mvp-bundle.json")

Check that the Inspector merges:

adaptImportBundleNodes(lightMvpBundleRaw.nodes || [])
adaptImportBundleAssertions(lightMvpBundleRaw.assertions || [])
adaptImportBundleEdges(lightMvpBundleRaw.edges || [])
adaptImportBundleSources(lightMvpBundleRaw.sources || [])
If a demo button does not open a node

Search manually:

light
truth
knowledge

If the node appears manually, the issue is only the button matching logic.

If the node does not appear manually, the Light MVP Bundle is not loading into the Inspector.

What This Demo Proves

The Light MVP demo proves that SourceRoot can:

validate import bundles
load structured knowledge
inspect nodes
inspect assertions
inspect relationships
inspect sources
track credibility
track review status
track interpretation level
surface warnings
model one concept across multiple contexts
support future AI citation and provenance workflows
Final Summary

The Light MVP demo is the first clean product story for SourceRoot.

It shows that knowledge can be organized as:

Node → Assertion → Edge → Source → Credibility → Identity → Revision → Import Validation

And it proves the bigger claim:

SourceRoot makes knowledge inspectable before it becomes trusted.