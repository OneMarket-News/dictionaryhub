import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildDictionaryRootPilotBundle,
  loadWordNetSynsets,
  parseWordNetDataLine,
} from "../src/dictionaryroot/oewn-wndb.js";
import { validateBundle } from "../src/services/validator.js";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/oewn-mini/", import.meta.url));

test("parseWordNetDataLine reads lemmas, pointers, definition, and examples", () => {
  const synset = parseWordNetDataLine(
    '00001740 03 n 02 entity 0 something 0 001 ~ 00001930 n 0000 | that which is perceived; "an example entity"',
    "n",
  );

  assert.ok(synset);
  assert.equal(synset.key, "n:00001740");
  assert.deepEqual(synset.lemmas, ["entity", "something"]);
  assert.equal(synset.definition, "that which is perceived");
  assert.deepEqual(synset.examples, ["an example entity"]);
  assert.equal(synset.pointers[0]?.targetOffset, "00001930");
});

test("DictionaryRoot pilot bundle validates with zero errors and warnings", async () => {
  const synsets = await loadWordNetSynsets(fixtureDirectory);
  const bundle = buildDictionaryRootPilotBundle(synsets, {
    limit: 8,
    sourceVersion: "test",
    bundleId: "dictionaryroot-oewn-test-pilot",
    createdAt: "2026-07-19",
    seeds: ["entity", "move", "good", "quickly"],
  });
  const result = validateBundle(bundle);

  assert.equal(result.status, "ready");
  assert.equal(result.canImport, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.equal(result.summary.nodes, 8);
  assert.ok(result.summary.assertions >= 8);
  assert.ok(result.summary.edges >= 4);
  assert.equal(result.summary.sources, 1);
  assert.equal(result.summary.revisions, 1);
});

test("DictionaryRoot pilot selection is deterministic", async () => {
  const synsets = await loadWordNetSynsets(fixtureDirectory);
  const options = {
    limit: 6,
    sourceVersion: "test",
    bundleId: "dictionaryroot-deterministic-test",
    createdAt: "2026-07-19",
    seeds: ["entity", "move"],
  };

  const first = buildDictionaryRootPilotBundle(synsets, options);
  const second = buildDictionaryRootPilotBundle(synsets, options);

  assert.deepEqual(first, second);
});
