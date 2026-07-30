import {
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_TITLE,
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_VERSION,
  type DictionaryRootLexicalEvidenceFixture,
  type LexicalDefinitionClaim,
  type LexicalEvidenceInventory,
  type LexicalEvidenceQualityReview,
  type LexicalFieldProvenance,
  type LexicalRelationship,
  type LexicalRelationshipEvidence,
  type LexicalSourceLocator,
} from "./lexical-evidence-types.js";

const recordVersion = 1;
const sourceIds = {
  general: "fixture-source-general-a",
  comparison: "fixture-source-general-b",
  historical: "fixture-source-historical",
  technical: "fixture-source-technical",
  etymology: "fixture-source-etymology",
} as const;

function claim(
  id: string,
  senseId: string,
  sourceId: string,
  exactWording: string,
  options: Partial<LexicalDefinitionClaim> = {},
): LexicalDefinitionClaim {
  return {
    claimId: `lex-claim-${id}`,
    senseId,
    sourceId,
    exactWording,
    language: "en",
    claimStatus: "reviewed-fixture",
    evidenceRelationship: "direct",
    recordVersion,
    editionContext: "Architecture fixture v1; synthetic test wording",
    ...options,
  };
}

const definitionClaims: LexicalDefinitionClaim[] = [
  claim("bank-finance-a", "lex-sense-bank-finance", sourceIds.general,
    "A managed institution that receives, safeguards, and lends money."),
  claim("bank-finance-b", "lex-sense-bank-finance", sourceIds.comparison,
    "An institution that accepts deposits and provides financial services."),
  claim("bank-river-a", "lex-sense-bank-river", sourceIds.general,
    "The sloping ground beside a river or other body of water."),
  claim("bank-river-b", "lex-sense-bank-river", sourceIds.comparison,
    "Ground bordering water.", { qualification: "Broader than the paired fixture claim." }),
  claim("bank-tilt", "lex-sense-bank-tilt", sourceIds.general,
    "To incline an aircraft or vehicle while turning."),
  claim("connection-modern", "lex-sense-connection-link", sourceIds.general,
    "A relationship or link joining people, things, or ideas."),
  claim("connection-historical", "lex-sense-connection-link", sourceIds.historical,
    "A joining or relation between things.", { usageLabel: "historical spelling evidence" }),
  claim("algorithm-technical", "lex-sense-algorithm-procedure", sourceIds.technical,
    "A finite, ordered procedure for solving a defined computational problem.",
    { domainLabel: "computer science", registerLabel: "technical" }),
  claim("algorithm-general", "lex-sense-algorithm-procedure", sourceIds.general,
    "A step-by-step method for completing a task.",
    { qualification: "Generalized fixture wording." }),
  claim("walk-verb", "lex-sense-walk-move", sourceIds.general,
    "To move on foot at a regular pace."),
  claim("walk-noun", "lex-sense-walk-journey", sourceIds.general,
    "A journey made on foot."),
  claim("color-property", "lex-sense-color-property", sourceIds.general,
    "A visual property associated with how light is perceived."),
  claim("island-land", "lex-sense-island-land", sourceIds.general,
    "Land surrounded by water."),
  claim("compact-agreement-a", "lex-sense-compact-agreement", sourceIds.historical,
    "A formal agreement among people or communities."),
  claim("compact-agreement-b", "lex-sense-compact-agreement", sourceIds.general,
    "An agreement or covenant between parties."),
  claim("compact-small", "lex-sense-compact-small", sourceIds.general,
    "Closely packed or occupying little space."),
  claim("logos-word", "lex-sense-logos-word", sourceIds.historical,
    "A term whose historical range may include word, account, or reason.",
    { uncertainty: "Semantic range varies by context and period." }),
  claim("logos-principle", "lex-sense-logos-principle", sourceIds.comparison,
    "A principle of reason or ordering.",
    { uncertainty: "This fixture does not select a translation." }),
  claim("evidence-support", "lex-sense-evidence-support", sourceIds.general,
    "Information used to support or challenge a claim."),
  claim("mouse-animal", "lex-sense-mouse-animal", sourceIds.general,
    "A small rodent."),
  claim("mouse-device", "lex-sense-mouse-device", sourceIds.technical,
    "A hand-operated pointing device for controlling a computer interface.",
    { domainLabel: "computing", registerLabel: "technical" }),
  claim("mouse-device-general", "lex-sense-mouse-device", sourceIds.comparison,
    "A device used to point at and select items on a screen.",
    { domainLabel: "computing" }),
];

