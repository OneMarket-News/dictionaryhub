import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildCandidateRegistry,
  buildFeasibilityReport,
  jsonBytes,
  sha256,
} from "../src/historyroot/regional-expansion-acquisition.js";

type JsonObject = Record<string, unknown>;

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(backendRoot, "..");
const dataRoot = path.join(
  backendRoot,
  "data",
  "historyroot-regional-expansion-acquisition-v1",
);
const generator = path.join(
  backendRoot,
  "src",
  "scripts",
  "generate-historyroot-regional-expansion-acquisition.ts",
);
const registerTsx = path.join(backendRoot, "scripts", "register-tsx.mjs");
const acceptedAllowedFiles = [
  "ROOT-MANIFEST.json",
  "VERIFY-SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE.ps1",
  "backend/data/historyroot-regional-expansion-acquisition-v1/candidate-sources.json",
  "backend/data/historyroot-regional-expansion-acquisition-v1/feasibility-report.json",
  "backend/src/historyroot/regional-expansion-acquisition.ts",
  "backend/src/scripts/generate-historyroot-regional-expansion-acquisition.ts",
  "backend/test/historyroot-regional-expansion-acquisition.test.ts",
  "docs/build/HISTORYROOT-REGIONAL-EXPANSION-SCOPE.md",
  "docs/build/HISTORYROOT-REGIONAL-SOURCE-ACQUISITION-PLAN.md",
  "docs/build/historyroot-regional-expansion-acquisition-stage.md",
].sort();

let registryBytes: Buffer;
let reportBytes: Buffer;
let registry: ReturnType<typeof buildCandidateRegistry>;
let report: ReturnType<typeof buildFeasibilityReport>;
let tempRoot: string;
let firstDirectory: string;
let secondDirectory: string;

function changedFiles(): string[] {
  return execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).split(/\r?\n/).filter(Boolean).map((item) =>
    item.slice(3).replaceAll("\\", "/"));
}

function runGenerator(outputDirectory: string): void {
  execFileSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(registerTsx).href,
      generator,
      "--output-directory",
      outputDirectory,
    ],
    { cwd: backendRoot, stdio: "pipe" },
  );
}

before(async () => {
  [registryBytes, reportBytes] = await Promise.all([
    readFile(path.join(dataRoot, "candidate-sources.json")),
    readFile(path.join(dataRoot, "feasibility-report.json")),
  ]);
  registry = JSON.parse(registryBytes.toString("utf8")) as typeof registry;
  report = JSON.parse(reportBytes.toString("utf8")) as typeof report;
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "sourceroot-hr9-gate-"));
  firstDirectory = path.join(tempRoot, "generation-a");
  secondDirectory = path.join(tempRoot, "generation-b");
  runGenerator(firstDirectory);
  runGenerator(secondDirectory);
});

after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test("01. registry is planning-only", () => {
  assert.equal(registry.artifactType, "planning_registry");
  assert.equal(registry.planningOnly, true);
});

test("02. feasibility report is planning-only", () => {
  assert.equal(report.artifactType, "feasibility_report");
  assert.equal(report.planningOnly, true);
});

test("03. generator and committed registry bytes agree", () =>
  assert.deepEqual(
    registryBytes,
    jsonBytes(buildCandidateRegistry()),
  ));

test("04. generator and committed report bytes agree", () =>
  assert.deepEqual(
    reportBytes,
    jsonBytes(buildFeasibilityReport(sha256(registryBytes))),
  ));

test("05. two clean generations have equal registry lengths", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "candidate-sources.json")),
    readFile(path.join(secondDirectory, "candidate-sources.json")),
  ]);
  assert.equal(left.length, right.length);
});

test("06. two clean generations have equal registry hashes", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "candidate-sources.json")),
    readFile(path.join(secondDirectory, "candidate-sources.json")),
  ]);
  assert.equal(sha256(left), sha256(right));
});

test("07. two clean generations have byte-equal registries", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "candidate-sources.json")),
    readFile(path.join(secondDirectory, "candidate-sources.json")),
  ]);
  assert.deepEqual(left, right);
});

test("08. two clean generations have equal report lengths", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "feasibility-report.json")),
    readFile(path.join(secondDirectory, "feasibility-report.json")),
  ]);
  assert.equal(left.length, right.length);
});

