import "dotenv/config";

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";

import {
  ORIGINAL_LANGUAGE_DATASET_ID,
  loadOriginalLanguageDataset,
  type OriginalLanguageDataset,
} from "../bibleroot/original-languages.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  assertLocalDevelopmentImportAuthorized,
  type LocalDevelopmentDatabaseAuthorization,
} from "../lib/local-development-database.js";

export interface ImportOriginalLanguageOptions {
  dataset?: OriginalLanguageDataset;
  simulateFailureAfterDatasetDelete?: boolean;
  developmentAuthorization?: LocalDevelopmentDatabaseAuthorization;
}

export interface Chunk12Fingerprint {
  rawArtifactByteLength: number;
  rawArtifactSha256: string;
  normalizedTextSha256: string;
  canonId: string;
  editionId: string;
  books: number;
  populatedChapters: number;
  verses: number;
  phrases: number;
  phraseOccurrences: number;
  identitySha256: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export async function captureChunk12Fingerprint(
  client: PoolClient,
): Promise<Chunk12Fingerprint> {
  const identity = await client.query<{
    byte_length: string;
    raw_sha256: string;
    normalized_sha256: string;
    canon_id: string;
    edition_id: string;
  }>(`
    SELECT
      a.byte_length,
      a.sha256 AS raw_sha256,
      e.normalized_text_sha256 AS normalized_sha256,
      c.canon_id,
      e.edition_id
    FROM bibleroot_editions e
    JOIN bibleroot_source_artifacts a ON a.artifact_id = e.artifact_id
    CROSS JOIN bibleroot_canons c
    WHERE e.edition_id = 'br-edition-kjv-pg10-2024'
      AND c.canon_id = 'br-canon-kjv-66';
  `);
  const row = identity.rows[0];
  if (!row) throw new Error("Protected Chunk 12 BibleRoot identity is missing.");
  const counts = await client.query<{
    books: string;
    populated_chapters: string;
    verses: string;
    phrases: string;
    phrase_occurrences: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM bibleroot_books)::text AS books,
      (SELECT COUNT(*) FROM bibleroot_chapters WHERE availability_status = 'text_available')::text AS populated_chapters,
      (SELECT COUNT(*) FROM bibleroot_verse_texts WHERE edition_id = 'br-edition-kjv-pg10-2024')::text AS verses,
      (SELECT COUNT(*) FROM bibleroot_phrases WHERE edition_id = 'br-edition-kjv-pg10-2024')::text AS phrases,
      (SELECT COUNT(*) FROM bibleroot_phrase_occurrences)::text AS phrase_occurrences;
  `);
  const count = counts.rows[0]!;
  const ordered = await client.query<{
    canonical_reference_id: string;
    edition_text_id: string;
    exact_text: string;
  }>(`
    SELECT cv.canonical_reference_id, vt.edition_text_id, vt.exact_text
    FROM bibleroot_verse_texts vt
    JOIN bibleroot_canonical_verses cv
      ON cv.canonical_reference_id = vt.canonical_reference_id
    WHERE vt.edition_id = 'br-edition-kjv-pg10-2024'
    ORDER BY cv.book_id, cv.chapter_number, cv.verse_number;
  `);
  return {
    rawArtifactByteLength: Number(row.byte_length),
    rawArtifactSha256: row.raw_sha256,
    normalizedTextSha256: row.normalized_sha256,
    canonId: row.canon_id,
    editionId: row.edition_id,
    books: Number(count.books),
    populatedChapters: Number(count.populated_chapters),
    verses: Number(count.verses),
    phrases: Number(count.phrases),
    phraseOccurrences: Number(count.phrase_occurrences),
    identitySha256: sha256(JSON.stringify(ordered.rows)),
  };
}

async function captureUnrelatedBundles(client: PoolClient): Promise<string> {
  const result = await client.query<{
    bundle_id: string;
    bundle_type: string | null;
    version: string | null;
    domain: string | null;
    bundle: unknown;
  }>(`
    SELECT bundle_id, bundle_type, version, domain, bundle
    FROM imported_bundles
    WHERE bundle_id NOT IN ($1, 'bibleroot-foundation-v1')
    ORDER BY bundle_id;
  `, [ORIGINAL_LANGUAGE_DATASET_ID]);
  return sha256(JSON.stringify(result.rows));
}

async function insertJsonRows(
  client: PoolClient,
  sql: string,
  rows: unknown[],
): Promise<void> {
  if (rows.length > 0) await client.query(sql, [JSON.stringify(rows)]);
}

export async function importBibleRootOriginalLanguageFoundation(
  options: ImportOriginalLanguageOptions = {},
) {
  const dataset = options.dataset ?? await loadOriginalLanguageDataset();
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const databaseResult = await client.query<{ database_name: string }>(
      "SELECT current_database() AS database_name;",
    );
    const databaseName = databaseResult.rows[0]?.database_name;
    if (databaseName !== "sourceroot_test" && !options.developmentAuthorization) {
      throw new Error(`Original-language import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`);
    }
    if (databaseName !== "sourceroot_test") {
      assertLocalDevelopmentImportAuthorized(
        options.developmentAuthorization,
        databaseName,
      );
    }
    const chunk12Before = await captureChunk12Fingerprint(client);
    const unrelatedBefore = await captureUnrelatedBundles(client);
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM imported_bundles WHERE bundle_id = $1;", [
        ORIGINAL_LANGUAGE_DATASET_ID,
      ]);
      if (options.simulateFailureAfterDatasetDelete) {
        throw new Error("Simulated original-language transactional rollback.");
      }

      await client.query(`
        INSERT INTO imported_bundles(bundle_id, bundle_type, version, domain, bundle)
        VALUES ($1, 'bibleroot-original-language-foundation', $2, 'BibleRoot', $3::jsonb);
      `, [
        dataset.manifest.datasetId,
        dataset.manifest.version,
        JSON.stringify({
          datasetId: dataset.manifest.datasetId,
          version: dataset.manifest.version,
          status: dataset.manifest.status,
          normalizedDatasetSha256: dataset.manifest.normalizedDatasetSha256,
          expectedCounts: dataset.manifest.expectedCounts,
        }),
      ]);

      for (const source of dataset.sourceMetadata.sources) {
        await client.query(`
          INSERT INTO sources(
            source_id, bundle_id, name, source_type, domain, publisher,
            quality_tier, credibility_tier, verification_status, source_class,
            license, license_status, review_status, last_reviewed, url, notes,
            raw_data
          ) VALUES (
            $1, $2, $3, 'primary-original-language-source', 'BibleRoot', $4,
            'primary-source', 'high', 'verified', 'biblical-original-language-source',
            $5, 'component-specific', 'reviewed', $6, $7, $8, $9::jsonb
          );
        `, [
          source.sourceId,
          dataset.manifest.datasetId,
          source.title,
          source.provider,
          "See bibleroot_source_artifact_rights_components.",
          dataset.sourceMetadata.retrievedAt,
          source.repository,
          "Immutable Git-ref source identity; component rights are not collapsed.",
          JSON.stringify(source),
        ]);
        await client.query(`
          INSERT INTO bibleroot_source_publications(
            publication_id, dataset_id, source_id, title, provider,
            stable_identifier, publication_date, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [
          source.publicationId,
          dataset.manifest.datasetId,
          source.sourceId,
          source.title,
          source.provider,
          source.stableIdentifier,
          source.publicationDate,
          source.description,
        ]);
      }

