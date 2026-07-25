export type DiagnosticEventType =
  | "request_completed"
  | "request_failed"
  | "validation_failed"
  | "import_completed"
  | "import_failed"
  | "database_failure"
  | "unexpected_server_failure"
  | "frontend_network_failure"
  | "frontend_timeout"
  | "missing_attribution_detected"
  | "malformed_registry_record_detected"
  | "broken_source_reference_detected"
  | "observer_report_created";

export type DiagnosticLevel = "info" | "warning" | "error";

export interface DiagnosticEventInput {
  eventType: DiagnosticEventType;
  level?: DiagnosticLevel;
  correlationId?: string | null;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  responseCategory?: string;
  actorCategory?: string;
  organizationId?: string | null;
  errorCode?: string | null;
  bundleId?: string | null;
  recordCounts?: Record<string, number>;
  validationResult?: string;
  failureCategory?: string;
  schemaVersion?: string | null;
}

export interface StructuredDiagnosticEvent {
  timestamp: string;
  level: DiagnosticLevel;
  eventType: DiagnosticEventType;
  event: DiagnosticEventType;
  correlationId: string | null;
  requestId: string | null;
  environment: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  responseCategory?: string;
  actorCategory?: string;
  organizationId?: string | null;
  errorCode?: string | null;
  bundleId?: string | null;
  recordCounts?: Record<string, number>;
  validationResult?: string;
  failureCategory?: string;
  schemaVersion?: string | null;
}

export type DiagnosticSink = (event: Readonly<StructuredDiagnosticEvent>) => void;

const sensitiveKey = /authorization|cookie|password|token|secret|session|csrf|database[_-]?url/i;
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
let diagnosticSink: DiagnosticSink | null = null;

function boundedText(value: unknown, maximumLength = 256): string {
  return String(value ?? "").slice(0, maximumLength);
}

function safeOptionalIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const bounded = boundedText(value);
  return safeIdentifier.test(bounded) ? bounded : "invalid-or-redacted";
}

function safeEnvironment(): string {
  const value = (process.env.NODE_ENV || "development").trim().toLowerCase();
  return /^(development|test|production)$/.test(value) ? value : "custom";
}

function normalizeCounts(counts: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!counts) return undefined;
  const normalized: Record<string, number> = {};
  for (const key of Object.keys(counts).sort()) {
    if (!safeIdentifier.test(key)) continue;
    const value = Number(counts[key]);
    if (Number.isFinite(value) && value >= 0) normalized[key] = Math.floor(value);
  }
  return normalized;
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveData);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sensitiveKey.test(key) ? "[REDACTED]" : redactSensitiveData(entry);
  }
  return output;
}

export function structuredLoggingEnabled(): boolean {
  const configured = process.env.REQUEST_LOGGING;
  if (configured != null) return configured.trim().toLowerCase() === "true";
  return (process.env.NODE_ENV || "development").trim().toLowerCase() === "production";
}

export function createStructuredDiagnosticEvent(
  input: DiagnosticEventInput,
): StructuredDiagnosticEvent {
  const correlationId = safeOptionalIdentifier(input.correlationId);
  const recordCounts = normalizeCounts(input.recordCounts);
  return {
    timestamp: new Date().toISOString(),
    level: input.level ?? "info",
    eventType: input.eventType,
    event: input.eventType,
    correlationId,
    requestId: correlationId,
    environment: safeEnvironment(),
    ...(input.method !== undefined
      ? { method: boundedText(input.method, 16).toUpperCase() }
      : {}),
    ...(input.path !== undefined ? { path: boundedText(input.path, 512) } : {}),
    ...(input.statusCode !== undefined ? { statusCode: input.statusCode } : {}),
    ...(input.durationMs !== undefined
      ? { durationMs: Math.max(0, Math.round(input.durationMs * 10) / 10) }
      : {}),
    ...(input.responseCategory !== undefined
      ? { responseCategory: boundedText(input.responseCategory, 64) }
      : {}),
    ...(input.actorCategory !== undefined
      ? { actorCategory: boundedText(input.actorCategory, 64) }
      : {}),
    ...(input.organizationId !== undefined
      ? { organizationId: safeOptionalIdentifier(input.organizationId) }
      : {}),
    ...(input.errorCode !== undefined
      ? { errorCode: safeOptionalIdentifier(input.errorCode) }
      : {}),
    ...(input.bundleId !== undefined
      ? { bundleId: safeOptionalIdentifier(input.bundleId) }
      : {}),
    ...(recordCounts !== undefined ? { recordCounts } : {}),
    ...(input.validationResult !== undefined
      ? { validationResult: boundedText(input.validationResult, 64) }
      : {}),
    ...(input.failureCategory !== undefined
      ? { failureCategory: boundedText(input.failureCategory, 64) }
      : {}),
    ...(input.schemaVersion !== undefined
      ? { schemaVersion: safeOptionalIdentifier(input.schemaVersion) }
      : {}),
  };
}

export function emitDiagnosticEvent(
  input: DiagnosticEventInput,
): StructuredDiagnosticEvent {
  const event = createStructuredDiagnosticEvent(input);
  diagnosticSink?.(Object.freeze(event));
  if (structuredLoggingEnabled()) console.log(JSON.stringify(event));
  return event;
}

export function setDiagnosticSinkForTests(
  sink: DiagnosticSink | null,
): () => void {
  const previous = diagnosticSink;
  diagnosticSink = sink;
  return () => {
    diagnosticSink = previous;
  };
}

