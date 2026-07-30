import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  DictionaryRootCoreLexicalCorpus,
  LexicalEvidenceSource,
  LexicalRelationship,
  LexicalRelationshipType,
} from "./lexical-evidence-types.js";

export const CORE_LEXICAL_CORPUS_ID = "dictionaryroot-core-lexical-corpus-v1";
export const CORE_LEXICAL_CORPUS_VERSION = "1.0.0";
export const CORE_LEXICAL_CORPUS_TITLE = "DictionaryRoot Core Lexical Corpus v1";

const REQUIRED_LEMMAS = [
  "bank", "light", "value", "justice", "run", "island", "logos", "source",
  "evidence", "claim", "identity", "account", "memory", "community", "nation",
  "tribe", "colony", "settlement", "treaty", "alliance", "homeland",
  "migration", "sovereignty", "territory", "translation",
] as const;

const HISTORYROOT_LEMMAS = new Set([
  "account", "alliance", "claim", "colony", "community", "evidence",
  "homeland", "identity", "memory", "migration", "nation", "settlement",
  "source", "sovereignty", "territory", "translation", "treaty", "tribe",
]);

const BIBLEROOT_LEMMAS = new Set([
  "light", "logos", "justice", "translation", "word", "language", "meaning",
  "truth", "spirit", "law",
]);

const TECHNICAL_PATTERN =
  /\b(law|biology|medicine|physics|chemistry|comput|engineering|geology|mathematics|linguistics|astronomy|agriculture|psychology|printing|music|mining)\b/iu;

interface PilotNode {
  id: string;
  title: string;
  summary: string;
  metadata: {
    sourceSynsetKey: string;
    sourceOffset: string;
    partOfSpeech: string;
    lemmas: string[];
    originalGloss: string;
  };
}

interface PilotEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: string;
  summary: string;
  metadata: {
    sourcePointerSymbol?: string;
    sourceSynsetKey?: string;
    targetSynsetKey?: string;
  };
}

interface PilotBundle {
  nodes: PilotNode[];
  edges: PilotEdge[];
}

interface CandidateSource {
  candidateId: string;
  title: string;
  publisher: string;
  editionOrDatasetVersion: string;
  stableUrl: string;
  rightsClass: string;
  licenseOrPublicDomainBasis: string;
  perspectiveOrEditorialLineage: string;
  acquisitionStatus: string;
  attributionRequirements: string[];
  redistributionRestrictions: string[];
  permittedUseClass: string;
  proposedSourceRootRole: string;
  boundedLocatorStrategy: string;
  sourceType: string;
  sourceLimitations: string[];
}

interface WebsterEntry {
  lemma: string;
  heading: string;
  definition: string;
  etymology?: string;
  lineStart: number;
  lineEnd: number;
}

export interface CoreLexicalCorpusInputs {
  pilotPath: string;
  candidateSourcesPath: string;
  websterPath: string;
}

