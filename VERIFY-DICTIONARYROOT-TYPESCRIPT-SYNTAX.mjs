#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const valueAfter = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const root = path.resolve(valueAfter("--root", process.cwd()));

function findTypeScript() {
  const candidates = [
    path.join(root, "backend", "node_modules", "typescript", "lib", "typescript.js"),
    path.join(root, "node_modules", "typescript", "lib", "typescript.js"),
    process.env.TYPESCRIPT_PATH || "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return require(candidate);
  }
  try { return require("typescript"); } catch { return null; }
}

function collect(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(current, result);
    else if (entry.isFile() && current.endsWith(".ts")) result.push(current);
  }
  return result;
}

const ts = findTypeScript();
if (!ts) {
  console.warn("TYPESCRIPT SKIP: TypeScript is not installed. Run npm.cmd ci in backend and rerun the verifier.");
  process.exit(0);
}

const files = collect(path.join(root, "backend"));
let failures = 0;
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const diagnostic of source.parseDiagnostics) {
    failures += 1;
    const point = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
    console.error(`FAIL ${path.relative(root, file)}:${point.line + 1}:${point.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  }
}
if (failures) {
  console.error(`TypeScript syntax verification failed with ${failures} diagnostic(s).`);
  process.exit(1);
}
console.log(`TypeScript syntax verification passed for ${files.length} files.`);
