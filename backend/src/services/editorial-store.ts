import { randomUUID } from "node:crypto";

import { getPool } from "../lib/database.js";
import { actorSnapshot, type DictionaryRootAuthContext } from "./identity-store.js";

export type DictionaryRootEditorialStatus =
  | "unreviewed"
  | "in_review"
  | "approved"
  | "flagged"
  | "rejected";

export type DictionaryRootEditorialCategory =
  | "all"
  | "lexical-only"
  | "missing-history"
  | "needs-review"
  | "promotion-candidates"
  | "source-issues";

export type DictionaryRootEditorialSort = "priority" | "updated" | "lemma";

export interface DictionaryRootEditorialSummary {
  available: boolean;
  totalMeanings: number;
  lexicalOnlyMeanings: number;
  graphMeanings: number;
  unreviewed: number;
  inReview: number;
  approved: number;
  flagged: number;
  rejected: number;
  promotionCandidates: number;
  promoted: number;
  missingHistory: number;
  sourceIssues: number;
}

export interface DictionaryRootEditorialQueueItem {
  nodeId: string;
  datasetId: string;
  bundleId: string;
  sourceId: string;
  title: string;
  definition: string;
  partOfSpeech: string;
  lemmas: string[];
  graphCovered: boolean;
  sourceBacked: boolean;
  assertionBacked: boolean;
  conceptHistory: boolean;
  reviewStatus: DictionaryRootEditorialStatus;
  reviewerName: string;
  actorId: string;
  actorType: string;
  verificationLevel: string;
  delegatedByActorId: string;
  delegatedByDisplayName: string;
  notes: string;
  annotation: string;
  promotionRecommendation: boolean;
  promotedAt: string | null;
  reviewUpdatedAt: string | null;
  priorityScore: number;
}

export interface DictionaryRootEditorialQueueResult {
  available: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: DictionaryRootEditorialQueueItem[];
  filters: {
    query: string;
    status: DictionaryRootEditorialStatus | "all";
    category: DictionaryRootEditorialCategory;
    partOfSpeech: string;
    sort: DictionaryRootEditorialSort;
  };
}

export interface DictionaryRootEditorialEvent {
  eventId: string;
  reviewId: string;
  nodeId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reviewerName: string;
  actorId: string;
  actorType: string;
  verificationLevel: string;
  delegatedByActorId: string;
  delegatedByDisplayName: string;
  note: string;
  rawData: Record<string, unknown>;
  createdAt: string;
}

export interface DictionaryRootEditorialDetail {
  item: DictionaryRootEditorialQueueItem;
  events: DictionaryRootEditorialEvent[];
}

export interface SaveDictionaryRootEditorialReviewInput {
  status: DictionaryRootEditorialStatus;
  reviewerName?: string;
  notes: string;
  annotation: string;
  promotionRecommendation: boolean;
}

interface SummaryRow {
  total_meanings: string;
  lexical_only_meanings: string;
  graph_meanings: string;
  unreviewed: string;
  in_review: string;
  approved: string;
  flagged: string;
  rejected: string;
  promotion_candidates: string;
  promoted: string;
  missing_history: string;
  source_issues: string;
}

interface QueueRow {
  node_id: string;
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  title: string;
  definition: string;
  part_of_speech: string;
  lemmas: string[];
  graph_covered: boolean;
  source_backed: boolean;
  assertion_backed: boolean;
  concept_history: boolean;
  review_status: DictionaryRootEditorialStatus;
  reviewer_name: string | null;
  actor_id: string | null;
  actor_type: string | null;
  verification_level: string | null;
  delegated_by_actor_id: string | null;
  delegated_by_display_name: string | null;
  notes: string | null;
  annotation: string | null;
  promotion_recommendation: boolean;
  promoted_at: Date | null;
  review_updated_at: Date | null;
  priority_score: number;
  total_count?: string;
}

interface EventRow {
  event_id: string;
  review_id: string;
  node_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reviewer_name: string | null;
  actor_id: string | null;
  actor_type: string | null;
  verification_level: string | null;
  delegated_by_actor_id: string | null;
  delegated_by_display_name: string | null;
  note: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: Date;
}

