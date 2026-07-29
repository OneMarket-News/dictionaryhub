import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateAcquisitionArtifacts } from "../dictionaryroot/corpus-scaling-acquisition.js";

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutput = path.resolve(
  currentDirectory,
  "../../data/dictionaryroot-corpus-scaling-acquisition-v1",
);
const outputDirectory = path.resolve(argumentValue("output-dir") ?? defaultOutput);

await generateAcquisitionArtifacts(outputDirectory);
console.log(`Generated DictionaryRoot corpus-scaling acquisition artifacts in ${outputDirectory}`);
