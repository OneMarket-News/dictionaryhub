export interface OperationalEvent {
  readonly eventType?: string;
  readonly event?: string;
  readonly level?: string;
  readonly correlationId?: string | null;
  readonly requestId?: string | null;
  readonly method?: string;
  readonly path?: string;
  readonly statusCode?: number;
  readonly responseCategory?: string;
  readonly errorCode?: string | null;
  readonly failureCategory?: string;
}

export interface OperationalFailure {
  index: number;
  eventType: string;
  correlationId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  responseCategory: string | null;
  errorCode: string | null;
  failureCategory: string | null;
}

export interface OperationalFailureGroup {
  key: string;
  eventType: string;
  count: number;
  severity: "low" | "moderate" | "high" | "critical";
  correlationIds: string[];
  method: string | null;
  path: string | null;
  statusCode: number | null;
  responseCategory: string | null;
  errorCode: string | null;
  suggestedInvestigationArea: string;
}

export interface PlatformOperationsReport {
  schemaVersion: "1.0";
  observer: "platform-operations";
  authorityLevel: 1;
  readOnly: true;
  inputEventCount: number;
  failureCount: number;
  recurringFailureCount: number;
  severityRecommendation: "informational" | "low" | "moderate" | "high" | "critical";
  groups: OperationalFailureGroup[];
  failures: OperationalFailure[];
  humanSummary: string;
  diagnosticEvent: {
    eventType: "observer_report_created";
    observer: "platform-operations";
    findingCount: number;
  };
}

function text(value: unknown, maximumLength = 512): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).slice(0, maximumLength);
}

function eventType(event: OperationalEvent): string {
  return text(event.eventType || event.event, 128) || "unknown_event";
}

function isFailure(event: OperationalEvent): boolean {
  const type = eventType(event);
  return Boolean(
    (event.statusCode !== undefined && event.statusCode >= 400) ||
    event.level === "error" ||
    type.endsWith("_failed") ||
    type.endsWith("_failure") ||
    type === "validation_failed"
  );
}

function severityFor(count: number, statusCode: number | null): OperationalFailureGroup["severity"] {
  if ((statusCode ?? 0) >= 500 && count >= 3) return "critical";
  if ((statusCode ?? 0) >= 500 || count >= 3) return "high";
  if (count === 2 || (statusCode ?? 0) >= 400) return "moderate";
  return "low";
}

function investigationArea(failure: OperationalFailure): string {
  if (failure.failureCategory === "database" || failure.eventType === "database_failure") {
    return "database connectivity and transaction diagnostics";
  }
  if (failure.eventType === "import_failed" || failure.eventType === "validation_failed") {
    if (
      failure.failureCategory?.startsWith("context-version")
      || failure.errorCode === "CONTEXT_VERSION_ID_CONFLICT"
    ) {
      return "contextual immutable-version conflict and current-pointer diagnostics";
    }
    if (failure.failureCategory?.startsWith("context-")) {
      return "contextual identity, time, provenance, assertion, evidence, and transactional import diagnostics";
    }
    return "import validation, schema compatibility, and source bundle diagnostics";
  }
  if (
    failure.eventType === "governance_version_failed"
    || failure.failureCategory === "governance-version"
  ) {
    return "governed contextual version publication and rollback diagnostics";
  }
  if (failure.statusCode === 401 || failure.statusCode === 403) {
    return "authentication and authorization policy";
  }
  if ((failure.statusCode ?? 0) >= 500) {
    return "backend route handling and correlated server diagnostics";
  }
  if (failure.eventType.startsWith("frontend_")) {
    return "frontend connectivity, timeout, and API availability";
  }
  return "the correlated API route and response category";
}

function groupKey(failure: OperationalFailure): string {
  return [
    failure.eventType,
    failure.method || "-",
    failure.path || "-",
    failure.statusCode ?? "-",
    failure.responseCategory || "-",
    failure.errorCode || "-",
  ].join("|");
}

function reportSeverity(groups: OperationalFailureGroup[]): PlatformOperationsReport["severityRecommendation"] {
  if (groups.some((group) => group.severity === "critical")) return "critical";
  if (groups.some((group) => group.severity === "high")) return "high";
  if (groups.some((group) => group.severity === "moderate")) return "moderate";
  if (groups.length) return "low";
  return "informational";
}

export function observePlatformOperations(
  events: readonly OperationalEvent[],
): PlatformOperationsReport {
  const failures = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isFailure(event))
    .map(({ event, index }): OperationalFailure => ({
      index,
      eventType: eventType(event),
      correlationId: text(event.correlationId || event.requestId, 256),
      method: text(event.method, 16)?.toUpperCase() ?? null,
      path: text(event.path),
      statusCode: Number.isFinite(event.statusCode) ? Number(event.statusCode) : null,
      responseCategory: text(event.responseCategory, 128),
      errorCode: text(event.errorCode, 128),
      failureCategory: text(event.failureCategory, 128),
    }));

  const grouped = new Map<string, OperationalFailure[]>();
  for (const failure of failures) {
    const key = groupKey(failure);
    const existing = grouped.get(key);
    if (existing) existing.push(failure);
    else grouped.set(key, [failure]);
  }

  const groups = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, matching]): OperationalFailureGroup => {
      const first = matching[0];
      if (!first) throw new Error("Operational failure grouping invariant failed.");
      return {
        key,
        eventType: first.eventType,
        count: matching.length,
        severity: severityFor(matching.length, first.statusCode),
        correlationIds: Array.from(new Set(
          matching
            .map((failure) => failure.correlationId)
            .filter((value): value is string => Boolean(value))
        )).sort(),
        method: first.method,
        path: first.path,
        statusCode: first.statusCode,
        responseCategory: first.responseCategory,
        errorCode: first.errorCode,
        suggestedInvestigationArea: investigationArea(first),
      };
    });

  const recurringFailureCount = groups
    .filter((group) => group.count > 1)
    .reduce((total, group) => total + group.count, 0);
  const severityRecommendation = reportSeverity(groups);
  const humanSummary = failures.length === 0
    ? `No operational failures were found in ${events.length} diagnostic event(s).`
    : `${failures.length} operational failure(s) were found in ${events.length} event(s), grouped into ${groups.length} pattern(s). Recommended review severity: ${severityRecommendation}.`;

  return {
    schemaVersion: "1.0",
    observer: "platform-operations",
    authorityLevel: 1,
    readOnly: true,
    inputEventCount: events.length,
    failureCount: failures.length,
    recurringFailureCount,
    severityRecommendation,
    groups,
    failures,
    humanSummary,
    diagnosticEvent: {
      eventType: "observer_report_created",
      observer: "platform-operations",
      findingCount: failures.length,
    },
  };
}

export function serializePlatformOperationsReport(
  report: PlatformOperationsReport,
): string {
  return JSON.stringify(report, null, 2);
}
