/**
 * EarthRoot domain model and validation (Chunk 15A).
 *
 * Every canonical EarthRoot truth passes through here. Validation FAILS CLOSED:
 * nothing is defaulted, inferred, repaired, or coerced. An assertion that
 * cannot prove its own shape does not become canonical.
 */

import { randomUUID } from "node:crypto";

import {
  EARTHROOT_ASSERTION_STATUSES,
  EARTHROOT_DERIVATIONS,
  EARTHROOT_DISPUTE_STATES,
  EARTHROOT_ENTITY_TYPES,
  EARTHROOT_FORBIDDEN_SPATIAL_KEYS,
  EARTHROOT_LANGUAGE_TAG_PATTERN,
  EARTHROOT_NAME_TYPES,
  EARTHROOT_SCRIPT_PATTERN,
  EARTHROOT_REVIEW_STATES,
  EARTHROOT_TEMPORAL_MODES,
  EARTHROOT_TEMPORAL_NOT_ASSERTED,
  earthRootPredicateRule,
  type EarthRootAssertionStatus,
  type EarthRootDerivation,
  type EarthRootDisputeState,
  type EarthRootEntityType,
  type EarthRootNameType,
  type EarthRootPredicate,
  type EarthRootReviewState,
  type EarthRootTemporalValidity,
} from "./contract.js";

export interface EarthRootViolation {
  readonly rule: string;
  readonly message: string;
}

/* -------------------------------------------------------------------------
 * CANONICAL PUBLIC ID
 *
 * Opaque, Root-issued, immutable once minted, and independent of name,
 * classification, polity, language, source locator, coordinates, and dataset
 * version. THE SAME EarthRoot entity carries the SAME canonicalPublicId across
 * dataset versions; only the dataset-qualified address changes.
 *
 * UUID v4 via node:crypto, which the repository already depends on. No new
 * dependency is introduced. The character set is a strict subset of the
 * released address unreserved set, so no percent-encoding ever occurs.
 * ---------------------------------------------------------------------- */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function mintEarthRootCanonicalPublicId(): string {
  return randomUUID();
}

export function isEarthRootCanonicalPublicId(value: unknown): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/* -------------------------------------------------------------------------
 * SHAPES
 * ---------------------------------------------------------------------- */

export interface EarthRootResource {
  readonly resourceId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly entityType: EarthRootEntityType;
  readonly canonicalPublicId: string;
}

export interface EarthRootEvidence {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceLocator: string;
  readonly statement: string;
  readonly sourceDatasetId: string;
  readonly sourceDatasetVersion: string;
  readonly evidenceOrder: number;
}

export interface EarthRootAssertion {
  readonly assertionId: string;
  readonly datasetId: string;
  readonly subjectResourceId: string;
  readonly predicate: EarthRootPredicate;
  readonly objectResourceId: string | null;
  readonly objectLiteral: string | null;
  /** Present only for named_as. */
  readonly nameType: EarthRootNameType | null;
  readonly languageTag: string | null;
  readonly script: string | null;
  readonly temporal: EarthRootTemporalValidity;
  readonly certainty: string;
  readonly uncertaintyStatement: string | null;
  readonly reviewState: EarthRootReviewState;
  readonly disputeState: EarthRootDisputeState;
  readonly assertionStatus: EarthRootAssertionStatus;
  readonly derivation: EarthRootDerivation;
  readonly evidence: readonly EarthRootEvidence[];
}

