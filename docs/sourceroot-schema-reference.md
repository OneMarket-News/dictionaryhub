# SourceRoot Schema Reference

SourceRoot organizes knowledge into inspectable objects.

Current core model:

```text
Node → Assertion → Edge → Source → Credibility → Identity → Revision → Import Validation
```

This document describes the current prototype object shapes used across the SourceRoot MVP.

---

## Purpose

The schema reference explains how SourceRoot represents:

```text
nodes
assertions
edges
sources
revisions
import bundles
validation results
API examples
credibility metadata
```

The goal is to make the project easier to understand, extend, validate, and eventually turn into a real API.

---

## Core Object Types

SourceRoot currently uses these primary object types:

```text
Node
Assertion
Edge
Source
Revision
Import Bundle
Validation Result
API Response
```

Each object should be inspectable on its own.

Each object should preserve enough metadata to explain:

```text
what it is
where it came from
how it connects
how reliable it is
whether it has been reviewed
whether it is safe to import
```

---

## Node Schema

A node is a concept, term, phrase, entity, symbol, object, or idea.

Nodes are containers. They are not the full truth by themselves.

### Shape

```json
{
  "id": "light-physical-phenomenon",
  "title": "Light",
  "type": "Physical Phenomenon",
  "domain": "SourceRoot",
  "summary": "Visible electromagnetic radiation that allows sight and illumination.",
  "description": "Optional longer explanation.",
  "sourceIds": [
    "source-wikidata-light-q9128",
    "source-physics-reference-light"
  ],
  "revisions": [
    "revision-light-physical-001"
  ]
}
```

### Fields

```text
id          Unique node identifier
title       Human-readable name
type        Node category
domain      Hub or system where the node belongs
summary     Short explanation
description Optional longer explanation
sourceIds   Source records connected to the node
revisions   Revision records connected to the node
```

### Examples

```text
light-physical-phenomenon
light-dictionary-meaning
light-biblical-symbol
truth-concept
knowledge-concept
guidance-concept
revelation-concept
visibility-concept
```

---

## Assertion Schema

An assertion is a specific claim about a node.

Assertions are the claim layer of SourceRoot.

A node can have many assertions.

### Shape

```json
{
  "id": "assertion-light-physical-definition",
  "nodeId": "light-physical-phenomenon",
  "assertionType": "definition",
  "label": "Physical Definition",
  "summary": "Light is visible electromagnetic radiation.",
  "body": "Light is visible electromagnetic radiation within the portion of the electromagnetic spectrum visible to the human eye.",
  "sourceIds": [
    "source-wikidata-light-q9128",
    "source-physics-reference-light"
  ],
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "source-backed",
  "reviewStatus": "reviewed",
  "supportLevel": "direct",
  "interpretationLevel": "low",
  "status": "mvp-demo",
  "domain": "SourceRoot"
}
```

### Fields

```text
id                   Unique assertion identifier
nodeId               Node the assertion belongs to
assertionType         Claim category
label                Human-readable assertion title
summary              Short claim summary
body                 Full assertion body
sourceIds            Sources supporting the assertion
credibilityTier      Overall credibility level
confidence           Confidence level
verificationStatus   How the claim has been verified
reviewStatus         Human/system review state
supportLevel         How directly sources support the claim
interpretationLevel  How interpretive the claim is
status               Prototype or release status
domain               Hub or system where the assertion belongs
```

### Assertion Types

Current examples include:

```text
definition
symbolic-meaning
creation-context
revelation-bridge
wikidata-description
aliases
external-identity
short-definition
```

---

## Edge Schema

An edge is a relationship between two nodes.

Edges are also claims.

A relationship needs its own credibility metadata because not every connection is equally strong.

### Shape

```json
{
  "id": "edge-light-physical-to-visibility",
  "fromNodeId": "light-physical-phenomenon",
  "toNodeId": "visibility-concept",
  "relationshipType": "ENABLES",
  "label": "enables",
  "summary": "Physical light enables visibility.",
  "sourceIds": [
    "source-physics-reference-light"
  ],
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "source-backed",
  "reviewStatus": "reviewed",
  "supportLevel": "direct",
  "relationshipStrength": "strong",
  "interpretationLevel": "low",
  "domain": "SourceRoot"
}
```

### Fields

