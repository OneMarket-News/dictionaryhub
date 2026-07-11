# SourceRoot Import Bundle Format

## Purpose

A SourceRoot Import Bundle is the standard package format for bringing larger datasets into SourceRoot.

The goal is to move SourceRoot from hand-built prototype data into importable, validated knowledge.

An import bundle should contain the major SourceRoot object types:

```text
Nodes
Assertions
Edges
Sources
Revisions
```

This allows SourceRoot to preview, validate, and load new knowledge safely.

---

## Core Bundle Shape

```json
{
  "bundleId": "example-bundle",
  "bundleType": "sourceroot-import-bundle",
  "version": "0.1",
  "domain": "ExampleHub",
  "createdAt": "2026-07-11",
  "createdBy": "SourceRoot prototype",
  "description": "Short explanation of what this import bundle contains.",
  "nodes": [],
  "assertions": [],
  "edges": [],
  "sources": [],
  "revisions": []
}
```

---

## Required Bundle Fields

| Field | Required | Purpose |
|---|---:|---|
| `bundleId` | Yes | Unique ID for this import bundle |
| `bundleType` | Yes | Should be `sourceroot-import-bundle` |
| `version` | Yes | Bundle format version |
| `domain` | Yes | Hub or source domain |
| `createdAt` | Yes | Creation date |
| `createdBy` | Yes | Creator or system name |
| `description` | Recommended | Human-readable summary |
| `nodes` | Yes | Imported nodes |
| `assertions` | Yes | Imported claims |
| `edges` | Yes | Imported relationships |
| `sources` | Yes | Imported source records |
| `revisions` | Recommended | Change records |

---

## Node Object

A node is the idea, phrase, concept, entity, source object, document, person, event, or symbol being modeled.

### Node Shape

```json
{
  "id": "example-node-light",
  "title": "Light",
  "type": "Concept",
  "domain": "ExampleHub",
  "summary": "A short description of the node.",
  "description": "A longer explanation of the node.",
  "sourceIds": ["example-source"],
  "revisions": [
    {
      "version": "0.1",
      "summary": "Initial import."
    }
  ]
}
```

### Required Node Fields

| Field | Required | Purpose |
|---|---:|---|
| `id` | Yes | Unique node ID |
| `title` | Yes | Human-readable name |
| `type` | Yes | Node category |
| `domain` | Yes | Hub/domain the node belongs to |
| `summary` | Recommended | Short searchable summary |
| `description` | Optional | Longer explanation |
| `sourceIds` | Recommended | Sources supporting the node |
| `revisions` | Optional | Node revision history |

---

## Assertion Object

An assertion is a specific claim, definition, explanation, statement, symbolic meaning, example, or interpretation attached to a node.

### Assertion Shape

```json
{
  "id": "example-assertion-light-definition",
  "nodeId": "example-node-light",
  "assertionType": "definition",
  "label": "Definition",
  "summary": "Light is electromagnetic radiation that can be visible to the human eye.",
  "body": "Light is electromagnetic radiation that can be visible to the human eye.",
  "domain": "ExampleHub",
  "sourceIds": ["example-source"],
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "source-backed",
  "reviewStatus": "needs-review",
  "supportLevel": "direct",
  "interpretationLevel": "low",
  "status": "imported"
}
```

### Required Assertion Fields

| Field | Required | Purpose |
|---|---:|---|
| `id` | Yes | Unique assertion ID |
| `nodeId` | Yes | Node the assertion belongs to |
| `assertionType` | Yes | Claim category |
| `label` | Recommended | Display label |
| `summary` | Recommended | Short claim summary |
| `body` | Recommended | Full claim text |
| `domain` | Yes | Hub/domain |
| `sourceIds` | Recommended | Sources supporting the claim |
| `credibilityTier` | Recommended | Trust level |
| `confidence` | Recommended | Confidence level |
| `verificationStatus` | Recommended | Verification state |
| `reviewStatus` | Recommended | Review state |
| `supportLevel` | Recommended | How directly sources support the claim |
| `interpretationLevel` | Recommended | How interpretive the claim is |
| `status` | Optional | Import/state label |

---

## Edge Object

An edge is a relationship between two nodes.

A relationship is also a claim, so edges should include relationship-level credibility.

### Edge Shape

```json
{
  "id": "example-edge-light-truth",
  "fromNodeId": "example-node-light",
  "toNodeId": "example-node-truth",
  "relationshipType": "RELATES_TO",
  "label": "relates to",
  "summary": "Light relates to truth through the symbolic idea of revealing what is hidden.",
  "domain": "ExampleHub",
  "sourceIds": ["example-source"],
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "inferred",
  "reviewStatus": "needs-review",
  "supportLevel": "contextual",
  "relationshipStrength": "contextual",
  "interpretationLevel": "medium"
}
```

### Required Edge Fields

| Field | Required | Purpose |
|---|---:|---|
| `id` | Yes | Unique edge ID |
| `fromNodeId` | Yes | Starting node |
| `toNodeId` | Yes | Target node |
| `relationshipType` | Yes | Relationship category |
| `label` | Recommended | Human-readable label |
| `summary` | Recommended | Relationship explanation |
| `domain` | Yes | Hub/domain |
| `sourceIds` | Recommended | Sources supporting the relationship |
| `credibilityTier` | Recommended | Relationship trust level |
| `confidence` | Recommended | Confidence level |
| `verificationStatus` | Recommended | Verification state |
| `reviewStatus` | Recommended | Review state |
| `supportLevel` | Recommended | Direct, derived, inferred, symbolic, contextual, unsupported |
| `relationshipStrength` | Recommended | Core, strong, medium, weak, contextual, experimental |
| `interpretationLevel` | Recommended | None, low, medium, high, speculative |

---

## Source Object

