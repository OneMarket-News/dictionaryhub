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

export interface DictionaryRootCoveragePartOfSpeech {
  partOfSpeech: string;
  senseCount: number;
  graphCoveredSenseCount: number;
  lexicalOnlySenseCount: number;
  sourceBackedSenseCount: number;
  unsupportedSenseCount: number;
  assertionBackedSenseCount: number;
  reviewedSenseCount: number;
  reviewRequiredSenseCount: number;
  conceptRevisionCoveredSenseCount: number;
  conceptRevisionGapSenseCount: number;
}

export interface DictionaryRootCoverageDashboard {
  available: boolean;
  datasetId: string | null;
  bundleId: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  sourceLicense: string | null;
  importedAt: string | null;
  updatedAt: string | null;
  synsetCount: number;
  lemmaCount: number;
  relationCount: number;
  graphCoveredSenseCount: number;
  lexicalOnlySenseCount: number;
  graphCoveragePercent: number;
  sourceBackedSenseCount: number;
  unsupportedSenseCount: number;
  sourceCoveragePercent: number;
  assertionBackedSenseCount: number;
  assertionGapSenseCount: number;
  reviewedSenseCount: number;
  reviewRequiredSenseCount: number;
  conceptRevisionCoveredSenseCount: number;
  conceptRevisionGapSenseCount: number;
  conceptRevisionCoveragePercent: number;
  datasetRevisionCount: number;
  partOfSpeech: DictionaryRootCoveragePartOfSpeech[];
}

export type DictionaryRootLemmaCoverageFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "partial"
  | "lexical-only";

export type DictionaryRootSourceCoverageFilter = "all" | "source-backed" | "unsupported";
export type DictionaryRootHistoryCoverageFilter = "all" | "with-history" | "no-history";
export type DictionaryRootReviewCoverageFilter = "all" | "reviewed" | "needs-review";
export type DictionaryRootLemmaCoverageSort = "gaps" | "coverage" | "senses" | "lemma";

export interface ListDictionaryRootLemmaCoverageOptions {
  page: number;
  limit: number;
  bundleId?: string | undefined;
  query?: string | undefined;
  partOfSpeech?: string | undefined;
  coverage: DictionaryRootLemmaCoverageFilter;
  source: DictionaryRootSourceCoverageFilter;
  history: DictionaryRootHistoryCoverageFilter;
  review: DictionaryRootReviewCoverageFilter;
  sort: DictionaryRootLemmaCoverageSort;
}

export interface DictionaryRootLemmaCoverageItem {
  lemma: string;
  exactSenseCount: number;
  graphSenseCount: number;
  lexicalOnlySenseCount: number;
  graphCoveragePercent: number;
  sourceBackedSenseCount: number;
  unsupportedSenseCount: number;
  assertionBackedSenseCount: number;
  reviewedSenseCount: number;
  reviewRequiredSenseCount: number;
  conceptRevisionSenseCount: number;
  conceptRevisionGapSenseCount: number;
  partOfSpeechCounts: Record<string, number>;
  representativeNodeId: string;
  lexicalOnlyNodeId: string | null;
  graphNodeId: string | null;
}

export interface ListDictionaryRootLemmaCoverageResult {
  available: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: DictionaryRootLemmaCoverageItem[];
  filters: {
    query: string;
    partOfSpeech: string;
    coverage: DictionaryRootLemmaCoverageFilter;
    source: DictionaryRootSourceCoverageFilter;
    history: DictionaryRootHistoryCoverageFilter;
    review: DictionaryRootReviewCoverageFilter;
    sort: DictionaryRootLemmaCoverageSort;
  };
}

interface DashboardAggregateRow {
  sense_count: string;
  graph_covered_sense_count: string;
  source_backed_sense_count: string;
  assertion_backed_sense_count: string;
  reviewed_sense_count: string;
  concept_revision_covered_sense_count: string;
}

interface DashboardPartOfSpeechRow extends DashboardAggregateRow {
  part_of_speech: string;
}