      for (const artifact of dataset.sourceMetadata.artifacts) {
        await client.query(`
          INSERT INTO bibleroot_source_artifacts(
            artifact_id, dataset_id, publication_id, source_id, filename,
            media_type, byte_length, sha256, source_url, retrieval_timestamp,
            rights_status, rights_statement, territorial_limitation, parsing_rules
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
        `, [
          artifact.artifactId,
          dataset.manifest.datasetId,
          artifact.publicationId,
          artifact.sourceId,
          artifact.rawFilename,
          artifact.mediaType,
          artifact.byteLength,
          artifact.sha256,
          artifact.sourceUrl,
          artifact.retrievedAt,
          artifact.rightsStatus,
          artifact.rightsStatement,
          artifact.territorialLimitation,
          artifact.parsingRules,
        ]);
      }

      await insertJsonRows(client, `
        INSERT INTO bibleroot_source_artifact_rights_components(
          component_id, dataset_id, artifact_id, component_type, rights_status,
          license_name, license_url, rights_statement, attribution,
          territorial_limitation, evidence_document
        )
        SELECT x.component_id, $2, x.artifact_id, x.component_type,
          x.rights_status, x.license_name, x.license_url, x.rights_statement,
          x.attribution, x.territorial_limitation, x.evidence_document
        FROM jsonb_to_recordset($1::jsonb) AS x(
          component_id text, artifact_id text, component_type text,
          rights_status text, license_name text, license_url text,
          rights_statement text, attribution text,
          territorial_limitation text, evidence_document text
        );
      `.replace("$2", `'${ORIGINAL_LANGUAGE_DATASET_ID}'`), dataset.rightsComponents.map((component) => ({
        component_id: component.componentId,
        artifact_id: component.artifactId,
        component_type: component.componentType,
        rights_status: component.rightsStatus,
        license_name: component.licenseName,
        license_url: component.licenseUrl,
        rights_statement: component.rightsStatement,
        attribution: component.attribution,
        territorial_limitation: component.territorialLimitation,
        evidence_document: component.evidenceDocument,
      })));

