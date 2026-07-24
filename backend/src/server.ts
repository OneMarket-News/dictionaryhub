import "dotenv/config";
import { createApp } from "./app.js";
import { checkDatabase, closeDatabase } from "./lib/database.js";
import { startupFailureKeys } from "./lib/runtime-config.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const environment = (process.env.NODE_ENV || "development").trim().toLowerCase();
const strictStartup = environment === "production" || environment === "staging";

async function start(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  if (strictStartup) {
    const failures = startupFailureKeys();
    if (failures.length > 0) {
      throw new Error(`Startup configuration failed: ${failures.join(", ")}`);
    }
    const database = await checkDatabase();
    if (!database.configured || !database.reachable) {
      throw new Error("Startup database check failed.");
    }
  }

  const app = createApp();
  const server = app.listen(port, () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "server_started",
      service: "sourceroot-backend",
      environment,
      port,
    }));
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "server_stopping",
      service: "sourceroot-backend",
      signal,
    }));
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void start().catch(async (error: unknown) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event: "startup_failed",
    service: "sourceroot-backend",
    message: error instanceof Error ? error.message : "Unknown startup error.",
  }));
  await closeDatabase();
  process.exitCode = 1;
});
