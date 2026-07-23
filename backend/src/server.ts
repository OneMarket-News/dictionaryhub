import "dotenv/config";
import { createApp } from "./app.js";
import { closeDatabase } from "./lib/database.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = createApp();
const server = app.listen(port, () => {
  console.log(`SourceRoot backend listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Validate: POST http://localhost:${port}/api/v1/validate`);
  console.log(`Account: http://localhost:${port}/api/v1/auth/session`);
  console.log(`Readiness: http://localhost:${port}/api/v1/deployment-readiness`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down SourceRoot backend.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
