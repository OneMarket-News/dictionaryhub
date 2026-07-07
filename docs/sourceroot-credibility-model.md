# SourceRoot Credibility Model

## Purpose

SourceRoot must not only connect knowledge.

It must help users, applications, and AI systems understand how much trust to place in each source, assertion, relationship, and interpretation.

The credibility model gives SourceRoot a structured way to describe:

- where information came from
- who published it
- what kind of source it is
- how verified it is
- whether it is licensed
- whether it has been reviewed
- whether it is official, community-maintained, historical, interpretive, disputed, or experimental

---

## Core Principle

SourceRoot separates information from trust.

A source can exist in the graph before it is fully trusted.

A claim can be visible before it is verified.

A relationship can be useful before it is final.

This allows SourceRoot to model knowledge honestly instead of pretending all information has the same reliability.

---

## Credibility Fields

Every source should eventually support these fields:

```json
{
  "qualityTier": "official-documentation",
  "credibilityTier": "high",
  "verificationStatus": "official documentation",
  "sourceClass": "technical-documentation",
  "publisher": "Example Publisher",
  "license": "linked reference",
  "reviewStatus": "reviewed",
  "lastReviewed": "2026-07-07"
}
qualityTier

The qualityTier field describes the general quality or authority level of the source.

Recommended values:

official-documentation
primary-source
structured-public-dataset
academic-source
reference-source
community-maintained
company-internal
field-observation
interpretive-source
working-source
unknown
official-documentation

Use for official docs published by the organization responsible for the product, system, law, standard, dataset, or platform.

Example:

Official install guide
Official API docs
Official product spec
Official code report
primary-source

Use for original materials, firsthand documents, source texts, historical documents, or direct records.

Example:

Bible text
Original law
Historical manuscript
Patent
Company filing
structured-public-dataset

Use for open structured datasets.

Example:

Wikidata
OpenStreetMap
SEC structured filings
Government datasets
academic-source

Use for peer-reviewed papers, university publications, or scholarly references.

reference-source

Use for dictionaries, encyclopedias, standards references, and curated reference material.

community-maintained

Use for sources maintained by a public contributor community.

This can be useful, but should not automatically be treated as official.

company-internal

Use for internal company documents, product training, field notes, or private knowledge bases.

field-observation

Use for knowledge collected from real-world usage, installation photos, field reports, customer questions, or support issues.

interpretive-source

Use for commentary, theological interpretation, symbolic interpretation, philosophical reading, or expert opinion.

working-source

Use during prototype development before the source is fully classified.

unknown

Use when source quality has not been determined.

credibilityTier

The credibilityTier field describes how much confidence SourceRoot currently places in the source.

Recommended values:

very-high
high
medium
low
unknown
disputed
very-high

Use when the source is official, primary, current, directly relevant, and widely accepted.

high

Use when the source is reliable and relevant, but may not be the single highest authority.

medium

Use when the source is useful but needs additional support, review, or corroboration.

low

Use when the source may be weak, indirect, outdated, incomplete, or only loosely relevant.

unknown

Use when credibility has not been reviewed yet.

disputed

Use when credible sources disagree or the source is contested.

verificationStatus

The verificationStatus field describes the review/verification state.

Recommended values:

verified
official-documentation
reviewed
needs-review
community-maintained
self-published
unverified
disputed
deprecated
prototype
verified

The source has been checked and accepted for the current use.

official-documentation

The source is official documentation from the responsible publisher.

reviewed

The source has been reviewed internally but may not be official.

needs-review

The source is useful but still needs verification.

community-maintained

The source is maintained by a community and should be treated accordingly.

self-published

The source is published by the author, creator, company, or contributor without independent review.

unverified

The source has not been checked.

disputed

The source or claim is contested.

deprecated

The source is outdated, replaced, or no longer recommended.

prototype

The source is being used only for prototype modeling.

sourceClass

The sourceClass field describes what kind of material the source is.

Recommended values:

technical-documentation
structured-public-dataset
scripture-text
dictionary-entry
encyclopedia-entry
academic-paper
legal-document
standard
code-report
product-specification
training-document
field-report
support-case
image-evidence
video-evidence
commentary
interpretation
internal-note
prototype-note
reviewStatus

The reviewStatus field describes SourceRoot’s own internal review process.

Recommended values:

not-reviewed
needs-review
reviewed
approved
rejected
deprecated
licenseStatus

The licenseStatus field describes whether the source can be reused, cited, linked, displayed, or monetized.

Recommended values:

open
public-domain
linked-reference-only
permission-required
internal-use-only
restricted
unknown
open

The source can be reused under an open license.

public-domain

The source is public domain or dedicated to the public domain.

linked-reference-only

The source should be cited or linked, but not copied into SourceRoot beyond limited metadata.

permission-required

SourceRoot should not reuse the content until permission is granted.

internal-use-only

The source is private or company-internal.

restricted

The source is restricted by contract, law, or policy.

unknown

The licensing status has not been reviewed.