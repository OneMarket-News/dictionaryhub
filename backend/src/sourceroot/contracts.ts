/**
 * SourceRoot Shared Grammar and Root Integration Contracts, version 1.
 *
 * This module is the single entry point for the SourceRoot network grammar. It
 * declares the independent version axes, the Root integration contract that
 * EarthRoot and other future network consumers can rely on, the frozen
 * released baselines, and the migration policy.
 *
 * SCOPE OF THIS STAGE: contract-only, migration-free, Root-preserving,
 * non-merging, provenance-first. Nothing here reinterprets released
 * persistence to make the contracts look cleaner.
 */

import {
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
  describeAddressFormat,
} from "./addressing.js";
import {
  PERSISTENCE_TO_NETWORK_OBJECT_TYPES,
  SOURCEROOT_OBJECT_TYPES,
  SOURCEROOT_OBJECT_TYPE_DEFINITIONS,
  SOURCEROOT_OBJECT_TYPE_MATURITIES,
  SOURCEROOT_AVAILABILITY_STATES,
} from "./object-types.js";
import {
  SOURCEROOT_CONTRACT_VERSION,
  buildObjectTypeMaturityMatrix,
  describeRootRegistry,
  getRootRegistryEntry,
  validateRootRegistry,
  type RootRegistryEntry,
} from "./root-registry.js";
import { describeIdentityAssertionContract } from "./identity-assertions.js";
import {
  SOURCEROOT_MAX_PAGE_SIZE,
  describeQueryVocabulary,
} from "./query-vocabulary.js";
import {
  ROOT_PAYLOAD_FORBIDDEN_KEYS,
  ROOT_PAYLOAD_MAX_DEPTH,
  ROOT_PAYLOAD_MAX_KEYS,
  SOURCEROOT_RESULT_STATUSES,
} from "./response-envelope.js";

export * from "./addressing.js";
export * from "./object-types.js";
export * from "./root-registry.js";
export * from "./identity-assertions.js";
export * from "./query-vocabulary.js";
export * from "./response-envelope.js";

export const SOURCEROOT_CONTRACT_NAME =
  "SourceRoot Shared Grammar and Root Integration Contracts v1" as const;

/**
 * Three INDEPENDENT version axes. None of them implies the others.
 */
export const SOURCEROOT_VERSION_AXES = {
  sourcerootContract: SOURCEROOT_CONTRACT_VERSION,
  addressFormat: SOURCEROOT_ADDRESS_FORMAT_VERSION,
  rootContract: "declared per Root in the Root registry",
} as const;

export const SOURCEROOT_VERSIONING_RULES = [
  "All three version axes are SemVer-compatible and move independently.",
  "Vocabularies are append-only inside a major version.",
  "A released enum value's meaning is never redefined.",
  "An unknown enum value is preserved verbatim and reported as unknown; it is never coerced or dropped.",
  "Released Chunk 14A and 14B semantics are frozen regardless of any future contract version.",
  "Development runtime readiness stays at 1.4.0; this stage adds no new readiness capability.",
] as const;

/**
 * Released baselines that must remain exact. This contract stage changes no
 * dataset, no count, and no released semantics.
 */
export const FROZEN_RELEASED_BASELINES = {
  chunk14A: {
    datasetId: "sourceroot-cross-root-lexical-evidence-v1",
    resources: 1568,
    links: 2233,
    evidence: 2765,
    dictionaryToHistoryLinks: 1431,
    dictionaryToBibleLinks: 802,
    historyOccurrences: 1790,
    bibleOccurrences: 975,
  },
  chunk14B: {
    datasetId: "sourceroot-cross-root-source-backed-relationships-v1",
    assertions: 143,
    evidence: 178,
    subjectResources: 101,
    objectResources: 76,
    causal: 22,
    nonCausal: 121,
    sameRoot: 143,
    crossRoot: 0,
    directlySourced: 143,
    unreviewed: 143,
    uncertain: 143,
    disputed: 0,
    resourceReuse: 280,
    resourceAdditions: 0,
  },
  developmentRuntimeReadinessContractVersion: "1.4.0",
} as const;

export const SOURCEROOT_MIGRATION_POLICY = {
  migration018: "frozen-unchanged",
  migration019: "identity-assertion-compatible-unchanged",
  migration020: "deferred-absent",
  note: "Chunk 14C is migration-free. Migration 020 is explicitly deferred and must remain absent.",
} as const;

