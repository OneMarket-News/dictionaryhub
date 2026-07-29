import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BASELINE,
  CANDIDATE_SOURCES,
  FEASIBILITY_REPORT,
  FRONTEND_GAPS,
  LEXICAL_MODEL_CAPABILITIES,
  generateAcquisitionArtifacts,
  type RightsClass,
} from "../src/dictionaryroot/corpus-scaling-acquisition.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDirectory, "..");
const repositoryRoot = path.resolve(backendRoot, "..");
const artifactDirectory = path.join(
  backendRoot,
  "data",
  "dictionaryroot-corpus-scaling-acquisition-v1",
);
const expectedCommit = "01eab17573f5eb9a6e957093496c500cf67a07db";
const expectedAllowedFiles = [
  "backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json",
  "backend/data/dictionaryroot-corpus-scaling-acquisition-v1/feasibility-report.json",
  "backend/src/dictionaryroot/corpus-scaling-acquisition.ts",
  "backend/src/scripts/generate-dictionaryroot-corpus-scaling-acquisition.ts",
  "backend/test/dictionaryroot-corpus-scaling-acquisition.test.ts",
  "docs/build/dictionaryroot-corpus-scaling-acquisition-stage.md",
  "docs/build/DICTIONARYROOT-CORPUS-SCALING-SCOPE.md",
  "docs/build/DICTIONARYROOT-LEXICAL-MODEL-GAP-ANALYSIS.md",
  "docs/build/DICTIONARYROOT-SOURCE-ACQUISITION-PLAN.md",
  "docs/stages/active/CURRENT-STAGE.md",
  "ROOT-MANIFEST.json",
  "VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1",
].sort();
const accepted = CANDIDATE_SOURCES.filter((item) => item.acquisitionStatus === "accepted");
const rejected = CANDIDATE_SOURCES.filter((item) => item.acquisitionStatus === "rejected");

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

async function changedFiles(): Promise<string[]> {
  const tracked = git("-c", "core.autocrlf=false", "diff", "--name-only").split(/\r?\n/u);
  const staged = git("-c", "core.autocrlf=false", "diff", "--cached", "--name-only").split(/\r?\n/u);
  const untracked = git("ls-files", "--others", "--exclude-standard").split(/\r?\n/u);
  return Array.from(new Set([...tracked, ...staged, ...untracked].filter(Boolean))).sort();
}

test("1. exact starting commit and branch expectations remain true", () => {
  assert.equal(git("rev-parse", "HEAD"), expectedCommit);
  assert.equal(git("branch", "--show-current"), "release/historyroot-alpha-integration-v1");
  assert.equal(git("rev-parse", "origin/release/historyroot-alpha-integration-v1"), expectedCommit);
  assert.equal(git("rev-list", "-n", "1", "sourceroot-historyroot-wampanoag-regional-corpus-v1"), expectedCommit);
});

test("2. accepted and rejected candidate totals are exact", () => {
  assert.equal(CANDIDATE_SOURCES.length, 22);
  assert.equal(accepted.length, 17);
  assert.equal(rejected.length, 5);
});

test("3. accepted category thresholds are exceeded", () => {
  const count = (category: string) => accepted.filter((item) => item.categories.includes(category)).length;
  assert.ok(count("general_lexical") >= 5);
  assert.ok(count("historical_or_etymological") >= 4);
  assert.ok(count("institutional_or_technical") >= 3);
  assert.ok(count("corpus_morphology_or_lexical_network") >= 3);
  assert.ok(count("multi_source_comparison") >= 3);
});

test("4. rights classifications use only the explicit gate vocabulary", () => {
  const allowed = new Set<RightsClass>([
    "public_domain", "open_license", "metadata_and_link_only", "restricted_reference_only",
    "rejected_unknown_rights", "rejected_inadequate_locator", "rejected_unstable_access",
    "rejected_quality", "rejected_scope",
  ]);
  CANDIDATE_SOURCES.forEach((item) => assert.ok(allowed.has(item.rightsClass), item.candidateId));
  accepted.forEach((item) => assert.ok(
    item.rightsClass === "public_domain" || item.rightsClass === "open_license",
    item.candidateId,
  ));
});