function requireDatabase() {
  const database = getPool();
  if (!database) throw new Error("DATABASE_URL is not configured.");
  return database;
}

function mapQueueRow(row: QueueRow): DictionaryRootEditorialQueueItem {
  return {
    nodeId: row.node_id,
    datasetId: row.dataset_id,
    bundleId: row.bundle_id,
    sourceId: row.source_id,
    title: row.title,
    definition: row.definition,
    partOfSpeech: row.part_of_speech,
    lemmas: row.lemmas || [],
    graphCovered: Boolean(row.graph_covered),
    sourceBacked: Boolean(row.source_backed),
    assertionBacked: Boolean(row.assertion_backed),
    conceptHistory: Boolean(row.concept_history),
    reviewStatus: row.review_status || "unreviewed",
    reviewerName: row.reviewer_name || "",
    actorId: row.actor_id || "",
    actorType: row.actor_type || "",
    verificationLevel: row.verification_level || "",
    delegatedByActorId: row.delegated_by_actor_id || "",
    delegatedByDisplayName: row.delegated_by_display_name || "",
    notes: row.notes || "",
    annotation: row.annotation || "",
    promotionRecommendation: Boolean(row.promotion_recommendation),
    promotedAt: row.promoted_at ? row.promoted_at.toISOString() : null,
    reviewUpdatedAt: row.review_updated_at ? row.review_updated_at.toISOString() : null,
    priorityScore: Number(row.priority_score || 0),
  };
}

function mapEventRow(row: EventRow): DictionaryRootEditorialEvent {
  return {
    eventId: row.event_id,
    reviewId: row.review_id,
    nodeId: row.node_id,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reviewerName: row.reviewer_name || "",
    actorId: row.actor_id || "",
    actorType: row.actor_type || "",
    verificationLevel: row.verification_level || "",
    delegatedByActorId: row.delegated_by_actor_id || "",
    delegatedByDisplayName: row.delegated_by_display_name || "",
    note: row.note || "",
    rawData: row.raw_data || {},
    createdAt: row.created_at.toISOString(),
  };
}

const baseQueueSql = `
  SELECT
    l.node_id,
    l.dataset_id,
    l.bundle_id,
    l.source_id,
    l.title,
    l.definition,
    l.part_of_speech,
    l.lemmas,
    (n.node_id IS NOT NULL) AS graph_covered,
    (s.source_id IS NOT NULL) AS source_backed,
    EXISTS(SELECT 1 FROM assertions a WHERE a.node_id = l.node_id) AS assertion_backed,
    EXISTS(SELECT 1 FROM revisions rv WHERE rv.object_type = 'node' AND rv.object_id = l.node_id) AS concept_history,
    COALESCE(er.review_status, 'unreviewed') AS review_status,
    COALESCE(review_actor.display_name, er.reviewer_name) AS reviewer_name,
    er.actor_id,
    review_actor.actor_type,
    review_actor.verification_level,
    er.delegated_by_actor_id,
    delegator.display_name AS delegated_by_display_name,
    er.notes,
    er.annotation,
    COALESCE(er.promotion_recommendation, FALSE) AS promotion_recommendation,
    er.promoted_at,
    er.updated_at AS review_updated_at,
    (
      CASE WHEN n.node_id IS NULL THEN 40 ELSE 0 END
      + CASE WHEN NOT EXISTS(SELECT 1 FROM revisions rv2 WHERE rv2.object_type = 'node' AND rv2.object_id = l.node_id) THEN 15 ELSE 0 END
      + CASE WHEN s.source_id IS NULL THEN 30 ELSE 0 END
      + CASE WHEN COALESCE(er.review_status, 'unreviewed') = 'flagged' THEN 35 ELSE 0 END
      + CASE WHEN COALESCE(er.review_status, 'unreviewed') = 'in_review' THEN 12 ELSE 0 END
      + CASE WHEN COALESCE(er.review_status, 'unreviewed') = 'approved' AND n.node_id IS NULL THEN 25 ELSE 0 END
      + CASE WHEN COALESCE(er.promotion_recommendation, FALSE) AND n.node_id IS NULL THEN 20 ELSE 0 END
    )::INTEGER AS priority_score
  FROM dictionaryroot_lexicon_synsets l
  LEFT JOIN nodes n ON n.node_id = l.node_id
  LEFT JOIN sources s ON s.source_id = l.source_id
  LEFT JOIN dictionaryroot_editorial_reviews er ON er.node_id = l.node_id
  LEFT JOIN dictionaryroot_actors review_actor ON review_actor.actor_id = er.actor_id
  LEFT JOIN dictionaryroot_actors delegator ON delegator.actor_id = er.delegated_by_actor_id
`;

