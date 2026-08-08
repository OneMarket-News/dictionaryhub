/**
 * The authoritative SourceRoot network Root registry.
 *
 * This registry is authoritative GOING FORWARD. Existing hardcoded Root lists
 * elsewhere in the repository are compatibility debt to be reconciled by a
 * later governed migration; this stage documents the convergence path and
 * rewrites none of them.
 *
 * HONESTY RULE: a Root must not claim a capability it cannot satisfy. In this
 * contract-only stage no Root exposes the SourceRoot network contract at all,
 * so every Root reports `networkRuntimeState: "not-implemented"` and every
 * network capability is false. Root adapters arrive in Chunks 17A-17C.
 */

import {
  checkVersionSyntax,
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
} from "./addressing.js";
import {
  buildUnprovidedObjectTypeMatrix,
  validateObjectTypeProvision,
  type SourceRootObjectType,
  type SourceRootObjectTypeProvision,
} from "./object-types.js";

export const SOURCEROOT_CONTRACT_VERSION = "1.0.0" as const;

export const OPERATIONAL_ROOT_IDS = [
  "DictionaryRoot",
  "HistoryRoot",
  "BibleRoot",
] as const;

export const PLANNED_ROOT_IDS = [
  "EarthRoot",
  "TimeRoot",
  "PersonRoot",
  "LanguageRoot",
] as const;

export const SOURCEROOT_ROOT_IDS = [
  ...OPERATIONAL_ROOT_IDS,
  ...PLANNED_ROOT_IDS,
] as const;

export type SourceRootRootId = (typeof SOURCEROOT_ROOT_IDS)[number];

export type RootLifecycleState = "operational" | "planned";

/**
 * The Root's state with respect to the SourceRoot NETWORK contract, which is
 * not the same thing as whether the Root product works.
 */
export type RootNetworkRuntimeState =
  | "available"
  | "unavailable"
  | "awaiting-data"
  | "not-implemented";

export interface SourceRootDatasetDescriptor {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly rootId: SourceRootRootId;
  readonly description: string;
}

export interface RootCapabilityDeclaration {
  readonly temporalQuery: boolean;
  readonly spatialQuery: boolean;
  readonly provenanceInspection: boolean;
  readonly evidenceInspection: boolean;
  readonly uncertaintyExposure: boolean;
  readonly identityAssertionParticipation: boolean;
  readonly mutation: boolean;
  readonly filtering: boolean;
  readonly pagination: boolean;
  readonly sorting: boolean;
}

const NO_NETWORK_CAPABILITIES: RootCapabilityDeclaration = {
  temporalQuery: false,
  spatialQuery: false,
  provenanceInspection: false,
  evidenceInspection: false,
  uncertaintyExposure: false,
  identityAssertionParticipation: false,
  mutation: false,
  filtering: false,
  pagination: false,
  sorting: false,
};

export interface RootRegistryEntry {
  readonly rootId: SourceRootRootId;
  readonly displayName: string;
  readonly lifecycle: RootLifecycleState;
  readonly networkRuntimeState: RootNetworkRuntimeState;
  readonly sourcerootContractVersion: typeof SOURCEROOT_CONTRACT_VERSION;
  /** Null exactly when the Root has no contract yet, i.e. planned Roots. */
  readonly rootContractVersion: string | null;
  readonly addressFormatVersion: typeof SOURCEROOT_ADDRESS_FORMAT_VERSION;
  /** Null until a Root exposes a SourceRoot network base location. */
  readonly canonicalNetworkBaseLocation: string | null;
  /** Released customer entry point, where one exists. */
  readonly canonicalExperienceLocation: string | null;
  readonly datasets: readonly SourceRootDatasetDescriptor[];
  readonly objectTypes: readonly SourceRootObjectTypeProvision[];
  readonly capabilities: RootCapabilityDeclaration;
  readonly notes: string;
}

const NETWORK_NOT_IMPLEMENTED_EVIDENCE =
  "No SourceRoot network adapter exists for this Root in contract v1.";

