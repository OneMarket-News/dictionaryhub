import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("release documentation set is complete", async () => {
  const docs = [
    "README.md",
    "developer-quick-start.md",
    "installation-guide.md",
    "deployment-guide.md",
    "architecture-guide.md",
    "release-checklist.md",
    "merge-checklist.md",
    "recovery-guide.md",
  ];
  for (const name of docs) {
    assert.equal(
      await exists(`docs/platform/historyroot-alpha-integration-v1/${name}`),
      true,
      `${name} is missing`,
    );
  }
});

test("required product and governance pages have responsive structure", async () => {
  const pages = [
    "index.html",
    "concept-v2.html",
    "graph-v2.html",
    "sources-v2.html",
    "history-v2.html",
    "account-v1.html",
    "workflow-v1.html",
    "admin-v1.html",
    "historyroot.html",
    "history-explore-v1.html",
    "history-timeline-v1.html",
    "history-record-v1.html",
    "history-sources-v1.html",
    "history-graph-v1.html",
    "history-governance-v1.html",
    "history-proposal-v1.html",
    "history-review-queue-v1.html",
    "history-review-v1.html",
    "history-revisions-v1.html",
  ];

  for (const page of pages) {
    const contents = await text(page);
    assert.match(contents, /<meta\s+name="viewport"/i, `${page} needs a viewport`);
    assert.equal(
      [...contents.matchAll(/<h1(?:\s|>)/gi)].length,
      1,
      `${page} must contain exactly one h1`,
    );
  }
});

test("static page script and stylesheet references resolve", async () => {
  const pages = (await readdir(root)).filter((name) => name.endsWith(".html"));
  const failures = [];
  for (const page of pages) {
    const contents = await text(page);
    for (const match of contents.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"'#?]+)["']/gi)) {
      const reference = match[1].trim();
      if (
        !reference
        || reference.includes("${")
        || /^(?:https?:|data:|mailto:|tel:|javascript:|\/)/i.test(reference)
      ) {
        continue;
      }
      if (!(await exists(reference.replace(/^\.\//, "")))) {
        failures.push(`${page} -> ${reference}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("legacy broken account and auth adapters are retired safely", async () => {
  const redirect = await text("accounts-v2.html");
  const brand = await text("config/dictionaryroot-brand.json");
  assert.match(redirect, /url=account-v1\.html/i);
  assert.match(redirect, /href="account-v1\.html"/i);
  assert.match(brand, /"href": "account-v1\.html"/);
  assert.doesNotMatch(brand, /accounts-v2\.html/);
  assert.equal(await exists("assets/js/dictionaryroot-accounts.js"), false);
  assert.equal(await exists("assets/css/dictionaryroot-accounts.css"), false);
  assert.equal(await exists("backend/src/middleware/auth-context.ts"), false);
  assert.equal(await exists("backend/src/services/identity-store.ts"), false);
  assert.equal(await exists("h"), false);
});

test("operational PowerShell defaults do not expose a developer-specific path", async () => {
  const scripts = (await readdir(root)).filter((name) => name.endsWith(".ps1"));
  const failures = [];
  for (const script of scripts) {
    if (/C:\\Users\\[^\\]+\\/i.test(await text(script))) failures.push(script);
  }
  assert.deepEqual(failures, []);
});

test("production configuration fails closed and exposes safe operations controls", async () => {
  const runtime = await text("backend/src/lib/runtime-config.ts");
  const server = await text("backend/src/server.ts");
  const health = await text("backend/src/routes/health.ts");
  const logging = await text("backend/src/middleware/request-logging.ts");

  for (const required of [
    "development_auth_disabled",
    "local_origins_disabled",
    "unauthenticated_import_disabled",
    "public_identity_provider",
    "startupFailureKeys",
  ]) {
    assert.ok(runtime.includes(required), `runtime config missing ${required}`);
  }
  assert.match(server, /strictStartup/);
  assert.match(server, /Startup database check failed/);
  assert.doesNotMatch(health, /database,\s*$/m);
  assert.match(logging, /request\.path/);
  assert.doesNotMatch(logging, /originalUrl|headers|cookie|body/);
});

test("production and staging examples contain logging and safe development flags", async () => {
  for (const file of [
    "backend/config/production.env.example",
    "backend/config/staging.env.example",
  ]) {
    const contents = await text(file);
    assert.match(contents, /^REQUEST_LOGGING=true$/m);
    assert.match(contents, /^ALLOW_DEVELOPMENT_AUTH=false$/m);
    assert.match(contents, /^ALLOW_UNAUTHENTICATED_IMPORT=false$/m);
    assert.match(contents, /^SESSION_COOKIE_SECURE=true$/m);
  }
});
