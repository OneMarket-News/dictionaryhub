const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const home = read("bibleroot.html");
const passage = read("bibleroot-passage.html");
const styles = read("assets/css/bibleroot.css");
const api = read("assets/js/bibleroot-api.js");
const homeScript = read("assets/js/bibleroot-home.js");
const passageScript = read("assets/js/bibleroot-passage.js");
const rootSwitcher = read("assets/js/sourceroot-root-switcher.js");
const userMenu = read("assets/js/sourceroot-user-menu.js");
const sourceRoot = read("sourceroot.html");
const unifiedSearch = read("sourceroot-search.html");
const dictionaryNavigation = read("assets/js/dictionaryroot-navigation.js");
const historyShared = read("assets/js/historyroot-shared.js");

function ids(markup) {
  return [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
}

function localReferences(markup) {
  return [...markup.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:https?:|mailto:|tel:)/.test(value));
}

test("1. BibleRoot home exists with unique IDs and resolvable assets", () => {
  assert.ok(home.includes("<title>BibleRoot"));
  const homeIds = ids(home);
  assert.equal(new Set(homeIds).size, homeIds.length);
  for (const target of localReferences(home)) {
    assert.ok(fs.existsSync(path.join(root, target)), target);
  }
});

test("2. BibleRoot passage page exists with unique IDs and resolvable assets", () => {
  assert.match(passage, /<title>Passage \| BibleRoot<\/title>/);
  const passageIds = ids(passage);
  assert.equal(new Set(passageIds).size, passageIds.length);
  for (const target of localReferences(passage)) {
    assert.ok(fs.existsSync(path.join(root, target)), target);
  }
});

test("3. both pages initialize the shared Root switcher", () => {
  for (const page of [home, passage]) {
    assert.match(page, /data-sourceroot-root-switcher/);
    assert.match(page, /data-current-root="BibleRoot"/);
    assert.match(page, /assets\/js\/sourceroot-root-switcher\.js/);
  }
});

test("4. BibleRoot is one available entry in the shared Root registry", () => {
  assert.equal((rootSwitcher.match(/const REGISTRY =/g) || []).length, 1);
  assert.match(
    rootSwitcher,
    /id: "BibleRoot"[\s\S]*canonicalUrl: "bibleroot\.html"[\s\S]*available: true/,
  );
});

test("5. shared current-state detection covers both BibleRoot pages", () => {
  assert.match(
    rootSwitcher,
    /file === "bibleroot\.html" \|\| file === "bibleroot-passage\.html"/,
  );
});

test("6. both pages initialize the released shared user menu", () => {
  for (const page of [home, passage]) {
    assert.match(page, /data-sourceroot-user-menu/);
    assert.match(page, /assets\/js\/sourceroot-user-menu\.js/);
  }
  assert.match(userMenu, /authState: "signed-out"/);
});

test("7. Sign in appears before Switch Roots in the header and scripts", () => {
  for (const page of [home, passage]) {
    assert.ok(
      page.indexOf("<div data-sourceroot-user-menu")
      < page.indexOf("<div data-sourceroot-root-switcher"),
    );
    assert.ok(
      page.indexOf("assets/js/sourceroot-user-menu.js")
      < page.indexOf("assets/js/bibleroot-"),
    );
  }
});

test("8. no duplicate BibleRoot navigation component is introduced", () => {
  assert.doesNotMatch(home + passage, /br-root-switcher|br-user-menu/);
  assert.equal((home.match(/data-sourceroot-root-switcher/g) || []).length, 2);
  assert.equal((passage.match(/data-sourceroot-root-switcher/g) || []).length, 2);
});

test("9. accessible reference inputs exist on home and passage pages", () => {
  assert.match(home, /id="bibleRootHomeReference"/);
  assert.match(home, /for="bibleRootHomeReference"/);
  assert.match(passage, /id="bibleRootPassageReference"/);
  assert.match(passage, /for="bibleRootPassageReference"/);
});

test("10. all four alpha passages have customer-facing links", () => {
  for (const reference of [
    "Genesis%201",
    "John%201",
    "Psalm%2023",
    "Ecclesiastes%203",
  ]) {
    assert.match(home, new RegExp(`reference=${reference}`));
  }
});

