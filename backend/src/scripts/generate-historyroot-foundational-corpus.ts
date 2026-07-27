import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ContextClaim,
  ContextClaimAttribution,
  ContextClaimRelation,
  ContextEntity,
  ContextEntityAlias,
  ContextEvidence,
  ContextEvidenceClaimLink,
  ContextFieldProvenance,
  ContextRelationship,
  ContextSourceLocator,
  ContextualBundle,
  HistoricalAccount,
  StructuredHistoricalDate,
  TemporalAssertion,
} from "../contextual-types.js";
import type { SourceRootBundle } from "../types.js";

const CORPUS_ID = "historyroot-foundational-corpus-v1";
const BUNDLE_ID = "historyroot-plymouth-knowledge-dataset-v1";
const REVIEW_DATE = "2026-07-26";
const CREATED_AT = "2026-07-26T12:00:00.000Z";
const LEGACY_DISCLAIMER =
  "A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review.";

const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(currentFile), "../../..");
const legacyBundlePath = path.join(
  repositoryRoot,
  "data",
  "historyroot",
  "plymouth-v1",
  "historyroot-plymouth-v1.bundle.json",
);
const outputDirectory = path.join(
  repositoryRoot,
  "backend",
  "data",
  CORPUS_ID,
);
const outputBundlePath = path.join(
  outputDirectory,
  `${CORPUS_ID}.bundle.json`,
);
const outputInventoryPath = path.join(
  outputDirectory,
  "corpus-inventory.json",
);
const outputSourceRegisterPath = path.join(
  outputDirectory,
  "source-register.json",
);

const ids = {
  patuxetPlace: "historyroot-plymouth-place-patuxet-plymouth",
  plymouthSettlementPlace: "ctx-place-plymouth-settlement",
  patuxetCommunity: "historyroot-plymouth-group-patuxet",
  pokanoketCommunity: "historyroot-plymouth-group-pokanoket",
  plymouthColonists: "historyroot-plymouth-group-plymouth-colonists",
  ousamequin: "historyroot-plymouth-person-ousamequin",
  tisquantum: "historyroot-plymouth-person-tisquantum",
  agreement: "historyroot-plymouth-event-peace-agreement",
} as const;

const sourceIds = {
  mourts: "historyroot-plymouth-source-mourts-relation-loc",
  bradford: "historyroot-plymouth-source-bradford-eada",
  goodNewes: "historyroot-plymouth-source-good-newes-gutenberg",
  compactExhibit: "historyroot-plymouth-source-compact-loc-exhibit",
  compactLaw: "historyroot-plymouth-source-compact-loc-law-blog",
  nmaiTimeline: "historyroot-plymouth-source-nmai-timeline",
  nmaiTreaty: "historyroot-plymouth-source-nmai-treaty-harvest",
  mashpee: "historyroot-plymouth-source-mashpee-culture",
  cdc: "historyroot-plymouth-source-cdc-epidemic-study",
  plimothMuseum: "historyroot-plymouth-source-plimoth-thanksgiving-unit",
} as const;

const selectedSourceIds = Object.values(sourceIds);

const selectedClaimIds = [
  "historyroot-plymouth-claim-wampanoag-deep-history",
  "historyroot-plymouth-claim-hunt-kidnappings",
  "historyroot-plymouth-claim-epidemic-depopulation",
  "historyroot-plymouth-claim-epidemic-diagnosis-uncertain",
  "historyroot-plymouth-claim-tisquantum-travels-return",
  "historyroot-plymouth-claim-settlement-at-patuxet",
  "historyroot-plymouth-claim-compact-original-lost",
  "historyroot-plymouth-claim-mourts-earliest-witness",
  "historyroot-plymouth-claim-compact-three-witnesses",
  "historyroot-plymouth-claim-compact-immediate-function",
  "historyroot-plymouth-claim-compact-signers-scope",
  "historyroot-plymouth-claim-first-winter-mortality",
  "historyroot-plymouth-claim-samoset-contact",
  "historyroot-plymouth-claim-agreement-terms",
  "historyroot-plymouth-claim-ousamequin-strategy",
  "historyroot-plymouth-claim-tisquantum-mediator",
  "historyroot-plymouth-claim-tisquantum-political-agency",
  "historyroot-plymouth-claim-harvest-three-days",
  "historyroot-plymouth-claim-harvest-evidence-limits",
  "historyroot-plymouth-claim-harvest-diplomatic-context",
  "historyroot-plymouth-claim-wessagusset-corn-theft",
  "historyroot-plymouth-claim-wessagusset-killings",
  "historyroot-plymouth-claim-wessagusset-head-display",
  "historyroot-plymouth-claim-wessagusset-aftermath-attributed",
  "historyroot-plymouth-claim-robinson-critique",
] as const;

const selectedRelationshipIds = [
  "historyroot-plymouth-relationship-ousamequin-pokanoket",
  "historyroot-plymouth-relationship-tisquantum-patuxet",
  "historyroot-plymouth-relationship-wampanoag-pokanoket",
  "historyroot-plymouth-relationship-wampanoag-patuxet",
  "historyroot-plymouth-relationship-patuxet-place",
  "historyroot-plymouth-relationship-pokanoket-sowams",
  "historyroot-plymouth-relationship-hunt-kidnapped-tisquantum",
  "historyroot-plymouth-relationship-dermer-return-tisquantum",
  "historyroot-plymouth-relationship-samoset-introduced-tisquantum",
  "historyroot-plymouth-relationship-ousamequin-agreement",
  "historyroot-plymouth-relationship-carver-agreement",
  "historyroot-plymouth-relationship-tisquantum-agreement",
  "historyroot-plymouth-relationship-harvest-ousamequin",
  "historyroot-plymouth-relationship-harvest-pokanoket",
  "historyroot-plymouth-relationship-harvest-plymouth",
  "historyroot-plymouth-relationship-settlement-place",
  "historyroot-plymouth-relationship-compact-created-original",
  "historyroot-plymouth-relationship-original-realizes-text",
  "historyroot-plymouth-relationship-mourts-witness",
  "historyroot-plymouth-relationship-purchas-witness",
  "historyroot-plymouth-relationship-bradford-witness",
  "historyroot-plymouth-relationship-bradford-mourts",
  "historyroot-plymouth-relationship-winslow-mourts",
  "ctx-relationship-plymouth-settlement-at-patuxet",
  "ctx-relationship-colonists-at-plymouth-settlement",
] as const;

