import assert from "node:assert/strict";
import test from "node:test";

import {
  EARTHROOT_NOT_ASSERTED_MEANING,
  EARTHROOT_REJECTED_IDENTITY_SIGNALS,
  EARTHROOT_TEMPORAL_NOT_ASSERTED,
} from "../src/earthroot/contract.js";
import { REJECTED_IDENTITY_EVIDENCE_KINDS } from "../src/sourceroot/identity-assertions.js";
import {
  buildResourceTypeIndex,
  type EarthRootAssertion,
  type EarthRootResource,
} from "../src/earthroot/domain.js";
import {
  EARTHROOT_MIXED_CERTAINTY,
  EARTHROOT_NO_CERTAINTY,
  EarthRootAdapterError,
  buildEarthRootPayload,
  buildEarthRootResultItem,
  deriveAggregateCertainty,
  deriveAggregateDerivation,
  deriveAggregateReviewState,
  deriveDisplayLabel,
  isEarthRootNetworkAvailable,
} from "../src/earthroot/adapter.js";
import { validateEarthRootPayload } from "../src/earthroot/payload.js";
import {
  mintEarthRootCanonicalPublicId,
  validateEarthRootAssertion,
} from "../src/earthroot/domain.js";
import {
  validateResponseAccounting,
  validateResultItem,
} from "../src/sourceroot/response-envelope.js";
import {
  canRootRespond,
  getRootRegistryEntry,
  validateRootRegistry,
} from "../src/sourceroot/root-registry.js";
import {
  getObjectTypeDefinition,
  networkObjectTypeForPersistenceType,
} from "../src/sourceroot/object-types.js";

const DATASET = "earthroot-synthetic-contract-fixture-v1";
const VERSION = "1.0.0";
const PLACE_ID = "11111111-1111-4111-8111-111111111111";
const POLITY_ID = "22222222-2222-4222-8222-222222222222";

const place: EarthRootResource = {
  resourceId: "res-place",
  datasetId: DATASET,
  datasetVersion: VERSION,
  entityType: "place",
  canonicalPublicId: PLACE_ID,
};
const polity: EarthRootResource = {
  resourceId: "res-polity",
  datasetId: DATASET,
  datasetVersion: VERSION,
  entityType: "polity",
  canonicalPublicId: POLITY_ID,
};
const resources = [place, polity];

function ev(id: string) {
  return [
    {
      evidenceId: id,
      sourceId: "synthetic-source",
      sourceLocator: "fixture:1",
      statement: "Synthetic fixture statement.",
      sourceDatasetId: DATASET,
      sourceDatasetVersion: VERSION,
      evidenceOrder: 1,
    },
  ];
}

const base = {
  datasetId: DATASET,
  objectResourceId: null as string | null,
  nameType: null as never,
  languageTag: null,
  script: null,
  temporal: EARTHROOT_TEMPORAL_NOT_ASSERTED,
  certainty: "source-bounded",
  uncertaintyStatement: null,
  reviewState: "unreviewed" as const,
  disputeState: "not_disputed" as const,
  assertionStatus: "active" as const,
  derivation: "directly_sourced" as const,
};

const assertions: EarthRootAssertion[] = [
  { ...base, assertionId: "a1", subjectResourceId: "res-place", predicate: "named_as", objectLiteral: "Synthetic Jerusalem", nameType: "preferred" as never, evidence: ev("e1") },
  { ...base, assertionId: "a2", subjectResourceId: "res-place", predicate: "named_as", objectLiteral: "Synthetic Yerushalayim", nameType: "historical" as never, evidence: ev("e2") },
  { ...base, assertionId: "a3", subjectResourceId: "res-place", predicate: "classified_as", objectLiteral: "walled settlement", evidence: ev("e3") },
  {
    ...base,
    assertionId: "a4",
    subjectResourceId: "res-place",
    predicate: "governed_by",
    objectResourceId: "res-polity",
    objectLiteral: null,
    temporal: { mode: "asserted", validFromYear: 1000, validUntilYear: 1100, description: "Synthetic control interval." },
    evidence: ev("e4"),
  },
];

const input = {
  resource: place,
  assertions,
  context: { resourceTypes: buildResourceTypeIndex(resources) },
  canonicalPublicIds: new Map(resources.map((r) => [r.resourceId, r.canonicalPublicId])),
  entityTypes: buildResourceTypeIndex(resources),
  resourceDatasets: new Map(resources.map((r) => [r.resourceId, r.datasetId])),
  canonicalUrl: null,
  // 15A ships synthetic fixtures only, and the flag is required, so the
  // fixture states it rather than relying on a default.
  fixtureOnly: true,
};

