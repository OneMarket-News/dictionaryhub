/**
 * SourceRoot identity assertions - contract-level vocabulary and boundaries.
 *
 * THREE CONCEPTUAL LAYERS, KEPT SEPARATE:
 *
 *   LAYER 1  ROOT-OWNED RESOURCE
 *            A resource belongs to exactly one Root. It is never silently
 *            merged, rewritten, deduplicated, or reassigned by another Root.
 *
 *   LAYER 2  IDENTITY ASSERTION
 *            An explicit, evidence-backed assertion connecting two separate
 *            Root-owned resources. It remains an assertion. It is
 *            non-transitive, not automatically symmetric, and withdrawable
 *            without deleting historical provenance.
 *
 *   LAYER 3  GOVERNED SHARED IDENTITY
 *            Future governance grammar only. It is NOT an automatically
 *            derived transitive cluster. Nothing in this stage persists,
 *            creates, infers, or exposes a production governed shared
 *            identity.
 *
 * DATABASE BOUNDARY: migration 019 is IDENTITY-ASSERTION-COMPATIBLE. It is not
 * a complete persisted identity governance system. Its `predicate` column is
 * unconstrained TEXT and it has no identity relationship family, so
 * database-level predicate control is NOT yet implemented. Migration 019 is
 * not modified by this stage.
 */

import {
  checkAddressFormatVersion,
  checkDatasetVersion,
  formatSourceRootAddress,
  SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS,
  type SourceRootAddress,
} from "./addressing.js";
import {
  TEMPORAL_SCOPE_NOT_ASSERTED,
  validateTemporalScope,
  type SourceRootTemporalScope,
} from "./query-vocabulary.js";

/* -------------------------------------------------------------------------
 * Vocabulary
 * ---------------------------------------------------------------------- */

export const SOURCEROOT_IDENTITY_PREDICATES = [
  "asserted_same_as",
  "possible_same_as",
  "distinct_from",
  "related_but_distinct",
] as const;

export type SourceRootIdentityPredicate =
  (typeof SOURCEROOT_IDENTITY_PREDICATES)[number];

export const SOURCEROOT_IDENTITY_DERIVATIONS = [
  "directly_sourced",
  "human_proposed",
] as const;

export type SourceRootIdentityDerivation =
  (typeof SOURCEROOT_IDENTITY_DERIVATIONS)[number];

export const SOURCEROOT_IDENTITY_REVIEW_STATES = [
  "unreviewed",
  "accepted_after_review",
  "disputed",
  "rejected",
] as const;

export type SourceRootIdentityReviewState =
  (typeof SOURCEROOT_IDENTITY_REVIEW_STATES)[number];

export const SOURCEROOT_IDENTITY_CERTAINTIES = [
  "asserted_by_source",
  "uncertain",
  "contested",
] as const;

export type SourceRootIdentityCertainty =
  (typeof SOURCEROOT_IDENTITY_CERTAINTIES)[number];

export const SOURCEROOT_IDENTITY_DISPUTE_STATES = [
  "not_disputed",
  "disputed",
] as const;

export type SourceRootIdentityDisputeState =
  (typeof SOURCEROOT_IDENTITY_DISPUTE_STATES)[number];

export const SOURCEROOT_IDENTITY_STATUSES = ["active", "withdrawn"] as const;

export type SourceRootIdentityStatus =
  (typeof SOURCEROOT_IDENTITY_STATUSES)[number];

/**
 * Symmetry is never assumed. An assertion is asymmetric unless it explicitly
 * declares symmetry.
 */
export const SOURCEROOT_IDENTITY_SYMMETRIES = [
  "asymmetric",
  "explicitly_symmetric",
] as const;

export type SourceRootIdentitySymmetry =
  (typeof SOURCEROOT_IDENTITY_SYMMETRIES)[number];

/**
 * Transitivity is a constant, not a setting. There is no value of this
 * contract under which identity assertions compose.
 */
export const SOURCEROOT_IDENTITY_TRANSITIVITY = "non_transitive" as const;

/* -------------------------------------------------------------------------
 * Evidence
 * ---------------------------------------------------------------------- */