const relationshipQualification =
  "Synthetic test-only relationship for architecture verification; no production lexical assertion.";

const relationships: LexicalRelationship[] = [
  {
    relationshipId: "lex-relationship-algorithm-connection-equivalent",
    sourceSenseId: "lex-sense-algorithm-procedure",
    targetSenseId: "lex-sense-connection-link",
    relationshipType: "substantially_equivalent",
    directionality: "symmetric",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-bank-tilt-compact-small-antonym",
    sourceSenseId: "lex-sense-bank-tilt",
    targetSenseId: "lex-sense-compact-small",
    relationshipType: "antonym",
    directionality: "symmetric",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-island-bank-river-broader",
    sourceSenseId: "lex-sense-island-land",
    targetSenseId: "lex-sense-bank-river",
    relationshipType: "broader",
    directionality: "directional",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    domainContext: "fixture landform taxonomy",
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-bank-river-color-narrower",
    sourceSenseId: "lex-sense-bank-river",
    targetSenseId: "lex-sense-color-property",
    relationshipType: "narrower",
    directionality: "directional",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-bank-finance-evidence-related",
    sourceSenseId: "lex-sense-bank-finance",
    targetSenseId: "lex-sense-evidence-support",
    relationshipType: "related",
    directionality: "symmetric",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-walk-derivational",
    sourceSenseId: "lex-sense-walk-journey",
    targetSenseId: "lex-sense-walk-move",
    relationshipType: "derivationally_related",
    directionality: "symmetric",
    relationshipStatus: "asserted",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-connection-compact-historical",
    sourceSenseId: "lex-sense-connection-link",
    targetSenseId: "lex-sense-compact-agreement",
    relationshipType: "historical_predecessor",
    directionality: "directional",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    chronologyContext: "synthetic fixture chronology",
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-mouse-device-technical",
    sourceSenseId: "lex-sense-mouse-device",
    targetSenseId: "lex-sense-mouse-animal",
    relationshipType: "technical_specialization",
    directionality: "directional",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    domainContext: "computing fixture",
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-evidence-algorithm-generalization",
    sourceSenseId: "lex-sense-evidence-support",
    targetSenseId: "lex-sense-algorithm-procedure",
    relationshipType: "generalization",
    directionality: "directional",
    relationshipStatus: "qualified",
    reviewStatus: "reviewed",
    qualification: relationshipQualification,
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-logos-translation",
    sourceSenseId: "lex-sense-logos-principle",
    targetSenseId: "lex-sense-logos-word",
    relationshipType: "translation_related",
    directionality: "symmetric",
    relationshipStatus: "qualified",
    reviewStatus: "needs_review",
    qualification: "Synthetic fixture preserves translation range without selecting an equivalence.",
    uncertainty: "Translation depends on source context and period.",
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-compact-disputed",
    sourceSenseId: "lex-sense-compact-agreement",
    targetSenseId: "lex-sense-compact-small",
    relationshipType: "disputed",
    directionality: "symmetric",
    relationshipStatus: "disputed",
    reviewStatus: "disputed",
    qualification: relationshipQualification,
    uncertainty: "The fixture deliberately disputes this candidate.",
    recordVersion,
  },
  {
    relationshipId: "lex-relationship-bank-unresolved",
    sourceSenseId: "lex-sense-bank-finance",
    targetSenseId: "lex-sense-bank-river",
    relationshipType: "unresolved",
    directionality: "symmetric",
    relationshipStatus: "unresolved",
    reviewStatus: "unresolved",
    qualification: relationshipQualification,
    uncertainty: "No semantic relationship is selected by the fixture.",
    recordVersion,
  },
];