/* -------------------------------- PAYLOAD -------------------------------- */

test("1. a governed payload validates", () => {
  const payload = buildEarthRootPayload(input);
  assert.deepEqual(validateEarthRootPayload(payload), []);
  assert.equal(payload.entityType, "place");
  assert.equal(payload.displayLabel, "Synthetic Jerusalem");
});

test("2. the display label comes from a sourced preferred name", () => {
  assert.equal(deriveDisplayLabel(assertions), "Synthetic Jerusalem");
  const unsourced = assertions.map((a) =>
    a.assertionId === "a1" ? { ...a, evidence: [] } : a,
  );
  assert.equal(deriveDisplayLabel(unsourced), null);
});

test("3. an unknown top-level payload key fails closed", () => {
  const payload = { ...buildEarthRootPayload(input), extra: "leak" };
  assert.ok(
    validateEarthRootPayload(payload).some(
      (v) => v.rule === "payload-key-not-allowlisted",
    ),
  );
});

test("4. a database-shaped key fails closed", () => {
  const payload = { ...buildEarthRootPayload(input), resource_id: "res-place" };
  assert.ok(
    validateEarthRootPayload(payload).some(
      (v) => v.rule === "payload-key-not-allowlisted",
    ),
  );
});

test("5. a coordinate key in the payload fails closed", () => {
  const payload = { ...buildEarthRootPayload(input), latitude: 31.7683 };
  const violations = validateEarthRootPayload(payload);
  assert.ok(violations.some((v) => v.rule === "payload-key-not-allowlisted"));
  assert.ok(violations.some((v) => v.rule === "payload-no-spatial-data"));
});

test("6. every payload temporal block states its meaning", () => {
  const payload = buildEarthRootPayload(input);
  for (const name of payload.names) {
    assert.equal(name.temporal.meaning, EARTHROOT_NOT_ASSERTED_MEANING);
  }
  const governed = payload.relationshipSummaries[0]!;
  assert.equal(governed.temporal.mode, "asserted");
  assert.notEqual(governed.temporal.meaning, EARTHROOT_NOT_ASSERTED_MEANING);
});

test("7. a payload entry with zero evidence fails closed", () => {
  const payload = buildEarthRootPayload(input);
  const tampered = {
    ...payload,
    names: [{ ...payload.names[0]!, evidenceCount: 0 }],
  };
  assert.ok(
    validateEarthRootPayload(tampered).some(
      (v) => v.rule === "payload-evidence-count",
    ),
  );
});

/* ------------------------------ RESULT ITEM ------------------------------ */

test("8. a valid EarthRoot item satisfies the released contract unchanged", () => {
  const item = buildEarthRootResultItem(input);
  assert.deepEqual(validateResultItem(item), []);
  assert.equal(item.rootId, "EarthRoot");
  assert.equal(item.objectType, "place");
  assert.equal(item.semanticConclusion, null);
});

test("9. the address is coherent with every item component", () => {
  const item = buildEarthRootResultItem(input);
  assert.equal(
    item.address,
    `sourceroot:EarthRoot/place/${PLACE_ID}@${DATASET}:${VERSION}`,
  );
});

test("10. a missing required result field is rejected by the released validator", () => {
  const item = buildEarthRootResultItem(input);
  const { provenanceSummary, ...withoutProvenance } = item;
  assert.ok(validateResultItem(withoutProvenance).length > 0);
});

test("11. an address that disagrees with the item is rejected", () => {
  const item = buildEarthRootResultItem(input);
  const mismatched = {
    ...item,
    address: `sourceroot:EarthRoot/place/${POLITY_ID}@${DATASET}:${VERSION}`,
  };
  assert.ok(validateResultItem(mismatched).length > 0);
});

test("12. a dataset-version mismatch is rejected", () => {
  const item = buildEarthRootResultItem(input);
  assert.ok(validateResultItem({ ...item, datasetVersion: "9.9.9" }).length > 0);
});

test("13. a wrong Root is rejected", () => {
  const item = buildEarthRootResultItem(input);
  assert.ok(validateResultItem({ ...item, rootId: "NotARoot" }).length > 0);
});

test("14. an unsupported object type is rejected", () => {
  const item = buildEarthRootResultItem(input);
  assert.ok(validateResultItem({ ...item, objectType: "spaceship" }).length > 0);
});

test("15. the item temporal summary never claims timelessness", () => {
  const item = buildEarthRootResultItem(input);
  assert.equal(item.temporalSummary.mode, "not_asserted");
  assert.equal(item.temporalSummary.asserted, false);
  assert.doesNotMatch(
    item.temporalSummary.description,
    /timeless|always|for all time/iu,
    "absence of a temporal assertion is not timelessness",
  );
});