```text
id                    Unique edge identifier
fromNodeId             Source node
toNodeId               Target node
relationshipType       Machine-readable relationship category
label                 Human-readable relationship label
summary               Explanation of the relationship
sourceIds             Sources supporting the relationship
credibilityTier       Overall relationship credibility
confidence            Confidence level
verificationStatus    How the relationship has been verified
reviewStatus          Human/system review state
supportLevel          How directly sources support the relationship
relationshipStrength  Strength of the connection
interpretationLevel   How interpretive the relationship is
domain                Hub or system where the edge belongs
```

### Relationship Types

Current examples include:

```text
DEFINED_AS
USED_SYMBOLICALLY_AS
SYMBOLIZES
ENABLES
RELATES_TO
SAME_AS
SAME_TERM_DIFFERENT_CONTEXT
RELATED_CONCEPT
DERIVED_FROM
CONTRASTS_WITH
DISAMBIGUATES
```

---

## Source Schema

A source records where a claim, node, or relationship came from.

Sources are the provenance layer of SourceRoot.

### Shape

```json
{
  "id": "source-wikidata-light-q9128",
  "name": "Wikidata — Light Q9128",
  "type": "External Structured Dataset",
  "domain": "Wiki",
  "publisher": "Wikidata",
  "url": "https://www.wikidata.org/wiki/Q9128",
  "license": "CC0",
  "licenseStatus": "public-reuse",
  "qualityTier": "structured-public-dataset",
  "credibilityTier": "medium",
  "verificationStatus": "community-maintained",
  "reviewStatus": "reviewed",
  "lastReviewed": "prototype",
  "notes": "Prototype source record for Light MVP."
}
```

### Fields

```text
id                  Unique source identifier
name                Human-readable source name
type                Source category
domain              Source domain or hub
publisher           Source publisher
url                 Source URL
license             License name
licenseStatus       Reuse/public/internal status
qualityTier         Source quality category
credibilityTier     Source credibility level
verificationStatus  Verification state
reviewStatus        Review state
lastReviewed        Last review date or prototype marker
notes               Optional context
```

### License Status Examples

```text
public-domain
public-reuse
working-reference
internal-use-only
prototype
unknown
```

---

## Revision Schema

A revision records how a SourceRoot object changed over time.

Revisions can apply to nodes, assertions, edges, sources, or bundles.

### Shape

```json
{
  "id": "revision-light-physical-001",
  "targetId": "light-physical-phenomenon",
  "targetType": "node",
  "version": "0.1.0",
  "summary": "Initial physical light node added to Light MVP Bundle.",
  "changedAt": "prototype",
  "changedBy": "SourceRoot build"
}
```

### Fields

```text
id          Unique revision identifier
targetId    Object being revised
targetType  Type of object revised
version     Version marker
summary     Explanation of the change
changedAt   Date, timestamp, or prototype marker
changedBy   Person, system, or build process
```

---

## Credibility Metadata

Credibility metadata appears on sources, assertions, and edges.

This prevents SourceRoot from treating all knowledge as equally reliable.

### Common Fields

```text
credibilityTier
confidence
verificationStatus
reviewStatus
supportLevel
interpretationLevel
relationshipStrength
```

Not every object uses every field.

### Credibility Tier

```text
high
medium
low
prototype
disputed
unknown
```

### Confidence

```text
strong
moderate
weak
unknown
```

### Verification Status

```text
source-backed
community-maintained
reviewed
interpretive
prototype
working
needs-review
disputed
unsupported
unknown
```

### Review Status

```text
reviewed
needs-review
prototype
draft
unknown
```

### Support Level

```text
direct
derived
contextual
inferred
interpretive
working
unsupported
```

### Interpretation Level

```text
none
low
medium
high
```

### Relationship Strength

```text
strong
moderate
contextual
weak
interpretive
unknown
```

---

## Import Bundle Schema

An import bundle is a package of SourceRoot objects.

It lets SourceRoot validate structured knowledge before accepting it.

### Shape

```json
{
  "bundleId": "sourceroot-light-mvp-bundle",
  "title": "SourceRoot Light MVP Bundle",
  "description": "Main SourceRoot MVP demo bundle.",
  "version": "0.1.0",
  "domain": "SourceRoot",
  "nodes": [],
  "assertions": [],
  "edges": [],
  "sources": [],
  "revisions": []
}
```

### Fields

```text
bundleId     Unique bundle identifier
title        Human-readable bundle title
description  Bundle explanation
version      Bundle version
domain       Main bundle domain
nodes        Node objects
assertions   Assertion objects
edges        Edge objects
sources      Source objects
revisions    Revision objects
```

