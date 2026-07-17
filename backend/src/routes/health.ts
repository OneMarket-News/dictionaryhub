import { Router } from "express";
import { checkDatabase } from "../lib/database.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_request, response) => {
  const database = await checkDatabase();
  const healthy = !database.configured || database.reachable;

  response.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "sourceroot-backend",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    database
  });
});
