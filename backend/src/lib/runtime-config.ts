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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number.parseInt(value, 10) > 0;
}

export function getDeploymentReadiness(): DeploymentReadiness {
  const environment = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const production = environment === "production";
  const publicEnvironment = production || environment === "staging";
  const backendUrl = backendPublicUrl();
  const frontendUrl = frontendPublicUrl();
  const emailMode = (process.env.EMAIL_DELIVERY_MODE || "console").toLowerCase();
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || "lax").toLowerCase();
  const secureCookie = booleanEnv("SESSION_COOKIE_SECURE");
  const corsOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const checks: DeploymentReadiness["checks"] = [];

  function add(key: string, condition: boolean, message: string, severity: "warning" | "fail" = "fail"): void {
    checks.push({ key, status: condition ? "pass" : severity, message });
  }

  add(
    "environment",
    ["development", "test", "staging", "production"].includes(environment),
    "NODE_ENV must be development, test, staging, or production.",
  );
  add("port", isPositiveInteger(process.env.PORT || "3000"), "PORT must be a positive integer.");
  add("database", Boolean(process.env.DATABASE_URL), "DATABASE_URL must point to a persistent PostgreSQL database.");
  add("frontend_url", isHttpUrl(frontendUrl), "FRONTEND_PUBLIC_URL must be an absolute HTTP(S) URL.");
  add("backend_url", isHttpUrl(backendUrl), "BACKEND_PUBLIC_URL must be an absolute HTTP(S) URL.");
  add("frontend_https", !publicEnvironment || frontendUrl.startsWith("https://"), "FRONTEND_PUBLIC_URL must use HTTPS outside local development.");
  add("backend_https", !publicEnvironment || backendUrl.startsWith("https://"), "BACKEND_PUBLIC_URL must use HTTPS outside local development.");
  add("secure_cookie", !publicEnvironment || secureCookie, "SESSION_COOKIE_SECURE must be true outside local development.");
  add("same_site", ["lax", "strict", "none"].includes(sameSite), "SESSION_COOKIE_SAME_SITE must be lax, strict, or none.");
  add("same_site_none_secure", sameSite !== "none" || secureCookie, "SameSite=None requires SESSION_COOKIE_SECURE=true.");
  add("development_auth_disabled", !publicEnvironment || !booleanEnv("ALLOW_DEVELOPMENT_AUTH"), "ALLOW_DEVELOPMENT_AUTH must be false outside local development.");
  add("development_link_hidden", !publicEnvironment || !booleanEnv("EXPOSE_DEVELOPMENT_AUTH_LINK"), "EXPOSE_DEVELOPMENT_AUTH_LINK must be false outside local development.");
  add("local_origins_disabled", !publicEnvironment || !booleanEnv("ALLOW_LOCAL_DEVELOPMENT_ORIGINS"), "ALLOW_LOCAL_DEVELOPMENT_ORIGINS must be false outside local development.");
  add("email_delivery_mode", ["console", "resend"].includes(emailMode), "EMAIL_DELIVERY_MODE must be console or resend.");
  add("email_delivery", !publicEnvironment || emailMode !== "console", "Public deployments cannot use console email delivery.");
  add(
    "email_credentials",
    emailMode !== "resend" || Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    "Resend delivery requires its API credential and a configured sender address.",
  );
  add("bootstrap_admin", Boolean(process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAIL), "Configure at least one bootstrap administrator email before the first governed sign-in.", "warning");
  add(
    "cors_origin",
    corsOrigins.length > 0
      && corsOrigins.every((origin) => isHttpUrl(origin) && !origin.includes("*")),
    "CORS_ORIGIN must list explicit trusted HTTP(S) frontend origins.",
  );
  add(
    "cors_https",
    !publicEnvironment || corsOrigins.every((origin) => origin.startsWith("https://")),
    "CORS_ORIGIN entries must use HTTPS outside local development.",
  );
  add(
    "unauthenticated_import_disabled",
    !publicEnvironment || !booleanEnv("ALLOW_UNAUTHENTICATED_IMPORT"),
    "ALLOW_UNAUTHENTICATED_IMPORT must be false outside local development.",
  );
  add(
    "request_logging",
    !publicEnvironment || booleanEnv("REQUEST_LOGGING"),
    "REQUEST_LOGGING must be true outside local development.",
  );
  add("import_protection", production ? Boolean(process.env.IMPORT_SERVICE_TOKEN) : true, "Configure IMPORT_SERVICE_TOKEN for production imports.", "warning");
  add("self_approval_disabled", !publicEnvironment || !booleanEnv("ALLOW_SELF_APPROVAL"), "ALLOW_SELF_APPROVAL should remain false outside local development.", "warning");

  const providers = authProviderConfig();
  const providerConfigured = providers.google.configured || providers.apple.configured || providers.email.configured;
  checks.push({
    key: "public_identity_provider",
    status: providerConfigured ? "pass" : publicEnvironment ? "fail" : "warning",
    message: "Configure at least one public sign-in provider.",
  });

  return {
    environment,
    readyForPublicTraffic: checks.every((check) => check.status !== "fail"),
    providers,
    checks,
  };
}

export function startupFailureKeys(): string[] {
  return getDeploymentReadiness()
    .checks
    .filter((check) => check.status === "fail")
    .map((check) => check.key);
}
