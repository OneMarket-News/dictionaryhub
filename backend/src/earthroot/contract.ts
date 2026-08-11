/**
 * EarthRoot Place / Geography / Polity contract v1 (Chunk 15A).
 *
 * SCOPE BOUNDARY. This module defines EarthRoot's own governed vocabulary. It
 * does not modify, re-export, or reinterpret any released Chunk 14C shared
 * contract. EarthRoot fits into 14C; it does not reopen it.
 *
 * WHAT THIS STAGE DELIBERATELY DOES NOT CONTAIN:
 *   - coordinates, geometry, geocoding, bounding boxes, distance or radius
 *   - spatial SQL, spatial indexes, or any spatialQuery implementation
 *   - calendar conversion, named-era resolution, or interval algebra
 *   - a real corpus of any kind
 *   - Root promotion, or any IMPLEMENTED/PROVIDED object-type maturity change
 *
 * MATURITY RULING (Principal Architect, 15A). EarthRoot remains a PLANNED Root
 * with networkRuntimeState "not-implemented". `place` and `polity` remain
 * DEFINED and are never marked IMPLEMENTED or PROVIDED, because the released
 * registry invariant `planned-root-provides-nothing` forbids it and because
 * IMPLEMENTED asserts a released representation that 15A does not ship.
 * Implementation existence is not network maturity.
 */

// Read-only consumption of a released contract: EarthRoot derives its identity
// rejection list from this rather than retyping it. Nothing here modifies,
// re-exports, or reinterprets the released 14C module.
import { REJECTED_IDENTITY_EVIDENCE_KINDS } from "../sourceroot/identity-assertions.js";

/** EarthRoot contract version. Independent of the SourceRoot contract axis. */
export const EARTHROOT_CONTRACT_VERSION = "1.0.0" as const;

/** The Root identifier EarthRoot resources belong to. Never inferred. */
export const EARTHROOT_ROOT_ID = "EarthRoot" as const;

/* -------------------------------------------------------------------------
 * ENTITY TYPES
 *
 * Place and Polity are DISTINCT IDENTITY CLASSES, not two labels on one thing.
 * Wave 1 reconnaissance found released HistoryRoot data where a territory, a
 * people, and a settlement all share one `place` type, and where a contested
 * dual name was fused into a single canonical identifier. This separation is
 * the correction, and it is enforced structurally rather than by convention.
 * ---------------------------------------------------------------------- */

export const EARTHROOT_ENTITY_TYPES = ["place", "polity"] as const;
export type EarthRootEntityType = (typeof EARTHROOT_ENTITY_TYPES)[number];

/** Maps an EarthRoot entity type to its released SourceRoot object type. */
export const EARTHROOT_ENTITY_TO_OBJECT_TYPE: Readonly<
  Record<EarthRootEntityType, string>
> = {
  place: "place",
  polity: "polity",
};

/* -------------------------------------------------------------------------
 * GOVERNED PREDICATES
 *
 * Exactly five. No free-text predicate column functions as the public
 * contract, and no overlapping synonyms exist: Wave 1 found `located_within`,
 * `part_of`, `community_within`, and `within` all in flight with three
 * different meanings. `located_within` is the single canonical containment
 * predicate for EarthRoot. `governed_by` and `administered_by` are kept apart
 * because political control and administrative attachment are different
 * claims, and collapsing them would make one unfalsifiable.
 * ---------------------------------------------------------------------- */

export const EARTHROOT_PREDICATES = [
  "named_as",
  "classified_as",
  "located_within",
  "governed_by",
  "administered_by",
] as const;
export type EarthRootPredicate = (typeof EARTHROOT_PREDICATES)[number];

/** How an assertion's object is expressed. */
export const EARTHROOT_OBJECT_KINDS = ["resource", "literal"] as const;
export type EarthRootObjectKind = (typeof EARTHROOT_OBJECT_KINDS)[number];

export interface EarthRootPredicateRule {
  readonly predicate: EarthRootPredicate;
  readonly subjectTypes: readonly EarthRootEntityType[];
  readonly objectKind: EarthRootObjectKind;
  /** Required when objectKind is "resource". Empty otherwise. */
  readonly objectTypes: readonly EarthRootEntityType[];
  readonly description: string;
}

