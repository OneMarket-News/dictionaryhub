import { getPool } from "../lib/database.js";
import {
  searchDictionaryRootExactSenses,
  type DictionaryRootLemmaCoverage,
} from "./lexical-store.js";

export type SearchResultType =
  | "node"
  | "assertion"
  | "edge"
  | "source"
  | "revision"
  | "context-entity"
  | "context-account"
  | "context-claim"
  | "context-interpretation"
  | "context-relationship";

export interface SearchOptions {
  query: string;
  page: number;
  limit: number;
  type?: SearchResultType;
  bundleId?: string;
  domain?: string;
}

export interface SearchResult {
  resultType: SearchResultType;
  id: string;
  bundleId: string;
  title: string;
  summary: string | null;
  domain: string | null;
  objectType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  nodeId?: string;
  sourceIds?: string[];
}

export interface SearchResponse {
  query: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  results: SearchResult[];
  coverage?: DictionaryRootLemmaCoverage;
  exactSensePolicy?: "complete-lemma" | "registry-only";
}

interface SearchRow {
  result_type: SearchResultType;
  id: string;
  bundle_id: string;
  title: string;
  summary: string | null;
  domain: string | null;
  object_type: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

function mapSearchRow(
  row: SearchRow,
): SearchResult {
  return {
    resultType: row.result_type,
    id: row.id,
    bundleId: row.bundle_id,
    title: row.title,
    summary: row.summary,
    domain: row.domain,
    objectType: row.object_type,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const searchRecordsCte = `
  WITH search_records AS (
    SELECT
      'node'::TEXT AS result_type,
      n.node_id AS id,
      n.bundle_id,
      n.title,
      n.summary,
      COALESCE(n.domain, ib.domain) AS domain,
      n.node_type AS object_type,
      COALESCE(n.metadata, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
          'nodeType', n.node_type,
          'status', n.status
        ) AS metadata,
      n.created_at,
      n.updated_at,
      CONCAT_WS(
        ' ',
        n.node_id,
        n.title,
        n.summary,
        n.node_type,
        n.domain,
        n.status,
        CASE
          WHEN JSONB_TYPEOF(n.metadata -> 'lemmas') = 'array'
            THEN n.metadata ->> 'lemmas'
          ELSE NULL
        END
      ) AS searchable_text
    FROM nodes n
    LEFT JOIN imported_bundles ib
      ON ib.bundle_id = n.bundle_id

    UNION ALL

    SELECT
      'assertion'::TEXT AS result_type,
      a.assertion_id AS id,
      a.bundle_id,
      COALESCE(
        NULLIF(a.label, ''),
        a.assertion_id
      ) AS title,
      COALESCE(a.summary, a.body) AS summary,
      COALESCE(a.domain, ib.domain) AS domain,
      a.assertion_type AS object_type,
      JSONB_BUILD_OBJECT(
        'nodeId', a.node_id,
        'assertionType', a.assertion_type,
        'confidence', a.confidence,
        'reviewStatus', a.review_status,
        'verificationStatus',
          a.verification_status,
        'supportLevel', a.support_level,
        'interpretationLevel',
          a.interpretation_level
      ) AS metadata,
      a.created_at,
      a.updated_at,
      CONCAT_WS(
        ' ',
        a.assertion_id,
        a.node_id,
        a.label,
        a.summary,
        a.body,
        a.assertion_type,
        a.domain,
        a.review_status,
        a.verification_status
      ) AS searchable_text
    FROM assertions a
    LEFT JOIN imported_bundles ib
      ON ib.bundle_id = a.bundle_id

    UNION ALL

    SELECT
      'edge'::TEXT AS result_type,
      e.edge_id AS id,
      e.bundle_id,
      COALESCE(
        NULLIF(e.label, ''),
        e.edge_id
      ) AS title,
      e.summary,
      COALESCE(e.domain, ib.domain) AS domain,
      e.relationship_type AS object_type,
      JSONB_BUILD_OBJECT(
        'fromNodeId', e.from_node_id,
        'toNodeId', e.to_node_id,
        'relationshipType',
          e.relationship_type,
        'reviewStatus', e.review_status,
        'verificationStatus',
          e.verification_status,
        'supportLevel', e.support_level,
        'relationshipStrength',
          e.relationship_strength,
        'interpretationLevel',
          e.interpretation_level
      ) AS metadata,
      e.created_at,
      e.updated_at,
      CONCAT_WS(
        ' ',
        e.edge_id,
        e.from_node_id,
        e.to_node_id,
        e.label,
        e.summary,
        e.relationship_type,
        e.domain,
        e.review_status,
        e.verification_status
      ) AS searchable_text
    FROM edges e
    LEFT JOIN imported_bundles ib
      ON ib.bundle_id = e.bundle_id

    UNION ALL

    SELECT
      'source'::TEXT AS result_type,
      s.source_id AS id,
      s.bundle_id,
      s.name AS title,
      s.notes AS summary,
      COALESCE(s.domain, ib.domain) AS domain,
      s.source_type AS object_type,
      JSONB_BUILD_OBJECT(
        'sourceType', s.source_type,
        'publisher', s.publisher,
        'qualityTier', s.quality_tier,
        'credibilityTier',
          s.credibility_tier,
        'reviewStatus', s.review_status,
        'verificationStatus',
          s.verification_status,
        'url', s.url
      ) AS metadata,
      s.created_at,
      s.updated_at,
      CONCAT_WS(
        ' ',
        s.source_id,
        s.name,
        s.source_type,
        s.domain,
        s.publisher,
        s.notes,
        s.url,
        s.review_status,
        s.verification_status
      ) AS searchable_text
    FROM sources s
    LEFT JOIN imported_bundles ib
      ON ib.bundle_id = s.bundle_id
    WHERE COALESCE(
      s.raw_data ->> 'governanceVisibility',
      'public'
    ) = 'public'

    UNION ALL

    SELECT
      'revision'::TEXT AS result_type,
      r.revision_id AS id,
      r.bundle_id,
      COALESCE(
        NULLIF(r.summary, ''),
        r.revision_id
      ) AS title,
      r.summary,
      ib.domain,
      r.object_type,
      JSONB_BUILD_OBJECT(
        'objectType', r.object_type,
        'objectId', r.object_id,
        'revisionType', r.revision_type,
        'status', r.status
      ) AS metadata,
      r.created_at,
      r.updated_at,
      CONCAT_WS(
        ' ',
        r.revision_id,
        r.object_type,
        r.object_id,
        r.revision_type,
        r.summary,
        r.status,
        ib.domain
      ) AS searchable_text
    FROM revisions r
    LEFT JOIN imported_bundles ib
      ON ib.bundle_id = r.bundle_id

    UNION ALL

    SELECT
      CASE cr.record_kind
        WHEN 'entity' THEN 'context-entity'
        WHEN 'account' THEN 'context-account'
        WHEN 'claim' THEN 'context-claim'
        WHEN 'interpretation' THEN 'context-interpretation'
        WHEN 'relationship' THEN 'context-relationship'
      END::TEXT AS result_type,
      cr.context_id AS id,
      cr.bundle_id,
      cr.label AS title,
      cr.summary,
      cr.domain,
      COALESCE(
        entity.entity_type,
        relationship.relationship_type,
        cr.record_kind
      ) AS object_type,
      cr.metadata
        || JSONB_BUILD_OBJECT(
          'recordKind', cr.record_kind,
          'status', cr.status,
          'entityType', entity.entity_type,
          'alternateNames',
            TO_JSONB(
              COALESCE(entity.alternate_names, ARRAY[]::TEXT[])
            ),
          'relationshipType', relationship.relationship_type,
          'fromId', relationship.from_context_id,
          'toId', relationship.to_context_id
        ) AS metadata,
      cr.created_at,
      cr.updated_at,
      CONCAT_WS(
        ' ',
        cr.context_id,
        cr.label,
        cr.summary,
        cr.domain,
        cr.status,
        entity.entity_type,
        entity.canonical_name,
        entity.description,
        account.content,
        claim.statement,
        interpretation.interpretation_text,
        relationship.relationship_type,
        relationship.explanation,
        cr.raw_data::TEXT
      ) AS searchable_text
    FROM context_records cr
    LEFT JOIN context_entities entity
      ON entity.context_id = cr.context_id
    LEFT JOIN context_accounts account
      ON account.context_id = cr.context_id
    LEFT JOIN context_claims claim
      ON claim.context_id = cr.context_id
    LEFT JOIN context_interpretations interpretation
      ON interpretation.context_id = cr.context_id
    LEFT JOIN context_relationships relationship
      ON relationship.context_id = cr.context_id
    WHERE cr.record_kind IN (
      'entity',
      'account',
      'claim',
      'interpretation',
      'relationship'
    )
      AND cr.status <> 'governance-withdrawn'
  )
`;

async function searchRegistryKnowledge(
  options: SearchOptions,
): Promise<SearchResponse> {
  const database = requireDatabase();

  const offset =
    (options.page - 1) * options.limit;

  const searchPattern = `%${options.query}%`;
  const prefixPattern = `${options.query}%`;

  const parameters = [
    searchPattern,
    options.type ?? null,
    options.bundleId ?? null,
    options.domain ?? null,
  ];

  const [countResult, searchResult] =
    await Promise.all([
      database.query<{ count: string }>(
        `
          ${searchRecordsCte}
          SELECT COUNT(*) AS count
          FROM search_records
          WHERE searchable_text ILIKE $1
            AND (
              $2::TEXT IS NULL
              OR result_type = $2
            )
            AND (
              $3::TEXT IS NULL
              OR bundle_id = $3
            )
            AND (
              $4::TEXT IS NULL
              OR domain = $4
            );
        `,
        parameters,
      ),
      database.query<SearchRow>(
        `
          ${searchRecordsCte}
          SELECT
            result_type,
            id,
            bundle_id,
            title,
            summary,
            domain,
            object_type,
            metadata,
            created_at,
            updated_at
          FROM search_records
          WHERE searchable_text ILIKE $1
            AND (
              $2::TEXT IS NULL
              OR result_type = $2
            )
            AND (
              $3::TEXT IS NULL
              OR bundle_id = $3
            )
            AND (
              $4::TEXT IS NULL
              OR domain = $4
            )
          ORDER BY
            CASE
              WHEN LOWER(title) = LOWER($5)
                THEN 0
              WHEN result_type = 'node'
                AND EXISTS (
                  SELECT 1
                  FROM JSONB_ARRAY_ELEMENTS_TEXT(
                    CASE
                      WHEN JSONB_TYPEOF(metadata -> 'lemmas') = 'array'
                        THEN metadata -> 'lemmas'
                      ELSE '[]'::JSONB
                    END
                  ) AS lemma(value)
                  WHERE LOWER(lemma.value) = LOWER($5)
                )
                THEN 1
              WHEN result_type = 'context-entity'
                AND EXISTS (
                  SELECT 1
                  FROM JSONB_ARRAY_ELEMENTS_TEXT(
                    CASE
                      WHEN JSONB_TYPEOF(metadata -> 'alternateNames') = 'array'
                        THEN metadata -> 'alternateNames'
                      ELSE '[]'::JSONB
                    END
                  ) AS alternate_name(value)
                  WHERE LOWER(alternate_name.value) = LOWER($5)
                )
                THEN 1
              WHEN title ILIKE $6
                THEN 2
              WHEN result_type = 'node'
                AND EXISTS (
                  SELECT 1
                  FROM JSONB_ARRAY_ELEMENTS_TEXT(
                    CASE
                      WHEN JSONB_TYPEOF(metadata -> 'lemmas') = 'array'
                        THEN metadata -> 'lemmas'
                      ELSE '[]'::JSONB
                    END
                  ) AS lemma(value)
                  WHERE lemma.value ILIKE $6
                )
                THEN 3
              WHEN result_type = 'context-entity'
                AND EXISTS (
                  SELECT 1
                  FROM JSONB_ARRAY_ELEMENTS_TEXT(
                    CASE
                      WHEN JSONB_TYPEOF(metadata -> 'alternateNames') = 'array'
                        THEN metadata -> 'alternateNames'
                      ELSE '[]'::JSONB
                    END
                  ) AS alternate_name(value)
                  WHERE alternate_name.value ILIKE $6
                )
                THEN 3
              ELSE 4
            END,
            title ASC,
            result_type ASC,
            id ASC
          LIMIT $7
          OFFSET $8;
        `,
        [
          ...parameters,
          options.query,
          prefixPattern,
          options.limit,
          offset,
        ],
      ),
    ]);

  const total = Number(
    countResult.rows[0]?.count ?? 0,
  );

  return {
    query: options.query,
    page: options.page,
    limit: options.limit,
    total,
    totalPages:
      total === 0
        ? 0
        : Math.ceil(
            total / options.limit,
          ),
    results:
      searchResult.rows.map(mapSearchRow),
  };
}

function isDictionaryRootNodeSearch(options: SearchOptions): boolean {
  const nodeCompatible = options.type === undefined || options.type === "node";
  const dictionaryRootDomain = options.domain === undefined
    || options.domain.toLowerCase() === "dictionaryroot";
  return nodeCompatible && dictionaryRootDomain;
}

export async function searchKnowledge(
  options: SearchOptions,
): Promise<SearchResponse> {
  if (!isDictionaryRootNodeSearch(options)) {
    return searchRegistryKnowledge(options);
  }

  const [lexical, registry] = await Promise.all([
    searchDictionaryRootExactSenses(options.query, options.bundleId),
    searchRegistryKnowledge({
      ...options,
      page: options.page === 1 ? 1 : options.page,
      limit: options.page === 1 ? Math.max(options.limit, 100) : options.limit,
    }),
  ]);

  if (!lexical.coverage.available || options.page !== 1) {
    return {
      ...registry,
      coverage: lexical.coverage,
      exactSensePolicy: lexical.coverage.available ? "complete-lemma" : "registry-only",
    };
  }

  const exactIds = new Set(lexical.items.map((item) => item.id));
  const related = registry.results.filter((item) => !exactIds.has(item.id));
  const relatedSlots = Math.max(0, options.limit - lexical.items.length);
  const results: SearchResult[] = [
    ...lexical.items,
    ...related.slice(0, relatedSlots),
  ];
  const effectiveLimit = Math.max(options.limit, lexical.items.length);
  const total = registry.total + lexical.coverage.lexicalOnlySenseCount;

  return {
    query: options.query,
    page: 1,
    limit: effectiveLimit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / effectiveLimit),
    results,
    coverage: lexical.coverage,
    exactSensePolicy: "complete-lemma",
  };
}
