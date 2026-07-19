import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  buildDictionaryRootPilotBundle,
  loadWordNetSynsets,
} from "../dictionaryroot/oewn-wndb.js";
import { validateBundle } from "../services/validator.js";

interface CliOptions {
  sourceDir: string;
  output: string;
  limit: number;
  sourceVersion: string;
  bundleId?: string;
}

function argumentValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseOptions(args: string[]): CliOptions {
  const sourceDir = argumentValue(args, "--source-dir");
  const output = argumentValue(args, "--output");
  const limitText = argumentValue(args, "--limit") ?? "500";
  const sourceVersion = argumentValue(args, "--source-version") ?? "2025";
  const bundleId = argumentValue(args, "--bundle-id");
  const limit = Number.parseInt(limitText, 10);

  if (!sourceDir) {
    throw new Error("Missing required --source-dir argument.");
  }

  if (!output) {
    throw new Error("Missing required --output argument.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 25_000) {
    throw new Error("--limit must be an integer between 1 and 25000.");
  }

  const options: CliOptions = {
    sourceDir: path.resolve(sourceDir),
    output: path.resolve(output),
    limit,
    sourceVersion,
  };

  if (bundleId) {
    options.bundleId = bundleId;
  }

  return options;
}

function milliseconds(start: number, end: number): string {
  return `${(end - start).toFixed(1)} ms`;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const totalStart = performance.now();

  console.log(`Loading Open English WordNet files below: ${options.sourceDir}`);
  const parseStart = performance.now();
  const synsets = await loadWordNetSynsets(options.sourceDir);
  const parseEnd = performance.now();
  console.log(`Parsed ${synsets.length.toLocaleString()} source synsets in ${milliseconds(parseStart, parseEnd)}.`);

  const buildStart = performance.now();
  const bundleOptions = {
    limit: options.limit,
    sourceVersion: options.sourceVersion,
    ...(options.bundleId ? { bundleId: options.bundleId } : {}),
  };
  const bundle = buildDictionaryRootPilotBundle(synsets, bundleOptions);
  const buildEnd = performance.now();

  const validationStart = performance.now();
  const validation = validateBundle(bundle);
  const validationEnd = performance.now();

  if (!validation.canImport || validation.summary.errors > 0) {
    console.error(JSON.stringify(validation, null, 2));
    throw new Error("Generated DictionaryRoot bundle did not pass SourceRoot validation.");
  }

  const writeStart = performance.now();
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const file = await stat(options.output);
  const writeEnd = performance.now();
  const totalEnd = performance.now();

  console.log("");
  console.log(`Created: ${options.output}`);
  console.log(`Bundle ID: ${validation.bundleId}`);
  console.log(`Status: ${validation.status}`);
  console.log(`Nodes: ${validation.summary.nodes}`);
  console.log(`Assertions: ${validation.summary.assertions}`);
  console.log(`Edges: ${validation.summary.edges}`);
  console.log(`Sources: ${validation.summary.sources}`);
  console.log(`Revisions: ${validation.summary.revisions}`);
  console.log(`Errors: ${validation.summary.errors}`);
  console.log(`Warnings: ${validation.summary.warnings}`);
  console.log(`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("");
  console.log("Performance");
  console.log(`Parse source: ${milliseconds(parseStart, parseEnd)}`);
  console.log(`Build bundle: ${milliseconds(buildStart, buildEnd)}`);
  console.log(`Validate bundle: ${milliseconds(validationStart, validationEnd)}`);
  console.log(`Write bundle: ${milliseconds(writeStart, writeEnd)}`);
  console.log(`Total: ${milliseconds(totalStart, totalEnd)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
