import { Router } from "express";
import { checkDatabase } from "../lib/database.js";
import { getDeploymentReadiness } from "../lib/runtime-config.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_request, response) => {
  const database = await checkDatabase();
  const healthy = !database.configured || database.reachable;
  const deployment = getDeploymentReadiness();

  response.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "sourceroot-backend",
    productStage: "dictionaryroot-governed-platform-foundation-v1",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
    database,
    deployment: {
      environment: deployment.environment,
      readyForPublicTraffic: deployment.readyForPublicTraffic,
      configuredProviders: Object.fromEntries(
        Object.entries(deployment.providers).map(([key, value]) => [key, Boolean(value.configured)]),
      ),
      failingChecks: deployment.checks.filter((check) => check.status === "fail").map((check) => check.key),
      warningChecks: deployment.checks.filter((check) => check.status === "warning").map((check) => check.key),
    },
  });
});

healthRouter.get("/api/v1/deployment-readiness", (_request, response) => {
  const readiness = getDeploymentReadiness();
  response.status(readiness.readyForPublicTraffic ? 200 : 503).json(readiness);
});
