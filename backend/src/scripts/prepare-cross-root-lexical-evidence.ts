import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CROSS_ROOT_ALGORITHM_VERSION,
  CROSS_ROOT_DATASET_ID,
  CROSS_ROOT_DATASET_VERSION,
  CROSS_ROOT_DATA_DIRECTORY,
  deterministicHash,
  gitBlob,
  normalizedLexicalText,
  sha256,
  type CrossRootEvidence,
  type CrossRootInputFingerprint,
  type CrossRootLink,
  type CrossRootManifest,
  type CrossRootResource,
  type CrossRootResourceField,
} from "../cross-root/lexical-evidence.js";

const BACKEND_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPOSITORY_ROOT = path.resolve(BACKEND_ROOT, "..");
const DICTIONARY_FILE = "backend/data/dictionaryroot-core-lexical-corpus-v1/corpus.json";
const HISTORY_FILE = "backend/data/historyroot-wampanoag-regional-corpus-v1/historyroot-wampanoag-regional-corpus-v1.bundle.json";
const KJV_MANIFEST_FILE = "backend/data/bibleroot-foundation-v1/dataset-manifest.json";
const KJV_EDITION_FILE = "backend/data/bibleroot-foundation-v1/edition.json";
const KJV_VERSES_FILE = "backend/data/bibleroot-foundation-v1/verses.json";
const TRANSLATION_FILES = [
  "backend/data/bibleroot-translation-comparison-v1/normalized/asv.json",
  "backend/data/bibleroot-translation-comparison-v1/normalized/web.json",
  "backend/data/bibleroot-translation-comparison-v1/normalized/ylt.json",
];

interface DictionaryCorpus {
  dataset: { datasetId: string; version: string; status: string; fixtureOnly: boolean };
  lemmas: Array<{ lemmaId: string; canonicalWrittenForm: string; normalizedForm: string; language: string; status: string }>;
}

interface HistoryBundle {
  bundleId: string;
  version: string;
  domain: string;
  context: Record<string, Array<Record<string, unknown>>>;
}

interface BibleVerse {
  canonicalReferenceId: string;
  editionTextId: string;
  normalizedReference: string;
  exactText: string;
  bookName?: string;
  chapterNumber?: number;
  verseNumber?: number;
}

interface TranslationDataset {
  datasetId: string;
  datasetVersion: string;
  edition: { editionId: string; abbreviation: string; displayTitle: string };
  verses: BibleVerse[];
}

interface PendingOccurrence {
  sourceResourceId: string;
  targetResourceId: string;
  targetRootId: "HistoryRoot" | "BibleRoot";
  targetField: string;
  observedSurfaceText: string;
  normalizedMatchText: string;
  startOffset: number;
  endOffset: number;
  contextExcerpt: string;
  targetContentHash: string;
  targetFieldContentHash: string;
  sourceDatasetId: string;
  sourceDatasetVersion: string;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPOSITORY_ROOT, relative), "utf8")) as T;
}

function resourceId(root: string, type: string, publicId: string): string {
  return `cr-resource-${root.toLowerCase()}-${sha256(`${root}|${type}|${publicId}`).slice(0, 32).toLowerCase()}`;
}

function linkId(sourceId: string, targetId: string): string {
  return `cr-link-${sha256(`${sourceId}|${targetId}|exact_lexical_occurrence`).slice(0, 32).toLowerCase()}`;
}

function evidenceId(key: string): string {
  return `cr-evidence-${sha256(key).slice(0, 32).toLowerCase()}`;
}

function canonicalQuery(page: string, parameters: Record<string, string>, fragment?: string): string {
  const query = new URLSearchParams(parameters);
  return `${page}?${query.toString()}${fragment ? `#${fragment}` : ""}`;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function fields(entries: Array<[string, unknown]>): CrossRootResourceField[] {
  return entries.flatMap(([name, value]) => {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => text(item) ? [{ name: `${name}[${index}]`, text: String(item) }] : []);
    }
    return text(value) ? [{ name, text: String(value) }] : [];
  });
}