function operationalRoot(options: {
  rootId: (typeof OPERATIONAL_ROOT_IDS)[number];
  displayName: string;
  canonicalExperienceLocation: string;
  datasets: readonly SourceRootDatasetDescriptor[];
  implementedObjectTypes: readonly SourceRootObjectType[];
  notes: string;
}): RootRegistryEntry {
  return {
    rootId: options.rootId,
    displayName: options.displayName,
    lifecycle: "operational",
    networkRuntimeState: "not-implemented",
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    rootContractVersion: "1.0.0",
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    canonicalNetworkBaseLocation: null,
    canonicalExperienceLocation: options.canonicalExperienceLocation,
    datasets: options.datasets,
    objectTypes: buildUnprovidedObjectTypeMatrix(
      NETWORK_NOT_IMPLEMENTED_EVIDENCE,
      options.implementedObjectTypes,
    ),
    capabilities: NO_NETWORK_CAPABILITIES,
    notes: options.notes,
  };
}

function plannedRoot(
  rootId: (typeof PLANNED_ROOT_IDS)[number],
  displayName: string,
  notes: string,
): RootRegistryEntry {
  return {
    rootId,
    displayName,
    lifecycle: "planned",
    networkRuntimeState: "not-implemented",
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    rootContractVersion: null,
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    canonicalNetworkBaseLocation: null,
    canonicalExperienceLocation: null,
    datasets: [],
    objectTypes: buildUnprovidedObjectTypeMatrix(
      `${displayName} is planned and has no implementation.`,
      [],
    ),
    capabilities: NO_NETWORK_CAPABILITIES,
    notes,
  };
}

export const SOURCEROOT_ROOT_REGISTRY: readonly RootRegistryEntry[] = [
  operationalRoot({
    rootId: "DictionaryRoot",
    displayName: "DictionaryRoot",
    canonicalExperienceLocation: "dictionaryroot.html",
    datasets: [
      {
        datasetId: "dictionaryroot-core-lexical-corpus-v1",
        datasetVersion: "1.0.0",
        rootId: "DictionaryRoot",
        description: "Released core lexical corpus.",
      },
    ],
    implementedObjectTypes: ["lexical-entry"],
    notes:
      "Released lemma resources exist and a Chunk 17A-17C adapter can wrap them, but nothing is exposed through the SourceRoot network contract yet.",
  }),
  operationalRoot({
    rootId: "HistoryRoot",
    displayName: "HistoryRoot",
    canonicalExperienceLocation: "historyroot.html",
    datasets: [
      {
        datasetId: "historyroot-plymouth-knowledge-dataset-v1",
        datasetVersion: "1.3.0",
        rootId: "HistoryRoot",
        description:
          "Released bounded Plymouth and Wampanoag regional knowledge dataset.",
      },
    ],
    implementedObjectTypes: ["historical-record"],
    notes:
      "Released accepted contextual records exist with review state, uncertainty, and provenance. None of it is exposed through the SourceRoot network contract yet.",
  }),
  operationalRoot({
    rootId: "BibleRoot",
    displayName: "BibleRoot",
    canonicalExperienceLocation: "bibleroot.html",
    datasets: [
      {
        datasetId: "bibleroot-foundation-v1",
        datasetVersion: "1.0.0",
        rootId: "BibleRoot",
        description: "Released edition and verse foundation.",
      },
      {
        datasetId: "br-dataset-original-language-foundation-v1",
        datasetVersion: "1.0.0",
        rootId: "BibleRoot",
        description: "Released original-language foundation.",
      },
      {
        datasetId: "bibleroot-translation-comparison-v1",
        datasetVersion: "1.0.0",
        rootId: "BibleRoot",
        description: "Released translation comparison dataset.",
      },
      {
        datasetId: "bibleroot-commentary-interpretation-provenance-v1",
        datasetVersion: "1.0.0",
        rootId: "BibleRoot",
        description:
          "Released commentary and interpretation provenance dataset.",
      },
    ],
    implementedObjectTypes: ["scripture-passage"],
    notes:
      "Released edition-scoped verse texts exist. None of it is exposed through the SourceRoot network contract yet.",
  }),
  plannedRoot(
    "EarthRoot",
    "EarthRoot",
    "Planned. EarthRoot will implement spatial semantics in a later chunk. It is not implemented, provides nothing, and must never report ready in this stage.",
  ),
  plannedRoot(
    "TimeRoot",
    "TimeRoot",
    "Planned. The temporal vocabulary in this contract exists for later adapters; TimeRoot itself is not implemented.",
  ),
  plannedRoot(
    "PersonRoot",
    "PersonRoot",
    "Planned. Not implemented and provides nothing.",
  ),
  plannedRoot(
    "LanguageRoot",
    "LanguageRoot",
    "Planned. Not implemented and provides nothing.",
  ),
];