/**
 * Schema pressure this stage discovered but deliberately did not solve.
 * These are future migration considerations, not 14C work.
 */
export const DEFERRED_SCHEMA_TRIGGERS = [
  {
    trigger: "hardcoded Root CHECK constraint",
    location:
      "backend/db/migrations/018_create_cross_root_link_foundation.sql (cross_root_resources.root_id)",
    consequence:
      "A new Root such as EarthRoot cannot own a cross-Root resource without a migration.",
  },
  {
    trigger: "hardcoded resource types",
    location:
      "backend/db/migrations/018_create_cross_root_link_foundation.sql (ck_cross_root_resource_type)",
    consequence:
      "Root-to-resource-type pairing is fixed in the schema, so new network object types cannot be persisted.",
  },
  {
    trigger: "absence of an identity relationship family",
    location:
      "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql (relationship_family CHECK)",
    consequence:
      "Identity assertions have no persisted family; they cannot yet be stored as a distinct governed kind.",
  },
  {
    trigger: "unconstrained predicate TEXT",
    location:
      "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql (predicate)",
    consequence:
      "Database-level identity predicate control is not implemented. The vocabulary is enforced only at the contract layer.",
  },
  {
    trigger: "dataset-scoped resource uniqueness",
    location:
      "backend/db/migrations/018_create_cross_root_link_foundation.sql (uq_cross_root_resource_canonical)",
    consequence:
      "Resource identity is dataset-scoped, which is exactly why address format v1 requires dataset qualification.",
  },
] as const;

/* -------------------------------------------------------------------------
 * Root integration contract
 * ---------------------------------------------------------------------- */

export interface RootIntegrationContract {
  readonly rootId: string;
  readonly displayName: string;
  readonly lifecycle: RootRegistryEntry["lifecycle"];
  readonly networkRuntimeState: RootRegistryEntry["networkRuntimeState"];
  readonly sourcerootContractVersion: string;
  readonly rootContractVersion: string | null;
  readonly addressFormatVersion: string;
  readonly canonicalNetworkBaseLocation: string | null;
  readonly canonicalExperienceLocation: string | null;
  readonly datasets: RootRegistryEntry["datasets"];
  readonly objectTypes: RootRegistryEntry["objectTypes"];
  readonly capabilities: RootRegistryEntry["capabilities"];
  readonly queryCapabilities: {
    readonly temporal: boolean;
    readonly spatial: boolean;
    readonly filtering: boolean;
    readonly pagination: boolean;
    readonly sorting: boolean;
    readonly maxPageSize: number;
  };
  readonly provenanceCapabilities: {
    readonly provenanceInspection: boolean;
    readonly evidenceInspection: boolean;
    readonly uncertaintyExposure: boolean;
    readonly reviewStateExposure: boolean;
  };
  readonly identityAssertionSupport: {
    readonly participates: boolean;
    readonly predicates: readonly string[];
    readonly transitivity: "non_transitive";
  };
  readonly mutationSupport: false;
  readonly availabilityStates: typeof SOURCEROOT_AVAILABILITY_STATES;
  readonly unsupportedIsNotEmpty: true;
  readonly notes: string;
}

export function buildRootIntegrationContract(
  rootId: string,
): RootIntegrationContract | undefined {
  const entry = getRootRegistryEntry(rootId);
  if (!entry) return undefined;

  return {
    rootId: entry.rootId,
    displayName: entry.displayName,
    lifecycle: entry.lifecycle,
    networkRuntimeState: entry.networkRuntimeState,
    sourcerootContractVersion: entry.sourcerootContractVersion,
    rootContractVersion: entry.rootContractVersion,
    addressFormatVersion: entry.addressFormatVersion,
    canonicalNetworkBaseLocation: entry.canonicalNetworkBaseLocation,
    canonicalExperienceLocation: entry.canonicalExperienceLocation,
    datasets: entry.datasets,
    objectTypes: entry.objectTypes,
    capabilities: entry.capabilities,
    queryCapabilities: {
      temporal: entry.capabilities.temporalQuery,
      spatial: entry.capabilities.spatialQuery,
      filtering: entry.capabilities.filtering,
      pagination: entry.capabilities.pagination,
      sorting: entry.capabilities.sorting,
      maxPageSize: SOURCEROOT_MAX_PAGE_SIZE,
    },
    provenanceCapabilities: {
      provenanceInspection: entry.capabilities.provenanceInspection,
      evidenceInspection: entry.capabilities.evidenceInspection,
      uncertaintyExposure: entry.capabilities.uncertaintyExposure,
      reviewStateExposure: entry.capabilities.provenanceInspection,
    },
    identityAssertionSupport: {
      participates: entry.capabilities.identityAssertionParticipation,
      predicates: describeIdentityAssertionContract().predicates,
      transitivity: "non_transitive",
    },
    mutationSupport: false,
    availabilityStates: SOURCEROOT_AVAILABILITY_STATES,
    unsupportedIsNotEmpty: true,
    notes: entry.notes,
  };
}