export async function getDictionaryRootEditorialSummary(
  bundleId?: string,
): Promise<DictionaryRootEditorialSummary> {
  const database = requireDatabase();
  const result = await database.query<SummaryRow>(
    `
      WITH editorial_quality AS (
        ${baseQueueSql}
        WHERE ($1::TEXT IS NULL OR l.bundle_id = $1)
      )
      SELECT
        COUNT(*)::TEXT AS total_meanings,
        COUNT(*) FILTER (WHERE NOT graph_covered)::TEXT AS lexical_only_meanings,
        COUNT(*) FILTER (WHERE graph_covered)::TEXT AS graph_meanings,
        COUNT(*) FILTER (WHERE review_status = 'unreviewed')::TEXT AS unreviewed,
        COUNT(*) FILTER (WHERE review_status = 'in_review')::TEXT AS in_review,
        COUNT(*) FILTER (WHERE review_status = 'approved')::TEXT AS approved,
        COUNT(*) FILTER (WHERE review_status = 'flagged')::TEXT AS flagged,
        COUNT(*) FILTER (WHERE review_status = 'rejected')::TEXT AS rejected,
        COUNT(*) FILTER (
          WHERE NOT graph_covered
            AND (review_status = 'approved' OR promotion_recommendation)
        )::TEXT AS promotion_candidates,
        COUNT(*) FILTER (WHERE promoted_at IS NOT NULL)::TEXT AS promoted,
        COUNT(*) FILTER (WHERE NOT concept_history)::TEXT AS missing_history,
        COUNT(*) FILTER (WHERE NOT source_backed)::TEXT AS source_issues
      FROM editorial_quality;
    `,
    [bundleId ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      available: false,
      totalMeanings: 0,
      lexicalOnlyMeanings: 0,
      graphMeanings: 0,
      unreviewed: 0,
      inReview: 0,
      approved: 0,
      flagged: 0,
      rejected: 0,
      promotionCandidates: 0,
      promoted: 0,
      missingHistory: 0,
      sourceIssues: 0,
    };
  }
  return {
    available: true,
    totalMeanings: Number(row.total_meanings),
    lexicalOnlyMeanings: Number(row.lexical_only_meanings),
    graphMeanings: Number(row.graph_meanings),
    unreviewed: Number(row.unreviewed),
    inReview: Number(row.in_review),
    approved: Number(row.approved),
    flagged: Number(row.flagged),
    rejected: Number(row.rejected),
    promotionCandidates: Number(row.promotion_candidates),
    promoted: Number(row.promoted),
    missingHistory: Number(row.missing_history),
    sourceIssues: Number(row.source_issues),
  };
}

export interface ListDictionaryRootEditorialQueueOptions {
  page: number;
  limit: number;
  bundleId?: string;
  query?: string;
  status: DictionaryRootEditorialStatus | "all";
  category: DictionaryRootEditorialCategory;
  partOfSpeech?: string;
  sort: DictionaryRootEditorialSort;
}