      for (const edition of dataset.editions) {
        await client.query(`
          INSERT INTO bibleroot_original_language_editions(
            original_edition_id, dataset_id, publication_id, language_code,
            display_title, abbreviation, version_identity, immutable_source_ref,
            description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `, [
          edition.editionId,
          dataset.manifest.datasetId,
          edition.publicationId,
          edition.language,
          edition.displayTitle,
          edition.abbreviation,
          edition.versionIdentity,
          edition.immutableSourceRef,
          edition.description,
        ]);
        for (const artifactId of edition.artifactIds) {
          await client.query(`
            INSERT INTO bibleroot_original_language_edition_artifacts(
              original_edition_id, artifact_id, dataset_id
            ) VALUES ($1, $2, $3);
          `, [edition.editionId, artifactId, dataset.manifest.datasetId]);
        }
      }

      await insertJsonRows(client, `
        INSERT INTO bibleroot_original_language_verses(
          source_verse_id, dataset_id, original_edition_id, artifact_id,
          source_book, source_chapter, source_verse_identifier,
          source_native_citation, source_native_versification, surface_text,
          sourceroot_identity
        )
        SELECT x.source_verse_id, '${ORIGINAL_LANGUAGE_DATASET_ID}',
          x.edition_id, x.artifact_id, x.source_book, x.source_chapter,
          x.source_verse_identifier, x.source_native_citation,
          x.source_native_versification, x.surface_text, x.sourceroot_identity
        FROM jsonb_to_recordset($1::jsonb) AS x(
          source_verse_id text, edition_id text, artifact_id text,
          source_book text, source_chapter int, source_verse_identifier text,
          source_native_citation text, source_native_versification text,
          surface_text text, sourceroot_identity text
        );
      `, dataset.verses.map((verse) => ({
        source_verse_id: verse.sourceVerseId,
        edition_id: verse.editionId,
        artifact_id: verse.artifactId,
        source_book: verse.sourceBook,
        source_chapter: verse.sourceChapter,
        source_verse_identifier: verse.sourceVerseIdentifier,
        source_native_citation: verse.sourceNativeCitation,
        source_native_versification: verse.sourceNativeVersification,
        surface_text: verse.surfaceText,
        sourceroot_identity: verse.sourcerootIdentity,
      })));

      await insertJsonRows(client, `
        INSERT INTO bibleroot_original_language_tokens(
          token_id, dataset_id, source_native_token_id, original_edition_id,
          source_verse_id, artifact_id, sequence_position, surface_form
        )
        SELECT x.token_id, '${ORIGINAL_LANGUAGE_DATASET_ID}',
          x.source_native_token_id, x.edition_id, x.source_verse_id,
          x.artifact_id, x.sequence_position, x.surface_form
        FROM jsonb_to_recordset($1::jsonb) AS x(
          token_id text, source_native_token_id text, edition_id text,
          source_verse_id text, artifact_id text, sequence_position int,
          surface_form text
        );
      `, dataset.tokens.map((token) => ({
        token_id: token.tokenId,
        source_native_token_id: token.sourceNativeTokenId,
        edition_id: token.editionId,
        source_verse_id: token.sourceVerseId,
        artifact_id: token.artifactId,
        sequence_position: token.sequencePosition,
        surface_form: token.surfaceForm,
      })));

      await insertJsonRows(client, `
        INSERT INTO bibleroot_original_language_token_lemmas(
          token_id, dataset_id, verbatim_lemma,
          source_native_lemma_identifier, analysis_status, artifact_id
        )
        SELECT x.token_id, '${ORIGINAL_LANGUAGE_DATASET_ID}', x.verbatim_lemma,
          x.source_native_lemma_identifier, x.analysis_status, x.artifact_id
        FROM jsonb_to_recordset($1::jsonb) AS x(
          token_id text, verbatim_lemma text,
          source_native_lemma_identifier text, analysis_status text,
          artifact_id text
        );
      `, dataset.tokens.map((token) => ({
        token_id: token.tokenId,
        verbatim_lemma: token.lemma.verbatim,
        source_native_lemma_identifier: token.lemma.sourceNativeIdentifier,
        analysis_status: token.lemma.analysisStatus,
        artifact_id: token.artifactId,
      })));

