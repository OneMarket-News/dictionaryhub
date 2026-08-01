import "dotenv/config";

import { pathToFileURL } from "node:url";

import {
  TRANSLATION_COMPARISON_DATASET_ID,
  type TranslationComparisonDataset,
  validateTranslationComparisonDataset,
} from "../bibleroot/translation-comparison.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  assertLocalDevelopmentImportAuthorized,
  type LocalDevelopmentDatabaseAuthorization,
} from "../lib/local-development-database.js";

export interface ImportTranslationComparisonOptions {
  dataset?: TranslationComparisonDataset;
  developmentAuthorization?: LocalDevelopmentDatabaseAuthorization;
  simulateFailureAfterDatasetDelete?: boolean;
}

export interface TranslationComparisonImportSummary {
  datasetId: string;
  version: string;
  action: "imported" | "updated" | "skipped";
  records: { imported: number; updated: number; skipped: number; failed: number };
  editions: number;
  sourceArtifacts: number;
  rightsRecords: number;
  verseTexts: number;
}

const TOTAL_RECORDS = 3 + 3 + 3 + 3 + 3 + 330;

export async function importBibleRootTranslationComparison(
  options: ImportTranslationComparisonOptions = {},
): Promise<TranslationComparisonImportSummary> {
  const dataset = await validateTranslationComparisonDataset(options.dataset);
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const databaseName = (await client.query<{ database_name: string }>("SELECT current_database() AS database_name;")).rows[0]?.database_name;
    if (databaseName !== "sourceroot_test" && !options.developmentAuthorization) {
      throw new Error(`BibleRoot translation comparison import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`);
    }
    if (databaseName !== "sourceroot_test") assertLocalDevelopmentImportAuthorized(options.developmentAuthorization, databaseName);

    await client.query("BEGIN");
    try {
      const existing = (await client.query<{
        bundle: number; editions: number; artifacts: number; rights: number; verses: number;
      }>(`
        SELECT
          (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = $1 AND version = $2) AS bundle,
          (SELECT COUNT(*)::integer FROM bibleroot_editions WHERE dataset_id = $1) AS editions,
          (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = $1) AS artifacts,
          (SELECT COUNT(*)::integer FROM bibleroot_source_artifact_rights_components WHERE dataset_id = $1) AS rights,
          (SELECT COUNT(*)::integer FROM bibleroot_verse_texts WHERE dataset_id = $1) AS verses;
      `, [TRANSLATION_COMPARISON_DATASET_ID, dataset.manifest.version])).rows[0]!;
      const exact = JSON.stringify(Object.values(existing)) === JSON.stringify([1, 3, 3, 3, 330]);
      if (exact) {
        await client.query("COMMIT");
        return {
          datasetId: dataset.manifest.datasetId,
          version: dataset.manifest.version,
          action: "skipped",
          records: { imported: 0, updated: 0, skipped: TOTAL_RECORDS, failed: 0 },
          editions: 3,
          sourceArtifacts: 3,
          rightsRecords: 3,
          verseTexts: 330,
        };
      }
      const action = existing.bundle > 0 || existing.editions > 0 || existing.verses > 0 ? "updated" : "imported";
      await client.query("DELETE FROM imported_bundles WHERE bundle_id = $1;", [TRANSLATION_COMPARISON_DATASET_ID]);
      if (options.simulateFailureAfterDatasetDelete) throw new Error("Simulated translation comparison transactional rollback.");

      await client.query(`
        INSERT INTO imported_bundles(bundle_id, bundle_type, version, domain, bundle)
        VALUES ($1, 'bibleroot-translation-comparison', $2, 'BibleRoot', $3::jsonb);
      `, [dataset.manifest.datasetId, dataset.manifest.version, JSON.stringify(dataset.manifest)]);

      for (const source of dataset.sourceMetadata.artifacts) {
        const rights = dataset.rightsMetadata.records.find((record) => record.editionId === source.editionId)!;
        const normalized = dataset.editions.find((edition) => edition.edition.editionId === source.editionId)!;
        await client.query(`
          INSERT INTO sources(
            source_id, bundle_id, name, source_type, domain, publisher,
            quality_tier, credibility_tier, verification_status, source_class,
            license, license_status, review_status, last_reviewed, url, notes, raw_data
          ) VALUES ($1, $2, $3, 'primary-text-publication', 'BibleRoot', $4,
            'primary-source', 'recorded', 'source-identity-recorded', 'biblical-text-source',
            $5, $6, 'reviewed', $7, $8, $9, $10::jsonb);
        `, [
          source.sourceId,
          dataset.manifest.datasetId,
          source.title,
          source.provider,
          rights.statement,
          rights.status,
          dataset.sourceMetadata.retrievedAt.slice(0, 10),
          source.detailsUrl,
          "Source identity, checksum, rights metadata, and canonical mapping recorded for mechanical comparison.",
          JSON.stringify({ sourceUrl: source.sourceUrl, artifactFilename: source.filename, sha256: source.sha256, byteLength: source.byteLength }),
        ]);
        await client.query(`
          INSERT INTO bibleroot_source_publications(
            publication_id, dataset_id, source_id, title, provider,
            stable_identifier, publication_date, description
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
        `, [source.publicationId, dataset.manifest.datasetId, source.sourceId, source.title, source.provider, source.stableIdentifier, source.publicationOrReleaseDate, source.publicationOrReleaseIdentity]);
        await client.query(`
          INSERT INTO bibleroot_source_artifacts(
            artifact_id, dataset_id, publication_id, source_id, filename,
            media_type, byte_length, sha256, source_url, retrieval_timestamp,
            rights_status, rights_statement, territorial_limitation, parsing_rules
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);
        `, [source.artifactId, dataset.manifest.datasetId, source.publicationId, source.sourceId, source.filename, source.mediaType, source.byteLength, source.sha256, source.sourceUrl, dataset.sourceMetadata.retrievedAt, rights.status, rights.statement, rights.territorialLimitation, source.normalizationNotes]);
        await client.query(`
          INSERT INTO bibleroot_source_artifact_rights_components(
            component_id, dataset_id, artifact_id, component_type, rights_status,
            license_name, license_url, rights_statement, attribution,
            territorial_limitation, evidence_document
          ) VALUES ($1,$2,$3,'translation-text',$4,$5,$6,$7,$8,$9,$10);
        `, [`br-rights-component-${source.editionId.replace(/^br-edition-/, "")}`, dataset.manifest.datasetId, source.artifactId, rights.status, "Public domain", dataset.rightsMetadata.rightsEvidenceUrl, rights.statement, `Source artifact supplied by ${source.provider}.`, rights.territorialLimitation, rights.evidenceDocuments.join("; ")]);
        await client.query(`
          INSERT INTO bibleroot_editions(
            edition_id, dataset_id, publication_id, artifact_id, display_title,
            abbreviation, language_code, translation_name, edition_description,
            publisher_or_distributor, publication_or_release_date, rights_status,
            territorial_limitation, dataset_version, normalized_text_sha256,
            provenance_notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16);
        `, [normalized.edition.editionId, dataset.manifest.datasetId, normalized.edition.publicationId, normalized.edition.artifactId, normalized.edition.displayTitle, normalized.edition.abbreviation, normalized.edition.language, normalized.edition.translationName, normalized.edition.editionDescription, normalized.edition.publisherOrDistributor, normalized.edition.publicationOrReleaseDate, normalized.edition.rightsStatus, normalized.edition.territorialLimitation, dataset.manifest.version, normalized.edition.normalizedTextSha256, normalized.edition.provenanceNotes]);
        for (const verse of normalized.verses) {
          await client.query(`
            INSERT INTO bibleroot_verse_texts(
              edition_text_id, dataset_id, canonical_reference_id, edition_id,
              artifact_id, exact_text, source_observation
            ) VALUES ($1,$2,$3,$4,$5,$6,$7);
          `, [verse.editionTextId, dataset.manifest.datasetId, verse.canonicalReferenceId, verse.editionId, verse.sourceArtifactId, verse.exactText, `Exact display text prepared from ${source.filename}; ${source.normalizationNotes}`]);
        }
      }
      await client.query("COMMIT");
      return {
        datasetId: dataset.manifest.datasetId,
        version: dataset.manifest.version,
        action,
        records: { imported: action === "imported" ? TOTAL_RECORDS : 0, updated: action === "updated" ? TOTAL_RECORDS : 0, skipped: 0, failed: 0 },
        editions: 3,
        sourceArtifacts: 3,
        rightsRecords: 3,
        verseTexts: 330,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

async function runCli(): Promise<void> {
  const summary = await importBibleRootTranslationComparison();
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(closeDatabase);
}