### Current Import Bundles

```text
data/sourceroot-light-mvp-bundle.json
data/sourceroot-import-bundle-example.json
data/sourceroot-import-bundle-broken-example.json
```

---

## Validation Result Schema

A validation result explains whether an import bundle can be loaded safely.

### Shape

```json
{
  "bundleId": "sourceroot-light-mvp-bundle",
  "status": "ready-with-warnings",
  "canImport": true,
  "summary": {
    "nodes": 8,
    "assertions": 10,
    "edges": 9,
    "sources": 11,
    "revisions": 12,
    "errors": 0,
    "warnings": 3
  },
  "errors": [],
  "warnings": [
    {
      "code": "SOURCE_INTERNAL_ONLY",
      "objectType": "source",
      "objectId": "source-bibleroot-alpha-notes",
      "message": "Internal-only source should not be treated as public-release-ready."
    }
  ]
}
```

### Fields

```text
bundleId   Bundle being validated
status     ready, ready-with-warnings, blocked, or invalid-format
canImport  Whether the bundle can be loaded into preview
summary    Object counts and issue counts
errors     Blocking validation issues
warnings   Non-blocking review issues
```

### Status Values

```text
ready
ready-with-warnings
blocked
invalid-format
```

---

## Validation Issue Schema

Validation issues appear inside `errors` and `warnings`.

### Shape

```json
{
  "code": "MISSING_SOURCE_REFERENCE",
  "objectType": "assertion",
  "objectId": "assertion-example",
  "message": "Assertion references a source that does not exist in the bundle."
}
```

### Fields

```text
code        Machine-readable issue code
objectType  Type of object with the issue
objectId    ID of the affected object
message     Human-readable explanation
```

### Example Issue Codes

```text
INVALID_JSON
MISSING_REQUIRED_FIELD
DUPLICATE_ID
MISSING_NODE_REFERENCE
MISSING_SOURCE_REFERENCE
INVALID_CREDIBILITY_VALUE
INVALID_RELATIONSHIP_SUPPORT_LEVEL
SOURCE_INTERNAL_ONLY
REVISION_TARGET_NOT_FOUND
LOCAL_FILE_PARSE_FAILED
```

---

## API Response Examples

Static API examples currently live in:

```text
data/api-examples/sourceRoot-light-node-response.json
data/api-examples/sourceRoot-light-validation-response.json
data/api-examples/sourceRoot-light-citation-response.json
```

These examples are not live backend responses yet.

They model the product contract for the future API.

---

## Node API Response Shape

```json
{
  "apiVersion": "0.1.0",
  "status": "success",
  "endpoint": "/nodes/light-physical-phenomenon",
  "query": {
    "nodeId": "light-physical-phenomenon",
    "include": [
      "assertions",
      "relationships",
      "sources",
      "credibility",
      "revisions"
    ]
  },
  "result": {
    "node": {},
    "assertions": [],
    "relationships": {
      "outgoing": [],
      "incoming": []
    },
    "sources": [],
    "revisions": []
  }
}
```

---

## Import Validation API Response Shape

```json
{
  "apiVersion": "0.1.0",
  "status": "ready_with_warnings",
  "endpoint": "/imports/validate",
  "request": {
    "bundleId": "sourceroot-light-mvp-bundle",
    "bundlePath": "data/sourceroot-light-mvp-bundle.json"
  },
  "result": {
    "bundleId": "sourceroot-light-mvp-bundle",
    "canImport": true,
    "summary": {
      "nodes": 8,
      "assertions": 10,
      "edges": 9,
      "sources": 11,
      "revisions": 12,
      "errors": 0,
      "warnings": 3
    },
    "errors": [],
    "warnings": []
  }
}
```

---

## Citation Answer API Response Shape

```json
{
  "apiVersion": "0.1.0",
  "status": "success",
  "endpoint": "/answers/with-citations",
  "query": {
    "question": "What does light mean across physical, dictionary, and biblical contexts?",
    "nodeIds": []
  },
  "answer": {
    "summary": "SourceRoot answer text.",
    "confidence": "moderate",
    "reviewStatus": "prototype",
    "importantCaveat": "Interpretive relationships should not carry the same trust level as direct definitions."
  },
  "supportingObjects": {
    "nodes": [],
    "assertions": [],
    "relationships": [],
    "sources": []
  },
  "citationPolicy": {
    "canCitePublicly": "partial",
    "publicDomainSourcesAvailable": true,
    "internalOnlySourcesPresent": true,
    "requiresHumanReview": true
  }
}
```

