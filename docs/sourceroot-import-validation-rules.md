# SourceRoot Import Validation Rules

## Purpose

SourceRoot import validation exists to protect the knowledge graph before new data is loaded.

The goal is simple:

```text
Do not let broken, incomplete, duplicated, or unsupported knowledge enter SourceRoot without being flagged.
```

The validator should inspect an import bundle and return:

```text
Errors
Warnings
Summary counts
Readiness status
```

Validation is the bridge between:

```text
Import Bundle Format
```

and:

```text
Import Preview Page
```

---

## Validation Result Shape

A future validator should return a result like this:

```json
{
  "bundleId": "sourceroot-example-light-bundle",
  "status": "ready-with-warnings",
  "canImport": true,
  "summary": {
    "nodes": 2,
    "assertions": 2,
    "edges": 1,
    "sources": 1,
    "revisions": 3,
    "errors": 0,
    "warnings": 4
  },
  "errors": [],
  "warnings": [
    {
      "code": "SOURCE_INTERNAL_ONLY",
      "objectType": "source",
      "objectId": "example-source-light-reference",
      "message": "Source license status is internal-use-only."
    }
  ]
}
```

---

## Validation Status Types

| Status | Meaning | Can Import? |
|---|---|---:|
| `ready` | No errors or meaningful warnings | Yes |
| `ready-with-warnings` | No blocking errors, but warnings exist | Yes |
| `blocked` | One or more errors prevent import | No |
| `invalid-format` | File is not a valid SourceRoot bundle | No |
| `needs-review` | Bundle can be inspected but should not be loaded automatically | Maybe |
| `prototype-only` | Bundle is acceptable for testing but not production | Maybe |

---

## Error vs Warning

## Errors

Errors block import.

Use errors when the bundle would break SourceRoot.

Examples:

```text
Missing bundleId
Wrong bundleType
Duplicate node IDs
Assertion points to missing node
Edge points to missing node
Source ID is referenced but missing
Required arrays are missing
Invalid JSON
```

## Warnings

Warnings do not always block import, but they should be shown clearly.

Use warnings when the bundle can load but needs review.

Examples:

```text
Missing credibility fields
Missing review status
Missing license status
Empty description
Prototype source
Internal-use-only source
No revisions
Weak relationship strength
Unreviewed interpretive claim
```

---

## Rule Group 1: Bundle Format Rules

### Rule: Bundle Must Be Valid JSON

**Code:** `INVALID_JSON`  
**Severity:** Error

The uploaded or loaded file must parse as valid JSON.

Invalid JSON blocks import.

---

### Rule: Bundle Type Must Be Correct

**Code:** `INVALID_BUNDLE_TYPE`  
**Severity:** Error

The bundle must include:

```json
{
  "bundleType": "sourceroot-import-bundle"
}
```

Any other value should block import.

---

### Rule: Bundle ID Required

**Code:** `MISSING_BUNDLE_ID`  
**Severity:** Error

The bundle must include a non-empty `bundleId`.

---

### Rule: Bundle Version Required

**Code:** `MISSING_BUNDLE_VERSION`  
**Severity:** Error

The bundle must include a non-empty `version`.

---

### Rule: Bundle Domain Required

**Code:** `MISSING_BUNDLE_DOMAIN`  
**Severity:** Error

The bundle must include a non-empty `domain`.

---

### Rule: Bundle Arrays Required

**Code:** `MISSING_REQUIRED_ARRAY`  
**Severity:** Error

The bundle must include these arrays:

```text
nodes
assertions
edges
sources
```

The `revisions` array is recommended but may be optional during prototype testing.

---

## Rule Group 2: ID Rules

### Rule: No Duplicate Node IDs

**Code:** `DUPLICATE_NODE_ID`  
**Severity:** Error

Every node ID must be unique within the bundle.

---

### Rule: No Duplicate Assertion IDs

**Code:** `DUPLICATE_ASSERTION_ID`  
**Severity:** Error

Every assertion ID must be unique within the bundle.

