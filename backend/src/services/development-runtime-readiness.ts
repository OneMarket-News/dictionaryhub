import {
  BIBLEROOT_DATASET_ID,
  BIBLEROOT_DATASET_VERSION,
} from "../bibleroot/foundation.js";
import {
  ORIGINAL_LANGUAGE_DATASET_ID,
  ORIGINAL_LANGUAGE_DATASET_VERSION,
} from "../bibleroot/original-languages.js";
import {
  TRANSLATION_COMPARISON_DATASET_ID,
  TRANSLATION_COMPARISON_DATASET_VERSION,
} from "../bibleroot/translation-comparison.js";
import {
  COMMENTARY_DATASET_ID,
  COMMENTARY_DATASET_VERSION,
} from "../bibleroot/commentary-provenance.js";
import {
  CORE_LEXICAL_CORPUS_ID,
  CORE_LEXICAL_CORPUS_VERSION,
} from "../dictionaryroot/core-lexical-corpus.js";
import { getPool } from "../lib/database.js";

export interface RuntimeRootReadiness {
  ready: boolean;
  status: "ready" | "awaiting-data";
  datasetIds: string[];
  counts: Record<string, number>;
}

export interface DevelopmentRuntimeReadiness {
  contractVersion: "1.2.0";
  roots: {
    DictionaryRoot: RuntimeRootReadiness;
    HistoryRoot: RuntimeRootReadiness;
    BibleRoot: RuntimeRootReadiness & {
      foundationReady: boolean;
      originalLanguageReady: boolean;
      translationComparisonReady: boolean;
      commentaryProvenanceReady: boolean;
    };
  };
}

interface CountRow {
  dictionary_dataset: number;
  dictionary_sources: number;
  dictionary_lemmas: number;
  dictionary_senses: number;
  dictionary_claims: number;
  dictionary_relationships: number;
  dictionary_relationship_evidence: number;
  bible_dataset: number;
  bible_canons: number;
  bible_books: number;
  bible_chapters: number;
  bible_verses: number;
  bible_phrases: number;
  bible_phrase_occurrences: number;
  bible_artifact: number;
  original_dataset: number;
  original_editions: number;
  original_artifacts: number;
  original_verses: number;
  original_tokens: number;
  original_lemmas: number;
  original_morphologies: number;
  original_mappings: number;
  comparison_dataset: number;
  comparison_editions: number;
  comparison_artifacts: number;
  comparison_rights: number;
  comparison_verses: number;
  commentary_dataset: number;
  commentary_works: number;
  commentary_sections: number;
  commentary_statements: number;
  commentary_anchors: number;
  commentary_artifacts: number;
  commentary_rights: number;
  history_bundles: number;
  history_records: number;
}

