const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const component = read("assets/js/sourceroot-user-menu.js");
const styles = read("assets/css/sourceroot-user-menu.css");
const rootSwitcher = read("assets/js/sourceroot-root-switcher.js");
const sourceRootHome = read("sourceroot.html");
const unifiedSearch = read("sourceroot-search.html");
const dictionaryNavigation = read("assets/js/dictionaryroot-navigation.js");
const historyShared = read("assets/js/historyroot-shared.js");
const dictionaryConcept = read("assets/js/dictionaryroot-concept.js");
const historyRecord = read("assets/js/historyroot-record.js");

test("1. one shared user-menu registry exists", () => {
  assert.equal((component.match(/const REGISTRY =/g) || []).length, 1);
  assert.match(component, /registry: REGISTRY/);
});

test("2. Sign in item exists", () => {
  assert.match(component, /id: "SourceRootSignIn"[\s\S]*?label: "Sign in to SourceRoot"/);
});

test("3. Editorial item exists", () => {
  assert.match(component, /id: "SourceRootEditorial"[\s\S]*?label: "Editorial"/);
});

test("4. Workflow item exists", () => {
  assert.match(component, /id: "SourceRootWorkflow"[\s\S]*?label: "Workflow"/);
});

test("5. Account item exists", () => {
  assert.match(component, /id: "SourceRootAccount"[\s\S]*?label: "Account"/);
});

test("6. registry items have stable IDs", () => {
  for (const id of ["SourceRootSignIn", "SourceRootEditorial", "SourceRootWorkflow", "SourceRootAccount"]) {
    assert.equal((component.match(new RegExp(`id: "${id}"`, "g")) || []).length, 1, id);
  }
});

test("7. registry items preserve canonical destinations", () => {
  assert.match(component, /SourceRootSignIn[\s\S]*?canonicalUrl: "account-v1\.html"/);
  assert.match(component, /SourceRootEditorial[\s\S]*?canonicalUrl: "editorial-v2\.html"/);
  assert.match(component, /SourceRootWorkflow[\s\S]*?canonicalUrl: "workflow-v1\.html"/);
  assert.match(component, /SourceRootAccount[\s\S]*?canonicalUrl: "account-v1\.html"/);
});

test("8. authentication metadata does not claim component enforcement", () => {
  assert.equal((component.match(/authenticationEnforcedByComponent: false/g) || []).length, 4);
  assert.doesNotMatch(component, /authenticationEnforcedByComponent: true/);
});

test("9. shared Sign in trigger exists", () => {
  assert.match(component, /className = "sr-user-menu-trigger"/);
});

test("10. trigger label is Sign in", () => {
  assert.match(component, /settings\.triggerLabel \|\| "Sign in"/);
});

test("11. trigger uses aria-expanded", () => {
  assert.match(component, /setAttribute\("aria-expanded", "false"\)/);
  assert.match(component, /setAttribute\("aria-expanded", String\(open\)\)/);
});

test("12. trigger uses aria-controls", () => {
  assert.match(component, /uniquePanelId\(/);
  assert.match(component, /setAttribute\("aria-controls", panelId\)/);
});

test("13. menu supports outside-click dismissal", () => {
  assert.match(component, /document\.addEventListener\("click"/);
  assert.match(component, /!mount\.contains\(event\.target\)/);
});

test("14. menu supports Escape dismissal", () => {
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /close\(true\)/);
});

test("15. Escape returns focus", () => {
  assert.match(component, /trigger\.focus\(\)/);
});

test("16. Enter opens the menu", () => {
  assert.match(component, /event\.key === "Enter"/);
});

test("17. Space opens the menu", () => {
  assert.match(component, /event\.key === " "/);
});

test("18. initialization is idempotent", () => {
  assert.match(component, /const instances = new WeakMap\(\)/);
  assert.match(component, /if \(instances\.has\(mount\)\) return instances\.get\(mount\)/);
});

test("19. duplicate IDs are prevented", () => {
  assert.match(component, /while \(document\.getElementById\(id\)\)/);
  assert.match(component, /instanceSequence \+= 1/);
});

test("20. opening Sign in closes Switch Roots", () => {
  assert.match(component, /sourceroot:navigation-menu-open/);
  assert.match(rootSwitcher, /sourceroot:navigation-menu-open/);
  assert.match(rootSwitcher, /event\.detail\.owner !== mount\) close\(false\)/);
});

test("21. opening Switch Roots closes Sign in", () => {
  assert.match(rootSwitcher, /menu: "root-switcher"/);
  assert.match(component, /event\.detail\.owner !== mount\) close\(false\)/);
});

test("22. SourceRoot initializes the shared user menu", () => {
  assert.match(sourceRootHome, /data-sourceroot-user-menu/);
  assert.match(sourceRootHome, /assets\/js\/sourceroot-user-menu\.js/);
});

