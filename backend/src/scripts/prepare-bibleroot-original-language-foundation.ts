import { pathToFileURL } from "node:url";

import { writeOriginalLanguageDataset } from "../bibleroot/original-languages.js";

export async function prepareBibleRootOriginalLanguageFoundation(): Promise<void> {
  const dataset = await writeOriginalLanguageDataset();
  console.log("BibleRoot original-language dataset prepared.");
  console.log(JSON.stringify({
    datasetId: dataset.manifest.datasetId,
    version: dataset.manifest.version,
    normalizedDatasetSha256: dataset.manifest.normalizedDatasetSha256,
    counts: dataset.manifest.expectedCounts,
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  prepareBibleRootOriginalLanguageFoundation().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
