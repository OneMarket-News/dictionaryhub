/**
 * SourceRoot network query vocabulary: temporal, spatial, filtering,
 * pagination, sorting, and unknown-value tolerance.
 *
 * This module defines vocabulary only. It reuses the existing repository
 * pagination and sort contract from `lib/query-params.ts` rather than
 * introducing a second API style, and it implements no spatial semantics
 * whatsoever.
 */

import {
  historicalDatePrecisions,
  temporalKinds,
  temporalRoles,
} from "../contextual-types.js";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  parsePagination,
  parseSort,
  isQueryParameterError,
  type PaginationQuery,
  type QueryParameterError,
  type SortQuery,
} from "../lib/query-params.js";

export {
  parsePagination,
  parseSort,
  isQueryParameterError,
  type PaginationQuery,
  type QueryParameterError,
  type SortQuery,
};

export const SOURCEROOT_DEFAULT_PAGE = DEFAULT_PAGE;
export const SOURCEROOT_DEFAULT_PAGE_SIZE = DEFAULT_LIMIT;
export const SOURCEROOT_MAX_PAGE_SIZE = MAX_LIMIT;

/* -------------------------------------------------------------------------
 * Temporal contract
 *
 * REUSES THE RELEASED SOURCEROOT TEMPORAL VOCABULARY DIRECTLY. This contract
 * introduces no parallel temporal ontology and defines no alias that would
 * need a mapping, because a mapping is a place for meaning to be lost.
 *
 *   mode      = released `temporalKinds` plus `not_asserted` for network
 *               honesty about the absence of a temporal claim.
 *   timeRole  = released `temporalRoles`, verbatim and closed.
 *   precision = OPEN source-native string. The released corpora carry values
 *               such as "approximate-range", "competing-year", and
 *               "bounded approximate start" alongside the enumerated
 *               `historicalDatePrecisions`, so a closed enum here would reject
 *               released data.
 *   calendar  = OPEN source-native string. Released corpora carry values such
 *               as "historical-chronology", "English Old Style (Julian)", and
 *               "relative source chronology".
 *
 * Query operators are kept deliberately separate from persisted temporal
 * semantics: an operator is a question, not a claim about a record.
 *
 * TimeRoot is NOT implemented here.
 * ---------------------------------------------------------------------- */

/**
 * Absence of a temporal claim. This is the only value this contract adds to
 * the released `temporalKinds` vocabulary, and it exists so the network can
 * say "the source asserted nothing" instead of staying silent.
 */
export const TEMPORAL_MODE_NOT_ASSERTED = "not_asserted" as const;

export const SOURCEROOT_TEMPORAL_MODES = [
  ...temporalKinds,
  TEMPORAL_MODE_NOT_ASSERTED,
] as const;

export type SourceRootTemporalMode =
  (typeof SOURCEROOT_TEMPORAL_MODES)[number];

/** Query operators. Separate axis from persisted temporal semantics. */
export const SOURCEROOT_TEMPORAL_OPERATORS = [
  "at",
  "overlaps",
  "before",
  "after",
  "during",
] as const;

export type SourceRootTemporalOperator =
  (typeof SOURCEROOT_TEMPORAL_OPERATORS)[number];

/** Released time roles, reused verbatim. Closed vocabulary. */
export const SOURCEROOT_TIME_ROLES = temporalRoles;

export type SourceRootTimeRole = (typeof SOURCEROOT_TIME_ROLES)[number];

/**
 * Known precision values from the released vocabulary. This list is
 * informational: precision itself is an open source-native string, because
 * released corpora carry precisions outside this set.
 */
export const SOURCEROOT_KNOWN_TEMPORAL_PRECISIONS = historicalDatePrecisions;

/** Precision is a source-native string, never coerced into an enum. */
export type SourceRootTemporalPrecision = string;

/**
 * Known calendar identifiers. Informational only: calendar system is an open
 * source-native string. `unspecified` matches the released default.
 */