test("16. an unsourced assertion prevents item construction entirely", () => {
  assert.throws(
    () =>
      buildEarthRootResultItem({
        ...input,
        assertions: assertions.map((a) =>
          a.assertionId === "a4" ? { ...a, evidence: [] } : a,
        ),
      }),
    EarthRootAdapterError,
  );
});

/* ------------------------- AVAILABILITY BOUNDARY -------------------------- */

test("17. EarthRoot remains a planned Root", () => {
  const entry = getRootRegistryEntry("EarthRoot");
  assert.ok(entry);
  assert.equal(entry.lifecycle, "planned");
  assert.equal(entry.networkRuntimeState, "not-implemented");
  assert.equal(entry.rootContractVersion, null);
});

test("18. EarthRoot cannot respond, despite the adapter existing", () => {
  assert.equal(canRootRespond("EarthRoot"), false);
  assert.equal(isEarthRootNetworkAvailable(), false);
});

test("19. no EarthRoot object type is IMPLEMENTED or PROVIDED", () => {
  const entry = getRootRegistryEntry("EarthRoot")!;
  for (const provision of entry.objectTypes) {
    assert.equal(provision.implemented, false, `${provision.objectType} implemented`);
    assert.equal(provision.provided, false, `${provision.objectType} provided`);
  }
});

test("20. EarthRoot declares no released dataset", () => {
  assert.deepEqual([...getRootRegistryEntry("EarthRoot")!.datasets], []);
});

test("21. the released registry remains internally consistent", () => {
  assert.deepEqual(validateRootRegistry(), []);
});

test("22. place and polity remain DEFINED and owned by EarthRoot", () => {
  for (const objectType of ["place", "polity"] as const) {
    const definition = getObjectTypeDefinition(objectType);
    assert.ok(definition);
    assert.equal(definition.plannedOwner, "EarthRoot");
  }
});

test("23. EarthRoot persistence types map through the shared table", () => {
  assert.equal(networkObjectTypeForPersistenceType("place"), "place");
  assert.equal(networkObjectTypeForPersistenceType("polity"), "polity");
});

test("24. spatial query support is neither declared nor implemented", () => {
  const entry = getRootRegistryEntry("EarthRoot")!;
  assert.equal(entry.capabilities.spatialQuery, false);
});

/* ------------------------- WAVE 5 NEGATIVE CONTROLS -------------------------
 *
 * Each control proves a Wave 5 repair actually DETECTS the defect it claims to
 * prevent. A control that cannot fail proves nothing, so every one below shows
 * the defective input being rejected AND the corrected input being accepted,
 * so no check passes merely by refusing everything.
 * ------------------------------------------------------------------------- */

const withAssertions = (extra: EarthRootAssertion[], replace = false) => ({
  ...input,
  assertions: replace ? extra : [...assertions, ...extra],
});

test("NC-1. a REJECTED assertion contributes no evidence, no name, and no count", () => {
  const clean = buildEarthRootResultItem(input);
  const withRejected = buildEarthRootResultItem(
    withAssertions([
      {
        ...base,
        assertionId: "nc1",
        subjectResourceId: "res-place",
        predicate: "named_as",
        objectLiteral: "Repudiated Name",
        nameType: "preferred" as never,
        reviewState: "rejected" as const,
        evidence: [...ev("nc1-e1"), { ...ev("nc1-e2")[0]!, evidenceOrder: 2 }],
      },
    ]),
  );
  assert.equal(
    withRejected.provenanceSummary.evidenceCount,
    clean.provenanceSummary.evidenceCount,
    "rejected material must not inflate the public evidence count",
  );
  const labels = (withRejected.rootPayload as never as { names: { label: string }[] }).names.map(
    (n) => n.label,
  );
  assert.ok(!labels.includes("Repudiated Name"), "a rejected name must never be published");
});

test("NC-2. a WITHDRAWN assertion contributes nothing either", () => {
  const clean = buildEarthRootResultItem(input);
  const withWithdrawn = buildEarthRootResultItem(
    withAssertions([
      {
        ...base,
        assertionId: "nc2",
        subjectResourceId: "res-place",
        predicate: "classified_as",
        objectLiteral: "withdrawn classification",
        assertionStatus: "withdrawn" as const,
        evidence: ev("nc2-e1"),
      },
    ]),
  );
  assert.equal(withWithdrawn.provenanceSummary.evidenceCount, clean.provenanceSummary.evidenceCount);
  const classes = (
    withWithdrawn.rootPayload as never as { classifications: { label: string }[] }
  ).classifications.map((cls) => cls.label);
  assert.ok(!classes.includes("withdrawn classification"));
});

