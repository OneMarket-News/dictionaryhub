/**
 * EarthRoot public rootPayload contract v1 (Chunk 15A).
 *
 * The released shared `rootPayload` denylist is explicitly "a floor, NOT an
 * authorization boundary" and fails open on any key nobody thought to forbid.
 * This module is the EarthRoot-owned ALLOWLIST that closes it: only the fields
 * enumerated here may be emitted, every value is shape-checked, and anything
 * unrecognised fails closed rather than passing through.
 *
 * No database primary key, raw row, internal timestamp, credential, source
 * internal, coordinate, geometry, or 15B UI state may cross this boundary.
 */

import {
  EARTHROOT_ENTITY_TYPES,
  EARTHROOT_NOT_ASSERTED_MEANING,
  EARTHROOT_REVIEW_STATES,
  EARTHROOT_NAME_TYPES,
  EARTHROOT_PREDICATES,
  EARTHROOT_TEMPORAL_MODES,
  type EarthRootEntityType,
} from "./contract.js";
import { findForbiddenSpatialKey, type EarthRootViolation } from "./domain.js";

export const EARTHROOT_PAYLOAD_SCHEMA_VERSION = "1.0.0" as const;

/** Top-level allowlist. Any other key is a violation, not a passthrough. */
export const EARTHROOT_PAYLOAD_ALLOWED_KEYS = [
  "schemaVersion",
  "entityType",
  "displayLabel",
  "names",
  "classifications",
  "relationshipSummaries",
] as const;

const NAME_KEYS = [
  "label",
  "nameType",
  "languageTag",
  "script",
  "preferredDisplay",
  "reviewState",
  "disputed",
  "temporal",
  "evidenceCount",
] as const;

const CLASSIFICATION_KEYS = [
  "label",
  "reviewState",
  "disputed",
  "temporal",
  "evidenceCount",
] as const;

const RELATIONSHIP_KEYS = [
  "predicate",
  "objectCanonicalPublicId",
  "objectEntityType",
  "temporal",
  "reviewState",
  "disputed",
  "evidenceCount",
] as const;

const TEMPORAL_KEYS = [
  "mode",
  "validFromYear",
  "validUntilYear",
  "description",
  "meaning",
] as const;

export interface EarthRootPayloadTemporal {
  readonly mode: string;
  readonly validFromYear: number | null;
  readonly validUntilYear: number | null;
  readonly description: string | null;
  /** Always present, so a consumer cannot render absence as timelessness. */
  readonly meaning: string;
}

export interface EarthRootPayloadName {
  readonly label: string;
  readonly nameType: string;
  readonly languageTag: string | null;
  readonly script: string | null;
  readonly preferredDisplay: boolean;
  readonly reviewState: string;
  readonly disputed: boolean;
  readonly temporal: EarthRootPayloadTemporal;
  readonly evidenceCount: number;
}

export interface EarthRootPayloadClassification {
  readonly label: string;
  readonly reviewState: string;
  readonly disputed: boolean;
  readonly temporal: EarthRootPayloadTemporal;
  readonly evidenceCount: number;
}

export interface EarthRootPayloadRelationship {
  readonly predicate: string;
  readonly objectCanonicalPublicId: string;
  readonly objectEntityType: string;
  readonly temporal: EarthRootPayloadTemporal;
  readonly reviewState: string;
  readonly disputed: boolean;
  readonly evidenceCount: number;
}

export interface EarthRootPublicPayload {
  readonly schemaVersion: string;
  readonly entityType: EarthRootEntityType;
  /** Derived from a sourced preferred-name assertion. Never identity. */
  readonly displayLabel: string;
  readonly names: readonly EarthRootPayloadName[];
  readonly classifications: readonly EarthRootPayloadClassification[];
  readonly relationshipSummaries: readonly EarthRootPayloadRelationship[];
}

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

function checkExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  push: (rule: string, message: string) => void,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      push(
        "payload-key-not-allowlisted",
        `${label} carries "${key}", which is not in the EarthRoot public payload allowlist. The payload is an allowlist, not a denylist.`,
      );
    }
  }
  for (const key of allowed) {
    if (!(key in value)) {
      push("payload-key-missing", `${label} is missing required key "${key}".`);
    }
  }
}

