import type { PoolClient } from "pg";

const REQUIRED_MIGRATIONS = Object.freeze([
  "013_create_dictionaryroot_lexical_evidence.sql",
  "014_create_dictionaryroot_lexical_relationships.sql",
  "015_create_bibleroot_foundation.sql",
  "016_create_bibleroot_original_language_foundation.sql",
  "017_create_bibleroot_commentary_provenance.sql",
  "018_create_cross_root_link_foundation.sql",
]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOCAL_SERVER_ADDRESSES = new Set(["127.0.0.1", "::1"]);
const issuedAuthorizations = new WeakSet<object>();

export interface LocalDevelopmentDatabaseAuthorization {
  readonly mode: "development";
  readonly databaseName: "sourceroot";
  readonly host: string;
  readonly port: number;
}

export interface LocalDevelopmentDatabaseTarget {
  environment: "development";
  databaseName: "sourceroot";
  host: string;
  port: number;
  serverAddress: string;
  migrations: string[];
}

function normalizedHost(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function databaseNameFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//u, ""));
}

export async function authorizeLocalDevelopmentDatabase(
  client: PoolClient,
  options: { nodeEnvironment?: string; databaseUrl?: string } = {},
): Promise<{
  authorization: LocalDevelopmentDatabaseAuthorization;
  target: LocalDevelopmentDatabaseTarget;
}> {
  const environment = (options.nodeEnvironment ?? process.env.NODE_ENV ?? "")
    .trim()
    .toLowerCase();
  if (environment !== "development") {
    throw new Error("Local development provisioning requires NODE_ENV=development.");
  }

  const rawDatabaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("Local development provisioning requires a PostgreSQL DATABASE_URL.");
  }
  const host = normalizedHost(parsed.hostname);
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error("Local development provisioning rejects remote database hosts.");
  }
  if (databaseNameFromUrl(parsed) !== "sourceroot") {
    throw new Error("Local development provisioning requires database name sourceroot.");
  }

  const result = await client.query<{
    database_name: string;
    server_address: string;
    server_port: number;
    migrations: string[];
    migration_018_count: number;
  }>(`
    SELECT current_database() AS database_name,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port,
      ARRAY(SELECT migration_name FROM schema_migrations ORDER BY migration_name) AS migrations,
      (SELECT COUNT(*)::integer FROM schema_migrations WHERE migration_name LIKE '018%') AS migration_018_count;
  `);
  const row = result.rows[0];
  if (row?.database_name !== "sourceroot") {
    throw new Error("Connected database identity is not the local development sourceroot database.");
  }
  const serverAddress = row.server_address.split("/", 1)[0]!;
  if (!LOCAL_SERVER_ADDRESSES.has(serverAddress)) {
    throw new Error("Connected PostgreSQL server is not bound to a loopback address.");
  }
  for (const migration of REQUIRED_MIGRATIONS) {
    if (!row.migrations.includes(migration)) {
      throw new Error(`Required migration is not applied: ${migration}`);
    }
  }
  if (row.migration_018_count !== 1) {
    throw new Error("Exactly one governed migration 018 must be applied.");
  }

  const authorization = Object.freeze({
    mode: "development" as const,
    databaseName: "sourceroot" as const,
    host,
    port: Number(parsed.port || row.server_port || 5432),
  });
  issuedAuthorizations.add(authorization);
  return {
    authorization,
    target: {
      environment: "development",
      databaseName: "sourceroot",
      host,
      port: authorization.port,
      serverAddress,
      migrations: row.migrations,
    },
  };
}

export function assertLocalDevelopmentImportAuthorized(
  authorization: LocalDevelopmentDatabaseAuthorization | undefined,
  databaseName: string | undefined,
): asserts authorization is LocalDevelopmentDatabaseAuthorization {
  if (
    !authorization
    || !issuedAuthorizations.has(authorization)
    || authorization.mode !== "development"
    || authorization.databaseName !== "sourceroot"
    || databaseName !== "sourceroot"
  ) {
    throw new Error("A verified local-development database authorization is required.");
  }
}