/**
 * Cross-Root datasets are NOT owned by any single Root. They are listed
 * separately so that Layer 1 Root ownership stays unambiguous.
 */
export const SOURCEROOT_SHARED_DATASETS = [
  {
    datasetId: "sourceroot-cross-root-lexical-evidence-v1",
    datasetVersion: "1.0.0",
    ownership: "cross-root" as const,
    description:
      "Chunk 14A deterministic lexical evidence. Discovery evidence only; it can never establish identity.",
  },
  {
    datasetId: "sourceroot-cross-root-source-backed-relationships-v1",
    datasetVersion: "1.0.0",
    ownership: "cross-root" as const,
    description:
      "Chunk 14B source-backed relationship assertions. Same-Root only; no cross-Root assertion exists.",
  },
] as const;

export function isSourceRootRootId(value: unknown): value is SourceRootRootId {
  return (
    typeof value === "string" &&
    (SOURCEROOT_ROOT_IDS as readonly string[]).includes(value)
  );
}

export function listRootRegistry(): readonly RootRegistryEntry[] {
  return SOURCEROOT_ROOT_REGISTRY;
}

export function getRootRegistryEntry(
  rootId: string,
): RootRegistryEntry | undefined {
  return SOURCEROOT_ROOT_REGISTRY.find((entry) => entry.rootId === rootId);
}

/**
 * A Root is "ready" only when it actually answers over the SourceRoot network
 * contract. Nothing is ready in contract v1.
 */
export function isRootReady(entry: RootRegistryEntry): boolean {
  return entry.networkRuntimeState === "available";
}

/* -------------------------------------------------------------------------
 * Runtime Root identity and contract-version validation
 *
 * A final independent replay proved that the response envelope trusted Root
 * identifiers and Root contract versions that merely existed as properties.
 * A TypeScript union is a compile-time convenience, not a runtime trust
 * boundary: at runtime a Root ID arrives as `unknown` and must be checked
 * against this registry, which is the sole authority.
 *
 * These helpers live here, beside the registry they consult, so no consumer
 * has to keep a second list of Root IDs or supported versions.
 * ---------------------------------------------------------------------- */

export type RootIdProblem =
  | "missing"
  | "not-a-string"
  | "blank"
  | "unregistered";

/**
 * Validates a runtime Root identifier against the governed registry.
 *
 * Matching is exact. `" DictionaryRoot"`, `"DictionaryRoot "`, and
 * `"dictionaryroot"` are all rejected: this contract defines no trimming or
 * case-folding normalization, and silently repairing a near-match would mean
 * guessing which Root a caller meant.
 */
export function checkRootId(value: unknown): RootIdProblem | null {
  if (value === undefined || value === null) return "missing";
  if (typeof value !== "string") return "not-a-string";
  if (value.trim().length === 0) return "blank";
  if (!isSourceRootRootId(value)) return "unregistered";
  return null;
}

export type RespondingRootProblem = RootIdProblem | "cannot-respond";

/**
 * Whether a registered Root may appear as a RESPONDING Root.
 *
 * Derived from registry state rather than invented: a Root can answer over the
 * integration contract only if it has a governed Root contract version, which
 * the registry grants exactly to operational Roots and withholds from planned
 * ones (`plannedRoot` sets `rootContractVersion: null`).
 *
 * `networkRuntimeState` is deliberately NOT the gate. In contract v1 every
 * Root reports `not-implemented` because no adapter exists yet, so gating on
 * it would make the envelope unusable by the very adapters it is being
 * defined for. Registry membership alone is likewise not enough. The
 * contract-version test is the registry's own statement of which Roots
 * participate in the integration contract at all.
 */
