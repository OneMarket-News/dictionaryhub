import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  canonicalJsonBytes,
  validateSourcePreparationWorkspace,
} from "../source-preparation/source-preparation-engine.js";
import type {
  PreparationMode,
  SourcePreparationReport,
} from "../source-preparation/source-preparation-types.js";

const acceptedCorpusDirectory = path.resolve(
  "data/historyroot-foundational-corpus-v1",
);

function parseArguments(args: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Arguments must use --workspace, --mode, and optional --output.");
    }
    values.set(key.slice(2), value);
  }
  const workspace = values.get("workspace");
  const mode = values.get("mode");
  const output = values.get("output");
  if (!workspace) throw new Error("--workspace is required.");
  if (!mode || !["validate", "preview", "generate"].includes(mode)) {
    throw new Error("--mode must be validate, preview, or generate.");
  }
  if (mode !== "validate" && !output) {
    throw new Error("--output is required for preview and generate.");
  }
  if (workspace.split(/[\\/]/).includes("..")
    || output?.split(/[\\/]/).includes("..")) {
    throw new Error("Parent traversal is not allowed.");
  }
  return {
    workspace,
    mode: mode as PreparationMode,
    output,
  };
}

function safePath(value: string): string {
  const resolved = path.resolve(value);
  const root = path.resolve(".");
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes the backend workspace: ${value}`);
  }
  return resolved;
}

function markdownReport(report: SourcePreparationReport): string {
  return [
    "# SourceRoot source-preparation validation",
    "",
    report.preview ? "**PREVIEW MATERIAL — NOT AN APPROVED BUNDLE**" : "",
    `- Workspace: ${report.workspaceId}`,
    `- Mode: ${report.mode}`,
    `- Ready for generation: ${report.readyForGeneration}`,
    `- Blocking issues: ${report.issues.length}`,
    `- Proposed content hash: ${report.proposedContentSha256 ?? "unavailable"}`,
    "",
  ].filter((line, index, lines) =>
    line !== "" || lines[index - 1] !== "").join("\n") + "\n";
}

async function run(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  const workspacePath = safePath(parsed.workspace);
  const originalBytes = await readFile(workspacePath);
  const input = JSON.parse(originalBytes.toString("utf8")) as unknown;
  const result = validateSourcePreparationWorkspace(input, parsed.mode);

  if (parsed.mode !== "validate") {
    const outputDirectory = safePath(parsed.output!);
    if (
      outputDirectory === workspacePath
      || workspacePath.startsWith(`${outputDirectory}${path.sep}`)
    ) {
      throw new Error("Output may not overwrite or contain the workspace input.");
    }
    if (
      outputDirectory === acceptedCorpusDirectory
      || outputDirectory.startsWith(`${acceptedCorpusDirectory}${path.sep}`)
    ) {
      throw new Error("Output inside the accepted Chunk 6 corpus is forbidden.");
    }
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        path.join(outputDirectory, "validation-report.json"),
        canonicalJsonBytes(result.report),
      ),
      writeFile(
        path.join(outputDirectory, "validation-report.md"),
        markdownReport(result.report),
        "utf8",
      ),
    ]);
    if (parsed.mode === "generate" && result.bundleBytes) {
      await writeFile(
        path.join(outputDirectory, "sourceroot-approved.bundle.json"),
        result.bundleBytes,
      );
    }
  }
  const unchangedBytes = await readFile(workspacePath);
  if (!originalBytes.equals(unchangedBytes)) {
    throw new Error("Workspace input bytes changed unexpectedly.");
  }
  console.log(
    `${parsed.mode.toUpperCase()}: ${result.report.workspaceId}; ${result.report.issues.length} blocking issue(s); ${result.report.proposedContentSha256 ?? "no hash"}.`,
  );
  if (result.report.issues.length > 0
    || (parsed.mode === "generate" && !result.bundleBytes)) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(
    `SourceRoot source preparation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
