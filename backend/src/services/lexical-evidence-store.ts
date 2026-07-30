import type { PoolClient } from "pg";

import {
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
  type DictionaryRootCoreLexicalCorpus,
  type DictionaryRootLexicalEvidenceFixture,
  type LexicalSubject,
} from "../dictionaryroot/lexical-evidence-types.js";
import {
  CORE_LEXICAL_CORPUS_ID,
  CORE_LEXICAL_CORPUS_VERSION,
} from "../dictionaryroot/core-lexical-corpus.js";
import { getPool } from "../lib/database.js";

type Row = Record<string, unknown>;

function requireDatabase() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

function subjectColumns(subject: LexicalSubject): [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
] {
  return [
    "lemmaId" in subject ? subject.lemmaId : null,
    "senseId" in subject ? subject.senseId : null,
    "claimId" in subject ? subject.claimId : null,
    "formId" in subject ? subject.formId : null,
    "proposalId" in subject ? subject.proposalId : null,
    "comparisonId" in subject ? subject.comparisonId : null,
  ];
}

type LexicalEvidenceBundle =
  | DictionaryRootLexicalEvidenceFixture
  | DictionaryRootCoreLexicalCorpus;

async function saveDictionaryRootLexicalEvidenceBundle(
  fixture: LexicalEvidenceBundle,
): Promise<void> {
  const pool = requireDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (fixture.dataset.status === "accepted" && fixture.dataset.fixtureOnly === false) {
      await client.query(
        `DELETE FROM dictionaryroot_lexical_evidence_datasets
         WHERE dataset_id = $1 OR dataset_id = $2`,
        [CORE_LEXICAL_CORPUS_ID, DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID],
      );
    } else if (fixture.dataset.status === "fixture") {
      await client.query(
        `DELETE FROM dictionaryroot_lexical_evidence_datasets
         WHERE dataset_id = $1`,
        [CORE_LEXICAL_CORPUS_ID],
      );
    }
    await client.query(
      "DELETE FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id = $1",
      [fixture.dataset.datasetId],
    );
    await insertLexicalEvidenceBundle(client, fixture);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveDictionaryRootLexicalEvidenceFixture(
  fixture: DictionaryRootLexicalEvidenceFixture,
): Promise<void> {
  if (
    fixture.dataset.datasetId !== DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID
    || fixture.dataset.bundleId !== DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID
    || fixture.dataset.fixtureOnly !== true
    || fixture.dataset.status !== "fixture"
  ) {
    throw new Error("Only the bounded DictionaryRoot architecture fixture may be imported.");
  }
  await saveDictionaryRootLexicalEvidenceBundle(fixture);
}

export async function saveDictionaryRootCoreLexicalCorpus(
  corpus: DictionaryRootCoreLexicalCorpus,
): Promise<void> {
  if (
    corpus.dataset.datasetId !== CORE_LEXICAL_CORPUS_ID
    || corpus.dataset.bundleId !== CORE_LEXICAL_CORPUS_ID
    || corpus.dataset.version !== CORE_LEXICAL_CORPUS_VERSION
    || corpus.dataset.fixtureOnly !== false
    || corpus.dataset.status !== "accepted"
  ) {
    throw new Error("Invalid DictionaryRoot production lexical corpus identity.");
  }
  await saveDictionaryRootLexicalEvidenceBundle(corpus);
}

async function insertLexicalEvidenceBundle(
  client: PoolClient,
  fixture: LexicalEvidenceBundle,
): Promise<void> {
    await client.query(
      `INSERT INTO dictionaryroot_lexical_evidence_datasets
        (dataset_id, bundle_id, title, version, status, rights_summary, fixture_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        fixture.dataset.datasetId, fixture.dataset.bundleId, fixture.dataset.title,
        fixture.dataset.version, fixture.dataset.status,
        fixture.dataset.rightsSummary, fixture.dataset.fixtureOnly,
      ],
    );
    for (const source of fixture.sources) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_evidence_sources
          (source_id, dataset_id, account_id, name, edition, version,
           rights_class, license, canonical_url, lineage_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          source.sourceId, fixture.dataset.datasetId, source.accountId ?? null,
          source.name, source.edition ?? null, source.version ?? null,
          source.rightsClass, source.license, source.canonicalUrl ?? null,
          source.lineageId ?? null,
        ],
      );
    }
    for (const lemma of fixture.lemmas) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_lemmas
          (lemma_id, dataset_id, canonical_written_form, normalized_form,
           language, script, status, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          lemma.lemmaId, fixture.dataset.datasetId, lemma.canonicalWrittenForm,
          lemma.normalizedForm, lemma.language, lemma.script ?? null,
          lemma.status, lemma.recordVersion,
        ],
      );
    }
    for (const sense of fixture.senses) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_senses
          (sense_id, dataset_id, part_of_speech, lexical_category, status,
           review_status, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          sense.senseId, fixture.dataset.datasetId, sense.partOfSpeech,
          sense.lexicalCategory, sense.status, sense.reviewStatus,
          sense.recordVersion,
        ],
      );
      for (const lemmaId of sense.lemmaIds) {
        await client.query(
          `INSERT INTO dictionaryroot_lexical_lemma_senses
            (lemma_id, sense_id, association_type) VALUES ($1,$2,'primary')`,
          [lemmaId, sense.senseId],
        );
      }
    }
    for (const claim of fixture.definitionClaims) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_definition_claims
          (claim_id, dataset_id, sense_id, source_id, source_account_id,
           exact_wording, normalized_definition, normalization_label, language,
           claim_status, edition_context, usage_label, domain_label,
           register_label, uncertainty, qualification, evidence_relationship,
           record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          claim.claimId, fixture.dataset.datasetId, claim.senseId, claim.sourceId,
          claim.sourceAccountId ?? null, claim.exactWording ?? null,
          claim.normalizedDefinition ?? null, claim.normalizationLabel ?? null,
          claim.language, claim.claimStatus, claim.editionContext ?? null,
          claim.usageLabel ?? null, claim.domainLabel ?? null,
          claim.registerLabel ?? null, claim.uncertainty ?? null,
          claim.qualification ?? null, claim.evidenceRelationship,
          claim.recordVersion,
        ],
      );
    }
    for (const form of fixture.forms) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_forms
          (form_id, dataset_id, lemma_id, sense_id, source_id, written_form,
           normalized_form, form_type, language, script, grammatical_features,
           chronology_display, usage_context, uncertainty, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          form.formId, fixture.dataset.datasetId, form.lemmaId,
          form.senseId ?? null, form.sourceId ?? null, form.writtenForm,
          form.normalizedForm, form.formType, form.language, form.script ?? null,
          form.grammaticalFeatures ?? null, form.chronologyDisplay ?? null,
          form.usageContext ?? null, form.uncertainty ?? null, form.recordVersion,
        ],
      );
    }
    for (const proposal of fixture.etymologyProposals) {
      const [lemmaId, senseId, , formId] = subjectColumns(proposal.subject);
      await client.query(
        `INSERT INTO dictionaryroot_lexical_etymology_proposals
          (proposal_id, dataset_id, subject_lemma_id, subject_form_id,
           subject_sense_id, source_id, source_account_id,
           proposed_source_language, proposed_etymon, relationship_type,
           chronology_display, confidence, qualification, review_status,
           record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          proposal.proposalId, fixture.dataset.datasetId, lemmaId, formId,
          senseId, proposal.sourceId, proposal.sourceAccountId ?? null,
          proposal.proposedSourceLanguage ?? null, proposal.proposedEtymon ?? null,
          proposal.relationshipType, proposal.chronologyDisplay ?? null,
          proposal.confidence, proposal.qualification ?? null,
          proposal.reviewStatus, proposal.recordVersion,
        ],
      );
    }
    for (const proposal of fixture.etymologyProposals) {
      for (const competingId of proposal.competingProposalIds) {
        await client.query(
          `INSERT INTO dictionaryroot_lexical_etymology_competitors
            (proposal_id, competing_proposal_id, relationship_type)
           VALUES ($1,$2,'competes_with')`,
          [proposal.proposalId, competingId],
        );
      }
    }
    for (const comparison of fixture.sourceComparisons) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_source_comparisons
          (comparison_id, dataset_id, sense_id, left_claim_id, right_claim_id,
           comparison_type, review_status, explanation, reviewer_identity,
           algorithmic_suggestion, algorithmic_ruleset_version,
           source_lineage_relation, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          comparison.comparisonId, fixture.dataset.datasetId, comparison.senseId,
          comparison.leftClaimId, comparison.rightClaimId,
          comparison.comparisonType, comparison.reviewStatus,
          comparison.explanation, comparison.reviewerIdentity ?? null,
          comparison.algorithmicSuggestion ?? null,
          comparison.algorithmicRulesetVersion ?? null,
          comparison.sourceLineageRelation ?? null, comparison.recordVersion,
        ],
      );
    }
    for (const locator of fixture.locators) {
      const [, , claimId, formId, proposalId, comparisonId] =
        subjectColumns(locator.subject);
      await client.query(
        `INSERT INTO dictionaryroot_lexical_source_locators
          (locator_id, dataset_id, claim_id, form_id, proposal_id, comparison_id,
           source_id, edition, volume, page, column_name, entry_headword,
           sense_number, section, paragraph, dataset_record_id, synset_id,
           api_object_id, stable_fragment, archive_identifier, canonical_url,
           access_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 $18,$19,$20,$21,$22)`,
        [
          locator.locatorId, fixture.dataset.datasetId, claimId, formId,
          proposalId, comparisonId, locator.sourceId, locator.edition ?? null,
          locator.volume ?? null, locator.page ?? null, locator.column ?? null,
          locator.entryHeadword ?? null, locator.senseNumber ?? null,
          locator.section ?? null, locator.paragraph ?? null,
          locator.datasetRecordId ?? null, locator.synsetId ?? null,
          locator.apiObjectId ?? null, locator.stableFragment ?? null,
          locator.archiveIdentifier ?? null, locator.canonicalUrl ?? null,
          locator.accessDate ?? null,
        ],
      );
    }
    for (const provenance of fixture.fieldProvenance) {
      const [lemmaId, senseId, claimId, formId, proposalId, comparisonId] =
        subjectColumns(provenance.subject);
      await client.query(
        `INSERT INTO dictionaryroot_lexical_field_provenance
          (provenance_id, dataset_id, lemma_id, sense_id, claim_id, form_id,
           proposal_id, comparison_id, subject_field, source_id, locator_id,
           evidence_role, transformation_type, reviewer_or_process_identity,
           version_context)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          provenance.provenanceId, fixture.dataset.datasetId, lemmaId, senseId,
          claimId, formId, proposalId, comparisonId, provenance.subjectField,
          provenance.sourceId, provenance.locatorId ?? null,
          provenance.evidenceRole, provenance.transformationType,
          provenance.reviewerOrProcessIdentity ?? null,
          provenance.versionContext ?? null,
        ],
      );
    }
    for (const relationship of fixture.relationships) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_relationships
          (relationship_id, dataset_id, source_sense_id, target_sense_id,
           relationship_type, directionality, relationship_status,
           review_status, qualification, uncertainty, chronology_context,
           domain_context, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          relationship.relationshipId, fixture.dataset.datasetId,
          relationship.sourceSenseId, relationship.targetSenseId,
          relationship.relationshipType, relationship.directionality,
          relationship.relationshipStatus, relationship.reviewStatus,
          relationship.qualification ?? null, relationship.uncertainty ?? null,
          relationship.chronologyContext ?? null,
          relationship.domainContext ?? null, relationship.recordVersion,
        ],
      );
    }
    for (const evidence of fixture.relationshipEvidence) {
      await client.query(
        `INSERT INTO dictionaryroot_lexical_relationship_evidence
          (evidence_id, dataset_id, relationship_id, source_id,
           provenance_identity, evidence_role, source_wording,
           normalized_summary, normalization_label, review_status,
           uncertainty, qualification, edition_context, version_context,
           page, entry_headword, sense_number, section, paragraph,
           dataset_record_id, stable_fragment, canonical_url, record_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 $17,$18,$19,$20,$21,$22,$23)`,
        [
          evidence.evidenceId, fixture.dataset.datasetId,
          evidence.relationshipId, evidence.sourceId,
          evidence.provenanceIdentity, evidence.evidenceRole,
          evidence.sourceWording ?? null, evidence.normalizedSummary ?? null,
          evidence.normalizationLabel ?? null, evidence.reviewStatus,
          evidence.uncertainty ?? null, evidence.qualification ?? null,
          evidence.editionContext ?? null, evidence.versionContext ?? null,
          evidence.page ?? null, evidence.entryHeadword ?? null,
          evidence.senseNumber ?? null, evidence.section ?? null,
          evidence.paragraph ?? null, evidence.datasetRecordId ?? null,
          evidence.stableFragment ?? null, evidence.canonicalUrl ?? null,
          evidence.recordVersion,
        ],
      );
    }
}

function mapKeys(row: Row): Row {
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/gu, (_match, letter: string) =>
      letter.toUpperCase())] = value instanceof Date ? value.toISOString() : value;
  }
  return result;
}

export async function searchDictionaryRootLexicalEvidence(options: {
  query: string;
  page: number;
  limit: number;
}): Promise<{
  page: number;
  limit: number;
  total: number;
  exactTotal: number;
  totalPages: number;
  items: Row[];
}> {
  const database = requireDatabase();
  const normalized = options.query.trim().toLowerCase().replace(/\s+/gu, " ");
  if (!normalized) {
    return {
      page: options.page,
      limit: options.limit,
      total: 0,
      exactTotal: 0,
      totalPages: 0,
      items: [],
    };
  }
  const result = await database.query<Row>(
    `WITH matched_lemmas AS (
       SELECT DISTINCT l.lemma_id
       FROM dictionaryroot_lexical_lemmas l
       LEFT JOIN dictionaryroot_lexical_forms f ON f.lemma_id = l.lemma_id
       WHERE l.archived_at IS NULL
         AND (l.normalized_form = $1 OR l.normalized_form LIKE $1 || '%'
           OR f.normalized_form = $1 OR f.normalized_form LIKE $1 || '%')
     )
     SELECT l.lemma_id, l.canonical_written_form, l.normalized_form, l.language,
       s.sense_id, s.part_of_speech, s.lexical_category, s.review_status,
       COALESCE(c.exact_wording, c.normalized_definition) AS definition,
       c.uncertainty, c.domain_label, c.register_label,
       COUNT(*) OVER()::INTEGER AS total_count,
       COUNT(*) FILTER (WHERE l.normalized_form = $1)
         OVER()::INTEGER AS exact_count
     FROM matched_lemmas m
     JOIN dictionaryroot_lexical_lemmas l ON l.lemma_id = m.lemma_id
     JOIN dictionaryroot_lexical_lemma_senses ls ON ls.lemma_id = l.lemma_id
     JOIN dictionaryroot_lexical_senses s ON s.sense_id = ls.sense_id
     LEFT JOIN LATERAL (
       SELECT exact_wording, normalized_definition, uncertainty, domain_label,
         register_label
       FROM dictionaryroot_lexical_definition_claims
       WHERE sense_id = s.sense_id AND archived_at IS NULL
       ORDER BY claim_id LIMIT 1
     ) c ON TRUE
     ORDER BY CASE WHEN l.normalized_form = $1 THEN 0 ELSE 1 END,
       l.normalized_form, s.part_of_speech, s.sense_id
     LIMIT $2 OFFSET $3`,
    [normalized, options.limit, (options.page - 1) * options.limit],
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  const exactTotal = Number(result.rows[0]?.exact_count ?? 0);
  return {
    page: options.page,
    limit: options.limit,
    total,
    exactTotal,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: result.rows.map((row) => {
      const mapped = mapKeys(row);
      delete mapped.totalCount;
      delete mapped.exactCount;
      return mapped;
    }),
  };
}

async function rows(client: PoolClient | ReturnType<typeof requireDatabase>, sql: string,
  values: unknown[]): Promise<Row[]> {
  const result = await client.query<Row>(sql, values);
  return result.rows.map(mapKeys);
}

export async function getDictionaryRootLexicalEvidenceSense(
  senseId: string,
): Promise<Row | undefined> {
  const database = requireDatabase();
  const senseResult = await database.query<Row>(
    `SELECT s.*, d.version AS dataset_version,
       l.lemma_id, l.canonical_written_form, l.normalized_form,
       l.language, l.script, l.status AS lemma_status
     FROM dictionaryroot_lexical_senses s
     JOIN dictionaryroot_lexical_evidence_datasets d ON d.dataset_id=s.dataset_id
     JOIN dictionaryroot_lexical_lemma_senses ls ON ls.sense_id=s.sense_id
     JOIN dictionaryroot_lexical_lemmas l ON l.lemma_id=ls.lemma_id
     WHERE s.sense_id=$1 AND s.archived_at IS NULL
     ORDER BY l.lemma_id LIMIT 1`,
    [senseId],
  );
  const sense = senseResult.rows[0];
  if (!sense) return undefined;
  const lemmaId = String(sense.lemma_id);
  const [
    claims, forms, etymologies, comparisons, locators, provenance, sources,
    relationships,
  ] =
    await Promise.all([
      rows(database,
        `SELECT * FROM dictionaryroot_lexical_definition_claims
         WHERE sense_id=$1 AND archived_at IS NULL ORDER BY claim_id`, [senseId]),
      rows(database,
        `SELECT * FROM dictionaryroot_lexical_forms
         WHERE lemma_id=$1 AND archived_at IS NULL ORDER BY form_type, written_form, form_id`,
        [lemmaId]),
      rows(database,
        `SELECT p.*, COALESCE(ARRAY_AGG(ec.competing_proposal_id)
          FILTER (WHERE ec.competing_proposal_id IS NOT NULL), ARRAY[]::TEXT[])
          AS competing_proposal_ids
         FROM dictionaryroot_lexical_etymology_proposals p
         LEFT JOIN dictionaryroot_lexical_etymology_competitors ec
           ON ec.proposal_id=p.proposal_id
         WHERE (p.subject_lemma_id=$1 OR p.subject_sense_id=$2)
           AND p.archived_at IS NULL
         GROUP BY p.proposal_id ORDER BY p.proposal_id`, [lemmaId, senseId]),
      rows(database,
        `SELECT * FROM dictionaryroot_lexical_source_comparisons
         WHERE sense_id=$1 AND archived_at IS NULL ORDER BY comparison_id`, [senseId]),
      rows(database,
        `SELECT locator.* FROM dictionaryroot_lexical_source_locators locator
         LEFT JOIN dictionaryroot_lexical_definition_claims c
           ON c.claim_id=locator.claim_id
         LEFT JOIN dictionaryroot_lexical_forms f ON f.form_id=locator.form_id
         LEFT JOIN dictionaryroot_lexical_etymology_proposals p
           ON p.proposal_id=locator.proposal_id
         LEFT JOIN dictionaryroot_lexical_source_comparisons comparison
           ON comparison.comparison_id=locator.comparison_id
         WHERE c.sense_id=$1 OR f.lemma_id=$2 OR p.subject_lemma_id=$2
           OR p.subject_sense_id=$1 OR comparison.sense_id=$1
         ORDER BY locator.locator_id`, [senseId, lemmaId]),
      rows(database,
        `SELECT provenance.* FROM dictionaryroot_lexical_field_provenance provenance
         LEFT JOIN dictionaryroot_lexical_definition_claims c
           ON c.claim_id=provenance.claim_id
         LEFT JOIN dictionaryroot_lexical_forms f ON f.form_id=provenance.form_id
         LEFT JOIN dictionaryroot_lexical_etymology_proposals p
           ON p.proposal_id=provenance.proposal_id
         LEFT JOIN dictionaryroot_lexical_source_comparisons comparison
           ON comparison.comparison_id=provenance.comparison_id
         WHERE provenance.lemma_id=$2 OR provenance.sense_id=$1
           OR c.sense_id=$1 OR f.lemma_id=$2 OR p.subject_lemma_id=$2
           OR p.subject_sense_id=$1 OR comparison.sense_id=$1
         ORDER BY provenance.provenance_id`, [senseId, lemmaId]),
      rows(database,
        `SELECT DISTINCT source.* FROM dictionaryroot_lexical_evidence_sources source
         JOIN dictionaryroot_lexical_definition_claims c
           ON c.source_id=source.source_id
         WHERE c.sense_id=$1 ORDER BY source.source_id`, [senseId]),
      rows(database,
        `SELECT relationship.*,
          COALESCE(evidence.evidence_count, 0)::INTEGER AS evidence_count
         FROM dictionaryroot_lexical_relationships relationship
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS evidence_count
           FROM dictionaryroot_lexical_relationship_evidence
           WHERE relationship_id=relationship.relationship_id
         ) evidence ON TRUE
         WHERE (relationship.source_sense_id=$1
           OR relationship.target_sense_id=$1)
           AND relationship.archived_at IS NULL
         ORDER BY relationship.relationship_type,
           relationship.relationship_id`, [senseId]),
    ]);
  return {
    sense: mapKeys(sense),
    claims,
    forms,
    etymologyProposals: etymologies,
    comparisons,
    locators,
    fieldProvenance: provenance,
    sources,
    relationships,
  };
}

export async function getDictionaryRootLexicalEvidenceLemma(
  lemmaId: string,
): Promise<Row | undefined> {
  const database = requireDatabase();
  const result = await database.query<Row>(
    `SELECT * FROM dictionaryroot_lexical_lemmas
     WHERE lemma_id=$1 AND archived_at IS NULL`, [lemmaId],
  );
  const lemma = result.rows[0];
  if (!lemma) return undefined;
  const senses = await rows(database,
    `SELECT s.* FROM dictionaryroot_lexical_senses s
     JOIN dictionaryroot_lexical_lemma_senses ls ON ls.sense_id=s.sense_id
     WHERE ls.lemma_id=$1 AND s.archived_at IS NULL
     ORDER BY s.part_of_speech, s.sense_id`, [lemmaId]);
  return { lemma: mapKeys(lemma), senses };
}

export async function listDictionaryRootLexicalEvidenceResource(
  resource: "claims" | "forms" | "etymologies" | "comparisons" | "locators" | "provenance",
  subjectId: string,
): Promise<Row[]> {
  const database = requireDatabase();
  const queries = {
    claims: [`SELECT * FROM dictionaryroot_lexical_definition_claims
      WHERE sense_id=$1 AND archived_at IS NULL ORDER BY claim_id`, [subjectId]],
    forms: [`SELECT * FROM dictionaryroot_lexical_forms
      WHERE lemma_id=$1 AND archived_at IS NULL ORDER BY form_type, written_form, form_id`,
    [subjectId]],
    etymologies: [`SELECT * FROM dictionaryroot_lexical_etymology_proposals
      WHERE (subject_lemma_id=$1 OR subject_sense_id=$1 OR subject_form_id=$1)
        AND archived_at IS NULL ORDER BY proposal_id`, [subjectId]],
    comparisons: [`SELECT * FROM dictionaryroot_lexical_source_comparisons
      WHERE sense_id=$1 AND archived_at IS NULL ORDER BY comparison_id`, [subjectId]],
    locators: [`SELECT * FROM dictionaryroot_lexical_source_locators
      WHERE claim_id=$1 OR form_id=$1 OR proposal_id=$1 OR comparison_id=$1
      ORDER BY locator_id`, [subjectId]],
    provenance: [`SELECT * FROM dictionaryroot_lexical_field_provenance
      WHERE lemma_id=$1 OR sense_id=$1 OR claim_id=$1 OR form_id=$1
        OR proposal_id=$1 OR comparison_id=$1 ORDER BY provenance_id`, [subjectId]],
  } satisfies Record<string, [string, string[]]>;
  const [sql, values] = queries[resource];
  return rows(database, sql, values);
}

export async function getDictionaryRootLexicalEvidenceCoverage(): Promise<Row> {
  const database = requireDatabase();
  const datasetResult = await database.query<Row>(
    `SELECT dataset_id, version, title, status
     FROM dictionaryroot_lexical_evidence_datasets
     WHERE fixture_only = FALSE AND status = 'accepted'
     ORDER BY dataset_id LIMIT 1`,
  );
  const dataset = datasetResult.rows[0];
  if (!dataset) {
    return {
      productionDatasetAvailable: false,
      status: "awaiting_production_corpus",
      metricsAvailable: false,
      message: "SourceRoot is healthy; no accepted DictionaryRoot production lexical dataset is installed.",
    };
  }
  const datasetId = String(dataset.dataset_id);
  const result = await database.query<Row>(
    `WITH
      sense_sources AS (
        SELECT sense_id, COUNT(DISTINCT source_id)::INTEGER AS source_count
        FROM dictionaryroot_lexical_definition_claims
        WHERE dataset_id=$1 AND archived_at IS NULL GROUP BY sense_id
      ),
      source_claims AS (
        SELECT source_id, COUNT(*)::INTEGER AS claim_count
        FROM dictionaryroot_lexical_definition_claims
        WHERE dataset_id=$1 AND archived_at IS NULL GROUP BY source_id
      )
     SELECT
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_lemmas
        WHERE dataset_id=$1 AND archived_at IS NULL) AS lemma_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses
        WHERE dataset_id=$1 AND archived_at IS NULL) AS sense_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_definition_claims
        WHERE dataset_id=$1 AND archived_at IS NULL) AS definition_claim_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_evidence_sources
        WHERE dataset_id=$1) AS source_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_relationships
        WHERE dataset_id=$1 AND archived_at IS NULL) AS lexical_relationship_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_relationship_evidence
        WHERE dataset_id=$1) AS relationship_evidence_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_forms
        WHERE dataset_id=$1 AND archived_at IS NULL) AS form_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_etymology_proposals
        WHERE dataset_id=$1 AND archived_at IS NULL) AS etymology_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_comparisons
        WHERE dataset_id=$1 AND archived_at IS NULL) AS source_comparison_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_locators
        WHERE dataset_id=$1) AS locator_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_field_provenance
        WHERE dataset_id=$1) AS provenance_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses
        WHERE dataset_id=$1 AND archived_at IS NULL AND status='historical')
        AS historical_or_obsolete_sense_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses
        WHERE dataset_id=$1 AND archived_at IS NULL
          AND lexical_category='technical_or_specialized') AS technical_sense_count,
      ((SELECT COUNT(*) FROM dictionaryroot_lexical_source_comparisons
          WHERE dataset_id=$1 AND review_status='unresolved')
       + (SELECT COUNT(*) FROM dictionaryroot_lexical_definition_claims
          WHERE dataset_id=$1 AND (uncertainty IS NOT NULL OR qualification IS NOT NULL))
       + (SELECT COUNT(*) FROM dictionaryroot_lexical_relationships
          WHERE dataset_id=$1 AND (uncertainty IS NOT NULL
            OR relationship_status IN ('disputed','unresolved'))))::INTEGER
        AS uncertainty_bearing_structure_count,
      (SELECT COUNT(*)::INTEGER FROM sense_sources WHERE source_count > 1)
        AS multi_source_sense_count,
      (SELECT COUNT(*)::INTEGER FROM sense_sources WHERE source_count = 1)
        AS single_source_sense_count,
      (SELECT COALESCE(MAX(claim_count),0)::INTEGER FROM source_claims)
        AS largest_source_claim_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses s
        WHERE s.dataset_id=$1 AND s.review_status IN ('unresolved','needs_review'))
        AS unresolved_sense_boundary_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_etymology_proposals p
        WHERE p.dataset_id=$1 AND p.review_status IN ('unresolved','needs_review'))
        AS unresolved_origin_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses s
        WHERE s.dataset_id=$1 AND NOT EXISTS (
          SELECT 1 FROM dictionaryroot_lexical_source_comparisons c
          WHERE c.sense_id=s.sense_id AND c.archived_at IS NULL))
        AS missing_comparison_count`,
    [datasetId],
  );
  const raw = mapKeys(result.rows[0] ?? {});
  const number = (key: string): number => Number(raw[key] ?? 0);
  const senseCount = number("senseCount");
  const lemmaCount = number("lemmaCount");
  const claimCount = number("definitionClaimCount");
  const relationshipCount = number("lexicalRelationshipCount");
  const ratio = (value: number, total: number): number =>
    total ? Number(((value / total) * 100).toFixed(2)) : 0;
  const [posRows, rightsRows, lineageRows] = await Promise.all([
    database.query<Row>(
      `SELECT part_of_speech, COUNT(*)::INTEGER AS count
       FROM dictionaryroot_lexical_senses WHERE dataset_id=$1
       GROUP BY part_of_speech ORDER BY part_of_speech`, [datasetId]),
    database.query<Row>(
      `SELECT rights_class, COUNT(*)::INTEGER AS count
       FROM dictionaryroot_lexical_evidence_sources WHERE dataset_id=$1
       GROUP BY rights_class ORDER BY rights_class`, [datasetId]),
    database.query<Row>(
      `SELECT COUNT(*)::INTEGER AS single_lineage_sense_count FROM (
         SELECT c.sense_id
         FROM dictionaryroot_lexical_definition_claims c
         JOIN dictionaryroot_lexical_evidence_sources s ON s.source_id=c.source_id
         WHERE c.dataset_id=$1
         GROUP BY c.sense_id
         HAVING COUNT(DISTINCT s.lineage_id)=1
       ) lineage`, [datasetId]),
  ]);
  const partOfSpeechDistribution = Object.fromEntries(posRows.rows.map((row) =>
    [String(row.part_of_speech), Number(row.count)]));
  const rightsDistribution = Object.fromEntries(rightsRows.rows.map((row) =>
    [String(row.rights_class), Number(row.count)]));
  const sourceCount = number("sourceCount");
  return {
    productionDatasetAvailable: true,
    status: "production_metrics_available",
    metricsAvailable: true,
    datasetId,
    datasetVersion: dataset.version,
    datasetTitle: dataset.title,
    ...raw,
    definitionsPerLemma: lemmaCount ? Number((claimCount / lemmaCount).toFixed(2)) : 0,
    sourcesPerSense: senseCount ? Number((claimCount / senseCount).toFixed(2)) : 0,
    multiSourceCoveragePercent: ratio(number("multiSourceSenseCount"), senseCount),
    partOfSpeechDistribution,
    formCoveragePercent: ratio(number("formCount"), lemmaCount),
    etymologyCoveragePercent: ratio(number("etymologyCount"), lemmaCount),
    relationshipCoveragePercent: ratio(relationshipCount, senseCount),
    relationshipEvidenceCoveragePercent:
      ratio(number("relationshipEvidenceCount"), relationshipCount),
    locatorCoveragePercent: ratio(number("locatorCount"), claimCount),
    provenanceCoveragePercent: ratio(number("provenanceCount"), claimCount),
    comparisonCoveragePercent: ratio(number("sourceComparisonCount"), senseCount),
    sourceConcentrationPercent:
      ratio(number("largestSourceClaimCount"), claimCount),
    rightsDistribution,
    publicDomainSharePercent:
      ratio(Number(rightsDistribution.public_domain ?? 0), sourceCount),
    openLicenseSharePercent:
      ratio(Number(rightsDistribution.open_license ?? 0), sourceCount),
    orphanCounts: {
      lemmas: 0, senses: 0, claims: 0, forms: 0, etymologies: 0,
      comparisons: 0, locators: 0, provenance: 0, relationships: 0,
      relationshipEvidence: 0,
    },
    unresolvedChronologyCount: 0,
    singleLineageSenseCount:
      Number(lineageRows.rows[0]?.single_lineage_sense_count ?? 0),
  };
}

export async function listDictionaryRootLexicalEvidenceSources(): Promise<Row> {
  const database = requireDatabase();
  const dataset = await database.query<Row>(
    `SELECT dataset_id, version FROM dictionaryroot_lexical_evidence_datasets
     WHERE fixture_only=FALSE AND status='accepted' ORDER BY dataset_id LIMIT 1`,
  );
  if (!dataset.rows[0]) {
    return {
      productionDatasetAvailable: false,
      status: "awaiting_production_corpus",
      total: 0,
      items: [],
    };
  }
  const datasetId = String(dataset.rows[0].dataset_id);
  const result = await database.query<Row>(
    `SELECT source.*,
      (SELECT COUNT(DISTINCT ls.lemma_id)::INTEGER
       FROM dictionaryroot_lexical_definition_claims c
       JOIN dictionaryroot_lexical_lemma_senses ls ON ls.sense_id=c.sense_id
       WHERE c.source_id=source.source_id) AS supported_lemma_count,
      (SELECT COUNT(DISTINCT c.sense_id)::INTEGER
       FROM dictionaryroot_lexical_definition_claims c
       WHERE c.source_id=source.source_id) AS supported_sense_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_definition_claims c
       WHERE c.source_id=source.source_id) AS supported_claim_count,
      (SELECT COUNT(DISTINCT e.relationship_id)::INTEGER
       FROM dictionaryroot_lexical_relationship_evidence e
       WHERE e.source_id=source.source_id) AS supported_relationship_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_relationship_evidence e
       WHERE e.source_id=source.source_id) AS relationship_evidence_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_locators l
       WHERE l.source_id=source.source_id) AS locator_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_field_provenance p
       WHERE p.source_id=source.source_id) AS provenance_count,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_comparisons c
       JOIN dictionaryroot_lexical_definition_claims left_claim
         ON left_claim.claim_id=c.left_claim_id
       JOIN dictionaryroot_lexical_definition_claims right_claim
         ON right_claim.claim_id=c.right_claim_id
       WHERE left_claim.source_id=source.source_id
          OR right_claim.source_id=source.source_id) AS comparison_participation_count
     FROM dictionaryroot_lexical_evidence_sources source
     WHERE source.dataset_id=$1 ORDER BY source.source_id`,
    [datasetId],
  );
  return {
    productionDatasetAvailable: true,
    status: "production_sources_available",
    datasetId,
    datasetVersion: dataset.rows[0].version,
    total: result.rows.length,
    items: result.rows.map(mapKeys),
  };
}

export async function getLexicalEvidenceFixtureCounts(): Promise<Row> {
  const database = requireDatabase();
  const result = await database.query<Row>(
    `SELECT
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_evidence_datasets
        WHERE dataset_id=$1) AS datasets,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_lemmas
        WHERE dataset_id=$1) AS lemmas,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_senses
        WHERE dataset_id=$1) AS senses,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_definition_claims
        WHERE dataset_id=$1) AS definition_claims,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_forms
        WHERE dataset_id=$1) AS forms,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_etymology_proposals
        WHERE dataset_id=$1) AS etymology_proposals,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_comparisons
        WHERE dataset_id=$1) AS source_comparisons,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_source_locators
        WHERE dataset_id=$1) AS locators,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_field_provenance
        WHERE dataset_id=$1) AS field_provenance,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_relationships
        WHERE dataset_id=$1) AS relationships,
      (SELECT COUNT(*)::INTEGER
        FROM dictionaryroot_lexical_relationship_evidence
        WHERE dataset_id=$1) AS relationship_evidence`,
    [DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID],
  );
  return mapKeys(result.rows[0] ?? {});
}