const relationshipEvidence: LexicalRelationshipEvidence[] = relationships.map(
  (item, index) => ({
    evidenceId: `lex-relationship-evidence-${String(index + 1).padStart(3, "0")}`,
    relationshipId: item.relationshipId,
    sourceId: item.relationshipType === "technical_specialization"
      ? sourceIds.technical
      : item.relationshipType === "historical_predecessor"
        ? sourceIds.historical
        : sourceIds.general,
    provenanceIdentity: `fixture-relationship-review-${String(index + 1).padStart(3, "0")}`,
    evidenceRole: item.reviewStatus === "unresolved" ? "qualifies" : "supports",
    normalizedSummary: `Fixture evidence for ${item.relationshipType.replaceAll("_", " ")}.`,
    normalizationLabel: "SourceRoot synthetic fixture normalization",
    reviewStatus: item.reviewStatus,
    ...(item.uncertainty ? { uncertainty: item.uncertainty } : {}),
    ...(item.qualification ? { qualification: item.qualification } : {}),
    editionContext: "Architecture fixture v1",
    versionContext: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_VERSION,
    datasetRecordId: `fixture-relationship-${String(index + 1).padStart(3, "0")}`,
    stableFragment: item.relationshipId,
    recordVersion,
  }),
);

relationshipEvidence.push({
  evidenceId: "lex-relationship-evidence-equivalent-secondary",
  relationshipId: "lex-relationship-algorithm-connection-equivalent",
  sourceId: sourceIds.comparison,
  provenanceIdentity: "fixture-relationship-review-equivalent-secondary",
  evidenceRole: "corroborates",
  normalizedSummary: "Independent synthetic fixture support for canonical multi-source evidence.",
  normalizationLabel: "SourceRoot synthetic fixture normalization",
  reviewStatus: "reviewed",
  qualification: relationshipQualification,
  editionContext: "Architecture fixture v1",
  versionContext: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_VERSION,
  datasetRecordId: "fixture-relationship-001-secondary",
  stableFragment: "lex-relationship-algorithm-connection-equivalent-secondary",
  recordVersion,
});