export async function listDictionaryRootEditorialQueue(
  options: ListDictionaryRootEditorialQueueOptions,
): Promise<DictionaryRootEditorialQueueResult> {
  const database = requireDatabase();
  const values: Array<string | number | null> = [options.bundleId ?? null];
  const conditions = ["($1::TEXT IS NULL OR bundle_id = $1)"];
  const query = String(options.query || "").trim().toLowerCase();

  if (query) {
    values.push(`%${query}%`);
    conditions.push(`(LOWER(title) LIKE $${values.length} OR EXISTS (SELECT 1 FROM UNNEST(lemmas) AS u(lemma_value) WHERE LOWER(lemma_value) LIKE $${values.length}))`);
  }
  if (options.partOfSpeech && options.partOfSpeech !== "all") {
    values.push(options.partOfSpeech);
    conditions.push(`part_of_speech = $${values.length}`);
  }
  if (options.status !== "all") {
    values.push(options.status);
    conditions.push(`review_status = $${values.length}`);
  }

  if (options.category === "lexical-only") conditions.push("NOT graph_covered");
  if (options.category === "missing-history") conditions.push("NOT concept_history");
  if (options.category === "needs-review") conditions.push("review_status IN ('unreviewed', 'in_review', 'flagged')");
  if (options.category === "promotion-candidates") conditions.push("NOT graph_covered AND (review_status = 'approved' OR promotion_recommendation)");
  if (options.category === "source-issues") conditions.push("NOT source_backed");

  const orderBy = options.sort === "lemma"
    ? "title ASC, node_id ASC"
    : options.sort === "updated"
      ? "review_updated_at DESC NULLS LAST, priority_score DESC, title ASC"
      : "priority_score DESC, review_updated_at DESC NULLS LAST, title ASC";

  values.push(options.limit);
  const limitParameter = values.length;
  values.push((options.page - 1) * options.limit);
  const offsetParameter = values.length;

  const result = await database.query<QueueRow>(
    `
      WITH editorial_queue AS (
        ${baseQueueSql}
      ), filtered AS (
        SELECT * FROM editorial_queue
        WHERE ${conditions.join(" AND ")}
      )
      SELECT *, COUNT(*) OVER()::TEXT AS total_count
      FROM filtered
      ORDER BY ${orderBy}
      LIMIT $${limitParameter}
      OFFSET $${offsetParameter};
    `,
    values,
  );

  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    available: true,
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total ? Math.ceil(total / options.limit) : 0,
    items: result.rows.map(mapQueueRow),
    filters: {
      query,
      status: options.status,
      category: options.category,
      partOfSpeech: options.partOfSpeech || "all",
      sort: options.sort,
    },
  };
}

export async function getDictionaryRootEditorialDetail(
  nodeId: string,
): Promise<DictionaryRootEditorialDetail | undefined> {
  const database = requireDatabase();
  const [itemResult, eventResult] = await Promise.all([
    database.query<QueueRow>(
      `WITH editorial_queue AS (${baseQueueSql}) SELECT * FROM editorial_queue WHERE node_id = $1 LIMIT 1;`,
      [nodeId],
    ),
    database.query<EventRow>(
      `
        SELECT event_id, review_id, node_id, action, from_status, to_status,
          COALESCE(actor.display_name, event.reviewer_name) AS reviewer_name,
          event.actor_id, actor.actor_type, actor.verification_level,
          event.delegated_by_actor_id, delegator.display_name AS delegated_by_display_name,
          event.note, event.raw_data, event.created_at
        FROM dictionaryroot_editorial_review_events event
        LEFT JOIN dictionaryroot_actors actor ON actor.actor_id = event.actor_id
        LEFT JOIN dictionaryroot_actors delegator ON delegator.actor_id = event.delegated_by_actor_id
        WHERE event.node_id = $1
        ORDER BY event.created_at DESC, event.event_id DESC
        LIMIT 100;
      `,
      [nodeId],
    ),
  ]);
  const row = itemResult.rows[0];
  if (!row) return undefined;
  return {
    item: mapQueueRow(row),
    events: eventResult.rows.map(mapEventRow),
  };
}