/**
 * Typed predicate governance. A relationship whose endpoints are the wrong
 * entity class is rejected, so a Polity can never be "located within" a Place
 * and a Place can never "govern" anything.
 */
export const EARTHROOT_PREDICATE_RULES: readonly EarthRootPredicateRule[] = [
  {
    predicate: "named_as",
    subjectTypes: ["place", "polity"],
    objectKind: "literal",
    objectTypes: [],
    description:
      "A sourced name for the subject. A name is never identity: two resources sharing a name remain distinct.",
  },
  {
    predicate: "classified_as",
    subjectTypes: ["place"],
    objectKind: "literal",
    objectTypes: [],
    description:
      "A sourced geographic classification such as settlement or harbour. Carries no geometry and is never identity.",
  },
  {
    predicate: "located_within",
    subjectTypes: ["place"],
    objectKind: "resource",
    objectTypes: ["place"],
    description:
      "Semantic containment of one Place by another. The single canonical containment predicate; no synonym exists.",
  },
  {
    predicate: "governed_by",
    subjectTypes: ["place"],
    objectKind: "resource",
    objectTypes: ["polity"],
    description:
      "Political control of a Place by a Polity. Requires temporal validity to be meaningful and must be source-backed.",
  },
  {
    predicate: "administered_by",
    subjectTypes: ["place"],
    objectKind: "resource",
    objectTypes: ["polity"],
    description:
      "Administrative attachment of a Place to a Polity. Deliberately distinct from political control.",
  },
] as const;

export function earthRootPredicateRule(
  predicate: string,
): EarthRootPredicateRule | null {
  return (
    EARTHROOT_PREDICATE_RULES.find((rule) => rule.predicate === predicate) ??
    null
  );
}

/** Predicates whose truth is expected to change over time. */
export const EARTHROOT_TEMPORAL_PREDICATES: readonly EarthRootPredicate[] = [
  "governed_by",
  "administered_by",
];

/* -------------------------------------------------------------------------
 * NAME SEMANTICS
 *
 * Vocabulary is reused from the released HistoryRoot alias model rather than
 * invented, so a former name means the same thing in both places.
 * ---------------------------------------------------------------------- */

export const EARTHROOT_NAME_TYPES = [
  "preferred",
  "alternate",
  "historical",
  "former_name",
  "endonym",
  "exonym",
  "transliteration",
  "translation",
  "disputed",
] as const;
export type EarthRootNameType = (typeof EARTHROOT_NAME_TYPES)[number];

/* -------------------------------------------------------------------------
 * TEMPORAL VALIDITY
 *
 * Deliberately bounded. This is not TimeRoot. Two modes only, and the honesty
 * invariant that `not_asserted` is never the same claim as "timeless".
 * Years are signed integers so BCE is representable without a calendar
 * conversion this stage refuses to perform.
 * ---------------------------------------------------------------------- */

export const EARTHROOT_TEMPORAL_MODES = ["not_asserted", "asserted"] as const;
export type EarthRootTemporalMode = (typeof EARTHROOT_TEMPORAL_MODES)[number];

export interface EarthRootTemporalValidity {
  readonly mode: EarthRootTemporalMode;
  /** Signed year; negative is BCE. Null when unbounded or not asserted. */
  readonly validFromYear: number | null;
  readonly validUntilYear: number | null;
  /** Source-native human-readable statement. Never a computed rendering. */
  readonly description: string | null;
}

export const EARTHROOT_TEMPORAL_NOT_ASSERTED: EarthRootTemporalValidity = {
  mode: "not_asserted",
  validFromYear: null,
  validUntilYear: null,
  description: null,
};

/**
 * The single sentence this stage exists to keep true. A source that asserted
 * nothing about time has not asserted timelessness, and no consumer may render
 * it as "always".
 */
export const EARTHROOT_NOT_ASSERTED_MEANING =
  "No temporal validity was asserted by a source. This is not a claim that the relationship is timeless or currently true." as const;

/* -------------------------------------------------------------------------
 * GOVERNANCE STATE
 *
 * Reused verbatim from released SourceRoot vocabularies so EarthRoot cannot
 * drift into a parallel ontology.
 * ---------------------------------------------------------------------- */

