import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): pg.Pool | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000
    });
  }

  return pool;
}

export async function checkDatabase(): Promise<{
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  const database = getPool();

  if (!database) {
    return {
      configured: false,
      reachable: false,
      latencyMs: null
    };
  }

  const startedAt = performance.now();

  try {
    await database.query("SELECT 1 AS ok");
    return {
      configured: true,
      reachable: true,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