/**
 * Evidence kinds that MAY support an identity assertion. Every one of them is
 * an explicit human- or source-originated statement.
 */
export const ACCEPTED_IDENTITY_EVIDENCE_KINDS = [
  "explicit_source_statement",
  "governed_editorial_decision",
  "released_dataset_cross_reference",
  "human_reviewed_documentary_evidence",
] as const;

export type AcceptedIdentityEvidenceKind =
  (typeof ACCEPTED_IDENTITY_EVIDENCE_KINDS)[number];

/**
 * Evidence kinds that MUST NEVER establish an identity assertion.
 *
 * These are the load-bearing rejection boundaries of the whole contract. They
 * are the difference between a source-backed knowledge platform and automatic
 * entity resolution. Do not weaken this list.
 */
export const REJECTED_IDENTITY_EVIDENCE_KINDS = [
  "name_only_match",
  "alias_only_match",
  "lexical_overlap",
  "chunk_14a_lexical_evidence",
  "coordinate_only_match",
  "temporal_overlap_only",
  "embedding_similarity",
  "fuzzy_match",
  "model_confidence",
  "transitive_closure",
] as const;

export type RejectedIdentityEvidenceKind =
  (typeof REJECTED_IDENTITY_EVIDENCE_KINDS)[number];

export interface SourceRootIdentityEvidence {
  readonly evidenceId: string;
  readonly kind: AcceptedIdentityEvidenceKind | RejectedIdentityEvidenceKind;
  /** Verbatim statement from the source or the reviewing human. */
  readonly statement: string;
  readonly sourceDatasetId: string;
  readonly sourceDatasetVersion: string;
  /** Citation or locator a reviewer can follow back to the source. */
  readonly sourceLocator: string;
}

/**
 * Every field of identity evidence that must be present AND meaningful.
 *
 * An independent audit proved that evidence could carry an accepted kind while
 * `evidenceId`, `sourceDatasetId`, and `sourceDatasetVersion` were blank, and
 * still yield an identity counterpart. Evidence that cannot be traced back to
 * a specific record in a specific released dataset version is not evidence; it
 * is an unfalsifiable claim. Presence is not enough: each field must survive
 * trimming.
 */
export const REQUIRED_IDENTITY_EVIDENCE_FIELDS = [
  "evidenceId",
  "kind",
  "statement",
  "sourceDatasetId",
  "sourceDatasetVersion",
  "sourceLocator",
] as const;

export type RequiredIdentityEvidenceField =
  (typeof REQUIRED_IDENTITY_EVIDENCE_FIELDS)[number];

interface EvidenceFieldProblem {
  readonly rule: string;
  readonly message: string;
}

/**
 * Validates one required non-empty string field of an evidence entry.
 * Rejects missing, non-string, and whitespace-only values alike.
 */
function checkRequiredEvidenceText(
  evidence: SourceRootIdentityEvidence,
  field: RequiredIdentityEvidenceField,
  label: string,
): EvidenceFieldProblem | null {
  const value = (evidence as unknown as Record<string, unknown>)[field];
  const evidenceLabel =
    typeof evidence.evidenceId === "string" && evidence.evidenceId.trim()
      ? evidence.evidenceId
      : "(unidentified evidence)";

  if (value === undefined || value === null) {
    return {
      rule: `evidence-${label}-required`,
      message: `Evidence ${evidenceLabel} is missing ${field}.`,
    };
  }
  if (typeof value !== "string") {
    return {
      rule: `evidence-${label}-required`,
      message: `Evidence ${evidenceLabel} has a non-string ${field}.`,
    };
  }
  if (value.trim().length === 0) {
    return {
      rule: `evidence-${label}-required`,
      message: `Evidence ${evidenceLabel} has an empty ${field}. Identity evidence must be traceable.`,
    };
  }
  return null;
}

export function isRejectedIdentityEvidenceKind(
  kind: string,
): kind is RejectedIdentityEvidenceKind {
  return (REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind);
}

export function isAcceptedIdentityEvidenceKind(
  kind: string,
): kind is AcceptedIdentityEvidenceKind {
  return (ACCEPTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind);
}