export const EARTHROOT_REVIEW_STATES = [
  "unreviewed",
  "accepted_after_review",
  "disputed",
  "rejected",
] as const;
export type EarthRootReviewState = (typeof EARTHROOT_REVIEW_STATES)[number];

export const EARTHROOT_DISPUTE_STATES = ["not_disputed", "disputed"] as const;
export type EarthRootDisputeState = (typeof EARTHROOT_DISPUTE_STATES)[number];

export const EARTHROOT_ASSERTION_STATUSES = ["active", "withdrawn"] as const;
export type EarthRootAssertionStatus =
  (typeof EARTHROOT_ASSERTION_STATUSES)[number];

/**
 * Machine-proposed derivation is absent by design, matching the released
 * identity-assertion rule that machine-proposed identity is not accepted.
 */
export const EARTHROOT_DERIVATIONS = [
  "directly_sourced",
  "human_proposed",
] as const;
export type EarthRootDerivation = (typeof EARTHROOT_DERIVATIONS)[number];

/* -------------------------------------------------------------------------
 * PROHIBITED PAYLOAD AND EVIDENCE SURFACE
 * ---------------------------------------------------------------------- */

/**
 * Keys that must never appear anywhere in EarthRoot public data. This is a
 * 15A-scoped deferral of geometry, not a permanent ban on EarthRoot ever
 * supporting it, and it is enforced rather than documented.
 */
export const EARTHROOT_FORBIDDEN_SPATIAL_KEYS = [
  "latitude",
  "longitude",
  "lat",
  "lon",
  "lng",
  "coordinates",
  "coordinate",
  "coordinateText",
  "geometry",
  "geojson",
  "bbox",
  "boundingBox",
  "wkt",
  "point",
  "polygon",
  "centroid",
  "radius",
  "distance",
  "projection",
  "tile",
  "zoom",
  "viewport",
] as const;

/**
 * Evidence kinds that may never establish EarthRoot identity.
 *
 * DERIVED from the released list rather than retyped from it. An
 * independently maintained copy had already drifted: it restated six of the
 * released ten and silently dropped `lexical_overlap`,
 * `chunk_14a_lexical_evidence`, `embedding_similarity`, `fuzzy_match`, and
 * `model_confidence`, quietly narrowing a released prohibition for EarthRoot
 * without anyone editing the released file. Spreading the released constant
 * makes that drift impossible.
 *
 * `classification_only_match` is EarthRoot's own ADDITION, not a replacement:
 * two places sharing a classification ("walled settlement") are not the same
 * place. `coordinate_only_match` and `temporal_overlap_only` are the failure
 * modes a geographic Root is most exposed to, and `name_only_match` is the one
 * Wave 1 found already latent in released data.
 */
/**
 * The meaning published for an ASSERTED temporal validity.
 *
 * Deliberately states the TEMPORAL SEMANTIC STATE only. It does not say the
 * interval was "asserted by a source", because that is a PROVENANCE claim and
 * a contribution may be `human_proposed` while still carrying evidence.
 * Conflating the two told consumers a source had asserted an interval that no
 * source ever asserted. Derivation is published separately and independently.
 */
export const EARTHROOT_ASSERTED_MEANING =
  "Temporal validity is asserted for this assertion. See the provenance summary for how that assertion was derived." as const;

/**
 * Language tag shape. A conservative BCP-47 subset: EarthRoot records the tag a
 * source used, it does not resolve, normalise, or interpret language. This is
 * not a language registry and 15A does not implement one.
 */
export const EARTHROOT_LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

/** ISO 15924 script code shape: one uppercase letter followed by three lowercase. */
export const EARTHROOT_SCRIPT_PATTERN = /^[A-Z][a-z]{3}$/u;

export const EARTHROOT_REJECTED_IDENTITY_SIGNALS = [
  ...REJECTED_IDENTITY_EVIDENCE_KINDS,
  "classification_only_match",
] as const;

/** EarthRoot asserts no conclusion on a caller's behalf, ever. */
export const EARTHROOT_SEMANTIC_CONCLUSION = null;
