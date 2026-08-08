/**
 * The shared SourceRoot network response envelope.
 *
 * This extends the existing repository api-contract / collection-contract
 * philosophy rather than introducing a second API style: the same pagination
 * shape, the same applied-filter and applied-sort reporting, and the same
 * `semanticConclusion: null` discipline.
 *
 * PARTIAL RESULTS ARE FIRST CLASS. One Root failing must never silently
 * disappear: every requested Root that did not answer is reported with a
 * reason, and the envelope status says so.
 */

import { EXACT_TOTAL_SEMANTICS } from "../lib/api-contract.js";
import {
  checkVersionSyntax,
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
  tryParseSourceRootAddress,
} from "./addressing.js";
// The four review states are released SHARED vocabulary (migration 018
// review_status, migration 019 review_state), not an identity-only set.
import { SOURCEROOT_IDENTITY_REVIEW_STATES } from "./identity-assertions.js";
import {
  isSourceRootObjectType,
  SOURCEROOT_AVAILABILITY_STATES,
  type SourceRootAvailabilityState,
} from "./object-types.js";
import {
  checkRespondingRoot,
  checkRootContractVersion,
  checkRootId,
  SOURCEROOT_CONTRACT_VERSION,
  supportedRootContractVersion,
  type SourceRootRootId,
} from "./root-registry.js";
import type {
  PaginationQuery,
  SortDirection,
} from "../lib/query-params.js";
import {
  SOURCEROOT_MAX_PAGE_SIZE,
  SOURCEROOT_TEMPORAL_MODES,
  TEMPORAL_MODE_NOT_ASSERTED,
  type SourceRootSortField,
} from "./query-vocabulary.js";

export type SourceRootResultStatus = "ok" | "partial" | "unavailable";

export const SOURCEROOT_RESULT_STATUSES = [
  "ok",
  "partial",
  "unavailable",
] as const;

/**
 * Why a Root is not in the result. `unsupported` is not an empty result: the
 * Root never answered the question.
 */
export interface SourceRootRootUnavailability {
  readonly rootId: string;
  readonly state: Exclude<SourceRootAvailabilityState, "supported">;
  readonly reason: string;
}

export interface SourceRootProvenanceSummary {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly derivation: string;
  readonly sourceLocator: string | null;
  readonly evidenceCount: number;
}

export interface SourceRootTemporalSummary {
  readonly mode: string;
  readonly asserted: boolean;
  readonly description: string;
}

export interface SourceRootUncertaintySummary {
  readonly certainty: string;
  readonly uncertaintyStatement: string | null;
  readonly disputed: boolean;
}

export interface SourceRootReviewSummary {
  readonly reviewState: string;
  readonly reviewed: boolean;
}

/* -------------------------------------------------------------------------
 * rootPayload boundary
 * ---------------------------------------------------------------------- */

export type RootPublicContractPayload = Record<string, unknown>;

/**
 * Keys that would leak Root internals through the back door and couple future
 * network consumers (EarthRoot first among them) to another Root's
 * implementation. `rootPayload` carries ROOT-PUBLIC CONTRACT DATA only.
 */
export const ROOT_PAYLOAD_FORBIDDEN_KEYS = [
  "row",
  "rows",
  "dbRow",
  "databaseRow",
  "table",
  "tableName",
  "column",
  "columns",
  "primaryKey",
  "internalId",
  "internal",
  "sql",
  "query",
  "pool",
  "client",
  "connection",
  "passwordHash",
  "sessionToken",
  "secret",
  "credentials",
] as const;

export const ROOT_PAYLOAD_MAX_DEPTH = 4;
export const ROOT_PAYLOAD_MAX_KEYS = 32;

