import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SourceRootBundle } from "../types.js";

export type WordNetFilePos = "n" | "v" | "a" | "r";

export interface WordNetPointer {
  symbol: string;
  targetOffset: string;
  targetPos: WordNetFilePos;
  sourceTarget: string;
}

export interface WordNetSynset {
  key: string;
  offset: string;
  filePos: WordNetFilePos;
  synsetType: string;
  lexFileNumber: number;
  lemmas: string[];
  pointers: WordNetPointer[];
  definition: string;
  examples: string[];
  originalGloss: string;
}

export interface DictionaryRootPilotOptions {
  limit: number;
  sourceVersion?: string;
  bundleId?: string;
  createdAt?: string;
  seeds?: string[];
}

interface SourceRootRecord {
  [key: string]: unknown;
}

interface RelationDescriptor {
  relationshipType: string;
  label: string;
  strength: "core" | "strong" | "medium" | "weak" | "contextual" | "experimental";
}

const SOURCE_ID = "source-oewn-2025";
const DOMAIN = "DictionaryRoot";

const FILE_NAMES: Record<WordNetFilePos, string> = {
  n: "data.noun",
  v: "data.verb",
  a: "data.adj",
  r: "data.adv",
};

const DEFAULT_SEEDS = [
  "knowledge", "truth", "source", "meaning", "word", "language", "dictionary",
  "definition", "concept", "idea", "information", "evidence", "reason", "logic",
  "memory", "learning", "understanding", "wisdom", "belief", "fact", "claim",
  "identity", "relation", "history", "time", "change", "cause", "effect", "person",
  "community", "society", "culture", "law", "science", "technology", "engineering",
  "computer", "network", "system", "data", "book", "writing", "speech", "symbol",
  "number", "space", "matter", "energy", "life", "human", "animal", "plant",
  "earth", "water", "fire", "air", "light", "dark", "good", "bad", "right",
  "wrong", "large", "small", "fast", "slow", "create", "build", "make", "use",
  "move", "think", "know", "see", "hear", "speak", "read", "write", "work",
  "connect", "compare", "explain", "verify", "record", "preserve", "change",
];

const RELATIONS: Record<string, RelationDescriptor> = {
  "!": { relationshipType: "ANTONYM_OF", label: "Antonym", strength: "strong" },
  "@": { relationshipType: "HAS_HYPERNYM", label: "Hypernym", strength: "core" },
  "@i": { relationshipType: "HAS_INSTANCE_HYPERNYM", label: "Instance Hypernym", strength: "core" },
  "~": { relationshipType: "HAS_HYPONYM", label: "Hyponym", strength: "core" },
  "~i": { relationshipType: "HAS_INSTANCE_HYPONYM", label: "Instance Hyponym", strength: "core" },
  "#m": { relationshipType: "HAS_MEMBER_HOLONYM", label: "Member Holonym", strength: "strong" },
  "#s": { relationshipType: "HAS_SUBSTANCE_HOLONYM", label: "Substance Holonym", strength: "strong" },
  "#p": { relationshipType: "HAS_PART_HOLONYM", label: "Part Holonym", strength: "strong" },
  "%m": { relationshipType: "HAS_MEMBER_MERONYM", label: "Member Meronym", strength: "strong" },
  "%s": { relationshipType: "HAS_SUBSTANCE_MERONYM", label: "Substance Meronym", strength: "strong" },
  "%p": { relationshipType: "HAS_PART_MERONYM", label: "Part Meronym", strength: "strong" },
  "=": { relationshipType: "HAS_ATTRIBUTE", label: "Attribute", strength: "strong" },
  "+": { relationshipType: "DERIVATIONALLY_RELATED_TO", label: "Derivationally Related", strength: "contextual" },
  ";c": { relationshipType: "HAS_TOPIC_DOMAIN", label: "Topic Domain", strength: "medium" },
  "-c": { relationshipType: "MEMBER_OF_TOPIC_DOMAIN", label: "Topic Domain Member", strength: "medium" },
  ";r": { relationshipType: "HAS_REGION_DOMAIN", label: "Region Domain", strength: "medium" },
  "-r": { relationshipType: "MEMBER_OF_REGION_DOMAIN", label: "Region Domain Member", strength: "medium" },
  ";u": { relationshipType: "HAS_USAGE_DOMAIN", label: "Usage Domain", strength: "medium" },
  "-u": { relationshipType: "MEMBER_OF_USAGE_DOMAIN", label: "Usage Domain Member", strength: "medium" },
  "*": { relationshipType: "ENTAILS", label: "Entailment", strength: "strong" },
  ">": { relationshipType: "CAUSES", label: "Cause", strength: "strong" },
  "^": { relationshipType: "ALSO_SEE", label: "Also See", strength: "contextual" },
  "$": { relationshipType: "VERB_GROUP", label: "Verb Group", strength: "strong" },
  "&": { relationshipType: "SIMILAR_TO", label: "Similar To", strength: "strong" },
  "<": { relationshipType: "PARTICIPLE_OF", label: "Participle Of", strength: "strong" },
  "\\": { relationshipType: "PERTAINS_TO", label: "Pertains To", strength: "strong" },
};