test("NC-3. derivation is DERIVED, not hardcoded: one human_proposed contribution downgrades it", () => {
  const allSourced = buildEarthRootResultItem(input);
  assert.equal(allSourced.provenanceSummary.derivation, "directly_sourced");

  const mixed = buildEarthRootResultItem(
    withAssertions([
      {
        ...base,
        assertionId: "nc3",
        subjectResourceId: "res-place",
        predicate: "classified_as",
        objectLiteral: "proposed classification",
        derivation: "human_proposed" as const,
        evidence: ev("nc3-e1"),
      },
    ]),
  );
  assert.equal(
    mixed.provenanceSummary.derivation,
    "human_proposed",
    "a result containing proposed material must not advertise itself as directly sourced",
  );
});

test("NC-4. a lying entityTypes map FAILS instead of being published", () => {
  const lying = new Map(input.entityTypes);
  lying.set("res-polity", "place");
  assert.throws(
    () => buildEarthRootResultItem({ ...input, entityTypes: lying }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "input-entity-type-disagreement"),
    "a caller map that contradicts the validated context must fail closed",
  );
  assert.doesNotThrow(() => buildEarthRootResultItem(input));
});

test("NC-5. a context that disagrees with the resource itself FAILS", () => {
  const wrong = new Map(input.context.resourceTypes);
  wrong.set("res-place", "polity");
  assert.throws(
    () => buildEarthRootResultItem({ ...input, context: { resourceTypes: wrong } }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "input-resource-type-disagreement"),
  );
});

test("NC-6. a relationship object with no known entity type FAILS rather than publishing an empty class", () => {
  const missing = new Map(input.entityTypes);
  missing.delete("res-polity");
  assert.throws(
    () => buildEarthRootResultItem({ ...input, entityTypes: missing }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "relationship-object-type-missing"),
    "an empty objectEntityType must never reach a consumer",
  );
});

test("NC-7. a substituted not_asserted meaning FAILS: the sentence is pinned", () => {
  const payload = buildEarthRootPayload(input);
  assert.deepEqual(validateEarthRootPayload(payload), []);

  const tampered = JSON.parse(JSON.stringify(payload));
  const target = tampered.names.find(
    (n: { temporal: { mode: string } }) => n.temporal.mode === "not_asserted",
  );
  assert.ok(target, "fixture must contain a not_asserted block for this control to mean anything");
  target.temporal.meaning = "This name is valid for all time.";
  assert.ok(
    validateEarthRootPayload(tampered).some(
      (v) => v.rule === "payload-not-asserted-meaning-pinned",
    ),
    "a rewritten meaning could assert timelessness and must be rejected",
  );
});

test("NC-8. a DISPUTED preferred name never becomes the identity string", () => {
  const disputedFixture: EarthRootAssertion[] = [
    {
      ...base,
      assertionId: "nc8a",
      subjectResourceId: "res-place",
      predicate: "named_as",
      objectLiteral: "Contested Name",
      nameType: "preferred" as never,
      reviewState: "disputed" as const,
      disputeState: "disputed" as const,
      uncertaintyStatement: "Two synthetic sources disagree about this name.",
      evidence: ev("nc8-e1"),
    },
    {
      ...base,
      assertionId: "nc8b",
      subjectResourceId: "res-place",
      predicate: "named_as",
      objectLiteral: "Undisputed Name",
      nameType: "preferred" as never,
      evidence: ev("nc8-e2"),
    },
  ];
  assert.equal(deriveDisplayLabel(disputedFixture), "Undisputed Name");

  const item = buildEarthRootResultItem(withAssertions(disputedFixture, true));
  const payload = item.rootPayload as never as {
    displayLabel: string;
    names: { label: string; disputed: boolean; preferredDisplay: boolean }[];
  };
  assert.notEqual(payload.displayLabel, "Contested Name");
  const contested = payload.names.find((n) => n.label === "Contested Name")!;
  assert.equal(contested.disputed, true);
  assert.equal(contested.preferredDisplay, false, "a contested name must not be flagged for display");
});

