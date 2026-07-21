import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDictionaryRootLemma } from "../src/services/lexical-store.js";

test("normalizeDictionaryRootLemma preserves phrase identity", () => {
  assert.equal(normalizeDictionaryRootLemma("  Market_Value  "), "market value");
  assert.equal(normalizeDictionaryRootLemma("VALUE"), "value");
  assert.equal(normalizeDictionaryRootLemma("light   value"), "light value");
});