---

### Rule: No Duplicate Edge IDs

**Code:** `DUPLICATE_EDGE_ID`  
**Severity:** Error

Every edge ID must be unique within the bundle.

---

### Rule: No Duplicate Source IDs

**Code:** `DUPLICATE_SOURCE_ID`  
**Severity:** Error

Every source ID must be unique within the bundle.

---

### Rule: No Duplicate Revision IDs

**Code:** `DUPLICATE_REVISION_ID`  
**Severity:** Warning for prototype, error for production

Every revision ID should be unique.

During prototype testing, missing or duplicate revision IDs can be warnings. In production, they should become errors.

---

### Rule: IDs Should Be Stable

**Code:** `UNSTABLE_ID_PATTERN`  
**Severity:** Warning

IDs should be lowercase, descriptive, and stable.

Preferred pattern:

```text
domain-objecttype-description
```

Examples:

```text
bibleroot-phrase-let-there-be-light
dictionary-concept-truth
wikidata-light-q9128
```

Avoid:

```text
node1
test2
new-item
random-123
```

---

## Rule Group 3: Node Rules

### Rule: Node ID Required

**Code:** `MISSING_NODE_ID`  
**Severity:** Error

Every node must include a non-empty `id`.

---

### Rule: Node Title Required

**Code:** `MISSING_NODE_TITLE`  
**Severity:** Error

Every node must include a non-empty `title`.

---

### Rule: Node Type Required

**Code:** `MISSING_NODE_TYPE`  
**Severity:** Warning for prototype, error for production

Every node should include a `type`.

Examples:

```text
Concept
Phrase
Symbol
External Entity
Event
Source Document
Claim Object
```

---

### Rule: Node Domain Required

**Code:** `MISSING_NODE_DOMAIN`  
**Severity:** Warning for prototype, error for production

Every node should include a domain.

Examples:

```text
DictionaryHub
BibleRoot
Wiki
SourceRoot
ExampleHub
MarketRoot
HistoryHub
```

---

### Rule: Node Summary Recommended

**Code:** `MISSING_NODE_SUMMARY`  
**Severity:** Warning

A node should include a short summary for search and preview.

---

## Rule Group 4: Assertion Rules

### Rule: Assertion ID Required

**Code:** `MISSING_ASSERTION_ID`  
**Severity:** Error

Every assertion must include a non-empty `id`.

---

### Rule: Assertion Node Reference Required

**Code:** `MISSING_ASSERTION_NODE_ID`  
**Severity:** Error

Every assertion must include `nodeId`.

---

### Rule: Assertion Node Must Exist

**Code:** `ASSERTION_NODE_NOT_FOUND`  
**Severity:** Error

Every `assertion.nodeId` must refer to a node in the bundle or to a known existing SourceRoot node.

Example error:

```text
Assertion example-assertion-light-definition points to missing node example-light.
```

---

### Rule: Assertion Type Required

**Code:** `MISSING_ASSERTION_TYPE`  
**Severity:** Error

Every assertion must include `assertionType`.

Examples:

```text
definition
short-definition
symbolic-meaning
technical-definition
example
external-statement
summary
interpretation
```

---

### Rule: Assertion Summary or Body Required

**Code:** `MISSING_ASSERTION_CONTENT`  
**Severity:** Error

Each assertion must include at least one of:

```text
summary
body
```

---

### Rule: Assertion Source Recommended

**Code:** `MISSING_ASSERTION_SOURCE`  
**Severity:** Warning

Assertions should include at least one `sourceId`.

Unsourced assertions may be allowed for prototype notes but must be marked clearly.

---

### Rule: Assertion Credibility Required

**Code:** `MISSING_ASSERTION_CREDIBILITY`  
**Severity:** Warning for prototype, error for production

Assertions should include:

```text
credibilityTier
confidence
verificationStatus
reviewStatus
supportLevel
interpretationLevel
```

---

## Rule Group 5: Edge Rules

### Rule: Edge ID Required

**Code:** `MISSING_EDGE_ID`  
**Severity:** Error