export async function saveDictionaryRootEditorialReview(
  nodeId: string,
  input: SaveDictionaryRootEditorialReviewInput,
  auth: DictionaryRootAuthContext,
): Promise<DictionaryRootEditorialDetail | undefined> {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const lexicalResult = await client.query<{ dataset_id: string; bundle_id: string }>(
      `SELECT dataset_id, bundle_id FROM dictionaryroot_lexicon_synsets WHERE node_id = $1 FOR UPDATE;`,
      [nodeId],
    );
    const lexical = lexicalResult.rows[0];
    if (!lexical) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const existing = await client.query<{ review_status: string }>(
      `SELECT review_status FROM dictionaryroot_editorial_reviews WHERE node_id = $1;`,
      [nodeId],
    );
    const fromStatus = existing.rows[0]?.review_status || "unreviewed";
    const reviewId = `dictionaryroot-review-${nodeId}`;
    await client.query(
      `
        INSERT INTO dictionaryroot_editorial_reviews (
          review_id, node_id, dataset_id, bundle_id, review_status, reviewer_name,
          actor_id, delegated_by_actor_id, actor_snapshot,
          notes, annotation, promotion_recommendation, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::JSONB,$10,$11,$12,$13::JSONB)
        ON CONFLICT (node_id) DO UPDATE SET
          review_status = EXCLUDED.review_status,
          reviewer_name = EXCLUDED.reviewer_name,
          actor_id = EXCLUDED.actor_id,
          delegated_by_actor_id = EXCLUDED.delegated_by_actor_id,
          actor_snapshot = EXCLUDED.actor_snapshot,
          notes = EXCLUDED.notes,
          annotation = EXCLUDED.annotation,
          promotion_recommendation = EXCLUDED.promotion_recommendation,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [
        reviewId,
        nodeId,
        lexical.dataset_id,
        lexical.bundle_id,
        input.status,
        auth.actor.displayName,
        auth.actor.actorId,
        auth.delegation?.principalActorId || null,
        JSON.stringify(actorSnapshot(auth)),
        input.notes || null,
        input.annotation || null,
        input.promotionRecommendation,
        JSON.stringify({ source: "DictionaryRoot Editorial v1", workflowVersion: "1.1", actor: actorSnapshot(auth) }),
      ],
    );
    await client.query(
      `
        INSERT INTO dictionaryroot_editorial_review_events (
          event_id, review_id, node_id, bundle_id, action, from_status, to_status,
          reviewer_name, actor_id, delegated_by_actor_id, actor_snapshot, note, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::JSONB,$11,$12::JSONB);
      `,
      [
        `dictionaryroot-review-event-${randomUUID()}`,
        reviewId,
        nodeId,
        lexical.bundle_id,
        auth.actor.actorType === "autonomous_agent" ? "agent-recommendation" : "review-updated",
        fromStatus,
        input.status,
        auth.actor.displayName,
        auth.actor.actorId,
        auth.delegation?.principalActorId || null,
        JSON.stringify(actorSnapshot(auth)),
        input.notes || input.annotation || null,
        JSON.stringify({ promotionRecommendation: input.promotionRecommendation, actor: actorSnapshot(auth) }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getDictionaryRootEditorialDetail(nodeId);
}

export async function promoteDictionaryRootEditorialMeaning(
  nodeId: string,
  auth: DictionaryRootAuthContext,
  note: string,
): Promise<{ detail: DictionaryRootEditorialDetail; alreadyPromoted: boolean } | undefined> {
  const database = requireDatabase();
  const client = await database.connect();
  let alreadyPromoted = false;
  try {
    await client.query("BEGIN");
    const lexicalResult = await client.query<{
      node_id: string; dataset_id: string; bundle_id: string; source_id: string;
      source_version: string; source_synset_key: string; source_offset: string;
      part_of_speech: string; title: string; definition: string; synset_type: string;
      lexicographer_file_number: number; lemmas: string[]; examples: string[]; original_gloss: string;
    }>(
      `SELECT * FROM dictionaryroot_lexicon_synsets WHERE node_id = $1 FOR UPDATE;`,
      [nodeId],
    );
    const lexical = lexicalResult.rows[0];
    if (!lexical) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const reviewResult = await client.query<{ review_id: string; review_status: string }>(
      `SELECT review_id, review_status FROM dictionaryroot_editorial_reviews WHERE node_id = $1 FOR UPDATE;`,
      [nodeId],
    );
    const review = reviewResult.rows[0];
    if (!review || review.review_status !== "approved") {
      throw Object.assign(new Error("Only approved meanings can be promoted into the curated graph."), { statusCode: 409 });
    }
    const existingNode = await client.query(`SELECT node_id FROM nodes WHERE node_id = $1;`, [nodeId]);
    alreadyPromoted = (existingNode.rowCount ?? 0) > 0;

    if (!alreadyPromoted) {
      const metadata = {
        source: "Open English WordNet",
        sourceVersion: lexical.source_version,
        sourceSynsetKey: lexical.source_synset_key,
        sourceOffset: lexical.source_offset,
        partOfSpeech: lexical.part_of_speech,
        synsetType: lexical.synset_type,
        lexicographerFileNumber: lexical.lexicographer_file_number,
        lemmas: lexical.lemmas,
        examples: lexical.examples,
        originalGloss: lexical.original_gloss,
        lexicalCoverage: "complete-lemma",
        graphCoverage: true,
        datasetId: lexical.dataset_id,
        editorialPromotion: {
          workflowVersion: "1.0",
          actor: actorSnapshot(auth),
          reviewerName: auth.actor.displayName,
          promotedAt: new Date().toISOString(),
        },
      };
      const rawData = {
        nodeId: lexical.node_id,
        title: lexical.title,
        nodeType: "lexical-concept",
        domain: "DictionaryRoot",
        summary: lexical.definition,
        status: "source-backed",
        metadata,
        sourceIds: [lexical.source_id],
      };
      await client.query(
        `
          INSERT INTO nodes (
            node_id, bundle_id, title, node_type, domain, summary, status, metadata, raw_data
          ) VALUES ($1,$2,$3,'lexical-concept','DictionaryRoot',$4,'source-backed',$5::JSONB,$6::JSONB);
        `,
        [nodeId, lexical.bundle_id, lexical.title, lexical.definition, JSON.stringify(metadata), JSON.stringify(rawData)],
      );
      await client.query(
        `
          INSERT INTO node_sources (node_id, source_id, bundle_id)
          SELECT $1, $2, $3
          WHERE EXISTS (SELECT 1 FROM sources WHERE source_id = $2)
          ON CONFLICT (node_id, source_id) DO NOTHING;
        `,
        [nodeId, lexical.source_id, lexical.bundle_id],
      );
      await client.query(
        `
          INSERT INTO revisions (
            revision_id, bundle_id, object_type, object_id, revision_type, summary, status, raw_data
          ) VALUES ($1,$2,'node',$3,'editorial-promotion',$4,'approved',$5::JSONB);
        `,
        [
          `dictionaryroot-promotion-${randomUUID()}`,
          lexical.bundle_id,
          nodeId,
          `Approved meaning promoted into the curated DictionaryRoot graph: ${lexical.title}`,
          JSON.stringify({ actor: actorSnapshot(auth), reviewerName: auth.actor.displayName, note: note || null, datasetId: lexical.dataset_id }),
        ],
      );
    }

    await client.query(
      `
        UPDATE dictionaryroot_editorial_reviews
        SET promotion_recommendation = TRUE,
            promoted_at = COALESCE(promoted_at, CURRENT_TIMESTAMP),
            reviewer_name = COALESCE(NULLIF($2, ''), reviewer_name),
            actor_id = $3,
            delegated_by_actor_id = $4,
            actor_snapshot = $5::JSONB,
            updated_at = CURRENT_TIMESTAMP
        WHERE node_id = $1;
      `,
      [
        nodeId,
        auth.actor.displayName,
        auth.actor.actorId,
        auth.delegation?.principalActorId || null,
        JSON.stringify(actorSnapshot(auth)),
      ],
    );
    await client.query(
      `
        INSERT INTO dictionaryroot_editorial_review_events (
          event_id, review_id, node_id, bundle_id, action, from_status, to_status,
          reviewer_name, actor_id, delegated_by_actor_id, actor_snapshot, note, raw_data
        ) VALUES ($1,$2,$3,$4,$5,'approved','approved',$6,$7,$8,$9::JSONB,$10,$11::JSONB);
      `,
      [
        `dictionaryroot-review-event-${randomUUID()}`,
        review.review_id,
        nodeId,
        lexical.bundle_id,
        alreadyPromoted ? "promotion-confirmed" : "promoted-to-core",
        auth.actor.displayName,
        auth.actor.actorId,
        auth.delegation?.principalActorId || null,
        JSON.stringify(actorSnapshot(auth)),
        note || null,
        JSON.stringify({ alreadyPromoted, actor: actorSnapshot(auth) }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const detail = await getDictionaryRootEditorialDetail(nodeId);
  return detail ? { detail, alreadyPromoted } : undefined;
}
