import assert from "node:assert/strict";
import test from "node:test";

import {
  observeDataQualityAndProvenance,
  serializeDataQualityProvenanceReport,
} from "../src/observers/data-quality-provenance-observer.js";
import {
  observePlatformOperations,
  serializePlatformOperationsReport,
} from "../src/observers/platform-operations-observer.js";
import type { SourceRootBundle } from "../src/types.js";

test("platform observer groups recurring failures without hiding individual events", () => {
  const input = [
    {
      eventType: "request_failed",
      level: "error",
      correlationId: "request-2",
      method: "GET",
      path: "/api/v1/nodes/:id",
      statusCode: 500,
      responseCategory: "internal-error",
      errorCode: "INTERNAL_SERVER_ERROR",
    },
    {
      eventType: "request_failed",
      level: "error",
      correlationId: "request-1",
      method: "GET",
      path: "/api/v1/nodes/:id",
      statusCode: 500,
      responseCategory: "internal-error",
      errorCode: "INTERNAL_SERVER_ERROR",
    },
    {
      eventType: "validation_failed",
      level: "warning",
      correlationId: "validation-1",
      statusCode: 422,
      failureCategory: "bundle-validation",
    },
  ] as const;
  const before = JSON.stringify(input);
  const first = observePlatformOperations(input);
  const second = observePlatformOperations(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(first.readOnly, true);
  assert.equal(first.authorityLevel, 1);
  assert.equal(first.failureCount, 3);
  assert.equal(first.failures.length, 3);
  assert.equal(first.groups.find((group) => group.count === 2)?.count, 2);
  assert.deepEqual(
    first.groups.find((group) => group.count === 2)?.correlationIds,
    ["request-1", "request-2"],
  );
  assert.match(first.humanSummary, /3 operational failure/);
  assert.equal(
    serializePlatformOperationsReport(first),
    serializePlatformOperationsReport(second),
  );
});

test("platform observer handles empty operational input deterministically", () => {
  const report = observePlatformOperations([]);
  assert.equal(report.failureCount, 0);
  assert.equal(report.groups.length, 0);
  assert.equal(report.severityRecommendation, "informational");
  assert.match(report.humanSummary, /No operational failures/);
});

test("data-quality observer detects attribution, identifiers, source links, and bundle gaps", () => {
  const bundle: SourceRootBundle = {
    bundleId: "quality-review-bundle",
    bundleType: "registry",
    version: "1.0",
    nodes: [{ id: "node-no-source", sourceIds: [] }],
    assertions: [{ id: "assertion-broken", sourceIds: ["missing-source"] }],
    edges: [{ id: "edge-malformed", sourceIds: [42] }],
    sources: [{
      id: "source-1",
      type: "publication",
      externalSystem: "doi",
      externalId: "malformed external id",
    }],
  };
  const before = JSON.stringify(bundle);
  const report = observeDataQualityAndProvenance(bundle);

  assert.equal(JSON.stringify(bundle), before);
  assert.equal(report.readOnly, true);
  assert.equal(report.authorityLevel, 1);
  assert.ok(report.findings.some((finding) =>
    finding.category === "missing_attribution" &&
    finding.recordId === "node-no-source"
  ));
  assert.ok(report.findings.some((finding) =>
    finding.category === "malformed_external_identifier" &&
    finding.recordId === "source-1"
  ));
  assert.ok(report.findings.some((finding) =>
    finding.category === "broken_source_relationship" &&
    finding.recordId === "assertion-broken"
  ));
  assert.ok(report.findings.some((finding) =>
    finding.category === "incomplete_bundle_metadata" &&
    finding.recordType === "bundle"
  ));
  assert.ok(report.findings.every((finding) =>
    finding.recordId.length > 0 &&
    finding.suggestedHumanReviewAction.length > 0
  ));
  assert.match(report.humanSummary, /No records were modified/);
  assert.equal(
    serializeDataQualityProvenanceReport(report),
    serializeDataQualityProvenanceReport(
      observeDataQualityAndProvenance(bundle)
    ),
  );
});

test("data-quality observer reports clean records without false findings", () => {
  const cleanBundle: SourceRootBundle = {
    bundleId: "clean-bundle",
    bundleType: "registry",
    version: "1.0",
    domain: "ExampleRoot",
    createdAt: "2026-07-24T00:00:00.000Z",
    nodes: [{ id: "node-1", sourceIds: ["source-1"], status: "active" }],
    assertions: [{ id: "assertion-1", sourceIds: ["source-1"], reviewStatus: "approved" }],
    edges: [{ id: "edge-1", sourceIds: ["source-1"], verificationStatus: "verified" }],
    sources: [{
      id: "source-1",
      type: "publication",
      publisher: "Example Publisher",
      url: "https://example.test/source",
      externalSystem: "doi",
      externalId: "10.1234/example",
      status: "active",
    }],
    revisions: [{ revisionId: "revision-1", sourceIds: ["source-1"], status: "active" }],
  };
  const report = observeDataQualityAndProvenance(cleanBundle);
  assert.equal(report.findingCount, 0);
  assert.deepEqual(report.findings, []);
  assert.match(report.humanSummary, /No data-quality or provenance findings/);
});