test("NC-9. a dispute propagates into review, certainty, and the uncertainty statement", () => {
  const clean = buildEarthRootResultItem(input);
  assert.equal(clean.reviewSummary.reviewState, "unreviewed");
  assert.equal(clean.uncertaintySummary.disputed, false);

  const disputed = buildEarthRootResultItem(
    withAssertions([
      {
        ...base,
        assertionId: "nc9",
        subjectResourceId: "res-place",
        predicate: "classified_as",
        objectLiteral: "contested classification",
        reviewState: "disputed" as const,
        disputeState: "disputed" as const,
        uncertaintyStatement: "Synthetic sources disagree about this classification.",
        evidence: ev("nc9-e1"),
      },
    ]),
  );
  assert.equal(disputed.reviewSummary.reviewState, "disputed");
  assert.equal(disputed.reviewSummary.reviewed, false);
  assert.equal(disputed.uncertaintySummary.disputed, true);
  assert.match(String(disputed.uncertaintySummary.uncertaintyStatement), /disagree/);
});

test("NC-10. reviewed is never claimed unless EVERY contribution was accepted after review", () => {
  const accepted = assertions.map((a) => ({ ...a, reviewState: "accepted_after_review" as const }));
  assert.equal(deriveAggregateReviewState(accepted), "accepted_after_review");
  assert.equal(buildEarthRootResultItem(withAssertions(accepted, true)).reviewSummary.reviewed, true);

  const partial = [...accepted.slice(1), { ...accepted[0]!, reviewState: "unreviewed" as const }];
  assert.equal(
    deriveAggregateReviewState(partial),
    "unreviewed",
    "one unreviewed contribution must sink the whole claim",
  );
  assert.equal(buildEarthRootResultItem(withAssertions(partial, true)).reviewSummary.reviewed, false);
});

test("NC-11. evidenceOrder 0 is rejected by the application, matching the database CHECK", () => {
  const bad: EarthRootAssertion = {
    ...base,
    assertionId: "nc11",
    subjectResourceId: "res-place",
    predicate: "classified_as",
    objectLiteral: "ordered classification",
    evidence: [{ ...ev("nc11-e1")[0]!, evidenceOrder: 0 }],
  };
  assert.ok(
    validateEarthRootAssertion(bad, input.context).some(
      (v) => v.rule === "evidence-order-integer",
    ),
    "the application must not certify a bundle the database will reject at COMMIT",
  );
  assert.deepEqual(
    validateEarthRootAssertion({ ...bad, evidence: ev("nc11-e2") }, input.context),
    [],
  );
});

test("NC-12. the synthetic disclosure is required, and its absence FAILS rather than defaults to real", () => {
  // 15A ships synthetic fixtures only. An optional flag defaulting to false
  // would mean the whole corpus published undisclosed whenever a caller simply
  // omitted it, so omission must fail closed instead.
  const { fixtureOnly: _omitted, ...withoutFlag } = input;
  assert.throws(
    () => buildEarthRootResultItem(withoutFlag as never),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "fixture-disclosure-required"),
    "silence must never be readable as 'this is real'",
  );

  const synthetic = buildEarthRootResultItem({ ...input, fixtureOnly: true });
  assert.match(String(synthetic.uncertaintySummary.uncertaintyStatement), /synthetic/i);

  const real = buildEarthRootResultItem({ ...input, fixtureOnly: false });
  assert.doesNotMatch(
    String(real.uncertaintySummary.uncertaintyStatement ?? ""),
    /synthetic/i,
    "the disclosure tracks the dataset rather than being emitted unconditionally",
  );
});

test("NC-22. two undisputed preferred names are AMBIGUOUS, not resolved by array order", () => {
  const derry: EarthRootAssertion = {
    ...base,
    assertionId: "nc22a",
    subjectResourceId: "res-place",
    predicate: "named_as",
    objectLiteral: "Derry",
    nameType: "preferred" as never,
    evidence: ev("nc22-e1"),
  };
  const londonderry: EarthRootAssertion = {
    ...derry,
    assertionId: "nc22b",
    objectLiteral: "Londonderry",
    evidence: ev("nc22-e2"),
  };

  // Order must not decide a contested public identity.
  assert.equal(deriveDisplayLabel([derry, londonderry]), null);
  assert.equal(deriveDisplayLabel([londonderry, derry]), null);
  assert.equal(deriveDisplayLabel([derry]), "Derry");

  // displayLabel is required non-empty, so the ambiguity surfaces as a failure
  // rather than as a silently chosen name.
  assert.throws(
    () => buildEarthRootResultItem(withAssertions([derry, londonderry], true)),
    (e: unknown) => e instanceof EarthRootAdapterError,
    "an ambiguous identity must not be published",
  );
});

