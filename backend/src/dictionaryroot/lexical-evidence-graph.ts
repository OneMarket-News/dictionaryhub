import { getPool } from "../lib/database.js";

type Row = Record<string, unknown>;

export interface LexicalGraphNode {
  nodeId: string;
  title: string;
  summary: string;
  nodeType: string;
  objectType: string;
  sourceIds: string[];
  metadata: Record<string, unknown>;
}

export interface LexicalGraphEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: string;
  label: string;
  summary: string;
  metadata: Record<string, unknown>;
}

function database() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function node(
  nodeId: unknown,
  objectType: string,
  title: unknown,
  summary: unknown,
  datasetId: unknown,
  metadata: Record<string, unknown> = {},
  sourceIds: string[] = [],
): LexicalGraphNode {
  return {
    nodeId: text(nodeId),
    title: text(title) || text(nodeId),
    summary: text(summary),
    nodeType: `lexical-evidence-${objectType}`,
    objectType: `lexical-evidence-${objectType}`,
    sourceIds,
    metadata: {
      datasetId: text(datasetId),
      lexicalEvidence: true,
      ...metadata,
    },
  };
}

function edge(
  edgeId: string,
  fromNodeId: unknown,
  toNodeId: unknown,
  relationshipType: string,
  label: string,
  metadata: Record<string, unknown> = {},
): LexicalGraphEdge {
  return {
    edgeId,
    fromNodeId: text(fromNodeId),
    toNodeId: text(toNodeId),
    relationshipType,
    label,
    summary: label,
    metadata,
  };
}

export async function lookupLexicalEvidenceGraphSeeds(options: {
  query: string;
  page: number;
  limit: number;
}): Promise<{
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: Row[];
}> {
  const normalized = options.query.trim().toLowerCase().replace(/\s+/gu, " ");
  if (!normalized) {
    return {
      page: options.page, limit: options.limit, total: 0, totalPages: 0, items: [],
    };
  }
  const result = await database().query<Row>(
    `SELECT s.sense_id, s.dataset_id, s.part_of_speech, s.lexical_category,
       s.review_status, l.lemma_id, l.canonical_written_form,
       COALESCE(claim.exact_wording, claim.normalized_definition, '') AS summary,
       claim.uncertainty, COUNT(*) OVER()::INTEGER AS total_count
     FROM dictionaryroot_lexical_lemmas l
     JOIN dictionaryroot_lexical_lemma_senses association
       ON association.lemma_id=l.lemma_id
     JOIN dictionaryroot_lexical_senses s
       ON s.sense_id=association.sense_id
     LEFT JOIN LATERAL (
       SELECT exact_wording, normalized_definition, uncertainty
       FROM dictionaryroot_lexical_definition_claims
       WHERE sense_id=s.sense_id AND archived_at IS NULL
       ORDER BY claim_id LIMIT 1
     ) claim ON TRUE
     WHERE l.archived_at IS NULL AND s.archived_at IS NULL
       AND l.normalized_form=$1
     ORDER BY s.part_of_speech, s.sense_id
     LIMIT $2 OFFSET $3`,
    [normalized, options.limit, (options.page - 1) * options.limit],
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: result.rows.map((row) => ({
      id: row.sense_id,
      nodeId: row.sense_id,
      lemmaId: row.lemma_id,
      title: row.canonical_written_form,
      summary: row.summary,
      resultType: "node",
      nodeType: "lexical-evidence-sense",
      objectType: "lexical-evidence-sense",
      metadata: {
        datasetId: row.dataset_id,
        partOfSpeech: row.part_of_speech,
        lexicalCategory: row.lexical_category,
        reviewStatus: row.review_status,
        uncertainty: row.uncertainty,
        lexicalEvidence: true,
      },
    })),
  };
}