export interface RootPayloadViolation {
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Enforces the rootPayload boundary. Chunks 17A-17C define the actual public
 * Root adapter payloads; this stage defines only what they may not contain.
 */
export function validateRootPayload(
  payload: unknown,
  path = "rootPayload",
  depth = 1,
): readonly RootPayloadViolation[] {
  const violations: RootPayloadViolation[] = [];

  if (!isPlainObject(payload)) {
    return [
      {
        path,
        rule: "payload-must-be-plain-object",
        message:
          "rootPayload must be a plain JSON object of Root-public contract data.",
      },
    ];
  }

  if (depth > ROOT_PAYLOAD_MAX_DEPTH) {
    violations.push({
      path,
      rule: "payload-max-depth",
      message: `rootPayload nesting exceeds depth ${ROOT_PAYLOAD_MAX_DEPTH}.`,
    });
    return violations;
  }

  const keys = Object.keys(payload);
  if (keys.length > ROOT_PAYLOAD_MAX_KEYS) {
    violations.push({
      path,
      rule: "payload-max-keys",
      message: `rootPayload exceeds ${ROOT_PAYLOAD_MAX_KEYS} keys at ${path}.`,
    });
  }

  for (const key of keys) {
    const keyPath = `${path}.${key}`;

    if ((ROOT_PAYLOAD_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      violations.push({
        path: keyPath,
        rule: "forbidden-internal-key",
        message: `"${key}" exposes Root internals and is not Root-public contract data.`,
      });
    }

    if (key.startsWith("_")) {
      violations.push({
        path: keyPath,
        rule: "private-key-prefix",
        message: `"${key}" is marked private and must not cross the network contract.`,
      });
    }

    const value = payload[key];

    if (typeof value === "function") {
      violations.push({
        path: keyPath,
        rule: "payload-value-type",
        message: "rootPayload must not contain service objects or functions.",
      });
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isPlainObject(item)) {
          violations.push(
            ...validateRootPayload(item, `${keyPath}[${index}]`, depth + 1),
          );
        } else if (
          item !== null &&
          !["string", "number", "boolean"].includes(typeof item)
        ) {
          violations.push({
            path: `${keyPath}[${index}]`,
            rule: "payload-value-type",
            message:
              "rootPayload arrays may contain only JSON scalars or plain objects.",
          });
        }
      });
      continue;
    }

    if (isPlainObject(value)) {
      violations.push(...validateRootPayload(value, keyPath, depth + 1));
      continue;
    }

    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    ) {
      violations.push({
        path: keyPath,
        rule: "payload-value-type",
        message:
          "rootPayload values must be JSON scalars, arrays, or plain objects.",
      });
    }
  }

  return violations;
}

/* -------------------------------------------------------------------------
 * Result item runtime validation
 *
 * A final commit-gate replay proved that the builder emitted an item as thin
 * as `{ rootId, rootPayload }` and reported `status: "ok"`. Every other
 * required field of the public contract was simply absent.
 *
 * `SourceRootResultItem` is a PUBLIC CONTRACT boundary, and a TypeScript
 * interface is a compile-time convenience: at runtime an item arrives as
 * `unknown`. Nothing here manufactures missing metadata, defaults provenance,
 * fabricates temporal state, infers review state, or repairs malformed values.
 * Invalid items fail closed.
 * ---------------------------------------------------------------------- */

/** Required top-level fields of the public result-item contract. */
export const REQUIRED_RESULT_ITEM_FIELDS = [
  "address",
  "rootId",
  "objectType",
  "canonicalPublicId",
  "datasetId",
  "datasetVersion",
  "canonicalUrl",
  "provenanceSummary",
  "temporalSummary",
  "uncertaintySummary",
  "reviewSummary",
  "rootPayload",
  "semanticConclusion",
] as const;

export interface ResultItemViolation {
  readonly rule: string;
  readonly message: string;
}

function record(
  violations: ResultItemViolation[],
  rule: string,
  message: string,
): void {
  violations.push({ rule, message });
}

/** A required, non-blank string. Missing, null, non-string, blank all fail. */
function requireText(
  violations: ResultItemViolation[],
  value: unknown,
  rule: string,
  label: string,
): value is string {
  if (value === undefined || value === null) {
    record(violations, rule, `${label} is required.`);
    return false;
  }
  if (typeof value !== "string") {
    record(violations, rule, `${label} must be a string.`);
    return false;
  }
  if (value.trim().length === 0) {
    record(violations, rule, `${label} must not be blank.`);
    return false;
  }
  return true;
}

/** A nullable string: null is legitimate, a blank string is not. */
function requireNullableText(
  violations: ResultItemViolation[],
  value: unknown,
  rule: string,
  label: string,
): void {
  if (value === null) return;
  if (value === undefined) {
    record(violations, rule, `${label} is required; use null when absent.`);
    return;
  }
  if (typeof value !== "string") {
    record(violations, rule, `${label} must be a string or null.`);
    return;
  }
  if (value.trim().length === 0) {
    record(
      violations,
      rule,
      `${label} must be null when absent, never a blank string.`,
    );
  }
}