test("11. passage state is URL-backed and history-aware", () => {
  assert.match(passageScript, /new URL\(global\.location\.href\)\.searchParams\.get\("reference"\)/);
  assert.match(passageScript, /global\.history\.pushState/);
  assert.match(passageScript, /global\.addEventListener\("popstate"/);
});

test("12. verse rendering uses stable canonical anchors and edition IDs", () => {
  assert.match(passageScript, /article\.id = verse\.canonicalReferenceId/);
  assert.match(passageScript, /dataset\.canonicalReferenceId/);
  assert.match(passageScript, /dataset\.editionTextId/);
});

test("13. edition identity is visible and loaded from the live API", () => {
  assert.match(home, /Current text identity/);
  assert.match(passage, /id="bibleRootPassageEdition"/);
  assert.match(api, /\/editions/);
  assert.doesNotMatch(api, /verses\s*:\s*\[/);
});

test("14. source, artifact, and checksum provenance is visible", () => {
  assert.match(home, /Project Gutenberg eBook 10/);
  assert.match(home, /Artifact SHA-256/);
  assert.match(passage, /Source &amp; provenance/);
  assert.match(passageScript, /edition\.artifact\.sha256/);
});

test("15. rights status and territorial limitation are visible", () => {
  assert.match(home, /public\s+domain in the USA/i);
  assert.match(passage, /id="bibleRootProvenanceRights"/);
  assert.match(passageScript, /edition\.territorialLimitation/);
});

test("16. text and future interpretation layers are visibly distinct", () => {
  assert.match(home, /The text is not the interpretation/);
  assert.match(passage, /Commentary and interpretation are not populated/);
  assert.match(passageScript, /textual phrase anchor; no interpretation asserted/i);
});

test("17. no fabricated commentary or theological conclusion appears", () => {
  const combined = home + passage + homeScript + passageScript;
  assert.doesNotMatch(combined, /plainMeaning|symbolicMeaning|theologicalThemes/);
  assert.doesNotMatch(combined, /meaning-nodes|bible-root-assertions|bible-root-phrases\.json/);
});

test("18. no fake signed-in user or Sign out action appears", () => {
  const combined = home + passage;
  assert.doesNotMatch(combined, /Sign out|Welcome,|signed-in-user/i);
  assert.match(userMenu, /"Sign in"/);
});

test("19. DictionaryRoot shared navigation remains present", () => {
  assert.match(dictionaryNavigation, /currentId: "DictionaryRoot"/);
  assert.match(rootSwitcher, /id: "DictionaryRoot"/);
});

test("20. HistoryRoot shared navigation remains present", () => {
  assert.match(historyShared, /currentId: "HistoryRoot"/);
  assert.match(rootSwitcher, /id: "HistoryRoot"/);
});

test("21. SourceRoot family presentation accurately identifies the alpha", () => {
  assert.match(sourceRoot, /BibleRoot[\s\S]*foundation alpha/i);
  assert.match(sourceRoot, /four verified KJV chapters/i);
});

test("22. unified search discloses the BibleRoot indexing boundary", () => {
  assert.match(unifiedSearch, /data-bibleroot-indexing-boundary/);
  assert.match(unifiedSearch, /BibleRoot text is not[\s\S]*indexed/i);
  assert.match(unifiedSearch, /DictionaryRoot and HistoryRoot/);
});

test("23. loading, malformed, unavailable, and API-offline states are explicit", () => {
  for (const state of ["loading", "malformed", "unavailable", "offline"]) {
    assert.match(passageScript, new RegExp(`"${state}"`));
  }
  assert.match(passageScript, /No fallback text was substituted/);
});

test("24. responsive, focus, mobile, and reduced-motion behavior is explicit", () => {
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /minmax\(0, 1fr\)/);
});

test("25. all changed customer scripts retain valid JavaScript syntax", () => {
  for (const file of [
    "assets/js/bibleroot-api.js",
    "assets/js/bibleroot-home.js",
    "assets/js/bibleroot-passage.js",
    "assets/js/sourceroot-root-switcher.js",
  ]) {
    execFileSync(process.execPath, ["--check", path.join(root, file)], {
      stdio: "pipe",
    });
  }
});