function validateTemporalBlock(
  value: unknown,
  label: string,
  push: (rule: string, message: string) => void,
): void {
  if (!isPlainObject(value)) {
    push("payload-temporal-shape", `${label}.temporal must be a plain object.`);
    return;
  }
  checkExactKeys(value, TEMPORAL_KEYS, `${label}.temporal`, push);
  if (
    typeof value.mode !== "string" ||
    !(EARTHROOT_TEMPORAL_MODES as readonly string[]).includes(value.mode)
  ) {
    push("payload-temporal-mode", `${label}.temporal.mode is not a governed mode.`);
  }
  if (!isMeaningfulText(value.meaning)) {
    push(
      "payload-temporal-meaning-required",
      `${label}.temporal.meaning must be present so a consumer cannot render absence as timelessness.`,
    );
  }
  if (value.mode === "not_asserted" && value.meaning !== EARTHROOT_NOT_ASSERTED_MEANING) {
    push(
      "payload-not-asserted-meaning-pinned",
      `${label}.temporal is not_asserted and must carry the released meaning verbatim; a substituted sentence could assert timelessness.`,
    );
  }
  // Shape-checked in EVERY mode. Guarding these only inside the not_asserted
  // branch left them completely untyped whenever a validity WAS asserted, so an
  // arbitrary object could ride out through validFromYear and satisfy both this
  // allowlist and the released denylist floor.
  for (const bound of ["validFromYear", "validUntilYear"] as const) {
    const year = value[bound];
    if (year !== null && (typeof year !== "number" || !Number.isInteger(year))) {
      push(
        "payload-temporal-bound-type",
        `${label}.temporal.${bound} must be a whole year or null.`,
      );
    }
  }
  if (value.description !== null && !isMeaningfulText(value.description)) {
    push(
      "payload-temporal-description-type",
      `${label}.temporal.description must be meaningful text or null.`,
    );
  }
  if (
    value.mode === "asserted" &&
    typeof value.validFromYear === "number" &&
    typeof value.validUntilYear === "number" &&
    value.validFromYear > value.validUntilYear
  ) {
    push(
      "payload-temporal-bounds-ordered",
      `${label}.temporal bounds are inverted.`,
    );
  }
  if (value.mode === "not_asserted") {
    if (value.validFromYear !== null || value.validUntilYear !== null) {
      push(
        "payload-not-asserted-carries-no-bounds",
        `${label}.temporal is not_asserted and must not carry year bounds.`,
      );
    }
    if (value.description !== null) {
      push(
        "payload-not-asserted-carries-no-description",
        `${label}.temporal is not_asserted and must not carry a validity description.`,
      );
    }
  }
}

function validateEvidenceCount(
  value: unknown,
  label: string,
  push: (rule: string, message: string) => void,
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    push(
      "payload-evidence-count",
      `${label}.evidenceCount must be an integer of at least 1; unsourced EarthRoot semantics are not publishable.`,
    );
  }
}

/**
 * Validates an EarthRoot public payload. Fails closed on anything unexpected.
 */
