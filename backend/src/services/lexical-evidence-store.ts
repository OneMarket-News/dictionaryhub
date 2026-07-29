import type { PoolClient } from "pg";

import {
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
  type DictionaryRootLexicalEvidenceFixture,
  type LexicalSubject,
} from "../dictionaryroot/lexical-evidence-types.js";
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
  const pool = requireDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id = $1",
      [fixture.dataset.datasetId],
    );
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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
  totalPages: number;
  items: Row[];
}> {
  const database = requireDatabase();
  const normalized = options.query.trim().toLowerCase().replace(/\s+/gu, " ");
  if (!normalized) {
    return { page: options.page, limit: options.limit, total: 0, totalPages: 0, items: [] };
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
       COUNT(*) OVER()::INTEGER AS total_count
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
  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: result.rows.map((row) => {
      const mapped = mapKeys(row);
      delete mapped.totalCount;
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
    `SELECT s.*, l.lemma_id, l.canonical_written_form, l.normalized_form,
       l.language, l.script, l.status AS lemma_status
     FROM dictionaryroot_lexical_senses s
     JOIN dictionaryroot_lexical_lemma_senses ls ON ls.sense_id=s.sense_id
     JOIN dictionaryroot_lexical_lemmas l ON l.lemma_id=ls.lemma_id
     WHERE s.sense_id=$1 AND s.archived_at IS NULL
     ORDER BY l.lemma_id LIMIT 1`,
    [senseId],
  );
  const sense = senseResult.rows[0];
  if (!sense) return undefined;
  const lemmaId = String(sense.lemma_id);
  const [claims, forms, etymologies, comparisons, locators, provenance, sources] =
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
        WHERE dataset_id=$1) AS field_provenance`,
    [DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID],
  );
  return mapKeys(result.rows[0] ?? {});
}