Every edge must include a non-empty `id`.

---

### Rule: Edge From Node Required

**Code:** `MISSING_EDGE_FROM_NODE`  
**Severity:** Error

Every edge must include `fromNodeId`.

---

### Rule: Edge To Node Required

**Code:** `MISSING_EDGE_TO_NODE`  
**Severity:** Error

Every edge must include `toNodeId`.

---

### Rule: Edge Nodes Must Exist

**Code:** `EDGE_NODE_NOT_FOUND`  
**Severity:** Error

Both `fromNodeId` and `toNodeId` must refer to nodes in the bundle or known existing SourceRoot nodes.

---

### Rule: Relationship Type Required

**Code:** `MISSING_RELATIONSHIP_TYPE`  
**Severity:** Error

Every edge must include `relationshipType`.

Examples:

```text
RELATES_TO
SAME_AS
SAME_TERM_DIFFERENT_CONTEXT
SYMBOLICALLY_RELATES_TO
CONTAINS_SYMBOL
SUPPORTS
CONTRASTS_WITH
DERIVED_FROM
```

---

### Rule: Edge Summary Recommended

**Code:** `MISSING_EDGE_SUMMARY`  
**Severity:** Warning

Edges should include a short explanation of why the relationship exists.

---

### Rule: Edge Source Recommended

**Code:** `MISSING_EDGE_SOURCE`  
**Severity:** Warning

Edges should include at least one source.

This is especially important because relationships are claims.

---

### Rule: Relationship Credibility Required

**Code:** `MISSING_RELATIONSHIP_CREDIBILITY`  
**Severity:** Warning for prototype, error for production

Edges should include:

```text
credibilityTier
confidence
verificationStatus
reviewStatus
supportLevel
relationshipStrength
interpretationLevel
```

---

## Rule Group 6: Source Rules

### Rule: Source ID Required

**Code:** `MISSING_SOURCE_ID`  
**Severity:** Error

Every source must include a non-empty `id`.

---

### Rule: Source Name Required

**Code:** `MISSING_SOURCE_NAME`  
**Severity:** Error

Every source must include a non-empty `name`.

---

### Rule: Source Type Required

**Code:** `MISSING_SOURCE_TYPE`  
**Severity:** Warning

Every source should include a `type`.

Examples:

```text
Primary Text
Reference Source
Academic Source
Structured Knowledge Graph
Official Documentation
Prototype Reference
```

---

### Rule: Source Domain Required

**Code:** `MISSING_SOURCE_DOMAIN`  
**Severity:** Warning

Every source should include a domain.

---

### Rule: Source Credibility Recommended

**Code:** `MISSING_SOURCE_CREDIBILITY`  
**Severity:** Warning

Sources should include:

```text
qualityTier
credibilityTier
verificationStatus
reviewStatus
licenseStatus
```

---

### Rule: Source License Status Required Before Public Use

**Code:** `MISSING_LICENSE_STATUS`  
**Severity:** Warning for prototype, error before public/commercial use

Every public-facing source should include license status.

Examples:

```text
public-domain
linked-reference-only
licensed
fair-use-review-needed
internal-use-only
unknown
```

---

### Rule: Internal Source Warning

**Code:** `SOURCE_INTERNAL_ONLY`  
**Severity:** Warning

If a source has:

```json
{
  "licenseStatus": "internal-use-only"
}
```

the validator should warn that the source is not suitable for public release.

---

## Rule Group 7: Source Reference Rules

### Rule: Referenced Source Must Exist

**Code:** `SOURCE_REFERENCE_NOT_FOUND`  
**Severity:** Error

Every `sourceId` used in nodes, assertions, or edges must exist in:

```text
bundle.sources
```

or in known existing SourceRoot sources.

---

### Rule: Empty Source IDs Should Be Ignored

**Code:** `EMPTY_SOURCE_ID`  
**Severity:** Warning

Empty strings inside `sourceIds` should be flagged.

Example:

