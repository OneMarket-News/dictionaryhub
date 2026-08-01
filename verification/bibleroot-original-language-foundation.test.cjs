const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "bibleroot-passage.html"), "utf8");
const api = fs.readFileSync(path.join(root, "assets/js/bibleroot-api.js"), "utf8");
const passage = fs.readFileSync(path.join(root, "assets/js/bibleroot-passage.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/bibleroot.css"), "utf8");

function ids(markup) {
  return [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
}

test("1. passage HTML retains unique IDs and resolvable local assets", () => {
  const values = ids(html);
  assert.equal(new Set(values).size, values.length);
  for (const match of html.matchAll(/(?:src|href)="([^"?#]+)[^"]*"/g)) {
    if (/^(?:https?:|#)/.test(match[1])) continue;
    assert.equal(fs.existsSync(path.join(root, match[1])), true, match[1]);
  }
});

test("2. original-language panel is subordinate to KJV verses", () => {
  assert.ok(html.indexOf('id="bibleRootPassageVerses"') < html.indexOf('id="bibleRootOriginalLanguage"'));
  assert.match(html, /subordinate to the verified KJV passage/);
});

test("3. panel has an accessible label, live status, and busy token region", () => {
  assert.match(html, /aria-labelledby="bibleRootOriginalLanguageTitle"/);
  assert.match(html, /id="bibleRootOriginalLanguageStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="bibleRootOriginalLanguageVerses"[^>]+aria-live="polite"[^>]+aria-busy="true"/);
});

test("4. API client exposes only read requests for original-language data", () => {
  assert.match(api, /originalLanguageEditions:\s*\(\) => get/);
  assert.match(api, /originalLanguagePassage:[\s\S]+get\(/);
  assert.doesNotMatch(api, /\bpost\b|\bput\b|\bdelete\b/i);
});

test("5. customer script requests the live API without fallback data", () => {
  assert.match(passage, /BibleRootApi\.originalLanguagePassage\(reference\)/);
  assert.doesNotMatch(passage, /fallbackOriginal|staticLanguage|sampleTokens/);
  assert.match(passage, /No fallback or substitute data was displayed/);
});

test("6. Hebrew rendering receives API-provided RTL direction", () => {
  assert.match(passage, /article\.dir = payload\.direction/);
  assert.match(passage, /payload\.direction === "rtl" \? "Hebrew" : "Greek"/);
  assert.match(css, /\.br-original-verse\[dir="rtl"\]/);
});

test("7. Greek rendering remains explicitly identified", () => {
  assert.match(passage, /"Greek"/);
  assert.match(passage, /surface\.lang = edition\.language/);
});

test("8. source tokens retain API order and sequence positions", () => {
  assert.match(passage, /payload\.verses\.forEach/);
  assert.match(passage, /verse\.tokens\.forEach/);
  assert.match(passage, /dataset\.sequencePosition = String\(token\.sequencePosition\)/);
});

test("9. verbatim surface, lemma, and morphology codes are displayed", () => {
  assert.match(passage, /token\.surfaceForm/);
  assert.match(passage, /token\.lemma\.verbatim/);
  assert.match(passage, /morphology\.verbatimCode/);
});

test("10. incomplete and ambiguous analysis states are explicit", () => {
  assert.match(passage, /not yet analyzed/);
  assert.match(passage, /analysisStatus/);
  assert.match(passage, /br-analysis-state/);
});

test("11. source-native IDs are available without visible ID clutter", () => {
  assert.match(passage, /dataset\.sourceNativeTokenId/);
  assert.match(passage, /Source-native word ID/);
  assert.doesNotMatch(html, /source-native word ID/i);
});

test("12. Psalm superscription mapping explanation is rendered", () => {
  assert.match(passage, /mapping\.mappingType === "one_to_one"/);
  assert.match(passage, /mapping\.factualExplanation/);
  assert.match(css, /omitted_or_untranslated/);
});

test("13. original-language provenance exposes immutable artifact hashes", () => {
  assert.match(passage, /artifact\.byteLength\.toLocaleString/);
  assert.match(passage, /artifact\.sha256/);
  assert.match(passage, /artifact\.sourceUrl/);
});

test("14. component-specific rights and attribution are visible", () => {
  assert.match(passage, /artifact\.rightsComponents\.forEach/);
  assert.match(passage, /component\.rightsStatement/);
  assert.match(passage, /component\.attribution/);
});

test("15. loading state is explicit", () => {
  assert.match(passage, /Loading original-language tokens/);
  assert.match(html, /bibleRootOriginalLanguageStatus[^>]+data-state="loading"/);
});

test("16. bounded unavailable state is distinct from offline", () => {
  assert.match(passage, /ORIGINAL_LANGUAGE_UNAVAILABLE/);
  assert.match(passage, /unavailable \? "unavailable" : "offline"/);
});

test("17. API-offline state has a scoped retry", () => {
  assert.match(passage, /Retry language layer/);
  assert.match(passage, /loadOriginalLanguage\(referenceFromUrl\(\), requestSequence\)/);
});

test("18. malformed KJV references hide the subordinate panel", () => {
  assert.match(passage, /bibleRootOriginalLanguage"\)\.hidden = true/);
  assert.match(passage, /MALFORMED_REFERENCE/);
});

test("19. existing URL history and back-forward behavior are preserved", () => {
  assert.match(passage, /history\.pushState/);
  assert.match(passage, /addEventListener\("popstate"/);
  assert.match(passage, /referenceFromUrl\(\)/);
});

test("20. shared user menu and Root switcher remain initialized", () => {
  assert.match(html, /sourceroot-root-switcher\.js/);
  assert.match(html, /sourceroot-user-menu\.js/);
  assert.ok(html.indexOf("sourceroot-root-switcher.js") < html.indexOf("bibleroot-api.js"));
});

test("21. unified-search boundary is disclosed accurately", () => {
  assert.match(html, /not indexed by unified search/);
});

test("22. mobile token layout is bounded and wrap-safe", () => {
  assert.match(css, /\.br-original-token-list\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.br-original-token\s*\{[^}]*max-width:\s*100%/s);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.br-original-token\s*\{[^}]*min-width:\s*0/s);
});

test("23. token and provenance content is not visually truncated", () => {
  assert.match(css, /\.br-original-surface[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(css, /\.br-original[^}]*text-overflow:\s*ellipsis/s);
  assert.doesNotMatch(css, /\.br-original[^}]*white-space:\s*nowrap/s);
});

test("24. excluded interpretation layers are stated and absent", () => {
  assert.match(html, /without translation, gloss,[\s\S]*commentary, or theology/);
  assert.doesNotMatch(`${html}\n${passage}`, /Textus Receptus|John 1:18 witness|lexical gloss:/i);
});

test("25. changed customer scripts have valid JavaScript syntax", () => {
  new vm.Script(api, { filename: "bibleroot-api.js" });
  new vm.Script(passage, { filename: "bibleroot-passage.js" });
});
