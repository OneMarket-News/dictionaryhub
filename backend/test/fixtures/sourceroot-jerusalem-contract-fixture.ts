/**
 * SYNTHETIC CONTRACT FIXTURE - NOT PRODUCTION DATA.
 *
 * This fixture exists only to exercise the SourceRoot shared grammar. It is
 * not accepted production data, it imports nothing from any released dataset,
 * and it must never be served by any API or rendered by any experience. It
 * lives under `backend/test/` precisely so it cannot become production data by
 * accident.
 *
 * The released Plymouth, Wampanoag, and BibleRoot bounded corpora do NOT
 * provide the December Jerusalem demonstration, and this fixture does not
 * pretend otherwise. Real Jerusalem content belongs to Chunk 18A.
 *
 * WHAT IT PROVES:
 *   - four Root-owned resources remain four separate resources
 *   - identical labels create zero identity assertions
 *   - lexical overlap creates zero identity assertions
 *   - identical coordinate text creates zero identity assertions
 *   - identity assertions require explicit evidence
 *   - accepted assertions produce no transitive closure
 *   - temporal scope stays visible, including when it is not asserted
 *   - no governed shared identity is created automatically
 */

import {
  createSourceRootAddress,
  type SourceRootAddress,
} from "../../src/sourceroot/addressing.js";
import {
  TEMPORAL_SCOPE_NOT_ASSERTED,
  type SourceRootTemporalScope,
} from "../../src/sourceroot/query-vocabulary.js";
import type {
  SourceRootIdentityAssertion,
  SourceRootIdentityEvidence,
} from "../../src/sourceroot/identity-assertions.js";

export const FIXTURE_KIND = "synthetic-contract-fixture" as const;
export const FIXTURE_IS_PRODUCTION_DATA = false;
export const FIXTURE_PRODUCTION_OWNER_CHUNK = "18A" as const;
export const FIXTURE_DATASET_ID =
  "sourceroot-shared-grammar-contract-fixture-v1";

/**
 * A prerelease version, so a fixture address can never be mistaken for a
 * released dataset version such as 1.0.0 or 1.3.0.
 */
export const FIXTURE_DATASET_VERSION = "0.0.0-contract-fixture";

export interface FixtureResource {
  readonly rootId: string;
  readonly objectType: string;
  readonly canonicalPublicId: string;
  readonly displayLabel: string;
  readonly address: SourceRootAddress;
  readonly temporalScope: SourceRootTemporalScope;
  /**
   * Signals that look like identity but are NOT identity evidence. They are
   * recorded here so tests can prove they establish nothing.
   */
  readonly nonIdentitySignals: {
    readonly matchingLabel: string;
    readonly lexicalOverlapToken: string;
    readonly coordinateText: string | null;
  };
  readonly rootPayload: Record<string, unknown>;
}

function resource(options: {
  rootId: string;
  objectType: string;
  canonicalPublicId: string;
  displayLabel: string;
  temporalScope: SourceRootTemporalScope;
  coordinateText: string | null;
  rootPayload: Record<string, unknown>;
}): FixtureResource {
  return {
    rootId: options.rootId,
    objectType: options.objectType,
    canonicalPublicId: options.canonicalPublicId,
    displayLabel: options.displayLabel,
    address: createSourceRootAddress({
      rootId: options.rootId,
      objectType: options.objectType,
      canonicalPublicId: options.canonicalPublicId,
      datasetId: FIXTURE_DATASET_ID,
      datasetVersion: FIXTURE_DATASET_VERSION,
    }),
    temporalScope: options.temporalScope,
    nonIdentitySignals: {
      matchingLabel: options.displayLabel,
      lexicalOverlapToken: "jerusalem",
      coordinateText: options.coordinateText,
    },
    rootPayload: options.rootPayload,
  };
}

/**
 * Four resources. Same label, overlapping lexical token, and in two cases the
 * identical coordinate text. They are still four separate Root-owned
 * resources.
 */
