/**
 * EarthRoot SourceRoot adapter (Chunk 15A).
 *
 * Builds a released-contract SourceRootResultItem from a validated EarthRoot
 * resource. The released Chunk 14C result-item contract is consumed UNCHANGED:
 * this module imports its validator and defers to it rather than restating it.
 *
 * AVAILABILITY BOUNDARY. The existence of this adapter does NOT make EarthRoot
 * a responding Root. EarthRoot remains lifecycle "planned" with
 * networkRuntimeState "not-implemented", `place` and `polity` remain DEFINED,
 * and the released registry continues to report EarthRoot as unable to respond.
 *
 * WAVE 5 CORRECTION. Earlier revisions published derived summaries as
 * CONSTANTS rather than as functions of the underlying assertions: derivation
 * was hardcoded "directly_sourced", evidence from rejected and withdrawn
 * assertions was counted as public support, review state and certainty were
 * fixed strings, and the synthetic disclaimer was unconditional. Every summary
 * below is now computed from the SAME governed contributing set the payload
 * uses, under an explicitly least-overclaiming aggregation rule.
 */

import {
  createSourceRootAddress,
  formatSourceRootAddress,
} from "../sourceroot/addressing.js";
import {
  canRootRespond,
  getRootRegistryEntry,
} from "../sourceroot/root-registry.js";
import {
  validateResultItem,
  validateRootPayload,
  type SourceRootResultItem,
} from "../sourceroot/response-envelope.js";
import {
  EARTHROOT_ASSERTED_MEANING,
  EARTHROOT_ENTITY_TO_OBJECT_TYPE,
  EARTHROOT_NOT_ASSERTED_MEANING,
  EARTHROOT_ROOT_ID,
  type EarthRootEntityType,
} from "./contract.js";
import {
  isEarthRootCanonicalPublicId,
  validateEarthRootAssertion,
  validateEarthRootResource,
  type EarthRootAssertion,
  type EarthRootAssertionContext,
  type EarthRootEvidence,
  type EarthRootResource,
  type EarthRootViolation,
} from "./domain.js";
import {
  EARTHROOT_PAYLOAD_SCHEMA_VERSION,
  validateEarthRootPayload,
  type EarthRootPayloadClassification,
  type EarthRootPayloadName,
  type EarthRootPayloadRelationship,
  type EarthRootPayloadTemporal,
  type EarthRootPublicPayload,
} from "./payload.js";

export class EarthRootAdapterError extends Error {
  readonly violations: readonly EarthRootViolation[];
  constructor(message: string, violations: readonly EarthRootViolation[]) {
    super(message);
    this.name = "EarthRootAdapterError";
    this.violations = violations;
  }
}

/**
 * EarthRoot network availability, stated in code.
 *
 * Returns false for the whole of 15A. Only a later, explicitly governed Root
 * activation stage with a released dataset can change this, and it cannot be
 * changed from inside EarthRoot.
 */
export function isEarthRootNetworkAvailable(): boolean {
  const entry = getRootRegistryEntry(EARTHROOT_ROOT_ID);
  if (!entry) return false;
  return entry.lifecycle !== "planned" && canRootRespond(EARTHROOT_ROOT_ID) === true;
}

export interface EarthRootAdapterInput {
  readonly resource: EarthRootResource;
  readonly assertions: readonly EarthRootAssertion[];
  readonly context: EarthRootAssertionContext;
  /** resourceId -> canonicalPublicId, for relationship object references. */
  readonly canonicalPublicIds: ReadonlyMap<string, string>;
  /** resourceId -> entityType, for relationship object typing. */
  readonly entityTypes: ReadonlyMap<string, EarthRootEntityType>;
  readonly canonicalUrl?: string | null;
  /**
   * From the owning dataset row. REQUIRED, and deliberately not optional.
   *
   * 15A ships synthetic fixtures and nothing else, so an optional flag
   * defaulting to false would mean the entire corpus published with no
   * disclosure at all whenever a caller simply forgot it. Silence must not be
   * readable as "this is real", so the caller has to say which it is.
   */
  readonly fixtureOnly: boolean;
  /** resourceId -> datasetId, so a relationship object cannot be ambiguous. */
  readonly resourceDatasets: ReadonlyMap<string, string>;
}

