import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closeDatabase, getPool } from "../lib/database.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const migrationsDirectory = path.resolve(
  currentDirectory,
  "../../db/migrations",
);

async function runMigrations(): Promise<void> {
  console.log("Starting database migrations...");

 const pool = getPool();

if (!pool) {
  throw new Error(
    "DATABASE_URL is not configured. Confirm that backend/.env exists and contains DATABASE_URL.",
  );
}

const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationFiles = (await fs.readdir(migrationsDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const migrationFile of migrationFiles) {
      const existingMigration = await client.query(
        `
          SELECT migration_name
          FROM schema_migrations
          WHERE migration_name = $1;
        `,
        [migrationFile],
      );

      if ((existingMigration.rowCount ?? 0) > 0) {
        console.log(`Skipping already applied migration: ${migrationFile}`);
        continue;
      }

      const migrationPath = path.join(
        migrationsDirectory,
        migrationFile,
      );

      const migrationSql = await fs.readFile(migrationPath, "utf8");

      console.log(`Applying migration: ${migrationFile}`);

      await client.query("BEGIN");

      try {
        await client.query(migrationSql);

        await client.query(
          `
            INSERT INTO schema_migrations (migration_name)
            VALUES ($1);
          `,
          [migrationFile],
        );

        await client.query("COMMIT");

        console.log(`Applied migration: ${migrationFile}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Database migrations complete.");
  } finally {
    client.release();
    await closeDatabase();
  }
}

runMigrations().catch((error: unknown) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});