export const FIXTURE_RESOURCES: readonly FixtureResource[] = [
  resource({
    rootId: "DictionaryRoot",
    objectType: "lexical-entry",
    canonicalPublicId: "fixture-lemma-jerusalem",
    displayLabel: "Jerusalem",
    temporalScope: TEMPORAL_SCOPE_NOT_ASSERTED,
    coordinateText: null,
    rootPayload: {
      canonicalWrittenForm: "Jerusalem",
      normalizedForm: "jerusalem",
      partOfSpeech: "proper-noun",
    },
  }),
  resource({
    rootId: "HistoryRoot",
    objectType: "historical-record",
    canonicalPublicId: "fixture-record-jerusalem-siege",
    displayLabel: "Jerusalem",
    temporalScope: {
      mode: "approximate",
      // Source-native calendar and precision values, exactly as released
      // corpora carry them. Neither field is a closed enum.
      calendarSystem: "historical-chronology",
      precision: "approximate-year-or-month",
      timeRole: "event_time",
      uncertaintyStatement:
        "The source records the year approximately and does not resolve the month.",
      chronologyRanges: [
        { earliest: "0586 BCE", latest: "0586 BCE", label: "source-stated" },
      ],
      disputed: false,
    },
    coordinateText: "31.7683,35.2137",
    rootPayload: {
      recordTitle: "Fixture historical record",
      reviewState: "unreviewed",
      certainty: "uncertain",
    },
  }),
  resource({
    rootId: "BibleRoot",
    objectType: "scripture-passage",
    canonicalPublicId: "fixture-passage-jerusalem",
    displayLabel: "Jerusalem",
    temporalScope: {
      mode: "disputed",
      calendarSystem: "source-reported chronology",
      precision: "named_period",
      timeRole: "validity_time",
      uncertaintyStatement:
        "Commentators disagree about the period this passage describes.",
      chronologyRanges: [],
      disputed: true,
    },
    coordinateText: null,
    rootPayload: {
      editionId: "fixture-edition",
      passageReference: "Fixture 1:1",
    },
  }),
  resource({
    rootId: "EarthRoot",
    objectType: "place",
    canonicalPublicId: "fixture-place-jerusalem",
    displayLabel: "Jerusalem",
    // Temporal scope is not asserted. This must never be rendered as a claim
    // that the place is timeless.
    temporalScope: TEMPORAL_SCOPE_NOT_ASSERTED,
    // Identical coordinate text to the HistoryRoot record. It still creates no
    // identity assertion. EarthRoot is planned; nothing here is implemented or
    // provided, and no geometry exists.
    coordinateText: "31.7683,35.2137",
    rootPayload: {
      placeLabel: "Jerusalem",
      earthRootImplemented: false,
      geometry: null,
    },
  }),
];

export function fixtureResource(rootId: string): FixtureResource {
  const found = FIXTURE_RESOURCES.find((item) => item.rootId === rootId);
  if (!found) throw new Error(`No fixture resource for ${rootId}.`);
  return found;
}

/* -------------------------------------------------------------------------
 * Evidence
 * ---------------------------------------------------------------------- */

function evidence(
  evidenceId: string,
  kind: SourceRootIdentityEvidence["kind"],
  statement: string,
): SourceRootIdentityEvidence {
  return {
    evidenceId,
    kind,
    statement,
    sourceDatasetId: FIXTURE_DATASET_ID,
    sourceDatasetVersion: FIXTURE_DATASET_VERSION,
    sourceLocator: `fixture://${evidenceId}`,
  };
}

/**
 * Every one of these is a signal that MUST NOT establish identity. Each is
 * present in the fixture data above.
 */
export const REJECTED_EVIDENCE_CANDIDATES: readonly SourceRootIdentityEvidence[] =
  [
    evidence(
      "fixture-rejected-name",
      "name_only_match",
      "All four resources carry the display label Jerusalem.",
    ),
    evidence(
      "fixture-rejected-alias",
      "alias_only_match",
      "Two resources share an alias.",
    ),
    evidence(
      "fixture-rejected-lexical",
      "lexical_overlap",
      "The normalized token jerusalem occurs in all four resources.",
    ),
    evidence(
      "fixture-rejected-14a",
      "chunk_14a_lexical_evidence",
      "A Chunk 14A deterministic lexical occurrence links two of these resources.",
    ),
    evidence(
      "fixture-rejected-coordinate",
      "coordinate_only_match",
      "The HistoryRoot record and the EarthRoot place carry identical coordinate text.",
    ),
    evidence(
      "fixture-rejected-temporal",
      "temporal_overlap_only",
      "Two resources have overlapping temporal scope.",
    ),
    evidence(
      "fixture-rejected-embedding",
      "embedding_similarity",
      "An embedding places these resources close together.",
    ),
    evidence(
      "fixture-rejected-fuzzy",
      "fuzzy_match",
      "A fuzzy string comparison scores these labels as a match.",
    ),
    evidence(
      "fixture-rejected-confidence",
      "model_confidence",
      "A model reports high confidence that these are the same place.",
    ),
    evidence(
      "fixture-rejected-transitive",
      "transitive_closure",
      "A is asserted the same as B and B the same as C, therefore A is the same as C.",
    ),
  ];