export function checkRespondingRoot(
  value: unknown,
): RespondingRootProblem | null {
  const idProblem = checkRootId(value);
  if (idProblem !== null) return idProblem;
  const entry = getRootRegistryEntry(value as string);
  if (!entry || entry.rootContractVersion === null) return "cannot-respond";
  return null;
}

export function canRootRespond(value: unknown): boolean {
  return checkRespondingRoot(value) === null;
}

export type RootContractVersionProblem =
  | "missing"
  | "not-a-string"
  | "blank"
  | "malformed"
  | "unsupported"
  | "unexpected";

/**
 * Validates a Root contract version against what the registry declares for
 * THAT Root.
 *
 * A syntactically valid version is not enough: `"2.0.0"` is well formed and
 * still wrong if the registry says the Root speaks `"1.0.0"`. A planned Root
 * declares `null`, and claiming any version for it is `unexpected`.
 */
export function checkRootContractVersion(
  rootId: unknown,
  value: unknown,
): RootContractVersionProblem | RootIdProblem | null {
  const idProblem = checkRootId(rootId);
  if (idProblem !== null) return idProblem;

  const entry = getRootRegistryEntry(rootId as string);
  const declared = entry ? entry.rootContractVersion : null;

  if (declared === null) {
    // The registry grants this Root no contract version, so only null is
    // truthful. Anything else is a claim the registry does not support.
    return value === null || value === undefined ? null : "unexpected";
  }

  const syntaxProblem = checkVersionSyntax(value);
  if (syntaxProblem !== null) return syntaxProblem;
  if (value !== declared) return "unsupported";
  return null;
}

/** The version the registry declares for a Root, or null when it has none. */
export function supportedRootContractVersion(rootId: string): string | null {
  return getRootRegistryEntry(rootId)?.rootContractVersion ?? null;
}

export interface RootRegistryViolation {
  readonly rootId: string;
  readonly rule: string;
  readonly message: string;
}

/**
 * Truthfulness invariants. These are the rules that stop the registry from
 * quietly overstating what the platform can do.
 */
export function validateRootRegistryEntry(
  entry: RootRegistryEntry,
): readonly RootRegistryViolation[] {
  const violations: RootRegistryViolation[] = [];
  const fail = (rule: string, message: string) =>
    violations.push({ rootId: entry.rootId, rule, message });

  if (!isSourceRootRootId(entry.rootId)) {
    fail("root-id-registered", `${entry.rootId} is not a registered Root.`);
  }

  const isPlanned = entry.lifecycle === "planned";

  if (isPlanned && isRootReady(entry)) {
    fail(
      "planned-root-cannot-be-ready",
      "A planned Root must never report a ready or available network runtime state.",
    );
  }

  if (isPlanned && entry.rootContractVersion !== null) {
    fail(
      "planned-root-has-no-contract-version",
      "A planned Root has no Root contract version yet.",
    );
  }

  if (isPlanned && entry.datasets.length > 0) {
    fail(
      "planned-root-has-no-datasets",
      "A planned Root must not declare datasets.",
    );
  }

  for (const [capability, declared] of Object.entries(entry.capabilities)) {
    if (declared && !isRootReady(entry)) {
      fail(
        "capability-requires-available-runtime",
        `${entry.rootId} declares "${capability}" while its network runtime state is "${entry.networkRuntimeState}". A Root must not claim a capability it cannot satisfy.`,
      );
    }
  }

  if (entry.capabilities.spatialQuery) {
    fail(
      "spatial-query-unsupported",
      "SourceRoot contract v1 defines spatial vocabulary only. No Root may declare spatial query support.",
    );
  }

  if (entry.capabilities.mutation) {
    fail(
      "mutation-unsupported",
      "SourceRoot contract v1 is read-only. No Root may declare mutation support.",
    );
  }

  for (const provision of entry.objectTypes) {
    for (const violation of validateObjectTypeProvision(provision)) {
      fail(violation.rule, `${provision.objectType}: ${violation.message}`);
    }
    if (provision.provided && !isRootReady(entry)) {
      fail(
        "provided-requires-available-runtime",
        `${provision.objectType} cannot be PROVIDED while the Root network runtime state is "${entry.networkRuntimeState}".`,
      );
    }
    if (isPlanned && (provision.implemented || provision.provided)) {
      fail(
        "planned-root-provides-nothing",
        `${provision.objectType} cannot be implemented or provided by a planned Root.`,
      );
    }
  }

  if (entry.sourcerootContractVersion !== SOURCEROOT_CONTRACT_VERSION) {
    fail(
      "sourceroot-contract-version",
      "Every registry entry must declare the current SourceRoot contract version.",
    );
  }

  if (entry.addressFormatVersion !== SOURCEROOT_ADDRESS_FORMAT_VERSION) {
    fail(
      "address-format-version",
      "Every registry entry must declare the current address format version.",
    );
  }

  return violations;
}