test("23. unified search initializes the shared user menu", () => {
  assert.match(unifiedSearch, /data-sourceroot-user-menu/);
  assert.match(unifiedSearch, /assets\/js\/sourceroot-user-menu\.js/);
});

test("24. DictionaryRoot initializes the shared user menu", () => {
  assert.match(dictionaryNavigation, /SourceRootUserMenu\.init/);
  assert.match(dictionaryNavigation, /data-sourceroot-user-menu/);
});

test("25. HistoryRoot initializes the shared user menu", () => {
  assert.match(historyShared, /SourceRootUserMenu\.init/);
  assert.match(historyShared, /"data-sourceroot-user-menu"/);
});

test("26. DictionaryRoot public navigation does not render Editorial", () => {
  const publicItems = dictionaryNavigation.match(/const NAV_ITEMS = \[[\s\S]*?\n  \];/)[0];
  assert.doesNotMatch(publicItems, /Editorial/);
});

test("27. DictionaryRoot public navigation does not render Workflow", () => {
  const publicItems = dictionaryNavigation.match(/const NAV_ITEMS = \[[\s\S]*?\n  \];/)[0];
  assert.doesNotMatch(publicItems, /Workflow/);
});

test("28. DictionaryRoot public navigation does not render Account", () => {
  const publicItems = dictionaryNavigation.match(/const NAV_ITEMS = \[[\s\S]*?\n  \];/)[0];
  assert.doesNotMatch(publicItems, /Account/);
});

test("29. DictionaryRoot user menu renders Editorial", () => {
  assert.match(dictionaryNavigation, /SourceRootUserMenu/);
  assert.match(component, /label: "Editorial"/);
});

test("30. DictionaryRoot user menu renders Workflow", () => {
  assert.match(dictionaryNavigation, /SourceRootUserMenu/);
  assert.match(component, /label: "Workflow"/);
});

test("31. DictionaryRoot user menu renders Account", () => {
  assert.match(dictionaryNavigation, /SourceRootUserMenu/);
  assert.match(component, /label: "Account"/);
});

test("32. HistoryRoot user menu renders the same shared workspace entries", () => {
  assert.match(historyShared, /SourceRootUserMenu/);
  assert.equal((historyShared.match(/const NAV_ITEMS =/g) || []).length, 1);
  assert.match(component, /SourceRootEditorial[\s\S]*SourceRootWorkflow[\s\S]*SourceRootAccount/);
});

test("33. public Root navigation remains present", () => {
  for (const label of ["Home", "Concept", "Knowledge Sphere", "Sources", "History", "Coverage"]) {
    assert.match(dictionaryNavigation, new RegExp(`label: "${label}"`));
  }
  for (const label of ["Home", "Explore", "Timeline", "Sources", "Knowledge Graph"]) {
    assert.match(historyShared, new RegExp(`label: "${label}"`));
  }
});

test("34. Switch Roots remains present", () => {
  assert.match(rootSwitcher, /"Switch Roots"/);
  for (const integration of [sourceRootHome, unifiedSearch, dictionaryNavigation, historyShared]) {
    assert.match(integration, /data-sourceroot-root-switcher/);
  }
});

test("35. breadcrumbs remain present", () => {
  assert.match(unifiedSearch, /class="sr-breadcrumbs"/);
  assert.match(dictionaryNavigation, /sr-dictionaryroot-breadcrumbs/);
  assert.match(historyShared, /sr-historyroot-breadcrumbs/);
});

test("36. contextual-discovery controls remain present", () => {
  assert.match(dictionaryConcept, /Search this term in HistoryRoot|Explore this term in HistoryRoot/);
  assert.match(historyRecord, /Compare possible meanings in DictionaryRoot/);
});

test("37. no backend files are required by the component", () => {
  assert.doesNotMatch(component, /\/api\/|fetch\(|XMLHttpRequest|WebSocket/);
});

test("38. no fake signed-in user is rendered", () => {
  assert.match(component, /authState: "signed-out"/);
  assert.doesNotMatch(component, /displayName|avatar|initials|signed-in/);
});

test("39. no fake Sign out action is rendered", () => {
  assert.doesNotMatch(component, /Sign out|signOut|logout/i);
});

test("40. future Root initialization uses the shared component contract", () => {
  assert.match(component, /function init\(options\)/);
  assert.match(component, /settings\.registry \|\| REGISTRY/);
  assert.match(component, /settings\.idPrefix/);
  assert.match(component, /if \(!mount\) return null/);
});

test("41. shared scripts retain valid JavaScript syntax", () => {
  for (const relativePath of [
    "assets/js/sourceroot-user-menu.js",
    "assets/js/sourceroot-root-switcher.js",
    "assets/js/dictionaryroot-navigation.js",
    "assets/js/historyroot-shared.js"
  ]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, relativePath)], {
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${relativePath}: ${result.stderr}`);
  }
});

test("42. user-menu styles provide visible focus, mobile bounds, and reduced motion", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /min-height: 62px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
