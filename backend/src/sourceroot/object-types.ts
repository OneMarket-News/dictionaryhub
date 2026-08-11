/**
 * SourceRoot network object types and the three-state maturity model.
 *
 * The model deliberately separates three concepts that are easy to conflate:
 *
 *   DEFINED     The SourceRoot grammar defines the object type. Always true for
 *               every member of the vocabulary below.
 *   IMPLEMENTED A Root or runtime has an implementation capable of
 *               representing or adapting the type from released structures.
 *   PROVIDED    A Root currently exposes the type through the SourceRoot
 *               network contract.
 *
 * A database table existing somewhere does NOT make a network object PROVIDED.
 * In this contract-only stage no Root adapter exists yet (Root adapters arrive
 * in Chunks 17A-17C), so `provided` is false everywhere. `Place` is the
 * canonical illustration: DEFINED here, implemented false and provided false
 * for every current Root.
 */

export const SOURCEROOT_OBJECT_TYPES = [
  // Shared knowledge-graph grammar
  "entity",
  "source",
  "claim",
  "evidence",
  "relationship",
  "revision",
  "dataset",
  "provenance-record",
  "temporal-assertion",
  "time-span",
  "identity-assertion",
  // Domain object types
  "lexical-entry",
  "lexical-sense",
  "historical-record",
  "scripture-passage",
  "place",
  "person",
  "polity",
  "event",
  "language",
  "script",
] as const;

export type SourceRootObjectType = (typeof SOURCEROOT_OBJECT_TYPES)[number];

/**
 * The three maturity concepts, exposed as an explicit vocabulary so that no
 * consumer can collapse them into a single "bound / declared" boolean.
 */
export const SOURCEROOT_OBJECT_TYPE_MATURITIES = [
  "defined",
  "implemented",
  "provided",
] as const;

export type SourceRootObjectTypeMaturity =
  (typeof SOURCEROOT_OBJECT_TYPE_MATURITIES)[number];

/**
 * Availability is a separate axis from maturity.
 *
 * `unsupported` is NOT the same as an empty result: an empty result means the
 * Root answered the question and found nothing, while `unsupported` means the
 * Root never answered the question at all.
 */
export const SOURCEROOT_AVAILABILITY_STATES = [
  "supported",
  "unsupported",
  "unavailable",
  "awaiting-data",
] as const;

export type SourceRootAvailabilityState =
  (typeof SOURCEROOT_AVAILABILITY_STATES)[number];

export interface SourceRootObjectTypeDefinition {
  readonly objectType: SourceRootObjectType;
  readonly displayName: string;
  readonly description: string;
  /** Chunk that owns the eventual implementation, when known. */
  readonly plannedOwner: string | null;
}