export function validateRootRegistry(): readonly RootRegistryViolation[] {
  return SOURCEROOT_ROOT_REGISTRY.flatMap(validateRootRegistryEntry);
}

/**
 * The object-type maturity matrix across every Root, in one place.
 */
export function buildObjectTypeMaturityMatrix() {
  return SOURCEROOT_ROOT_REGISTRY.map((entry) => ({
    rootId: entry.rootId,
    lifecycle: entry.lifecycle,
    networkRuntimeState: entry.networkRuntimeState,
    objectTypes: entry.objectTypes.map((provision) => ({
      objectType: provision.objectType,
      defined: provision.defined,
      implemented: provision.implemented,
      provided: provision.provided,
      availability: provision.availability,
    })),
  }));
}

/**
 * Existing hardcoded Root lists left untouched by this stage. They remain
 * compatibility debt for a later governed migration, not a 14C deliverable.
 */
export const ROOT_REGISTRY_CONVERGENCE_PATH = [
  {
    path: "backend/db/migrations/018_create_cross_root_link_foundation.sql",
    debt: "root_id CHECK constraint hardcodes the three operational Roots and resource_type is pinned per Root.",
    resolution:
      "Future governed migration. Migration 018 is frozen and is not modified by this stage.",
  },
  {
    path: "backend/src/services/cross-root-store.ts",
    debt: "ROOT_TYPES map hardcodes Root to resource-type pairs.",
    resolution:
      "Reconcile against this registry when the Chunk 17A-17C adapters land.",
  },
  {
    path: "backend/src/cross-root/lexical-evidence.ts",
    debt: "Participating Root list is hardcoded in the 14A dataset contract.",
    resolution:
      "Released 14A semantics are frozen. Reconcile only through a new dataset version.",
  },
  {
    path: "backend/src/scripts/development-runtime.ts",
    debt: "Provisioning enumerates Roots directly.",
    resolution: "Reconcile during a later governed runtime stage.",
  },
  {
    path: "assets/js/cross-root-links.js",
    debt: "Frontend Root list is hardcoded.",
    resolution: "Reconcile when a Root discovery endpoint is exposed.",
  },
  {
    path: "assets/js/sourceroot-unified-search.js",
    debt: "Unified search enumerates Roots directly.",
    resolution: "Reconcile when a Root discovery endpoint is exposed.",
  },
] as const;

export function describeRootRegistry() {
  return {
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    operationalRoots: OPERATIONAL_ROOT_IDS,
    plannedRoots: PLANNED_ROOT_IDS,
    roots: SOURCEROOT_ROOT_REGISTRY,
    sharedDatasets: SOURCEROOT_SHARED_DATASETS,
    authority:
      "This registry is authoritative going forward. Existing hardcoded Root lists remain compatibility debt for a later governed migration.",
    convergencePath: ROOT_REGISTRY_CONVERGENCE_PATH,
    readyRootCount: SOURCEROOT_ROOT_REGISTRY.filter(isRootReady).length,
    semanticConclusion: null,
  } as const;
}