/* -------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isMeaningfulText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSignedYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** Rejects a spatial key anywhere in an arbitrary structure, at any depth. */
export function findForbiddenSpatialKey(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findForbiddenSpatialKey(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    for (const forbidden of EARTHROOT_FORBIDDEN_SPATIAL_KEYS) {
      if (lowered === forbidden.toLowerCase()) return key;
    }
    const found = findForbiddenSpatialKey(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/* -------------------------------------------------------------------------
 * RESOURCE VALIDATION
 * ---------------------------------------------------------------------- */

export function validateEarthRootResource(
  resource: unknown,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rule, message });

  if (!isPlainObject(resource)) {
    return [{ rule: "resource-shape", message: "Resource must be a plain object." }];
  }

  if (!isMeaningfulText(resource.resourceId)) {
    fail("resource-id-required", "resourceId must be a non-empty string.");
  }
  if (!isMeaningfulText(resource.datasetId)) {
    fail("dataset-id-required", "datasetId must be a non-empty string.");
  }
  if (!isMeaningfulText(resource.datasetVersion)) {
    fail("dataset-version-required", "datasetVersion must be a non-empty string.");
  }
  if (
    typeof resource.entityType !== "string" ||
    !EARTHROOT_ENTITY_TYPES.includes(resource.entityType as EarthRootEntityType)
  ) {
    fail(
      "entity-type-vocabulary",
      `entityType must be one of ${EARTHROOT_ENTITY_TYPES.join(", ")}.`,
    );
  }
  if (!isEarthRootCanonicalPublicId(resource.canonicalPublicId)) {
    fail(
      "canonical-public-id-opaque",
      "canonicalPublicId must be an opaque Root-issued UUID, independent of name, classification, polity, language, and coordinates.",
    );
  }

  const spatial = findForbiddenSpatialKey(resource);
  if (spatial) {
    fail(
      "no-spatial-data",
      `Resource carries the prohibited spatial key "${spatial}". Chunk 15A supports no coordinates or geometry.`,
    );
  }

  return violations;
}

/* -------------------------------------------------------------------------
 * TEMPORAL VALIDATION
 *
 * The honesty invariant lives here: not_asserted carries no bounds and no
 * validity description, so absence can never be dressed up as a claim.
 * ---------------------------------------------------------------------- */

export function validateEarthRootTemporal(
  temporal: unknown,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rule, message });

  if (!isPlainObject(temporal)) {
    return [{ rule: "temporal-shape", message: "temporal must be a plain object." }];
  }

  const mode = temporal.mode;
  if (
    typeof mode !== "string" ||
    !EARTHROOT_TEMPORAL_MODES.includes(mode as never)
  ) {
    return [
      {
        rule: "temporal-mode-vocabulary",
        message: `temporal.mode must be one of ${EARTHROOT_TEMPORAL_MODES.join(", ")}.`,
      },
    ];
  }

  const from = temporal.validFromYear;
  const until = temporal.validUntilYear;
  const description = temporal.description;

  if (mode === "not_asserted") {
    if (from !== null || until !== null) {
      fail(
        "not-asserted-carries-no-bounds",
        "A not_asserted temporal validity must not carry year bounds. Absence of a claim is not a claim.",
      );
    }
    if (description !== null) {
      fail(
        "not-asserted-carries-no-description",
        "A not_asserted temporal validity must not carry a validity description.",
      );
    }
    return violations;
  }

  // mode === "asserted"
  if (from !== null && !isSignedYear(from)) {
    fail("valid-from-year-integer", "validFromYear must be null or a signed integer year.");
  }
  if (until !== null && !isSignedYear(until)) {
    fail("valid-until-year-integer", "validUntilYear must be null or a signed integer year.");
  }
  if (isSignedYear(from) && isSignedYear(until) && from > until) {
    fail(
      "temporal-bounds-ordered",
      `validFromYear ${from} must not be later than validUntilYear ${until}.`,
    );
  }
  if (from === null && until === null && !isMeaningfulText(description)) {
    fail(
      "asserted-requires-content",
      "An asserted temporal validity must carry at least one year bound or a meaningful description.",
    );
  }
  if (description !== null && !isMeaningfulText(description)) {
    fail(
      "temporal-description-meaningful",
      "temporal.description must be null or a meaningful string.",
    );
  }

  return violations;
}

/* -------------------------------------------------------------------------
 * EVIDENCE VALIDATION
 *
 * Every required field must survive trimming. Evidence that cannot be traced
 * to a specific record in a specific released dataset version is not evidence.
 * ---------------------------------------------------------------------- */