/**
 * Bounded identity for a piece of governed evidence.
 *
 * Built only from existing governed evidence fields. Two rows are materially
 * identical support when they cite the same locator and statement from the same
 * source and the same dataset version; counting both would tell a consumer two
 * sources corroborate a claim that in truth has one. `evidenceId` is
 * deliberately excluded, because a duplicated row with a fresh key is exactly
 * the case being collapsed. `evidenceOrder` is excluded too: presentation order
 * is not support. Anything that differs in locator, statement, or dataset
 * provenance stays distinct, so legitimate multiple citations from one source
 * still count separately.
 */
function evidenceIdentity(evidence: EarthRootEvidence): string {
  return JSON.stringify([
    evidence.sourceId.trim(),
    evidence.sourceLocator.trim(),
    evidence.statement.trim(),
    evidence.sourceDatasetId.trim(),
    evidence.sourceDatasetVersion.trim(),
  ]);
}

/** Distinct governed evidence across a set of assertions, order preserved. */
export function distinctEvidence(
  contributions: readonly EarthRootAssertion[],
): readonly EarthRootEvidence[] {
  const seen = new Set<string>();
  const distinct: EarthRootEvidence[] = [];
  for (const assertion of contributions) {
    for (const evidence of assertion.evidence) {
      const identity = evidenceIdentity(evidence);
      if (seen.has(identity)) continue;
      seen.add(identity);
      distinct.push(evidence);
    }
  }
  return distinct;
}

/**
 * The single governed contributing set.
 *
 * Rejected and withdrawn assertions are repudiated material and contribute
 * NOTHING public: not a name, not a classification, not a relationship, and
 * not an evidence count or a source locator. Every summary in this module is
 * computed from this one set so the payload and the provenance can never
 * disagree about what supported the result.
 */
function governedContributions(
  input: EarthRootAdapterInput,
): readonly EarthRootAssertion[] {
  return input.assertions.filter(
    (a) =>
      a.subjectResourceId === input.resource.resourceId &&
      // Bound to the SAME dataset the item publishes. Without this an assertion
      // from another dataset could supply the evidence count and source locator
      // for a result whose address names a dataset that never contained it.
      a.datasetId === input.resource.datasetId &&
      a.assertionStatus === "active" &&
      a.reviewState !== "rejected",
  );
}

/**
 * Caller-supplied maps are reconciled against each other and against the
 * resource before anything is published. A caller cannot hand the adapter a
 * context that disagrees with the resource and have the disagreement rendered
 * as fact; the adapter fails closed instead.
 */