export const SOURCEROOT_OBJECT_TYPE_DEFINITIONS: readonly SourceRootObjectTypeDefinition[] =
  [
    {
      objectType: "entity",
      displayName: "Entity",
      description:
        "A Root-owned entity of any kind, as that Root records it. The generic base of the shared grammar.",
      plannedOwner: null,
    },
    {
      objectType: "source",
      displayName: "Source",
      description:
        "A Root-owned source record: the document, publication, or artifact a claim rests on.",
      plannedOwner: null,
    },
    {
      objectType: "claim",
      displayName: "Claim",
      description:
        "A Root-owned assertion about the world, carrying its own review state, certainty, and provenance.",
      plannedOwner: null,
    },
    {
      objectType: "evidence",
      displayName: "Evidence",
      description:
        "A Root-owned evidence record tying a claim to an exact location in a source.",
      plannedOwner: null,
    },
    {
      objectType: "relationship",
      displayName: "Relationship",
      description:
        "A Root-owned relationship between two resources. Distinct from an identity assertion: it connects without claiming sameness.",
      plannedOwner: null,
    },
    {
      objectType: "revision",
      displayName: "Revision",
      description:
        "A Root-owned revision record capturing how a resource changed and who governed the change.",
      plannedOwner: null,
    },
    {
      objectType: "dataset",
      displayName: "Dataset",
      description:
        "A released, versioned dataset. Dataset identity and version are what make a SourceRoot address resolvable.",
      plannedOwner: null,
    },
    {
      objectType: "provenance-record",
      displayName: "Provenance record",
      description:
        "A Root-owned record of where something came from and how it was derived.",
      plannedOwner: null,
    },
    {
      objectType: "temporal-assertion",
      displayName: "Temporal assertion",
      description:
        "A Root-owned claim about when something happened, was recorded, or was valid, with calendar, precision, and uncertainty preserved.",
      plannedOwner: "TimeRoot",
    },
    {
      objectType: "lexical-entry",
      displayName: "Lexical entry",
      description:
        "A Root-owned lemma or headword with its canonical public identifier.",
      plannedOwner: "DictionaryRoot",
    },
    {
      objectType: "lexical-sense",
      displayName: "Lexical sense",
      description:
        "A Root-owned sense or meaning belonging to a lexical entry.",
      plannedOwner: "DictionaryRoot",
    },
    {
      objectType: "historical-record",
      displayName: "Historical record",
      description:
        "A Root-owned governed contextual record with review state and provenance.",
      plannedOwner: "HistoryRoot",
    },
    {
      objectType: "scripture-passage",
      displayName: "Scripture passage",
      description:
        "A Root-owned edition-scoped passage or verse text with edition provenance.",
      plannedOwner: "BibleRoot",
    },
    {
      objectType: "place",
      displayName: "Place",
      description:
        "A Root-owned place as that Root records it. Defined only; no geometry, coordinates, or spatial semantics exist in this contract.",
      plannedOwner: "EarthRoot",
    },
    {
      objectType: "person",
      displayName: "Person",
      description: "A Root-owned person as that Root records them.",
      plannedOwner: "PersonRoot",
    },
    {
      objectType: "polity",
      displayName: "Polity",
      description:
        "A Root-owned political jurisdiction, community, or governing body as that Root records it.",
      plannedOwner: "EarthRoot",
    },
    {
      objectType: "event",
      displayName: "Event",
      description: "A Root-owned event as that Root records it.",
      plannedOwner: null,
    },
    {
      objectType: "time-span",
      displayName: "Time span",
      description:
        "A Root-owned chronological span with calendar system, precision, and uncertainty.",
      plannedOwner: "TimeRoot",
    },
    {
      objectType: "language",
      displayName: "Language",
      description: "A Root-owned language record.",
      plannedOwner: "LanguageRoot",
    },
    {
      objectType: "script",
      displayName: "Script",
      description:
        "A Root-owned writing system or script record, kept distinct from language.",
      plannedOwner: "LanguageRoot",
    },
    {
      objectType: "identity-assertion",
      displayName: "Identity assertion",
      description:
        "An explicit, evidence-backed, withdrawable assertion connecting two separate Root-owned resources. It never merges them.",
      plannedOwner: "SourceRoot",
    },
  ];

export interface SourceRootObjectTypeProvision {
  readonly objectType: SourceRootObjectType;
  /** Always true: membership in the vocabulary is what DEFINED means. */
  readonly defined: true;
  readonly implemented: boolean;
  readonly provided: boolean;
  readonly availability: SourceRootAvailabilityState;
  /** Honest, repository-grounded justification for the state above. */
  readonly evidence: string;
}

export function isSourceRootObjectType(
  value: unknown,
): value is SourceRootObjectType {
  return (
    typeof value === "string" &&
    (SOURCEROOT_OBJECT_TYPES as readonly string[]).includes(value)
  );
}

export function getObjectTypeDefinition(
  objectType: string,
): SourceRootObjectTypeDefinition | undefined {
  return SOURCEROOT_OBJECT_TYPE_DEFINITIONS.find(
    (definition) => definition.objectType === objectType,
  );
}

/**
 * Returns the highest maturity a provision has reached. Callers that need the
 * individual axes must read them individually; this helper exists so that
 * display surfaces do not invent their own ordering.
 */
export function highestMaturity(
  provision: SourceRootObjectTypeProvision,
): SourceRootObjectTypeMaturity {
  if (provision.provided) return "provided";
  if (provision.implemented) return "implemented";
  return "defined";
}

/**
 * An empty result is only meaningful when the Root actually supports the
 * question. Consumers must call this before rendering "no results".
 */
export function isEmptyResultMeaningful(
  availability: SourceRootAvailabilityState,
): boolean {
  return availability === "supported";
}

export interface ObjectTypeProvisionViolation {
  readonly rule: string;
  readonly message: string;
}

/**
 * Invariants that keep the three maturity states from being conflated.
 */