function requireBoolean(
  violations: ResultItemViolation[],
  value: unknown,
  rule: string,
  label: string,
): void {
  if (typeof value !== "boolean") {
    record(violations, rule, `${label} must be a boolean.`);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Validates one result item against the complete public contract.
 *
 * Returns structured violations in the established SourceRoot style rather
 * than throwing, so a caller can report everything wrong at once.
 */
export function validateResultItem(
  item: unknown,
  index = 0,
): readonly ResultItemViolation[] {
  const violations: ResultItemViolation[] = [];
  const at = (rule: string) => `item[${index}].${rule}`;

  if (!isPlainRecord(item)) {
    return [
      {
        rule: at("shape"),
        message: "A result item must be an object.",
      },
    ];
  }

  for (const field of REQUIRED_RESULT_ITEM_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(item, field)) {
      record(
        violations,
        at(`${field}-missing`),
        `${field} is a required result-item field and is absent. Missing metadata is never manufactured.`,
      );
    }
  }

  /* Root identity: governed registry, reusing the existing authority. */
  const rootIdProblem = checkRootId(item.rootId);
  if (rootIdProblem !== null) {
    record(
      violations,
      at(`rootId-${rootIdProblem}`),
      `Result item rootId is ${rootIdProblem}.`,
    );
  }

  /* Identity components. */
  requireText(violations, item.objectType, at("objectType"), "objectType");
  if (
    typeof item.objectType === "string" &&
    !isSourceRootObjectType(item.objectType)
  ) {
    record(
      violations,
      at("objectType-undefined"),
      `"${item.objectType}" is not a DEFINED SourceRoot object type. Referencing a type never makes it IMPLEMENTED or PROVIDED.`,
    );
  }
  requireText(
    violations,
    item.canonicalPublicId,
    at("canonicalPublicId"),
    "canonicalPublicId",
  );
  requireText(violations, item.datasetId, at("datasetId"), "datasetId");
  if (requireText(violations, item.datasetVersion, at("datasetVersion"), "datasetVersion")) {
    const versionProblem = checkVersionSyntax(item.datasetVersion);
    if (versionProblem !== null) {
      record(
        violations,
        at(`datasetVersion-${versionProblem}`),
        `datasetVersion is ${versionProblem} under the SourceRoot contract v1 version rule.`,
      );
    }
  }

  /* Public locator: nullable by contract, but never a blank string. */
  requireNullableText(
    violations,
    item.canonicalUrl,
    at("canonicalUrl"),
    "canonicalUrl",
  );

  /* Address, and its coherence with the components it serializes. */
  if (requireText(violations, item.address, at("address"), "address")) {
    const parsed = tryParseSourceRootAddress(item.address);
    if (!parsed.ok) {
      record(
        violations,
        at(`address-${parsed.code}`),
        `address is not a valid SourceRoot address: ${parsed.message}`,
      );
    } else {
      // The address IS the serialization of these five components, so any
      // disagreement means the item is describing two different resources.
      for (const [field, addressValue] of [
        ["rootId", parsed.address.rootId],
        ["objectType", parsed.address.objectType],
        ["canonicalPublicId", parsed.address.canonicalPublicId],
        ["datasetId", parsed.address.datasetId],
        ["datasetVersion", parsed.address.datasetVersion],
      ] as const) {
        const itemValue = item[field];
        if (typeof itemValue === "string" && itemValue !== addressValue) {
          record(
            violations,
            at(`address-${field}-mismatch`),
            `${field} is "${itemValue}" but the address says "${addressValue}".`,
          );
        }
      }
    }
  }

  /* Provenance. Shared SourceRoot metadata, not adapter payload policy. */
  if (!isPlainRecord(item.provenanceSummary)) {
    record(
      violations,
      at("provenanceSummary-shape"),
      "provenanceSummary must be an object. Provenance is never defaulted.",
    );
  } else {
    const provenance = item.provenanceSummary;
    requireText(
      violations,
      provenance.datasetId,
      at("provenanceSummary.datasetId"),
      "provenanceSummary.datasetId",
    );
    if (
      requireText(
        violations,
        provenance.datasetVersion,
        at("provenanceSummary.datasetVersion"),
        "provenanceSummary.datasetVersion",
      )
    ) {
      const problem = checkVersionSyntax(provenance.datasetVersion);
      if (problem !== null) {
        record(
          violations,
          at(`provenanceSummary.datasetVersion-${problem}`),
          `provenanceSummary.datasetVersion is ${problem}.`,
        );
      }
    }
    // No closed derivation vocabulary is defined for result items in contract
    // v1, so this is a required non-blank string and nothing stricter.
    requireText(
      violations,
      provenance.derivation,
      at("provenanceSummary.derivation"),
      "provenanceSummary.derivation",
    );
    requireNullableText(
      violations,
      provenance.sourceLocator,
      at("provenanceSummary.sourceLocator"),
      "provenanceSummary.sourceLocator",
    );
    if (
      typeof provenance.evidenceCount !== "number" ||
      !Number.isSafeInteger(provenance.evidenceCount) ||
      provenance.evidenceCount < 0
    ) {
      record(
        violations,
        at("provenanceSummary.evidenceCount"),
        "provenanceSummary.evidenceCount must be a non-negative integer.",
      );
    }
  }

  /* Temporal. Governed mode vocabulary, plus the contract's own asserted rule. */
  if (!isPlainRecord(item.temporalSummary)) {
    record(
      violations,
      at("temporalSummary-shape"),
      "temporalSummary must be an object. Temporal state is never fabricated.",
    );
  } else {
    const temporal = item.temporalSummary;
    if (
      requireText(
        violations,
        temporal.mode,
        at("temporalSummary.mode"),
        "temporalSummary.mode",
      )
    ) {
      if (
        !(SOURCEROOT_TEMPORAL_MODES as readonly string[]).includes(
          temporal.mode as string,
        )
      ) {
        record(
          violations,
          at("temporalSummary.mode-vocabulary"),
          `"${String(temporal.mode)}" is not a defined SourceRoot temporal mode.`,
        );
      }
    }
    requireBoolean(
      violations,
      temporal.asserted,
      at("temporalSummary.asserted"),
      "temporalSummary.asserted",
    );
    requireText(
      violations,
      temporal.description,
      at("temporalSummary.description"),
      "temporalSummary.description",
    );
    // `isTemporalScopeAsserted` defines this relationship, so a summary that
    // contradicts it is claiming a temporal assertion the mode denies.
    if (
      typeof temporal.asserted === "boolean" &&
      typeof temporal.mode === "string" &&
      (SOURCEROOT_TEMPORAL_MODES as readonly string[]).includes(temporal.mode)
    ) {
      const expected = temporal.mode !== TEMPORAL_MODE_NOT_ASSERTED;
      if (temporal.asserted !== expected) {
        record(
          violations,
          at("temporalSummary.asserted-incoherent"),
          `asserted is ${temporal.asserted} but mode "${temporal.mode}" means asserted must be ${expected}. A missing temporal scope is never presented as an assertion.`,
        );
      }
    }
  }

  /* Uncertainty. No closed certainty vocabulary is defined in contract v1. */
  if (!isPlainRecord(item.uncertaintySummary)) {
    record(
      violations,
      at("uncertaintySummary-shape"),
      "uncertaintySummary must be an object.",
    );
  } else {
    const uncertainty = item.uncertaintySummary;
    requireText(
      violations,
      uncertainty.certainty,
      at("uncertaintySummary.certainty"),
      "uncertaintySummary.certainty",
    );
    requireNullableText(
      violations,
      uncertainty.uncertaintyStatement,
      at("uncertaintySummary.uncertaintyStatement"),
      "uncertaintySummary.uncertaintyStatement",
    );
    requireBoolean(
      violations,
      uncertainty.disputed,
      at("uncertaintySummary.disputed"),
      "uncertaintySummary.disputed",
    );
  }

  /* Review. The four states are released shared vocabulary: migration 018
   * review_status, migration 019 review_state, and identity assertions all use
   * exactly this set, so it is governed rather than identity-specific. */
  if (!isPlainRecord(item.reviewSummary)) {
    record(
      violations,
      at("reviewSummary-shape"),
      "reviewSummary must be an object. Review state is never inferred.",
    );
  } else {
    const review = item.reviewSummary;
    if (
      requireText(
        violations,
        review.reviewState,
        at("reviewSummary.reviewState"),
        "reviewSummary.reviewState",
      )
    ) {
      if (
        !(SOURCEROOT_IDENTITY_REVIEW_STATES as readonly string[]).includes(
          review.reviewState as string,
        )
      ) {
        record(
          violations,
          at("reviewSummary.reviewState-vocabulary"),
          `"${String(review.reviewState)}" is not a released SourceRoot review state.`,
        );
      }
    }
    // Contract v1 defines no coherence rule between reviewed and reviewState,
    // so only the type is enforced here.
    requireBoolean(
      violations,
      review.reviewed,
      at("reviewSummary.reviewed"),
      "reviewSummary.reviewed",
    );
  }

  /* rootPayload: presence and the existing generic boundary. */
  if (!isPlainRecord(item.rootPayload)) {
    record(
      violations,
      at("rootPayload-shape"),
      "rootPayload must be an object of Root-public contract data.",
    );
  }

  /* Semantic conclusion: the contract permits exactly null. */
  if (item.semanticConclusion !== null) {
    record(
      violations,
      at("semanticConclusion"),
      "semanticConclusion must be exactly null. SourceRoot draws no conclusion for a caller.",
    );
  }

  return violations;
}

export class SourceRootResultItemContractError extends Error {
  public readonly code = "sourceroot-result-item-contract-violation";
  public readonly violations: readonly ResultItemViolation[];
  constructor(violations: readonly ResultItemViolation[]) {
    super(
      `SourceRoot result item violates its public contract: ${violations
        .map((violation) => `${violation.rule} (${violation.message})`)
        .join("; ")}`,
    );
    this.name = "SourceRootResultItemContractError";
    this.violations = violations;
  }
}

/* -------------------------------------------------------------------------
 * Envelope
 * ---------------------------------------------------------------------- */

export interface SourceRootResultItem {
  /** Canonical serialized SourceRoot address. Never an identity claim. */
  readonly address: string;
  readonly rootId: string;
  readonly objectType: string;
  readonly canonicalPublicId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly canonicalUrl: string | null;
  readonly provenanceSummary: SourceRootProvenanceSummary;
  readonly temporalSummary: SourceRootTemporalSummary;
  readonly uncertaintySummary: SourceRootUncertaintySummary;
  readonly reviewSummary: SourceRootReviewSummary;
  readonly rootPayload: RootPublicContractPayload;
  readonly semanticConclusion: null;
}

export interface SourceRootRootGroup {
  readonly rootId: string;
  readonly availability: SourceRootAvailabilityState;
  readonly returned: number;
  readonly items: readonly SourceRootResultItem[];
}

export interface SourceRootResponseEnvelope {
  readonly sourcerootContractVersion: string;
  /** Per-Root contract versions, so consumers never assume a single version. */
  readonly rootContractVersions: Readonly<Record<string, string | null>>;
  readonly addressFormatVersion: string;
  readonly status: SourceRootResultStatus;
  readonly requestedRoots: readonly string[];
  readonly respondingRoots: readonly string[];
  readonly unavailableRoots: readonly SourceRootRootUnavailability[];
  readonly rootGroups: readonly SourceRootRootGroup[];
  readonly items: readonly SourceRootResultItem[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasMore: boolean;
    readonly totalSemantics: typeof EXACT_TOTAL_SEMANTICS;
  };
  readonly appliedFilters: Readonly<Record<string, string>>;
  readonly appliedSort: {
    readonly field: string;
    readonly direction: SortDirection;
    readonly tieBreaker: string;
  };
  readonly semanticConclusion: null;
}

/**
 * Derives the envelope status from VALIDATED accounting.
 *
 * An independent audit proved that an earlier version returned `ok` when a
 * requested Root was neither responding nor unavailable, letting a requested
 * Root silently disappear. Status is now derived only after every requested
 * Root has been accounted for exactly once, and callers cannot supply it.
 */
export function deriveResultStatus(
  respondingRoots: readonly string[],
  unavailableRoots: readonly SourceRootRootUnavailability[],
): SourceRootResultStatus {
  if (respondingRoots.length === 0) return "unavailable";
  if (unavailableRoots.length > 0) return "partial";
  return "ok";
}

export interface EnvelopeAccountingViolation {
  readonly rule: string;
  readonly message: string;
}

export class SourceRootEnvelopeContractError extends Error {
  public readonly code = "sourceroot-envelope-contract-violation";
  public readonly violations: readonly EnvelopeAccountingViolation[];
  constructor(violations: readonly EnvelopeAccountingViolation[]) {
    super(
      `SourceRoot response envelope violates its contract: ${violations
        .map((violation) => `${violation.rule} (${violation.message})`)
        .join("; ")}`,
    );
    this.name = "SourceRootEnvelopeContractError";
    this.violations = violations;
  }
}

function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * THE RESPONSE ACCOUNTING INVARIANT.
 *
 * Every requested Root must be accounted for exactly once, as RESPONDING or
 * as UNAVAILABLE. Never neither. Never both. A Root that cannot answer is
 * reported with a reason; it never silently disappears.
 */
export function validateResponseAccounting(options: {
  readonly requestedRoots: readonly string[];
  readonly respondingRoots: readonly string[];
  readonly unavailableRoots: readonly SourceRootRootUnavailability[];
  readonly items: readonly SourceRootResultItem[];
  readonly rootContractVersions: Readonly<Record<string, string | null>>;
  readonly pagination: PaginationQuery;
  readonly total: number;
}): readonly EnvelopeAccountingViolation[] {
  const violations: EnvelopeAccountingViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rule, message });

  // Shape first. A malformed container must fail closed with a violation, not
  // crash mid-validation or be silently iterated as something it is not: a
  // bare string is iterable, and iterating it would yield characters.
  for (const [field, value] of [
    ["requestedRoots", options.requestedRoots],
    ["respondingRoots", options.respondingRoots],
    ["unavailableRoots", options.unavailableRoots],
    ["items", options.items],
  ] as const) {
    if (!Array.isArray(value)) {
      fail(`${field}-shape`, `${field} must be an array.`);
    }
  }
  if (
    options.rootContractVersions === null ||
    typeof options.rootContractVersions !== "object" ||
    Array.isArray(options.rootContractVersions)
  ) {
    fail(
      "root-contract-versions-shape",
      "rootContractVersions must be an object keyed by governed Root identifier.",
    );
  }
  if (violations.length > 0) return violations;

  const requested = options.requestedRoots ?? [];
  const responding = options.respondingRoots ?? [];
  const unavailable = options.unavailableRoots ?? [];

  for (const entry of unavailable) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      fail(
        "unavailable-entry-shape",
        "Every unavailable Root entry must be an object carrying rootId, state, and reason.",
      );
    }
  }
  for (const item of options.items) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      fail("item-shape", "Every result item must be an object.");
    }
  }
  if (violations.length > 0) return violations;

  if (requested.length === 0) {
    fail(
      "requested-roots-required",
      "A response envelope must record at least one requested Root.",
    );
  }

  // Every Root identifier that can influence accounting or status must be a
  // governed registry identifier. The registry is the sole authority; this
  // module keeps no Root list of its own.
  for (const rootId of requested) {
    const problem = checkRootId(rootId);
    if (problem !== null) {
      fail(
        `requested-root-id-${problem}`,
        `Requested Root "${String(rootId)}" is ${problem}. Root identifiers must match the governed registry exactly; no trimming or case folding is applied.`,
      );
    }
  }
  for (const rootId of responding) {
    const problem = checkRespondingRoot(rootId);
    if (problem !== null) {
      fail(
        `responding-root-${problem}`,
        problem === "cannot-respond"
          ? `Root "${String(rootId)}" is registered but the registry grants it no Root contract version, so it cannot be a responding Root.`
          : `Responding Root "${String(rootId)}" is ${problem}.`,
      );
    }
  }
  for (const entry of unavailable) {
    const problem = checkRootId(entry?.rootId);
    if (problem !== null) {
      fail(
        `unavailable-root-id-${problem}`,
        `Unavailable Root "${String(entry?.rootId)}" is ${problem}.`,
      );
    }
  }
  for (const item of options.items ?? []) {
    const problem = checkRootId(item?.rootId);
    if (problem !== null) {
      fail(
        `item-root-id-${problem}`,
        `A result item declares a Root identifier that is ${problem}.`,
      );
    }
  }
  for (const rootId of Object.keys(options.rootContractVersions ?? {})) {
    const problem = checkRootId(rootId);
    if (problem !== null) {
      fail(
        `contract-version-root-id-${problem}`,
        `The Root contract version map has a key "${rootId}" that is ${problem}.`,
      );
    }
  }

  for (const duplicate of duplicatesOf([...requested])) {
    fail("duplicate-requested-root", `${duplicate} is requested more than once.`);
  }
  for (const duplicate of duplicatesOf([...responding])) {
    fail("duplicate-responding-root", `${duplicate} responds more than once.`);
  }
  for (const duplicate of duplicatesOf(unavailable.map((item) => item.rootId))) {
    fail(
      "duplicate-unavailable-root",
      `${duplicate} is reported unavailable more than once.`,
    );
  }

  const requestedSet = new Set(requested);
  const respondingSet = new Set(responding);
  const unavailableSet = new Set(unavailable.map((item) => item.rootId));

  for (const rootId of requestedSet) {
    const isResponding = respondingSet.has(rootId);
    const isUnavailable = unavailableSet.has(rootId);
    if (!isResponding && !isUnavailable) {
      fail(
        "requested-root-unaccounted",
        `${rootId} was requested but is neither responding nor reported unavailable. A requested Root must never silently disappear.`,
      );
    }
    if (isResponding && isUnavailable) {
      fail(
        "root-both-responding-and-unavailable",
        `${rootId} is reported both responding and unavailable.`,
      );
    }
  }

  for (const rootId of respondingSet) {
    if (!requestedSet.has(rootId)) {
      fail(
        "responding-root-not-requested",
        `${rootId} responded but was never requested. SourceRoot contract v1 permits no result expansion.`,
      );
    }
  }
  for (const rootId of unavailableSet) {
    if (!requestedSet.has(rootId)) {
      fail(
        "unavailable-root-not-requested",
        `${rootId} is reported unavailable but was never requested.`,
      );
    }
  }

  for (const entry of unavailable) {
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
      fail(
        "unavailable-reason-required",
        `${entry.rootId} is unavailable without a reason.`,
      );
    }
    // Compared as strings: callers are untrusted at runtime even though the
    // declared type already excludes "supported".
    const state: string = entry.state;
    if (
      !(SOURCEROOT_AVAILABILITY_STATES as readonly string[]).includes(state) ||
      state === "supported"
    ) {
      fail(
        "unavailable-state-vocabulary",
        `${entry.rootId} declares an invalid unavailable state "${String(entry.state)}".`,
      );
    }
  }

  for (const item of options.items ?? []) {
    if (!respondingSet.has(item.rootId)) {
      fail(
        "item-root-not-responding",
        `An item claims rootId ${item.rootId}, which is not a responding Root.`,
      );
    }
  }

  // Presence is not meaning. Each declared version must be the version the
  // registry actually grants that Root: a well-formed but unsupported version
  // is still wrong.
  for (const rootId of requestedSet) {
    if (!Object.prototype.hasOwnProperty.call(options.rootContractVersions, rootId)) {
      fail(
        "root-contract-version-missing",
        `${rootId} has no Root contract version entry. Consumers must never guess a version.`,
      );
      continue;
    }

    const declaredVersion = options.rootContractVersions[rootId];
    const problem = checkRootContractVersion(rootId, declaredVersion);
    if (problem === null) continue;

    if (respondingSet.has(rootId) && (declaredVersion === null || declaredVersion === undefined)) {
      fail(
        "root-contract-version-missing",
        `${rootId} responds but declares no Root contract version.`,
      );
      continue;
    }

    fail(
      `root-contract-version-${problem}`,
      problem === "unsupported"
        ? `${rootId} declares Root contract version "${String(declaredVersion)}", which is not the version the registry supports for it (${String(supportedRootContractVersion(rootId))}). A syntactically valid version is still wrong if it is unsupported.`
        : `${rootId} declares a Root contract version that is ${problem}.`,
    );
  }

  const pagination = options.pagination;
  if (!pagination || typeof pagination !== "object") {
    fail("pagination-required", "Pagination is required.");
    return violations;
  }
  if (!Number.isSafeInteger(pagination.offset) || pagination.offset < 0) {
    fail("pagination-offset", "offset must be a non-negative integer.");
  }
  if (
    !Number.isSafeInteger(pagination.limit) ||
    pagination.limit < 1 ||
    pagination.limit > SOURCEROOT_MAX_PAGE_SIZE
  ) {
    fail(
      "pagination-limit",
      `limit must be an integer between 1 and ${SOURCEROOT_MAX_PAGE_SIZE}.`,
    );
  }
  if (!Number.isSafeInteger(pagination.page) || pagination.page < 1) {
    fail("pagination-page", "page must be a positive integer.");
  }
  if (!Number.isSafeInteger(options.total) || options.total < 0) {
    fail("pagination-total", "total must be a non-negative integer.");
  }

  const returned = (options.items ?? []).length;
  if (Number.isSafeInteger(pagination.limit) && returned > pagination.limit) {
    fail(
      "pagination-returned-exceeds-limit",
      `${returned} items were returned for a limit of ${pagination.limit}.`,
    );
  }
  if (Number.isSafeInteger(options.total) && returned > options.total) {
    fail(
      "pagination-returned-exceeds-total",
      `${returned} items were returned but total is ${options.total} under exact total semantics.`,
    );
  }
  if (
    Number.isSafeInteger(options.total) &&
    Number.isSafeInteger(pagination.offset) &&
    pagination.offset + returned > options.total
  ) {
    fail(
      "pagination-window-exceeds-total",
      `offset ${pagination.offset} plus ${returned} returned exceeds total ${options.total}.`,
    );
  }

  return violations;
}