export const SOURCEROOT_KNOWN_CALENDAR_SYSTEMS = [
  "unspecified",
  "gregorian",
  "julian",
  "historical-chronology",
] as const;

/** Calendar system is a source-native string, never coerced into an enum. */
export type SourceRootCalendarSystem = string;

export interface SourceRootChronologyRange {
  /** Source-native boundary text. No normalization or inference is applied. */
  readonly earliest: string | null;
  readonly latest: string | null;
  readonly label: string | null;
}

export interface SourceRootTemporalScope {
  readonly mode: SourceRootTemporalMode;
  /** Open source-native identifier. Must be a non-empty string. */
  readonly calendarSystem: SourceRootCalendarSystem;
  /** Open source-native identifier. Must be a non-empty string. */
  readonly precision: SourceRootTemporalPrecision;
  readonly timeRole: SourceRootTimeRole;
  readonly uncertaintyStatement: string | null;
  readonly chronologyRanges: readonly SourceRootChronologyRange[];
  readonly disputed: boolean;
}

/** The scope used when a source asserts nothing about time. */
export const TEMPORAL_SCOPE_NOT_ASSERTED: SourceRootTemporalScope = {
  mode: TEMPORAL_MODE_NOT_ASSERTED,
  calendarSystem: "unspecified",
  precision: "unknown",
  timeRole: "unspecified",
  uncertaintyStatement: null,
  chronologyRanges: [],
  disputed: false,
};

export interface TemporalScopeViolation {
  readonly rule: string;
  readonly message: string;
}

/**
 * Validates a temporal scope for ASSERTION CREATION.
 *
 * Closed vocabularies (mode, timeRole) fail closed on an unknown value. Open
 * source-native fields (calendarSystem, precision) are required to be
 * non-empty but are never rejected for being outside a known list, because
 * released corpora legitimately carry values outside it.
 *
 * This is deliberately different from `resolveVocabularyValue`, which handles
 * forward-compatible RENDERING of unknown values arriving from a future
 * provider. Creation fails closed; rendering preserves.
 */
export function validateTemporalScope(
  scope: SourceRootTemporalScope,
): readonly TemporalScopeViolation[] {
  const violations: TemporalScopeViolation[] = [];

  if (!scope || typeof scope !== "object") {
    return [
      { rule: "temporal-scope-required", message: "A temporal scope is required." },
    ];
  }

  if (!(SOURCEROOT_TEMPORAL_MODES as readonly string[]).includes(scope.mode)) {
    violations.push({
      rule: "temporal-mode-vocabulary",
      message: `${String(scope.mode)} is not a defined temporal mode.`,
    });
  }

  if (!(SOURCEROOT_TIME_ROLES as readonly string[]).includes(scope.timeRole)) {
    violations.push({
      rule: "temporal-role-vocabulary",
      message: `${String(scope.timeRole)} is not a released SourceRoot time role.`,
    });
  }

  if (
    typeof scope.calendarSystem !== "string" ||
    scope.calendarSystem.trim().length === 0
  ) {
    violations.push({
      rule: "calendar-system-required",
      message:
        "calendarSystem must be a non-empty source-native identifier. It is intentionally not a closed enum.",
    });
  }

  if (typeof scope.precision !== "string" || scope.precision.trim().length === 0) {
    violations.push({
      rule: "temporal-precision-required",
      message:
        "precision must be a non-empty source-native identifier. It is intentionally not a closed enum.",
    });
  }

  if (typeof scope.disputed !== "boolean") {
    violations.push({
      rule: "temporal-dispute-flag",
      message: "disputed must be a boolean.",
    });
  }

  if (!Array.isArray(scope.chronologyRanges)) {
    violations.push({
      rule: "chronology-ranges-shape",
      message: "chronologyRanges must be an array.",
    });
  }

  if (
    scope.uncertaintyStatement !== null &&
    typeof scope.uncertaintyStatement !== "string"
  ) {
    violations.push({
      rule: "uncertainty-statement-shape",
      message: "uncertaintyStatement must be a string or null.",
    });
  }

  if (
    scope.mode === TEMPORAL_MODE_NOT_ASSERTED &&
    Array.isArray(scope.chronologyRanges) &&
    scope.chronologyRanges.length > 0
  ) {
    violations.push({
      rule: "not-asserted-carries-no-range",
      message:
        "A scope with mode not_asserted must not carry chronology ranges; that would assert what it claims not to.",
    });
  }

  return violations;
}