const fixture: DictionaryRootLexicalEvidenceFixture = {
  schemaVersion: "1.0.0",
  dataset: {
    datasetId: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
    bundleId: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
    title: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_TITLE,
    version: DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_VERSION,
    status: "fixture",
    rightsSummary: "Synthetic structural test content only; not a production lexical corpus.",
    fixtureOnly: true,
  },
  sources: [
    {
      sourceId: sourceIds.general,
      accountId: "fixture-editorial-process",
      name: "DictionaryRoot Fixture General Source A",
      edition: "Architecture fixture v1",
      rightsClass: "synthetic_test_only",
      license: "Synthetic test content; no production reuse claim",
      lineageId: "fixture-general-a",
    },
    {
      sourceId: sourceIds.comparison,
      accountId: "fixture-editorial-process",
      name: "DictionaryRoot Fixture General Source B",
      edition: "Architecture fixture v1",
      rightsClass: "synthetic_test_only",
      license: "Synthetic test content; no production reuse claim",
      lineageId: "fixture-general-b",
    },
    {
      sourceId: sourceIds.historical,
      accountId: "fixture-editorial-process",
      name: "DictionaryRoot Fixture Historical Source",
      edition: "Architecture fixture v1",
      rightsClass: "synthetic_test_only",
      license: "Synthetic test content; no production reuse claim",
      lineageId: "fixture-historical",
    },
    {
      sourceId: sourceIds.technical,
      accountId: "fixture-editorial-process",
      name: "DictionaryRoot Fixture Technical Source",
      edition: "Architecture fixture v1",
      rightsClass: "synthetic_test_only",
      license: "Synthetic test content; no production reuse claim",
      lineageId: "fixture-technical",
    },
    {
      sourceId: sourceIds.etymology,
      accountId: "fixture-editorial-process",
      name: "DictionaryRoot Fixture Etymology Source",
      edition: "Architecture fixture v1",
      rightsClass: "synthetic_test_only",
      license: "Synthetic test content; no production reuse claim",
      lineageId: "fixture-etymology",
    },
  ],
  lemmas: [
    ["bank", "bank"], ["connection", "connection"], ["algorithm", "algorithm"],
    ["walk", "walk"], ["color", "color"], ["island", "island"],
    ["compact", "compact"], ["logos", "logos"], ["evidence", "evidence"],
    ["mouse", "mouse"],
  ].map(([id, written]) => ({
    lemmaId: `lex-lemma-${id}`,
    canonicalWrittenForm: written as string,
    normalizedForm: written as string,
    language: id === "logos" ? "grc-Latn" : "en",
    script: "Latn",
    status: "fixture-reviewed",
    recordVersion,
  })),
  senses: [
    ["bank-finance", ["bank"], "noun", "institution"],
    ["bank-river", ["bank"], "noun", "landform"],
    ["bank-tilt", ["bank"], "verb", "motion"],
    ["connection-link", ["connection"], "noun", "relation"],
    ["algorithm-procedure", ["algorithm"], "noun", "technical-process"],
    ["walk-move", ["walk"], "verb", "motion"],
    ["walk-journey", ["walk"], "noun", "event"],
    ["color-property", ["color"], "noun", "perceptual-property"],
    ["island-land", ["island"], "noun", "landform"],
    ["compact-agreement", ["compact"], "noun", "agreement"],
    ["compact-small", ["compact"], "adjective", "physical-property"],
    ["logos-word", ["logos"], "noun", "semantic-range"],
    ["logos-principle", ["logos"], "noun", "philosophical-concept"],
    ["evidence-support", ["evidence"], "noun", "epistemic-object"],
    ["mouse-animal", ["mouse"], "noun", "animal"],
    ["mouse-device", ["mouse"], "noun", "technical-device"],
  ].map(([id, lemmaIds, partOfSpeech, lexicalCategory]) => ({
    senseId: `lex-sense-${id as string}`,
    lemmaIds: (lemmaIds as string[]).map((value) => `lex-lemma-${value}`),
    partOfSpeech: partOfSpeech as string,
    lexicalCategory: lexicalCategory as string,
    status: "fixture-reviewed",
    reviewStatus: "reviewed",
    recordVersion,
  })),
  definitionClaims,
  forms: [
    ["connexion", "connection", "connection-link", "historical", sourceIds.historical, "chiefly historical spelling"],
    ["colour", "color", "color-property", "spelling_variant", sourceIds.general, "regional spelling variant"],
    ["walked", "walk", "walk-move", "inflected", sourceIds.general, "past tense and past participle"],
    ["walking", "walk", "walk-move", "inflected", sourceIds.general, "present participle and gerund"],
    ["walker", "walk", "walk-move", "derived", sourceIds.general, "agent noun"],
    ["banking", "bank", "bank-finance", "derived", sourceIds.general, "activity noun"],
    ["banked", "bank", "bank-tilt", "inflected", sourceIds.general, "past tense"],
    ["algorithms", "algorithm", "algorithm-procedure", "inflected", sourceIds.technical, "plural"],
    ["mice", "mouse", "mouse-animal", "inflected", sourceIds.general, "irregular plural"],
    ["mouses", "mouse", "mouse-device", "inflected", sourceIds.technical, "attested technical plural in fixture"],
  ].map(([writtenForm, lemma, sense, formType, sourceId, context]) => ({
    formId: `lex-form-${writtenForm}`,
    lemmaId: `lex-lemma-${lemma}`,
    senseId: `lex-sense-${sense}`,
    sourceId: sourceId as string,
    writtenForm: writtenForm as string,
    normalizedForm: (writtenForm as string).toLowerCase(),
    formType: formType as string,
    language: "en",
    script: "Latn",
    usageContext: context as string,
    recordVersion,
  })),
  etymologyProposals: [
    {
      proposalId: "lex-etymology-island-inherited",
      subject: { lemmaId: "lex-lemma-island" },
      sourceId: sourceIds.etymology,
      proposedSourceLanguage: "Old English",
      proposedEtymon: "iegland",
      relationshipType: "inheritance",
      chronologyDisplay: "Old English to Middle English",
      confidence: "qualified",
      qualification: "Synthetic structural proposal; exact historical evidence is not asserted.",
      reviewStatus: "reviewed-fixture",
      competingProposalIds: ["lex-etymology-island-spelling-influence"],
      recordVersion,
    },
    {
      proposalId: "lex-etymology-island-spelling-influence",
      subject: { lemmaId: "lex-lemma-island" },
      sourceId: sourceIds.etymology,
      proposedSourceLanguage: "Old French",
      proposedEtymon: "isle",
      relationshipType: "spelling_influence",
      chronologyDisplay: "Early Modern English",
      confidence: "uncertain",
      qualification: "Competing influence proposal retained separately.",
      reviewStatus: "unresolved",
      competingProposalIds: ["lex-etymology-island-inherited"],
      recordVersion,
    },
    {
      proposalId: "lex-etymology-algorithm-borrowing",
      subject: { lemmaId: "lex-lemma-algorithm" },
      sourceId: sourceIds.etymology,
      proposedSourceLanguage: "Medieval Latin",
      proposedEtymon: "algorismus",
      relationshipType: "borrowing",
      confidence: "qualified",
      qualification: "Synthetic architecture fixture, not an accepted origin claim.",
      reviewStatus: "reviewed-fixture",
      competingProposalIds: [],
      recordVersion,
    },
    {
      proposalId: "lex-etymology-logos-unknown",
      subject: { lemmaId: "lex-lemma-logos" },
      sourceId: sourceIds.etymology,
      proposedSourceLanguage: "Ancient Greek",
      proposedEtymon: "logos",
      relationshipType: "unknown_origin",
      confidence: "uncertain",
      qualification: "The fixture preserves uncertainty and does not infer a deeper origin.",
      reviewStatus: "unresolved",
      competingProposalIds: [],
      recordVersion,
    },
  ],
  sourceComparisons: [
    {
      comparisonId: "lex-comparison-bank-finance-equivalent",
      senseId: "lex-sense-bank-finance",
      leftClaimId: "lex-claim-bank-finance-a",
      rightClaimId: "lex-claim-bank-finance-b",
      comparisonType: "substantially_equivalent_meaning",
      reviewStatus: "reviewed",
      explanation: "Both fixture claims identify an institution handling deposits and financial services.",
      reviewerIdentity: "fixture-human-review",
      algorithmicSuggestion: "equivalent_candidate",
      algorithmicRulesetVersion: "fixture-rules-v1",
      sourceLineageRelation: "independent_fixture_lineages",
      recordVersion,
    },
    {
      comparisonId: "lex-comparison-bank-river-broader",
      senseId: "lex-sense-bank-river",
      leftClaimId: "lex-claim-bank-river-a",
      rightClaimId: "lex-claim-bank-river-b",
      comparisonType: "broader_definition",
      reviewStatus: "reviewed",
      explanation: "The right claim covers any bordering ground; the left claim specifies sloping ground.",
      reviewerIdentity: "fixture-human-review",
      recordVersion,
    },
    {
      comparisonId: "lex-comparison-algorithm-general-technical",
      senseId: "lex-sense-algorithm-procedure",
      leftClaimId: "lex-claim-algorithm-technical",
      rightClaimId: "lex-claim-algorithm-general",
      comparisonType: "general_versus_technical",
      reviewStatus: "reviewed",
      explanation: "One claim is constrained to computation; the other describes a general method.",
      reviewerIdentity: "fixture-human-review",
      recordVersion,
    },
    {
      comparisonId: "lex-comparison-logos-unresolved",
      senseId: "lex-sense-logos-word",
      leftClaimId: "lex-claim-logos-word",
      rightClaimId: "lex-claim-logos-principle",
      comparisonType: "unresolved_comparison",
      reviewStatus: "unresolved",
      explanation: "The fixture deliberately leaves sense alignment and translation range unresolved.",
      reviewerIdentity: "fixture-human-review",
      recordVersion,
    },
  ],
  locators: [],
  fieldProvenance: [],
  relationships,
  relationshipEvidence,
};

