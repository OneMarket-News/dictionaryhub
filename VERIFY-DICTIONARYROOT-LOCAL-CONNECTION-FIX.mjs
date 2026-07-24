import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repositoryFlag = process.argv.indexOf("--repository");
const root = path.resolve(repositoryFlag >= 0 ? process.argv[repositoryFlag + 1] : process.cwd());
let passed = 0;
let failed = 0;

function pass(label, detail = "") {
  passed += 1;
  console.log(`[PASS] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(label, detail = "") {
  failed += 1;
  console.log(`[FAIL] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function check(label, condition, detail = "") {
  if (condition) pass(label, detail);
  else fail(label, detail);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const required = [
  "backend/src/app.ts",
  "backend/src/routes/sources.ts",
  "backend/.env.example",
  "backend/config/staging.env.example",
  "backend/config/production.env.example",
  "backend/test/local-development-cors.test.ts",
  "assets/js/dictionaryroot-api.js",
  "assets/js/dictionaryroot-auth.js",
  "docker-compose.local.yml",
];

const missing = required.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
check("Required local-connection files exist", missing.length === 0, missing.length ? missing.join(", ") : `${required.length} files found.`);

if (missing.length === 0) {
  const app = read("backend/src/app.ts");
  const sources = read("backend/src/routes/sources.ts");
  const localEnv = read("backend/.env.example");
  const stagingEnv = read("backend/config/staging.env.example");
  const productionEnv = read("backend/config/production.env.example");
  const docker = read("docker-compose.local.yml");
  const apiSource = read("assets/js/dictionaryroot-api.js");
  const authSource = read("assets/js/dictionaryroot-auth.js");

  check(
    "Source registry reads remain available to guests",
    /sourcesRouter\.get\(\s*["']\/["']/.test(sources) &&
      !/require(?:Permission|Authenticated|Authentication)/.test(sources),
    "GET /api/v1/sources has no authentication or permission gate.",
  );

  check(
    "Anonymous auth fallback remains non-blocking",
    /authenticated:\s*false/.test(authSource) && /refreshSession\(\)/.test(authSource),
    "An unavailable or unsigned session resolves to an anonymous read-only state.",
  );

  check(
    "Development CORS accepts loopback browser ports",
    /ALLOW_LOCAL_DEVELOPMENT_ORIGINS/.test(app) &&
      /isLocalDevelopmentOrigin/.test(app) &&
      /localhost/.test(app) &&
      /127\.0\.0\.1/.test(app),
    "Localhost and 127.0.0.1 origins are accepted only by the development branch.",
  );

  check(
    "Credentialed CORS remains explicit",
    /credentials:\s*true/.test(app) && !/CORS_ORIGIN[^\n]*\*/.test(app),
    "No wildcard origin was introduced.",
  );

  check(
    "Local configuration documents the development exception",
    /ALLOW_LOCAL_DEVELOPMENT_ORIGINS=true/.test(localEnv) &&
      /ALLOW_LOCAL_DEVELOPMENT_ORIGINS:\s*["']?true/.test(docker),
  );

  check(
    "Staging and production disable local-origin expansion",
    /ALLOW_LOCAL_DEVELOPMENT_ORIGINS=false/.test(stagingEnv) &&
      /ALLOW_LOCAL_DEVELOPMENT_ORIGINS=false/.test(productionEnv),
  );

  try {
    const browserWindow = {
      location: {
        protocol: "http:",
        hostname: "127.0.0.1",
        href: "http://127.0.0.1:5500/sources-v2.html",
      },
    };
    const context = vm.createContext({
      window: browserWindow,
      URL,
      URLSearchParams,
      AbortController,
      performance,
      setTimeout,
      clearTimeout,
      console,
    });
    vm.runInContext(apiSource, context, { filename: "dictionaryroot-api.js" });
    const resolved = browserWindow.DictionaryRootApi.resolveLocalApiBaseUrl("http://localhost:3000/api/v1");
    check(
      "Frontend API host follows the active loopback hostname",
      resolved === "http://127.0.0.1:3000/api/v1",
      resolved,
    );
  } catch (error) {
    fail("Frontend API script parses and exposes loopback resolution", error instanceof Error ? error.message : String(error));
  }
}

console.log("");
console.log(`Static summary: ${passed} passed, ${failed} failed.`);
process.exitCode = failed === 0 ? 0 : 1;