test("09. two clean generations have equal report hashes", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "feasibility-report.json")),
    readFile(path.join(secondDirectory, "feasibility-report.json")),
  ]);
  assert.equal(sha256(left), sha256(right));
});

test("10. two clean generations have byte-equal reports", async () => {
  const [left, right] = await Promise.all([
    readFile(path.join(firstDirectory, "feasibility-report.json")),
    readFile(path.join(secondDirectory, "feasibility-report.json")),
  ]);
  assert.deepEqual(left, right);
});

test("11. committed files equal independent regeneration", async () => {
  const [generatedRegistry, generatedReport] = await Promise.all([
    readFile(path.join(firstDirectory, "candidate-sources.json")),
    readFile(path.join(firstDirectory, "feasibility-report.json")),
  ]);
  assert.deepEqual(generatedRegistry, registryBytes);
  assert.deepEqual(generatedReport, reportBytes);
});

test("12. candidate IDs are sorted", () => {
  const ids = registry.candidates.map((item) => item.candidateId);
  assert.deepEqual(ids, [...ids].sort());
});

test("13. candidate IDs are unique", () => {
  const ids = registry.candidates.map((item) => item.candidateId);
  assert.equal(new Set(ids).size, ids.length);
});

test("14. every candidate has required metadata", () => {
  for (const candidate of registry.candidates) {
    for (const value of [
      candidate.candidateId,
      candidate.title,
      candidate.creatorOrResponsibleInstitution,
      candidate.publicationOrEdition,
      candidate.date,
      candidate.sourceType,
      candidate.stableUrl,
      candidate.archiveIdentifier,
      candidate.temporalCoverage,
      candidate.limitationsOrKnownPerspective,
    ]) {
      assert.ok(value.trim().length > 0, candidate.candidateId);
    }
    assert.ok(candidate.geographicCoverage.length > 0);
    assert.ok(candidate.proposedHistoryRootRole.length > 0);
    assert.ok(candidate.candidateRecordsOrClaims.length > 0);
  }
});