function normalizeFilePos(pos: string): WordNetFilePos | null {
  if (pos === "s") {
    return "a";
  }

  return pos === "n" || pos === "v" || pos === "a" || pos === "r"
    ? pos
    : null;
}

function normalizeLemma(value: string): string {
  return value
    .replace(/_(?=.)/g, " ")
    .replace(/\((?:a|p|ip)\)$/u, "")
    .trim();
}

function parseGloss(gloss: string): {
  definition: string;
  examples: string[];
} {
  const examples: string[] = [];
  const quotePattern = /[“"]([^”"]+)[”"]/gu;
  let match: RegExpExecArray | null;

  while ((match = quotePattern.exec(gloss)) !== null) {
    const example = match[1]?.trim();
    if (example) {
      examples.push(example);
    }
  }

  const definition = gloss
    .replace(quotePattern, "")
    .replace(/\s*;\s*;+/gu, "; ")
    .replace(/^[;\s]+|[;\s]+$/gu, "")
    .trim();

  return {
    definition: definition || gloss.trim(),
    examples,
  };
}

export function parseWordNetDataLine(
  line: string,
  filePos: WordNetFilePos,
): WordNetSynset | null {
  if (!/^\d{8}\s/u.test(line)) {
    return null;
  }

  const separatorIndex = line.indexOf("|");
  if (separatorIndex < 0) {
    throw new Error(`WordNet data line is missing a gloss separator: ${line}`);
  }

  const header = line.slice(0, separatorIndex).trim();
  const originalGloss = line.slice(separatorIndex + 1).trim();
  const tokens = header.split(/\s+/u);

  const offset = tokens[0];
  const lexFileToken = tokens[1];
  const synsetType = tokens[2];
  const wordCountToken = tokens[3];

  if (!offset || !lexFileToken || !synsetType || !wordCountToken) {
    throw new Error(`WordNet data line is incomplete: ${line}`);
  }

  const lexFileNumber = Number.parseInt(lexFileToken, 10);
  const wordCount = Number.parseInt(wordCountToken, 16);

  if (!Number.isFinite(lexFileNumber) || !Number.isFinite(wordCount)) {
    throw new Error(`WordNet data line has invalid numeric fields: ${line}`);
  }

  let cursor = 4;
  const lemmas: string[] = [];

  for (let index = 0; index < wordCount; index += 1) {
    const lemmaToken = tokens[cursor];
    const lexIdToken = tokens[cursor + 1];

    if (!lemmaToken || !lexIdToken) {
      throw new Error(`WordNet data line ended while reading words: ${line}`);
    }

    lemmas.push(normalizeLemma(lemmaToken));
    cursor += 2;
  }

  const pointerCountToken = tokens[cursor];
  if (!pointerCountToken) {
    throw new Error(`WordNet data line is missing pointer count: ${line}`);
  }

  const pointerCount = Number.parseInt(pointerCountToken, 10);
  if (!Number.isFinite(pointerCount)) {
    throw new Error(`WordNet data line has invalid pointer count: ${line}`);
  }

  cursor += 1;
  const pointers: WordNetPointer[] = [];

  for (let index = 0; index < pointerCount; index += 1) {
    const symbol = tokens[cursor];
    const targetOffset = tokens[cursor + 1];
    const rawTargetPos = tokens[cursor + 2];
    const sourceTarget = tokens[cursor + 3];
    const targetPos = rawTargetPos ? normalizeFilePos(rawTargetPos) : null;

    if (!symbol || !targetOffset || !targetPos || !sourceTarget) {
      throw new Error(`WordNet data line ended while reading pointers: ${line}`);
    }

    pointers.push({
      symbol,
      targetOffset,
      targetPos,
      sourceTarget,
    });

    cursor += 4;
  }

  const parsedGloss = parseGloss(originalGloss);

  return {
    key: `${filePos}:${offset}`,
    offset,
    filePos,
    synsetType,
    lexFileNumber,
    lemmas,
    pointers,
    definition: parsedGloss.definition,
    examples: parsedGloss.examples,
    originalGloss,
  };
}