```json
{
  "sourceIds": ["example-source", ""]
}
```

---

## Rule Group 8: Revision Rules

### Rule: Revision ID Recommended

**Code:** `MISSING_REVISION_ID`  
**Severity:** Warning

Every revision should include `revisionId`.

---

### Rule: Revision Object ID Required

**Code:** `MISSING_REVISION_OBJECT_ID`  
**Severity:** Warning

Every revision should identify the object being revised.

---

### Rule: Revision Object Type Required

**Code:** `MISSING_REVISION_OBJECT_TYPE`  
**Severity:** Warning

Every revision should include `objectType`.

Valid object types:

```text
bundle
node
assertion
edge
source
```

---

### Rule: Revision Target Should Exist

**Code:** `REVISION_TARGET_NOT_FOUND`  
**Severity:** Warning

A revision should refer to an object that exists in the bundle or in existing SourceRoot data.

---

## Rule Group 9: Credibility Value Rules

### Allowed `credibilityTier` Values

```text
very-high
high
medium
low
unknown
disputed
prototype
```

Invalid values should produce:

```text
INVALID_CREDIBILITY_TIER
```

Severity: Warning for prototype, error for production.

---

### Allowed `confidence` Values

```text
strong
moderate
weak
working
disputed
unknown
```

Invalid values should produce:

```text
INVALID_CONFIDENCE_VALUE
```

---

### Allowed `verificationStatus` Values

```text
verified
reviewed
source-backed
community-maintained
official-documentation
inferred
interpretive
symbolic
prototype
needs-review
unverified
disputed
deprecated
```

Invalid values should produce:

```text
INVALID_VERIFICATION_STATUS
```

---

### Allowed `reviewStatus` Values

```text
reviewed
needs-review
not-reviewed
deprecated
disputed
prototype
```

Invalid values should produce:

```text
INVALID_REVIEW_STATUS
```

---

### Allowed Assertion `supportLevel` Values

```text
direct
derived
inferred
interpretive
contextual
unsupported
```

Invalid values should produce:

```text
INVALID_SUPPORT_LEVEL
```

---

### Allowed Relationship `supportLevel` Values

```text
direct
derived
inferred
symbolic
contextual
unsupported
```

Invalid values should produce:

```text
INVALID_RELATIONSHIP_SUPPORT_LEVEL
```

---

### Allowed `relationshipStrength` Values

```text
core
strong
medium
weak
contextual
experimental
```

Invalid values should produce:

```text
INVALID_RELATIONSHIP_STRENGTH
```

---

### Allowed `interpretationLevel` Values

```text
none
low
medium
high
speculative
```

Invalid values should produce:

```text
INVALID_INTERPRETATION_LEVEL
```

---

## Rule Group 10: Import Readiness Rules

### Ready

A bundle is `ready` when:

```text
0 errors
0 serious warnings
all required fields present
all references valid
credibility metadata included
```

---

### Ready With Warnings

A bundle is `ready-with-warnings` when:

```text
0 errors
1 or more warnings
references are valid
data can load safely
review is recommended
```

---

### Blocked

A bundle is `blocked` when:

```text
1 or more errors
references are broken
required arrays are missing
duplicate IDs exist
invalid JSON
```

---

## MVP Validator Scope

The first MVP validator does not need to solve everything.

It should check:

```text
Valid JSON
Correct bundleType
Required arrays
Duplicate IDs
Assertion node references
Edge node references
Source references
Missing credibility fields
Summary counts
Errors vs warnings
Import readiness status
```

That is enough for the first Import Preview page.

---

## Future Validator Scope

Later versions can check:

```text
license risk
external registry IDs
schema.org compatibility
W3C PROV compatibility
duplicate meanings
identity conflicts
weak source support
stale sources
revision history gaps
AI citation suitability
```

---

## Why Validation Matters

SourceRoot is only valuable if its structure can be trusted.

The validator protects the system from becoming another messy content database.

The rule is:

```text
Bad data should not silently enter SourceRoot.
```

The validator should make problems visible before import.