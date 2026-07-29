import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDictionaryRootLexicalEvidenceFixture,
  buildLexicalEvidenceInventory,
  buildLexicalEvidenceQualityReview,
  serializeDeterministic,
} from "../dictionaryroot/lexical-evidence-fixture.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputDirectory = path.resolve(
  currentDirectory,
  "../../data/dictionaryroot-lexical-evidence-architecture-fixture-v1",
);

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function generateLexicalEvidenceFixture(
  outputDirectory = defaultOutputDirectory,
): Promise<void> {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  const inventory = buildLexicalEvidenceInventory(fixture);
  const quality = buildLexicalEvidenceQualityReview(fixture);
  if (quality.blockerCount !== 0) {
    throw new Error(`Fixture quality review found ${quality.blockerCount} blockers.`);
  }
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "fixture.json"),
      serializeDeterministic(fixture), "utf8"),
    writeFile(path.join(outputDirectory, "inventory.json"),
      serializeDeterministic(inventory), "utf8"),
    writeFile(path.join(outputDirectory, "quality-review.json"),
      serializeDeterministic(quality), "utf8"),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = path.resolve(argumentValue("output-dir") ?? defaultOutputDirectory);
  generateLexicalEvidenceFixture(outputDirectory).then(() => {
    console.log(`Generated ${outputDirectory}`);
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