test("NC-23. a relationship object from another dataset, or the resource itself, is refused", () => {
  const foreignDatasets = new Map(input.resourceDatasets);
  foreignDatasets.set("res-polity", "another-dataset");
  assert.throws(
    () => buildEarthRootResultItem({ ...input, resourceDatasets: foreignDatasets }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "relationship-object-dataset-disagreement"),
    "an unqualified canonicalPublicId cannot span datasets",
  );

  const collidingIds = new Map(input.canonicalPublicIds);
  collidingIds.set("res-polity", place.canonicalPublicId);
  assert.throws(
    () => buildEarthRootResultItem({ ...input, canonicalPublicIds: collidingIds }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "relationship-object-is-self"),
    "a place must never be published as governed by or contained in itself",
  );
});

test("NC-29. a name- or coordinate-derived object identity is refused", () => {
  // Only the SUBJECT canonicalPublicId was gated, so a caller map could publish
  // a name or a coordinate string as an entity's canonical identity.
  for (const derived of ["Londonderry", "54.9966,-7.3086", "place-jerusalem"]) {
    const lying = new Map(input.canonicalPublicIds);
    lying.set("res-polity", derived);
    assert.throws(
      () => buildEarthRootResultItem({ ...input, canonicalPublicIds: lying }),
      (e: unknown) =>
        e instanceof EarthRootAdapterError &&
        e.violations.some((v) => v.rule === "relationship-object-id-not-opaque"),
      `identity must never be derived from ${derived}`,
    );
  }
  // An opaque minted identifier is still accepted, so the check is not simply
  // refusing every object.
  const minted = new Map(input.canonicalPublicIds);
  minted.set("res-polity", mintEarthRootCanonicalPublicId());
  assert.doesNotThrow(() => buildEarthRootResultItem({ ...input, canonicalPublicIds: minted }));
});

test("NC-24. the published source locator follows evidenceOrder, not caller array order", () => {
  const scrambled: EarthRootAssertion = {
    ...base,
    assertionId: "nc24",
    subjectResourceId: "res-place",
    predicate: "named_as",
    objectLiteral: "Ordered Name",
    nameType: "preferred" as never,
    evidence: [
      { ...ev("nc24-e2")[0]!, evidenceOrder: 2, sourceLocator: "fixture:SECOND" },
      { ...ev("nc24-e1")[0]!, evidenceOrder: 1, sourceLocator: "fixture:FIRST" },
    ],
  };
  const item = buildEarthRootResultItem(withAssertions([scrambled], true));
  assert.equal(item.provenanceSummary.sourceLocator, "fixture:FIRST");
});

test("NC-25. a stated uncertainty is surfaced even when the assertion is not formally disputed", () => {
  const hedged = buildEarthRootResultItem(
    withAssertions([
      {
        ...base,
        assertionId: "nc25",
        subjectResourceId: "res-place",
        predicate: "classified_as",
        objectLiteral: "hedged classification",
        uncertaintyStatement: "The source hedges: possibly conflated with a nearby settlement.",
        evidence: ev("nc25-e1"),
      },
    ]),
  );
  assert.match(
    String(hedged.uncertaintySummary.uncertaintyStatement),
    /hedges/,
    "a source's own hedge must not be discarded just because nobody filed a dispute",
  );
});

test("NC-13. aggregation helpers degrade conservatively on an empty contributing set", () => {
  assert.equal(deriveAggregateDerivation([]), "human_proposed");
  assert.equal(deriveAggregateReviewState([]), "unreviewed");
  assert.equal(deriveAggregateCertainty([]), EARTHROOT_NO_CERTAINTY);
  assert.equal(deriveDisplayLabel([]), null);
});

test("NC-14. the item temporal summary is DERIVED from the payload, and never contradicts it", () => {
  // The fixture carries an asserted governed_by interval, so the summary must
  // not borrow the "no temporal validity was asserted" sentence: that would be
  // a false statement about what sources asserted.
  const withAsserted = buildEarthRootResultItem(input);
  const payload = withAsserted.rootPayload as never as {
    relationshipSummaries: { temporal: { mode: string } }[];
  };
  assert.ok(
    payload.relationshipSummaries.some((r) => r.temporal.mode === "asserted"),
    "fixture must carry an asserted interval for this control to mean anything",
  );
  assert.notEqual(
    withAsserted.temporalSummary.description,
    EARTHROOT_NOT_ASSERTED_MEANING,
    "a summary must not state that nothing was asserted while its payload asserts intervals",
  );

  // With no asserted contribution anywhere, the released meaning is used verbatim.
  const namesOnly = assertions.filter((a) => a.predicate === "named_as");
  const noneAsserted = buildEarthRootResultItem(withAssertions(namesOnly, true));
  assert.equal(
    noneAsserted.temporalSummary.description,
    EARTHROOT_NOT_ASSERTED_MEANING,
    "absence must still be reported with the pinned meaning, not reworded",
  );
});