const selectedTemporalIds = [
  "historyroot-plymouth-time-hunt-kidnappings",
  "historyroot-plymouth-time-great-dying",
  "historyroot-plymouth-time-mayflower-compact",
  "historyroot-plymouth-time-plymouth-settlement",
  "historyroot-plymouth-time-first-winter",
  "historyroot-plymouth-time-samoset-arrival",
  "historyroot-plymouth-time-peace-agreement",
  "historyroot-plymouth-time-harvest-gathering",
  "historyroot-plymouth-time-wessagusset-crisis",
  "historyroot-plymouth-time-wessagusset-killings",
  "historyroot-plymouth-time-robinson-response",
  "ctx-time-plymouth-settlement-established",
] as const;

type LocatorDefinition = {
  claimId: (typeof selectedClaimIds)[number];
  sourceId: string;
  locatorType: ContextSourceLocator["locatorType"];
  locatorLabel: string;
  locator: Record<string, string | number | boolean>;
  supportRole: ContextEvidenceClaimLink["supportRole"];
};

const locatorDefinitions: LocatorDefinition[] = [
  {
    claimId: selectedClaimIds[0],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 12,000+ Years Ago",
    locator: { section: "12,000+ Years Ago" },
    supportRole: "neutral_or_background",
  },
  {
    claimId: selectedClaimIds[1],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 1524-1615",
    locator: { section: "1524-1615" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[2],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 1616-1620",
    locator: { section: "1616-1620" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[3],
    sourceId: sourceIds.cdc,
    locatorType: "page",
    locatorLabel: "Emerging Infectious Diseases 16(2), pp. 281-286",
    locator: {
      volume: 16,
      issue: 2,
      pageStart: 281,
      pageEnd: 286,
      doi: "10.3201/eid1602.090276",
    },
    supportRole: "qualifies",
  },
  {
    claimId: selectedClaimIds[4],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 1616-1620",
    locator: { section: "1616-1620" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[5],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 1620-1621",
    locator: { section: "1620-1621" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[6],
    sourceId: sourceIds.compactExhibit,
    locatorType: "section",
    locatorLabel: "The Mayflower Compact exhibit section",
    locator: { section: "The Mayflower Compact" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[7],
    sourceId: sourceIds.compactExhibit,
    locatorType: "paragraph",
    locatorLabel: "The Mayflower Compact exhibit, paragraph 66",
    locator: {
      section: "The Mayflower Compact",
      paragraph: 66,
    },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[8],
    sourceId: sourceIds.compactLaw,
    locatorType: "passage",
    locatorLabel:
      "Passages beginning “The earliest surviving text” and “The manuscript of his notebook”",
    locator: {
      firstPassage: "The earliest surviving text",
      secondPassage: "The manuscript of his notebook",
    },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[9],
    sourceId: sourceIds.compactExhibit,
    locatorType: "section",
    locatorLabel: "The Mayflower Compact exhibit section",
    locator: { section: "The Mayflower Compact" },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[10],
    sourceId: sourceIds.compactLaw,
    locatorType: "passage",
    locatorLabel: "Passage beginning “The compact served the immediate political purpose”",
    locator: {
      passage: "The compact served the immediate political purpose",
    },
    supportRole: "qualifies",
  },
  {
    claimId: selectedClaimIds[11],
    sourceId: sourceIds.bradford,
    locatorType: "passage",
    locatorLabel: "EADA lines 2376-2386",
    locator: { lineStart: 2376, lineEnd: 2386 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[12],
    sourceId: sourceIds.bradford,
    locatorType: "passage",
    locatorLabel: "EADA lines 2436-2451",
    locator: { lineStart: 2436, lineEnd: 2451 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[13],
    sourceId: sourceIds.bradford,
    locatorType: "passage",
    locatorLabel: "EADA lines 2454-2475",
    locator: { lineStart: 2454, lineEnd: 2475 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[14],
    sourceId: sourceIds.nmaiTimeline,
    locatorType: "section",
    locatorLabel: "Timeline section: 1620-1621",
    locator: { section: "1620-1621" },
    supportRole: "contextualizes",
  },
  {
    claimId: selectedClaimIds[15],
    sourceId: sourceIds.bradford,
    locatorType: "passage",
    locatorLabel: "EADA lines 2476-2481",
    locator: { lineStart: 2476, lineEnd: 2481 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[16],
    sourceId: sourceIds.goodNewes,
    locatorType: "page",
    locatorLabel: "Good Newes, 1841 edition, pp. 24-26",
    locator: { editionYear: 1841, pageStart: 24, pageEnd: 26 },
    supportRole: "qualifies",
  },
  {
    claimId: selectedClaimIds[17],
    sourceId: sourceIds.mourts,
    locatorType: "passage",
    locatorLabel: "1621 harvest passage in the 1865 edition",
    locator: {
      editionYear: 1865,
      passage: "Our harvest being gotten in",
    },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[18],
    sourceId: sourceIds.plimothMuseum,
    locatorType: "section",
    locatorLabel: "You Are The Historian, Unit 4, Key Idea 1",
    locator: { unit: 4, section: "Key Ideas", item: 1 },
    supportRole: "qualifies",
  },
  {
    claimId: selectedClaimIds[19],
    sourceId: sourceIds.nmaiTreaty,
    locatorType: "section",
    locatorLabel: "Treaty and Harvest Celebration section",
    locator: { section: "Treaty and Harvest Celebration" },
    supportRole: "contextualizes",
  },
  {
    claimId: selectedClaimIds[20],
    sourceId: sourceIds.goodNewes,
    locatorType: "page",
    locatorLabel: "Good Newes, 1841 edition, pp. 41-44",
    locator: { editionYear: 1841, pageStart: 41, pageEnd: 44 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[21],
    sourceId: sourceIds.goodNewes,
    locatorType: "page",
    locatorLabel: "Good Newes, 1841 edition, pp. 47-49",
    locator: { editionYear: 1841, pageStart: 47, pageEnd: 49 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[22],
    sourceId: sourceIds.goodNewes,
    locatorType: "page",
    locatorLabel: "Good Newes, 1841 edition, pp. 50-51",
    locator: { editionYear: 1841, pageStart: 50, pageEnd: 51 },
    supportRole: "supports",
  },
  {
    claimId: selectedClaimIds[23],
    sourceId: sourceIds.goodNewes,
    locatorType: "page",
    locatorLabel: "Good Newes, 1841 edition, pp. 51-52",
    locator: { editionYear: 1841, pageStart: 51, pageEnd: 52 },
    supportRole: "qualifies",
  },
  {
    claimId: selectedClaimIds[24],
    sourceId: sourceIds.bradford,
    locatorType: "passage",
    locatorLabel: "EADA lines 4217-4239",
    locator: { lineStart: 4217, lineEnd: 4239 },
    supportRole: "qualifies",
  },
];

const aliasDefinitions: Array<{
  entityId: string;
  text: string;
  aliasType: ContextEntityAlias["aliasType"];
  sourceIds: string[];
  temporalAssertionId?: string;
  notes: string;
}> = [
  {
    entityId: ids.patuxetPlace,
    text: "Pahtuksut",
    aliasType: "historical",
    sourceIds: [sourceIds.mashpee],
    notes:
      "Publicly published tribal spelling; no new translation or language analysis is asserted.",
  },
  {
    entityId: ids.plymouthSettlementPlace,
    text: "Plymouth",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts, sourceIds.bradford],
    temporalAssertionId: "ctx-time-plymouth-settlement-established",
    notes: "English settlement name, kept distinct from Patuxet.",
  },
  {
    entityId: ids.plymouthSettlementPlace,
    text: "Plimoth",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts, sourceIds.bradford],
    temporalAssertionId: "ctx-time-plymouth-settlement-established",
    notes: "Historical English spelling represented by the cited editions.",
  },
  {
    entityId: ids.plymouthSettlementPlace,
    text: "New Plymouth",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts, sourceIds.bradford],
    temporalAssertionId: "ctx-time-plymouth-settlement-established",
    notes: "Historical English settlement name.",
  },
  {
    entityId: ids.patuxetCommunity,
    text: "Pahtuksut",
    aliasType: "historical",
    sourceIds: [sourceIds.mashpee],
    notes:
      "Publicly published tribal spelling; place and community records remain distinct.",
  },
  {
    entityId: ids.pokanoketCommunity,
    text: "Puckanokick",
    aliasType: "historical",
    sourceIds: [sourceIds.goodNewes],
    notes: "Historical English-source spelling retained with source attribution.",
  },
  {
    entityId: ids.plymouthColonists,
    text: "New Plymouth colonists",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts, sourceIds.bradford],
    notes: "Descriptive historical name for the settler community.",
  },
  {
    entityId: ids.plymouthColonists,
    text: "Plimoth colonists",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts, sourceIds.bradford],
    notes: "Historical spelling retained without merging place and community.",
  },
  {
    entityId: ids.plymouthColonists,
    text: "Mayflower colonists",
    aliasType: "historical",
    sourceIds: [sourceIds.mourts],
    notes: "Common descriptive historical name; the group remained heterogeneous.",
  },
  {
    entityId: ids.ousamequin,
    text: "Massasoit",
    aliasType: "title",
    sourceIds: [sourceIds.nmaiTimeline, sourceIds.bradford],
    notes:
      "Familiar colonial title/name form; Ousamequin remains the canonical personal name.",
  },
  {
    entityId: ids.ousamequin,
    text: "Massasoyt",
    aliasType: "historical",
    sourceIds: [sourceIds.bradford],
    notes: "Historical English spelling retained as a source-attributed alias.",
  },
  {
    entityId: ids.ousamequin,
    text: "Massassowat",
    aliasType: "historical",
    sourceIds: [sourceIds.bradford],
    notes: "Historical English spelling retained as a source-attributed alias.",
  },
  {
    entityId: ids.tisquantum,
    text: "Squanto",
    aliasType: "historical",
    sourceIds: [sourceIds.bradford, sourceIds.goodNewes],
    notes:
      "Common English-source form retained as an alias; Tisquantum remains canonical.",
  },
  {
    entityId: ids.agreement,
    text: "1621 treaty",
    aliasType: "historical",
    sourceIds: [sourceIds.nmaiTreaty, sourceIds.bradford],
    notes:
      "Modern shorthand for the recorded agreement; it does not imply a surviving signed instrument.",
  },
  {
    entityId: ids.agreement,
    text: "Ousamequin agreement",
    aliasType: "historical",
    sourceIds: [sourceIds.nmaiTreaty, sourceIds.bradford],
    notes: "Source-linked descriptive name for the agreement event.",
  },
];

const structuredDates: Record<string, StructuredHistoricalDate> = {
  "historyroot-plymouth-time-hunt-kidnappings": {
    originalLabel: "1614",
    precision: "year",
    era: "CE",
    year: 1614,
    calendarSystem: "source-reported chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "Only year-level precision is asserted.",
  },
  "historyroot-plymouth-time-great-dying": {
    originalLabel: "1616-1619",
    precision: "named_period",
    namedPeriod: "Southern New England epidemic, 1616-1619",
    calendarSystem: "source-reported chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty:
      "Sources describe a multi-year epidemic or epidemics; boundaries and diagnoses remain uncertain.",
  },
  "historyroot-plymouth-time-mayflower-compact": {
    originalLabel: "11 November 1620 (English Old Style)",
    precision: "day",
    era: "CE",
    year: 1620,
    month: 11,
    day: 11,
    calendarSystem: "English Old Style (Julian)",
    conversionStatus: "unconverted",
    uncertainty:
      "The original calendar label is retained and not silently converted.",
  },
  "historyroot-plymouth-time-plymouth-settlement": {
    originalLabel: "Winter 1620-1621",
    precision: "named_period",
    namedPeriod: "Winter 1620-1621",
    calendarSystem: "source-reported seasonal chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "Settlement was a process rather than a single instant.",
  },
  "historyroot-plymouth-time-first-winter": {
    originalLabel: "Winter 1620-1621",
    precision: "named_period",
    namedPeriod: "Winter 1620-1621",
    calendarSystem: "source-reported seasonal chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "The seasonal range is intentionally bounded but not exact.",
  },
  "historyroot-plymouth-time-samoset-arrival": {
    originalLabel: "16 March 1621 (English Old Style)",
    precision: "day",
    era: "CE",
    year: 1621,
    month: 3,
    day: 16,
    calendarSystem: "English Old Style (Julian)",
    conversionStatus: "unconverted",
    uncertainty:
      "The source calendar label is retained and not silently normalized.",
  },
  "historyroot-plymouth-time-peace-agreement": {
    originalLabel: "Late March 1621",
    precision: "named_period",
    namedPeriod: "Late March 1621",
    calendarSystem: "source-reported chronology",
    conversionStatus: "unconverted",
    approximate: true,
    uncertainty:
      "The corpus does not assert an exact modern-calendar date for the agreement.",
  },
  "historyroot-plymouth-time-harvest-gathering": {
    originalLabel: "Autumn 1621",
    precision: "named_period",
    namedPeriod: "Autumn 1621",
    calendarSystem: "source-reported seasonal chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "The surviving account supplies no exact date.",
  },
  "historyroot-plymouth-time-wessagusset-crisis": {
    originalLabel: "Winter 1622-1623",
    precision: "named_period",
    namedPeriod: "Winter 1622-1623",
    calendarSystem: "source-reported seasonal chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "The crisis unfolded over a period rather than one day.",
  },
  "historyroot-plymouth-time-wessagusset-killings": {
    originalLabel: "25 March 1623 (English Old Style account)",
    precision: "day",
    era: "CE",
    year: 1623,
    month: 3,
    day: 25,
    calendarSystem: "English Old Style (Julian)",
    conversionStatus: "unconverted",
    uncertainty:
      "The account's calendar convention is retained without silent conversion.",
  },
  "historyroot-plymouth-time-robinson-response": {
    originalLabel: "After reports of the 1623 killings",
    precision: "named_period",
    namedPeriod: "After reports of the 1623 Wessagusset killings",
    calendarSystem: "relative source chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty: "No falsely exact composition or receipt date is asserted.",
  },
  "ctx-time-plymouth-settlement-established": {
    originalLabel: "Established during winter 1620-1621",
    precision: "named_period",
    namedPeriod: "Winter 1620-1621",
    calendarSystem: "source-reported seasonal chronology",
    conversionStatus: "not_required",
    approximate: true,
    uncertainty:
      "The settlement continued beyond the corpus boundary; this date marks establishment only.",
  },
};

const temporalSourceIds: Record<string, string> = {
  "historyroot-plymouth-time-hunt-kidnappings": sourceIds.nmaiTimeline,
  "historyroot-plymouth-time-great-dying": sourceIds.cdc,
  "historyroot-plymouth-time-mayflower-compact": sourceIds.compactLaw,
  "historyroot-plymouth-time-plymouth-settlement": sourceIds.mashpee,
  "historyroot-plymouth-time-first-winter": sourceIds.bradford,
  "historyroot-plymouth-time-samoset-arrival": sourceIds.bradford,
  "historyroot-plymouth-time-peace-agreement": sourceIds.bradford,
  "historyroot-plymouth-time-harvest-gathering": sourceIds.mourts,
  "historyroot-plymouth-time-wessagusset-crisis": sourceIds.goodNewes,
  "historyroot-plymouth-time-wessagusset-killings": sourceIds.goodNewes,
  "historyroot-plymouth-time-robinson-response": sourceIds.bradford,
  "ctx-time-plymouth-settlement-established": sourceIds.mashpee,
};

const claimRelationDefinitions: Array<{
  fromClaimId: string;
  toClaimId: string;
  explanation: string;
}> = [
  {
    fromClaimId:
      "historyroot-plymouth-claim-epidemic-diagnosis-uncertain",
    toClaimId: "historyroot-plymouth-claim-epidemic-depopulation",
    explanation:
      "Uncertain retrospective diagnosis qualifies the separate mortality claim.",
  },
  {
    fromClaimId: "historyroot-plymouth-claim-compact-signers-scope",
    toClaimId: "historyroot-plymouth-claim-compact-immediate-function",
    explanation:
      "The limited signatory group qualifies broad descriptions of collective agreement.",
  },
  {
    fromClaimId:
      "historyroot-plymouth-claim-tisquantum-political-agency",
    toClaimId: "historyroot-plymouth-claim-tisquantum-mediator",
    explanation:
      "Winslow's hostile attributed account complicates a flattened mediator narrative.",
  },
  {
    fromClaimId:
      "historyroot-plymouth-claim-harvest-evidence-limits",
    toClaimId: "historyroot-plymouth-claim-harvest-three-days",
    explanation:
      "The thin surviving record qualifies the scope of the event description.",
  },
  {
    fromClaimId:
      "historyroot-plymouth-claim-harvest-diplomatic-context",
    toClaimId: "historyroot-plymouth-claim-harvest-three-days",
    explanation:
      "The diplomatic context qualifies the later holiday-centered framing.",
  },
  {
    fromClaimId:
      "historyroot-plymouth-claim-wessagusset-aftermath-attributed",
    toClaimId: "historyroot-plymouth-claim-wessagusset-killings",
    explanation:
      "Winslow's causal account of the aftermath remains an attributed qualification.",
  },
  {
    fromClaimId: "historyroot-plymouth-claim-robinson-critique",
    toClaimId: "historyroot-plymouth-claim-wessagusset-killings",
    explanation:
      "Robinson's criticism qualifies the perpetrators' necessity narrative.",
  },
  {
    fromClaimId: "historyroot-plymouth-claim-wampanoag-deep-history",
    toClaimId: "historyroot-plymouth-claim-settlement-at-patuxet",
    explanation:
      "Long Indigenous presence qualifies any reading of epidemic devastation as vacant land.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireContext(bundle: SourceRootBundle): ContextualBundle {
  if (!bundle.context) {
    throw new Error("The accepted Plymouth bundle has no contextual payload.");
  }
  return bundle.context;
}

function requireEntity(
  context: ContextualBundle,
  entityId: string,
): ContextEntity {
  const entity = (context.entities ?? []).find(
    (candidate) => candidate.id === entityId,
  );
  if (!entity) {
    throw new Error(`Required accepted entity is missing: ${entityId}`);
  }
  return entity;
}

function requireClaim(
  context: ContextualBundle,
  claimId: string,
): ContextClaim {
  const claim = (context.claims ?? []).find(
    (candidate) => candidate.id === claimId,
  );
  if (!claim) {
    throw new Error(`Selected claim is missing: ${claimId}`);
  }
  return claim;
}

function requireEvidence(
  context: ContextualBundle,
  claimId: string,
): ContextEvidence {
  const evidence = (context.evidence ?? []).find(
    (candidate) => candidate.claimId === claimId,
  );
  if (!evidence) {
    throw new Error(`Selected claim has no accepted evidence: ${claimId}`);
  }
  return evidence;
}

function requireAccount(
  context: ContextualBundle,
  accountId: string,
): HistoricalAccount {
  const account = (context.accounts ?? []).find(
    (candidate) => candidate.id === accountId,
  );
  if (!account) {
    throw new Error(`Selected claim account is missing: ${accountId}`);
  }
  return account;
}

function sourceName(
  bundle: SourceRootBundle,
  sourceId: string,
): string {
  const source = (bundle.sources ?? []).find(
    (candidate) => isRecord(candidate) && candidate.id === sourceId,
  );
  return isRecord(source) && typeof source.name === "string"
    ? source.name
    : sourceId;
}

function aliasId(entityId: string, text: string): string {
  const suffix = text
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ctx-alias-${entityId.replace(/^historyroot-plymouth-/, "")}-${suffix}`;
}

function attributionRole(accountId: string):
ContextClaimAttribution["attributionRole"] {
  if (
    accountId === "historyroot-plymouth-account-bradford"
    || accountId === "historyroot-plymouth-account-good-newes"
  ) {
    return "reported_by";
  }
  if (
    accountId === "historyroot-plymouth-account-compact-exhibit"
    || accountId === "historyroot-plymouth-account-compact-law"
  ) {
    return "recorded_by";
  }
  return "attributed_to";
}

function buildFieldProvenance(
  context: ContextualBundle,
  aliases: ContextEntityAlias[],
  claims: ContextClaim[],
): ContextFieldProvenance[] {
  const records: ContextFieldProvenance[] = [];
  const requiredEntitySources: Array<[string, string]> = [
    [ids.patuxetPlace, sourceIds.mashpee],
    [ids.plymouthSettlementPlace, sourceIds.mourts],
    [ids.patuxetCommunity, sourceIds.mashpee],
    [ids.pokanoketCommunity, sourceIds.nmaiTimeline],
    [ids.plymouthColonists, sourceIds.mourts],
    [ids.ousamequin, sourceIds.nmaiTimeline],
    [ids.tisquantum, sourceIds.bradford],
    [ids.agreement, sourceIds.bradford],
  ];

  for (const [entityId, sourceId] of requiredEntitySources) {
    records.push({
      id: `ctx-provenance-${entityId.replace(/^historyroot-plymouth-/, "")}-name`,
      targetId: entityId,
      fieldPath: "name",
      sourceId,
      supportType: "identity-field-source",
      note:
        "Source provenance identifies where the canonical name came from; it is not a truth score.",
    });
  }

  for (const alias of aliases) {
    records.push({
      id: `ctx-provenance-${alias.id}-text`,
      targetId: alias.entityId,
      fieldPath: "aliases.text",
      subrecordType: "alias",
      subrecordId: alias.id,
      sourceId: alias.sourceIds?.[0] ?? sourceIds.bradford,
      supportType: "historical-name-source",
      note:
        "The spelling or title is retained as a source-attributed historical name.",
      ...(alias.uncertainty
        ? { uncertainty: alias.uncertainty }
        : {}),
    });
  }

  for (const temporalId of selectedTemporalIds) {
    records.push({
      id: `ctx-provenance-${temporalId}-date-label`,
      targetId: temporalId,
      fieldPath: "structuredDate.originalLabel",
      sourceId: temporalSourceIds[temporalId] ?? sourceIds.bradford,
      supportType: "date-expression-source",
      note:
        "The source supports the bounded date expression; uncertainty and calendar context remain explicit.",
    });
  }

  const locatorByClaim = new Map(
    locatorDefinitions.map((definition) => [
      definition.claimId,
      definition,
    ]),
  );
  for (const claim of claims) {
    const definition = locatorByClaim.get(
      claim.id as (typeof selectedClaimIds)[number],
    );
    if (!definition) {
      throw new Error(`Selected claim locator is missing: ${claim.id}`);
    }
    records.push({
      id: `ctx-provenance-${claim.id.replace(/^historyroot-plymouth-/, "")}-statement`,
      targetId: claim.id,
      fieldPath: "statement",
      sourceId: definition.sourceId,
      supportType: "reporting-provenance",
      note:
        "This provenance records the statement's reporting path; evidence role is modeled separately.",
    });
  }

  return records;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function run(): Promise<void> {
  const bundle = JSON.parse(
    await readFile(legacyBundlePath, "utf8"),
  ) as SourceRootBundle;
  const context = requireContext(bundle);

  if (bundle.bundleId !== BUNDLE_ID) {
    throw new Error(
      `Expected accepted bundle ${BUNDLE_ID}; received ${bundle.bundleId ?? "missing"}.`,
    );
  }

  const patuxetPlace = requireEntity(context, ids.patuxetPlace);
  patuxetPlace.label = "Patuxet";
  patuxetPlace.name = "Patuxet";
  patuxetPlace.alternateNames = ["Pahtuksut"];
  patuxetPlace.description =
    "Wampanoag village and homeland at the site where the English Plymouth settlement was established; represented separately from that settlement.";
  patuxetPlace.status = "corpus-review-ready";
  patuxetPlace.sourceIds = [
    sourceIds.nmaiTimeline,
    sourceIds.mashpee,
    sourceIds.bradford,
  ];
  patuxetPlace.metadata = {
    ...(patuxetPlace.metadata ?? {}),
    canonicalIdPolicy: "preserved-accepted-plymouth-id",
    requestedSemanticId: "ctx-place-patuxet",
    identityScope: "Indigenous place and homeland",
    legacyCombinedIdentityNarrowed: true,
    distinctSettlementId: ids.plymouthSettlementPlace,
    normalizedAliases: ["pahtuksut"],
    coordinatePolicy:
      "No coordinates supplied; locality is represented without invented precision.",
    reviewRequired: true,
  };

  const plymouthSettlement: ContextEntity = {
    id: ids.plymouthSettlementPlace,
    label: "Plymouth settlement",
    entityType: "place",
    name: "Plymouth settlement",
    alternateNames: ["Plymouth", "Plimoth", "New Plymouth"],
    description:
      "English colonial settlement established during winter 1620-1621 at Patuxet; kept distinct from the Patuxet place and community.",
    domain: "HistoryRoot",
    sourceIds: [sourceIds.mourts, sourceIds.bradford, sourceIds.mashpee],
    status: "corpus-review-ready",
    metadata: {
      canonicalIdPolicy: "new-distinct-identity-required-by-foundational-corpus",
      requestedSemanticId: "ctx-place-plymouth-settlement",
      identityScope: "English colonial settlement",
      distinctFromId: ids.patuxetPlace,
      normalizedAliases: ["plymouth", "plimoth", "new plymouth"],
      coordinatePolicy:
        "No coordinates supplied; the corpus does not invent a precise boundary.",
      reviewRequired: true,
    },
  };
  context.entities = [
    ...(context.entities ?? []).filter(
      (entity) => entity.id !== plymouthSettlement.id,
    ),
    plymouthSettlement,
  ];

  const requiredMappings: Array<{
    requestedId: string;
    canonicalId: string;
    entityType: ContextEntity["entityType"];
    identityDecision: string;
  }> = [
    {
      requestedId: "ctx-place-patuxet",
      canonicalId: ids.patuxetPlace,
      entityType: "place",
      identityDecision:
        "Preserved the accepted Plymouth ID and narrowed the formerly combined place to Patuxet.",
    },
    {
      requestedId: "ctx-place-plymouth-settlement",
      canonicalId: ids.plymouthSettlementPlace,
      entityType: "place",
      identityDecision:
        "Added because the accepted data had collapsed the settlement into Patuxet.",
    },
    {
      requestedId: "ctx-community-patuxet",
      canonicalId: ids.patuxetCommunity,
      entityType: "group",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
    {
      requestedId: "ctx-community-pokanoket",
      canonicalId: ids.pokanoketCommunity,
      entityType: "group",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
    {
      requestedId: "ctx-community-plymouth-colonists",
      canonicalId: ids.plymouthColonists,
      entityType: "group",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
    {
      requestedId: "ctx-person-ousamequin",
      canonicalId: ids.ousamequin,
      entityType: "person",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
    {
      requestedId: "ctx-person-tisquantum",
      canonicalId: ids.tisquantum,
      entityType: "person",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
    {
      requestedId: "ctx-event-plymouth-pokanoket-agreement-1621",
      canonicalId: ids.agreement,
      entityType: "event",
      identityDecision: "Preserved the accepted Plymouth ID.",
    },
  ];

  for (const mapping of requiredMappings) {
    const entity = requireEntity(context, mapping.canonicalId);
    entity.status = "corpus-review-ready";
    entity.metadata = {
      ...(entity.metadata ?? {}),
      requestedSemanticId: mapping.requestedId,
      canonicalIdPolicy:
        mapping.canonicalId === mapping.requestedId
          ? "new-distinct-identity-required-by-foundational-corpus"
          : "preserved-accepted-plymouth-id",
      reviewRequired: true,
    };
  }

  const aliases: ContextEntityAlias[] = aliasDefinitions.map(
    (definition) => ({
      id: aliasId(definition.entityId, definition.text),
      entityId: definition.entityId,
      text: definition.text,
      aliasType: definition.aliasType,
      notes: definition.notes,
      ...(definition.aliasType === "title"
        ? {
            uncertainty:
              "Colonial usage does not establish this as Ousamequin's personal name.",
          }
        : {}),
      status: "corpus-review-ready",
      ...(definition.temporalAssertionId
        ? { temporalAssertionId: definition.temporalAssertionId }
        : {}),
      sourceIds: definition.sourceIds,
    }),
  );
  context.aliases = aliases;

  const newSettlementTime: TemporalAssertion = {
    id: "ctx-time-plymouth-settlement-established",
    label: "Establishment period of Plymouth settlement",
    subjectId: ids.plymouthSettlementPlace,
    temporalKind: "approximate",
    timeRole: "validity_time",
    startDate: "1620-12-16",
    dateLabel:
      "Established during winter 1620-1621; continuing beyond the corpus boundary",
    calendarSystem: "source-reported seasonal chronology",
    datePrecision: "bounded approximate start",
    startUncertainty:
      "The start date is a nominal bound for a multi-step settlement process.",
    dateNotes:
      "No end date is asserted; the 1625 corpus boundary is not an end of settlement.",
    structuredDate:
      structuredDates["ctx-time-plymouth-settlement-established"]!,
    domain: "HistoryRoot",
    sourceIds: [sourceIds.mashpee, sourceIds.bradford, sourceIds.mourts],
    status: "corpus-review-ready",
    metadata: {
      falsePrecisionAvoided: true,
      reviewRequired: true,
    },
  };
  context.temporalAssertions = [
    ...(context.temporalAssertions ?? []).filter(
      (temporal) => temporal.id !== newSettlementTime.id,
    ),
    newSettlementTime,
  ].map((temporal) => {
    const structuredDate = structuredDates[temporal.id];
    if (!structuredDate) {
      return temporal;
    }
    return {
      ...temporal,
      timeRole:
        temporal.id === newSettlementTime.id
          ? "validity_time" as const
          : "event_time" as const,
      structuredDate,
      metadata: {
        ...(temporal.metadata ?? {}),
        falsePrecisionAvoided: true,
        reviewRequired: true,
      },
    };
  });

  const addedRelationships: ContextRelationship[] = [
    {
      id: "ctx-relationship-plymouth-settlement-at-patuxet",
      label: "Plymouth settlement was established at Patuxet",
      fromId: ids.plymouthSettlementPlace,
      toId: ids.patuxetPlace,
      relationshipType: "established_at",
      explanation:
        "The English settlement was established at Patuxet; this relationship preserves rather than merges the two identities.",
      confidence: "source-backed",
      uncertainty:
        "No falsely precise geographic boundary or land-title conclusion is asserted.",
      reviewStatus: "corpus-review-ready",
      domain: "HistoryRoot",
      sourceIds: [
        sourceIds.nmaiTimeline,
        sourceIds.mashpee,
        sourceIds.bradford,
      ],
      status: "corpus-review-ready",
      metadata: {
        attributionKind: "source-grounded-editorial-linkage",
        noIdentityMerge: true,
        noLandTitleInference: true,
        reviewRequired: true,
      },
    },
    {
      id: "ctx-relationship-colonists-at-plymouth-settlement",
      label: "Plymouth colonists formed the Plymouth settlement",
      fromId: ids.plymouthColonists,
      toId: ids.plymouthSettlementPlace,
      relationshipType: "settled_at",
      explanation:
        "The settler community and its settlement are linked without treating either as the Patuxet community.",
      confidence: "source-backed",
      uncertainty:
        "The relationship does not assert a uniform colonist identity or legitimate land title.",
      reviewStatus: "corpus-review-ready",
      domain: "HistoryRoot",
      sourceIds: [sourceIds.mourts, sourceIds.bradford],
      status: "corpus-review-ready",
      metadata: {
        attributionKind: "source-grounded-editorial-linkage",
        noCommunityMerge: true,
        noLandTitleInference: true,
        reviewRequired: true,
      },
    },
  ];
  const addedRelationshipIds = new Set(
    addedRelationships.map((relationship) => relationship.id),
  );
  context.relationships = [
    ...(context.relationships ?? []).filter(
      (relationship) => !addedRelationshipIds.has(relationship.id),
    ),
    ...addedRelationships,
  ];

  const selectedClaims = selectedClaimIds.map((claimId) =>
    requireClaim(context, claimId));
  const locatorByClaim = new Map(
    locatorDefinitions.map((definition) => [
      definition.claimId,
      definition,
    ]),
  );

  const attributions: ContextClaimAttribution[] = selectedClaims.map(
    (claim) => {
      const account = requireAccount(context, claim.accountId);
      const locator = locatorByClaim.get(
        claim.id as (typeof selectedClaimIds)[number],
      );
      if (!locator) {
        throw new Error(`Selected claim locator is missing: ${claim.id}`);
      }
      return {
        id: `ctx-attribution-${claim.id.replace(/^historyroot-plymouth-claim-/, "")}`,
        claimId: claim.id,
        ...(account.authorEntityId
          ? { actorEntityId: account.authorEntityId }
          : {}),
        accountId: account.id,
        attributionRole: attributionRole(account.id),
        sourceIds: claim.sourceIds ?? [locator.sourceId],
        note:
          "Attribution identifies who or what account made or recorded the statement; it does not convert provenance into proof.",
        confidence: "source-path-explicit",
        ...(claim.uncertainty
          ? { uncertainty: claim.uncertainty }
          : {}),
      };
    },
  );
  context.claimAttributions = attributions;

  const claimRelations: ContextClaimRelation[] =
    claimRelationDefinitions.map((definition) => {
      const fromClaim = requireClaim(context, definition.fromClaimId);
      const toClaim = requireClaim(context, definition.toClaimId);
      return {
        id: `ctx-claim-relation-${fromClaim.id.replace(/^historyroot-plymouth-claim-/, "")}-${toClaim.id.replace(/^historyroot-plymouth-claim-/, "")}`,
        fromClaimId: fromClaim.id,
        toClaimId: toClaim.id,
        relationType: "qualifies",
        explanation: definition.explanation,
        sourceIds: Array.from(new Set([
          ...(fromClaim.sourceIds ?? []),
          ...(toClaim.sourceIds ?? []),
        ])),
        confidence: "scoped-editorial-link",
        uncertainty:
          "The relationship preserves both claims and does not resolve historical truth automatically.",
        reviewStatus: "corpus-review-ready",
      };
    });
  context.claimRelations = claimRelations;

  const sourceLocators: ContextSourceLocator[] = locatorDefinitions.map(
    (definition) => {
      const evidence = requireEvidence(context, definition.claimId);
      return {
        id: `ctx-locator-${definition.claimId.replace(/^historyroot-plymouth-claim-/, "")}`,
        evidenceId: evidence.id,
        sourceId: definition.sourceId,
        locatorType: definition.locatorType,
        locatorLabel: definition.locatorLabel,
        locator: definition.locator,
        note:
          "Locator was retained only where the accepted source inspection identified a bounded passage, section, line range, or page range.",
      };
    },
  );
  context.sourceLocators = sourceLocators;

  const evidenceClaimLinks: ContextEvidenceClaimLink[] =
    locatorDefinitions.map((definition) => {
      const evidence = requireEvidence(context, definition.claimId);
      const source = sourceName(bundle, definition.sourceId);
      return {
        id: `ctx-evidence-link-${definition.claimId.replace(/^historyroot-plymouth-claim-/, "")}`,
        evidenceId: evidence.id,
        claimId: definition.claimId,
        supportRole: definition.supportRole,
        scopePath: "statement",
        explanation:
          `${source} is linked only for the scoped role “${definition.supportRole}”; source provenance remains separately recorded.`,
        relevance: "directly-located-source-material",
        confidence: "role-explicit",
        ...(evidence.uncertainty
          ? { uncertainty: evidence.uncertainty }
          : {}),
        sourceIds: [definition.sourceId],
      };
    });
  context.evidenceClaimLinks = evidenceClaimLinks;

  context.claimVersions = [];
  context.evidenceVersions = [];
  context.fieldProvenance = buildFieldProvenance(
    context,
    aliases,
    selectedClaims,
  );

  bundle.version = "1.1.0";
  bundle.createdAt = CREATED_AT;
  bundle.createdBy = "SourceRoot HistoryRoot foundational corpus v1";
  bundle.description =
    `${LEGACY_DISCLAIMER} Replacement-safe foundational enrichment for the Patuxet-Plymouth-Pokanoket contact network, principally 1602-1625.`;
  bundle.extensions = {
    ...(bundle.extensions ?? {}),
    foundationalCorpus: {
      corpusId: CORPUS_ID,
      version: "1.0.0",
      reviewedOn: REVIEW_DATE,
      boundary: "Patuxet-Plymouth-Pokanoket Contact Network, 1602-1625",
      replacementPolicy:
        "Supersedes the accepted Plymouth bundle bytes while preserving its bundle ID and accepted canonical record IDs.",
      sourceSubsetCount: selectedSourceIds.length,
      claimSubsetCount: selectedClaimIds.length,
      relationshipSubsetCount: selectedRelationshipIds.length,
      requiredRecordCount: requiredMappings.length,
      optionalRecordCount: 0,
      noMigrationAdded: true,
      noArtificialVersionHistory: true,
      noTruthScore: true,
    },
  };

  const selectedAccounts = Array.from(new Set(
    selectedClaims.map((claim) => claim.accountId),
  ));
  const evidenceRoleCounts = evidenceClaimLinks.reduce<
    Record<string, number>
  >((counts, link) => {
    counts[link.supportRole] = (counts[link.supportRole] ?? 0) + 1;
    return counts;
  }, {});

  const inventory = {
    corpusId: CORPUS_ID,
    bundleId: BUNDLE_ID,
    version: "1.0.0",
    generatedOn: REVIEW_DATE,
    boundary: {
      subject: "Patuxet-Plymouth-Pokanoket Contact Network",
      primaryPeriod: "1602-1625",
      expansionRule:
        "Earlier or later material appears only for identity, source lineage, chronology, retrospective authorship, interpretation, or correction.",
    },
    stableIdPolicy: {
      requestedIdsArePlanningAliases: true,
      canonicalIdsPreserveAcceptedPlymouthIdentities: true,
      combinedPlaceCorrection:
        "The accepted Patuxet/Plymouth place ID is preserved for Patuxet and narrowed; a distinct Plymouth settlement record is added.",
    },
    requiredRecords: requiredMappings,
    optionalRecords: [
      {
        requestedId: "ctx-person-samoset",
        status: "omitted",
        reason:
          "The accepted Samoset record remains compatible, but optional promotion was unnecessary for the required eight-record network.",
      },
      {
        requestedId: "ctx-event-samoset-arrival-plymouth-1621",
        status: "omitted",
        reason:
          "The accepted event remains available and sourced; it was not promoted as an optional principal record.",
      },
      {
        requestedId:
          "ctx-event-southern-new-england-epidemic-1616-1619",
        status: "omitted",
        reason:
          "The accepted epidemic event remains available with explicit diagnostic uncertainty; it was not promoted as an optional principal record.",
      },
      {
        requestedId: "ctx-event-english-settlement-at-patuxet-1620",
        status: "omitted",
        reason:
          "The accepted settlement event remains available; the required distinct settlement place resolved the identity need without another optional principal record.",
      },
    ],
    sourceIds: selectedSourceIds,
    accountIds: selectedAccounts,
    claimIds: selectedClaimIds,
    relationshipIds: selectedRelationshipIds,
    historicalNameIds: aliases.map((alias) => alias.id),
    dateExpressionIds: selectedTemporalIds,
    locatorIds: sourceLocators.map((locator) => locator.id),
    evidenceLinkIds: evidenceClaimLinks.map((link) => link.id),
    claimRelationIds: claimRelations.map((relation) => relation.id),
    counts: {
      requiredRecords: requiredMappings.length,
      optionalRecords: 0,
      sources: selectedSourceIds.length,
      accounts: selectedAccounts.length,
      claims: selectedClaimIds.length,
      relationships: selectedRelationshipIds.length,
      historicalNames: aliases.length,
      dateExpressions: selectedTemporalIds.length,
      locators: sourceLocators.length,
      evidenceLinks: evidenceClaimLinks.length,
      evidenceLinksByRole: evidenceRoleCounts,
      fieldProvenance: context.fieldProvenance.length,
      claimRelations: claimRelations.length,
      claimVersions: context.claimVersions.length,
      evidenceVersions: context.evidenceVersions.length,
    },
    explicitExclusions: [
      "No comprehensive history of New England",
      "No new contextual record kind",
      "No truth or reliability score",
      "No automatic conflict resolution",
      "No invented locator",
      "No new Wôpanâak translation",
      "No copied modern institutional prose",
      "No artificial claim or evidence version history",
    ],
  };

  const sourceById = new Map(
    (bundle.sources ?? [])
      .filter(isRecord)
      .map((source) => [String(source.id ?? ""), source]),
  );
  const sourceRegister = {
    corpusId: CORPUS_ID,
    reviewedOn: REVIEW_DATE,
    policy:
      "Only the ten listed, already-inspected sources are in the foundational subset. Modern institutional prose is linked and paraphrased; only explicitly supported public-domain editions retain that status.",
    rightsRule:
      "A linkable modern source is not treated as public domain unless its recorded rights status explicitly says so.",
    sources: selectedSourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) {
        throw new Error(`Selected registered source is missing: ${sourceId}`);
      }
      return {
        ...source,
        corpusUse:
          "Metadata, short original SourceRoot paraphrases, and bounded locators only.",
        copiedModernProse: false,
        sourceIdentityVerified: true,
        reviewedOn: REVIEW_DATE,
      };
    }),
  };

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeJson(outputBundlePath, bundle),
    writeJson(outputInventoryPath, inventory),
    writeJson(outputSourceRegisterPath, sourceRegister),
  ]);

  console.log(
    `Generated ${CORPUS_ID}: ${requiredMappings.length} required records, ${selectedClaimIds.length} claims, ${selectedSourceIds.length} selected sources, and ${selectedRelationshipIds.length} relationships.`,
  );
}

run().catch((error: unknown) => {
  console.error("HistoryRoot foundational corpus generation failed:", error);
  process.exitCode = 1;
});
