import { closeDatabase, getPool } from "../../src/lib/database.js";

export async function resetTestDatabase(): Promise<void> {
  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  await pool.query(`
    TRUNCATE TABLE imported_bundles;
  `);
}

export async function closeTestDatabase(): Promise<void> {
  await closeDatabase();
}