import { validatePlymouthDataset } from "../historyroot/plymouth-dataset.js";

async function run(): Promise<void> {
  const report = await validatePlymouthDataset();

  console.log("HistoryRoot Plymouth Knowledge Dataset v1 validation");
  for (const check of report.checks) {
    console.log(
      `[${check.level.toLocaleUpperCase()}] ${check.code}: ${check.message}`,
    );
  }
  console.log("");
  console.log(`Bundle: ${report.bundleId}`);
  console.log(`Counts: ${JSON.stringify(report.counts)}`);
  console.log(
    `Totals: pass=${report.totals.pass} fail=${report.totals.fail} warn=${report.totals.warn} info=${report.totals.info}`,
  );

  if (!report.ready) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(
    "HistoryRoot Plymouth dataset validation failed:",
    error,
  );
  process.exitCode = 1;
});
