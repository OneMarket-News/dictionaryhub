import assert from "node:assert/strict";
import test from "node:test";

import {
  EARTHROOT_PREDICATES,
  EARTHROOT_REJECTED_IDENTITY_SIGNALS,
  EARTHROOT_TEMPORAL_NOT_ASSERTED,
  earthRootPredicateRule,
} from "../src/earthroot/contract.js";
import {
  buildResourceTypeIndex,
  isEarthRootCanonicalPublicId,
  mintEarthRootCanonicalPublicId,
  validateEarthRootAssertion,
  validateEarthRootResource,
  validateEarthRootTemporal,
  type EarthRootAssertion,
  type EarthRootResource,
} from "../src/earthroot/domain.js";
import { REJECTED_IDENTITY_EVIDENCE_KINDS } from "../src/sourceroot/identity-assertions.js";

/* ---------------------------------------------------------------------------
 * Synthetic fixtures. Deterministic IDs, explicitly fictional semantics.
 * These names resemble real entities; the claims attached to them are invented
 * for contract testing and assert nothing about actual history or geography.
 * ------------------------------------------------------------------------ */

const DATASET = "earthroot-synthetic-contract-fixture-v1";
const VERSION = "0.0.0-contract-fixture";

const PLACE_ID = "11111111-1111-4111-8111-111111111111";
const POLITY_A_ID = "22222222-2222-4222-8222-222222222222";
const POLITY_B_ID = "33333333-3333-4333-8333-333333333333";
const DISTRICT_ID = "44444444-4444-4444-8444-444444444444";

const resources: EarthRootResource[] = [
  { resourceId: "res-place-jerusalem", datasetId: DATASET, datasetVersion: VERSION, entityType: "place", canonicalPublicId: PLACE_ID },
  { resourceId: "res-place-district", datasetId: DATASET, datasetVersion: VERSION, entityType: "place", canonicalPublicId: DISTRICT_ID },
  { resourceId: "res-polity-a", datasetId: DATASET, datasetVersion: VERSION, entityType: "polity", canonicalPublicId: POLITY_A_ID },
  { resourceId: "res-polity-b", datasetId: DATASET, datasetVersion: VERSION, entityType: "polity", canonicalPublicId: POLITY_B_ID },
];

const context = { resourceTypes: buildResourceTypeIndex(resources) };

function evidence(id: string) {
  return [
    {
      evidenceId: id,
      sourceId: "synthetic-source-1",
      sourceLocator: "fixture:page-1",
      statement: "Synthetic fixture statement for contract testing only.",
      sourceDatasetId: DATASET,
      sourceDatasetVersion: VERSION,
      evidenceOrder: 1,
    },
  ];
}

function assertion(over: Partial<EarthRootAssertion> = {}): EarthRootAssertion {
  return {
    assertionId: "a-1",
    datasetId: DATASET,
    subjectResourceId: "res-place-jerusalem",
    predicate: "named_as",
    objectResourceId: null,
    objectLiteral: "Synthetic Jerusalem",
    nameType: "preferred",
    languageTag: "en",
    script: "Latn",
    temporal: EARTHROOT_TEMPORAL_NOT_ASSERTED,
    certainty: "source-bounded",
    uncertaintyStatement: null,
    reviewState: "unreviewed",
    disputeState: "not_disputed",
    assertionStatus: "active",
    derivation: "directly_sourced",
    evidence: evidence("e-1"),
    ...over,
  };
}

const rules = (a: EarthRootAssertion) => validateEarthRootAssertion(a, context);
const ok = (a: EarthRootAssertion) => rules(a).length === 0;
const hasRule = (a: EarthRootAssertion, rule: string) =>
  rules(a).some((v) => v.rule === rule);

/* ------------------------------ PLACE / POLITY --------------------------- */

test("1. place and polity are distinct entity classes", () => {
  const place = resources.find((r) => r.entityType === "place");
  const polity = resources.find((r) => r.entityType === "polity");
  assert.ok(place && polity);
  assert.notEqual(place.entityType, polity.entityType);
  assert.notEqual(place.canonicalPublicId, polity.canonicalPublicId);
});

test("2. every fixture resource is valid", () => {
  for (const resource of resources) {
    assert.deepEqual(validateEarthRootResource(resource), []);
  }
});

test("3. governed_by requires a polity object, not a place", () => {
  const conflated = assertion({
    predicate: "governed_by",
    objectResourceId: "res-place-district",
    objectLiteral: null,
    nameType: null,
  });
  assert.ok(hasRule(conflated, "object-type-permitted"));
});

test("4. located_within requires a place object, not a polity", () => {
  const conflated = assertion({
    predicate: "located_within",
    objectResourceId: "res-polity-a",
    objectLiteral: null,
    nameType: null,
  });
  assert.ok(hasRule(conflated, "object-type-permitted"));
});

test("5. a polity cannot be the subject of located_within", () => {
  const conflated = assertion({
    subjectResourceId: "res-polity-a",
    predicate: "located_within",
    objectResourceId: "res-place-district",
    objectLiteral: null,
    nameType: null,
  });
  assert.ok(hasRule(conflated, "subject-type-permitted"));
});

