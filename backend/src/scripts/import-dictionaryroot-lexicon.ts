import "dotenv/config";

import path from "node:path";

import {
  DICTIONARYROOT_OEWN_SOURCE_ID,
  describeWordNetRelation,
  dictionaryRootLexicalRelationId,
  dictionaryRootNodeId,
  dictionaryRootPosLabel,
  loadWordNetSynsets,
  type WordNetSynset,
} from "../dictionaryroot/oewn-wndb.js";
import { closeDatabase, getPool } from "../lib/database.js";

interface CliOptions {
  sourceDir: string;
  sourceVersion: string;
  datasetId: string;
  bundleId: string;
  batchSize: number;
}

interface SynsetImportRecord {
  node_id: string;
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  source_version: string;
  source_synset_key: string;
  source_offset: string;
  part_of_speech: string;
  title: string;
  definition: string;
  synset_type: string;
  lexicographer_file_number: number;
  lemmas: string[];
  normalized_lemmas: string[];
  examples: string[];
  original_gloss: string;
}

interface RelationImportRecord {
  relation_id: string;
  dataset_id: string;
  bundle_id: string;
  source_id: string;
  from_node_id: string;
  to_node_id: string;
  pointer_symbol: string;
  source_target: string;
  relationship_type: string;
  label: string;
  relationship_strength: string;
  summary: string;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseOptions(): CliOptions {
  const sourceDir = argumentValue("source-dir");
  if (!sourceDir) throw new Error("--source-dir is required.");
  const sourceVersion = argumentValue("source-version") ?? "2025";
  const datasetId = argumentValue("dataset-id") ?? `dictionaryroot-oewn-${sourceVersion}-complete`;
  const bundleId = argumentValue("bundle-id") ?? "dictionaryroot-oewn-2025-pilot-500";
  const rawBatchSize = Number(argumentValue("batch-size") ?? "1000");
  if (!Number.isInteger(rawBatchSize) || rawBatchSize < 100 || rawBatchSize > 5000) {
    throw new Error("--batch-size must be an integer from 100 to 5000.");
  }
  return {
    sourceDir: path.resolve(sourceDir),
    sourceVersion,
    datasetId,
    bundleId,
    batchSize: rawBatchSize,
  };
}

function normalizeLemma(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

function synsetRecord(synset: WordNetSynset, options: CliOptions): SynsetImportRecord {
  const partOfSpeech = dictionaryRootPosLabel(synset.filePos);
  return {
    node_id: dictionaryRootNodeId(synset),
    dataset_id: options.datasetId,
    bundle_id: options.bundleId,
    source_id: DICTIONARYROOT_OEWN_SOURCE_ID,
    source_version: options.sourceVersion,
    source_synset_key: synset.key,
    source_offset: synset.offset,
    part_of_speech: partOfSpeech,
    title: synset.lemmas[0] ?? `${partOfSpeech} ${synset.offset}`,
    definition: synset.definition,
    synset_type: synset.synsetType,
    lexicographer_file_number: synset.lexFileNumber,
    lemmas: synset.lemmas,
    normalized_lemmas: Array.from(new Set(synset.lemmas.map(normalizeLemma).filter(Boolean))),
    examples: synset.examples,
    original_gloss: synset.originalGloss,
  };
}

async function insertSynsetBatch(
  client: import("pg").PoolClient,
  records: SynsetImportRecord[],
): Promise<void> {
  if (!records.length) return;
  await client.query(
    `
      WITH records AS (
        SELECT *
        FROM JSONB_TO_RECORDSET($1::JSONB) AS item(
          node_id TEXT,
          dataset_id TEXT,
          bundle_id TEXT,
          source_id TEXT,
          source_version TEXT,
          source_synset_key TEXT,
          source_offset TEXT,
          part_of_speech TEXT,
          title TEXT,
          definition TEXT,
          synset_type TEXT,
          lexicographer_file_number INTEGER,
          lemmas JSONB,
          normalized_lemmas JSONB,
          examples JSONB,
          original_gloss TEXT
        )
      )
      INSERT INTO dictionaryroot_lexicon_synsets (
        node_id,
        dataset_id,
        bundle_id,
        source_id,
        source_version,
        source_synset_key,
        source_offset,
        part_of_speech,
        title,
        definition,
        synset_type,
        lexicographer_file_number,
        lemmas,
        normalized_lemmas,
        examples,
        original_gloss
      )
      SELECT
        node_id,
        dataset_id,
        bundle_id,
        source_id,
        source_version,
        source_synset_key,
        source_offset,
        part_of_speech,
        title,
        definition,
        synset_type,
        lexicographer_file_number,
        ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(lemmas)),
        ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(normalized_lemmas)),
        ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(examples)),
        original_gloss
      FROM records;
    `,
    [JSON.stringify(records)],
  );
}

async function insertRelationBatch(
  client: import("pg").PoolClient,
  records: RelationImportRecord[],
): Promise<number> {
  if (!records.length) return 0;
  const result = await client.query(
    `
      INSERT INTO dictionaryroot_lexicon_relations (
        relation_id,
        dataset_id,
        bundle_id,
        source_id,
        from_node_id,
        to_node_id,
        pointer_symbol,
        source_target,
        relationship_type,
        label,
        relationship_strength,
        summary
      )
      SELECT
        relation_id,
        dataset_id,
        bundle_id,
        source_id,
        from_node_id,
        to_node_id,
        pointer_symbol,
        source_target,
        relationship_type,
        label,
        relationship_strength,
        summary
      FROM JSONB_TO_RECORDSET($1::JSONB) AS item(
        relation_id TEXT,
        dataset_id TEXT,
        bundle_id TEXT,
        source_id TEXT,
        from_node_id TEXT,
        to_node_id TEXT,
        pointer_symbol TEXT,
        source_target TEXT,
        relationship_type TEXT,
        label TEXT,
        relationship_strength TEXT,
        summary TEXT
      )
      ON CONFLICT (relation_id) DO NOTHING;
    `,
    [JSON.stringify(records)],
  );
  return result.rowCount ?? 0;
}

async function importLexicon(): Promise<void> {
  const options = parseOptions();
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is not configured. Confirm backend/.env before importing.");
  }

  console.log(`Loading Open English WordNet from ${options.sourceDir}...`);
  const synsets = await loadWordNetSynsets(options.sourceDir);
  const byKey = new Map(synsets.map((synset) => [synset.key, synset]));
  const lemmas = new Set<string>();
  const partOfSpeechCounts: Record<string, number> = {};
  for (const synset of synsets) {
    const partOfSpeech = dictionaryRootPosLabel(synset.filePos);
    partOfSpeechCounts[partOfSpeech] = (partOfSpeechCounts[partOfSpeech] ?? 0) + 1;
    synset.lemmas.map(normalizeLemma).filter(Boolean).forEach((lemma) => lemmas.add(lemma));
  }

  const client = await pool.connect();
  const startedAt = performance.now();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL synchronous_commit = OFF");
    await client.query("DELETE FROM dictionaryroot_lexicon_datasets WHERE dataset_id = $1", [options.datasetId]);
    await client.query(
      `
        INSERT INTO dictionaryroot_lexicon_datasets (
          dataset_id,
          bundle_id,
          source_id,
          source_name,
          source_version,
          source_license,
          synset_count,
          lemma_count,
          relation_count,
          part_of_speech_counts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9::JSONB);
      `,
      [
        options.datasetId,
        options.bundleId,
        DICTIONARYROOT_OEWN_SOURCE_ID,
        "Open English WordNet",
        options.sourceVersion,
        "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        synsets.length,
        lemmas.size,
        JSON.stringify(partOfSpeechCounts),
      ],
    );

    for (let index = 0; index < synsets.length; index += options.batchSize) {
      const batch = synsets.slice(index, index + options.batchSize).map((synset) => synsetRecord(synset, options));
      await insertSynsetBatch(client, batch);
      console.log(`Imported synsets: ${Math.min(index + batch.length, synsets.length)}/${synsets.length}`);
    }

    let relationCount = 0;
    let relationBatch: RelationImportRecord[] = [];
    for (const sourceSynset of synsets) {
      for (const pointer of sourceSynset.pointers) {
        const target = byKey.get(`${pointer.targetPos}:${pointer.targetOffset}`);
        if (!target) continue;
        const descriptor = describeWordNetRelation(pointer.symbol);
        const sourceTitle = sourceSynset.lemmas[0] ?? sourceSynset.key;
        const targetTitle = target.lemmas[0] ?? target.key;
        relationBatch.push({
          relation_id: dictionaryRootLexicalRelationId(sourceSynset, pointer),
          dataset_id: options.datasetId,
          bundle_id: options.bundleId,
          source_id: DICTIONARYROOT_OEWN_SOURCE_ID,
          from_node_id: dictionaryRootNodeId(sourceSynset),
          to_node_id: dictionaryRootNodeId(target),
          pointer_symbol: pointer.symbol,
          source_target: pointer.sourceTarget,
          relationship_type: descriptor.relationshipType,
          label: descriptor.label,
          relationship_strength: descriptor.strength,
          summary: `${sourceTitle} has the Open English WordNet relationship ${descriptor.label.toLowerCase()} with ${targetTitle}.`,
        });

        if (relationBatch.length >= options.batchSize) {
          relationCount += await insertRelationBatch(client, relationBatch);
          relationBatch = [];
          console.log(`Imported relations: ${relationCount}`);
        }
      }
    }
    relationCount += await insertRelationBatch(client, relationBatch);

    await client.query(
      `
        UPDATE dictionaryroot_lexicon_datasets
        SET relation_count = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE dataset_id = $1;
      `,
      [options.datasetId, relationCount],
    );
    await client.query("COMMIT");

    const durationSeconds = Math.round((performance.now() - startedAt) / 100) / 10;
    console.log("");
    console.log("DictionaryRoot complete lexical index imported.");
    console.log(`Dataset ID: ${options.datasetId}`);
    console.log(`Stable bundle ID: ${options.bundleId}`);
    console.log(`Synsets: ${synsets.length}`);
    console.log(`Unique lemmas: ${lemmas.size}`);
    console.log(`Relations: ${relationCount}`);
    console.log(`Duration: ${durationSeconds} seconds`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
}

importLexicon().catch((error: unknown) => {
  console.error("DictionaryRoot lexicon import failed:", error);
  process.exitCode = 1;
});
