import { authProviderConfig, backendPublicUrl, frontendPublicUrl } from "../services/auth-providers.js";

export interface DeploymentReadiness {
  environment: string;
  readyForPublicTraffic: boolean;
  providers: ReturnType<typeof authProviderConfig>;
  checks: Array<{ key: string; status: "pass" | "warning" | "fail"; message: string }>;
}

function booleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
}

export function getDeploymentReadiness(): DeploymentReadiness {
  const environment = process.env.NODE_ENV || "development";
  const production = environment === "production";
  const backendUrl = backendPublicUrl();
  const frontendUrl = frontendPublicUrl();
  const emailMode = (process.env.EMAIL_DELIVERY_MODE || "console").toLowerCase();
  const checks: DeploymentReadiness["checks"] = [];

  function add(key: string, condition: boolean, message: string, severity: "warning" | "fail" = "fail"): void {
    checks.push({ key, status: condition ? "pass" : severity, message });
  }

  add("database", Boolean(process.env.DATABASE_URL), "DATABASE_URL must point to a persistent PostgreSQL database.");
  add("frontend_https", !production || frontendUrl.startsWith("https://"), "FRONTEND_PUBLIC_URL must use HTTPS in production.");
  add("backend_https", !production || backendUrl.startsWith("https://"), "BACKEND_PUBLIC_URL must use HTTPS in production.");
  add("secure_cookie", !production || booleanEnv("SESSION_COOKIE_SECURE"), "SESSION_COOKIE_SECURE must be true in production.");
  add("development_auth_disabled", !production || !booleanEnv("ALLOW_DEVELOPMENT_AUTH"), "ALLOW_DEVELOPMENT_AUTH must be false in production.");
  add("development_link_hidden", !production || !booleanEnv("EXPOSE_DEVELOPMENT_AUTH_LINK"), "EXPOSE_DEVELOPMENT_AUTH_LINK must be false in production.");
  add("email_delivery", !production || emailMode !== "console", "Production email delivery cannot use console mode.");
  add("bootstrap_admin", Boolean(process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAIL), "Configure at least one bootstrap administrator email before the first governed sign-in.", "warning");
  add("cors_origin", Boolean(process.env.CORS_ORIGIN) && !(process.env.CORS_ORIGIN || "").includes("*"), "CORS_ORIGIN must list explicit trusted frontend origins.");
  add("import_protection", production ? Boolean(process.env.IMPORT_SERVICE_TOKEN) : true, "Configure IMPORT_SERVICE_TOKEN for production imports.", "warning");
  add("self_approval_disabled", !production || !booleanEnv("ALLOW_SELF_APPROVAL"), "ALLOW_SELF_APPROVAL should remain false in production.", "warning");

  const providers = authProviderConfig();
  checks.push({
    key: "public_identity_provider",
    status: providers.google.configured || providers.apple.configured || providers.email.configured ? "pass" : "warning",
    message: "Configure at least one public sign-in provider.",
  });

  return {
    environment,
    readyForPublicTraffic: checks.every((check) => check.status !== "fail"),
    providers,
    checks,
  };
}