export async function getDevelopmentRuntimeReadiness(): Promise<DevelopmentRuntimeReadiness> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const result = await pool.query<CountRow>(`
    SELECT
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}' AND version = '${CORE_LEXICAL_CORPUS_VERSION}' AND status = 'accepted' AND fixture_only = false) AS dictionary_dataset,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_evidence_sources WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_sources,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_lemmas WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_lemmas,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_senses WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_senses,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_definition_claims WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_claims,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_relationships WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_relationships,
      (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_relationship_evidence WHERE dataset_id = '${CORE_LEXICAL_CORPUS_ID}') AS dictionary_relationship_evidence,
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = '${BIBLEROOT_DATASET_ID}' AND version = '${BIBLEROOT_DATASET_VERSION}') AS bible_dataset,
      (SELECT COUNT(*)::integer FROM bibleroot_canons WHERE dataset_id = '${BIBLEROOT_DATASET_ID}') AS bible_canons,
      (SELECT COUNT(*)::integer FROM bibleroot_books WHERE dataset_id = '${BIBLEROOT_DATASET_ID}') AS bible_books,
      (SELECT COUNT(*)::integer FROM bibleroot_chapters WHERE dataset_id = '${BIBLEROOT_DATASET_ID}' AND availability_status = 'text_available') AS bible_chapters,
      (SELECT COUNT(*)::integer FROM bibleroot_verse_texts WHERE dataset_id = '${BIBLEROOT_DATASET_ID}') AS bible_verses,
      (SELECT COUNT(*)::integer FROM bibleroot_phrases WHERE dataset_id = '${BIBLEROOT_DATASET_ID}') AS bible_phrases,
      (SELECT COUNT(*)::integer FROM bibleroot_phrase_occurrences WHERE dataset_id = '${BIBLEROOT_DATASET_ID}') AS bible_phrase_occurrences,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = '${BIBLEROOT_DATASET_ID}' AND byte_length = 4436268 AND sha256 = '0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986') AS bible_artifact,
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = '${ORIGINAL_LANGUAGE_DATASET_ID}' AND version = '${ORIGINAL_LANGUAGE_DATASET_VERSION}') AS original_dataset,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_editions WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_editions,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_artifacts,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_verses WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_verses,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_tokens WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_tokens,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_token_lemmas WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_lemmas,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_token_morphologies WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_morphologies,
      (SELECT COUNT(*)::integer FROM bibleroot_original_language_verse_mappings WHERE dataset_id = '${ORIGINAL_LANGUAGE_DATASET_ID}') AS original_mappings,
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = '${TRANSLATION_COMPARISON_DATASET_ID}' AND version = '${TRANSLATION_COMPARISON_DATASET_VERSION}') AS comparison_dataset,
      (SELECT COUNT(*)::integer FROM bibleroot_editions WHERE dataset_id = '${TRANSLATION_COMPARISON_DATASET_ID}') AS comparison_editions,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = '${TRANSLATION_COMPARISON_DATASET_ID}') AS comparison_artifacts,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifact_rights_components WHERE dataset_id = '${TRANSLATION_COMPARISON_DATASET_ID}') AS comparison_rights,
      (SELECT COUNT(*)::integer FROM bibleroot_verse_texts WHERE dataset_id = '${TRANSLATION_COMPARISON_DATASET_ID}') AS comparison_verses,
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id = '${COMMENTARY_DATASET_ID}' AND version = '${COMMENTARY_DATASET_VERSION}') AS commentary_dataset,
      (SELECT COUNT(*)::integer FROM bibleroot_commentary_works WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_works,
      (SELECT COUNT(*)::integer FROM bibleroot_commentary_sections WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_sections,
      (SELECT COUNT(*)::integer FROM bibleroot_commentary_statements WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_statements,
      (SELECT COUNT(*)::integer FROM bibleroot_commentary_section_anchors WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_anchors,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifacts WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_artifacts,
      (SELECT COUNT(*)::integer FROM bibleroot_source_artifact_rights_components WHERE dataset_id = '${COMMENTARY_DATASET_ID}') AS commentary_rights,
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE domain = 'HistoryRoot') AS history_bundles,
      (SELECT COUNT(*)::integer FROM context_records WHERE domain = 'HistoryRoot') AS history_records;
  `);
  const row = result.rows[0]!;
  const dictionaryCounts = {
    datasets: row.dictionary_dataset,
    sources: row.dictionary_sources,
    lemmas: row.dictionary_lemmas,
    senses: row.dictionary_senses,
    definitionClaims: row.dictionary_claims,
    relationships: row.dictionary_relationships,
    relationshipEvidence: row.dictionary_relationship_evidence,
  };
  const dictionaryReady = JSON.stringify(Object.values(dictionaryCounts))
    === JSON.stringify([1, 17, 500, 1014, 1145, 722, 722]);
  const foundationCounts = {
    datasets: row.bible_dataset,
    canons: row.bible_canons,
    books: row.bible_books,
    populatedChapters: row.bible_chapters,
    verses: row.bible_verses,
    phrases: row.bible_phrases,
    phraseOccurrences: row.bible_phrase_occurrences,
    acceptedArtifacts: row.bible_artifact,
  };
  const foundationReady = JSON.stringify(Object.values(foundationCounts))
    === JSON.stringify([1, 1, 66, 4, 110, 9, 13, 1]);
  const originalCounts = {
    datasets: row.original_dataset,
    editions: row.original_editions,
    sourceArtifacts: row.original_artifacts,
    sourceVerses: row.original_verses,
    tokens: row.original_tokens,
    lemmas: row.original_lemmas,
    morphologies: row.original_morphologies,
    mappings: row.original_mappings,
  };
  const originalLanguageReady = JSON.stringify(Object.values(originalCounts))
    === JSON.stringify([1, 2, 4, 111, 1592, 1592, 2420, 111]);
  const comparisonCounts = {
    datasets: row.comparison_dataset,
    editions: row.comparison_editions,
    sourceArtifacts: row.comparison_artifacts,
    rightsRecords: row.comparison_rights,
    verseTexts: row.comparison_verses,
  };
  const translationComparisonReady = JSON.stringify(Object.values(comparisonCounts))
    === JSON.stringify([1, 3, 3, 3, 330]);
  const commentaryCounts = {
    datasets: row.commentary_dataset,
    works: row.commentary_works,
    sections: row.commentary_sections,
    statements: row.commentary_statements,
    anchors: row.commentary_anchors,
    sourceArtifacts: row.commentary_artifacts,
    rightsRecords: row.commentary_rights,
  };
  const commentaryProvenanceReady = JSON.stringify(Object.values(commentaryCounts))
    === JSON.stringify([1, 2, 96, 3450, 96, 2, 2]);
  const historyCounts = {
    bundles: row.history_bundles,
    contextRecords: row.history_records,
  };
  const historyReady = row.history_bundles > 0 && row.history_records > 0;
  return {
    contractVersion: "1.2.0",
    roots: {
      DictionaryRoot: {
        ready: dictionaryReady,
        status: dictionaryReady ? "ready" : "awaiting-data",
        datasetIds: [CORE_LEXICAL_CORPUS_ID],
        counts: dictionaryCounts,
      },
      HistoryRoot: {
        ready: historyReady,
        status: historyReady ? "ready" : "awaiting-data",
        datasetIds: [],
        counts: historyCounts,
      },
      BibleRoot: {
        ready: foundationReady && originalLanguageReady,
        status: foundationReady && originalLanguageReady ? "ready" : "awaiting-data",
        datasetIds: commentaryProvenanceReady
          ? [BIBLEROOT_DATASET_ID, ORIGINAL_LANGUAGE_DATASET_ID, TRANSLATION_COMPARISON_DATASET_ID, COMMENTARY_DATASET_ID]
          : translationComparisonReady
            ? [BIBLEROOT_DATASET_ID, ORIGINAL_LANGUAGE_DATASET_ID, TRANSLATION_COMPARISON_DATASET_ID]
          : [BIBLEROOT_DATASET_ID, ORIGINAL_LANGUAGE_DATASET_ID],
        counts: {
          ...foundationCounts,
          ...Object.fromEntries(Object.entries(originalCounts).map(([key, value]) => [`original${key[0]!.toUpperCase()}${key.slice(1)}`, value])),
          ...Object.fromEntries(Object.entries(comparisonCounts).map(([key, value]) => [`translationComparison${key[0]!.toUpperCase()}${key.slice(1)}`, value])),
          ...Object.fromEntries(Object.entries(commentaryCounts).map(([key, value]) => [`commentary${key[0]!.toUpperCase()}${key.slice(1)}`, value])),
        },
        foundationReady,
        originalLanguageReady,
        translationComparisonReady,
        commentaryProvenanceReady,
      },
    },
  };
}