test("NC-26. an asserted interval is not described as directly source-asserted", () => {
  // A human_proposed contribution may still carry evidence. The temporal
  // meaning states the SEMANTIC state; derivation is reported separately.
  const proposed: EarthRootAssertion = {
    ...base,
    assertionId: "nc26",
    subjectResourceId: "res-place",
    predicate: "governed_by",
    objectResourceId: "res-polity",
    objectLiteral: null,
    derivation: "human_proposed" as const,
    temporal: {
      mode: "asserted",
      validFromYear: 1200,
      validUntilYear: 1300,
      description: "Synthetic proposed interval.",
    },
    evidence: ev("nc26-e1"),
  };
  const item = buildEarthRootResultItem(
    withAssertions([...assertions.filter((a) => a.predicate !== "governed_by"), proposed], true),
  );
  const payload = item.rootPayload as never as {
    relationshipSummaries: { temporal: { mode: string; meaning: string } }[];
  };
  const asserted = payload.relationshipSummaries.find((r) => r.temporal.mode === "asserted")!;
  assert.doesNotMatch(
    asserted.temporal.meaning,
    /asserted by a source|source asserted/iu,
    "a human_proposed interval must not claim a source asserted it",
  );
  assert.equal(item.provenanceSummary.derivation, "human_proposed");
});

test("NC-27. duplicate identical evidence does not inflate evidenceCount", () => {
  const duplicated: EarthRootAssertion = {
    ...base,
    assertionId: "nc27",
    subjectResourceId: "res-place",
    predicate: "classified_as",
    objectLiteral: "counted classification",
    evidence: [
      { ...ev("nc27-e1")[0]! },
      // Same source, locator, statement and dataset provenance: one support.
      { ...ev("nc27-e1")[0]!, evidenceId: "nc27-e2", evidenceOrder: 2 },
    ],
  };
  // A preferred name is retained so the payload stays publishable; the
  // assertion under test is the classification.
  const preferredName = assertions.find((a) => a.nameType === "preferred")!;
  const countFor = (assertion: EarthRootAssertion) => {
    const item = buildEarthRootResultItem(withAssertions([preferredName, assertion], true));
    const payload = item.rootPayload as never as {
      classifications: { label: string; evidenceCount: number }[];
    };
    return payload.classifications.find((c) => c.label === "counted classification")!.evidenceCount;
  };

  assert.equal(countFor(duplicated), 1, "materially identical evidence is one support");

  const genuinelyTwo: EarthRootAssertion = {
    ...duplicated,
    evidence: [
      { ...ev("nc27-e1")[0]! },
      { ...ev("nc27-e1")[0]!, evidenceId: "nc27-e3", evidenceOrder: 2, sourceLocator: "fixture:2" },
    ],
  };
  assert.equal(countFor(genuinelyTwo), 2, "distinct locators remain distinct support");
});

test("NC-28. an invalid languageTag or script is rejected at the DOMAIN boundary", () => {
  const bad = (patch: Partial<EarthRootAssertion>): EarthRootAssertion => ({
    ...base,
    assertionId: "nc28",
    subjectResourceId: "res-place",
    predicate: "named_as",
    objectLiteral: "Some Name",
    nameType: "preferred" as never,
    evidence: ev("nc28-e1"),
    ...patch,
  });
  const rules = (a: EarthRootAssertion) =>
    validateEarthRootAssertion(a, input.context).map((v) => v.rule);

  assert.ok(rules(bad({ languageTag: "not a tag!" })).includes("language-tag-shape"));
  assert.ok(rules(bad({ languageTag: "   " })).includes("language-tag-shape"));
  assert.ok(rules(bad({ script: "latin" })).includes("script-shape"));
  assert.ok(rules(bad({ script: "" })).includes("script-shape"));
  assert.ok(rules(bad({ objectLiteral: "   " })).includes("name-literal-meaningful"));

  // Valid values still pass, so the check is not simply refusing everything.
  assert.deepEqual(rules(bad({ languageTag: "en-GB", script: "Latn" })), []);
  assert.deepEqual(rules(bad({ languageTag: null, script: null })), []);
});

test("NC-15. the released envelope REJECTS an EarthRoot item, because EarthRoot cannot respond", () => {
  // 15A can build a contract-valid item for a planned Root. The only thing
  // keeping that item out of a response lives in a released file EarthRoot does
  // not own, so it is pinned here rather than assumed.
  const item = buildEarthRootResultItem(input);
  const violations = validateResponseAccounting({
    requestedRoots: ["EarthRoot"],
    respondingRoots: [],
    unavailableRoots: [
      {
        rootId: "EarthRoot",
        reason: "root-not-implemented",
        detail: "EarthRoot is a planned Root and cannot respond in Chunk 15A.",
      },
    ],
    items: [item],
    rootContractVersions: { EarthRoot: null },
    pagination: { limit: 10, offset: 0 },
    total: 0,
  } as never);
  assert.ok(
    violations.some((v) => v.rule === "item-root-not-responding"),
    "a planned Root's item must never be publishable in a response envelope",
  );
});