function reconcileInput(
  input: EarthRootAdapterInput,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rule, message });

  // An assertion naming this resource but a different dataset is a genuine
  // inconsistency, not something to quietly filter away and publish around.
  for (const assertion of input.assertions) {
    if (
      assertion.subjectResourceId === input.resource.resourceId &&
      assertion.datasetId !== input.resource.datasetId
    ) {
      fail(
        "assertion-dataset-disagreement",
        `assertion ${assertion.assertionId} is in dataset ${assertion.datasetId} but its subject resource is in ${input.resource.datasetId}.`,
      );
    }
  }

  if (typeof input.fixtureOnly !== "boolean") {
    fail(
      "fixture-disclosure-required",
      "fixtureOnly must be stated explicitly; an omitted flag would publish synthetic material as though it were real.",
    );
  }

  const declared = input.context.resourceTypes.get(input.resource.resourceId);
  if (declared === undefined) {
    fail(
      "input-resource-unknown",
      `resource ${input.resource.resourceId} is absent from the validated resource context.`,
    );
  } else if (declared !== input.resource.entityType) {
    fail(
      "input-resource-type-disagreement",
      `resource ${input.resource.resourceId} is ${input.resource.entityType} but the context says ${declared}.`,
    );
  }

  for (const [resourceId, entityType] of input.entityTypes) {
    const canonical = input.context.resourceTypes.get(resourceId);
    if (canonical === undefined) {
      fail(
        "input-entity-type-unknown",
        `entityTypes names ${resourceId}, which is absent from the validated resource context.`,
      );
    } else if (canonical !== entityType) {
      fail(
        "input-entity-type-disagreement",
        `entityTypes says ${resourceId} is ${entityType} but the context says ${canonical}.`,
      );
    }
  }

  // Every relationship object actually referenced must resolve in both maps.
  for (const assertion of governedContributions(input)) {
    const objectId = assertion.objectResourceId;
    if (!objectId) continue;
    if (!input.context.resourceTypes.has(objectId)) {
      fail(
        "relationship-object-unknown",
        `assertion ${assertion.assertionId} references unknown object ${objectId}.`,
      );
    }
    if (!input.entityTypes.has(objectId)) {
      fail(
        "relationship-object-type-missing",
        `assertion ${assertion.assertionId} object ${objectId} has no entity type; an empty class must never be published.`,
      );
    }
    if (!input.canonicalPublicIds.has(objectId)) {
      fail(
        "relationship-object-id-missing",
        `assertion ${assertion.assertionId} object ${objectId} has no canonicalPublicId.`,
      );
    } else if (!isEarthRootCanonicalPublicId(input.canonicalPublicIds.get(objectId))) {
      // The PUBLISHED object identity must be as opaque as the subject's. Only
      // the subject's canonicalPublicId was gated, so a caller map could put a
      // name ("Londonderry") or a coordinate string into objectCanonicalPublicId
      // and have it published as an entity's canonical identity.
      fail(
        "relationship-object-id-not-opaque",
        `assertion ${assertion.assertionId} object ${objectId} has a canonicalPublicId that is not an opaque Root-issued identifier; identity is never derived from a name, classification, or coordinate.`,
      );
    }
    // canonicalPublicId is unique only WITHIN a dataset, but the published
    // objectCanonicalPublicId carries no dataset qualification. An object from
    // another dataset would therefore resolve to nothing, or to a different
    // entity that legitimately reuses the same UUID.
    const objectDataset = input.resourceDatasets.get(objectId);
    if (objectDataset === undefined) {
      fail(
        "relationship-object-dataset-missing",
        `assertion ${assertion.assertionId} object ${objectId} has no known dataset.`,
      );
    } else if (objectDataset !== input.resource.datasetId) {
      fail(
        "relationship-object-dataset-disagreement",
        `assertion ${assertion.assertionId} references object ${objectId} in dataset ${objectDataset}, but this result is published in ${input.resource.datasetId}; an unqualified canonicalPublicId cannot span datasets.`,
      );
    }
    // Two distinct resources in different datasets may share a canonicalPublicId.
    // Publishing that unqualified would state that a place is contained by, or
    // governed by, itself.
    if (
      input.canonicalPublicIds.get(objectId) === input.resource.canonicalPublicId
    ) {
      fail(
        "relationship-object-is-self",
        `assertion ${assertion.assertionId} would publish ${input.resource.canonicalPublicId} as its own relationship object.`,
      );
    }
  }

  return violations;
}

function toPayloadTemporal(
  assertion: EarthRootAssertion,
): EarthRootPayloadTemporal {
  const asserted = assertion.temporal.mode === "asserted";
  return {
    mode: assertion.temporal.mode,
    validFromYear: assertion.temporal.validFromYear,
    validUntilYear: assertion.temporal.validUntilYear,
    description: assertion.temporal.description,
    meaning: asserted
      ? EARTHROOT_ASSERTED_MEANING
      : EARTHROOT_NOT_ASSERTED_MEANING,
  };
}

/**
 * Derives the display label from a sourced preferred-name assertion.
 *
 * There is no unsourced fallback string, and a DISPUTED name never becomes the
 * public identity string: a contested name silently promoted to displayLabel
 * is exactly the failure Wave 1 found already latent in released data.
 */
