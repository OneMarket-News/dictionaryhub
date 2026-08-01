import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PoolClient } from "pg";

import {
  validateBibleRootFoundation,
  type BibleRootFoundationDataset,
} from "../bibleroot/foundation.js";
import {
  loadOriginalLanguageDataset,
  type OriginalLanguageDataset,
} from "../bibleroot/original-languages.js";
import {
  validateTranslationComparisonDataset,
  type TranslationComparisonDataset,
} from "../bibleroot/translation-comparison.js";
import {
  validateCommentaryDataset,
  type CommentaryDataset,
} from "../bibleroot/commentary-provenance.js";
import {
  CORE_LEXICAL_CORPUS_ID,
  CORE_LEXICAL_CORPUS_VERSION,
} from "../dictionaryroot/core-lexical-corpus.js";
import type { DictionaryRootCoreLexicalCorpus } from "../dictionaryroot/lexical-evidence-types.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  authorizeLocalDevelopmentDatabase,
  type LocalDevelopmentDatabaseAuthorization,
  type LocalDevelopmentDatabaseTarget,
} from "../lib/local-development-database.js";
import { importBibleRootFoundation } from "./import-bibleroot-foundation.js";
import { importBibleRootOriginalLanguageFoundation } from "./import-bibleroot-original-language-foundation.js";
import { importBibleRootTranslationComparison } from "./import-bibleroot-translation-comparison.js";
import { importBibleRootCommentaryProvenance } from "./import-bibleroot-commentary-provenance.js";
import { getDevelopmentRuntimeReadiness } from "../services/development-runtime-readiness.js";
import { saveDictionaryRootCoreLexicalCorpus } from "../services/lexical-evidence-store.js";

const BACKEND_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE_CORPUS_DIRECTORY = path.join(
  BACKEND_ROOT,
  "data",
  "dictionaryroot-core-lexical-corpus-v1",
);

interface HashManifest {
  datasetId: string;
  version: string;
  artifacts: Array<{ name: string; byteLength: number; sha256: string }>;
}

export interface ValidatedDevelopmentDatasets {
  dictionaryRoot: DictionaryRootCoreLexicalCorpus;
  bibleRootFoundation: BibleRootFoundationDataset;
  bibleRootOriginalLanguage: OriginalLanguageDataset;
  bibleRootTranslationComparison: TranslationComparisonDataset;
  bibleRootCommentaryProvenance: CommentaryDataset;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(filename, "utf8")) as T;
}

export async function validateDictionaryRootCoreCorpus(): Promise<DictionaryRootCoreLexicalCorpus> {
  const hashes = await readJson<HashManifest>(path.join(CORE_CORPUS_DIRECTORY, "hashes.json"));
  if (
    hashes.datasetId !== CORE_LEXICAL_CORPUS_ID
    || hashes.version !== CORE_LEXICAL_CORPUS_VERSION
  ) {
    throw new Error("DictionaryRoot corpus hash-manifest identity is invalid.");
  }
  for (const artifact of hashes.artifacts) {
    const bytes = await readFile(path.join(CORE_CORPUS_DIRECTORY, artifact.name));
    if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256) {
      throw new Error(`DictionaryRoot corpus artifact checksum mismatch: ${artifact.name}`);
    }
  }
  const corpus = await readJson<DictionaryRootCoreLexicalCorpus>(
    path.join(CORE_CORPUS_DIRECTORY, "corpus.json"),
  );
  if (
    corpus.dataset.datasetId !== CORE_LEXICAL_CORPUS_ID
    || corpus.dataset.bundleId !== CORE_LEXICAL_CORPUS_ID
    || corpus.dataset.version !== CORE_LEXICAL_CORPUS_VERSION
    || corpus.dataset.status !== "accepted"
    || corpus.dataset.fixtureOnly !== false
  ) {
    throw new Error("DictionaryRoot corpus identity or release status is invalid.");
  }
  const counts = [
    corpus.sources.length,
    corpus.lemmas.length,
    corpus.senses.length,
    corpus.definitionClaims.length,
    corpus.relationships.length,
    corpus.relationshipEvidence.length,
  ];
  if (JSON.stringify(counts) !== JSON.stringify([17, 500, 1014, 1145, 722, 722])) {
    throw new Error("DictionaryRoot corpus release counts are invalid.");
  }
  return corpus;
}

