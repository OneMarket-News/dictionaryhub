import { getPool } from "../lib/database.js";
import type { NormalizedAssertion } from "./assertion-store.js";
import type { NodeEdgesResult, NormalizedEdge } from "./edge-store.js";
import type { NormalizedNode } from "./node-store.js";

const DOMAIN = "DictionaryRoot";
const DEFAULT_SOURCE_ID = "source-oewn-2025";
const UNDEFINED_TABLE = "42P01";

type UnknownRecord = Record<string, unknown>;

interface DatabaseError extends Error {
  code?: string;
}

interface LexicalSynsetRow {
  node_id: string;
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  source_version: string;
  source_synset_key: string;
  source_offset: string;
  part_of_speech: string;
  title: string;
  definition: string;
  synset_type: string;
  lexicographer_file_number: number;
  lemmas: string[];
  normalized_lemmas: string[];
  examples: string[];
  original_gloss: string;
  graph_coverage: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LexicalRelationRow {
  relation_id: string;
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  from_node_id: string;
  to_node_id: string;
  relationship_type: string;
  label: string;
  relationship_strength: string;
  summary: string;
  pointer_symbol: string;
  source_target: string;
  created_at: Date;
  updated_at: Date;
}

interface LexiconDatasetRow {
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  source_name: string;
  source_version: string;
  source_license: string;
  synset_count: number;
  lemma_count: number;
  relation_count: number;
  part_of_speech_counts: Record<string, number>;
  imported_at: Date;
  updated_at: Date;
}

interface CoverageCountRow {
  part_of_speech: string;
  exact_sense_count: string;
  graph_sense_count: string;
}

export interface DictionaryRootLexiconStatus {
  available: boolean;
  datasetId: string | null;
  bundleId: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  sourceLicense: string | null;
  synsetCount: number;
  lemmaCount: number;
  relationCount: number;
  partOfSpeechCounts: Record<string, number>;
  importedAt: string | null;
  updatedAt: string | null;
}

export interface DictionaryRootLemmaCoverage {
  available: boolean;
  query: string;
  normalizedLemma: string;
  exactSenseCount: number;
  graphSenseCount: number;
  lexicalOnlySenseCount: number;
  partOfSpeechCounts: Record<string, number>;
  graphPartOfSpeechCounts: Record<string, number>;
  complete: boolean;
  datasetId: string | null;
  sourceVersion: string | null;
}

export interface LexicalSearchNode {
  resultType: "node";
  id: string;
  nodeId: string;
  bundleId: string;
  title: string;
  summary: string;
  domain: string;
  objectType: string;
  metadata: Record<string, unknown>;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

function requireDatabase() {
  const database = getPool();
  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return database;
}

function isUndefinedTable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as DatabaseError).code === UNDEFINED_TABLE);
}