export function validateEarthRootEvidence(
  evidence: unknown,
  index = 0,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const at = (rule: string, message: string) =>
    violations.push({ rule, message: `evidence[${index}]: ${message}` });

  if (!isPlainObject(evidence)) {
    return [
      { rule: "evidence-shape", message: `evidence[${index}]: must be a plain object.` },
    ];
  }

  for (const field of [
    "evidenceId",
    "sourceId",
    "sourceLocator",
    "statement",
    "sourceDatasetId",
    "sourceDatasetVersion",
  ] as const) {
    if (!isMeaningfulText(evidence[field])) {
      at(
        "evidence-field-required",
        `${field} must be present, a string, and not blank or whitespace-only.`,
      );
    }
  }
  if (
    typeof evidence.evidenceOrder !== "number" ||
    !Number.isInteger(evidence.evidenceOrder) ||
    evidence.evidenceOrder < 1
  ) {
    // Must match the database CHECK (evidence_order > 0) exactly. A bundle the
    // application certifies valid must never be rejected at COMMIT instead.
    at("evidence-order-integer", "evidenceOrder must be an integer of at least 1.");
  }

  const spatial = findForbiddenSpatialKey(evidence);
  if (spatial) {
    at("no-spatial-data", `carries the prohibited spatial key "${spatial}".`);
  }

  return violations;
}

/* -------------------------------------------------------------------------
 * ASSERTION VALIDATION
 * ---------------------------------------------------------------------- */

export interface EarthRootAssertionContext {
  /** resourceId -> entityType, for typed predicate enforcement. */
  readonly resourceTypes: ReadonlyMap<string, EarthRootEntityType>;
}