export function validateEarthRootPayload(
  payload: unknown,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];
  const push = (rule: string, message: string) =>
    violations.push({ rule, message });

  if (!isPlainObject(payload)) {
    return [{ rule: "payload-shape", message: "rootPayload must be a plain object." }];
  }

  checkExactKeys(payload, EARTHROOT_PAYLOAD_ALLOWED_KEYS, "rootPayload", push);

  if (payload.schemaVersion !== EARTHROOT_PAYLOAD_SCHEMA_VERSION) {
    push(
      "payload-schema-version",
      `schemaVersion must be exactly "${EARTHROOT_PAYLOAD_SCHEMA_VERSION}".`,
    );
  }
  if (
    typeof payload.entityType !== "string" ||
    !(EARTHROOT_ENTITY_TYPES as readonly string[]).includes(payload.entityType)
  ) {
    push("payload-entity-type", "entityType must be place or polity.");
  }
  if (!isMeaningfulText(payload.displayLabel)) {
    push(
      "payload-display-label",
      "displayLabel must be a meaningful string derived from a sourced preferred name.",
    );
  }

  for (const [key, keys, kind] of [
    ["names", NAME_KEYS, "name"],
    ["classifications", CLASSIFICATION_KEYS, "classification"],
    ["relationshipSummaries", RELATIONSHIP_KEYS, "relationship"],
  ] as const) {
    const list = payload[key];
    if (!Array.isArray(list)) {
      push(`payload-${kind}-array`, `${key} must be an array.`);
      continue;
    }
    list.forEach((entry, index) => {
      const label = `${key}[${index}]`;
      if (!isPlainObject(entry)) {
        push(`payload-${kind}-shape`, `${label} must be a plain object.`);
        return;
      }
      checkExactKeys(entry, keys, label, push);
      validateTemporalBlock(entry.temporal, label, push);
      validateEvidenceCount(entry.evidenceCount, label, push);

      if (kind === "name") {
        if (!isMeaningfulText(entry.label)) {
          push("payload-name-label", `${label}.label must be meaningful.`);
        }
        if (
          typeof entry.nameType !== "string" ||
          !(EARTHROOT_NAME_TYPES as readonly string[]).includes(entry.nameType)
        ) {
          push("payload-name-type", `${label}.nameType is not governed.`);
        }
        if (typeof entry.preferredDisplay !== "boolean") {
          push("payload-name-preferred", `${label}.preferredDisplay must be boolean.`);
        }
        // Enumerated in NAME_KEYS but previously never shape-checked, so these
        // two were the widest hole in the allowlist.
        for (const optional of ["languageTag", "script"] as const) {
          const held = entry[optional];
          if (held !== null && !isMeaningfulText(held)) {
            push(
              `payload-name-${optional.toLowerCase()}`,
              `${label}.${optional} must be meaningful text or null.`,
            );
          }
        }
      }
      if (kind === "classification" && !isMeaningfulText(entry.label)) {
        push("payload-classification-label", `${label}.label must be meaningful.`);
      }
      if (kind === "name" || kind === "classification") {
        if (
          typeof entry.reviewState !== "string" ||
          !(EARTHROOT_REVIEW_STATES as readonly string[]).includes(entry.reviewState)
        ) {
          push(`payload-${kind}-review-state`, `${label}.reviewState is not governed.`);
        }
        if (typeof entry.disputed !== "boolean") {
          push(`payload-${kind}-disputed`, `${label}.disputed must be boolean.`);
        }
        if (entry.disputed === true && entry.preferredDisplay === true) {
          push(
            "payload-disputed-name-not-preferred",
            `${label} is disputed and must not be marked preferredDisplay; a contested name must never silently become the identity string.`,
          );
        }
      }
      if (kind === "relationship") {
        if (
          typeof entry.predicate !== "string" ||
          !(EARTHROOT_PREDICATES as readonly string[]).includes(entry.predicate)
        ) {
          push("payload-relationship-predicate", `${label}.predicate is not governed.`);
        }
        if (!isMeaningfulText(entry.objectCanonicalPublicId)) {
          push("payload-relationship-object", `${label}.objectCanonicalPublicId is required.`);
        }
        if (
          typeof entry.objectEntityType !== "string" ||
          !(EARTHROOT_ENTITY_TYPES as readonly string[]).includes(entry.objectEntityType)
        ) {
          push(
            "payload-relationship-object-type",
            `${label}.objectEntityType must be a governed EarthRoot entity type; an empty or unknown class must never be published.`,
          );
        }
        if (
          typeof entry.reviewState !== "string" ||
          !(EARTHROOT_REVIEW_STATES as readonly string[]).includes(entry.reviewState)
        ) {
          push("payload-relationship-review-state", `${label}.reviewState is not governed.`);
        }
        if (typeof entry.disputed !== "boolean") {
          push("payload-relationship-disputed", `${label}.disputed must be boolean.`);
        }
      }
    });
  }

  const spatial = findForbiddenSpatialKey(payload);
  if (spatial) {
    push(
      "payload-no-spatial-data",
      `rootPayload carries the prohibited spatial key "${spatial}". Chunk 15A exposes no coordinates or geometry.`,
    );
  }

  return violations;
}