function buildLocators(value: DictionaryRootLexicalEvidenceFixture): LexicalSourceLocator[] {
  const claimLocators = value.definitionClaims.map((item, index) => ({
    locatorId: `lex-locator-${item.claimId}`,
    subject: { claimId: item.claimId } as const,
    sourceId: item.sourceId,
    ...(item.editionContext ? { edition: item.editionContext } : {}),
    datasetRecordId: `fixture-claim-${String(index + 1).padStart(3, "0")}`,
    stableFragment: item.claimId,
  }));
  const formLocators = value.forms.map((item, index) => ({
    locatorId: `lex-locator-${item.formId}`,
    subject: { formId: item.formId } as const,
    sourceId: item.sourceId ?? sourceIds.general,
    datasetRecordId: `fixture-form-${String(index + 1).padStart(3, "0")}`,
    ...(value.lemmas.find((lemma) => lemma.lemmaId === item.lemmaId)
      ? {
        entryHeadword: value.lemmas.find((lemma) =>
          lemma.lemmaId === item.lemmaId)!.canonicalWrittenForm,
      }
      : {}),
  }));
  const proposalLocators = value.etymologyProposals.map((item, index) => ({
    locatorId: `lex-locator-${item.proposalId}`,
    subject: { proposalId: item.proposalId } as const,
    sourceId: item.sourceId,
    datasetRecordId: `fixture-etymology-${String(index + 1).padStart(3, "0")}`,
    stableFragment: item.proposalId,
  }));
  const comparisonLocators = value.sourceComparisons.map((item, index) => ({
    locatorId: `lex-locator-${item.comparisonId}`,
    subject: { comparisonId: item.comparisonId } as const,
    sourceId: value.definitionClaims.find((claimItem) =>
      claimItem.claimId === item.leftClaimId)?.sourceId ?? sourceIds.general,
    datasetRecordId: `fixture-comparison-${String(index + 1).padStart(3, "0")}`,
    stableFragment: item.comparisonId,
  }));
  return [...claimLocators, ...formLocators, ...proposalLocators, ...comparisonLocators];
}