      await insertJsonRows(client, `
        INSERT INTO bibleroot_original_language_token_morphologies(
          morphology_id, dataset_id, token_id, morphology_ordinal,
          verbatim_morphology_code, morphology_system, analysis_status,
          artifact_id
        )
        SELECT x.morphology_id, '${ORIGINAL_LANGUAGE_DATASET_ID}', x.token_id,
          x.morphology_ordinal, x.verbatim_morphology_code,
          x.morphology_system, x.analysis_status, x.artifact_id
        FROM jsonb_to_recordset($1::jsonb) AS x(
          morphology_id text, token_id text, morphology_ordinal int,
          verbatim_morphology_code text, morphology_system text,
          analysis_status text, artifact_id text
        );
      `, dataset.tokens.flatMap((token) => token.morphologies.map((morphology, index) => ({
        morphology_id: `${token.tokenId}-morph-${index + 1}`,
        token_id: token.tokenId,
        morphology_ordinal: index + 1,
        verbatim_morphology_code: morphology.verbatimCode,
        morphology_system: morphology.morphologySystem,
        analysis_status: morphology.analysisStatus,
        artifact_id: token.artifactId,
      }))));

      await insertJsonRows(client, `
        INSERT INTO bibleroot_original_language_verse_mappings(
          mapping_id, dataset_id, source_verse_id,
          target_canonical_reference_id, mapping_type, factual_explanation,
          evidence_source, review_status
        )
        SELECT x.mapping_id, '${ORIGINAL_LANGUAGE_DATASET_ID}', x.source_verse_id,
          x.target_canonical_reference_id, x.mapping_type,
          x.factual_explanation, x.evidence_source, x.review_status
        FROM jsonb_to_recordset($1::jsonb) AS x(
          mapping_id text, source_verse_id text,
          target_canonical_reference_id text, mapping_type text,
          factual_explanation text, evidence_source text, review_status text
        );
      `, dataset.mappings.map((mapping) => ({
        mapping_id: mapping.mappingId,
        source_verse_id: mapping.sourceVerseId,
        target_canonical_reference_id: mapping.targetCanonicalReferenceId,
        mapping_type: mapping.mappingType,
        factual_explanation: mapping.explanation,
        evidence_source: mapping.evidenceSource,
        review_status: mapping.reviewStatus,
      })));

      const disconnectedMappings = await client.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM bibleroot_original_language_verse_mappings m
        LEFT JOIN bibleroot_canonical_verses cv
          ON cv.canonical_reference_id = m.target_canonical_reference_id
        WHERE m.dataset_id = $1
          AND m.target_canonical_reference_id IS NOT NULL
          AND cv.canonical_reference_id IS NULL;
      `, [ORIGINAL_LANGUAGE_DATASET_ID]);
      if (disconnectedMappings.rows[0]?.count !== "0") {
        throw new Error("An original-language mapping target is not a protected Chunk 12 canonical verse.");
      }

      const chunk12After = await captureChunk12Fingerprint(client);
      const unrelatedAfter = await captureUnrelatedBundles(client);
      if (JSON.stringify(chunk12Before) !== JSON.stringify(chunk12After)) {
        throw new Error("Protected Chunk 12 fingerprint changed during original-language import.");
      }
      if (unrelatedBefore !== unrelatedAfter) {
        throw new Error("Unrelated imported-bundle fingerprint changed during original-language import.");
      }
      await client.query("COMMIT");
      return {
        datasetId: dataset.manifest.datasetId,
        version: dataset.manifest.version,
        ...dataset.manifest.expectedCounts,
        normalizedDatasetSha256: dataset.manifest.normalizedDatasetSha256,
        chunk12Fingerprint: chunk12After,
        unrelatedBundleFingerprint: unrelatedAfter,
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
  const summary = await importBibleRootOriginalLanguageFoundation();
  console.log("BibleRoot original-language import complete.");
  console.log(JSON.stringify(summary, null, 2));
  await closeDatabase();
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runCli().catch(async (error: unknown) => {
    console.error(error);
    await closeDatabase();
    process.exitCode = 1;
  });
}