export function validateObjectTypeProvision(
  provision: SourceRootObjectTypeProvision,
): readonly ObjectTypeProvisionViolation[] {
  const violations: ObjectTypeProvisionViolation[] = [];

  if (!isSourceRootObjectType(provision.objectType)) {
    violations.push({
      rule: "object-type-defined",
      message: `${String(provision.objectType)} is not a defined SourceRoot object type.`,
    });
  }

  if (provision.defined !== true) {
    violations.push({
      rule: "defined-is-invariant",
      message:
        "Every object type in the vocabulary is DEFINED; `defined` cannot be false.",
    });
  }

  if (provision.provided && !provision.implemented) {
    violations.push({
      rule: "provided-implies-implemented",
      message: `${provision.objectType} cannot be PROVIDED without being IMPLEMENTED.`,
    });
  }

  if (!provision.provided && provision.availability === "supported") {
    violations.push({
      rule: "supported-implies-provided",
      message: `${provision.objectType} cannot report availability "supported" while it is not PROVIDED.`,
    });
  }

  if (
    !(SOURCEROOT_AVAILABILITY_STATES as readonly string[]).includes(
      provision.availability,
    )
  ) {
    violations.push({
      rule: "availability-vocabulary",
      message: `${String(provision.availability)} is not a defined availability state.`,
    });
  }

  return violations;
}

/* -------------------------------------------------------------------------
 * Persistence-to-network object type mappings
 *
 * Released persistence uses its own names (see migration 018
 * `ck_cross_root_resource_type`). The network grammar uses public names. That
 * translation is legitimate, but it must be EXPLICIT rather than implied, so
 * that a future adapter cannot quietly invent its own mapping.
 *
 * Released persistence names are NOT renamed. Migration 018 is not modified.
 * No released record is changed.
 * ---------------------------------------------------------------------- */

export interface PersistenceToNetworkMapping {
  /** Exact released persistence `resource_type` value. */
  readonly persistenceResourceType: string;
  /** Root that owns the persisted type, per migration 018. */
  readonly rootId: string;
  readonly networkObjectType: SourceRootObjectType;
}

export const PERSISTENCE_TO_NETWORK_OBJECT_TYPES: readonly PersistenceToNetworkMapping[] =
  [
    {
      persistenceResourceType: "lemma",
      rootId: "DictionaryRoot",
      networkObjectType: "lexical-entry",
    },
    {
      persistenceResourceType: "accepted-contextual-record",
      rootId: "HistoryRoot",
      networkObjectType: "historical-record",
    },
    {
      persistenceResourceType: "edition-verse-text",
      rootId: "BibleRoot",
      networkObjectType: "scripture-passage",
    },
    // Chunk 15A. EarthRoot persists Place and Polity under migration 020 and
    // declares the mapping here rather than inventing its own, as this table
    // requires. Declaring a mapping is not a maturity claim: `place` and
    // `polity` remain DEFINED, EarthRoot remains a planned Root, and nothing
    // here marks either type IMPLEMENTED or PROVIDED.
    {
      persistenceResourceType: "place",
      rootId: "EarthRoot",
      networkObjectType: "place",
    },
    {
      persistenceResourceType: "polity",
      rootId: "EarthRoot",
      networkObjectType: "polity",
    },
  ];

/**
 * Resolves a released persistence resource type to its network object type.
 * Future Root adapters MUST use this mapping rather than inventing their own.
 */
export function networkObjectTypeForPersistenceType(
  persistenceResourceType: string,
): SourceRootObjectType | undefined {
  return PERSISTENCE_TO_NETWORK_OBJECT_TYPES.find(
    (mapping) => mapping.persistenceResourceType === persistenceResourceType,
  )?.networkObjectType;
}

/** Reverse lookup. Deterministic: the mapping is one-to-one. */
export function persistenceTypeForNetworkObjectType(
  networkObjectType: string,
): string | undefined {
  return PERSISTENCE_TO_NETWORK_OBJECT_TYPES.find(
    (mapping) => mapping.networkObjectType === networkObjectType,
  )?.persistenceResourceType;
}

/**
 * Builds the fully-defined, nothing-provided provision set used by every Root
 * that has no SourceRoot network adapter yet.
 */
export function buildUnprovidedObjectTypeMatrix(
  evidence: string,
  implementedTypes: readonly SourceRootObjectType[] = [],
): readonly SourceRootObjectTypeProvision[] {
  return SOURCEROOT_OBJECT_TYPES.map((objectType) => {
    const implemented = implementedTypes.includes(objectType);
    return {
      objectType,
      defined: true,
      implemented,
      provided: false,
      availability: implemented
        ? ("awaiting-data" as const)
        : ("unsupported" as const),
      evidence: implemented
        ? `${evidence} A released representation exists that a Chunk 17A-17C adapter can wrap, but nothing is exposed through the SourceRoot network contract yet.`
        : `${evidence} No released representation exists for this object type in this Root.`,
    };
  });
}
