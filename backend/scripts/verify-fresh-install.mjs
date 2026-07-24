import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({
  path: existsSync(".env.test") ? ".env.test" : ".env",
  quiet: true,
});

const { Client } = pg;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;
const databaseName = `sourceroot_install_${randomBytes(6).toString("hex")}`;

if (!/^sourceroot_install_[a-f0-9]{12}$/.test(databaseName)) {
  throw new Error("Generated temporary database name is unsafe.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Use the test or a disposable PostgreSQL administrator connection.");
}

const administratorUrl = new URL(process.env.DATABASE_URL);
administratorUrl.pathname = "/postgres";
const installationUrl = new URL(process.env.DATABASE_URL);
installationUrl.pathname = `/${databaseName}`;
const quotedDatabaseName = `"${databaseName}"`;

function runNpm(...args) {
  const command = npmCli ? process.execPath : npmCommand;
  const commandArguments = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArguments, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: installationUrl.toString() },
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${npmCommand} ${args.join(" ")} exited with code ${result.status}.`);
  }
}

async function queryInstallation(sql) {
  const client = new Client({ connectionString: installationUrl.toString() });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function dropTemporaryDatabase() {
  const client = new Client({ connectionString: administratorUrl.toString() });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quotedDatabaseName}`);
  } finally {
    await client.end();
  }
}

const administrator = new Client({ connectionString: administratorUrl.toString() });
let created = false;

try {
  await administrator.connect();
  const staleDatabases = await administrator.query(
    "SELECT datname FROM pg_database WHERE datname LIKE 'sourceroot_install_%' ORDER BY datname",
  );
  if (staleDatabases.rowCount) {
    throw new Error(
      `A prior fresh-install database still exists: ${staleDatabases.rows.map((row) => row.datname).join(", ")}`,
    );
  }
  await administrator.query(`CREATE DATABASE ${quotedDatabaseName}`);
  created = true;
  await administrator.end();

  runNpm("run", "db:migrate");
  runNpm("run", "historyroot:plymouth:validate");
  runNpm("run", "historyroot:plymouth:import");
  runNpm("run", "historyroot:plymouth:import");

  const imported = await queryInstallation(`
    SELECT
      (SELECT COUNT(*) FROM schema_migrations)::int AS migrations,
      (SELECT COUNT(*) FROM context_records)::int AS records,
      (SELECT COUNT(*) FROM sources)::int AS sources
  `);
  const importedCounts = imported.rows[0];
  if (
    importedCounts?.migrations !== 11
    || importedCounts?.records !== 393
    || importedCounts?.sources !== 20
  ) {
    throw new Error(`Unexpected fresh-install counts: ${JSON.stringify(importedCounts)}`);
  }
  console.log(`Fresh install counts: ${JSON.stringify(importedCounts)}`);

  runNpm("run", "historyroot:plymouth:remove");
  const removed = await queryInstallation(
    "SELECT COUNT(*)::int AS records FROM context_records",
  );
  if (removed.rows[0]?.records !== 0) {
    throw new Error(`HistoryRoot removal left contextual records: ${JSON.stringify(removed.rows[0])}`);
  }
  console.log(`Removal counts: ${JSON.stringify(removed.rows[0])}`);
  console.log("Fresh PostgreSQL installation lifecycle passed.");
} finally {
  if (!created) {
    await administrator.end().catch(() => undefined);
  } else {
    await dropTemporaryDatabase();
    console.log(`Removed temporary database ${databaseName}.`);
  }
}