/**
 * Renders a temporal scope honestly.
 *
 * A missing temporal scope is never rendered as a timeless or always-true
 * claim. `not_asserted` and `unknown` both say so explicitly.
 */
export function describeTemporalScope(
  scope: SourceRootTemporalScope,
): string {
  switch (scope.mode) {
    case "not_asserted":
      return "Temporal scope is not asserted by the source. This is not a claim that the record is timeless.";
    case "unknown":
      return "Temporal scope is recorded as unknown by the source.";
    case "disputed":
      return "Temporal scope is disputed between sources.";
    case "multiple_proposed":
      return "Multiple temporal scopes are proposed and none has been accepted.";
    case "approximate":
      return "Temporal scope is approximate at the stated precision.";
    case "range":
      return "Temporal scope is a range at the stated precision.";
    case "before":
      return "Temporal scope is bounded before the stated boundary.";
    case "after":
      return "Temporal scope is bounded after the stated boundary.";
    case "exact":
      return "Temporal scope is exact at the stated precision.";
    default:
      return "Temporal scope uses a value this contract version does not define. It is preserved unchanged.";
  }
}

export function isTemporalScopeAsserted(
  scope: SourceRootTemporalScope,
): boolean {
  return scope.mode !== "not_asserted";
}

export interface SourceRootTemporalQuery {
  readonly operator: SourceRootTemporalOperator;
  /** Source-native boundary text; no calendar conversion is performed. */
  readonly boundary: string;
  readonly calendarSystem: SourceRootCalendarSystem;
  readonly precision: SourceRootTemporalPrecision;
}

/* -------------------------------------------------------------------------
 * Spatial contract - VOCABULARY ONLY
 * ---------------------------------------------------------------------- */

export const SOURCEROOT_SPATIAL_OPERATORS = [
  "at_place",
  "within",
  "contains",
  "intersects",
  "near",
] as const;

export type SourceRootSpatialOperator =
  (typeof SOURCEROOT_SPATIAL_OPERATORS)[number];

export const SOURCEROOT_SPATIAL_SUPPORT_STATE = "vocabulary-only" as const;

/**
 * Everything this contract explicitly does NOT implement. EarthRoot will
 * implement spatial semantics in a later chunk.
 */
export const SOURCEROOT_SPATIAL_IMPLEMENTATION_BOUNDARY = [
  "geometry",
  "coordinates",
  "geocoding",
  "spatial database",
  "bounding boxes",
  "map projection",
  "map user interface",
] as const;

export class SourceRootSpatialNotImplementedError extends Error {
  public readonly code = "sourceroot-spatial-not-implemented";
  constructor() {
    super(
      "SourceRoot contract v1 defines spatial query vocabulary only. No geometry, coordinate, geocoding, bounding-box, projection, or map implementation exists. EarthRoot implements spatial semantics in a later chunk.",
    );
    this.name = "SourceRootSpatialNotImplementedError";
  }
}

/**
 * Present so that any accidental spatial dependency fails loudly rather than
 * silently returning a plausible-looking answer.
 */
export function evaluateSpatialQuery(): never {
  throw new SourceRootSpatialNotImplementedError();
}

/* -------------------------------------------------------------------------
 * Filtering and sorting vocabulary
 * ---------------------------------------------------------------------- */