test("NC-16. an assertion from another dataset cannot supply this result's provenance", () => {
  const foreign: EarthRootAssertion = {
    ...base,
    datasetId: "some-other-dataset",
    assertionId: "nc16",
    subjectResourceId: "res-place",
    predicate: "classified_as",
    objectLiteral: "foreign classification",
    evidence: ev("nc16-e1"),
  };
  assert.throws(
    () => buildEarthRootResultItem(withAssertions([foreign])),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "assertion-dataset-disagreement"),
    "provenance must never be attributed to a dataset that did not contain it",
  );
});

test("NC-17. a dataset version the released address grammar rejects fails as an EarthRoot error", () => {
  assert.throws(
    () =>
      buildEarthRootResultItem({
        ...input,
        resource: { ...place, datasetVersion: "v1" },
      }),
    (e: unknown) =>
      e instanceof EarthRootAdapterError &&
      e.violations.some((v) => v.rule === "resource-not-addressable"),
    "a foreign error type must not escape a module that promises to fail closed",
  );
});

test("NC-18. a contested synthetic record keeps BOTH its dispute text and its fixture disclosure", () => {
  const item = buildEarthRootResultItem({
    ...input,
    fixtureOnly: true,
    assertions: [
      ...assertions,
      {
        ...base,
        assertionId: "nc18",
        subjectResourceId: "res-place",
        predicate: "classified_as",
        objectLiteral: "contested classification",
        reviewState: "disputed" as const,
        disputeState: "disputed" as const,
        uncertaintyStatement: "Synthetic sources disagree here.",
        evidence: ev("nc18-e1"),
      },
    ],
  });
  const statement = String(item.uncertaintySummary.uncertaintyStatement);
  assert.match(statement, /synthetic EarthRoot fixture/i, "the fixture disclosure must survive a dispute");
  assert.match(statement, /disagree/, "the dispute text must still be present");
});

test("NC-19. certainty is never smoothed into a value no contribution asserted", () => {
  const disagreeing = [
    { ...assertions[0]!, certainty: "high" },
    { ...assertions[1]!, certainty: "attested" },
  ];
  assert.equal(deriveAggregateCertainty(disagreeing), EARTHROOT_MIXED_CERTAINTY);
  assert.notEqual(deriveAggregateCertainty(disagreeing), "source-bounded");

  const unanimous = disagreeing.map((a) => ({ ...a, certainty: "high" }));
  assert.equal(deriveAggregateCertainty(unanimous), "high", "a unanimous certainty is reported verbatim");
});

test("NC-20. EarthRoot's rejected identity signals are a SUPERSET of the released list", () => {
  for (const kind of REJECTED_IDENTITY_EVIDENCE_KINDS) {
    assert.ok(
      (EARTHROOT_REJECTED_IDENTITY_SIGNALS as readonly string[]).includes(kind),
      `EarthRoot must not narrow the released prohibition by dropping ${kind}`,
    );
  }
  assert.ok(
    (EARTHROOT_REJECTED_IDENTITY_SIGNALS as readonly string[]).includes("classification_only_match"),
    "EarthRoot adds its own classification-only rejection on top",
  );
});

test("NC-21. payload fields are shape-checked when a validity IS asserted, not only when absent", () => {
  const payload = buildEarthRootPayload(input);
  const tampered = JSON.parse(JSON.stringify(payload));
  const relationship = tampered.relationshipSummaries.find(
    (r: { temporal: { mode: string } }) => r.temporal.mode === "asserted",
  );
  assert.ok(relationship, "fixture must contain an asserted temporal block");
  relationship.temporal.validFromYear = { sourceRowId: "cr_4412" };
  assert.ok(
    validateEarthRootPayload(tampered).some((v) => v.rule === "payload-temporal-bound-type"),
    "an arbitrary object must not ride out through an asserted year bound",
  );

  const tampered2 = JSON.parse(JSON.stringify(payload));
  tampered2.names[0].languageTag = { internal: "leak" };
  assert.ok(
    validateEarthRootPayload(tampered2).some((v) => v.rule === "payload-name-languagetag"),
    "languageTag is enumerated in the allowlist and must be shape-checked",
  );
});