const HISTORY_KINDS: Array<{
  collection: string;
  kind: string;
  fieldNames: string[];
}> = [
  { collection: "entities", kind: "entity", fieldNames: ["label", "name", "alternateNames", "description"] },
  { collection: "temporalAssertions", kind: "temporal_assertion", fieldNames: ["label", "dateLabel", "dateNotes"] },
  { collection: "accounts", kind: "account", fieldNames: ["label", "content", "publicationLabel"] },
  { collection: "claims", kind: "claim", fieldNames: ["label", "statement"] },
  { collection: "evidence", kind: "evidence", fieldNames: ["label", "explanation"] },
  { collection: "interpretations", kind: "interpretation", fieldNames: ["label", "interpretation", "uncertainty"] },
  { collection: "perspectives", kind: "perspective", fieldNames: ["label", "name", "description"] },
  { collection: "causalLinks", kind: "causal_link", fieldNames: ["label", "explanation", "uncertainty"] },
  { collection: "relationships", kind: "relationship", fieldNames: ["label", "explanation", "uncertainty"] },
  { collection: "culturalMemories", kind: "cultural_memory", fieldNames: ["label", "narrative", "periodLabel"] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function lexicalPattern(normalizedLemma: string): RegExp {
  const phrase = normalizedLemma.split(" ").map(escapeRegex).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "giu");
}

function excerptFor(value: string, start: number, end: number): string {
  return value.slice(Math.max(0, start - 64), Math.min(value.length, end + 64)).trim();
}

async function fingerprint(relative: string, datasetId: string, datasetVersion: string): Promise<CrossRootInputFingerprint> {
  const bytes = await readFile(path.join(REPOSITORY_ROOT, relative));
  return { filename: relative, datasetId, datasetVersion, byteLength: bytes.byteLength, sha256: sha256(bytes), gitBlob: gitBlob(bytes) };
}

function createHistoryResources(bundle: HistoryBundle): CrossRootResource[] {
  const aliasMap = new Map<string, string[]>();
  for (const alias of bundle.context.aliases ?? []) {
    const entityId = text(alias.entityId);
    const aliasText = text(alias.text);
    if (entityId && aliasText) aliasMap.set(entityId, [...(aliasMap.get(entityId) ?? []), aliasText]);
  }
  const output: CrossRootResource[] = [];
  for (const definition of HISTORY_KINDS) {
    for (const record of bundle.context[definition.collection] ?? []) {
      const publicId = text(record.id);
      const label = text(record.label);
      if (!publicId || !label) throw new Error(`HistoryRoot ${definition.kind} lacks a public ID or label.`);
      const recordFields = fields(definition.fieldNames.map((name) => [name, record[name]]));
      const aliases = aliasMap.get(publicId) ?? [];
      for (const [index, alias] of aliases.entries()) recordFields.push({ name: `publishedAliases[${index}]`, text: alias });
      const contentHash = deterministicHash(recordFields);
      output.push({
        resourceId: resourceId("hr", "accepted-contextual-record", publicId),
        rootId: "HistoryRoot",
        resourceType: "accepted-contextual-record",
        canonicalPublicId: publicId,
        displayLabel: `${label} · ${definition.kind.replaceAll("_", " ")}`,
        canonicalLocalUrl: canonicalQuery("history-record-v1.html", { id: publicId }),
        sourceDatasetId: bundle.bundleId,
        sourceDatasetVersion: bundle.version,
        resourceContentHash: contentHash,
        deterministicIdentityHash: deterministicHash(["HistoryRoot", definition.kind, publicId, bundle.bundleId, bundle.version]),
        displayOrder: 0,
        metadata: { recordKind: definition.kind, status: record.status ?? null, fields: recordFields },
      });
    }
  }
  return output.sort((left, right) => String(left.metadata.recordKind).localeCompare(String(right.metadata.recordKind)) || left.canonicalPublicId.localeCompare(right.canonicalPublicId));
}

function createBibleResource(verse: BibleVerse, edition: { abbreviation: string; displayTitle: string }, datasetId: string, datasetVersion: string): CrossRootResource {
  const reference = verse.normalizedReference ?? `${verse.bookName} ${verse.chapterNumber}:${verse.verseNumber}`;
  const chapterReference = reference.replace(/:\d+$/u, "");
  const resourceFields = [{ name: "exactText", text: verse.exactText }];
  return {
    resourceId: resourceId("br", "edition-verse-text", verse.editionTextId),
    rootId: "BibleRoot",
    resourceType: "edition-verse-text",
    canonicalPublicId: verse.editionTextId,
    displayLabel: `${edition.abbreviation} · ${reference}`,
    canonicalLocalUrl: canonicalQuery("bibleroot-passage.html", { reference: chapterReference }, verse.canonicalReferenceId),
    sourceDatasetId: datasetId,
    sourceDatasetVersion: datasetVersion,
    resourceContentHash: sha256(verse.exactText),
    deterministicIdentityHash: deterministicHash(["BibleRoot", verse.editionTextId, datasetId, datasetVersion]),
    displayOrder: 0,
    metadata: { canonicalReferenceId: verse.canonicalReferenceId, normalizedReference: reference, editionTitle: edition.displayTitle, editionAbbreviation: edition.abbreviation, fields: resourceFields },
  };
}

export async function prepare(): Promise<CrossRootManifest["expectedCounts"]> {
  const dictionary = await readJson<DictionaryCorpus>(DICTIONARY_FILE);
  const history = await readJson<HistoryBundle>(HISTORY_FILE);
  const kjvManifest = await readJson<{ datasetId: string; version: string }>(KJV_MANIFEST_FILE);
  const kjvEdition = await readJson<{ editionId: string; abbreviation: string; displayTitle: string }>(KJV_EDITION_FILE);
  const kjvVerses = await readJson<BibleVerse[]>(KJV_VERSES_FILE);
  const translations = await Promise.all(TRANSLATION_FILES.map((filename) => readJson<TranslationDataset>(filename)));
  if (dictionary.dataset.datasetId !== "dictionaryroot-core-lexical-corpus-v1" || dictionary.dataset.version !== "1.0.0" || dictionary.dataset.status !== "accepted" || dictionary.dataset.fixtureOnly) {
    throw new Error("DictionaryRoot input is not the accepted production corpus.");
  }
  if (history.bundleId !== "historyroot-plymouth-knowledge-dataset-v1" || history.version !== "1.3.0" || history.domain !== "HistoryRoot") {
    throw new Error("HistoryRoot input is not the released 1.3.0 bundle.");
  }
  if (kjvManifest.datasetId !== "bibleroot-foundation-v1" || kjvManifest.version !== "1.0.0" || kjvVerses.length !== 110) {
    throw new Error("BibleRoot Foundation input identity is invalid.");
  }
  if (translations.some((item) => item.datasetId !== "bibleroot-translation-comparison-v1" || item.datasetVersion !== "1.0.0" || item.verses.length !== 110)) {
    throw new Error("BibleRoot Translation Comparison input identity is invalid.");
  }

  const dictionaryResources: CrossRootResource[] = dictionary.lemmas
    .filter((lemma) => lemma.language === "en" && lemma.status === "active")
    .sort((left, right) => left.canonicalWrittenForm.localeCompare(right.canonicalWrittenForm) || left.lemmaId.localeCompare(right.lemmaId))
    .map((lemma) => ({
      resourceId: resourceId("dr", "lemma", lemma.lemmaId), rootId: "DictionaryRoot", resourceType: "lemma",
      canonicalPublicId: lemma.lemmaId, displayLabel: lemma.canonicalWrittenForm,
      canonicalLocalUrl: canonicalQuery("concept-v2.html", { q: lemma.canonicalWrittenForm }),
      sourceDatasetId: dictionary.dataset.datasetId, sourceDatasetVersion: dictionary.dataset.version,
      resourceContentHash: sha256(lemma.canonicalWrittenForm),
      deterministicIdentityHash: deterministicHash(["DictionaryRoot", lemma.lemmaId, dictionary.dataset.datasetId, dictionary.dataset.version]),
      displayOrder: 0, metadata: { canonicalWrittenForm: lemma.canonicalWrittenForm, normalizedForm: normalizedLexicalText(lemma.normalizedForm) },
    }));
  if (dictionaryResources.length !== 500) throw new Error("Expected 500 production DictionaryRoot lemmas.");
  const historyResources = createHistoryResources(history);
  const bibleResources = [
    ...kjvVerses.map((verse) => createBibleResource(verse, kjvEdition, kjvManifest.datasetId, kjvManifest.version)),
    ...translations.flatMap((dataset) => dataset.verses.map((verse) => createBibleResource(verse, dataset.edition, dataset.datasetId, dataset.datasetVersion))),
  ];
  const resources = [...dictionaryResources, ...historyResources, ...bibleResources].map((resource, index) => ({ ...resource, displayOrder: index + 1 }));
  const resourcesById = new Map(resources.map((resource) => [resource.resourceId, resource]));

  const occurrences: PendingOccurrence[] = [];
  const targetResources = [...historyResources, ...bibleResources];
  for (const lemma of dictionaryResources) {
    const normalizedLemma = String(lemma.metadata.normalizedForm);
    if (!normalizedLemma) continue;
    const pattern = lexicalPattern(normalizedLemma);
    for (const target of targetResources) {
      for (const field of target.metadata.fields ?? []) {
        pattern.lastIndex = 0;
        for (let match = pattern.exec(field.text); match; match = pattern.exec(field.text)) {
          const observed = match[0];
          if (normalizedLexicalText(observed) !== normalizedLemma) continue;
          const start = match.index;
          const end = start + observed.length;
          occurrences.push({ sourceResourceId: lemma.resourceId, targetResourceId: target.resourceId,
            targetRootId: target.rootId as "HistoryRoot" | "BibleRoot", targetField: field.name,
            observedSurfaceText: observed, normalizedMatchText: normalizedLemma, startOffset: start, endOffset: end,
            contextExcerpt: excerptFor(field.text, start, end), targetContentHash: target.resourceContentHash,
            targetFieldContentHash: sha256(field.text), sourceDatasetId: target.sourceDatasetId,
            sourceDatasetVersion: target.sourceDatasetVersion });
          if (match[0].length === 0) pattern.lastIndex += 1;
        }
      }
    }
  }
  occurrences.sort((left, right) => left.sourceResourceId.localeCompare(right.sourceResourceId)
    || left.targetRootId.localeCompare(right.targetRootId) || left.targetResourceId.localeCompare(right.targetResourceId)
    || left.targetField.localeCompare(right.targetField) || left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  const grouped = new Map<string, PendingOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.sourceResourceId}|${occurrence.targetResourceId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), occurrence]);
  }
  const links: CrossRootLink[] = [...grouped.keys()].map((key): CrossRootLink => {
    const [sourceResourceId, targetResourceId] = key.split("|") as [string, string];
    const target = resourcesById.get(targetResourceId)!;
    const content = { sourceResourceId, targetResourceId, relationshipType: "exact_lexical_occurrence",
      directionality: "directional", derivationKind: "textually_observed", reviewStatus: "unreviewed",
      algorithmVersion: CROSS_ROOT_ALGORITHM_VERSION } as const;
    return { linkId: linkId(sourceResourceId, targetResourceId), sourceRootId: "DictionaryRoot",
      targetRootId: target.rootId as "HistoryRoot" | "BibleRoot", ...content,
      deterministicContentHash: deterministicHash(content), displayOrder: 0 };
  }).sort((left, right) => left.sourceResourceId.localeCompare(right.sourceResourceId)
    || left.targetRootId.localeCompare(right.targetRootId) || left.targetResourceId.localeCompare(right.targetResourceId))
    .map((link, index) => ({ ...link, displayOrder: index + 1 }));
  const linkByPair = new Map(links.map((link) => [`${link.sourceResourceId}|${link.targetResourceId}`, link]));
  const evidenceCounters = new Map<string, number>();
  const evidence: CrossRootEvidence[] = occurrences.map((occurrence) => {
    const link = linkByPair.get(`${occurrence.sourceResourceId}|${occurrence.targetResourceId}`)!;
    const order = (evidenceCounters.get(link.linkId) ?? 0) + 1;
    evidenceCounters.set(link.linkId, order);
    const key = `${link.linkId}|${occurrence.targetField}|${occurrence.startOffset}|${occurrence.endOffset}`;
    return { evidenceId: evidenceId(key), linkId: link.linkId, targetField: occurrence.targetField,
      observedSurfaceText: occurrence.observedSurfaceText, normalizedMatchText: occurrence.normalizedMatchText,
      startOffset: occurrence.startOffset, endOffset: occurrence.endOffset, contextExcerpt: occurrence.contextExcerpt,
      targetContentHash: occurrence.targetContentHash, targetFieldContentHash: occurrence.targetFieldContentHash,
      sourceDatasetId: occurrence.sourceDatasetId, sourceDatasetVersion: occurrence.sourceDatasetVersion,
      evidenceOrder: order };
  });

  const inputFingerprints = await Promise.all([
    fingerprint(DICTIONARY_FILE, dictionary.dataset.datasetId, dictionary.dataset.version),
    fingerprint(HISTORY_FILE, history.bundleId, history.version),
    fingerprint(KJV_MANIFEST_FILE, kjvManifest.datasetId, kjvManifest.version),
    fingerprint(KJV_EDITION_FILE, kjvManifest.datasetId, kjvManifest.version),
    fingerprint(KJV_VERSES_FILE, kjvManifest.datasetId, kjvManifest.version),
    ...TRANSLATION_FILES.map((filename) => fingerprint(filename, "bibleroot-translation-comparison-v1", "1.0.0")),
  ]);
  const expectedCounts = {
    resources: resources.length, dictionaryResources: dictionaryResources.length, historyResources: historyResources.length,
    bibleResources: bibleResources.length, links: links.length, evidence: evidence.length,
    dictionaryToHistoryLinks: links.filter((link) => link.targetRootId === "HistoryRoot").length,
    dictionaryToBibleLinks: links.filter((link) => link.targetRootId === "BibleRoot").length,
    historyOccurrences: evidence.filter((item) => linkByPair.get(`${links.find((link) => link.linkId === item.linkId)?.sourceResourceId}|${links.find((link) => link.linkId === item.linkId)?.targetResourceId}`)?.targetRootId === "HistoryRoot").length,
    bibleOccurrences: evidence.filter((item) => links.find((link) => link.linkId === item.linkId)?.targetRootId === "BibleRoot").length,
  };
  const manifest: CrossRootManifest = {
    schemaVersion: "1.0.0", datasetId: CROSS_ROOT_DATASET_ID, version: CROSS_ROOT_DATASET_VERSION,
    title: "Cross-Root Link Foundation and Deterministic Lexical Evidence v1", algorithmVersion: CROSS_ROOT_ALGORITHM_VERSION,
    derivationBoundary: "Exact normalized lexical occurrence only; no sense, equivalence, influence, causation, significance, agreement, or contradiction inference.",
    reviewBoundary: "All 14A links are unreviewed deterministic textual observations; automated validation is not human semantic review.",
    participatingRoots: ["DictionaryRoot", "HistoryRoot", "BibleRoot"],
    participatingResourceTypes: ["lemma", "accepted-contextual-record", "edition-verse-text"],
    inputDatasetIdentities: [
      { datasetId: dictionary.dataset.datasetId, version: dictionary.dataset.version, rootId: "DictionaryRoot" },
      { datasetId: history.bundleId, version: history.version, rootId: "HistoryRoot" },
      { datasetId: kjvManifest.datasetId, version: kjvManifest.version, rootId: "BibleRoot" },
      { datasetId: "bibleroot-translation-comparison-v1", version: "1.0.0", rootId: "BibleRoot" },
    ], expectedCounts,
    excludedLayers: ["DictionaryRoot senses and definition claims", "HistoryRoot drafts, proposals, moderation, audit, IDs, hashes, hidden metadata, and source metadata", "BibleRoot Original Language", "BibleRoot commentary", "BibleRoot rights and provenance metadata", "direct BibleRoot-to-HistoryRoot links", "semantic scores, embeddings, fuzzy matches, stemming, morphology, synonym expansion, and inferred equivalence"],
  };
  await mkdir(CROSS_ROOT_DATA_DIRECTORY, { recursive: true });
  const outputs: Record<string, unknown> = {
    "dataset-manifest.json": manifest, "input-fingerprints.json": inputFingerprints,
    "resource-registry.json": resources, "links.json": links, "evidence.json": evidence,
  };
  for (const [filename, value] of Object.entries(outputs)) await writeFile(path.join(CROSS_ROOT_DATA_DIRECTORY, filename), json(value), "utf8");
  const hashFiles = [];
  for (const filename of Object.keys(outputs)) {
    const bytes = await readFile(path.join(CROSS_ROOT_DATA_DIRECTORY, filename));
    hashFiles.push({ filename, byteLength: bytes.byteLength, sha256: sha256(bytes) });
  }
  await writeFile(path.join(CROSS_ROOT_DATA_DIRECTORY, "hashes.json"), json({ datasetId: CROSS_ROOT_DATASET_ID, version: CROSS_ROOT_DATASET_VERSION, files: hashFiles }), "utf8");
  console.log(JSON.stringify({ datasetId: CROSS_ROOT_DATASET_ID, version: CROSS_ROOT_DATASET_VERSION, algorithmVersion: CROSS_ROOT_ALGORITHM_VERSION, ...expectedCounts }, null, 2));
  return expectedCounts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  prepare().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