/* -------------------------------------------------------------------------
 * Assertion
 * ---------------------------------------------------------------------- */

export interface SourceRootIdentityAssertion {
  readonly assertionId: string;
  readonly addressFormatVersion: string;
  /** Subject and object stay separate Root-owned resources, always. */
  readonly subject: SourceRootAddress;
  readonly object: SourceRootAddress;
  readonly predicate: SourceRootIdentityPredicate;
  readonly evidence: readonly SourceRootIdentityEvidence[];
  readonly derivation: SourceRootIdentityDerivation;
  readonly reviewState: SourceRootIdentityReviewState;
  readonly certainty: SourceRootIdentityCertainty;
  readonly disputeState: SourceRootIdentityDisputeState;
  readonly temporalScope: SourceRootTemporalScope;
  readonly symmetry: SourceRootIdentitySymmetry;
  readonly transitivity: typeof SOURCEROOT_IDENTITY_TRANSITIVITY;
  readonly status: SourceRootIdentityStatus;
  /**
   * Withdrawal reason. Withdrawing sets `status` to "withdrawn" and never
   * deletes the assertion or its historical provenance.
   */
  readonly withdrawnReason: string | null;
}

export interface IdentityAssertionViolation {
  readonly rule: string;
  readonly message: string;
}

/**
 * Validates an identity assertion against every contract-level boundary.
 *
 * Returns violations rather than throwing so that review surfaces can show a
 * reviewer everything that is wrong at once.
 */