export interface BuildEnvelopeOptions {
  readonly requestedRoots: readonly string[];
  readonly respondingRoots: readonly string[];
  readonly unavailableRoots: readonly SourceRootRootUnavailability[];
  readonly items: readonly SourceRootResultItem[];
  readonly rootContractVersions: Readonly<Record<string, string | null>>;
  readonly pagination: PaginationQuery;
  readonly total: number;
  readonly appliedFilters: Readonly<Record<string, string>>;
  readonly sortField: SourceRootSortField | string;
  readonly sortDirection: SortDirection;
  readonly tieBreaker: string;
}

export class RootPayloadBoundaryError extends Error {
  public readonly code = "root-payload-boundary-violation";
  public readonly violations: readonly RootPayloadViolation[];
  constructor(violations: readonly RootPayloadViolation[]) {
    super(
      `rootPayload violates the SourceRoot public contract boundary: ${violations
        .map((violation) => `${violation.path} (${violation.rule})`)
        .join(", ")}`,
    );
    this.name = "RootPayloadBoundaryError";
    this.violations = violations;
  }
}

export function buildSourceRootResponseEnvelope(
  options: BuildEnvelopeOptions,
): SourceRootResponseEnvelope {
  // Accounting runs first: it establishes that the containers are the shape
  // this contract requires, so payload inspection cannot crash on a malformed
  // input before it has been reported as a violation.
  const accountingViolations = validateResponseAccounting({
    requestedRoots: options.requestedRoots,
    respondingRoots: options.respondingRoots,
    unavailableRoots: options.unavailableRoots,
    items: options.items,
    rootContractVersions: options.rootContractVersions,
    pagination: options.pagination,
    total: options.total,
  });
  if (accountingViolations.length > 0) {
    throw new SourceRootEnvelopeContractError(accountingViolations);
  }

  // The public result-item contract is enforced by the builder itself, so no
  // caller has to remember to invoke it.
  const itemViolations = options.items.flatMap((item, index) =>
    validateResultItem(item, index),
  );
  if (itemViolations.length > 0) {
    throw new SourceRootResultItemContractError(itemViolations);
  }

  const payloadViolations = options.items.flatMap((item) =>
    validateRootPayload(item.rootPayload),
  );
  if (payloadViolations.length > 0) {
    throw new RootPayloadBoundaryError(payloadViolations);
  }

  const unavailableRoots = [...options.unavailableRoots].sort((left, right) =>
    left.rootId.localeCompare(right.rootId),
  );
  const respondingRoots = [...options.respondingRoots].sort((left, right) =>
    left.localeCompare(right),
  );

  // Root groups are derived here, never supplied by the caller, so a group can
  // never exist for a Root that was not declared responding or unavailable.
  const rootGroups: SourceRootRootGroup[] = respondingRoots.map((rootId) => {
    const items = options.items.filter((item) => item.rootId === rootId);
    return {
      rootId,
      availability: "supported" as const,
      returned: items.length,
      items,
    };
  });

  for (const unavailable of unavailableRoots) {
    rootGroups.push({
      rootId: unavailable.rootId,
      availability: unavailable.state,
      returned: 0,
      items: [],
    });
  }

  const returned = options.items.length;
  const limit = options.pagination.limit;
  const hasMore = options.pagination.offset + returned < options.total;

  return {
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    rootContractVersions: options.rootContractVersions,
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    status: deriveResultStatus(respondingRoots, unavailableRoots),
    requestedRoots: [...options.requestedRoots],
    respondingRoots,
    unavailableRoots,
    rootGroups,
    items: options.items,
    pagination: {
      page: options.pagination.page,
      limit,
      offset: options.pagination.offset,
      returned,
      total: options.total,
      totalPages: limit > 0 ? Math.ceil(options.total / limit) : 0,
      hasMore,
      totalSemantics: EXACT_TOTAL_SEMANTICS,
    },
    appliedFilters: options.appliedFilters,
    appliedSort: {
      field: options.sortField,
      direction: options.sortDirection,
      tieBreaker: options.tieBreaker,
    },
    semanticConclusion: null,
  };
}

/**
 * Builds the unavailability record for a Root that cannot answer.
 *
 * Every caller must supply a reason. A Root that fails is reported, never
 * dropped.
 */
export function rootUnavailable(
  rootId: SourceRootRootId | string,
  state: SourceRootRootUnavailability["state"],
  reason: string,
): SourceRootRootUnavailability {
  if (reason.trim().length === 0) {
    throw new Error(
      "An unavailable Root must carry a reason so partial results stay honest.",
    );
  }
  return { rootId, state, reason };
}