---

## Adapter Output Shape

Adapters normalize different hub data into SourceRoot-compatible objects.

Current adapters:

```text
engine/adapters/dictionaryAdapter.js
engine/adapters/bibleAdapter.js
engine/adapters/wikidataAdapter.js
engine/adapters/importBundleAdapter.js
```

### Normalized Node Output

```json
{
  "id": "dictionary-light",
  "originalId": "light",
  "title": "Light",
  "type": "Dictionary Concept",
  "domain": "DictionaryHub",
  "summary": "Short definition.",
  "description": "Longer definition.",
  "sourceIds": [],
  "revisions": [],
  "raw": {}
}
```

### Normalized Assertion Output

```json
{
  "id": "dictionary-assertion-light-short-definition",
  "nodeId": "dictionary-light",
  "assertionType": "short-definition",
  "label": "Short Definition",
  "summary": "Short definition.",
  "body": "Full definition body.",
  "sourceIds": [],
  "credibilityTier": "high",
  "confidence": "strong",
  "verificationStatus": "source-backed",
  "reviewStatus": "reviewed",
  "supportLevel": "derived",
  "interpretationLevel": "low",
  "status": "v2-draft",
  "domain": "DictionaryHub",
  "raw": {}
}
```

### Normalized Edge Output

```json
{
  "id": "edge-example",
  "fromNodeId": "node-a",
  "toNodeId": "node-b",
  "relationshipType": "RELATES_TO",
  "label": "relates to",
  "summary": "Relationship explanation.",
  "sourceIds": [],
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "reviewed",
  "reviewStatus": "reviewed",
  "supportLevel": "contextual",
  "relationshipStrength": "contextual",
  "interpretationLevel": "medium",
  "domain": "SourceRoot",
  "raw": {}
}
```

### Normalized Source Output

```json
{
  "id": "source-example",
  "name": "Source Name",
  "type": "Reference Source",
  "domain": "SourceRoot",
  "qualityTier": "Working Source",
  "credibilityTier": "medium",
  "verificationStatus": "prototype",
  "sourceClass": "reference",
  "publisher": "Prototype Publisher",
  "license": "prototype",
  "licenseStatus": "working-reference",
  "reviewStatus": "needs-review",
  "lastReviewed": "prototype",
  "url": "",
  "notes": "",
  "raw": {}
}
```

---

## Current MVP Bundle Counts

The Light MVP Bundle currently contains:

```text
8 nodes
10 assertions
9 edges
11 sources
12 revisions
0 validation errors
3 validation warnings
```

Expected validation status:

```text
Ready With Warnings
```

Expected import state:

```text
Can Import: Yes
```

---

## Design Rules

SourceRoot should follow these rules:

```text
Do not flatten claims into pages.
Do not treat every source as equally reliable.
Do not treat every assertion as equally reliable.
Do not treat every relationship as equally reliable.
Do not hide warnings.
Do not import broken bundles.
Do not confuse symbolic relationships with direct identity.
Do not confuse safe-to-preview with public-release-ready.
```

Positive rules:

```text
Make every claim inspectable.
Make every relationship inspectable.
Make every source inspectable.
Expose credibility metadata.
Expose review status.
Expose interpretation level.
Expose source support.
Expose revision history.
Validate before import.
Preserve raw source context where useful.
```

---

## MVP Schema Status

Current status:

```text
Prototype schema
Static front-end implementation
No backend database yet
No live API yet
Validation module exists
Import bundle adapter exists
API examples exist
Schema ready for documentation and backend planning
```

---

## Next Schema Steps

Possible next schema improvements:

```text
Add JSON Schema files
Add required field validation per object type
Add stricter allowed values
Add source licensing rules
Add citation event schema
Add user/contributor identity schema
Add review workflow schema
Add bundle versioning rules
Add API route documentation
```

---

## Final Summary

The SourceRoot schema is designed to make knowledge inspectable before it becomes trusted.

The current prototype proves that knowledge can be separated into:

```text
nodes
assertions
relationships
sources
credibility metadata
identity context
revisions
import validation
API response objects
```

This creates the foundation for a future provenance engine and citation-aware knowledge API.