function buildProvenance(value: DictionaryRootLexicalEvidenceFixture): LexicalFieldProvenance[] {
  const lemmaRecords = value.lemmas.map((item) => ({
    provenanceId: `lex-provenance-${item.lemmaId}-written-form`,
    subject: { lemmaId: item.lemmaId } as const,
    subjectField: "canonical_written_form",
    sourceId: sourceIds.general,
    evidenceRole: "supports",
    transformationType: "synthetic_fixture_assignment",
    reviewerOrProcessIdentity: "fixture-generator-v1",
    versionContext: value.dataset.version,
  }));
  const claimRecords = value.definitionClaims.flatMap((item) => {
    const locatorId = `lex-locator-${item.claimId}`;
    return ["exact_wording", "sense_alignment"].map((field) => ({
      provenanceId: `lex-provenance-${item.claimId}-${field.replaceAll("_", "-")}`,
      subject: { claimId: item.claimId } as const,
      subjectField: field,
      sourceId: item.sourceId,
      locatorId,
      evidenceRole: field === "exact_wording" ? "supports" : "qualifies",
      transformationType: field === "exact_wording"
        ? "synthetic_fixture_verbatim"
        : "human_fixture_review",
      reviewerOrProcessIdentity: "fixture-human-review",
      versionContext: value.dataset.version,
    }));
  });
  const formRecords = value.forms.map((item) => ({
    provenanceId: `lex-provenance-${item.formId}-classification`,
    subject: { formId: item.formId } as const,
    subjectField: "form_type",
    sourceId: item.sourceId ?? sourceIds.general,
    locatorId: `lex-locator-${item.formId}`,
    evidenceRole: "supports",
    transformationType: "human_fixture_review",
    reviewerOrProcessIdentity: "fixture-human-review",
    versionContext: value.dataset.version,
  }));
  const proposalRecords = value.etymologyProposals.map((item) => ({
    provenanceId: `lex-provenance-${item.proposalId}-proposal`,
    subject: { proposalId: item.proposalId } as const,
    subjectField: "proposed_etymon",
    sourceId: item.sourceId,
    locatorId: `lex-locator-${item.proposalId}`,
    evidenceRole: item.confidence === "uncertain" ? "qualifies" : "supports",
    transformationType: "synthetic_fixture_proposal",
    reviewerOrProcessIdentity: "fixture-human-review",
    versionContext: value.dataset.version,
  }));
  const comparisonRecords = value.sourceComparisons.map((item) => ({
    provenanceId: `lex-provenance-${item.comparisonId}-determination`,
    subject: { comparisonId: item.comparisonId } as const,
    subjectField: "comparison_type",
    sourceId: value.definitionClaims.find((claimItem) =>
      claimItem.claimId === item.leftClaimId)?.sourceId ?? sourceIds.general,
    locatorId: `lex-locator-${item.comparisonId}`,
    evidenceRole: item.reviewStatus === "unresolved" ? "qualifies" : "supports",
    transformationType: "human_comparison_review",
    reviewerOrProcessIdentity: item.reviewerIdentity ?? "fixture-human-review",
    versionContext: value.dataset.version,
  }));
  return [...lemmaRecords, ...claimRecords, ...formRecords, ...proposalRecords, ...comparisonRecords];
}

fixture.locators = buildLocators(fixture);
fixture.fieldProvenance = buildProvenance(fixture);