export function validateEarthRootAssertion(
  assertion: unknown,
  context: EarthRootAssertionContext,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rule, message });

  if (!isPlainObject(assertion)) {
    return [{ rule: "assertion-shape", message: "Assertion must be a plain object." }];
  }

  if (!isMeaningfulText(assertion.assertionId)) {
    fail("assertion-id-required", "assertionId must be a non-empty string.");
  }
  if (!isMeaningfulText(assertion.datasetId)) {
    fail("dataset-id-required", "datasetId must be a non-empty string.");
  }

  const rule = earthRootPredicateRule(String(assertion.predicate));
  if (!rule) {
    fail(
      "predicate-governed",
      `predicate "${String(assertion.predicate)}" is not a governed EarthRoot predicate. Free-text predicates are not the public contract.`,
    );
  }

  const subjectId = assertion.subjectResourceId;
  const subjectType = isMeaningfulText(subjectId)
    ? context.resourceTypes.get(subjectId)
    : undefined;
  if (!isMeaningfulText(subjectId)) {
    fail("subject-required", "subjectResourceId must be a non-empty string.");
  } else if (!subjectType) {
    fail("subject-resolvable", `subjectResourceId "${subjectId}" does not resolve to a known EarthRoot resource.`);
  }

  if (rule && subjectType && !rule.subjectTypes.includes(subjectType)) {
    fail(
      "subject-type-permitted",
      `predicate ${rule.predicate} does not accept a ${subjectType} subject. Permitted: ${rule.subjectTypes.join(", ")}.`,
    );
  }

  if (rule) {
    if (rule.objectKind === "resource") {
      if (assertion.objectLiteral !== null) {
        fail(
          "object-kind-resource",
          `predicate ${rule.predicate} takes a resource object; objectLiteral must be null.`,
        );
      }
      const objectId = assertion.objectResourceId;
      const objectType = isMeaningfulText(objectId)
        ? context.resourceTypes.get(objectId)
        : undefined;
      if (!isMeaningfulText(objectId)) {
        fail("object-required", `predicate ${rule.predicate} requires objectResourceId.`);
      } else if (!objectType) {
        fail("object-resolvable", `objectResourceId "${objectId}" does not resolve to a known EarthRoot resource.`);
      } else if (!rule.objectTypes.includes(objectType)) {
        fail(
          "object-type-permitted",
          `predicate ${rule.predicate} does not accept a ${objectType} object. Permitted: ${rule.objectTypes.join(", ")}.`,
        );
      }
      if (isMeaningfulText(objectId) && objectId === subjectId) {
        fail("no-self-relationship", `predicate ${rule.predicate} must not relate a resource to itself.`);
      }
    } else {
      if (assertion.objectResourceId !== null) {
        fail(
          "object-kind-literal",
          `predicate ${rule.predicate} takes a literal object; objectResourceId must be null.`,
        );
      }
      if (!isMeaningfulText(assertion.objectLiteral)) {
        fail("object-literal-required", `predicate ${rule.predicate} requires a meaningful objectLiteral.`);
      }
    }

    if (rule.predicate === "named_as") {
      if (
        typeof assertion.nameType !== "string" ||
        !EARTHROOT_NAME_TYPES.includes(assertion.nameType as EarthRootNameType)
      ) {
        fail(
          "name-type-vocabulary",
          `named_as requires nameType from ${EARTHROOT_NAME_TYPES.join(", ")}.`,
        );
      }
    } else if (assertion.nameType !== null) {
      fail("name-type-only-for-names", `nameType is only meaningful for named_as.`);
    }
  }

  // Language and script are validated HERE, at the canonical boundary, not only
  // in the public payload. A canonical object must not be able to exist in a
  // state the payload will inevitably reject: that let unpublishable data
  // become canonical and made storage and publication disagree about what is
  // admissible. EarthRoot records the tag a source used; it does not resolve or
  // interpret language, and 15A implements no language registry.
  if (assertion.languageTag !== null) {
    if (
      typeof assertion.languageTag !== "string" ||
      !EARTHROOT_LANGUAGE_TAG_PATTERN.test(assertion.languageTag)
    ) {
      fail(
        "language-tag-shape",
        "languageTag must be null or a well-formed BCP-47-style tag; a blank or malformed tag is not a language.",
      );
    }
  }
  if (assertion.script !== null) {
    if (
      typeof assertion.script !== "string" ||
      !EARTHROOT_SCRIPT_PATTERN.test(assertion.script)
    ) {
      fail(
        "script-shape",
        "script must be null or an ISO 15924 code such as Latn or Hebr.",
      );
    }
  }
  // A name literal that is blank is not a name.
  if (
    assertion.predicate === "named_as" &&
    typeof assertion.objectLiteral === "string" &&
    assertion.objectLiteral.trim().length === 0
  ) {
    fail("name-literal-meaningful", "A name literal must not be blank.");
  }

  for (const [field, vocabulary] of [
    ["reviewState", EARTHROOT_REVIEW_STATES],
    ["disputeState", EARTHROOT_DISPUTE_STATES],
    ["assertionStatus", EARTHROOT_ASSERTION_STATUSES],
    ["derivation", EARTHROOT_DERIVATIONS],
  ] as const) {
    const value = assertion[field];
    if (typeof value !== "string" || !(vocabulary as readonly string[]).includes(value)) {
      fail(`${field}-vocabulary`, `${field} must be one of ${vocabulary.join(", ")}.`);
    }
  }
  if (!isMeaningfulText(assertion.certainty)) {
    fail("certainty-required", "certainty must be a non-empty string.");
  }
  if (
    assertion.uncertaintyStatement !== null &&
    !isMeaningfulText(assertion.uncertaintyStatement)
  ) {
    fail("uncertainty-meaningful", "uncertaintyStatement must be null or meaningful.");
  }
  if (
    assertion.disputeState === "disputed" &&
    !isMeaningfulText(assertion.uncertaintyStatement)
  ) {
    fail(
      "dispute-requires-statement",
      "A disputed assertion must record why it is disputed.",
    );
  }

  violations.push(...validateEarthRootTemporal(assertion.temporal));

  const evidence = assertion.evidence;
  if (!Array.isArray(evidence) || evidence.length === 0) {
    fail(
      "evidence-required",
      "A canonical EarthRoot assertion requires at least one evidence record. Unsourced geographic or political truth is not admissible.",
    );
  } else {
    evidence.forEach((entry, index) => {
      violations.push(...validateEarthRootEvidence(entry, index));
    });
  }

  const spatial = findForbiddenSpatialKey(assertion);
  if (spatial) {
    fail(
      "no-spatial-data",
      `Assertion carries the prohibited spatial key "${spatial}".`,
    );
  }

  return violations;
}

/**
 * An assertion may be treated as canonical EarthRoot truth only when it is
 * fully valid, active, and not rejected. Validity alone is not acceptance.
 */
export function isCanonicalEarthRootAssertion(
  assertion: EarthRootAssertion,
  context: EarthRootAssertionContext,
): boolean {
  return (
    validateEarthRootAssertion(assertion, context).length === 0 &&
    assertion.assertionStatus === "active" &&
    assertion.reviewState !== "rejected"
  );
}

export function buildResourceTypeIndex(
  resources: readonly EarthRootResource[],
): ReadonlyMap<string, EarthRootEntityType> {
  return new Map(resources.map((r) => [r.resourceId, r.entityType]));
}

export { EARTHROOT_TEMPORAL_NOT_ASSERTED };
