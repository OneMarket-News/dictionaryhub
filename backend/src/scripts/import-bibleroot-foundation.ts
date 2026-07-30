import "dotenv/config";

import { pathToFileURL } from "node:url";

import {
  BIBLEROOT_DATASET_ID,
  type BibleRootFoundationDataset,
  validateBibleRootFoundation,
} from "../bibleroot/foundation.js";
import { closeDatabase, getPool } from "../lib/database.js";

export interface ImportBibleRootOptions {
  dataset?: BibleRootFoundationDataset;
  simulateFailureAfterDatasetDelete?: boolean;
}

export interface BibleRootImportSummary {
  datasetId: string;
  version: string;
  canonId: string;
  editionId: string;
  books: number;
  populatedChapters: number;
  verses: number;
  phrases: number;
  phraseOccurrences: number;
}

export async function importBibleRootFoundation(
  options: ImportBibleRootOptions = {},
): Promise<BibleRootImportSummary> {
  const dataset = await validateBibleRootFoundation(options.dataset);
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();

  try {
    const databaseNameResult = await client.query<{ database_name: string }>(
      "SELECT current_database() AS database_name;",
    );
    const databaseName = databaseNameResult.rows[0]?.database_name;
    if (databaseName !== "sourceroot_test") {
      throw new Error(
        `BibleRoot foundation import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`,
      );
    }

    await client.query("BEGIN");
    try {
      await client.query(
        "DELETE FROM imported_bundles WHERE bundle_id = $1;",
        [BIBLEROOT_DATASET_ID],
      );
      if (options.simulateFailureAfterDatasetDelete) {
        throw new Error("Simulated BibleRoot transactional rollback.");
      }

      const { manifest, sourceMetadata, canon, edition, verses, phrases } =
        dataset;
      const source = sourceMetadata.source;
      const publication = sourceMetadata.publication;

      await client.query(
        `
          INSERT INTO imported_bundles(
            bundle_id, bundle_type, version, domain, bundle
          ) VALUES ($1, $2, $3, $4, $5::jsonb);
        `,
        [
          manifest.datasetId,
          "bibleroot-foundation",
          manifest.version,
          "BibleRoot",
          JSON.stringify({
            datasetId: manifest.datasetId,
            version: manifest.version,
            canonId: manifest.canonId,
            editionId: manifest.editionId,
            sourceId: manifest.sourceId,
            status: manifest.status,
            expectedCounts: manifest.expectedCounts,
            normalizedTextSha256: manifest.normalizedTextSha256,
          }),
        ],
      );

      await client.query(
        `
          INSERT INTO sources(
            source_id, bundle_id, name, source_type, domain, publisher,
            quality_tier, credibility_tier, verification_status, source_class,
            license, license_status, review_status, last_reviewed, url, notes,
            raw_data
          ) VALUES (
            $1, $2, $3, 'primary-text-publication', 'BibleRoot', $4,
            'primary-source', 'high', 'verified', 'biblical-text-source',
            $5, $6, 'reviewed', $7, $8, $9, $10::jsonb
          );
        `,
        [
          source.sourceId,
          manifest.datasetId,
          source.title,
          source.provider,
          source.rightsStatement,
          source.rightsStatus,
          sourceMetadata.source.retrievedAt.slice(0, 10),
          source.catalogUrl,
          "Exact source identity for the BibleRoot foundation alpha.",
          JSON.stringify({
            stableIdentifier: source.stableIdentifier,
            downloadUrl: source.downloadUrl,
            artifactFilename: source.artifactFilename,
            artifactSha256: source.sha256,
            artifactByteLength: source.byteLength,
            rightsStatement: source.rightsStatement,
            territorialLimitation: source.territorialLimitation,
            governanceVisibility: "public",
          }),
        ],
      );

      await client.query(
        `
          INSERT INTO bibleroot_source_publications(
            publication_id, dataset_id, source_id, title, provider,
            stable_identifier, publication_date, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          source.publicationId,
          manifest.datasetId,
          source.sourceId,
          publication.title,
          publication.provider,
          source.stableIdentifier,
          publication.publicationDate,
          publication.description,
        ],
      );

      await client.query(
        `
          INSERT INTO bibleroot_source_artifacts(
            artifact_id, dataset_id, publication_id, source_id, filename,
            media_type, byte_length, sha256, source_url, retrieval_timestamp,
            rights_status, rights_statement, territorial_limitation,
            parsing_rules
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          );
        `,
        [
          source.artifactId,
          manifest.datasetId,
          source.publicationId,
          source.sourceId,
          source.artifactFilename,
          source.mediaType,
          source.byteLength,
          source.sha256,
          source.downloadUrl,
          source.retrievedAt,
          source.rightsStatus,
          source.rightsStatement,
          source.territorialLimitation,
          source.parsingRules,
        ],
      );

      await client.query(
        `
          INSERT INTO bibleroot_editions(
            edition_id, dataset_id, publication_id, artifact_id, display_title,
            abbreviation, language_code, translation_name,
            edition_description, publisher_or_distributor,
            publication_or_release_date, rights_status,
            territorial_limitation, dataset_version, normalized_text_sha256,
            provenance_notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16
          );
        `,
        [
          edition.editionId,
          manifest.datasetId,
          edition.publicationId,
          edition.artifactId,
          edition.displayTitle,
          edition.abbreviation,
          edition.language,
          edition.translationName,
          edition.editionDescription,
          edition.publisherOrDistributor,
          edition.publicationOrReleaseDate,
          edition.rightsStatus,
          edition.territorialLimitation,
          edition.datasetVersion,
          edition.normalizedTextSha256,
          edition.provenanceNotes,
        ],
      );

      await client.query(
        `
          INSERT INTO bibleroot_canons(
            canon_id, dataset_id, display_name, description, scope_note,
            authority_source_id
          ) VALUES ($1, $2, $3, $4, $5, $6);
        `,
        [
          canon.canonId,
          manifest.datasetId,
          canon.displayName,
          canon.description,
          canon.scopeNote,
          canon.authoritySourceId,
        ],
      );

      for (const book of canon.books) {
        await client.query(
          `
            INSERT INTO bibleroot_books(
              book_id, dataset_id, machine_code, display_name, aliases,
              broad_collection, chapter_count, availability_status,
              authority_source_id
            ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9);
          `,
          [
            book.bookId,
            manifest.datasetId,
            book.machineCode,
            book.displayName,
            JSON.stringify(book.aliases),
            book.broadCollection,
            book.chapterCount,
            book.availabilityStatus,
            book.authoritySourceId,
          ],
        );
        await client.query(
          `
            INSERT INTO bibleroot_canon_books(
              canon_id, book_id, canonical_order
            ) VALUES ($1, $2, $3);
          `,
          [canon.canonId, book.bookId, book.canonicalOrder],
        );
      }

      const chapters = new Map(
        verses.map((verse) => [
          verse.chapterId,
          {
            chapterId: verse.chapterId,
            bookId: verse.bookId,
            chapterNumber: verse.chapterNumber,
          },
        ]),
      );
      for (const chapter of chapters.values()) {
        await client.query(
          `
            INSERT INTO bibleroot_chapters(
              chapter_id, dataset_id, book_id, chapter_number,
              availability_status
            ) VALUES ($1, $2, $3, $4, 'text_available');
          `,
          [
            chapter.chapterId,
            manifest.datasetId,
            chapter.bookId,
            chapter.chapterNumber,
          ],
        );
      }

      for (const verse of verses) {
        await client.query(
          `
            INSERT INTO bibleroot_canonical_verses(
              canonical_reference_id, dataset_id, chapter_id, book_id,
              chapter_number, verse_number
            ) VALUES ($1, $2, $3, $4, $5, $6);
          `,
          [
            verse.canonicalReferenceId,
            manifest.datasetId,
            verse.chapterId,
            verse.bookId,
            verse.chapterNumber,
            verse.verseNumber,
          ],
        );
        await client.query(
          `
            INSERT INTO bibleroot_verse_texts(
              edition_text_id, dataset_id, canonical_reference_id,
              edition_id, artifact_id, exact_text, source_observation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7);
          `,
          [
            verse.editionTextId,
            manifest.datasetId,
            verse.canonicalReferenceId,
            edition.editionId,
            edition.artifactId,
            verse.exactText,
            "Exact edition text extracted from the identified source artifact.",
          ],
        );
      }

      for (const phrase of phrases) {
        await client.query(
          `
            INSERT INTO bibleroot_phrases(
              phrase_id, dataset_id, edition_id, display_text,
              normalized_lookup_text, provenance_note
            ) VALUES ($1, $2, $3, $4, $5, $6);
          `,
          [
            phrase.phraseId,
            manifest.datasetId,
            phrase.editionId,
            phrase.displayText,
            phrase.normalizedLookupText,
            phrase.provenanceNote,
          ],
        );
        for (const occurrence of phrase.occurrences) {
          await client.query(
            `
              INSERT INTO bibleroot_phrase_occurrences(
                occurrence_id, dataset_id, phrase_id, edition_text_id,
                start_offset, end_offset, exact_text
              ) VALUES ($1, $2, $3, $4, $5, $6, $7);
            `,
            [
              occurrence.occurrenceId,
              manifest.datasetId,
              phrase.phraseId,
              occurrence.editionTextId,
              occurrence.startOffset,
              occurrence.endOffset,
              occurrence.exactText,
            ],
          );
        }
      }

      await client.query("COMMIT");
      return {
        datasetId: manifest.datasetId,
        version: manifest.version,
        canonId: canon.canonId,
        editionId: edition.editionId,
        books: canon.books.length,
        populatedChapters: chapters.size,
        verses: verses.length,
        phrases: phrases.length,
        phraseOccurrences: phrases.reduce(
          (sum, phrase) => sum + phrase.occurrences.length,
          0,
        ),
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
  const summary = await importBibleRootFoundation();
  console.log("BibleRoot foundation import complete.");
  console.log(JSON.stringify(summary, null, 2));
  await closeDatabase();
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : "";
if (import.meta.url === invokedPath) {
  runCli().catch(async (error: unknown) => {
    console.error(error);
    await closeDatabase();
    process.exitCode = 1;
  });
}