function duplicates(values: string[]): number {
  return values.length - new Set(values).size;
}

export function buildDictionaryRootLexicalEvidenceFixture():
DictionaryRootLexicalEvidenceFixture {
  return structuredClone(fixture);
}

export function buildLexicalEvidenceInventory(
  value: DictionaryRootLexicalEvidenceFixture,
): LexicalEvidenceInventory {
  const rightsDistribution: Record<string, number> = {};
  const sourceDistribution: Record<string, number> = {};
  for (const source of value.sources) {
    rightsDistribution[source.rightsClass] =
      (rightsDistribution[source.rightsClass] ?? 0) + 1;
  }
  for (const item of value.definitionClaims) {
    sourceDistribution[item.sourceId] = (sourceDistribution[item.sourceId] ?? 0) + 1;
  }
  return {
    datasetId: value.dataset.datasetId,
    version: value.dataset.version,
    fixtureOnly: true,
    counts: {
      sources: value.sources.length,
      lemmas: value.lemmas.length,
      senses: value.senses.length,
      definitionClaims: value.definitionClaims.length,
      forms: value.forms.length,
      etymologyProposals: value.etymologyProposals.length,
      sourceComparisons: value.sourceComparisons.length,
      unresolvedComparisons: value.sourceComparisons.filter((item) =>
        item.reviewStatus === "unresolved").length,
      locators: value.locators.length,
      fieldProvenance: value.fieldProvenance.length,
      relationships: value.relationships.length,
      relationshipEvidence: value.relationshipEvidence.length,
    },
    rightsDistribution,
    sourceDistribution,
  };
}