export function selectPreferredNames(
  assertions: readonly EarthRootAssertion[],
): readonly EarthRootAssertion[] {
  return assertions.filter(
    (a) =>
      a.predicate === "named_as" &&
      a.nameType === "preferred" &&
      a.assertionStatus === "active" &&
      a.reviewState !== "rejected" &&
      a.reviewState !== "disputed" &&
      a.disputeState !== "disputed" &&
      a.evidence.length > 0 &&
      typeof a.objectLiteral === "string" &&
      a.objectLiteral.trim().length > 0,
  );
}

/**
 * Derives the display label from THE sourced preferred name.
 *
 * Returns null when there is no usable preferred name AND when there is more
 * than one. Picking the first of several undisputed preferred names would make
 * a contested public identity depend on caller array order — "Derry" or
 * "Londonderry" according to how the array happened to be built. That is the
 * exact Wave 1 failure this Root exists to avoid, so ambiguity is surfaced
 * rather than silently resolved.
 */
export function deriveDisplayLabel(
  assertions: readonly EarthRootAssertion[],
): string | null {
  const preferred = selectPreferredNames(assertions);
  if (preferred.length !== 1) return null;
  return preferred[0]!.objectLiteral!.trim();
}

/**
 * Bounded, least-overclaiming derivation aggregation.
 *
 * Only when EVERY governed contribution is directly sourced may the result
 * claim directly_sourced. Any human-proposed contribution downgrades the whole
 * result, because a consumer cannot tell which field came from which assertion.
 * Both values are released EarthRoot derivations; no new vocabulary is coined.
 */
export function deriveAggregateDerivation(
  contributions: readonly EarthRootAssertion[],
): string {
  if (contributions.length === 0) return "human_proposed";
  return contributions.every((a) => a.derivation === "directly_sourced")
    ? "directly_sourced"
    : "human_proposed";
}

/**
 * Whether a single contribution is contested, by ANY governed signal.
 *
 * The review state and the dispute state are independent released
 * vocabularies, and only the dispute state is required to carry an uncertainty
 * statement, so an assertion may be disputed by review while its dispute state
 * still reads not_disputed. That is a perfectly valid canonical state.
 *
 * Testing the dispute state alone published a false `disputed` flag on
 * classifications and relationships: a summary boolean asserting a consensus
 * that does not exist, contradicting the review field beside it and the
 * item-level summary. Names already handled this correctly; all three now
 * agree.
 */
function isContested(assertion: EarthRootAssertion): boolean {
  return (
    assertion.disputeState === "disputed" ||
    assertion.reviewState === "disputed" ||
    assertion.nameType === "disputed"
  );
}

/**
 * Bounded, least-overclaiming review aggregation.
 *
 * Any dispute wins. Otherwise a result is accepted only if every contribution
 * was accepted after review. Anything else reports unreviewed, which is the
 * weakest claim available in the released vocabulary.
 */
export function deriveAggregateReviewState(
  contributions: readonly EarthRootAssertion[],
): string {
  if (
    contributions.some(
      (a) => a.reviewState === "disputed" || a.disputeState === "disputed",
    )
  ) {
    return "disputed";
  }
  if (
    contributions.length > 0 &&
    contributions.every((a) => a.reviewState === "accepted_after_review")
  ) {
    return "accepted_after_review";
  }
  return "unreviewed";
}

/**
 * Certainty published when contributions disagree.
 *
 * This is not a certainty any source asserted, and it does not pretend to be:
 * it names the disagreement itself, so a consumer cannot read it as a bounded
 * claim that some source actually made. Returning an invented "source-bounded"
 * here would tell a consumer a source bounded the certainty when in truth the
 * sources conflicted.
 */
export const EARTHROOT_MIXED_CERTAINTY = "mixed-certainty-not-reconciled" as const;

/**
 * Certainty published when a result has no contributing assertion at all.
 * Nothing was asserted, so nothing is claimed.
 */
export const EARTHROOT_NO_CERTAINTY = "no-certainty-asserted" as const;