export function normalizeDictionaryRootLemma(value: string): string {
  return value
    .trim()
    .replace(/_/gu, " ")
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

function preferredExactLemma(row: LexicalSynsetRow, query: string): string {
  const normalized = normalizeDictionaryRootLemma(query);
  const index = row.normalized_lemmas.findIndex((lemma) => lemma === normalized);
  return index >= 0 ? row.lemmas[index] ?? row.title : row.title;
}

function lexicalMetadata(row: LexicalSynsetRow, exactLemma?: string): Record<string, unknown> {
  return {
    source: "Open English WordNet",
    sourceVersion: row.source_version,
    sourceSynsetKey: row.source_synset_key,
    sourceOffset: row.source_offset,
    partOfSpeech: row.part_of_speech,
    synsetType: row.synset_type,
    lexicographerFileNumber: row.lexicographer_file_number,
    lemmas: row.lemmas,
    examples: row.examples,
    originalGloss: row.original_gloss,
    exactLemma: exactLemma || null,
    lexicalCoverage: "complete-lemma",
    graphCoverage: row.graph_coverage,
    datasetId: row.dataset_id,
  };
}

function mapLexicalNode(row: LexicalSynsetRow): NormalizedNode {
  return {
    nodeId: row.node_id,
    bundleId: row.bundle_id,
    title: row.title,
    nodeType: "lexical-concept",
    domain: DOMAIN,
    summary: row.definition,
    status: row.graph_coverage ? "source-backed" : "lexicon-only",
    metadata: lexicalMetadata(row),
    sourceIds: [row.source_id || DEFAULT_SOURCE_ID],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapLexicalSearchNode(row: LexicalSynsetRow, query: string): LexicalSearchNode {
  const label = preferredExactLemma(row, query);
  return {
    resultType: "node",
    id: row.node_id,
    nodeId: row.node_id,
    bundleId: row.bundle_id,
    title: label,
    summary: row.definition,
    domain: DOMAIN,
    objectType: "lexical-concept",
    metadata: lexicalMetadata(row, label),
    sourceIds: [row.source_id || DEFAULT_SOURCE_ID],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function emptyStatus(): DictionaryRootLexiconStatus {
  return {
    available: false,
    datasetId: null,
    bundleId: null,
    sourceId: null,
    sourceName: null,
    sourceVersion: null,
    sourceLicense: null,
    synsetCount: 0,
    lemmaCount: 0,
    relationCount: 0,
    partOfSpeechCounts: {},
    importedAt: null,
    updatedAt: null,
  };
}

export async function getDictionaryRootLexiconStatus(
  bundleId?: string,
): Promise<DictionaryRootLexiconStatus> {
  const database = requireDatabase();
  try {
    const result = await database.query<LexiconDatasetRow>(
      `
        SELECT
          dataset_id,
          bundle_id,
          source_id,
          source_name,
          source_version,
          source_license,
          synset_count,
          lemma_count,
          relation_count,
          part_of_speech_counts,
          imported_at,
          updated_at
        FROM dictionaryroot_lexicon_datasets
        WHERE ($1::TEXT IS NULL OR bundle_id = $1)
        ORDER BY updated_at DESC
        LIMIT 1;
      `,
      [bundleId ?? null],
    );
    const row = result.rows[0];
    if (!row) return emptyStatus();
    return {
      available: true,
      datasetId: row.dataset_id,
      bundleId: row.bundle_id,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceVersion: row.source_version,
      sourceLicense: row.source_license,
      synsetCount: Number(row.synset_count),
      lemmaCount: Number(row.lemma_count),
      relationCount: Number(row.relation_count),
      partOfSpeechCounts: row.part_of_speech_counts || {},
      importedAt: row.imported_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  } catch (error) {
    if (isUndefinedTable(error)) return emptyStatus();
    throw error;
  }
}

export async function getDictionaryRootLemmaCoverage(
  query: string,
  bundleId?: string,
): Promise<DictionaryRootLemmaCoverage> {
  const normalizedLemma = normalizeDictionaryRootLemma(query);
  const status = await getDictionaryRootLexiconStatus(bundleId);
  if (!status.available || !normalizedLemma) {
    return {
      available: status.available,
      query,
      normalizedLemma,
      exactSenseCount: 0,
      graphSenseCount: 0,
      lexicalOnlySenseCount: 0,
      partOfSpeechCounts: {},
      graphPartOfSpeechCounts: {},
      complete: false,
      datasetId: status.datasetId,
      sourceVersion: status.sourceVersion,
    };
  }

  const database = requireDatabase();
  const result = await database.query<CoverageCountRow>(
    `
      SELECT
        l.part_of_speech,
        COUNT(*)::TEXT AS exact_sense_count,
        COUNT(n.node_id)::TEXT AS graph_sense_count
      FROM dictionaryroot_lexicon_synsets l
      LEFT JOIN nodes n ON n.node_id = l.node_id
      WHERE l.normalized_lemmas @> ARRAY[$1::TEXT]
        AND ($2::TEXT IS NULL OR l.bundle_id = $2)
      GROUP BY l.part_of_speech
      ORDER BY l.part_of_speech;
    `,
    [normalizedLemma, bundleId ?? null],
  );

  const partOfSpeechCounts: Record<string, number> = {};
  const graphPartOfSpeechCounts: Record<string, number> = {};
  let exactSenseCount = 0;
  let graphSenseCount = 0;
  for (const row of result.rows) {
    const exact = Number(row.exact_sense_count);
    const graph = Number(row.graph_sense_count);
    partOfSpeechCounts[row.part_of_speech] = exact;
    graphPartOfSpeechCounts[row.part_of_speech] = graph;
    exactSenseCount += exact;
    graphSenseCount += graph;
  }

  return {
    available: true,
    query,
    normalizedLemma,
    exactSenseCount,
    graphSenseCount,
    lexicalOnlySenseCount: Math.max(0, exactSenseCount - graphSenseCount),
    partOfSpeechCounts,
    graphPartOfSpeechCounts,
    complete: true,
    datasetId: status.datasetId,
    sourceVersion: status.sourceVersion,
  };
}

export async function searchDictionaryRootExactSenses(
  query: string,
  bundleId?: string,
): Promise<{ items: LexicalSearchNode[]; coverage: DictionaryRootLemmaCoverage }> {
  const normalizedLemma = normalizeDictionaryRootLemma(query);
  const coverage = await getDictionaryRootLemmaCoverage(query, bundleId);
  if (!coverage.available || !normalizedLemma) return { items: [], coverage };

  const database = requireDatabase();
  const result = await database.query<LexicalSynsetRow>(
    `
      SELECT
        l.node_id,
        l.dataset_id,
        l.bundle_id,
        l.source_id,
        l.source_version,
        l.source_synset_key,
        l.source_offset,
        l.part_of_speech,
        l.title,
        l.definition,
        l.synset_type,
        l.lexicographer_file_number,
        l.lemmas,
        l.normalized_lemmas,
        l.examples,
        l.original_gloss,
        EXISTS(SELECT 1 FROM nodes n WHERE n.node_id = l.node_id) AS graph_coverage,
        l.created_at,
        l.updated_at
      FROM dictionaryroot_lexicon_synsets l
      WHERE l.normalized_lemmas @> ARRAY[$1::TEXT]
        AND ($2::TEXT IS NULL OR l.bundle_id = $2)
      ORDER BY
        CASE l.part_of_speech
          WHEN 'noun' THEN 0
          WHEN 'verb' THEN 1
          WHEN 'adjective' THEN 2
          WHEN 'adverb' THEN 3
          ELSE 4
        END,
        l.title,
        l.node_id;
    `,
    [normalizedLemma, bundleId ?? null],
  );

  return {
    items: result.rows.map((row) => mapLexicalSearchNode(row, query)),
    coverage,
  };
}

export async function getDictionaryRootLexicalNodeById(
  nodeId: string,
): Promise<NormalizedNode | undefined> {
  const database = requireDatabase();
  try {
    const result = await database.query<LexicalSynsetRow>(
      `
        SELECT
          l.node_id,
          l.dataset_id,
          l.bundle_id,
          l.source_id,
          l.source_version,
          l.source_synset_key,
          l.source_offset,
          l.part_of_speech,
          l.title,
          l.definition,
          l.synset_type,
          l.lexicographer_file_number,
          l.lemmas,
          l.normalized_lemmas,
          l.examples,
          l.original_gloss,
          EXISTS(SELECT 1 FROM nodes n WHERE n.node_id = l.node_id) AS graph_coverage,
          l.created_at,
          l.updated_at
        FROM dictionaryroot_lexicon_synsets l
        WHERE l.node_id = $1;
      `,
      [nodeId],
    );
    const row = result.rows[0];
    return row ? mapLexicalNode(row) : undefined;
  } catch (error) {
    if (isUndefinedTable(error)) return undefined;
    throw error;
  }
}

export async function getDictionaryRootLexicalAssertionsByNodeId(
  nodeId: string,
): Promise<NormalizedAssertion[]> {
  const node = await getDictionaryRootLexicalNodeById(nodeId);
  if (!node) return [];
  const metadata = node.metadata as UnknownRecord;
  const now = node.updatedAt;
  const identity = nodeId.replace(/^dictionaryroot-oewn-2025-/u, "").replace(/-/gu, "-");
  const sourceIds = node.sourceIds.length ? node.sourceIds : [DEFAULT_SOURCE_ID];
  const assertions: NormalizedAssertion[] = [
    {
      assertionId: `dictionaryroot-lexicon-definition-${identity}`,
      bundleId: node.bundleId,
      nodeId,
      assertionType: "definition",
      label: "Definition",
      summary: node.summary,
      body: node.summary,
      domain: DOMAIN,
      credibilityTier: "high",
      confidence: "strong",
      verificationStatus: "official-documentation",
      reviewStatus: "reviewed",
      supportLevel: "direct",
      interpretationLevel: "none",
      sourceIds,
      createdAt: node.createdAt,
      updatedAt: now,
    },
  ];

  const examples = Array.isArray(metadata.examples)
    ? metadata.examples.map((value) => String(value)).filter(Boolean)
    : [];
  if (examples.length) {
    assertions.push({
      assertionId: `dictionaryroot-lexicon-usage-${identity}`,
      bundleId: node.bundleId,
      nodeId,
      assertionType: "usage-example",
      label: "Usage Examples",
      summary: examples.join(" | "),
      body: examples.join("\n"),
      domain: DOMAIN,
      credibilityTier: "high",
      confidence: "strong",
      verificationStatus: "official-documentation",
      reviewStatus: "reviewed",
      supportLevel: "direct",
      interpretationLevel: "none",
      sourceIds,
      createdAt: node.createdAt,
      updatedAt: now,
    });
  }
  return assertions;
}

function mapLexicalEdge(row: LexicalRelationRow): NormalizedEdge {
  return {
    edgeId: row.relation_id,
    bundleId: row.bundle_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    relationshipType: row.relationship_type,
    label: row.label,
    summary: row.summary,
    domain: DOMAIN,
    credibilityTier: "high",
    confidence: "strong",
    verificationStatus: "official-documentation",
    reviewStatus: "reviewed",
    supportLevel: "direct",
    relationshipStrength: row.relationship_strength,
    interpretationLevel: "none",
    sourceIds: [row.source_id || DEFAULT_SOURCE_ID],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getDictionaryRootLexicalEdgesByNodeId(
  nodeId: string,
): Promise<NodeEdgesResult> {
  const database = requireDatabase();
  try {
    const result = await database.query<LexicalRelationRow>(
      `
        SELECT
          relation_id,
          dataset_id,
          bundle_id,
          source_id,
          from_node_id,
          to_node_id,
          relationship_type,
          label,
          relationship_strength,
          summary,
          pointer_symbol,
          source_target,
          created_at,
          updated_at
        FROM dictionaryroot_lexicon_relations
        WHERE from_node_id = $1 OR to_node_id = $1
        ORDER BY relation_id;
      `,
      [nodeId],
    );
    const edges = result.rows.map(mapLexicalEdge);
    return {
      incoming: edges.filter((edge) => edge.toNodeId === nodeId),
      outgoing: edges.filter((edge) => edge.fromNodeId === nodeId),
    };
  } catch (error) {
    if (isUndefinedTable(error)) return { incoming: [], outgoing: [] };
    throw error;
  }
}
