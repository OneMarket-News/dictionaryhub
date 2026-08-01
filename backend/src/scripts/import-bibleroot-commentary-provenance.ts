import "dotenv/config";

import { pathToFileURL } from "node:url";

import {
  COMMENTARY_DATASET_ID,
  type CommentaryDataset,
  validateCommentaryDataset,
} from "../bibleroot/commentary-provenance.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  assertLocalDevelopmentImportAuthorized,
  type LocalDevelopmentDatabaseAuthorization,
} from "../lib/local-development-database.js";

export interface ImportCommentaryOptions {
  dataset?: CommentaryDataset;
  developmentAuthorization?: LocalDevelopmentDatabaseAuthorization;
  simulateFailureAfterDatasetDelete?: boolean;
}

export interface CommentaryImportSummary {
  datasetId: string;
  version: string;
  action: "imported" | "updated" | "skipped";
  records: { imported: number; updated: number; skipped: number; failed: number };
  works: number;
  sections: number;
  statements: number;
  anchors: number;
  sourceArtifacts: number;
  rightsRecords: number;
}

export async function importBibleRootCommentaryProvenance(
  options: ImportCommentaryOptions = {},
): Promise<CommentaryImportSummary> {
  const dataset = await validateCommentaryDataset(options.dataset);
  const counts = dataset.manifest.expectedCounts;
  const totalRecords = 1 + (counts.works * 5) + counts.sections + counts.anchors + counts.statements;
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const databaseName = (await client.query<{ database_name: string }>("SELECT current_database() AS database_name;")).rows[0]?.database_name;
    if (databaseName !== "sourceroot_test" && !options.developmentAuthorization) {
      throw new Error(`BibleRoot commentary provenance import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`);
    }
    if (databaseName !== "sourceroot_test") assertLocalDevelopmentImportAuthorized(options.developmentAuthorization, databaseName);

    await client.query("BEGIN");
    try {
      const existing = (await client.query<{
        bundle: number; works: number; sections: number; statements: number; anchors: number; artifacts: number; rights: number;
      }>(`
        SELECT
          (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = $1 AND version = $2) AS bundle,
          (SELECT COUNT(*)::integer FROM bibleroot_commentary_works WHERE dataset_id = $1) AS works,
          (SELECT COUNT(*)::integer FROM bibleroot_commentary_sections WHERE dataset_id = $1) AS sections,
          (SELECT COUNT(*)::integer FROM bibleroot_commentary_statements WHERE dataset_id = $1) AS statements,
          (SELECT COUNT(*)::integer FROM bibleroot_commentary_section_anchors WHERE dataset_id = $1) AS anchors,
          (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = $1) AS artifacts,
          (SELECT COUNT(*)::integer FROM bibleroot_source_artifact_rights_components WHERE dataset_id = $1) AS rights;
      `, [COMMENTARY_DATASET_ID, dataset.manifest.version])).rows[0]!;
      const exact = JSON.stringify(Object.values(existing)) === JSON.stringify([
        1, counts.works, counts.sections, counts.statements, counts.anchors, counts.sourceArtifacts, counts.rightsRecords,
      ]);
      if (exact) {
        await client.query("COMMIT");
        return {
          datasetId: dataset.manifest.datasetId,
          version: dataset.manifest.version,
          action: "skipped",
          records: { imported: 0, updated: 0, skipped: totalRecords, failed: 0 },
          works: counts.works,
          sections: counts.sections,
          statements: counts.statements,
          anchors: counts.anchors,
          sourceArtifacts: counts.sourceArtifacts,
          rightsRecords: counts.rightsRecords,
        };
      }
      const action = Object.values(existing).some((value) => value > 0) ? "updated" : "imported";
      await client.query("DELETE FROM imported_bundles WHERE bundle_id = $1;", [COMMENTARY_DATASET_ID]);
      if (options.simulateFailureAfterDatasetDelete) throw new Error("Simulated commentary provenance transactional rollback.");

      await client.query(`
        INSERT INTO imported_bundles(bundle_id, bundle_type, version, domain, bundle)
        VALUES ($1, 'bibleroot-commentary-provenance', $2, 'BibleRoot', $3::jsonb);
      `, [dataset.manifest.datasetId, dataset.manifest.version, JSON.stringify(dataset.manifest)]);

      for (const [displayIndex, source] of dataset.sourceMetadata.artifacts.entries()) {
        const rights = dataset.rightsMetadata.records.find((record) => record.workId === source.workId)!;
        const normalized = dataset.works.find((work) => work.work.workId === source.workId)!;
        await client.query(`
          INSERT INTO sources(
            source_id, bundle_id, name, source_type, domain, publisher,
            quality_tier, credibility_tier, verification_status, source_class,
            license, license_status, review_status, last_reviewed, url, notes, raw_data
          ) VALUES ($1,$2,$3,'historical-commentary-edition','BibleRoot',$4,
            'not-ranked','not-ranked','source-identity-recorded','attributed-commentary-source',
            $5,$6,'rights-metadata-recorded',$7,$8,$9,$10::jsonb);
        `, [
          source.sourceId,
          dataset.manifest.datasetId,
          source.title,
          source.provider,
          rights.statement,
          rights.status,
          dataset.sourceMetadata.retrievedAt.slice(0, 10),
          source.detailsUrl,
          "Attributed historical interpretation; SourceRoot does not endorse, reconcile, rank, or determine theological accuracy.",
          JSON.stringify({ sourceUrl: source.sourceUrl, artifactFilename: source.filename, sha256: source.sha256, byteLength: source.byteLength }),
        ]);
        await client.query(`
          INSERT INTO bibleroot_source_publications(
            publication_id, dataset_id, source_id, title, provider,
            stable_identifier, publication_date, description
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
        `, [source.publicationId, dataset.manifest.datasetId, source.sourceId, source.title, source.provider, source.stableIdentifier, source.moduleVersionDate, source.editionIdentity]);
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
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
        `, [rights.rightsId, dataset.manifest.datasetId, source.artifactId, rights.componentType, rights.status, rights.licenseName, rights.licenseUrl, rights.statement, rights.attribution, rights.territorialLimitation, rights.evidenceDocuments.join("; ")]);
        await client.query(`
          INSERT INTO bibleroot_commentary_works(
            work_id, dataset_id, publication_id, artifact_id, rights_component_id,
            title, attribution, work_date_identity, edition_identity, description, display_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
        `, [source.workId, dataset.manifest.datasetId, source.publicationId, source.artifactId, rights.rightsId, source.title, source.attribution, source.workDateIdentity, source.editionIdentity, source.description, displayIndex + 1]);

        for (const section of normalized.sections) {
          await client.query(`
            INSERT INTO bibleroot_commentary_sections(
              section_id, dataset_id, work_id, publication_id, artifact_id,
              rights_component_id, section_order, heading, exact_text,
              source_markup, source_locator, source_text_sha256, source_markup_sha256
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);
          `, [section.sectionId, dataset.manifest.datasetId, source.workId, source.publicationId, source.artifactId, rights.rightsId, section.sectionOrder, section.heading, section.exactText, section.sourceMarkup, section.sourceLocator, section.sourceTextHash, section.sourceMarkupHash]);
          await client.query(`
            INSERT INTO bibleroot_commentary_section_anchors(
              anchor_id, dataset_id, section_id, anchor_order, anchor_type,
              canonical_start_reference_id, canonical_end_reference_id,
              source_supplied_marker, mapping_status, mapping_note
            ) VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9);
          `, [section.anchor.anchorId, dataset.manifest.datasetId, section.sectionId, section.anchor.anchorType, section.anchor.canonicalStartReferenceId, section.anchor.canonicalEndReferenceId, section.anchor.sourceSuppliedMarker, section.anchor.mappingStatus, section.anchor.mappingNote]);
          for (const statement of section.statements) {
            await client.query(`
              INSERT INTO bibleroot_commentary_statements(
                statement_id, dataset_id, section_id, anchor_id, work_id,
                publication_id, artifact_id, rights_component_id,
                statement_order, start_offset, end_offset, exact_text, content_sha256
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);
            `, [statement.statementId, dataset.manifest.datasetId, section.sectionId, section.anchor.anchorId, source.workId, source.publicationId, source.artifactId, rights.rightsId, statement.statementOrder, statement.startOffset, statement.endOffset, statement.exactText, statement.contentHash]);
          }
        }
      }
      await client.query("COMMIT");
      return {
        datasetId: dataset.manifest.datasetId,
        version: dataset.manifest.version,
        action,
        records: { imported: action === "imported" ? totalRecords : 0, updated: action === "updated" ? totalRecords : 0, skipped: 0, failed: 0 },
        works: counts.works,
        sections: counts.sections,
        statements: counts.statements,
        anchors: counts.anchors,
        sourceArtifacts: counts.sourceArtifacts,
        rightsRecords: counts.rightsRecords,
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
  console.log(JSON.stringify(await importBibleRootCommentaryProvenance(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(closeDatabase);
}