export async function validateDevelopmentDatasets(): Promise<ValidatedDevelopmentDatasets> {
  const [dictionaryRoot, bibleRootFoundation, bibleRootOriginalLanguage, bibleRootTranslationComparison, bibleRootCommentaryProvenance] = await Promise.all([
    validateDictionaryRootCoreCorpus(),
    validateBibleRootFoundation(),
    loadOriginalLanguageDataset(),
    validateTranslationComparisonDataset(),
    validateCommentaryDataset(),
  ]);
  return { dictionaryRoot, bibleRootFoundation, bibleRootOriginalLanguage, bibleRootTranslationComparison, bibleRootCommentaryProvenance };
}

async function historyRows(client: PoolClient, table: string, idColumn: string) {
  if (!new Set(["imported_bundles", "context_records", "nodes", "assertions", "edges", "sources"]).has(table)) {
    throw new Error("Unsafe HistoryRoot fingerprint table.");
  }
  if (!new Set(["bundle_id", "context_id", "node_id", "assertion_id", "edge_id", "source_id"]).has(idColumn)) {
    throw new Error("Unsafe HistoryRoot fingerprint order column.");
  }
  return (await client.query(
    `SELECT * FROM ${table} WHERE domain = 'HistoryRoot' ORDER BY ${idColumn}`,
  )).rows;
}

export async function captureHistoryRootFingerprint(client: PoolClient): Promise<{
  sha256: string;
  counts: Record<string, number>;
}> {
  const tables = [
    ["imported_bundles", "bundle_id"],
    ["context_records", "context_id"],
    ["nodes", "node_id"],
    ["assertions", "assertion_id"],
    ["edges", "edge_id"],
    ["sources", "source_id"],
  ] as const;
  const material: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const [table, idColumn] of tables) {
    material[table] = await historyRows(client, table, idColumn);
    counts[table] = material[table]!.length;
  }
  return { sha256: sha256(JSON.stringify(material)), counts };
}

function operationResult(action: "imported" | "updated" | "skipped", records: number) {
  return {
    action,
    records: {
      imported: action === "imported" ? records : 0,
      updated: action === "updated" ? records : 0,
      skipped: action === "skipped" ? records : 0,
      failed: 0,
    },
  };
}

async function authorize(client: PoolClient): Promise<{
  authorization: LocalDevelopmentDatabaseAuthorization;
  target: LocalDevelopmentDatabaseTarget;
}> {
  return authorizeLocalDevelopmentDatabase(client);
}

export async function developmentRuntimeStatus() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const { target } = await authorize(client);
    return {
      command: "dev:status",
      target,
      readiness: await getDevelopmentRuntimeReadiness(),
    };
  } finally {
    client.release();
  }
}