/* -------------------------------------------------------------------------
 * Explicit assertions
 * ---------------------------------------------------------------------- */

function assertion(options: {
  assertionId: string;
  subject: SourceRootAddress;
  object: SourceRootAddress;
  statement: string;
}): SourceRootIdentityAssertion {
  return {
    assertionId: options.assertionId,
    addressFormatVersion: options.subject.addressFormatVersion,
    subject: options.subject,
    object: options.object,
    predicate: "asserted_same_as",
    evidence: [
      evidence(
        `${options.assertionId}-evidence`,
        "explicit_source_statement",
        options.statement,
      ),
    ],
    derivation: "directly_sourced",
    reviewState: "accepted_after_review",
    certainty: "asserted_by_source",
    disputeState: "not_disputed",
    temporalScope: TEMPORAL_SCOPE_NOT_ASSERTED,
    symmetry: "explicitly_symmetric",
    transitivity: "non_transitive",
    status: "active",
    withdrawnReason: null,
  };
}

/**
 * Two accepted assertions forming a chain: HistoryRoot - BibleRoot and
 * BibleRoot - EarthRoot.
 *
 * Both are accepted. Neither creates a HistoryRoot - EarthRoot connection, and
 * no governed shared identity is produced.
 */
export const FIXTURE_IDENTITY_ASSERTIONS: readonly SourceRootIdentityAssertion[] =
  [
    assertion({
      assertionId: "fixture-assertion-history-bible",
      subject: fixtureResource("HistoryRoot").address,
      object: fixtureResource("BibleRoot").address,
      statement:
        "The fixture source states explicitly that this record and this passage describe the same place.",
    }),
    assertion({
      assertionId: "fixture-assertion-bible-earth",
      subject: fixtureResource("BibleRoot").address,
      object: fixtureResource("EarthRoot").address,
      statement:
        "The fixture source states explicitly that this passage and this place record refer to the same place.",
    }),
  ];

/**
 * An assertion built from a rejected signal. It is present so tests can prove
 * the contract refuses it, not because it is ever valid.
 */
export const FIXTURE_REJECTED_ASSERTION: SourceRootIdentityAssertion = {
  ...assertion({
    assertionId: "fixture-assertion-label-only",
    subject: fixtureResource("DictionaryRoot").address,
    object: fixtureResource("EarthRoot").address,
    statement: "Both are labelled Jerusalem.",
  }),
  evidence: [
    evidence(
      "fixture-assertion-label-only-evidence",
      "name_only_match",
      "Both resources carry the display label Jerusalem.",
    ),
  ],
};

/**
 * An assertion with no evidence at all.
 */
export const FIXTURE_EVIDENCE_FREE_ASSERTION: SourceRootIdentityAssertion = {
  ...assertion({
    assertionId: "fixture-assertion-no-evidence",
    subject: fixtureResource("DictionaryRoot").address,
    object: fixtureResource("HistoryRoot").address,
    statement: "unused",
  }),
  evidence: [],
};

export const JERUSALEM_CONTRACT_FIXTURE = {
  fixtureKind: FIXTURE_KIND,
  isProductionData: FIXTURE_IS_PRODUCTION_DATA,
  productionOwnerChunk: FIXTURE_PRODUCTION_OWNER_CHUNK,
  datasetId: FIXTURE_DATASET_ID,
  datasetVersion: FIXTURE_DATASET_VERSION,
  resources: FIXTURE_RESOURCES,
  rejectedEvidenceCandidates: REJECTED_EVIDENCE_CANDIDATES,
  identityAssertions: FIXTURE_IDENTITY_ASSERTIONS,
  rejectedAssertion: FIXTURE_REJECTED_ASSERTION,
  evidenceFreeAssertion: FIXTURE_EVIDENCE_FREE_ASSERTION,
  note: "Synthetic contract fixture. Not accepted production data. Real Jerusalem content belongs to Chunk 18A.",
} as const;