/**
 * Bounded certainty aggregation. A unanimous certainty is reported verbatim;
 * anything else is reported as unreconciled rather than smoothed into a value
 * no contribution actually carried.
 */
export function deriveAggregateCertainty(
  contributions: readonly EarthRootAssertion[],
): string {
  if (contributions.length === 0) return EARTHROOT_NO_CERTAINTY;
  const distinct = new Set(contributions.map((a) => a.certainty));
  if (distinct.size === 1) {
    const [only] = [...distinct];
    return only && only.trim().length > 0 ? only : EARTHROOT_NO_CERTAINTY;
  }
  return EARTHROOT_MIXED_CERTAINTY;
}

export function buildEarthRootPayload(
  input: EarthRootAdapterInput,
): EarthRootPublicPayload {
  const usable = governedContributions(input);
  // At most one name may be flagged for display, for the same reason the label
  // itself is refused when ambiguous.
  const solePreferred =
    selectPreferredNames(usable).length === 1
      ? selectPreferredNames(usable)[0]!.assertionId
      : null;

  const names: EarthRootPayloadName[] = usable
    .filter((a) => a.predicate === "named_as")
    .map((a) => ({
      label: String(a.objectLiteral),
      nameType: String(a.nameType),
      languageTag: a.languageTag,
      script: a.script,
      preferredDisplay: a.assertionId === solePreferred,
      reviewState: a.reviewState,
      // A name whose governed TYPE is "disputed" is disputed, whatever the
      // separate dispute-state column says; otherwise the field literally named
      // `disputed` would contradict the name type beside it.
      disputed: isContested(a),
      temporal: toPayloadTemporal(a),
      evidenceCount: distinctEvidence([a]).length,
    }));

  const classifications: EarthRootPayloadClassification[] = usable
    .filter((a) => a.predicate === "classified_as")
    .map((a) => ({
      label: String(a.objectLiteral),
      reviewState: a.reviewState,
      disputed: isContested(a),
      temporal: toPayloadTemporal(a),
      evidenceCount: distinctEvidence([a]).length,
    }));

  const relationshipSummaries: EarthRootPayloadRelationship[] = usable
    .filter(
      (a) =>
        a.predicate === "located_within" ||
        a.predicate === "governed_by" ||
        a.predicate === "administered_by",
    )
    .map((a) => {
      const objectId = String(a.objectResourceId);
      return {
        predicate: a.predicate,
        objectCanonicalPublicId: input.canonicalPublicIds.get(objectId) ?? "",
        objectEntityType: input.entityTypes.get(objectId) ?? "",
        temporal: toPayloadTemporal(a),
        reviewState: a.reviewState,
        disputed: isContested(a),
        evidenceCount: distinctEvidence([a]).length,
      };
    });

  return {
    schemaVersion: EARTHROOT_PAYLOAD_SCHEMA_VERSION,
    entityType: input.resource.entityType,
    displayLabel: deriveDisplayLabel(usable) ?? "",
    names,
    classifications,
    relationshipSummaries,
  };
}

/**
 * Builds a released-contract SourceRootResultItem for an EarthRoot resource.
 *
 * Fails closed at every layer: input reconciliation, EarthRoot resource
 * validation, every contributing assertion, the EarthRoot payload allowlist,
 * and finally the released 14C result-item validator, applied unchanged.
 */
