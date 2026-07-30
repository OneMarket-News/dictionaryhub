const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const component = read("assets/js/sourceroot-root-switcher.js");
const styles = read("assets/css/sourceroot-root-switcher.css");
const sourceRootHome = read("sourceroot.html");
const unifiedSearch = read("sourceroot-search.html");
const dictionaryNavigation = read("assets/js/dictionaryroot-navigation.js");
const historyShared = read("assets/js/historyroot-shared.js");
const dictionaryConcept = read("assets/js/dictionaryroot-concept.js");
const historyRecord = read("assets/js/historyroot-record.js");

test("1. one shared Root registry is the canonical frontend destination source", () => {
  assert.equal((component.match(/const REGISTRY =/g) || []).length, 1);
  assert.match(component, /registry: REGISTRY/);
});

test("2. SourceRoot Home is registered", () => {
  assert.match(component, /id: "SourceRoot"[\s\S]*?displayName: "SourceRoot Home"/);
});

test("3. Search All Roots is registered as a shared utility", () => {
  assert.match(component, /id: "SourceRootSearch"[\s\S]*?destinationType: "utility"/);
});

test("4. DictionaryRoot is registered", () => {
  assert.match(component, /id: "DictionaryRoot"[\s\S]*?canonicalUrl: "index\.html"/);
});

test("5. HistoryRoot is registered", () => {
  assert.match(component, /id: "HistoryRoot"[\s\S]*?canonicalUrl: "historyroot\.html"/);
});

test("6. future active Roots require only a registry entry", () => {
  assert.match(component, /REGISTRY[\s\S]*filter\(\(destination\) => destination\.available\)/);
  assert.match(component, /sort\(\(left, right\) => left\.order - right\.order\)/);
});

test("7. the shared trigger label is Switch Roots", () => {
  assert.match(component, /"Switch Roots"/);
});

test("8. the trigger owns aria-expanded state", () => {
  assert.match(component, /setAttribute\("aria-expanded", "false"\)/);
  assert.match(component, /setAttribute\("aria-expanded", String\(open\)\)/);
});

test("9. the trigger connects to its unique menu with aria-controls", () => {
  assert.match(component, /uniqueMenuId\(\)/);
  assert.match(component, /setAttribute\("aria-controls", menuId\)/);
});

test("10. the current destination has accessible and visible indicators", () => {
  assert.match(component, /setAttribute\("aria-current", "page"\)/);
  assert.match(component, /"sr-root-switcher-current", "Current"/);
});

test("11. clicking outside closes the switcher", () => {
  assert.match(component, /document\.addEventListener\("click"/);
  assert.match(component, /!mount\.contains\(event\.target\)/);
});

test("12. Escape closes and returns focus", () => {
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /close\(true\)/);
  assert.match(component, /trigger\.focus\(\)/);
});

test("13. Enter and Space open through explicit keyboard handling", () => {
  assert.match(component, /event\.key === "Enter" \|\| event\.key === " "/);
});

test("14. duplicate initialization is prevented", () => {
  assert.match(component, /const instances = new WeakMap\(\)/);
  assert.match(component, /if \(instances\.has\(mount\)\) return instances\.get\(mount\)/);
});

test("15. DictionaryRoot initializes the shared component", () => {
  assert.match(dictionaryNavigation, /SourceRootRootSwitcher\.init\(\{ mount, currentId: "DictionaryRoot" \}\)/);
});

test("16. HistoryRoot initializes the shared component", () => {
  assert.match(historyShared, /SourceRootRootSwitcher\.init\(\{ mount, currentId: "HistoryRoot" \}\)/);
});

test("17. SourceRoot home initializes the shared component", () => {
  assert.match(sourceRootHome, /data-current-root="SourceRoot"/);
  assert.match(sourceRootHome, /assets\/js\/sourceroot-root-switcher\.js/);
});

test("18. unified search initializes the shared component", () => {
  assert.match(unifiedSearch, /data-current-root="SourceRootSearch"/);
  assert.match(unifiedSearch, /assets\/js\/sourceroot-root-switcher\.js/);
});

test("19. old horizontal cross-Root strips are not rendered", () => {
  assert.doesNotMatch(sourceRootHome, /<nav class="sr-root-nav"/);
  assert.doesNotMatch(unifiedSearch, /<nav class="sr-root-switcher"/);
  assert.doesNotMatch(dictionaryNavigation, /class="sr-dr-root-switcher"/);
  assert.doesNotMatch(historyShared, /className: "sr-hr-root-switcher"/);
});

test("20. redundant Root pills are not rendered", () => {
  assert.doesNotMatch(historyShared, /className: "historyroot-family-link"/);
  assert.doesNotMatch(dictionaryNavigation, />HistoryRoot<\/a>\s*<\/nav>/);
});

test("21. canonical breadcrumbs remain present", () => {
  assert.match(unifiedSearch, /class="sr-breadcrumbs"/);
  assert.match(dictionaryNavigation, /sr-dictionaryroot-breadcrumbs/);
  assert.match(historyShared, /sr-historyroot-breadcrumbs/);
});

test("22. two-way contextual discovery and disclaimers remain present", () => {
  assert.match(dictionaryConcept, /Search this term in HistoryRoot/);
  assert.match(dictionaryConcept, /does not prove that this DictionaryRoot sense was intended/);
  assert.match(historyRecord, /Compare possible meanings in DictionaryRoot/);
  assert.match(historyRecord, /does not establish what a historical speaker or source intended/);
});

test("23. the shared component has no backend dependency", () => {
  assert.doesNotMatch(component, /\/api\/|fetch\(|XMLHttpRequest|WebSocket/);
});

test("24. canonical destination URLs are stable", () => {
  for (const target of [
    'canonicalUrl: "sourceroot.html"',
    'canonicalUrl: "sourceroot-search.html"',
    'canonicalUrl: "index.html"',
    'canonicalUrl: "historyroot.html"'
  ]) {
    assert.ok(component.includes(target), target);
  }
});

test("25. the component uses semantic navigation with standard links", () => {
  assert.match(component, /document\.createElement\("nav"\)/);
  assert.match(component, /document\.createElement\("a"\)/);
  assert.doesNotMatch(component, /role", "menu"|role="menu"/);
});

test("26. the menu is viewport-bounded and mobile links remain tappable", () => {
  assert.match(styles, /width: min\(330px, calc\(100vw - 1rem\)\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /min-height: 62px/);
});

test("27. visible focus and reduced motion are explicit", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("28. the component degrades safely when the mount is absent", () => {
  assert.match(component, /if \(!mount\) return null/);
});