async function directoryContainsWordNetFiles(directory: string): Promise<boolean> {
  try {
    const entries = new Set(await readdir(directory));
    return Object.values(FILE_NAMES).every((fileName) => entries.has(fileName));
  } catch {
    return false;
  }
}

export async function findWordNetDirectory(root: string): Promise<string> {
  const resolvedRoot = path.resolve(root);
  const queue: Array<{ directory: string; depth: number }> = [
    { directory: resolvedRoot, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (await directoryContainsWordNetFiles(current.directory)) {
      return current.directory;
    }

    if (current.depth >= 4) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push({
          directory: path.join(current.directory, entry.name),
          depth: current.depth + 1,
        });
      }
    }
  }

  throw new Error(
    `Could not find data.noun, data.verb, data.adj, and data.adv below ${resolvedRoot}.`,
  );
}

export async function loadWordNetSynsets(root: string): Promise<WordNetSynset[]> {
  const directory = await findWordNetDirectory(root);
  const synsets: WordNetSynset[] = [];

  for (const filePos of ["n", "v", "a", "r"] as const) {
    const filePath = path.join(directory, FILE_NAMES[filePos]);
    const contents = await readFile(filePath, "utf8");

    for (const line of contents.split(/\r?\n/u)) {
      const synset = parseWordNetDataLine(line, filePos);
      if (synset) {
        synsets.push(synset);
      }
    }
  }

  return synsets;
}

function buildLemmaIndex(synsets: WordNetSynset[]): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const synset of synsets) {
    for (const lemma of synset.lemmas) {
      const key = lemma.toLowerCase();
      const existing = index.get(key) ?? [];
      existing.push(synset.key);
      index.set(key, existing);
    }
  }

  return index;
}

function selectSynsets(
  synsets: WordNetSynset[],
  limit: number,
  seeds: string[],
): WordNetSynset[] {
  const byKey = new Map(synsets.map((synset) => [synset.key, synset]));
  const lemmaIndex = buildLemmaIndex(synsets);
  const selected = new Map<string, WordNetSynset>();
  const queue: string[] = [];
  const queued = new Set<string>();

  const enqueue = (key: string): void => {
    if (!selected.has(key) && !queued.has(key) && byKey.has(key)) {
      queue.push(key);
      queued.add(key);
    }
  };

  for (const seed of seeds) {
    for (const key of lemmaIndex.get(seed.toLowerCase()) ?? []) {
      enqueue(key);
    }
  }

  while (queue.length > 0 && selected.size < limit) {
    const key = queue.shift();
    if (!key) {
      continue;
    }

    queued.delete(key);
    const synset = byKey.get(key);
    if (!synset || selected.has(key)) {
      continue;
    }

    selected.set(key, synset);

    for (const pointer of synset.pointers) {
      enqueue(`${pointer.targetPos}:${pointer.targetOffset}`);
    }
  }

  if (selected.size < limit) {
    const byPos = new Map<WordNetFilePos, WordNetSynset[]>([
      ["n", []], ["v", []], ["a", []], ["r", []],
    ]);

    for (const synset of synsets) {
      byPos.get(synset.filePos)?.push(synset);
    }

    let cursor = 0;
    const positions: WordNetFilePos[] = ["n", "v", "a", "r"];

    while (selected.size < limit) {
      let added = false;

      for (const position of positions) {
        const candidate = byPos.get(position)?.[cursor];
        if (candidate && !selected.has(candidate.key)) {
          selected.set(candidate.key, candidate);
          added = true;
          if (selected.size >= limit) {
            break;
          }
        }
      }

      if (!added && positions.every((position) => (byPos.get(position)?.length ?? 0) <= cursor)) {
        break;
      }

      cursor += 1;
    }
  }

  return [...selected.values()];
}

function shortHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function posLabel(pos: WordNetFilePos): string {
  switch (pos) {
    case "n": return "noun";
    case "v": return "verb";
    case "a": return "adjective";
    case "r": return "adverb";
  }
}

function nodeId(synset: WordNetSynset): string {
  return `dictionaryroot-oewn-2025-${posLabel(synset.filePos)}-${synset.offset}`;
}

function relationFor(symbol: string): RelationDescriptor {
  return RELATIONS[symbol] ?? {
    relationshipType: `WORDNET_${shortHash(symbol).toUpperCase()}`,
    label: `WordNet relation ${symbol}`,
    strength: "contextual",
  };
}

function sourceRecord(): SourceRootRecord {
  return {
    id: SOURCE_ID,
    name: "Open English WordNet 2025",
    type: "lexical-database",
    domain: DOMAIN,
    publisher: "Open English WordNet Community",
    qualityTier: "high",
    credibilityTier: "high",
    verificationStatus: "official-documentation",
    sourceClass: "structured-lexical-database",
    license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseStatus: "attribution-required",
    reviewStatus: "reviewed",
    lastReviewed: "2026-07-19",
    url: "https://en-word.net/",
    notes: "Generated from the official Open English WordNet 2025 WNDB release. Preserve attribution when redistributing derived bundles.",
  };
}