export function buildLexicalEvidenceQualityReview(
  value: DictionaryRootLexicalEvidenceFixture,
): LexicalEvidenceQualityReview {
  const lemmaIds = new Set(value.lemmas.map((item) => item.lemmaId));
  const senseIds = new Set(value.senses.map((item) => item.senseId));
  const claimIds = new Set(value.definitionClaims.map((item) => item.claimId));
  const formIds = new Set(value.forms.map((item) => item.formId));
  const proposalIds = new Set(value.etymologyProposals.map((item) => item.proposalId));
  const comparisonIds = new Set(value.sourceComparisons.map((item) => item.comparisonId));
  const locatorIds = new Set(value.locators.map((item) => item.locatorId));
  const sourceSet = new Set(value.sources.map((item) => item.sourceId));
  const relationshipIds = new Set(value.relationships.map((item) =>
    item.relationshipId));
  const orphanCounts = {
    lemmas: value.lemmas.filter((lemma) =>
      !value.senses.some((sense) => sense.lemmaIds.includes(lemma.lemmaId))).length,
    senses: value.senses.filter((sense) =>
      !sense.lemmaIds.every((id) => lemmaIds.has(id))).length,
    definitionClaims: value.definitionClaims.filter((item) =>
      !senseIds.has(item.senseId) || !sourceSet.has(item.sourceId)).length,
    forms: value.forms.filter((item) =>
      !lemmaIds.has(item.lemmaId)
      || (item.senseId !== undefined && !senseIds.has(item.senseId))).length,
    etymologyProposals: value.etymologyProposals.filter((item) =>
      ("lemmaId" in item.subject && !lemmaIds.has(item.subject.lemmaId))
      || ("senseId" in item.subject && !senseIds.has(item.subject.senseId))
      || ("formId" in item.subject && !formIds.has(item.subject.formId))).length,
    locators: value.locators.filter((item) =>
      ("claimId" in item.subject && !claimIds.has(item.subject.claimId))
      || ("formId" in item.subject && !formIds.has(item.subject.formId))
      || ("proposalId" in item.subject && !proposalIds.has(item.subject.proposalId))
      || ("comparisonId" in item.subject
        && !comparisonIds.has(item.subject.comparisonId))).length,
    fieldProvenance: value.fieldProvenance.filter((item) =>
      item.locatorId !== undefined && !locatorIds.has(item.locatorId)).length,
    sourceComparisons: value.sourceComparisons.filter((item) =>
      !senseIds.has(item.senseId)
      || !claimIds.has(item.leftClaimId)
      || !claimIds.has(item.rightClaimId)).length,
    relationships: value.relationships.filter((item) =>
      !senseIds.has(item.sourceSenseId)
      || !senseIds.has(item.targetSenseId)
      || item.sourceSenseId === item.targetSenseId
      || (item.directionality === "symmetric"
        && item.sourceSenseId >= item.targetSenseId)).length,
    relationshipEvidence: value.relationshipEvidence.filter((item) =>
      !relationshipIds.has(item.relationshipId)
      || !sourceSet.has(item.sourceId)
      || (!item.sourceWording && !item.normalizedSummary)
      || (!item.datasetRecordId && !item.stableFragment)).length,
  };
  const duplicateIdentityCounts = {
    sources: duplicates(value.sources.map((item) => item.sourceId)),
    lemmas: duplicates(value.lemmas.map((item) => item.lemmaId)),
    senses: duplicates(value.senses.map((item) => item.senseId)),
    definitionClaims: duplicates(value.definitionClaims.map((item) => item.claimId)),
    forms: duplicates(value.forms.map((item) => item.formId)),
    etymologyProposals: duplicates(value.etymologyProposals.map((item) =>
      item.proposalId)),
    locators: duplicates(value.locators.map((item) => item.locatorId)),
    fieldProvenance: duplicates(value.fieldProvenance.map((item) =>
      item.provenanceId)),
    sourceComparisons: duplicates(value.sourceComparisons.map((item) =>
      item.comparisonId)),
    relationships: duplicates(value.relationships.map((item) =>
      item.relationshipId)),
    relationshipEvidence: duplicates(value.relationshipEvidence.map((item) =>
      item.evidenceId)),
  };
  const unsupportedCounts = {
    labelsWithoutClaims: 0,
    chronologyWithoutQualification: 0,
    originClaimsWithoutQualification: value.etymologyProposals.filter((item) =>
      !item.qualification).length,
    claimsWithoutLocators: value.definitionClaims.filter((item) =>
      !value.locators.some((locator) =>
        "claimId" in locator.subject && locator.subject.claimId === item.claimId)).length,
    objectsWithoutProvenance: value.definitionClaims.filter((item) =>
      !value.fieldProvenance.some((record) =>
        "claimId" in record.subject && record.subject.claimId === item.claimId)).length,
    relationshipsWithoutEvidence: value.relationships.filter((item) =>
      !value.relationshipEvidence.some((record) =>
        record.relationshipId === item.relationshipId)).length,
  };
  const blockerCount = Object.values(orphanCounts).reduce((sum, count) => sum + count, 0)
    + Object.values(duplicateIdentityCounts).reduce((sum, count) => sum + count, 0)
    + Object.values(unsupportedCounts).reduce((sum, count) => sum + count, 0);
  return {
    datasetId: value.dataset.datasetId,
    version: value.dataset.version,
    blockerCount,
    orphanCounts,
    duplicateIdentityCounts,
    unsupportedCounts,
    cases: {
      highlyPolysemous: ["lex-lemma-bank"],
      historicalOrObsoleteForms: ["lex-form-connexion"],
      technicalSenses: ["lex-sense-algorithm-procedure", "lex-sense-mouse-device"],
      inflectedOrDerivedFamilies: [
        "lex-form-walked", "lex-form-walking", "lex-form-walker",
      ],
      spellingVariants: ["lex-form-colour"],
      disputedOrUncertainEtymology: [
        "lex-etymology-island-inherited",
        "lex-etymology-island-spelling-influence",
      ],
      equivalentDefinitions: ["lex-comparison-bank-finance-equivalent"],
      broaderOrNarrowerDefinitions: ["lex-comparison-bank-river-broader"],
      unresolvedComparisons: ["lex-comparison-logos-unresolved"],
      historyRootTerms: ["lex-lemma-compact", "lex-lemma-evidence"],
      futureBibleRootTerms: ["lex-lemma-logos"],
      symmetricRelationships: value.relationships.filter((item) =>
        item.directionality === "symmetric").map((item) => item.relationshipId),
      directionalRelationships: value.relationships.filter((item) =>
        item.directionality === "directional").map((item) => item.relationshipId),
      disputedOrUnresolvedRelationships: value.relationships.filter((item) =>
        ["disputed", "unresolved"].includes(item.reviewStatus)).map((item) =>
        item.relationshipId),
    },
    productionCorpusGenerated: false,
  };
}

export function serializeDeterministic(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