async function findDatasetId(seedId: string): Promise<string | undefined> {
  const result = await database().query<{ dataset_id: string }>(
    `SELECT dataset_id FROM (
       SELECT dataset_id FROM dictionaryroot_lexical_lemmas WHERE lemma_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_senses WHERE sense_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_definition_claims WHERE claim_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_forms WHERE form_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_etymology_proposals WHERE proposal_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_source_comparisons WHERE comparison_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_evidence_sources WHERE source_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_source_locators WHERE locator_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_field_provenance WHERE provenance_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_relationships WHERE relationship_id=$1
       UNION ALL SELECT dataset_id FROM dictionaryroot_lexical_relationship_evidence WHERE evidence_id=$1
     ) subject LIMIT 1`,
    [seedId],
  );
  return result.rows[0]?.dataset_id;
}

export async function getLexicalEvidenceRelationship(
  relationshipId: string,
): Promise<Row | undefined> {
  const result = await database().query<Row>(
    `SELECT relationship.*, type.display_name, type.inverse_relationship_type,
       source_lemma.canonical_written_form AS source_lemma,
       target_lemma.canonical_written_form AS target_lemma,
       (SELECT COUNT(*)::INTEGER
        FROM dictionaryroot_lexical_relationship_evidence evidence
        WHERE evidence.relationship_id=relationship.relationship_id)
        AS evidence_count
     FROM dictionaryroot_lexical_relationships relationship
     JOIN dictionaryroot_lexical_relationship_types type
       ON type.relationship_type=relationship.relationship_type
     LEFT JOIN dictionaryroot_lexical_lemma_senses source_association
       ON source_association.sense_id=relationship.source_sense_id
     LEFT JOIN dictionaryroot_lexical_lemmas source_lemma
       ON source_lemma.lemma_id=source_association.lemma_id
     LEFT JOIN dictionaryroot_lexical_lemma_senses target_association
       ON target_association.sense_id=relationship.target_sense_id
     LEFT JOIN dictionaryroot_lexical_lemmas target_lemma
       ON target_lemma.lemma_id=target_association.lemma_id
     WHERE relationship.relationship_id=$1
       AND relationship.archived_at IS NULL
     ORDER BY source_lemma.lemma_id, target_lemma.lemma_id LIMIT 1`,
    [relationshipId],
  );
  return result.rows[0];
}

export async function listLexicalEvidenceRelationshipEvidence(
  relationshipId: string,
  page: number,
  limit: number,
): Promise<{ page: number; limit: number; total: number; totalPages: number; items: Row[] }> {
  const result = await database().query<Row>(
    `SELECT evidence.*, source.name AS source_name, source.edition AS source_edition,
       source.rights_class, source.license,
       COUNT(*) OVER()::INTEGER AS total_count
     FROM dictionaryroot_lexical_relationship_evidence evidence
     JOIN dictionaryroot_lexical_evidence_sources source
       ON source.source_id=evidence.source_id
      AND source.dataset_id=evidence.dataset_id
     WHERE evidence.relationship_id=$1
     ORDER BY evidence.evidence_id
     LIMIT $2 OFFSET $3`,
    [relationshipId, limit, (page - 1) * limit],
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    items: result.rows.map((row) => {
      const copy = { ...row };
      delete copy.total_count;
      return copy;
    }),
  };
}