test("15. URLs use safe HTTP schemes", () => {
  for (const candidate of registry.candidates) {
    assert.match(candidate.stableUrl, /^https:\/\//);
    assert.doesNotMatch(candidate.stableUrl, /localhost|127\.0\.0\.1/i);
  }
});

test("16. no candidate stores a machine path", () => {
  const text = registryBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:\\|file:\/\/|\/Users\//i);
});

test("17. accepted candidates have rights classifications", () => {
  for (const candidate of registry.candidates.filter((item) =>
    item.acquisitionStatus === "accepted")) {
    assert.match(
      candidate.rightsAccess.classification,
      /^(metadata_and_link_only|public_domain)$/,
    );
  }
});

test("18. accepted candidates use metadata only", () => {
  for (const candidate of registry.candidates.filter((item) =>
    item.acquisitionStatus === "accepted")) {
    assert.equal(candidate.rightsAccess.contentUse, "metadata_only");
  }
});

test("19. accepted candidates have bounded locators", () => {
  for (const candidate of registry.candidates.filter((item) =>
    item.acquisitionStatus === "accepted")) {
    assert.equal(candidate.locatorStrategy.bounded, true);
    assert.ok(candidate.locatorStrategy.type.length > 0);
    assert.ok(candidate.locatorStrategy.value.length > 0);
  }
});

test("20. rejected candidates have explicit reasons", () => {
  for (const candidate of registry.candidates.filter((item) =>
    item.acquisitionStatus === "rejected")) {
    assert.ok(candidate.rejectionReason);
    assert.ok(candidate.rejectionReason.length > 20);
  }
});

test("21. accepted source minimum is met", () =>
  assert.ok(report.sourceSummary.accepted >= 15));

test("22. Indigenous-led source minimum is met", () =>
  assert.ok(report.sourceSummary.categoryDistribution.indigenousLed >= 5));

test("23. primary or archival source minimum is met", () =>
  assert.ok(
    report.sourceSummary.categoryDistribution.primaryOrArchival >= 5,
  ));

test("24. institutional source minimum is met", () =>
  assert.ok(report.sourceSummary.categoryDistribution.institutional >= 5));

test("25. archaeological or scholarly minimum is met", () =>
  assert.ok(
    report.sourceSummary.categoryDistribution
      .archaeologicalOrScholarly >= 5,
  ));

test("26. projected numeric corpus minimums are met", () => {
  const counts = report.projectedCounts;
  assert.ok(counts.records >= 40);
  assert.ok(counts.claims >= 20);
  assert.ok(counts.sources >= 15);
  assert.ok(counts.reportingAccounts >= 8);
  assert.ok(counts.dateExpressions >= 20);
  assert.ok(counts.relationships >= 30);
  assert.ok(counts.structuredLocators >= 20);
  assert.ok(counts.fieldProvenance >= 20);
  assert.ok(counts.evidenceLinksWithExplicitRoles >= 10);
  assert.ok(counts.qualifyingOrConflictingStructures >= 5);
});

test("27. all six contextual families are projected", () =>
  assert.deepEqual(report.projectedCounts.contextualFamilyCoverage, {
    causalLinks: true,
    claimAttributions: true,
    culturalMemories: true,
    interpretations: true,
    perspectiveLinks: true,
    perspectives: true,
  }));

test("28. report has an explicit GO recommendation and no blockers", () => {
  assert.equal(report.recommendation, "GO");
  assert.deepEqual(report.blockers, []);
});

test("29. report preserves review findings and observations", () => {
  assert.ok(report.reviewFindings.length >= 5);
  assert.ok(report.observations.length >= 2);
});

test("30. prohibited scoring and reconciliation fields are absent", () => {
  const text = `${registryBytes.toString("utf8")}\n${reportBytes.toString("utf8")}`;
  assert.doesNotMatch(
    text,
    /truthScore|reliabilityScore|combinedConfidence|consensusScore|territorialPolygon/,
  );
});

test("31. no generated corpus bundle exists", async () => {
  const files = await readdir(dataRoot);
  assert.ok(!files.some((file) => /\.bundle\.json$/i.test(file)));
  assert.deepEqual(files.sort(), [
    "candidate-sources.json",
    "feasibility-report.json",
  ]);
});

test("32. no database import implementation changed", () => {
  assert.ok(!changedFiles().some((file) =>
    file.includes("import") || file === "backend/src/services/import-store.ts"));
});

test("33. no API route changed", () =>
  assert.ok(!changedFiles().some((file) =>
    file.startsWith("backend/src/routes/"))));

test("34. no frontend changed", () =>
  assert.ok(!changedFiles().some((file) =>
    file.startsWith("assets/") || file.endsWith(".html"))));

test("35. migration 013 is absent", () =>
  assert.ok(!changedFiles().some((file) =>
    /backend\/db\/migrations\/013/i.test(file))));

test("36. changes stay inside root-stage scope", () => {
  const changed = changedFiles().sort();
  assert.deepEqual(changed, acceptedAllowedFiles);
});

test("37. active root stage has the exact allowed scope", async () => {
  const manifest = JSON.parse(await readFile(
    path.join(repositoryRoot, "ROOT-MANIFEST.json"),
    "utf8",
  )) as JsonObject;
  const stage = manifest.active_stage as JsonObject;
  assert.equal(
    stage.slug,
    "SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE",
  );
  assert.equal(stage.status, "active");
  assert.deepEqual(
    [...stage.allowed_files as string[]].sort(),
    acceptedAllowedFiles,
  );
});

test("38. report hash reference matches committed registry", () =>
  assert.equal(report.candidateRegistrySha256, sha256(registryBytes)));

test("39. artifacts use LF and one final newline", () => {
  for (const bytes of [registryBytes, reportBytes]) {
    const text = bytes.toString("utf8");
    assert.doesNotMatch(text, /\r/);
    assert.match(text, /[^\n]\n$/);
  }
});

test("40. generation introduces no runtime timestamp", () => {
  assert.equal(registry.researchCutoff, "2026-07-28");
  assert.equal(report.researchCutoff, "2026-07-28");
  assert.doesNotMatch(
    `${registryBytes.toString("utf8")}${reportBytes.toString("utf8")}`,
    /generatedAt|generated_at|runtimeTimestamp/,
  );
});
