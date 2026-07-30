import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildCoreLexicalCorpus } from "../dictionaryroot/core-lexical-corpus.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

async function main(): Promise<void> {
  const backendRoot = path.resolve(process.cwd());
  const repositoryRoot = path.resolve(backendRoot, "..");
  const outputDirectory = path.resolve(argument("--output-dir")
    ?? path.join(backendRoot, "data", "dictionaryroot-core-lexical-corpus-v1"));
  const websterPath = path.resolve(argument("--webster")
    ?? path.join(backendRoot, "data", "dictionaryroot-core-lexical-corpus-v1",
      "webster-1913.txt"));
  const artifacts = await buildCoreLexicalCorpus({
    pilotPath: path.resolve(argument("--pilot")
      ?? path.join(repositoryRoot, "data", "dictionaryroot",
        "dictionaryroot-oewn-2025-pilot-10000.json")),
    candidateSourcesPath: path.resolve(argument("--sources")
      ?? path.join(backendRoot, "data", "dictionaryroot-corpus-scaling-acquisition-v1",
        "candidate-sources.json")),
    websterPath,
  });
  const files = new Map<string, string>([
    ["corpus.json", stableJson(artifacts.corpus)],
    ["inventory.json", stableJson(artifacts.inventory)],
    ["quality-review.json", stableJson(artifacts.qualityReview)],
    ["quality-review.md", `${artifacts.qualityReviewMarkdown.replace(/\s+$/u, "")}\n`],
    ["source-rights-attribution.json", stableJson(artifacts.sourceRightsAttribution)],
    ["lemma-selection.json", stableJson(artifacts.lemmaSelection)],
    ["prepared-source-accounting.json", stableJson(artifacts.preparedSourceAccounting)],
    ["relationship-accounting.json", stableJson(artifacts.relationshipAccounting)],
  ]);
  const hashes = {
    schemaVersion: "1.0.0",
    datasetId: "dictionaryroot-core-lexical-corpus-v1",
    version: "1.0.0",
    artifacts: [...files.entries()].map(([name, value]) => ({
      name,
      byteLength: Buffer.byteLength(value),
      sha256: hash(value),
    })).sort((left, right) => left.name.localeCompare(right.name)),
  };
  files.set("hashes.json", stableJson(hashes));
  await mkdir(outputDirectory, { recursive: true });
  for (const [name, contents] of files) {
    await writeFile(path.join(outputDirectory, name), contents, "utf8");
  }
  const raw = await readFile(websterPath);
  console.log(JSON.stringify({
    outputDirectory,
    counts: (artifacts.inventory as { counts: unknown }).counts,
    blockerCount: (artifacts.qualityReview as { blockerCount: number }).blockerCount,
    webster: { byteLength: raw.byteLength, sha256: hash(raw.toString("utf8")) },
    artifacts: hashes.artifacts,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
