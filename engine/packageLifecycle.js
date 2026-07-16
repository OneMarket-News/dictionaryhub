(function (global) {
  "use strict";

  const STAGING_STORAGE_KEY = "sourceroot-staged-bundles-v1";
  const PACKAGE_INSPECTION_STORAGE_KEY =
    "sourceroot-package-inspections-v1";
  const PACKAGE_EXPORT_TYPE = "sourceroot-staged-package";
  const PACKAGE_COLLECTION_EXPORT_TYPE =
    "sourceroot-staged-package-collection";
  const PACKAGE_EXPORT_VERSION = "1.0.0";

  function readObjectMap(storageKey) {
    try {
      const rawValue = localStorage.getItem(storageKey);

      if (!rawValue) {
        return {};
      }

      const parsedValue = JSON.parse(rawValue);

      return parsedValue && typeof parsedValue === "object"
        ? parsedValue
        : {};
    } catch (error) {
      console.warn(
        `Could not read SourceRoot local storage key "${storageKey}":`,
        error
      );

      return {};
    }
  }

  function writeObjectMap(storageKey, value) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(value || {})
      );

      return true;
    } catch (error) {
      console.warn(
        `Could not write SourceRoot local storage key "${storageKey}":`,
        error
      );

      return false;
    }
  }

  function getStagingMap() {
    return readObjectMap(STAGING_STORAGE_KEY);
  }

  function saveStagingMap(stagingMap) {
    return writeObjectMap(
      STAGING_STORAGE_KEY,
      stagingMap
    );
  }

  function getInspectionMap() {
    return readObjectMap(
      PACKAGE_INSPECTION_STORAGE_KEY
    );
  }

  function saveInspectionMap(inspectionMap) {
    return writeObjectMap(
      PACKAGE_INSPECTION_STORAGE_KEY,
      inspectionMap
    );
  }

  function getStagedRecord(bundleId) {
    return bundleId
      ? getStagingMap()[bundleId] || null
      : null;
  }

  function saveStagedRecord(record) {
    if (
      !record ||
      typeof record !== "object" ||
      typeof record.bundleId !== "string" ||
      !record.bundleId.trim()
    ) {
      throw new Error(
        "A staged record requires a bundleId."
      );
    }

    const stagingMap = getStagingMap();

    stagingMap[record.bundleId] = record;

    saveStagingMap(stagingMap);

    return record;
  }

  function removeStagedRecord(bundleId) {
    const stagingMap = getStagingMap();

    if (!(bundleId in stagingMap)) {
      return false;
    }

    delete stagingMap[bundleId];

    saveStagingMap(stagingMap);

    return true;
  }

  function getBundleCounts(bundle) {
    return {
      nodes: Array.isArray(bundle?.nodes)
        ? bundle.nodes.length
        : 0,

      assertions: Array.isArray(bundle?.assertions)
        ? bundle.assertions.length
        : 0,

      edges: Array.isArray(bundle?.edges)
        ? bundle.edges.length
        : 0,

      sources: Array.isArray(bundle?.sources)
        ? bundle.sources.length
        : 0,

      revisions: Array.isArray(bundle?.revisions)
        ? bundle.revisions.length
        : 0
    };
  }

  async function createBundleHash(bundle) {
    const normalizedBundle = JSON.stringify(bundle);
    const bytes = new TextEncoder().encode(
      normalizedBundle
    );

    const digest = await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

    return Array.from(new Uint8Array(digest))
      .map(byte =>
        byte.toString(16).padStart(2, "0")
      )
      .join("");
  }

  function createPackageId(record) {
    return (
      `${record.bundleId}:` +
      `${record.bundleHash.slice(0, 16)}`
    );
  }

  function createStagedPackageExport(
    record,
    bundle
  ) {
    return {
      exportType: PACKAGE_EXPORT_TYPE,
      exportVersion: PACKAGE_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      packageId: createPackageId(record),
      record,
      bundle
    };
  }

  function createStagedPackageCollection(
    packages
  ) {
    return {
      exportType:
        PACKAGE_COLLECTION_EXPORT_TYPE,

      exportVersion:
        PACKAGE_EXPORT_VERSION,

      exportedAt:
        new Date().toISOString(),

      packageCount:
        packages.length,

      packages
    };
  }

  function parsePackageArtifact(artifact) {
    if (
      !artifact ||
      typeof artifact !== "object"
    ) {
      throw new Error(
        "The selected file does not contain a valid JSON object."
      );
    }

    if (
      artifact.exportType !==
      PACKAGE_EXPORT_TYPE
    ) {
      throw new Error(
        "Unsupported artifact type. Expected a sourceroot-staged-package export."
      );
    }

    if (
      artifact.exportVersion !==
      PACKAGE_EXPORT_VERSION
    ) {
      throw new Error(
        `Unsupported package version: ${
          artifact.exportVersion ||
          "unknown"
        }`
      );
    }

    if (
      !artifact.record ||
      typeof artifact.record !== "object"
    ) {
      throw new Error(
        "The package does not contain a valid staged record."
      );
    }

    if (
      !artifact.bundle ||
      typeof artifact.bundle !== "object"
    ) {
      throw new Error(
        "The package does not contain a valid embedded bundle."
      );
    }

    return {
      artifact,
      record: artifact.record,
      bundle: artifact.bundle
    };
  }

  function numberValue(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  async function verifyPackage(
    record,
    bundle
  ) {
    const issues = [];

    const requiredFields = [
      "bundleId",
      "stagedAt",
      "status",
      "bundleHash"
    ];

    for (const field of requiredFields) {
      if (
        typeof record?.[field] !== "string" ||
        !record[field].trim()
      ) {
        issues.push({
          severity: "error",
          message:
            `Missing or invalid staged record field: ${field}.`
        });
      }
    }

    if (
      !record?.counts ||
      typeof record.counts !== "object"
    ) {
      issues.push({
        severity: "error",
        message:
          "The staged record does not contain a counts object."
      });
    }

    const calculatedHash =
      await createBundleHash(bundle);

    const hashMatches =
      calculatedHash === record?.bundleHash;

    if (!hashMatches) {
      issues.push({
        severity: "error",
        message:
          "The embedded bundle hash does not match the staged record."
      });
    }

    const bundleIdMatches =
      !bundle?.bundleId ||
      bundle.bundleId === record?.bundleId;

    if (!bundleIdMatches) {
      issues.push({
        severity: "warning",
        message:
          `Embedded bundle ID ${bundle.bundleId} ` +
          `does not match staged record ID ` +
          `${record.bundleId}.`
      });
    }

    const actualCounts =
      getBundleCounts(bundle);

    const stagedCounts =
      record?.counts || {};

    const countDifferences = [];

    const countKeys = [
      "nodes",
      "assertions",
      "edges",
      "sources",
      "revisions"
    ];

    for (const key of countKeys) {
      const stagedValue =
        numberValue(stagedCounts[key]);

      const actualValue =
        numberValue(actualCounts[key]);

      if (stagedValue !== actualValue) {
        countDifferences.push(
          `${key}: staged ${stagedValue}, ` +
          `embedded ${actualValue}`
        );
      }
    }

    if (countDifferences.length) {
      issues.push({
        severity: "warning",
        message:
          `Object counts differ: ` +
          `${countDifferences.join("; ")}.`
      });
    }

    return {
      calculatedHash,
      hashMatches,
      bundleIdMatches,
      actualCounts,
      issues,

      canRestore: !issues.some(
        issue => issue.severity === "error"
      )
    };
  }

  function createInspectionRecord({
    artifact,
    record,
    verification,
    inspectedAt = new Date().toISOString()
  }) {
    const packageId =
      artifact.packageId ||
      (
        `${record.bundleId}:` +
        `${record.bundleHash.slice(0, 16)}`
      );

    return {
      inspectionId:
        `${packageId}:${inspectedAt}`,

      packageId,
      bundleId: record.bundleId,
      inspectedAt,

      exportedAt:
        artifact.exportedAt || null,

      exportType:
        artifact.exportType,

      exportVersion:
        artifact.exportVersion,

      decision:
        verification.canRestore
          ? "approved"
          : "rejected",

      integrityStatus:
        verification.hashMatches
          ? "verified"
          : "failed",

      canRestore:
        verification.canRestore,

      issueCount:
        verification.issues.length,

      issues:
        verification.issues,

      storedHash:
        record.bundleHash,

      calculatedHash:
        verification.calculatedHash,

      counts:
        verification.actualCounts,

      source:
        record.source || "unknown",

      packageSnapshot:
        artifact
    };
  }

  function saveInspectionRecord(
    inspectionRecord
  ) {
    if (
      !inspectionRecord ||
      typeof inspectionRecord.inspectionId !==
        "string"
    ) {
      throw new Error(
        "An inspection record requires an inspectionId."
      );
    }

    const inspectionMap =
      getInspectionMap();

    inspectionMap[
      inspectionRecord.inspectionId
    ] = inspectionRecord;

    saveInspectionMap(inspectionMap);

    return inspectionRecord;
  }

  function restorePackage(
    record,
    bundle,
    overrides = {}
  ) {
    const restoredRecord = {
      ...record,

      source:
        "embedded-package",

      embeddedBundle:
        bundle,

      importedAt:
        new Date().toISOString(),

      integrityStatus:
        "current",

      ...overrides
    };

    saveStagedRecord(restoredRecord);

    return restoredRecord;
  }

  function sanitizeFilename(
    value,
    fallback = "sourceroot-package"
  ) {
    return (
      String(value || fallback)
        .trim()
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )
        .toLowerCase() ||
      fallback
    );
  }

  function downloadJsonFile(
    value,
    filename
  ) {
    const blob = new Blob(
      [
        JSON.stringify(
          value,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const objectUrl =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href =
      objectUrl;

    anchor.download =
      filename;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      objectUrl
    );
  }

  global.SourceRootPackageLifecycle =
    Object.freeze({
      STAGING_STORAGE_KEY,
      PACKAGE_INSPECTION_STORAGE_KEY,
      PACKAGE_EXPORT_TYPE,
      PACKAGE_COLLECTION_EXPORT_TYPE,
      PACKAGE_EXPORT_VERSION,

      readObjectMap,
      writeObjectMap,

      getStagingMap,
      saveStagingMap,
      getInspectionMap,
      saveInspectionMap,

      getStagedRecord,
      saveStagedRecord,
      removeStagedRecord,

      getBundleCounts,
      createBundleHash,

      createPackageId,
      createStagedPackageExport,
      createStagedPackageCollection,

      parsePackageArtifact,
      verifyPackage,

      createInspectionRecord,
      saveInspectionRecord,
      restorePackage,

      sanitizeFilename,
      downloadJsonFile,
      numberValue
    });
})(window);