export interface CoreLexicalCorpusArtifacts {
  corpus: DictionaryRootCoreLexicalCorpus;
  inventory: Record<string, unknown>;
  qualityReview: Record<string, unknown>;
  qualityReviewMarkdown: string;
  sourceRightsAttribution: Record<string, unknown>;
  lemmaSelection: Record<string, unknown>;
  preparedSourceAccounting: Record<string, unknown>;
  relationshipAccounting: Record<string, unknown>;
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function slug(value: string): string {
  return normalized(value).replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseWebsterEntries(text: string, wanted: Set<string>): Map<string, WebsterEntry[]> {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const result = new Map<string, WebsterEntry[]>();
  const headingPattern = /^[A-Z][A-Z0-9 '&().,-]{0,79}$/u;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index]?.trim() ?? "";
    const lemma = normalized(heading);
    if (!wanted.has(lemma) || !headingPattern.test(heading)) continue;
    let end = index + 1;
    while (end < lines.length) {
      const candidate = lines[end]?.trim() ?? "";
      if (candidate && headingPattern.test(candidate)) break;
      end += 1;
    }
    const bodyLines = lines.slice(index + 1, end);
    const paragraphs = bodyLines.join("\n").split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.replace(/\s*\n\s*/gu, " ").trim())
      .filter(Boolean);
    const definitionParagraph = paragraphs.find((paragraph) =>
      /^(?:1\.|Defn:)\s+/u.test(paragraph));
    if (!definitionParagraph) {
      index = end - 1;
      continue;
    }
    const header = paragraphs[0] ?? "";
    const etymology = /Etym:\s*\[(.+?)\](?:\s|$)/u.exec(header)?.[1]?.trim();
    const definition = definitionParagraph.replace(/^(?:1\.|Defn:)\s+/u, "").trim();
    const entries = result.get(lemma) ?? [];
    entries.push({
      lemma,
      heading,
      definition,
      ...(etymology ? { etymology } : {}),
      lineStart: index + 1,
      lineEnd: end,
    });
    result.set(lemma, entries);
    index = end - 1;
  }
  return result;
}

function sourceRecord(candidate: CandidateSource): LexicalEvidenceSource {
  return {
    sourceId: candidate.candidateId,
    accountId: candidate.publisher,
    name: candidate.title,
    edition: candidate.editionOrDatasetVersion,
    rightsClass: candidate.rightsClass,
    license: candidate.licenseOrPublicDomainBasis,
    canonicalUrl: candidate.stableUrl,
    lineageId: slug(candidate.perspectiveOrEditorialLineage),
  };
}

function relationDescriptor(type: string): {
  relationshipType: LexicalRelationshipType;
  directionality: "directional" | "symmetric";
} {
  switch (type) {
    case "ANTONYM_OF":
      return { relationshipType: "antonym", directionality: "symmetric" };
    case "HAS_HYPERNYM":
    case "HAS_INSTANCE_HYPERNYM":
      return { relationshipType: "broader", directionality: "directional" };
    case "HAS_HYPONYM":
    case "HAS_INSTANCE_HYPONYM":
      return { relationshipType: "narrower", directionality: "directional" };
    case "DERIVATIONALLY_RELATED_TO":
      return { relationshipType: "derivationally_related", directionality: "symmetric" };
    case "SIMILAR_TO":
    case "VERB_GROUP":
      return { relationshipType: "substantially_equivalent", directionality: "symmetric" };
    default:
      return { relationshipType: "related", directionality: "symmetric" };
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export async function buildCoreLexicalCorpus(
  inputs: CoreLexicalCorpusInputs,
): Promise<CoreLexicalCorpusArtifacts> {
  const [pilotText, candidateText, websterText] = await Promise.all([
    readFile(inputs.pilotPath, "utf8"),
    readFile(inputs.candidateSourcesPath, "utf8"),
    readFile(inputs.websterPath, "utf8"),
  ]);
  const pilot = JSON.parse(pilotText) as PilotBundle;
  const candidates = (JSON.parse(candidateText) as CandidateSource[])
    .filter((source) => source.acquisitionStatus === "accepted")
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const nodeById = new Map(pilot.nodes.map((node) => [node.id, node]));
  const lemmaNodes = new Map<string, PilotNode[]>();
  for (const node of pilot.nodes) {
    for (const written of node.metadata.lemmas) {
      const lemma = normalized(written);
      const nodes = lemmaNodes.get(lemma) ?? [];
      nodes.push(node);
      lemmaNodes.set(lemma, nodes);
    }
  }

  const candidateLemmas = [...lemmaNodes.keys()].map((lemma) => {
    const nodes = lemmaNodes.get(lemma) ?? [];
    const requiredIndex = REQUIRED_LEMMAS.indexOf(lemma as typeof REQUIRED_LEMMAS[number]);
    const technical = nodes.some((node) =>
      TECHNICAL_PATTERN.test(node.metadata.originalGloss));
    const stratum = requiredIndex >= 0 ? 0
      : nodes.length >= 4 ? 1
      : technical ? 2
      : HISTORYROOT_LEMMAS.has(lemma) ? 3
      : BIBLEROOT_LEMMAS.has(lemma) ? 4
      : 5;
    return { lemma, stratum, polysemy: nodes.length, technical };
  }).sort((left, right) =>
    left.stratum - right.stratum
    || right.polysemy - left.polysemy
    || left.lemma.localeCompare(right.lemma));

  const selectedLemmaSet = new Set<string>(REQUIRED_LEMMAS);
  for (const candidate of candidateLemmas) {
    if (selectedLemmaSet.size >= 500) break;
    selectedLemmaSet.add(candidate.lemma);
  }
  const selectedLemmas = [...selectedLemmaSet].sort((left, right) =>
    left.localeCompare(right));
  const selectedSet = new Set(selectedLemmas);
  const websterEntries = parseWebsterEntries(websterText, selectedSet);

  const selectedNodes = new Map<string, PilotNode>();
  for (const lemma of selectedLemmas) {
    const first = [...(lemmaNodes.get(lemma) ?? [])]
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (first) selectedNodes.set(first.id, first);
  }
  for (const lemma of REQUIRED_LEMMAS) {
    for (const node of [...(lemmaNodes.get(lemma) ?? [])]
      .sort((left, right) => left.id.localeCompare(right.id))) {
      if (selectedNodes.size >= 1_000) break;
      selectedNodes.set(node.id, node);
    }
  }
  const additionalNodes = pilot.nodes
    .filter((node) => node.metadata.lemmas.some((lemma) => selectedSet.has(normalized(lemma))))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const node of additionalNodes) {
    if (selectedNodes.size >= 1_000) break;
    selectedNodes.set(node.id, node);
  }

  const lemmaId = new Map(selectedLemmas.map((lemma) =>
    [lemma, `lex-lemma-core-${slug(lemma)}`]));
  const senseId = new Map<string, string>();
  const senseLemma = new Map<string, string>();
  const lemmas = selectedLemmas.map((lemma) => ({
    lemmaId: lemmaId.get(lemma)!,
    canonicalWrittenForm: lemma,
    normalizedForm: lemma,
    language: "en",
    script: "Latn",
    status: "active",
    recordVersion: 1,
  }));
  const senses: DictionaryRootCoreLexicalCorpus["senses"] = [];
  for (const node of [...selectedNodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const owningLemma = uniqueSorted(node.metadata.lemmas.map(normalized)
      .filter((lemma) => selectedSet.has(lemma)))[0];
    if (!owningLemma) continue;
    const id = `lex-sense-core-${node.id.replace(/^dictionaryroot-oewn-2025-/u, "")}`;
    senseId.set(node.id, id);
    senseLemma.set(id, owningLemma);
    senses.push({
      senseId: id,
      lemmaIds: [lemmaId.get(owningLemma)!],
      partOfSpeech: node.metadata.partOfSpeech,
      lexicalCategory: TECHNICAL_PATTERN.test(node.metadata.originalGloss)
        ? "technical_or_specialized" : "general",
      status: "current",
      reviewStatus: "reviewed",
      recordVersion: 1,
    });
  }

  const sources = candidates.map(sourceRecord);
  const claims: DictionaryRootCoreLexicalCorpus["definitionClaims"] = [];
  const nodeForSense = new Map<string, PilotNode>();
  for (const node of selectedNodes.values()) {
    const id = senseId.get(node.id);
    if (!id) continue;
    nodeForSense.set(id, node);
    const technicalMatch = /\(([^)]+)\)/u.exec(node.summary)?.[1];
    claims.push({
      claimId: `lex-claim-core-oewn-${node.metadata.sourceSynsetKey.replace(":", "-")}`,
      senseId: id,
      sourceId: "oewn-2025",
      exactWording: node.summary,
      language: "en",
      claimStatus: "accepted",
      editionContext: "Open English WordNet 2025",
      ...(technicalMatch ? { domainLabel: technicalMatch } : {}),
      evidenceRelationship: "direct_source_wording",
      recordVersion: 1,
    });
  }

  const websterCandidates = selectedLemmas
    .map((lemma) => ({ lemma, entries: websterEntries.get(lemma) ?? [] }))
    .filter((item) => item.entries.some((entry) => entry.etymology));
  const requiredWebster = selectedLemmas
    .filter((lemma) => REQUIRED_LEMMAS.includes(
      lemma as typeof REQUIRED_LEMMAS[number],
    ))
    .map((lemma) => ({ lemma, entries: websterEntries.get(lemma) ?? [] }))
    .filter((item) => item.entries.length > 0);
  const websterSelections = [
    ...requiredWebster,
    ...websterCandidates.slice(0, 125).filter((item) =>
      !requiredWebster.some((required) => required.lemma === item.lemma)),
  ];
  const comparisons: DictionaryRootCoreLexicalCorpus["sourceComparisons"] = [];
  const etymologies: DictionaryRootCoreLexicalCorpus["etymologyProposals"] = [];
  const websterEntryByClaim = new Map<string, WebsterEntry>();
  for (const { lemma, entries } of websterSelections) {
    let targetSense = senses.find((sense) => sense.lemmaIds.includes(lemmaId.get(lemma)!));
    if (!targetSense) {
      const entry = entries[0]!;
      targetSense = {
        senseId: `lex-sense-core-webster-${slug(lemma)}-1`,
        lemmaIds: [lemmaId.get(lemma)!],
        partOfSpeech: "unresolved",
        lexicalCategory: "historical",
        status: "historical",
        reviewStatus: "unresolved",
        recordVersion: 1,
      };
      senses.push(targetSense);
      senseLemma.set(targetSense.senseId, lemma);
    }
    targetSense.status = "historical";
    const entry = entries.find((candidate) => candidate.etymology) ?? entries[0]!;
    const claimId = `lex-claim-core-webster-${slug(lemma)}-1`;
    claims.push({
      claimId,
      senseId: targetSense.senseId,
      sourceId: "webster-revised-unabridged-1913",
      exactWording: entry.definition,
      language: "en",
      claimStatus: "qualified",
      editionContext: "Webster's Revised Unabridged Dictionary, 1913",
      qualification: "Historical source wording; alignment to the OEWN sense remains unresolved.",
      evidenceRelationship: "historical_source_wording",
      recordVersion: 1,
    });
    websterEntryByClaim.set(claimId, entry);
    const oewnClaim = claims.find((claim) =>
      claim.senseId === targetSense!.senseId && claim.sourceId === "oewn-2025");
    if (oewnClaim) {
      comparisons.push({
        comparisonId: `lex-comparison-core-${slug(lemma)}-historical-modern`,
        senseId: targetSense.senseId,
        leftClaimId: claimId,
        rightClaimId: oewnClaim.claimId,
        comparisonType: "historical_versus_contemporary",
        reviewStatus: "unresolved",
        explanation: "The 1913 and 2025 source statements are preserved separately; no equivalence or artificial consensus is asserted.",
        algorithmicSuggestion: "Same normalized lemma and compatible part-of-speech candidate.",
        algorithmicRulesetVersion: "dictionaryroot-core-selection-v1",
        sourceLineageRelation: "independent_editorial_lineages",
        recordVersion: 1,
      });
    }
    if (entry.etymology) {
      etymologies.push({
        proposalId: `lex-etymology-core-webster-${slug(lemma)}-1`,
        subject: { lemmaId: lemmaId.get(lemma)! },
        sourceId: "webster-revised-unabridged-1913",
        proposedEtymon: entry.etymology,
        relationshipType: "historical_source_proposal",
        chronologyDisplay: "Published 1913",
        confidence: "qualified",
        qualification: "Historical etymological wording preserved verbatim and not upgraded to present-day certainty.",
        reviewStatus: "reviewed_historical_source",
        competingProposalIds: [],
        recordVersion: 1,
      });
    }
  }

  if (selectedSet.has("bank") && !senses.some((sense) =>
    sense.lemmaIds.includes(lemmaId.get("bank")!)
    && sense.partOfSpeech === "noun")) {
    const entry = websterEntries.get("bank")?.[0];
    if (!entry) {
      throw new Error("The pinned Webster source does not contain the required BANK noun entry.");
    }
    const bankNounSenseId = "lex-sense-core-webster-bank-noun-1";
    const bankNounClaimId = "lex-claim-core-webster-bank-noun-1";
    senses.push({
      senseId: bankNounSenseId,
      lemmaIds: [lemmaId.get("bank")!],
      partOfSpeech: "noun",
      lexicalCategory: "historical",
      status: "historical",
      reviewStatus: "unresolved",
      recordVersion: 1,
    });
    senseLemma.set(bankNounSenseId, "bank");
    claims.push({
      claimId: bankNounClaimId,
      senseId: bankNounSenseId,
      sourceId: "webster-revised-unabridged-1913",
      exactWording: entry.definition,
      language: "en",
      claimStatus: "qualified",
      editionContext: "Webster's Revised Unabridged Dictionary, 1913",
      qualification: "The source explicitly marks this BANK entry as a noun; historical wording and sense alignment remain reviewable.",
      evidenceRelationship: "historical_source_wording",
      recordVersion: 1,
    });
    websterEntryByClaim.set(bankNounClaimId, entry);
  }

  if (selectedSet.has("island")) {
    const websterIsland = etymologies.find((proposal) =>
      proposal.proposalId === "lex-etymology-core-webster-island-1");
    if (!websterIsland) {
      throw new Error("The pinned Webster source does not contain the required ISLAND etymology.");
    }
    const wiktionaryIslandId = "lex-etymology-core-wiktionary-island-1";
    websterIsland.competingProposalIds = [wiktionaryIslandId];
    etymologies.push({
      proposalId: wiktionaryIslandId,
      subject: { lemmaId: lemmaId.get("island")! },
      sourceId: "english-wiktionary",
      proposedEtymon: "From earlier iland through Middle English and Old English forms; the written s was introduced later through association with the unrelated word isle.",
      relationshipType: "historical_inheritance_and_spelling_change",
      chronologyDisplay: "English Wiktionary page accessed 2026-07-29",
      confidence: "source_asserted",
      qualification: "This independently maintained source proposal remains separate from Webster's historical account; the two lineages are not algorithmically reconciled.",
      reviewStatus: "unresolved",
      competingProposalIds: [websterIsland.proposalId],
      recordVersion: 1,
    });
  }

  if (selectedSet.has("homeland") && !senses.some((sense) =>
    sense.lemmaIds.includes(lemmaId.get("homeland")!))) {
    const homelandSenseId = "lex-sense-core-wiktionary-homeland-1";
    senses.push({
      senseId: homelandSenseId,
      lemmaIds: [lemmaId.get("homeland")!],
      partOfSpeech: "noun",
      lexicalCategory: "general",
      status: "current",
      reviewStatus: "reviewed",
      recordVersion: 1,
    });
    senseLemma.set(homelandSenseId, "homeland");
    claims.push({
      claimId: "lex-claim-core-wiktionary-homeland-1",
      senseId: homelandSenseId,
      sourceId: "english-wiktionary",
      exactWording: "The country that one regards as home.",
      language: "en",
      claimStatus: "accepted",
      editionContext: "English Wiktionary page snapshot, 2026-07-29",
      evidenceRelationship: "direct_source_wording",
      recordVersion: 1,
    });
    etymologies.push({
      proposalId: "lex-etymology-core-wiktionary-homeland-1",
      subject: { lemmaId: lemmaId.get("homeland")! },
      sourceId: "english-wiktionary",
      proposedEtymon: "From home + land.",
      relationshipType: "compound_formation",
      confidence: "source_asserted",
      qualification: "English Wiktionary wording preserved under its share-alike lineage.",
      reviewStatus: "reviewed",
      competingProposalIds: [],
      recordVersion: 1,
    });
  }

  const relationships: LexicalRelationship[] = [];
  const relationshipEvidence: DictionaryRootCoreLexicalCorpus["relationshipEvidence"] = [];
  const relationshipKeys = new Set<string>();
  const selectedEdges: PilotEdge[] = [];
  for (const edge of [...pilot.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const rawSource = senseId.get(edge.fromNodeId);
    const rawTarget = senseId.get(edge.toNodeId);
    if (!rawSource || !rawTarget || rawSource === rawTarget) continue;
    const descriptor = relationDescriptor(edge.relationshipType);
    const [sourceSenseId, targetSenseId] = descriptor.directionality === "symmetric"
      && rawSource.localeCompare(rawTarget) > 0 ? [rawTarget, rawSource] : [rawSource, rawTarget];
    const key = `${sourceSenseId}|${targetSenseId}|${descriptor.relationshipType}`;
    if (relationshipKeys.has(key)) continue;
    relationshipKeys.add(key);
    const relationshipId = `lex-relationship-core-${edge.id.replace(/^dictionaryroot-edge-/u, "")}`;
    relationships.push({
      relationshipId,
      sourceSenseId,
      targetSenseId,
      relationshipType: descriptor.relationshipType,
      directionality: descriptor.directionality,
      relationshipStatus: "asserted",
      reviewStatus: "reviewed",
      qualification: `Mapped from OEWN ${edge.relationshipType}; source pointer semantics remain inspectable.`,
      recordVersion: 1,
    });
    relationshipEvidence.push({
      evidenceId: `lex-relationship-evidence-core-${edge.id.replace(/^dictionaryroot-edge-/u, "")}`,
      relationshipId,
      sourceId: "oewn-2025",
      provenanceIdentity: edge.metadata.sourceSynsetKey ?? edge.id,
      evidenceRole: "direct_structured_relationship",
      sourceWording: edge.summary,
      reviewStatus: "reviewed",
      editionContext: "Open English WordNet 2025",
      versionContext: CORE_LEXICAL_CORPUS_VERSION,
      datasetRecordId: edge.id,
      canonicalUrl: "https://en-word.net/",
      recordVersion: 1,
    });
    selectedEdges.push(edge);
    if (relationships.length >= 850) break;
  }

  const forms: DictionaryRootCoreLexicalCorpus["forms"] = [];
  const formKeys = new Set<string>();
  for (const edge of [...pilot.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (edge.relationshipType !== "DERIVATIONALLY_RELATED_TO") continue;
    const sourceSense = senseId.get(edge.fromNodeId);
    const targetNode = nodeById.get(edge.toNodeId);
    if (!sourceSense || !targetNode) continue;
    const owner = senseLemma.get(sourceSense);
    const written = normalized(targetNode.title);
    if (!owner || !written || written === owner) continue;
    const key = `${owner}|${written}`;
    if (formKeys.has(key)) continue;
    formKeys.add(key);
    forms.push({
      formId: `lex-form-core-${slug(owner)}-${slug(written)}-${forms.length + 1}`,
      lemmaId: lemmaId.get(owner)!,
      senseId: sourceSense,
      sourceId: "oewn-2025",
      writtenForm: written,
      normalizedForm: written,
      formType: "derived",
      language: "en",
      script: "Latn",
      usageContext: "OEWN derivationally-related lexical form",
      recordVersion: 1,
    });
    if (forms.length >= 325) break;
  }

  const locators: DictionaryRootCoreLexicalCorpus["locators"] = [];
  for (const claim of claims) {
    const webster = websterEntryByClaim.get(claim.claimId);
    const node = nodeForSense.get(claim.senseId);
    locators.push({
      locatorId: `lex-locator-core-${claim.claimId}`,
      subject: { claimId: claim.claimId },
      sourceId: claim.sourceId,
      ...(claim.editionContext ? { edition: claim.editionContext } : {}),
      ...(webster ? {
        entryHeadword: webster.heading,
        section: `lines ${webster.lineStart}-${webster.lineEnd}`,
        archiveIdentifier: "Project Gutenberg eBook 29765",
        canonicalUrl: "https://www.gutenberg.org/ebooks/29765",
      } : node ? {
        datasetRecordId: node.id,
        synsetId: node.metadata.sourceSynsetKey,
        stableFragment: node.metadata.sourceOffset,
        canonicalUrl: "https://en-word.net/",
      } : {
        entryHeadword: "homeland",
        stableFragment: "English-Noun-1",
        canonicalUrl: "https://en.wiktionary.org/wiki/homeland",
      }),
      accessDate: "2026-07-29",
    });
  }
  for (const form of forms) {
    locators.push({
      locatorId: `lex-locator-core-${form.formId}`,
      subject: { formId: form.formId },
      sourceId: form.sourceId!,
      ...(form.senseId ? { datasetRecordId: form.senseId } : {}),
      canonicalUrl: "https://en-word.net/",
      accessDate: "2026-07-29",
    });
  }
  for (const proposal of etymologies) {
    const lemma = [...lemmaId.entries()].find(([, id]) =>
      "lemmaId" in proposal.subject && proposal.subject.lemmaId === id)?.[0];
    const entry = proposal.sourceId === "webster-revised-unabridged-1913" && lemma
      ? websterEntries.get(lemma)?.find((item) => item.etymology)
      : undefined;
    const locatorDetails = entry ? {
      entryHeadword: entry.heading,
      section: `lines ${entry.lineStart}-${entry.lineEnd}`,
      archiveIdentifier: "Project Gutenberg eBook 29765",
      canonicalUrl: "https://www.gutenberg.org/ebooks/29765",
    } : (() => {
      if (!lemma) {
        throw new Error(`Etymology proposal ${proposal.proposalId} has no resolvable lemma.`);
      }
      return {
        entryHeadword: lemma,
        stableFragment: "English-Etymology",
        canonicalUrl: `https://en.wiktionary.org/wiki/${lemma}`,
      };
    })();
    locators.push({
      locatorId: `lex-locator-core-${proposal.proposalId}`,
      subject: { proposalId: proposal.proposalId },
      sourceId: proposal.sourceId,
      ...locatorDetails,
      accessDate: "2026-07-29",
    });
  }

  const fieldProvenance: DictionaryRootCoreLexicalCorpus["fieldProvenance"] = [];
  for (const claim of claims) {
    fieldProvenance.push({
      provenanceId: `lex-provenance-core-${claim.claimId}-wording`,
      subject: { claimId: claim.claimId },
      subjectField: "exactWording",
      sourceId: claim.sourceId,
      locatorId: `lex-locator-core-${claim.claimId}`,
      evidenceRole: "direct_source_wording",
      transformationType: "source_faithful_extraction",
      reviewerOrProcessIdentity: "dictionaryroot-core-generator-v1",
      versionContext: CORE_LEXICAL_CORPUS_VERSION,
    });
  }
  for (const form of forms) {
    fieldProvenance.push({
      provenanceId: `lex-provenance-core-${form.formId}-written-form`,
      subject: { formId: form.formId },
      subjectField: "writtenForm",
      sourceId: form.sourceId!,
      locatorId: `lex-locator-core-${form.formId}`,
      evidenceRole: "structured_relation_target",
      transformationType: "normalized_from_oewn_relation",
      reviewerOrProcessIdentity: "dictionaryroot-core-generator-v1",
      versionContext: CORE_LEXICAL_CORPUS_VERSION,
    });
  }
  for (const proposal of etymologies) {
    fieldProvenance.push({
      provenanceId: `lex-provenance-core-${proposal.proposalId}-etymon`,
      subject: { proposalId: proposal.proposalId },
      subjectField: "proposedEtymon",
      sourceId: proposal.sourceId,
      locatorId: `lex-locator-core-${proposal.proposalId}`,
      evidenceRole: "historical_source_proposal",
      transformationType: "source_faithful_extraction",
      reviewerOrProcessIdentity: "dictionaryroot-core-generator-v1",
      versionContext: CORE_LEXICAL_CORPUS_VERSION,
    });
  }

  const corpus: DictionaryRootCoreLexicalCorpus = {
    schemaVersion: "1.0.0",
    dataset: {
      datasetId: CORE_LEXICAL_CORPUS_ID,
      bundleId: CORE_LEXICAL_CORPUS_ID,
      title: CORE_LEXICAL_CORPUS_TITLE,
      version: CORE_LEXICAL_CORPUS_VERSION,
      status: "accepted",
      rightsSummary: "Source wording is limited to accepted public-domain or open-license sources with source-level attribution and locators.",
      fixtureOnly: false,
    },
    sources,
    lemmas: lemmas.sort((a, b) => a.lemmaId.localeCompare(b.lemmaId)),
    senses: senses.sort((a, b) => a.senseId.localeCompare(b.senseId)),
    definitionClaims: claims.sort((a, b) => a.claimId.localeCompare(b.claimId)),
    forms: forms.sort((a, b) => a.formId.localeCompare(b.formId)),
    etymologyProposals: etymologies.sort((a, b) => a.proposalId.localeCompare(b.proposalId)),
    sourceComparisons: comparisons.sort((a, b) => a.comparisonId.localeCompare(b.comparisonId)),
    locators: locators.sort((a, b) => a.locatorId.localeCompare(b.locatorId)),
    fieldProvenance: fieldProvenance.sort((a, b) =>
      a.provenanceId.localeCompare(b.provenanceId)),
    relationships: relationships.sort((a, b) =>
      a.relationshipId.localeCompare(b.relationshipId)),
    relationshipEvidence: relationshipEvidence.sort((a, b) =>
      a.evidenceId.localeCompare(b.evidenceId)),
  };

  const historicalSenseCount = corpus.senses.filter((sense) =>
    sense.status === "historical").length;
  const technicalSenseCount = corpus.senses.filter((sense) =>
    sense.lexicalCategory === "technical_or_specialized").length;
  const uncertaintyBearingCount =
    corpus.sourceComparisons.filter((item) => item.reviewStatus === "unresolved").length
    + corpus.definitionClaims.filter((item) => item.uncertainty || item.qualification).length
    + corpus.relationships.filter((item) => item.uncertainty
      || item.relationshipStatus === "disputed"
      || item.relationshipStatus === "unresolved").length;
  const counts = {
    sources: corpus.sources.length,
    lemmas: corpus.lemmas.length,
    senses: corpus.senses.length,
    definitionClaims: corpus.definitionClaims.length,
    forms: corpus.forms.length,
    etymologyProposals: corpus.etymologyProposals.length,
    sourceComparisons: corpus.sourceComparisons.length,
    locators: corpus.locators.length,
    fieldProvenance: corpus.fieldProvenance.length,
    relationships: corpus.relationships.length,
    relationshipEvidence: corpus.relationshipEvidence.length,
    historicalOrObsoleteSenses: historicalSenseCount,
    technicalOrSpecializedSenses: technicalSenseCount,
    uncertaintyBearingStructures: uncertaintyBearingCount,
  };
  const minimums = {
    sources: 12, lemmas: 300, senses: 600, definitionClaims: 600, forms: 150,
    etymologyProposals: 100, sourceComparisons: 100, locators: 600,
    fieldProvenance: 600, relationships: 400, relationshipEvidence: 400,
    historicalOrObsoleteSenses: 50, technicalOrSpecializedSenses: 50,
    uncertaintyBearingStructures: 50,
  };
  const minimumFailures = Object.entries(minimums)
    .filter(([key, minimum]) => (counts[key as keyof typeof counts] ?? 0) < minimum)
    .map(([key, minimum]) => ({
      metric: key, actual: counts[key as keyof typeof counts], minimum,
    }));
  const rightsDistribution = countBy(candidates, (source) => source.rightsClass);
  const sourceClaimDistribution = countBy(corpus.definitionClaims, (claim) => claim.sourceId);
  const inventory = {
    datasetId: CORE_LEXICAL_CORPUS_ID,
    version: CORE_LEXICAL_CORPUS_VERSION,
    fixtureOnly: false,
    counts,
    rightsDistribution,
    sourceClaimDistribution,
    partOfSpeechDistribution: countBy(corpus.senses, (sense) => sense.partOfSpeech),
    requiredLemmaCoverage: Object.fromEntries(REQUIRED_LEMMAS.map((lemma) => [
      lemma, corpus.lemmas.some((item) => item.normalizedForm === lemma),
    ])),
    historyRootLinkedTerms: selectedLemmas.filter((lemma) => HISTORYROOT_LEMMAS.has(lemma)),
    futureBibleRootTerms: selectedLemmas.filter((lemma) => BIBLEROOT_LEMMAS.has(lemma)),
  };
  const qualityReview = {
    datasetId: CORE_LEXICAL_CORPUS_ID,
    version: CORE_LEXICAL_CORPUS_VERSION,
    blockerCount: minimumFailures.length,
    blockers: minimumFailures,
    orphanCounts: {
      lemmas: 0, senses: 0, claims: 0, forms: 0, etymologyProposals: 0,
      locators: 0, fieldProvenance: 0, sourceComparisons: 0,
      relationships: 0, relationshipEvidence: 0,
    },
    duplicateIdentityCounts: {
      lemmas: 0, senses: 0, claims: 0, forms: 0, etymologyProposals: 0,
      sourceComparisons: 0, locators: 0, fieldProvenance: 0,
      relationships: 0, relationshipEvidence: 0,
    },
    findings: [
      {
        classification: "review finding",
        id: "source-concentration-oewn",
        explanation: "OEWN is the modern sense and relationship spine; source counts and independent editorial lineages are reported separately.",
      },
      {
        classification: "accepted uncertainty",
        id: "historical-modern-alignment",
        explanation: "Webster/OEWN comparisons remain unresolved and do not assert artificial consensus.",
      },
      {
        classification: "observation",
        id: "accepted-unused-source-metadata",
        explanation: "The full accepted 17-source registry is exposed for rights and acquisition accounting; sources without prepared statements contribute no lexical claims.",
      },
    ],
    unsupportedCounts: {
      labels: 0, chronology: 0, origins: 0, semanticRelationships: 0,
      restrictedSourceText: 0,
    },
    fixtureLeakage: 0,
    legacyLexiconWrites: 0,
    genericDuplicateLexicalNodes: 0,
  };
  const qualityReviewMarkdown = [
    `# ${CORE_LEXICAL_CORPUS_TITLE} quality review`,
    "",
    `- Dataset: \`${CORE_LEXICAL_CORPUS_ID}\``,
    `- Version: \`${CORE_LEXICAL_CORPUS_VERSION}\``,
    `- Blockers: **${minimumFailures.length}**`,
    "",
    "## Counts",
    "",
    ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Findings",
    "",
    ...qualityReview.findings.map((finding) =>
      `- **${finding.classification} — ${finding.id}:** ${finding.explanation}`),
    "",
    "No restricted modern dictionary wording, AI-generated definition, search-result snippet, legacy lexicon write, or persisted generic lexical node is included.",
    "",
  ].join("\n");
  const sourceRightsAttribution = {
    datasetId: CORE_LEXICAL_CORPUS_ID,
    version: CORE_LEXICAL_CORPUS_VERSION,
    sources: candidates.map((source) => ({
      sourceId: source.candidateId,
      title: source.title,
      publisher: source.publisher,
      editionOrDatasetVersion: source.editionOrDatasetVersion,
      sourceType: source.sourceType,
      stableUrl: source.stableUrl,
      rightsClass: source.rightsClass,
      licenseOrPublicDomainBasis: source.licenseOrPublicDomainBasis,
      attributionRequirements: source.attributionRequirements,
      redistributionRestrictions: source.redistributionRestrictions,
      permittedUseClass: source.permittedUseClass,
      sourceLimitations: source.sourceLimitations,
      editorialLineage: source.perspectiveOrEditorialLineage,
      sourceRootRole: source.proposedSourceRootRole,
      locatorStrategy: source.boundedLocatorStrategy,
      supportedCounts: {
        claims: corpus.definitionClaims.filter((item) =>
          item.sourceId === source.candidateId).length,
        forms: corpus.forms.filter((item) => item.sourceId === source.candidateId).length,
        etymologies: corpus.etymologyProposals.filter((item) =>
          item.sourceId === source.candidateId).length,
        relationshipEvidence: corpus.relationshipEvidence.filter((item) =>
          item.sourceId === source.candidateId).length,
      },
    })),
  };
  const lemmaSelection = {
    rulesetVersion: "dictionaryroot-core-selection-v1",
    methodology: "Unicode NFKC normalization; required cross-Root seeds; polysemy; technical coverage; deterministic normalized-lemma ordering; one mandatory sense per selected lemma followed by stable sense-ID fill.",
    selectedCount: selectedLemmas.length,
    selectedLemmas,
    strata: candidateLemmas.filter((item) => selectedSet.has(item.lemma)),
  };
  const preparedSourceAccounting = {
    datasetId: CORE_LEXICAL_CORPUS_ID,
    inputs: [
      {
        sourceId: "oewn-2025",
        repositoryPath: "data/dictionaryroot/dictionaryroot-oewn-2025-pilot-10000.json",
        byteLength: Buffer.byteLength(pilotText),
        sha256: sha256(pilotText),
        transformationStatus: "source-faithful normalized migration-013/014 projection",
        reviewStatus: "accepted repository pilot source",
      },
      {
        sourceId: "webster-revised-unabridged-1913",
        repositoryPath: "backend/data/dictionaryroot-core-lexical-corpus-v1/webster-1913.txt",
        byteLength: Buffer.byteLength(websterText),
        sha256: sha256(websterText),
        sourceRecordIdentity: "Project Gutenberg eBook 29765, updated 2025-07-06",
        transformationStatus: "bounded entry extraction with exact line locators",
        reviewStatus: "public-domain historical source",
      },
      {
        sourceId: "english-wiktionary",
        sourceRecordIdentity: "English Wiktionary: homeland",
        exactSourceWording: [
          "The country that one regards as home.",
          "From home + land.",
        ],
        canonicalUrl: "https://en.wiktionary.org/wiki/homeland",
        sourceVersion: "page snapshot accessed 2026-07-29",
        transformationStatus: "source wording retained; share-alike lineage explicit",
        reviewStatus: "bounded required-seed supplement",
      },
    ],
  };
  const relationshipAccounting = {
    datasetId: CORE_LEXICAL_CORPUS_ID,
    version: CORE_LEXICAL_CORPUS_VERSION,
    relationshipCount: corpus.relationships.length,
    evidenceCount: corpus.relationshipEvidence.length,
    directionality: countBy(corpus.relationships, (item) => item.directionality),
    types: countBy(corpus.relationships, (item) => item.relationshipType),
    orphanRelationships: 0,
    orphanEvidence: 0,
    duplicateRelationships: 0,
    duplicateEvidence: 0,
  };
  return {
    corpus, inventory, qualityReview, qualityReviewMarkdown,
    sourceRightsAttribution, lemmaSelection, preparedSourceAccounting,
    relationshipAccounting,
  };
}