export function buildEarthRootResultItem(
  input: EarthRootAdapterInput,
): SourceRootResultItem {
  const violations: EarthRootViolation[] = [];
  violations.push(...reconcileInput(input));
  violations.push(...validateEarthRootResource(input.resource));

  const owned = input.assertions.filter(
    (a) => a.subjectResourceId === input.resource.resourceId,
  );
  for (const assertion of owned) {
    violations.push(...validateEarthRootAssertion(assertion, input.context));
  }
  if (violations.length > 0) {
    throw new EarthRootAdapterError(
      "EarthRoot input reconciliation or validation failed; no result item was constructed.",
      violations,
    );
  }

  const payload = buildEarthRootPayload(input);
  const payloadViolations = validateEarthRootPayload(payload);
  if (payloadViolations.length > 0) {
    throw new EarthRootAdapterError(
      "EarthRoot public payload failed its own allowlist contract.",
      payloadViolations,
    );
  }
  // The released denylist floor is applied too, not just the EarthRoot
  // allowlist. The response envelope runs it as a separate pass, so applying it
  // here keeps the adapter from constructing an item the envelope would reject.
  const floorViolations = validateRootPayload(payload);
  if (floorViolations.length > 0) {
    throw new EarthRootAdapterError(
      "EarthRoot public payload failed the released shared rootPayload floor.",
      floorViolations.map((v) => ({ rule: v.rule, message: v.message })),
    );
  }

  // The SAME governed set drives provenance, review, and certainty.
  const contributions = governedContributions(input);
  // Unique governed support, not array length.
  const evidenceCount = distinctEvidence(contributions).length;
  // Ordered by the governed evidenceOrder, then by assertion, so the published
  // locator is deterministic. Taking the first element of a flatMap made the
  // citation depend on caller array order rather than on the recorded order.
  // The locator is selected from EXACTLY the set that produced the count.
  // Deduplicating per-assertion here while counting across all contributions
  // meant the published locator could come from a row the count excluded — the
  // comment claimed coherence the code did not have.
  const countedEvidence = new Set(distinctEvidence(contributions));
  const orderedEvidence = contributions
    .flatMap((a) =>
      a.evidence
        .filter((e) => countedEvidence.has(e))
        .map((e) => ({ assertionId: a.assertionId, e })),
    )
    .sort(
      (x, y) =>
        x.e.evidenceOrder - y.e.evidenceOrder ||
        x.assertionId.localeCompare(y.assertionId) ||
        x.e.evidenceId.localeCompare(y.e.evidenceId),
    );
  const firstLocator = orderedEvidence[0]?.e.sourceLocator ?? null;
  const reviewState = deriveAggregateReviewState(contributions);
  // Any contribution that carries a stated uncertainty is surfaced, not only
  // formally disputed ones. Filtering on disputeState alone discarded a
  // source's own hedge while still publishing a confident certainty beside it,
  // and let a reviewState-only dispute publish `disputed: true` with no reason.
  const disputeStatements = contributions
    .filter((a) => typeof a.uncertaintyStatement === "string" && a.uncertaintyStatement.trim().length > 0)
    .map((a) => String(a.uncertaintyStatement).trim());

  // A published dispute must never be an unfalsifiable claim. Only
  // `disputeState` is required to carry a reason, so a reviewState-only dispute
  // could otherwise publish `disputed: true` with `uncertaintyStatement: null`
  // — asserting a disagreement while supplying nothing a reader could check.
  // Widening the filter above did not fix that, because such an assertion has
  // no statement to find. The absence is stated explicitly instead.
  const unexplainedDisputes = contributions.filter(
    (a) =>
      isContested(a) &&
      !(typeof a.uncertaintyStatement === "string" && a.uncertaintyStatement.trim().length > 0),
  );
  if (unexplainedDisputes.length > 0) {
    disputeStatements.push(
      "A review dispute is recorded for this result without a stated reason; the disagreement is reported, not explained.",
    );
  }

  const fixtureNote = input.fixtureOnly
    ? "This result is drawn from a synthetic EarthRoot fixture dataset and asserts no real-world geographic or political fact."
    : null;
  // The fixture disclosure and the dispute text are NOT alternatives. Treating
  // them as such dropped the synthetic disclaimer precisely when a record was
  // contested, which is when a consumer most needs to know it is not real.
  const statementParts = [
    ...(fixtureNote ? [fixtureNote] : []),
    ...new Set(disputeStatements),
  ];
  const uncertaintyStatement =
    statementParts.length > 0 ? statementParts.join(" ") : null;

  const objectType = EARTHROOT_ENTITY_TO_OBJECT_TYPE[input.resource.entityType];

  // The released address grammar is stricter than EarthRoot's own resource
  // validation: a non-SemVer datasetVersion such as "v1" passes validation and
  // persists, then throws a SourceRootAddressError out of here. That is a
  // foreign error type escaping a module that promises to fail closed with
  // EarthRootAdapterError, so a caller's instanceof guard would not catch it.
  // The released rule is not restated here; it is deferred to and translated.
  let address;
  try {
    address = createSourceRootAddress({
      rootId: EARTHROOT_ROOT_ID,
      objectType,
      canonicalPublicId: input.resource.canonicalPublicId,
      datasetId: input.resource.datasetId,
      datasetVersion: input.resource.datasetVersion,
    });
  } catch (cause) {
    throw new EarthRootAdapterError(
      "EarthRoot resource cannot be addressed under the released SourceRoot address grammar.",
      [
        {
          rule: "resource-not-addressable",
          message:
            cause instanceof Error ? cause.message : "address construction failed.",
        },
      ],
    );
  }

  // The item-level temporal summary is DERIVED from the payload it accompanies.
  //
  // The resource itself is not a time-bounded claim, so the mode stays
  // not_asserted and the released coherence rule (asserted === false) holds.
  // But the description may not then borrow the "no temporal validity was
  // asserted" sentence when the payload plainly carries asserted intervals:
  // that sentence is a claim about what was asserted, and it would be false.
  const payloadAssertsTemporal = [
    ...payload.names,
    ...payload.classifications,
    ...payload.relationshipSummaries,
  ].some((entry) => entry.temporal.mode === "asserted");

  const temporalDescription = payloadAssertsTemporal
    ? "This resource is not itself a time-bounded claim. Temporal validity, where asserted, is carried by the individual assertions in this result."
    : EARTHROOT_NOT_ASSERTED_MEANING;

  // Belt-and-braces only. Because temporalDescription is assigned by the
  // ternary directly above, this branch is currently UNREACHABLE, and it is not
  // a substitute for a test. It exists so that if the assignment above is ever
  // edited to compute the description some other way, publishing a summary that
  // denies its own payload fails closed instead of shipping. The behavioural
  // guarantee is asserted in the adapter suite, not here.
  const summaryDeniesAnyAssertion =
    temporalDescription === EARTHROOT_NOT_ASSERTED_MEANING;
  if (payloadAssertsTemporal && summaryDeniesAnyAssertion) {
    throw new EarthRootAdapterError(
      "EarthRoot item summary contradicts its own payload.",
      [
        {
          rule: "temporal-summary-contradicts-payload",
          message:
            "The payload carries asserted temporal validity while the item summary states none was asserted.",
        },
      ],
    );
  }

  const item: SourceRootResultItem = {
    address: formatSourceRootAddress(address),
    rootId: EARTHROOT_ROOT_ID,
    objectType,
    canonicalPublicId: input.resource.canonicalPublicId,
    datasetId: input.resource.datasetId,
    datasetVersion: input.resource.datasetVersion,
    canonicalUrl: input.canonicalUrl ?? null,
    provenanceSummary: {
      datasetId: input.resource.datasetId,
      datasetVersion: input.resource.datasetVersion,
      derivation: deriveAggregateDerivation(contributions),
      sourceLocator: firstLocator,
      evidenceCount,
    },
    temporalSummary: {
      mode: "not_asserted",
      asserted: false,
      description: temporalDescription,
    },
    uncertaintySummary: {
      certainty: deriveAggregateCertainty(contributions),
      uncertaintyStatement,
      disputed: reviewState === "disputed",
    },
    reviewSummary: {
      reviewState,
      reviewed: reviewState === "accepted_after_review",
    },
    rootPayload: payload as unknown as Record<string, unknown>,
    semanticConclusion: null,
  };

  const released = validateResultItem(item);
  if (released.length > 0) {
    throw new EarthRootAdapterError(
      "EarthRoot item failed the released SourceRoot result-item contract.",
      released.map((v) => ({ rule: v.rule, message: v.message })),
    );
  }

  return item;
}