export function buildDictionaryRootPilotBundle(
  synsets: WordNetSynset[],
  options: DictionaryRootPilotOptions,
): SourceRootBundle {
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("DictionaryRoot pilot limit must be a positive integer.");
  }

  const sourceVersion = options.sourceVersion ?? "2025";
  const bundleId = options.bundleId ?? `dictionaryroot-oewn-${sourceVersion}-pilot-${options.limit}`;
  const createdAt = options.createdAt ?? new Date().toISOString().slice(0, 10);
  const selected = selectSynsets(
    synsets,
    Math.min(options.limit, synsets.length),
    options.seeds ?? DEFAULT_SEEDS,
  );
  const selectedByKey = new Map(selected.map((synset) => [synset.key, synset]));

  const nodes: SourceRootRecord[] = selected.map((synset) => ({
    id: nodeId(synset),
    title: synset.lemmas[0] ?? `${posLabel(synset.filePos)} ${synset.offset}`,
    type: "lexical-concept",
    domain: DOMAIN,
    summary: synset.definition,
    sourceIds: [SOURCE_ID],
    status: "source-backed",
    metadata: {
      source: "Open English WordNet",
      sourceVersion,
      sourceSynsetKey: synset.key,
      sourceOffset: synset.offset,
      partOfSpeech: posLabel(synset.filePos),
      synsetType: synset.synsetType,
      lexicographerFileNumber: synset.lexFileNumber,
      lemmas: synset.lemmas,
      examples: synset.examples,
      originalGloss: synset.originalGloss,
    },
  }));

  const assertions: SourceRootRecord[] = [];

  for (const synset of selected) {
    const conceptNodeId = nodeId(synset);
    const identity = `${synset.filePos}-${synset.offset}`;

    assertions.push({
      id: `dictionaryroot-definition-${identity}`,
      nodeId: conceptNodeId,
      assertionType: "definition",
      label: "Definition",
      summary: synset.definition,
      body: synset.definition,
      domain: DOMAIN,
      sourceIds: [SOURCE_ID],
      credibilityTier: "high",
      confidence: "strong",
      verificationStatus: "official-documentation",
      reviewStatus: "reviewed",
      supportLevel: "direct",
      interpretationLevel: "none",
      metadata: {
        sourceSynsetKey: synset.key,
        lemmas: synset.lemmas,
        partOfSpeech: posLabel(synset.filePos),
      },
    });

    if (synset.examples.length > 0) {
      assertions.push({
        id: `dictionaryroot-usage-${identity}`,
        nodeId: conceptNodeId,
        assertionType: "usage-example",
        label: "Usage Examples",
        summary: synset.examples.join(" | "),
        body: synset.examples.join("\n"),
        domain: DOMAIN,
        sourceIds: [SOURCE_ID],
        credibilityTier: "high",
        confidence: "strong",
        verificationStatus: "official-documentation",
        reviewStatus: "reviewed",
        supportLevel: "direct",
        interpretationLevel: "none",
        metadata: {
          sourceSynsetKey: synset.key,
          examples: synset.examples,
        },
      });
    }
  }

  const edges: SourceRootRecord[] = [];
  const edgeKeys = new Set<string>();

  for (const sourceSynset of selected) {
    for (const pointer of sourceSynset.pointers) {
      const targetKey = `${pointer.targetPos}:${pointer.targetOffset}`;
      const targetSynset = selectedByKey.get(targetKey);
      if (!targetSynset) {
        continue;
      }

      const uniqueKey = `${sourceSynset.key}|${pointer.symbol}|${targetKey}|${pointer.sourceTarget}`;
      if (edgeKeys.has(uniqueKey)) {
        continue;
      }
      edgeKeys.add(uniqueKey);

      const relation = relationFor(pointer.symbol);
      const sourceTitle = sourceSynset.lemmas[0] ?? sourceSynset.key;
      const targetTitle = targetSynset.lemmas[0] ?? targetSynset.key;

      edges.push({
        id: `dictionaryroot-edge-${shortHash(uniqueKey)}`,
        fromNodeId: nodeId(sourceSynset),
        toNodeId: nodeId(targetSynset),
        relationshipType: relation.relationshipType,
        label: relation.label,
        summary: `${sourceTitle} has the Open English WordNet relationship ${relation.label.toLowerCase()} with ${targetTitle}.`,
        domain: DOMAIN,
        sourceIds: [SOURCE_ID],
        credibilityTier: "high",
        confidence: "strong",
        verificationStatus: "official-documentation",
        reviewStatus: "reviewed",
        supportLevel: "direct",
        relationshipStrength: relation.strength,
        interpretationLevel: "none",
        metadata: {
          sourcePointerSymbol: pointer.symbol,
          sourceTarget: pointer.sourceTarget,
          sourceSynsetKey: sourceSynset.key,
          targetSynsetKey: targetSynset.key,
        },
      });
    }
  }

  const revisions: SourceRootRecord[] = [
    {
      revisionId: `dictionaryroot-revision-${sourceVersion}-pilot-${options.limit}`,
      objectType: "import-bundle",
      objectId: bundleId,
      revisionType: "generated-source-import",
      summary: `Generated a ${nodes.length}-concept DictionaryRoot pilot from Open English WordNet ${sourceVersion}.`,
      status: "current",
    },
  ];

  return {
    bundleId,
    bundleType: "sourceroot-import-bundle",
    version: `0.1.0-oewn-${sourceVersion}`,
    domain: DOMAIN,
    createdAt,
    createdBy: "SourceRoot DictionaryRoot pilot generator",
    description: `DictionaryRoot scale-testing bundle generated from Open English WordNet ${sourceVersion}.`,
    nodes,
    assertions,
    edges,
    sources: [sourceRecord()],
    revisions,
    extensions: {
      dictionaryroot: {
        schemaVersion: "0.1.0",
        sourceDataset: "Open English WordNet",
        sourceVersion,
        sourceLicense: "CC BY 4.0",
        selectionStrategy: "seeded semantic breadth-first expansion with balanced part-of-speech fallback",
        requestedNodeLimit: options.limit,
        generatedCounts: {
          nodes: nodes.length,
          assertions: assertions.length,
          edges: edges.length,
          sources: 1,
          revisions: revisions.length,
        },
        seedLemmas: options.seeds ?? DEFAULT_SEEDS,
      },
    },
  };
}