export async function getLexicalEvidenceGraphNeighborhood(options: {
  seedId: string;
  depth: 1 | 2;
  limit: number;
}): Promise<Row | undefined> {
  const datasetId = await findDatasetId(options.seedId);
  if (!datasetId) return undefined;
  const pool = database();
  const cap = 500;
  const [
    lemmas, associations, senses, claims, forms, proposals, competitors,
    comparisons, locators, provenance, sources, relationships, evidence,
  ] = await Promise.all([
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_lemmas
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY lemma_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT association.* FROM dictionaryroot_lexical_lemma_senses association
      JOIN dictionaryroot_lexical_lemmas lemma ON lemma.lemma_id=association.lemma_id
      WHERE lemma.dataset_id=$1 ORDER BY association.lemma_id, association.sense_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_senses
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY sense_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_definition_claims
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY claim_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_forms
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY form_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_etymology_proposals
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY proposal_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT competitor.* FROM dictionaryroot_lexical_etymology_competitors competitor
      JOIN dictionaryroot_lexical_etymology_proposals proposal
        ON proposal.proposal_id=competitor.proposal_id
      WHERE proposal.dataset_id=$1
      ORDER BY competitor.proposal_id, competitor.competing_proposal_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_source_comparisons
      WHERE dataset_id=$1 AND archived_at IS NULL ORDER BY comparison_id LIMIT $2`,
    [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_source_locators
      WHERE dataset_id=$1 ORDER BY locator_id LIMIT $2`, [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_field_provenance
      WHERE dataset_id=$1 ORDER BY provenance_id LIMIT $2`, [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_evidence_sources
      WHERE dataset_id=$1 ORDER BY source_id LIMIT $2`, [datasetId, cap]),
    pool.query<Row>(`SELECT relationship.*, type.display_name
      FROM dictionaryroot_lexical_relationships relationship
      JOIN dictionaryroot_lexical_relationship_types type
        ON type.relationship_type=relationship.relationship_type
      WHERE relationship.dataset_id=$1 AND relationship.archived_at IS NULL
      ORDER BY relationship.relationship_id LIMIT $2`, [datasetId, cap]),
    pool.query<Row>(`SELECT * FROM dictionaryroot_lexical_relationship_evidence
      WHERE dataset_id=$1 ORDER BY evidence_id LIMIT $2`, [datasetId, cap]),
  ]);

  const nodes = new Map<string, LexicalGraphNode>();
  const edges = new Map<string, LexicalGraphEdge>();
  const addNode = (value: LexicalGraphNode) => nodes.set(value.nodeId, value);
  const addEdge = (value: LexicalGraphEdge) => edges.set(value.edgeId, value);

  for (const row of lemmas.rows) addNode(node(
    row.lemma_id, "lemma", row.canonical_written_form, "Lexical lemma",
    row.dataset_id, { language: row.language, status: row.status },
  ));
  for (const row of senses.rows) {
    const association = associations.rows.find((item) =>
      item.sense_id === row.sense_id);
    const lemma = lemmas.rows.find((item) =>
      item.lemma_id === association?.lemma_id);
    addNode(node(
      row.sense_id, "sense",
      `${text(lemma?.canonical_written_form)} — ${text(row.lexical_category)}`,
      "Independently addressable lexical sense",
      row.dataset_id, {
        partOfSpeech: row.part_of_speech, lexicalCategory: row.lexical_category,
        reviewStatus: row.review_status, status: row.status,
        lemmas: lemma ? [text(lemma.canonical_written_form)] : [],
      },
    ));
  }
  for (const row of associations.rows) addEdge(edge(
    `lex-edge:lemma-sense:${text(row.lemma_id)}:${text(row.sense_id)}`,
    row.lemma_id, row.sense_id, "HAS_SENSE", "has sense",
  ));
  for (const row of claims.rows) {
    addNode(node(
      row.claim_id, "definition-claim", "Definition claim",
      row.exact_wording ?? row.normalized_definition, row.dataset_id,
      {
        reviewStatus: row.claim_status, uncertainty: row.uncertainty,
        qualification: row.qualification,
      }, [text(row.source_id)],
    ));
    addEdge(edge(`lex-edge:sense-claim:${text(row.sense_id)}:${text(row.claim_id)}`,
      row.sense_id, row.claim_id, "HAS_DEFINITION_CLAIM", "has definition claim"));
    addEdge(edge(`lex-edge:claim-source:${text(row.claim_id)}:${text(row.source_id)}`,
      row.claim_id, row.source_id, "SUPPORTED_BY_SOURCE", "supported by source"));
  }
  for (const row of forms.rows) {
    addNode(node(
      row.form_id, "form", row.written_form, text(row.form_type), row.dataset_id,
      { formType: row.form_type, uncertainty: row.uncertainty },
      row.source_id ? [text(row.source_id)] : [],
    ));
    addEdge(edge(`lex-edge:lemma-form:${text(row.lemma_id)}:${text(row.form_id)}`,
      row.lemma_id, row.form_id, "HAS_FORM", "has lexical form"));
    if (row.sense_id) addEdge(edge(
      `lex-edge:sense-form:${text(row.sense_id)}:${text(row.form_id)}`,
      row.sense_id, row.form_id, "HAS_SENSE_FORM", "has sense form"));
  }
  for (const row of sources.rows) addNode(node(
    row.source_id, "source", row.name, row.license, row.dataset_id,
    { rightsClass: row.rights_class, edition: row.edition },
    [text(row.source_id)],
  ));
  for (const row of proposals.rows) {
    addNode(node(
      row.proposal_id, "etymology-proposal", row.proposed_etymon,
      row.qualification, row.dataset_id,
      {
        reviewStatus: row.review_status, uncertainty: row.confidence,
        chronologyContext: row.chronology_display,
      }, [text(row.source_id)],
    ));
    const subjectId = row.subject_lemma_id ?? row.subject_form_id ?? row.subject_sense_id;
    addEdge(edge(`lex-edge:etymology:${text(subjectId)}:${text(row.proposal_id)}`,
      subjectId, row.proposal_id, "HAS_ETYMOLOGY_PROPOSAL", "has etymology proposal"));
    addEdge(edge(`lex-edge:proposal-source:${text(row.proposal_id)}:${text(row.source_id)}`,
      row.proposal_id, row.source_id, "SUPPORTED_BY_SOURCE", "supported by source"));
  }
  for (const row of competitors.rows) addEdge(edge(
    `lex-edge:etymology-competitor:${text(row.proposal_id)}:${text(row.competing_proposal_id)}`,
    row.proposal_id, row.competing_proposal_id, "COMPETES_WITH", "competes with",
  ));
  for (const row of comparisons.rows) {
    addNode(node(
      row.comparison_id, "source-comparison", row.comparison_type,
      row.explanation, row.dataset_id, { reviewStatus: row.review_status },
    ));
    addEdge(edge(`lex-edge:sense-comparison:${text(row.sense_id)}:${text(row.comparison_id)}`,
      row.sense_id, row.comparison_id, "HAS_SOURCE_COMPARISON", "has source comparison"));
    addEdge(edge(`lex-edge:comparison-left:${text(row.comparison_id)}:${text(row.left_claim_id)}`,
      row.comparison_id, row.left_claim_id, "COMPARES_CLAIM", "compares claim"));
    addEdge(edge(`lex-edge:comparison-right:${text(row.comparison_id)}:${text(row.right_claim_id)}`,
      row.comparison_id, row.right_claim_id, "COMPARES_CLAIM", "compares claim"));
  }
  for (const row of locators.rows) {
    addNode(node(
      row.locator_id, "locator", "Structured source locator",
      row.dataset_record_id ?? row.stable_fragment, row.dataset_id,
      { sourceId: row.source_id }, [text(row.source_id)],
    ));
    const subjectId = row.claim_id ?? row.form_id ?? row.proposal_id ?? row.comparison_id;
    addEdge(edge(`lex-edge:locator:${text(subjectId)}:${text(row.locator_id)}`,
      subjectId, row.locator_id, "HAS_STRUCTURED_LOCATOR", "has structured locator"));
  }
  for (const row of provenance.rows) {
    addNode(node(
      row.provenance_id, "provenance", row.subject_field,
      row.transformation_type, row.dataset_id,
      { evidenceRole: row.evidence_role, versionContext: row.version_context },
      [text(row.source_id)],
    ));
    const subjectId = row.lemma_id ?? row.sense_id ?? row.claim_id ?? row.form_id
      ?? row.proposal_id ?? row.comparison_id;
    addEdge(edge(`lex-edge:provenance:${text(subjectId)}:${text(row.provenance_id)}`,
      subjectId, row.provenance_id, "HAS_FIELD_PROVENANCE", "has field provenance"));
  }
  for (const row of relationships.rows) {
    addNode(node(
      row.relationship_id, "relationship", row.display_name,
      row.qualification, row.dataset_id,
      {
        relationshipType: row.relationship_type,
        directionality: row.directionality,
        reviewStatus: row.review_status,
        uncertainty: row.uncertainty,
        chronologyContext: row.chronology_context,
        domainContext: row.domain_context,
      },
    ));
    addEdge(edge(`lex-edge:relationship-source:${text(row.source_sense_id)}:${text(row.relationship_id)}`,
      row.source_sense_id, row.relationship_id, "HAS_LEXICAL_RELATIONSHIP",
      text(row.display_name), { directionality: row.directionality }));
    addEdge(edge(`lex-edge:relationship-target:${text(row.relationship_id)}:${text(row.target_sense_id)}`,
      row.relationship_id, row.target_sense_id, "RELATES_TO_SENSE",
      text(row.display_name), { directionality: row.directionality }));
  }
  for (const row of evidence.rows) {
    addNode(node(
      row.evidence_id, "relationship-evidence", row.evidence_role,
      row.source_wording ?? row.normalized_summary, row.dataset_id,
      {
        relationshipId: row.relationship_id,
        reviewStatus: row.review_status,
        uncertainty: row.uncertainty,
        qualification: row.qualification,
        provenanceIdentity: row.provenance_identity,
        versionContext: row.version_context,
      }, [text(row.source_id)],
    ));
    addEdge(edge(`lex-edge:relationship-evidence:${text(row.relationship_id)}:${text(row.evidence_id)}`,
      row.relationship_id, row.evidence_id, "SUPPORTED_BY_EVIDENCE", "supported by evidence"));
    addEdge(edge(`lex-edge:relationship-evidence-source:${text(row.evidence_id)}:${text(row.source_id)}`,
      row.evidence_id, row.source_id, "SUPPORTED_BY_SOURCE", "supported by source"));
  }

  const adjacency = new Map<string, Set<string>>();
  for (const value of edges.values()) {
    if (!adjacency.has(value.fromNodeId)) adjacency.set(value.fromNodeId, new Set());
    if (!adjacency.has(value.toNodeId)) adjacency.set(value.toNodeId, new Set());
    adjacency.get(value.fromNodeId)!.add(value.toNodeId);
    adjacency.get(value.toNodeId)!.add(value.fromNodeId);
  }
  const distances = new Map<string, number>([[options.seedId, 0]]);
  const queue = [options.seedId];
  while (queue.length) {
    const current = queue.shift()!;
    const distance = distances.get(current)!;
    if (distance >= options.depth) continue;
    for (const neighbor of [...(adjacency.get(current) ?? [])].sort()) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }
  }
  const orderedIds = [...distances.keys()].filter((id) => nodes.has(id)).sort(
    (left, right) => (distances.get(left)! - distances.get(right)!)
      || left.localeCompare(right),
  );
  const includedIds = new Set(orderedIds.slice(0, options.limit));
  const includedEdges = [...edges.values()].filter((value) =>
    includedIds.has(value.fromNodeId) && includedIds.has(value.toNodeId))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  return {
    seedId: options.seedId,
    datasetId,
    depth: options.depth,
    limit: options.limit,
    total: orderedIds.length,
    truncated: orderedIds.length > options.limit,
    items: orderedIds.slice(0, options.limit).map((id) => ({
      node: nodes.get(id),
      distance: distances.get(id),
      graphMembership: "dynamic",
    })),
    edges: includedEdges,
  };
}
