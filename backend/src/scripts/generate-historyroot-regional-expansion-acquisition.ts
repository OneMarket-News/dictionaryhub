import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCandidateRegistry,
  buildFeasibilityReport,
  jsonBytes,
  sha256,
} from "../historyroot/regional-expansion-acquisition.js";

const currentFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFile), "../..");
const defaultOutput = path.join(
  backendRoot,
  "data",
  "historyroot-regional-expansion-acquisition-v1",
);

function outputDirectory(): string {
  const outputIndex = process.argv.indexOf("--output-directory");
  if (outputIndex < 0) return defaultOutput;
  const supplied = process.argv[outputIndex + 1];
  if (!supplied) {
    throw new Error("--output-directory requires a path.");
  }
  return path.resolve(supplied);
}

async function run(): Promise<void> {
  const target = outputDirectory();
  const registry = buildCandidateRegistry();
  const registryBytes = jsonBytes(registry);
  const report = buildFeasibilityReport(sha256(registryBytes));
  const reportBytes = jsonBytes(report);
  await mkdir(target, { recursive: true });
  await Promise.all([
    writeFile(path.join(target, "candidate-sources.json"), registryBytes),
    writeFile(path.join(target, "feasibility-report.json"), reportBytes),
  ]);
  console.log(JSON.stringify({
    outputDirectory: target,
    candidateSources: {
      bytes: registryBytes.length,
      sha256: sha256(registryBytes),
    },
    feasibilityReport: {
      bytes: reportBytes.length,
      sha256: sha256(reportBytes),
    },
    recommendation: report.recommendation,
    acceptedSources: report.sourceSummary.accepted,
    rejectedSources: report.sourceSummary.rejected,
  }, null, 2));
}

run().catch((error: unknown) => {
  console.error("Regional acquisition generation failed:", error);
  process.exitCode = 1;
});