export async function provisionDevelopmentRuntime() {
  const datasets = await validateDevelopmentDatasets();
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  let authorization: LocalDevelopmentDatabaseAuthorization;
  let target: LocalDevelopmentDatabaseTarget;
  let historyBefore: Awaited<ReturnType<typeof captureHistoryRootFingerprint>>;
  try {
    ({ authorization, target } = await authorize(client));
    historyBefore = await captureHistoryRootFingerprint(client);
  } finally {
    client.release();
  }

  const before = await getDevelopmentRuntimeReadiness();
  const dictionaryAction = before.roots.DictionaryRoot.ready
    ? "skipped"
    : (before.roots.DictionaryRoot.counts.datasets ?? 0) > 0 ? "updated" : "imported";
  if (dictionaryAction !== "skipped") {
    await saveDictionaryRootCoreLexicalCorpus(datasets.dictionaryRoot);
  }

  const foundationAction = before.roots.BibleRoot.foundationReady
    ? "skipped"
    : (before.roots.BibleRoot.counts.datasets ?? 0) > 0 ? "updated" : "imported";
  if (foundationAction !== "skipped") {
    await importBibleRootFoundation({
      dataset: datasets.bibleRootFoundation,
      developmentAuthorization: authorization,
    });
  }

  const originalAction = before.roots.BibleRoot.originalLanguageReady
    ? "skipped"
    : (before.roots.BibleRoot.counts.originalDatasets ?? 0) > 0 ? "updated" : "imported";
  if (originalAction !== "skipped") {
    await importBibleRootOriginalLanguageFoundation({
      dataset: datasets.bibleRootOriginalLanguage,
      developmentAuthorization: authorization,
    });
  }

  const comparisonAction = before.roots.BibleRoot.translationComparisonReady
    ? "skipped"
    : (before.roots.BibleRoot.counts.translationComparisonDatasets ?? 0) > 0 ? "updated" : "imported";
  if (comparisonAction !== "skipped") {
    await importBibleRootTranslationComparison({
      dataset: datasets.bibleRootTranslationComparison,
      developmentAuthorization: authorization,
    });
  }

  const commentaryAction = before.roots.BibleRoot.commentaryProvenanceReady
    ? "skipped"
    : (before.roots.BibleRoot.counts.commentaryDatasets ?? 0) > 0 ? "updated" : "imported";
  if (commentaryAction !== "skipped") {
    await importBibleRootCommentaryProvenance({
      dataset: datasets.bibleRootCommentaryProvenance,
      developmentAuthorization: authorization,
    });
  }

  const after = await getDevelopmentRuntimeReadiness();
  if (!after.roots.DictionaryRoot.ready || !after.roots.BibleRoot.ready || !after.roots.BibleRoot.translationComparisonReady || !after.roots.BibleRoot.commentaryProvenanceReady) {
    throw new Error("Development provisioning completed without achieving released-dataset readiness.");
  }
  const finalClient = await pool.connect();
  let historyAfter: Awaited<ReturnType<typeof captureHistoryRootFingerprint>>;
  try {
    historyAfter = await captureHistoryRootFingerprint(finalClient);
  } finally {
    finalClient.release();
  }
  if (historyBefore.sha256 !== historyAfter.sha256) {
    throw new Error("HistoryRoot data changed during local development provisioning.");
  }

  const dictionaryRecords = Object.values(datasets.dictionaryRoot)
    .filter(Array.isArray)
    .reduce((sum, value) => sum + value.length, 0);
  const foundationRecords = 1 + datasets.bibleRootFoundation.canon.books.length
    + datasets.bibleRootFoundation.verses.length
    + datasets.bibleRootFoundation.phrases.length
    + datasets.bibleRootFoundation.phrases.reduce((sum, phrase) => sum + phrase.occurrences.length, 0);
  const originalCounts = datasets.bibleRootOriginalLanguage.manifest.expectedCounts;
  const originalRecords = originalCounts.editions + originalCounts.sourceArtifacts
    + originalCounts.sourceVerses + originalCounts.tokens + originalCounts.lemmas
    + originalCounts.morphologies + originalCounts.mappings;
  const comparisonRecords = 345;
  const commentaryCounts = datasets.bibleRootCommentaryProvenance.manifest.expectedCounts;
  const commentaryRecords = 1 + (commentaryCounts.works * 5)
    + commentaryCounts.sections + commentaryCounts.anchors + commentaryCounts.statements;
  return {
    command: "dev:provision",
    target,
    sourceValidation: {
      dictionaryRoot: { datasetId: datasets.dictionaryRoot.dataset.datasetId, version: datasets.dictionaryRoot.dataset.version },
      bibleRootFoundation: { datasetId: datasets.bibleRootFoundation.manifest.datasetId, version: datasets.bibleRootFoundation.manifest.version },
      bibleRootOriginalLanguage: { datasetId: datasets.bibleRootOriginalLanguage.manifest.datasetId, version: datasets.bibleRootOriginalLanguage.manifest.version },
      bibleRootTranslationComparison: { datasetId: datasets.bibleRootTranslationComparison.manifest.datasetId, version: datasets.bibleRootTranslationComparison.manifest.version },
      bibleRootCommentaryProvenance: { datasetId: datasets.bibleRootCommentaryProvenance.manifest.datasetId, version: datasets.bibleRootCommentaryProvenance.manifest.version },
    },
    datasets: {
      DictionaryRoot: operationResult(dictionaryAction, dictionaryRecords),
      BibleRootFoundation: operationResult(foundationAction, foundationRecords),
      BibleRootOriginalLanguage: operationResult(originalAction, originalRecords),
      BibleRootTranslationComparison: operationResult(comparisonAction, comparisonRecords),
      BibleRootCommentaryProvenance: operationResult(commentaryAction, commentaryRecords),
    },
    historyRoot: {
      preserved: true,
      fingerprintSha256: historyAfter.sha256,
      counts: historyAfter.counts,
    },
    readiness: after,
  };
}

async function runCli(): Promise<void> {
  const command = process.argv[2];
  if (command !== "provision" && command !== "status") {
    throw new Error("Usage: development-runtime.ts <provision|status>");
  }
  const result = command === "provision"
    ? await provisionDevelopmentRuntime()
    : await developmentRuntimeStatus();
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }).finally(closeDatabase);
}