test("5. every candidate has explicit license and rights evidence", () => {
  CANDIDATE_SOURCES.forEach((item) => {
    assert.ok(item.licenseOrPublicDomainBasis.trim(), item.candidateId);
    assert.match(item.rightsEvidenceUrl, /^https:\/\//u, item.candidateId);
    assert.ok(item.rightsHolder.trim(), item.candidateId);
    assert.ok(item.permittedUseClass.trim(), item.candidateId);
  });
});

test("6. candidate identifiers and URLs are stable and complete", () => {
  CANDIDATE_SOURCES.forEach((item) => {
    assert.match(item.candidateId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.match(item.stableUrl, /^https:\/\//u, item.candidateId);
    assert.doesNotThrow(() => new URL(item.stableUrl));
    assert.ok(item.identifiers.length > 0, item.candidateId);
  });
});

test("7. locator strategies and rationales are bounded and nonempty", () => {
  CANDIDATE_SOURCES.forEach((item) => {
    assert.ok(item.boundedLocatorStrategy.length >= 20, item.candidateId);
    assert.ok(item.acceptanceOrRejectionRationale.length >= 20, item.candidateId);
    assert.ok(item.machineAccessConditions.length > 0, item.candidateId);
  });
});

test("8. source strengths, limitations, coverage, lineage, role, and objects are recorded", () => {
  CANDIDATE_SOURCES.forEach((item) => {
    assert.ok(item.sourceStrengths.length > 0, item.candidateId);
    assert.ok(item.sourceLimitations.length > 0, item.candidateId);
    assert.ok(item.lexicalCoverage.length > 0, item.candidateId);
    assert.ok(item.historicalCoverage.trim(), item.candidateId);
    assert.ok(item.perspectiveOrEditorialLineage.trim(), item.candidateId);
    assert.ok(item.proposedSourceRootRole.trim(), item.candidateId);
    assert.ok(item.proposedCorpusObjects.length > 0, item.candidateId);
  });
});

test("9. candidate IDs are unique and sorted ordinally", () => {
  const ids = CANDIDATE_SOURCES.map((item) => item.candidateId);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
});

test("10. unsupported rights claims are rejected rather than promoted", () => {
  assert.equal(CANDIDATE_SOURCES.find((item) => item.candidateId === "unimorph-english")?.acquisitionStatus, "rejected");
  assert.equal(CANDIDATE_SOURCES.find((item) => item.candidateId === "coca")?.acquisitionStatus, "rejected");
  ["oed-online", "merriam-webster-online", "etymonline"].forEach((id) => {
    const item = CANDIDATE_SOURCES.find((candidate) => candidate.candidateId === id);
    assert.equal(item?.rightsClass, "restricted_reference_only");
    assert.equal(item?.acquisitionStatus, "rejected");
  });
});

test("11. repository and database baseline identities and counts are exact", () => {
  assert.equal(BASELINE.repositoryArtifact.bundleId, "dictionaryroot-oewn-2025-pilot-500");
  assert.equal(BASELINE.repositoryArtifact.version, "0.1.0-oewn-2025");
  assert.equal(BASELINE.repositoryArtifact.lexicalRecords, 500);
  assert.equal(BASELINE.repositoryArtifact.lemmas, 654);
  assert.equal(BASELINE.repositoryArtifact.senses, 500);
  assert.equal(BASELINE.repositoryArtifact.claims, 928);
  assert.equal(BASELINE.repositoryArtifact.definitions, 500);
  assert.equal(BASELINE.repositoryArtifact.relationships, 436);
  assert.equal(BASELINE.database.name, "sourceroot_test");
  assert.equal(BASELINE.database.acceptedHistoryRootVersion, "1.3.0");
  assert.equal(BASELINE.database.dictionaryRootDatasets, 0);
});

test("12. production projection and mandatory minimums are feasible without forced quotas", () => {
  const projected = FEASIBILITY_REPORT.projectedProductionTarget;
  const minimum = FEASIBILITY_REPORT.mandatoryMinimum;
  assert.ok(projected.canonicalLemmas >= minimum.canonicalLemmas);
  assert.ok(projected.lexicalSenses >= minimum.lexicalSenses);
  assert.ok(projected.sourceAttributedDefinitionClaims >= minimum.sourceAttributedDefinitionClaims);
  assert.ok(projected.acceptedSources >= minimum.usableAcceptedSources);
  assert.ok(projected.lexicalRelationships >= minimum.lexicalRelationships);
  assert.ok(projected.forms >= minimum.forms);
  assert.ok(projected.structuredLocators >= minimum.structuredLocators);
  assert.ok(projected.fieldProvenanceRecords >= minimum.fieldProvenanceRecords);
  assert.equal(minimum.feasible, true);
});

test("13. every requested lexical capability has an allowed classification", () => {
  const allowed = new Set([
    "supported_directly", "supportable_through_existing_structures",
    "supportable_with_modest_non_migration_extension", "requires_api_or_frontend_work",
    "requires_schema_or_migration_approval", "inappropriate_for_chunk_10", "unresolved",
  ]);
  assert.equal(LEXICAL_MODEL_CAPABILITIES.length, 33);
  LEXICAL_MODEL_CAPABILITIES.forEach(([capability, classification, rationale]) => {
    assert.ok(capability);
    assert.ok(allowed.has(classification), `${capability}: ${classification}`);
    assert.ok(rationale.length >= 20, capability);
  });
});

test("14. frontend, API, and migration gaps use bounded classifications", () => {
  const frontendAllowed = new Set([
    "already_supported", "data_only_activation", "modest_frontend_enhancement",
    "significant_frontend_enhancement", "deferred_to_chunk_11",
  ]);
  assert.equal(FRONTEND_GAPS.length, 10);
  FRONTEND_GAPS.forEach(([requirement, classification]) => {
    assert.ok(requirement);
    assert.ok(frontendAllowed.has(classification));
  });
  assert.ok(FEASIBILITY_REPORT.apiFindings.some((item) => item.classification === "requires_api_work"));
  assert.ok(FEASIBILITY_REPORT.migrationFindings.some((item) => item.includes("Migration 013 remains absent")));
});

test("15. source comparison is deterministic and human-auditable", () => {
  const comparison = FEASIBILITY_REPORT.sourceComparisonPlan;
  assert.ok(comparison.structure.includes("reviewer_rationale"));
  assert.ok(comparison.structure.includes("source_lineage_relation"));
  assert.equal(comparison.allowedComparisonTypes.length, 11);
  assert.match(comparison.algorithmicSimilarity, /never stored as the accepted comparison decision/u);
});

test("16. coverage metrics contain every required quality family", () => {
  const metrics = new Set<string>(FEASIBILITY_REPORT.coverageMetrics);
  [
    "lemma_count", "sense_count", "multi_source_coverage", "historical_sense_coverage",
    "technical_sense_coverage", "etymology_coverage", "structured_locator_coverage",
    "field_provenance_coverage", "source_concentration", "license_distribution",
    "orphan_lemmas", "duplicate_senses", "unsupported_labels", "single_lineage_senses",
    "unresolved_sense_boundaries", "missing_source_comparison",
  ].forEach((metric) => assert.ok(metrics.has(metric), metric));
});

test("17. recommendation is conditional go with zero acquisition blockers", () => {
  assert.equal(FEASIBILITY_REPORT.recommendation.decision, "CONDITIONAL_GO");
  assert.equal(FEASIBILITY_REPORT.recommendation.blockers, 0);
  assert.equal(FEASIBILITY_REPORT.findings.blockers.length, 0);
  assert.ok(FEASIBILITY_REPORT.recommendation.conditions.length > 0);
});

test("18. independent two-directory generation is byte-identical", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dictionaryroot-acquisition-"));
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  try {
    await Promise.all([generateAcquisitionArtifacts(first), generateAcquisitionArtifacts(second)]);
    for (const name of ["candidate-sources.json", "feasibility-report.json"]) {
      const [left, right] = await Promise.all([readFile(path.join(first, name)), readFile(path.join(second, name))]);
      assert.equal(left.length, right.length, name);
      assert.equal(sha256(left), sha256(right), name);
      assert.deepEqual(left, right, name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("19. regenerated artifacts equal repository bytes and end with one LF", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dictionaryroot-acquisition-repository-"));
  try {
    await generateAcquisitionArtifacts(root);
    for (const name of ["candidate-sources.json", "feasibility-report.json"]) {
      const [generated, repository] = await Promise.all([
        readFile(path.join(root, name)),
        readFile(path.join(artifactDirectory, name)),
      ]);
      assert.equal(generated.length, repository.length, name);
      assert.equal(sha256(generated), sha256(repository), name);
      assert.deepEqual(generated, repository, name);
      assert.equal(repository.at(-1), 0x0a, name);
      assert.notEqual(repository.at(-2), 0x0a, name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("20. acquisition directory contains no production corpus bundle", async () => {
  const files = (await readdir(artifactDirectory)).sort();
  assert.deepEqual(files, ["candidate-sources.json", "feasibility-report.json"]);
  assert.equal(files.some((name) => /bundle|corpus.*data/iu.test(name)), false);
});

test("21. generator contains no database import path", async () => {
  const files = [
    path.join(backendRoot, "src/dictionaryroot/corpus-scaling-acquisition.ts"),
    path.join(backendRoot, "src/scripts/generate-dictionaryroot-corpus-scaling-acquisition.ts"),
  ];
  const text = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(text, /DATABASE_URL|from ["']pg["']|import-store|INSERT INTO|UPDATE\s+\w+\s+SET/iu);
});

test("22. no frontend, API-route, importer, migration, package, or ZIP changed", async () => {
  const changed = await changedFiles();
  const forbidden = changed.filter((file) =>
    file.startsWith("assets/")
    || file.startsWith("backend/src/routes/")
    || file === "backend/src/scripts/import-dictionaryroot-lexicon.ts"
    || file.startsWith("backend/db/migrations/")
    || /\.zip$/iu.test(file)
    || /(^|\/)(package|release)(\/|$)/iu.test(file),
  );
  assert.deepEqual(forbidden, []);
  assert.equal(await stat(path.join(backendRoot, "db/migrations/012_refine_contextual_assertions_evidence_versioning.sql")).then(() => true), true);
  await assert.rejects(stat(path.join(backendRoot, "db/migrations/013_create_dictionaryroot_corpus.sql")));
});

test("23. active root-stage file scope is exact", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "ROOT-MANIFEST.json"), "utf8")) as {
    active_stage: { allowed_files: string[]; preflight_changed_files: string[]; status: string };
  };
  assert.equal(manifest.active_stage.status, "active");
  assert.deepEqual([...manifest.active_stage.allowed_files].sort(), expectedAllowedFiles);
  assert.deepEqual(manifest.active_stage.preflight_changed_files, []);
  assert.deepEqual(await changedFiles(), expectedAllowedFiles);
});

test("24. Git index remains empty", () => {
  assert.equal(git("diff", "--cached", "--name-only"), "");
});

test("25. all prohibited mutation confirmations remain false", () => {
  assert.deepEqual(FEASIBILITY_REPORT.negativeConfirmations, {
    productionCorpusGenerated: false,
    databaseDataChanged: false,
    frontendSourceChanged: false,
    apiRouteChanged: false,
    importerImplementationChanged: false,
    migrationAdded: false,
    packageOrZipCreated: false,
    gitHistoryOperationPerformed: false,
  });
});