export const SOURCEROOT_FILTER_FIELDS = [
  "rootId",
  "objectType",
  "datasetId",
  "datasetVersion",
  "canonicalPublicId",
  "reviewState",
  "derivation",
  "disputeState",
  "temporalMode",
] as const;

export type SourceRootFilterField = (typeof SOURCEROOT_FILTER_FIELDS)[number];

export const SOURCEROOT_SORT_FIELDS = [
  "rootId",
  "objectType",
  "canonicalPublicId",
  "datasetId",
] as const;

export type SourceRootSortField = (typeof SOURCEROOT_SORT_FIELDS)[number];

export const SOURCEROOT_SORT_TIE_BREAKER = "address" as const;

/* -------------------------------------------------------------------------
 * Unknown vocabulary tolerance
 * ---------------------------------------------------------------------- */

export type VocabularyValueResolution<TKnown extends string> =
  | { readonly known: true; readonly value: TKnown }
  | {
      readonly known: false;
      readonly value: string;
      readonly handling: "preserved-as-unknown";
      readonly note: string;
    };

/**
 * Tolerates a value this contract version does not define.
 *
 * The value is preserved verbatim and reported as unknown. It is never
 * coerced into a known value, never dropped, and never replaced by a default,
 * because a released enum value's meaning must never be redefined.
 */
export function resolveVocabularyValue<TKnown extends string>(
  value: string,
  known: readonly TKnown[],
): VocabularyValueResolution<TKnown> {
  if ((known as readonly string[]).includes(value)) {
    return { known: true, value: value as TKnown };
  }
  return {
    known: false,
    value,
    handling: "preserved-as-unknown",
    note: "This value is not defined by the current SourceRoot contract version. It is preserved unchanged and not coerced.",
  };
}

export function describeQueryVocabulary() {
  return {
    temporal: {
      modes: SOURCEROOT_TEMPORAL_MODES,
      operators: SOURCEROOT_TEMPORAL_OPERATORS,
      timeRoles: SOURCEROOT_TIME_ROLES,
      knownPrecisions: SOURCEROOT_KNOWN_TEMPORAL_PRECISIONS,
      knownCalendarSystems: SOURCEROOT_KNOWN_CALENDAR_SYSTEMS,
      closedVocabularies: ["mode", "timeRole"],
      openSourceNativeFields: ["calendarSystem", "precision"],
      vocabularyOrigin:
        "mode reuses released temporalKinds plus not_asserted; timeRole reuses released temporalRoles verbatim. No alias or parallel ontology is introduced, so no mapping can lose meaning.",
      openFieldRule:
        "calendarSystem and precision are source-native strings. Released corpora carry values outside any known list, so closing them would reject released data.",
      missingScopeRule:
        "A missing temporal scope is reported as not asserted. It is never rendered as timeless truth.",
      creationValidation:
        "Assertion creation fails closed on unknown closed-vocabulary values; response rendering preserves unknown values instead.",
      timeRootImplemented: false,
    },
    spatial: {
      operators: SOURCEROOT_SPATIAL_OPERATORS,
      supportState: SOURCEROOT_SPATIAL_SUPPORT_STATE,
      implementationBoundary: SOURCEROOT_SPATIAL_IMPLEMENTATION_BOUNDARY,
      earthRootImplemented: false,
    },
    filtering: { fields: SOURCEROOT_FILTER_FIELDS },
    sorting: {
      fields: SOURCEROOT_SORT_FIELDS,
      tieBreaker: SOURCEROOT_SORT_TIE_BREAKER,
      directions: ["asc", "desc"],
    },
    pagination: {
      defaultPage: SOURCEROOT_DEFAULT_PAGE,
      defaultPageSize: SOURCEROOT_DEFAULT_PAGE_SIZE,
      maxPageSize: SOURCEROOT_MAX_PAGE_SIZE,
      contract: "reuses the existing SourceRoot collection contract",
    },
    unknownValueHandling: "preserved-as-unknown",
    semanticConclusion: null,
  } as const;
}