test("6. a resource cannot be related to itself", () => {
  const self = assertion({
    predicate: "located_within",
    subjectResourceId: "res-place-district",
    objectResourceId: "res-place-district",
    objectLiteral: null,
    nameType: null,
  });
  assert.ok(hasRule(self, "no-self-relationship"));
});

/* -------------------------------- PREDICATES ----------------------------- */

test("7. only governed predicates are accepted", () => {
  const ungoverned = assertion({ predicate: "controlled" as never });
  assert.ok(hasRule(ungoverned, "predicate-governed"));
});

test("8. there is exactly one canonical containment predicate", () => {
  const containment = EARTHROOT_PREDICATES.filter((p) =>
    ["located_within", "within", "part_of", "community_within"].includes(p),
  );
  assert.deepEqual([...containment], ["located_within"]);
});

test("9. political control and administrative attachment stay distinct", () => {
  const governed = earthRootPredicateRule("governed_by");
  const administered = earthRootPredicateRule("administered_by");
  assert.ok(governed && administered);
  assert.notEqual(governed.description, administered.description);
});

/* ------------------------------ CANONICAL ID ----------------------------- */

test("10. canonicalPublicId is an opaque minted identifier", () => {
  const minted = mintEarthRootCanonicalPublicId();
  assert.ok(isEarthRootCanonicalPublicId(minted));
  assert.notEqual(minted, mintEarthRootCanonicalPublicId());
});

test("11. a name-derived canonicalPublicId is rejected", () => {
  const derived = {
    ...resources[0]!,
    canonicalPublicId: "synthetic-jerusalem",
  };
  assert.ok(
    validateEarthRootResource(derived).some(
      (v) => v.rule === "canonical-public-id-opaque",
    ),
  );
});

test("12. canonicalPublicId is stable across dataset versions", () => {
  const v1 = { ...resources[0]!, datasetVersion: "1.0.0" };
  const v2 = { ...resources[0]!, datasetVersion: "2.0.0" };
  assert.equal(v1.canonicalPublicId, v2.canonicalPublicId);
  assert.deepEqual(validateEarthRootResource(v1), []);
  assert.deepEqual(validateEarthRootResource(v2), []);
});

/* --------------------------------- NAMES --------------------------------- */

test("13. a sourced preferred name is valid", () => {
  assert.ok(ok(assertion()));
});

test("14. two different names never imply same identity, different identity, or succession", () => {
  const first = assertion({ assertionId: "a-n1", objectLiteral: "Synthetic Jerusalem" });
  const second = assertion({
    assertionId: "a-n2",
    objectLiteral: "Synthetic Yerushalayim",
    nameType: "historical",
    evidence: evidence("e-n2"),
  });
  assert.ok(ok(first) && ok(second));
  // Both names attach to one resource. Nothing in the model derives identity,
  // distinctness, or political succession from the name strings themselves.
  assert.equal(first.subjectResourceId, second.subjectResourceId);
  assert.notEqual(first.objectLiteral, second.objectLiteral);
});

test("15. a name assertion requires a governed name type", () => {
  assert.ok(hasRule(assertion({ nameType: "nickname" as never }), "name-type-vocabulary"));
});

test("16. nameType is meaningless outside named_as", () => {
  const misplaced = assertion({
    predicate: "classified_as",
    objectLiteral: "settlement",
    nameType: "preferred",
  });
  assert.ok(hasRule(misplaced, "name-type-only-for-names"));
});

/* ------------------------------ CLASSIFICATION --------------------------- */

test("17. classification is a literal on a place and carries no geometry", () => {
  const classified = assertion({
    predicate: "classified_as",
    objectLiteral: "walled settlement",
    nameType: null,
    evidence: evidence("e-c1"),
  });
  assert.ok(ok(classified));
  assert.equal(classified.objectResourceId, null);
});

test("18. a polity cannot be geographically classified", () => {
  const wrong = assertion({
    subjectResourceId: "res-polity-a",
    predicate: "classified_as",
    objectLiteral: "walled settlement",
    nameType: null,
  });
  assert.ok(hasRule(wrong, "subject-type-permitted"));
});

/* --------------------------------- TEMPORAL ------------------------------ */

test("19. not_asserted carries no bounds and no description", () => {
  assert.deepEqual(validateEarthRootTemporal(EARTHROOT_TEMPORAL_NOT_ASSERTED), []);
  const smuggled = validateEarthRootTemporal({
    mode: "not_asserted",
    validFromYear: 1000,
    validUntilYear: null,
    description: null,
  });
  assert.ok(smuggled.some((v) => v.rule === "not-asserted-carries-no-bounds"));
});

test("20. not_asserted must not carry a validity description", () => {
  const smuggled = validateEarthRootTemporal({
    mode: "not_asserted",
    validFromYear: null,
    validUntilYear: null,
    description: "always",
  });
  assert.ok(
    smuggled.some((v) => v.rule === "not-asserted-carries-no-description"),
  );
});