export function validateIdentityAssertion(
  assertion: SourceRootIdentityAssertion,
): readonly IdentityAssertionViolation[] {
  const violations: IdentityAssertionViolation[] = [];

  if (!assertion || typeof assertion !== "object") {
    return [
      {
        rule: "assertion-required",
        message: "An identity assertion object is required.",
      },
    ];
  }

  if (
    typeof assertion.assertionId !== "string" ||
    assertion.assertionId.trim().length === 0
  ) {
    violations.push({
      rule: "assertion-id-required",
      message: "An identity assertion must carry a non-empty assertionId.",
    });
  }

  if (!Array.isArray(assertion.evidence)) {
    violations.push({
      rule: "evidence-shape",
      message: "evidence must be an array.",
    });
  }

  // The assertion must state which address format its subject and object
  // addresses use, and it must be one this build supports. The supported set
  // lives in addressing.ts and is never duplicated as a literal here.
  const addressVersionProblem = checkAddressFormatVersion(
    assertion.addressFormatVersion,
  );
  if (addressVersionProblem !== null) {
    violations.push({
      rule: `address-format-version-${addressVersionProblem}`,
      message:
        addressVersionProblem === "unsupported"
          ? `addressFormatVersion "${String(assertion.addressFormatVersion)}" is not supported by this contract build. Supported: ${SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS.join(", ")}.`
          : `addressFormatVersion is ${addressVersionProblem}. It must be an explicit, supported address format version and is never coerced.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_PREDICATES as readonly string[]).includes(
      assertion.predicate,
    )
  ) {
    violations.push({
      rule: "predicate-vocabulary",
      message: `${String(assertion.predicate)} is not a defined SourceRoot identity predicate.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_DERIVATIONS as readonly string[]).includes(
      assertion.derivation,
    )
  ) {
    violations.push({
      rule: "derivation-must-be-explicit",
      message:
        "Identity assertions must be directly sourced or human proposed. Machine-proposed identity is not accepted.",
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_REVIEW_STATES as readonly string[]).includes(
      assertion.reviewState,
    )
  ) {
    violations.push({
      rule: "review-state-vocabulary",
      message: `${String(assertion.reviewState)} is not a defined identity review state.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_CERTAINTIES as readonly string[]).includes(
      assertion.certainty,
    )
  ) {
    violations.push({
      rule: "certainty-vocabulary",
      message: `${String(assertion.certainty)} is not a defined identity certainty.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_DISPUTE_STATES as readonly string[]).includes(
      assertion.disputeState,
    )
  ) {
    violations.push({
      rule: "dispute-state-vocabulary",
      message: `${String(assertion.disputeState)} is not a defined identity dispute state.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_STATUSES as readonly string[]).includes(
      assertion.status,
    )
  ) {
    violations.push({
      rule: "status-vocabulary",
      message: `${String(assertion.status)} is not a defined identity assertion status.`,
    });
  }

  if (
    !(SOURCEROOT_IDENTITY_SYMMETRIES as readonly string[]).includes(
      assertion.symmetry,
    )
  ) {
    violations.push({
      rule: "symmetry-vocabulary",
      message: `${String(assertion.symmetry)} is not a defined identity symmetry. Symmetry is never assumed.`,
    });
  }

  for (const scopeViolation of validateTemporalScope(assertion.temporalScope)) {
    violations.push({
      rule: `temporal-scope:${scopeViolation.rule}`,
      message: scopeViolation.message,
    });
  }

  if (
    assertion.reviewState === "disputed" &&
    assertion.disputeState !== "disputed"
  ) {
    violations.push({
      rule: "dispute-state-coherent",
      message:
        "An assertion under a disputed review state must also record a disputed dispute state.",
    });
  }

  if (assertion.transitivity !== SOURCEROOT_IDENTITY_TRANSITIVITY) {
    violations.push({
      rule: "non-transitivity-is-invariant",
      message: "Identity assertions are always non-transitive.",
    });
  }

  if (!Array.isArray(assertion.evidence) || assertion.evidence.length === 0) {
    violations.push({
      rule: "evidence-required",
      message:
        "An identity assertion requires at least one item of explicit evidence.",
    });
  }

  for (const evidence of Array.isArray(assertion.evidence)
    ? assertion.evidence
    : []) {
    if (!evidence || typeof evidence !== "object") {
      violations.push({
        rule: "evidence-shape",
        message: "Every evidence entry must be an object.",
      });
      continue;
    }
    if (isRejectedIdentityEvidenceKind(evidence.kind)) {
      violations.push({
        rule: "rejected-evidence-kind",
        message: `Evidence kind "${evidence.kind}" can never establish an identity assertion.`,
      });
      continue;
    }
    if (!isAcceptedIdentityEvidenceKind(evidence.kind)) {
      violations.push({
        rule: "unknown-evidence-kind",
        message: `Evidence kind "${String(evidence.kind)}" is not accepted by this contract version.`,
      });
      continue;
    }
    // Every required provenance field must be present AND meaningful.
    for (const [field, label] of [
      ["evidenceId", "id"],
      ["statement", "statement"],
      ["sourceLocator", "locator"],
      ["sourceDatasetId", "dataset-id"],
      ["sourceDatasetVersion", "dataset-version"],
    ] as const) {
      const problem = checkRequiredEvidenceText(evidence, field, label);
      if (problem) violations.push(problem);
    }

    // The dataset version must additionally satisfy the same SourceRoot
    // contract v1 rule the address format applies, so evidence points at a
    // dataset version that could actually be resolved.
    const versionProblem = checkDatasetVersion(evidence.sourceDatasetVersion);
    if (versionProblem === "malformed") {
      violations.push({
        rule: "evidence-dataset-version-malformed",
        message: `Evidence ${evidence.evidenceId} has a sourceDatasetVersion that is not a SemVer-compatible dataset version.`,
      });
    }
  }

  let subjectAddress = "";
  let objectAddress = "";
  try {
    subjectAddress = formatSourceRootAddress(assertion.subject);
    objectAddress = formatSourceRootAddress(assertion.object);
  } catch (error) {
    violations.push({
      rule: "address-valid",
      message: `Subject and object must be valid SourceRoot addresses: ${(error as Error).message}`,
    });
  }

  if (subjectAddress && subjectAddress === objectAddress) {
    violations.push({
      rule: "no-self-assertion",
      message:
        "An identity assertion must connect two distinct Root-owned resources.",
    });
  }

  if (
    assertion.status === "withdrawn" &&
    (assertion.withdrawnReason ?? "").trim().length === 0
  ) {
    violations.push({
      rule: "withdrawal-reason-required",
      message:
        "A withdrawn assertion must record why, so historical provenance stays inspectable.",
    });
  }

  return violations;
}

export function isValidIdentityAssertion(
  assertion: SourceRootIdentityAssertion,
): boolean {
  return validateIdentityAssertion(assertion).length === 0;
}

/**
 * Withdraws an assertion without deleting it or its provenance.
 */
export function withdrawIdentityAssertion(
  assertion: SourceRootIdentityAssertion,
  reason: string,
): SourceRootIdentityAssertion {
  if (reason.trim().length === 0) {
    throw new Error("A withdrawal reason is required.");
  }
  return { ...assertion, status: "withdrawn", withdrawnReason: reason };
}

/* -------------------------------------------------------------------------
 * Traversal - ONE HOP, REVIEWED IDENTITY ONLY
 *
 * An independent audit proved that an earlier version of this traversal
 * trusted merely shape-compatible caller objects: assertions carrying
 * name_only_match evidence, unreviewed assertions, possible_same_as, and
 * evidence-free assertions could all yield an identity counterpart even though
 * `validateIdentityAssertion` would have rejected them. Traversal now
 * re-validates every assertion itself and never trusts the caller.
 *
 * POLICY: `directIdentityCounterparts` represents REVIEWED DIRECT IDENTITY,
 * not candidate identity. A `possible_same_as` assertion remains a legitimate
 * assertion and may later be surfaced through a separate candidate/relation
 * API, but it is not an identity counterpart.
 * ---------------------------------------------------------------------- */

/** Only an explicit same-as claim can yield an identity counterpart. */
export const IDENTITY_COUNTERPART_ELIGIBLE_PREDICATES = [
  "asserted_same_as",
] as const;

/** Only a human-reviewed acceptance can yield an identity counterpart. */
export const IDENTITY_COUNTERPART_ELIGIBLE_REVIEW_STATES = [
  "accepted_after_review",
] as const;

/** Only a live assertion can yield an identity counterpart. */
export const IDENTITY_COUNTERPART_ELIGIBLE_STATUSES = ["active"] as const;

/** Only an undisputed assertion can yield an identity counterpart. */
export const IDENTITY_COUNTERPART_ELIGIBLE_DISPUTE_STATES = [
  "not_disputed",
] as const;

export interface IdentityCounterpartEligibility {
  readonly eligible: boolean;
  /** Every reason the assertion was refused, for reviewer-facing surfaces. */
  readonly reasons: readonly string[];
}

/**
 * Decides whether an assertion may contribute an identity counterpart.
 *
 * This runs the complete assertion validator first, then applies the narrow
 * traversal eligibility policy on top. Both layers must pass.
 */
export function evaluateIdentityCounterpartEligibility(
  assertion: SourceRootIdentityAssertion,
): IdentityCounterpartEligibility {
  const reasons: string[] = [];

  const validationViolations = validateIdentityAssertion(assertion);
  for (const violation of validationViolations) {
    reasons.push(`invalid-assertion:${violation.rule}`);
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons };
  }

  if (
    !(IDENTITY_COUNTERPART_ELIGIBLE_PREDICATES as readonly string[]).includes(
      assertion.predicate,
    )
  ) {
    reasons.push(
      `predicate-not-eligible:${assertion.predicate} is an assertion, not reviewed direct identity`,
    );
  }

  if (
    !(IDENTITY_COUNTERPART_ELIGIBLE_REVIEW_STATES as readonly string[]).includes(
      assertion.reviewState,
    )
  ) {
    reasons.push(`review-state-not-eligible:${assertion.reviewState}`);
  }

  if (
    !(IDENTITY_COUNTERPART_ELIGIBLE_STATUSES as readonly string[]).includes(
      assertion.status,
    )
  ) {
    reasons.push(`status-not-eligible:${assertion.status}`);
  }

  if (
    !(
      IDENTITY_COUNTERPART_ELIGIBLE_DISPUTE_STATES as readonly string[]
    ).includes(assertion.disputeState)
  ) {
    reasons.push(`dispute-state-not-eligible:${assertion.disputeState}`);
  }

  if (assertion.evidence.length === 0) {
    reasons.push("evidence-required");
  }

  for (const evidence of assertion.evidence) {
    if (!isAcceptedIdentityEvidenceKind(evidence.kind)) {
      reasons.push(`evidence-kind-not-eligible:${String(evidence.kind)}`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

function counterpartOf(
  assertion: SourceRootIdentityAssertion,
  address: string,
): SourceRootAddress | null {
  const subject = formatSourceRootAddress(assertion.subject);
  const object = formatSourceRootAddress(assertion.object);
  if (subject === address) return assertion.object;
  if (object === address && assertion.symmetry === "explicitly_symmetric") {
    return assertion.subject;
  }
  return null;
}

/**
 * Returns the DIRECT, REVIEWED counterparts of an address: exactly one hop,
 * never more.
 *
 * If A is asserted the same as B and B is asserted the same as C, this returns
 * B for A. It does NOT return C. There is no transitive closure anywhere in
 * this contract, and no function in this module composes assertions: the
 * returned addresses are never fed back in.
 *
 * Reverse traversal happens only across assertions that explicitly declare
 * symmetry; symmetry is never assumed.
 */
export function directIdentityCounterparts(
  address: SourceRootAddress,
  assertions: readonly SourceRootIdentityAssertion[],
): readonly SourceRootAddress[] {
  const target = formatSourceRootAddress(address);
  const counterparts: SourceRootAddress[] = [];
  const seen = new Set<string>();

  for (const assertion of Array.isArray(assertions) ? assertions : []) {
    if (!evaluateIdentityCounterpartEligibility(assertion).eligible) {
      continue;
    }

    const counterpart = counterpartOf(assertion, target);
    if (!counterpart) continue;

    const serialized = formatSourceRootAddress(counterpart);
    if (serialized === target || seen.has(serialized)) continue;
    seen.add(serialized);
    counterparts.push(counterpart);
  }

  return counterparts;
}

/**
 * Explains, per assertion, why it did or did not yield a counterpart. Exists
 * so review surfaces can show a human the refusal reasons instead of silently
 * dropping assertions.
 */
export function explainIdentityCounterparts(
  address: SourceRootAddress,
  assertions: readonly SourceRootIdentityAssertion[],
): readonly {
  readonly assertionId: string;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly counterpart: string | null;
}[] {
  const target = formatSourceRootAddress(address);
  return (Array.isArray(assertions) ? assertions : []).map((assertion) => {
    const eligibility = evaluateIdentityCounterpartEligibility(assertion);
    let counterpart: string | null = null;
    if (eligibility.eligible) {
      const found = counterpartOf(assertion, target);
      counterpart = found ? formatSourceRootAddress(found) : null;
    }
    return {
      assertionId:
        typeof assertion?.assertionId === "string" ? assertion.assertionId : "",
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      counterpart,
    };
  });
}

/* -------------------------------------------------------------------------
 * LAYER 3 - governed shared identity boundary
 * ---------------------------------------------------------------------- */

export const GOVERNED_SHARED_IDENTITY_STATE =
  "provisional-contract-shape-only" as const;

/**
 * Provisional shape only. Nothing in this stage constructs one.
 *
 * A governed shared identity must eventually be an explicit, versioned,
 * human-governed, reversible object whose membership is itself explicitly
 * reviewed. Accepted A-B and B-C assertions must NEVER automatically create
 * A-C membership.
 */
export interface ProvisionalGovernedSharedIdentity {
  readonly sharedIdentityId: string;
  readonly version: string;
  /** Every member is admitted by an explicit, individually reviewed decision. */
  readonly members: readonly {
    readonly address: SourceRootAddress;
    readonly admittedByReviewDecisionId: string;
    readonly reviewedBy: string;
    readonly reviewedAt: string;
  }[];
  readonly reversible: true;
  readonly derivedAutomatically: false;
  readonly membershipRule: "explicitly-reviewed-per-member";
}

export class GovernedSharedIdentityNotImplementedError extends Error {
  public readonly code = "governed-shared-identity-not-implemented";
  constructor() {
    super(
      "Governed shared identity is future governance grammar. SourceRoot contract v1 defines its shape but never persists, creates, infers, or exposes a production governed shared identity.",
    );
    this.name = "GovernedSharedIdentityNotImplementedError";
  }
}

/**
 * Present so any accidental dependency on Layer 3 fails loudly.
 */
export function createGovernedSharedIdentity(): never {
  throw new GovernedSharedIdentityNotImplementedError();
}

/**
 * Always returns null, for every input.
 *
 * Identity assertions never aggregate themselves into a governed shared
 * identity. Membership requires an explicit human review decision that this
 * contract version does not implement.
 */
export function resolveGovernedSharedIdentity(
  _address: SourceRootAddress,
  _assertions: readonly SourceRootIdentityAssertion[],
): null {
  return null;
}

export function describeIdentityAssertionContract() {
  return {
    predicates: SOURCEROOT_IDENTITY_PREDICATES,
    derivations: SOURCEROOT_IDENTITY_DERIVATIONS,
    reviewStates: SOURCEROOT_IDENTITY_REVIEW_STATES,
    certainties: SOURCEROOT_IDENTITY_CERTAINTIES,
    disputeStates: SOURCEROOT_IDENTITY_DISPUTE_STATES,
    statuses: SOURCEROOT_IDENTITY_STATUSES,
    symmetries: SOURCEROOT_IDENTITY_SYMMETRIES,
    transitivity: SOURCEROOT_IDENTITY_TRANSITIVITY,
    acceptedEvidenceKinds: ACCEPTED_IDENTITY_EVIDENCE_KINDS,
    rejectedEvidenceKinds: REJECTED_IDENTITY_EVIDENCE_KINDS,
    defaultTemporalScope: TEMPORAL_SCOPE_NOT_ASSERTED,
    counterpartTraversal: {
      represents: "reviewed direct identity",
      eligiblePredicates: IDENTITY_COUNTERPART_ELIGIBLE_PREDICATES,
      eligibleReviewStates: IDENTITY_COUNTERPART_ELIGIBLE_REVIEW_STATES,
      eligibleStatuses: IDENTITY_COUNTERPART_ELIGIBLE_STATUSES,
      eligibleDisputeStates: IDENTITY_COUNTERPART_ELIGIBLE_DISPUTE_STATES,
      revalidatesEveryAssertion: true,
      trustsCallerShape: false,
      maximumHops: 1,
      requiredEvidenceFields: REQUIRED_IDENTITY_EVIDENCE_FIELDS,
      evidenceTraceabilityRule:
        "Every required evidence field must be present and non-empty after trimming, and sourceDatasetVersion must satisfy the SourceRoot contract v1 dataset-version rule. Evidence that cannot be traced to a specific record in a specific released dataset version is not evidence.",
      supportedAddressFormatVersions:
        SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS,
      note: "possible_same_as, distinct_from, and related_but_distinct remain assertions and may later be surfaced through a separate candidate or relation API. None of them is an identity counterpart.",
    },
    creationValidation:
      "Identity assertion creation fails closed on unknown values in every closed vocabulary. This is separate from forward-compatible rendering of unknown response vocabulary, which preserves rather than rejects.",
    rootOwnership:
      "A resource belongs to exactly one Root and is never merged, rewritten, deduplicated, or reassigned by another Root.",
    assertionSemantics:
      "An accepted identity assertion connects two resources. It does not merge them, does not compose with other assertions, and can be withdrawn without deleting historical provenance.",
    governedSharedIdentity: {
      state: GOVERNED_SHARED_IDENTITY_STATE,
      persisted: false,
      inferred: false,
      exposed: false,
      automaticTransitiveMembership: false,
      note: "Accepted A-B and B-C assertions never automatically create A-C membership.",
    },
    databaseBoundary: {
      migration019: "identity-assertion-compatible",
      persistedIdentityGovernanceSystem: false,
      predicateColumnConstrained: false,
      identitySelfGuardPresent: true,
      note: "Migration 019 has an unconstrained predicate TEXT column and no identity relationship family. Its ck_cross_root_relationship_identity_self_guard constraint only prevents a same_as-family predicate from pointing a resource at itself; it does not constrain the predicate vocabulary. Database-level predicate control is NOT yet implemented and migration 019 is not modified by this stage.",
    },
    semanticConclusion: null,
  } as const;
}