A source records where information comes from.

Sources support nodes, assertions, and edges.

### Source Shape

```json
{
  "id": "example-source",
  "name": "Example Source",
  "type": "Reference Source",
  "domain": "ExampleHub",
  "publisher": "Example Publisher",
  "qualityTier": "reference-source",
  "credibilityTier": "medium",
  "verificationStatus": "reviewed",
  "sourceClass": "reference",
  "license": "linked reference",
  "licenseStatus": "linked-reference-only",
  "reviewStatus": "reviewed",
  "lastReviewed": "2026-07-11",
  "url": "https://example.com",
  "notes": "Source imported for SourceRoot testing."
}
```

### Required Source Fields

| Field | Required | Purpose |
|---|---:|---|
| `id` | Yes | Unique source ID |
| `name` | Yes | Source name |
| `type` | Yes | Source type |
| `domain` | Yes | Hub/domain |
| `publisher` | Recommended | Publisher or owner |
| `qualityTier` | Recommended | Source quality category |
| `credibilityTier` | Recommended | Source trust level |
| `verificationStatus` | Recommended | Verification state |
| `sourceClass` | Recommended | Source category |
| `license` | Recommended | License description |
| `licenseStatus` | Recommended | License status |
| `reviewStatus` | Recommended | Review state |
| `lastReviewed` | Recommended | Review date |
| `url` | Recommended | Source URL |
| `notes` | Optional | Additional context |

---

## Revision Object

A revision records how an object changed or entered SourceRoot.

### Revision Shape

```json
{
  "revisionId": "rev-example-node-light-0-1",
  "objectId": "example-node-light",
  "objectType": "node",
  "version": "0.1",
  "summary": "Initial import of example light node.",
  "changedAt": "2026-07-11",
  "changedBy": "SourceRoot prototype"
}
```

### Required Revision Fields

| Field | Required | Purpose |
|---|---:|---|
| `revisionId` | Yes | Unique revision ID |
| `objectId` | Yes | Object being revised |
| `objectType` | Yes | node, assertion, edge, source, bundle |
| `version` | Recommended | Version label |
| `summary` | Recommended | Change summary |
| `changedAt` | Recommended | Change date |
| `changedBy` | Recommended | Person/system that made the change |

---

## Validation Rules

A SourceRoot Import Bundle should be validated before it is loaded.

### Bundle-Level Rules

```text
Bundle must have a bundleId.
Bundle type must be sourceroot-import-bundle.
Bundle must include nodes, assertions, edges, and sources arrays.
Bundle domain should not be empty.
Bundle version should not be empty.
```

### ID Rules

```text
No duplicate node IDs.
No duplicate assertion IDs.
No duplicate edge IDs.
No duplicate source IDs.
No duplicate revision IDs.
Imported IDs should not overwrite existing SourceRoot IDs unless update mode is enabled.
```

### Node Reference Rules

```text
Every assertion.nodeId must refer to a valid node.
Every edge.fromNodeId must refer to a valid node or known external SourceRoot node.
Every edge.toNodeId must refer to a valid node or known external SourceRoot node.
```

### Source Reference Rules

```text
Every sourceId used by a node, assertion, or edge should refer to a valid source.
Missing sources should produce a warning or error.
```

### Credibility Rules

```text
Sources should include credibilityTier, verificationStatus, licenseStatus, and reviewStatus.
Assertions should include credibilityTier, confidence, verificationStatus, reviewStatus, supportLevel, and interpretationLevel.
Edges should include credibilityTier, confidence, verificationStatus, reviewStatus, supportLevel, relationshipStrength, and interpretationLevel.
Missing credibility fields should produce warnings.
```

### Data Quality Rules

```text
Nodes should have titles.
Assertions should have summaries or bodies.
Edges should have relationship types.
Sources should have names.
Imported objects should include domain.
Empty arrays are allowed for early testing, but production imports should include useful data.
```

---

## Default Credibility Values

When imported data is missing trust metadata, SourceRoot may apply defaults.

### Prototype Default

```json
{
  "credibilityTier": "prototype",
  "confidence": "working",
  "verificationStatus": "prototype",
  "reviewStatus": "needs-review",
  "supportLevel": "contextual",
  "interpretationLevel": "medium"
}
```

### Relationship Default

```json
{
  "credibilityTier": "medium",
  "confidence": "moderate",
  "verificationStatus": "inferred",
  "reviewStatus": "needs-review",
  "supportLevel": "contextual",
  "relationshipStrength": "contextual",
  "interpretationLevel": "medium"
}
```

### Source Default

```json
{
  "qualityTier": "working-source",
  "credibilityTier": "medium",
  "verificationStatus": "needs-review",
  "licenseStatus": "unknown",
  "reviewStatus": "needs-review"
}
```

---

## Import Flow

The long-term import flow should be:

```text
Upload or load bundle
  ↓
Parse JSON
  ↓
Validate bundle structure
  ↓
Check node/assertion/edge/source references
  ↓
Check credibility metadata
  ↓
Preview warnings and errors
  ↓
Approve import
  ↓
Load into SourceRoot registries
  ↓
Inspect imported knowledge
```

---

## MVP Import Goal

The MVP import goal is not to import everything.

The MVP import goal is:

```text
Import one clean structured dataset,
validate it,
preview warnings,
load it,
and inspect it through SourceRoot.
```

Good first test bundles:

```text
Genesis 1
John 1
Psalm 23
25–50 DictionaryHub concepts
A larger Light knowledge map
A small One Market News event timeline
```

---

## Why This Matters

The import bundle format is the bridge between:

```text
Hand-built prototype
```

and:

```text
Reusable knowledge engine
```

Once SourceRoot can accept bundles, it can begin scaling into larger hubs, external datasets, partner imports, and future APIs.