test("21. inverted interval bounds are rejected", () => {
  const inverted = validateEarthRootTemporal({
    mode: "asserted",
    validFromYear: 1200,
    validUntilYear: 1100,
    description: null,
  });
  assert.ok(inverted.some((v) => v.rule === "temporal-bounds-ordered"));
});

test("22. an asserted validity with no content at all is rejected", () => {
  const empty = validateEarthRootTemporal({
    mode: "asserted",
    validFromYear: null,
    validUntilYear: null,
    description: null,
  });
  assert.ok(empty.some((v) => v.rule === "asserted-requires-content"));
});

test("23. BCE years are representable as signed integers", () => {
  assert.deepEqual(
    validateEarthRootTemporal({
      mode: "asserted",
      validFromYear: -586,
      validUntilYear: -538,
      description: "Synthetic interval expressed in signed years.",
    }),
    [],
  );
});

/* ---------------------------- POLITICAL CONTROL -------------------------- */

test("24. a time-bounded political-control assertion is valid", () => {
  const controlled = assertion({
    assertionId: "a-gov-1",
    predicate: "governed_by",
    objectResourceId: "res-polity-a",
    objectLiteral: null,
    nameType: null,
    temporal: {
      mode: "asserted",
      validFromYear: 1000,
      validUntilYear: 1100,
      description: "Synthetic control interval.",
    },
    evidence: evidence("e-gov-1"),
  });
  assert.ok(ok(controlled));
});

test("25. two successive control assertions coexist without collapsing polities", () => {
  const first = assertion({
    assertionId: "a-gov-1",
    predicate: "governed_by",
    objectResourceId: "res-polity-a",
    objectLiteral: null,
    nameType: null,
    temporal: { mode: "asserted", validFromYear: 1000, validUntilYear: 1100, description: null },
    evidence: evidence("e-gov-1"),
  });
  const second = assertion({
    assertionId: "a-gov-2",
    predicate: "governed_by",
    objectResourceId: "res-polity-b",
    objectLiteral: null,
    nameType: null,
    temporal: { mode: "asserted", validFromYear: 1101, validUntilYear: 1200, description: null },
    evidence: evidence("e-gov-2"),
  });
  assert.ok(ok(first) && ok(second));
  assert.notEqual(first.objectResourceId, second.objectResourceId);
  // The two polities remain separate identities; succession is not inferred.
  assert.equal(first.subjectResourceId, second.subjectResourceId);
});

/* --------------------------- IDENTITY SHORTCUTS -------------------------- */

test("26. released rejected identity evidence kinds remain rejected", () => {
  for (const kind of ["coordinate_only_match", "temporal_overlap_only", "name_only_match"]) {
    assert.ok(
      (REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind),
      `${kind} must remain a rejected identity evidence kind`,
    );
  }
});

test("27. EarthRoot mirrors those rejections and adds classification-only", () => {
  for (const signal of ["coordinate_only_match", "temporal_overlap_only", "name_only_match", "classification_only_match", "transitive_closure"]) {
    assert.ok(
      (EARTHROOT_REJECTED_IDENTITY_SIGNALS as readonly string[]).includes(signal),
    );
  }
});

test("28. EarthRoot defines no identity predicate at all", () => {
  for (const predicate of EARTHROOT_PREDICATES) {
    assert.ok(!predicate.includes("same_as"));
  }
});

/* -------------------------------- PROVENANCE ----------------------------- */

test("29. an assertion with no evidence is not canonical", () => {
  assert.ok(hasRule(assertion({ evidence: [] }), "evidence-required"));
});

test("30. a blank source locator is rejected", () => {
  const blank = assertion({
    evidence: [{ ...evidence("e-b")[0]!, sourceLocator: "   " }],
  });
  assert.ok(
    rules(blank).some((v) => v.rule === "evidence-field-required"),
  );
});

test("31. dataset and version provenance are required on evidence", () => {
  const missing = assertion({
    evidence: [{ ...evidence("e-m")[0]!, sourceDatasetVersion: "" }],
  });
  assert.ok(rules(missing).some((v) => v.rule === "evidence-field-required"));
});

test("32. a disputed assertion must record why", () => {
  const disputed = assertion({ disputeState: "disputed", uncertaintyStatement: null });
  assert.ok(hasRule(disputed, "dispute-requires-statement"));
});

/* ------------------------------ NO GEOMETRY ------------------------------ */

test("33. a coordinate-bearing resource is rejected", () => {
  const withCoords = { ...resources[0]!, latitude: 31.7683 } as unknown;
  assert.ok(
    validateEarthRootResource(withCoords).some((v) => v.rule === "no-spatial-data"),
  );
});

test("34. a geometry-bearing assertion is rejected", () => {
  const withGeometry = { ...assertion(), geometry: { type: "Point" } } as unknown as EarthRootAssertion;
  assert.ok(hasRule(withGeometry, "no-spatial-data"));
});