interface LemmaCoverageRow {
  lemma: string;
  exact_sense_count: string;
  graph_sense_count: string;
  source_backed_sense_count: string;
  assertion_backed_sense_count: string;
  reviewed_sense_count: string;
  concept_revision_sense_count: string;
  part_of_speech_counts: Record<string, number> | null;
  representative_node_id: string;
  lexical_only_node_id: string | null;
  graph_node_id: string | null;
  total_count: string;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyDashboard(status: DictionaryRootLexiconStatus): DictionaryRootCoverageDashboard {
  return {
    available: status.available,
    datasetId: status.datasetId,
    bundleId: status.bundleId,
    sourceId: status.sourceId,
    sourceName: status.sourceName,
    sourceVersion: status.sourceVersion,
    sourceLicense: status.sourceLicense,
    importedAt: status.importedAt,
    updatedAt: status.updatedAt,
    synsetCount: status.synsetCount,
    lemmaCount: status.lemmaCount,
    relationCount: status.relationCount,
    graphCoveredSenseCount: 0,
    lexicalOnlySenseCount: status.synsetCount,
    graphCoveragePercent: 0,
    sourceBackedSenseCount: 0,
    unsupportedSenseCount: status.synsetCount,
    sourceCoveragePercent: 0,
    assertionBackedSenseCount: 0,
    assertionGapSenseCount: 0,
    reviewedSenseCount: 0,
    reviewRequiredSenseCount: 0,
    conceptRevisionCoveredSenseCount: 0,
    conceptRevisionGapSenseCount: status.synsetCount,
    conceptRevisionCoveragePercent: 0,
    datasetRevisionCount: 0,
    partOfSpeech: [],
  };
}

function mapDashboardPartOfSpeech(row: DashboardPartOfSpeechRow): DictionaryRootCoveragePartOfSpeech {
  const senseCount = Number(row.sense_count);
  const graphCoveredSenseCount = Number(row.graph_covered_sense_count);
  const sourceBackedSenseCount = Number(row.source_backed_sense_count);
  const assertionBackedSenseCount = Number(row.assertion_backed_sense_count);
  const reviewedSenseCount = Number(row.reviewed_sense_count);
  const conceptRevisionCoveredSenseCount = Number(row.concept_revision_covered_sense_count);
  return {
    partOfSpeech: row.part_of_speech,
    senseCount,
    graphCoveredSenseCount,
    lexicalOnlySenseCount: Math.max(0, senseCount - graphCoveredSenseCount),
    sourceBackedSenseCount,
    unsupportedSenseCount: Math.max(0, senseCount - sourceBackedSenseCount),
    assertionBackedSenseCount,
    reviewedSenseCount,
    reviewRequiredSenseCount: Math.max(0, graphCoveredSenseCount - reviewedSenseCount),
    conceptRevisionCoveredSenseCount,
    conceptRevisionGapSenseCount: Math.max(0, senseCount - conceptRevisionCoveredSenseCount),
  };
}

export async function getDictionaryRootCoverageDashboard(
  bundleId?: string,
): Promise<DictionaryRootCoverageDashboard> {
  const status = await getDictionaryRootLexiconStatus(bundleId);
  if (!status.available) return emptyDashboard(status);

  const database = requireDatabase();
  const commonCte = `
    WITH sense_quality AS (
      SELECT
        l.node_id,
        l.part_of_speech,
        (n.node_id IS NOT NULL) AS graph_covered,
        (s.source_id IS NOT NULL) AS source_backed,
        EXISTS(
          SELECT 1 FROM assertions a WHERE a.node_id = l.node_id
        ) AS assertion_backed,
        (
          EXISTS(
            SELECT 1
            FROM assertions a
            WHERE a.node_id = l.node_id
              AND LOWER(COALESCE(a.review_status, '')) = 'reviewed'
          )
          OR EXISTS(
            SELECT 1
            FROM dictionaryroot_editorial_reviews er
            WHERE er.node_id = l.node_id
              AND er.review_status = 'approved'
          )
        ) AS reviewed,
        EXISTS(
          SELECT 1
          FROM revisions r
          WHERE r.object_type = 'node'
            AND r.object_id = l.node_id
        ) AS concept_revision_covered
      FROM dictionaryroot_lexicon_synsets l
      LEFT JOIN nodes n ON n.node_id = l.node_id
      LEFT JOIN sources s ON s.source_id = l.source_id
      WHERE ($1::TEXT IS NULL OR l.bundle_id = $1)
    )
  `;

  const [aggregateResult, partOfSpeechResult, datasetRevisionResult] = await Promise.all([
    database.query<DashboardAggregateRow>(
      `${commonCte}
       SELECT
         COUNT(*)::TEXT AS sense_count,
         COUNT(*) FILTER (WHERE graph_covered)::TEXT AS graph_covered_sense_count,
         COUNT(*) FILTER (WHERE source_backed)::TEXT AS source_backed_sense_count,
         COUNT(*) FILTER (WHERE assertion_backed)::TEXT AS assertion_backed_sense_count,
         COUNT(*) FILTER (WHERE reviewed)::TEXT AS reviewed_sense_count,
         COUNT(*) FILTER (WHERE concept_revision_covered)::TEXT AS concept_revision_covered_sense_count
       FROM sense_quality;`,
      [bundleId ?? null],
    ),
    database.query<DashboardPartOfSpeechRow>(
      `${commonCte}
       SELECT
         part_of_speech,
         COUNT(*)::TEXT AS sense_count,
         COUNT(*) FILTER (WHERE graph_covered)::TEXT AS graph_covered_sense_count,
         COUNT(*) FILTER (WHERE source_backed)::TEXT AS source_backed_sense_count,
         COUNT(*) FILTER (WHERE assertion_backed)::TEXT AS assertion_backed_sense_count,
         COUNT(*) FILTER (WHERE reviewed)::TEXT AS reviewed_sense_count,
         COUNT(*) FILTER (WHERE concept_revision_covered)::TEXT AS concept_revision_covered_sense_count
       FROM sense_quality
       GROUP BY part_of_speech
       ORDER BY CASE part_of_speech
         WHEN 'noun' THEN 0
         WHEN 'verb' THEN 1
         WHEN 'adjective' THEN 2
         WHEN 'adverb' THEN 3
         ELSE 4
       END, part_of_speech;`,
      [bundleId ?? null],
    ),
    database.query<{ count: string }>(
      `
        SELECT COUNT(*)::TEXT AS count
        FROM revisions
        WHERE object_type = 'import-bundle'
          AND ($1::TEXT IS NULL OR object_id = $1 OR bundle_id = $1);
      `,
      [bundleId ?? null],
    ),
  ]);

  const row = aggregateResult.rows[0];
  if (!row) return emptyDashboard(status);

  const senseCount = Number(row.sense_count);
  const graphCoveredSenseCount = Number(row.graph_covered_sense_count);
  const sourceBackedSenseCount = Number(row.source_backed_sense_count);
  const assertionBackedSenseCount = Number(row.assertion_backed_sense_count);
  const reviewedSenseCount = Number(row.reviewed_sense_count);
  const conceptRevisionCoveredSenseCount = Number(row.concept_revision_covered_sense_count);

  return {
    available: true,
    datasetId: status.datasetId,
    bundleId: status.bundleId,
    sourceId: status.sourceId,
    sourceName: status.sourceName,
    sourceVersion: status.sourceVersion,
    sourceLicense: status.sourceLicense,
    importedAt: status.importedAt,
    updatedAt: status.updatedAt,
    synsetCount: senseCount,
    lemmaCount: status.lemmaCount,
    relationCount: status.relationCount,
    graphCoveredSenseCount,
    lexicalOnlySenseCount: Math.max(0, senseCount - graphCoveredSenseCount),
    graphCoveragePercent: percentage(graphCoveredSenseCount, senseCount),
    sourceBackedSenseCount,
    unsupportedSenseCount: Math.max(0, senseCount - sourceBackedSenseCount),
    sourceCoveragePercent: percentage(sourceBackedSenseCount, senseCount),
    assertionBackedSenseCount,
    assertionGapSenseCount: Math.max(0, graphCoveredSenseCount - assertionBackedSenseCount),
    reviewedSenseCount,
    reviewRequiredSenseCount: Math.max(0, graphCoveredSenseCount - reviewedSenseCount),
    conceptRevisionCoveredSenseCount,
    conceptRevisionGapSenseCount: Math.max(0, senseCount - conceptRevisionCoveredSenseCount),
    conceptRevisionCoveragePercent: percentage(conceptRevisionCoveredSenseCount, senseCount),
    datasetRevisionCount: Number(datasetRevisionResult.rows[0]?.count ?? 0),
    partOfSpeech: partOfSpeechResult.rows.map(mapDashboardPartOfSpeech),
  };
}

function lemmaFilterClause(options: ListDictionaryRootLemmaCoverageOptions): string {
  const filters: string[] = [];
  if (options.coverage === "complete") filters.push("graph_sense_count = exact_sense_count");
  if (options.coverage === "incomplete") filters.push("graph_sense_count < exact_sense_count");
  if (options.coverage === "partial") filters.push("graph_sense_count > 0 AND graph_sense_count < exact_sense_count");
  if (options.coverage === "lexical-only") filters.push("graph_sense_count = 0");
  if (options.source === "source-backed") filters.push("source_backed_sense_count = exact_sense_count");
  if (options.source === "unsupported") filters.push("source_backed_sense_count < exact_sense_count");
  if (options.history === "with-history") filters.push("concept_revision_sense_count > 0");
  if (options.history === "no-history") filters.push("concept_revision_sense_count = 0");
  if (options.review === "reviewed") filters.push("graph_sense_count > 0 AND reviewed_sense_count = graph_sense_count");
  if (options.review === "needs-review") filters.push("graph_sense_count > reviewed_sense_count");
  return filters.length ? `WHERE ${filters.join(" AND ")}` : "";
}

function lemmaSortClause(sort: DictionaryRootLemmaCoverageSort): string {
  if (sort === "coverage") {
    return "graph_coverage_percent DESC, exact_sense_count DESC, lemma ASC";
  }
  if (sort === "senses") {
    return "exact_sense_count DESC, lexical_only_sense_count DESC, lemma ASC";
  }
  if (sort === "lemma") {
    return "lemma ASC";
  }
  return "lexical_only_sense_count DESC, exact_sense_count DESC, lemma ASC";
}

export async function listDictionaryRootLemmaCoverage(
  options: ListDictionaryRootLemmaCoverageOptions,
): Promise<ListDictionaryRootLemmaCoverageResult> {
  const status = await getDictionaryRootLexiconStatus(options.bundleId);
  const normalizedQuery = options.query ? normalizeDictionaryRootLemma(options.query) : "";
  if (!status.available) {
    return {
      available: false,
      page: options.page,
      limit: options.limit,
      total: 0,
      totalPages: 0,
      items: [],
      filters: {
        query: normalizedQuery,
        partOfSpeech: options.partOfSpeech || "all",
        coverage: options.coverage,
        source: options.source,
        history: options.history,
        review: options.review,
        sort: options.sort,
      },
    };
  }

  const database = requireDatabase();
  const values: Array<string | number | null> = [options.bundleId ?? null];
  const senseConditions = ["($1::TEXT IS NULL OR l.bundle_id = $1)"];

  if (normalizedQuery) {
    values.push(`%${normalizedQuery}%`);
    senseConditions.push(`lemma ILIKE $${values.length}`);
  }
  if (options.partOfSpeech && options.partOfSpeech !== "all") {
    values.push(options.partOfSpeech);
    senseConditions.push(`l.part_of_speech = $${values.length}`);
  }

  values.push(options.limit);
  const limitParameter = values.length;
  values.push((options.page - 1) * options.limit);
  const offsetParameter = values.length;
  const rollupFilter = lemmaFilterClause(options);
  const sortClause = lemmaSortClause(options.sort);

  const result = await database.query<LemmaCoverageRow>(
    `
      WITH graph_nodes AS (
        SELECT node_id FROM nodes WHERE ($1::TEXT IS NULL OR bundle_id = $1)
      ),
      registry_sources AS (
        SELECT source_id FROM sources WHERE ($1::TEXT IS NULL OR bundle_id = $1)
      ),
      assertion_nodes AS (
        SELECT DISTINCT node_id FROM assertions WHERE ($1::TEXT IS NULL OR bundle_id = $1)
      ),
      reviewed_nodes AS (
        SELECT DISTINCT node_id
        FROM assertions
        WHERE ($1::TEXT IS NULL OR bundle_id = $1)
          AND LOWER(COALESCE(review_status, '')) = 'reviewed'
        UNION
        SELECT DISTINCT node_id
        FROM dictionaryroot_editorial_reviews
        WHERE ($1::TEXT IS NULL OR bundle_id = $1)
          AND review_status = 'approved'
      ),
      revised_nodes AS (
        SELECT DISTINCT object_id AS node_id
        FROM revisions
        WHERE object_type = 'node'
          AND ($1::TEXT IS NULL OR bundle_id = $1)
      ),
      filtered_senses AS (
        SELECT
          lemma,
          l.node_id,
          l.part_of_speech,
          (g.node_id IS NOT NULL) AS graph_covered,
          (s.source_id IS NOT NULL) AS source_backed,
          (a.node_id IS NOT NULL) AS assertion_backed,
          (rv.node_id IS NOT NULL) AS reviewed,
          (r.node_id IS NOT NULL) AS concept_revision_covered
        FROM dictionaryroot_lexicon_synsets l
        CROSS JOIN LATERAL UNNEST(l.normalized_lemmas) AS lemma
        LEFT JOIN graph_nodes g ON g.node_id = l.node_id
        LEFT JOIN registry_sources s ON s.source_id = l.source_id
        LEFT JOIN assertion_nodes a ON a.node_id = l.node_id
        LEFT JOIN reviewed_nodes rv ON rv.node_id = l.node_id
        LEFT JOIN revised_nodes r ON r.node_id = l.node_id
        WHERE ${senseConditions.join(" AND ")}
      ),
      base_rollup AS (
        SELECT
          lemma,
          COUNT(DISTINCT node_id)::INTEGER AS exact_sense_count,
          COUNT(DISTINCT node_id) FILTER (WHERE graph_covered)::INTEGER AS graph_sense_count,
          COUNT(DISTINCT node_id) FILTER (WHERE source_backed)::INTEGER AS source_backed_sense_count,
          COUNT(DISTINCT node_id) FILTER (WHERE assertion_backed)::INTEGER AS assertion_backed_sense_count,
          COUNT(DISTINCT node_id) FILTER (WHERE reviewed)::INTEGER AS reviewed_sense_count,
          COUNT(DISTINCT node_id) FILTER (WHERE concept_revision_covered)::INTEGER AS concept_revision_sense_count,
          MIN(node_id) AS representative_node_id,
          MIN(node_id) FILTER (WHERE NOT graph_covered) AS lexical_only_node_id,
          MIN(node_id) FILTER (WHERE graph_covered) AS graph_node_id
        FROM filtered_senses
        GROUP BY lemma
      ),
      pos_counts AS (
        SELECT
          lemma,
          JSONB_OBJECT_AGG(part_of_speech, sense_count ORDER BY part_of_speech) AS part_of_speech_counts
        FROM (
          SELECT lemma, part_of_speech, COUNT(DISTINCT node_id)::INTEGER AS sense_count
          FROM filtered_senses
          GROUP BY lemma, part_of_speech
        ) counts
        GROUP BY lemma
      ),
      rollup AS (
        SELECT
          b.*,
          (b.exact_sense_count - b.graph_sense_count)::INTEGER AS lexical_only_sense_count,
          CASE WHEN b.exact_sense_count = 0 THEN 0
            ELSE ROUND((b.graph_sense_count::NUMERIC / b.exact_sense_count::NUMERIC) * 1000) / 10
          END AS graph_coverage_percent,
          p.part_of_speech_counts
        FROM base_rollup b
        INNER JOIN pos_counts p USING (lemma)
      ),
      filtered_rollup AS (
        SELECT * FROM rollup
        ${rollupFilter}
      )
      SELECT
        lemma,
        exact_sense_count::TEXT,
        graph_sense_count::TEXT,
        source_backed_sense_count::TEXT,
        assertion_backed_sense_count::TEXT,
        reviewed_sense_count::TEXT,
        concept_revision_sense_count::TEXT,
        part_of_speech_counts,
        representative_node_id,
        lexical_only_node_id,
        graph_node_id,
        COUNT(*) OVER()::TEXT AS total_count
      FROM filtered_rollup
      ORDER BY ${sortClause}
      LIMIT $${limitParameter}
      OFFSET $${offsetParameter};
    `,
    values,
  );

  const total = Number(result.rows[0]?.total_count ?? 0);
  const items = result.rows.map((row) => {
    const exactSenseCount = Number(row.exact_sense_count);
    const graphSenseCount = Number(row.graph_sense_count);
    const sourceBackedSenseCount = Number(row.source_backed_sense_count);
    const reviewedSenseCount = Number(row.reviewed_sense_count);
    const conceptRevisionSenseCount = Number(row.concept_revision_sense_count);
    return {
      lemma: row.lemma,
      exactSenseCount,
      graphSenseCount,
      lexicalOnlySenseCount: Math.max(0, exactSenseCount - graphSenseCount),
      graphCoveragePercent: percentage(graphSenseCount, exactSenseCount),
      sourceBackedSenseCount,
      unsupportedSenseCount: Math.max(0, exactSenseCount - sourceBackedSenseCount),
      assertionBackedSenseCount: Number(row.assertion_backed_sense_count),
      reviewedSenseCount,
      reviewRequiredSenseCount: Math.max(0, graphSenseCount - reviewedSenseCount),
      conceptRevisionSenseCount,
      conceptRevisionGapSenseCount: Math.max(0, exactSenseCount - conceptRevisionSenseCount),
      partOfSpeechCounts: row.part_of_speech_counts || {},
      representativeNodeId: row.representative_node_id,
      lexicalOnlyNodeId: row.lexical_only_node_id,
      graphNodeId: row.graph_node_id,
    };
  });

  return {
    available: true,
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items,
    filters: {
      query: normalizedQuery,
      partOfSpeech: options.partOfSpeech || "all",
      coverage: options.coverage,
      source: options.source,
      history: options.history,
      review: options.review,
      sort: options.sort,
    },
  };
}