export function listRootIntegrationContracts(): readonly RootIntegrationContract[] {
  return describeRootRegistry()
    .roots.map((entry) => buildRootIntegrationContract(entry.rootId))
    .filter((contract): contract is RootIntegrationContract =>
      contract !== undefined,
    );
}

/**
 * The full contract description served by the discovery surface.
 */
export function describeSourceRootContract() {
  return {
    contractName: SOURCEROOT_CONTRACT_NAME,
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    versionAxes: SOURCEROOT_VERSION_AXES,
    versioningRules: SOURCEROOT_VERSIONING_RULES,
    scope: {
      contractOnly: true,
      migrationFree: true,
      rootPreserving: true,
      nonMerging: true,
      provenanceFirst: true,
    },
    identityModel: {
      layer1: "Root-owned resource. Belongs to exactly one Root; never silently merged, rewritten, deduplicated, or reassigned.",
      layer2: "Identity assertion. Explicit, evidence-backed, non-transitive, withdrawable; remains an assertion.",
      layer3: "Governed shared identity. Future governance grammar only; not persisted, inferred, or exposed in this stage.",
    },
    address: describeAddressFormat(),
    objectTypes: {
      vocabulary: SOURCEROOT_OBJECT_TYPES,
      definitions: SOURCEROOT_OBJECT_TYPE_DEFINITIONS,
      maturities: SOURCEROOT_OBJECT_TYPE_MATURITIES,
      availabilityStates: SOURCEROOT_AVAILABILITY_STATES,
      maturityRule:
        "DEFINED, IMPLEMENTED, and PROVIDED are distinct. A database table existing somewhere does not make a network object PROVIDED.",
      unsupportedVersusEmpty:
        "An unsupported object type is not an empty result. Empty means the Root answered and found nothing.",
      persistenceToNetworkMappings: PERSISTENCE_TO_NETWORK_OBJECT_TYPES,
      persistenceMappingRule:
        "Released persistence names are never renamed. Future Root adapters must use these explicit mappings rather than inventing their own.",
      matrix: buildObjectTypeMaturityMatrix(),
    },
    roots: describeRootRegistry(),
    rootIntegrationContracts: listRootIntegrationContracts(),
    identityAssertions: describeIdentityAssertionContract(),
    query: describeQueryVocabulary(),
    responseEnvelope: {
      statuses: SOURCEROOT_RESULT_STATUSES,
      partialResults: "first-class",
      rule: "A Root that fails is reported with a reason. It never silently disappears.",
      accountingInvariant:
        "Every requested Root is accounted for exactly once, as responding or as unavailable. Never neither, never both. Status is derived from validated accounting and cannot be supplied by a caller.",
      rootPayloadBoundary: {
        allowed: "Root-public contract data only.",
        enforcementKind: "generic denylist",
        isAuthorizationBoundary: false,
        forbiddenKeys: ROOT_PAYLOAD_FORBIDDEN_KEYS,
        maxDepth: ROOT_PAYLOAD_MAX_DEPTH,
        maxKeys: ROOT_PAYLOAD_MAX_KEYS,
        note: "Private database rows, internal table shape, implementation-only columns, and private service objects are excluded. This generic denylist is a floor, NOT an authorization boundary.",
        beforeAdaptersRequirement:
          "Before Chunks 17A-17C emit real Root payloads, each adapter must define an adapter-owned public schema with allowlisted fields, finite numeric validation, size limits, no storage-row passthrough, no private implementation fields, and no secret-bearing fields.",
      },
    },
    frozenReleasedBaselines: FROZEN_RELEASED_BASELINES,
    migrationPolicy: SOURCEROOT_MIGRATION_POLICY,
    deferredSchemaTriggers: DEFERRED_SCHEMA_TRIGGERS,
    registryViolations: validateRootRegistry(),
    semanticConclusion: null,
  };
}
