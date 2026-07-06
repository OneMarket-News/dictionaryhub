# SourceRoot V3 Assertion Model

## Core Idea

A node identifies a thing.

An assertion says something about that thing.

A source supports the assertion.

```text
Node
↓
Assertion
↓
Source
Why Assertions Matter

Do not overload nodes with every explanation, definition, interpretation, or historical note.

A node should stay clean.

Assertions carry the meaning.

Simple Example
Node:
Light

Assertions:
- Literal Meaning
- Symbolic Meaning
- Biblical Usage
- Cross References
- Theological Interpretation

Sources:
- KJV Public Domain Text
- BibleRoot Alpha Notes
- Future commentaries
- Future lexicons
Universal Assertion Schema
{
  "id": "",
  "nodeId": "",
  "assertionType": "",
  "label": "",
  "summary": "",
  "body": "",
  "sourceIds": [],
  "confidence": "",
  "status": "",
  "revisions": []
}
Field Meanings
id

Unique assertion ID.

Example:

assertion-light-symbolic-meaning
nodeId

The node this assertion belongs to.

Example:

symbol-light
assertionType

The kind of claim being made.

Examples:

definition
literal-meaning
symbolic-meaning
historical-context
theological-interpretation
cross-reference-note
usage-note
translation-note
evidence-note
label

Human-readable title.

Example:

Symbolic Meaning of Light
summary

Short version of the assertion.

Example:

Light often symbolizes revelation, life, truth, and divine order.
body

Full explanation.

Example:

In Genesis 1, light appears as the first created reality named after God's command. Later biblical texts often connect light with life, revelation, truth, and the presence of God.
sourceIds

Sources that support this assertion.

Example:

["kjv-public-domain", "bibleroot-alpha-notes"]
confidence

Working confidence level.

Examples:

high
medium
low
working
disputed
status

Current state of the assertion.

Examples:

alpha
draft
reviewed
verified
disputed
deprecated
revisions

Change trail for the assertion.

Example:

[
  {
    "version": "0.1",
    "date": "2026-07-06",
    "note": "Initial assertion model."
  }
]
Relationship to Nodes

Nodes should answer:

What is this thing?

Assertions should answer:

What are we saying about this thing?

Sources should answer:

Why should this be trusted?
Relationship to Edges

Edges connect nodes.

Assertions explain nodes.

Node → Edge → Node
Node → Assertion → Source

Example:

Light → related to → Creation
Light → symbolic meaning → Revelation, life, truth, order
BibleRoot Example
Node
{
  "id": "symbol-light",
  "title": "Light",
  "type": "Symbol",
  "domain": "BibleRoot"
}
Assertion
{
  "id": "assertion-light-symbolic-meaning",
  "nodeId": "symbol-light",
  "assertionType": "symbolic-meaning",
  "label": "Symbolic Meaning of Light",
  "summary": "Light often symbolizes revelation, life, truth, and divine order.",
  "body": "In Genesis 1, light appears after God's command and begins the ordering of creation. Later biblical texts often connect light with life, revelation, truth, and the presence of God.",
  "sourceIds": ["kjv-public-domain", "bibleroot-alpha-notes"],
  "confidence": "working",
  "status": "alpha",
  "revisions": [
    {
      "version": "0.1",
      "date": "2026-07-06",
      "note": "Initial BibleRoot assertion example."
    }
  ]
}
Hub Examples
DictionaryHub

Node:

Word: Grace

Assertions:

Definition
Etymology
Usage
Historical Development
Source Comparison
BibleRoot

Node:

Symbol: Light

Assertions:

Literal Meaning
Symbolic Meaning
Theological Interpretation
Cross References
Translation Notes
HistoryHub

Node:

Event: Fall of Rome

Assertions:

Date Range
Causes
Consequences
Primary Sources
Historiographical Debate
ScienceHub

Node:

Theory: Evolution

Assertions:

Definition
Evidence
Mechanism
Limitations
Scientific Consensus
LawHub

Node:

Case: Brown v. Board of Education

Assertions:

Holding
Reasoning
Legal Principle
Citation
Later Treatment
SourceRoot V3 Core Loop
Create Node
↓
Add Assertion
↓
Attach Source
↓
Connect Node to Other Nodes
↓
Track Revisions
Design Rule

Never treat explanations as permanent truth.

Treat explanations as assertions with:

source support
status
confidence
revision history

That is what makes SourceRoot different from a normal website.