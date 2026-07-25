export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

export interface QueryParameterError {
  error:
    | "INVALID_PAGE"
    | "INVALID_LIMIT"
    | "INVALID_OFFSET"
    | "INVALID_SORT"
    | "INVALID_DIRECTION";
  code: QueryParameterError["error"];
  message: string;
  status: 400;
  category: "invalid-pagination" | "invalid-sort";
  field: string;
  details: {
    value: unknown;
  };
}

export type SortDirection = "asc" | "desc";

export interface SortQuery<TSort extends string = string> {
  sort: TSort;
  direction: SortDirection;
}

export function getQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
): number | undefined {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    return undefined;
  }

  return parsedValue;
}

export function parseNonNegativeInteger(
  value: unknown,
  defaultValue: number,
): number | undefined {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
    return undefined;
  }

  return parsedValue;
}

export function clampLimit(
  value: number,
  maximum: number = MAX_LIMIT,
  minimum = 1,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function queryError(
  error: QueryParameterError["error"],
  message: string,
  category: QueryParameterError["category"],
  field: string,
  value: unknown,
): QueryParameterError {
  return {
    error,
    code: error,
    message,
    status: 400,
    category,
    field,
    details: {
      value: typeof value === "string" ? value : null,
    },
  };
}

export function parsePagination(
  pageValue: unknown,
  limitValue: unknown,
  defaults: {
    page?: number;
    limit?: number;
    maxLimit?: number;
    offsetValue?: unknown;
  } = {},
): PaginationQuery | QueryParameterError {
  const defaultPage = defaults.page ?? DEFAULT_PAGE;
  const maxLimit = defaults.maxLimit ?? MAX_LIMIT;
  const defaultLimit = clampLimit(
    defaults.limit ?? DEFAULT_LIMIT,
    maxLimit,
  );

  const page = parsePositiveInteger(pageValue, defaultPage);

  if (page === undefined) {
    return queryError(
      "INVALID_PAGE",
      "page must be a positive integer.",
      "invalid-pagination",
      "page",
      pageValue,
    );
  }

  const limit = parsePositiveInteger(limitValue, defaultLimit);

  if (limit === undefined || limit > maxLimit) {
    return queryError(
      "INVALID_LIMIT",
      `limit must be an integer between 1 and ${maxLimit}.`,
      "invalid-pagination",
      "limit",
      limitValue,
    );
  }

  if (
    defaults.offsetValue !== undefined
    && pageValue !== undefined
  ) {
    return queryError(
      "INVALID_OFFSET",
      "offset cannot be combined with page.",
      "invalid-pagination",
      "offset",
      defaults.offsetValue,
    );
  }

  const offset = parseNonNegativeInteger(
    defaults.offsetValue,
    (page - 1) * limit,
  );

  if (offset === undefined) {
    return queryError(
      "INVALID_OFFSET",
      "offset must be a non-negative integer.",
      "invalid-pagination",
      "offset",
      defaults.offsetValue,
    );
  }

  return {
    page:
      defaults.offsetValue === undefined
        ? page
        : Math.floor(offset / limit) + 1,
    limit,
    offset,
  };
}

export function isQueryParameterError(
  value:
    | PaginationQuery
    | SortQuery
    | QueryParameterError,
): value is QueryParameterError {
  return "error" in value;
}

export function parseSort<TSort extends string>(
  sortValue: unknown,
  directionValue: unknown,
  options: {
    allowedSorts: ReadonlySet<TSort>;
    defaultSort: TSort;
    defaultDirection?: SortDirection;
    allowedDirections?: ReadonlySet<SortDirection>;
  },
): SortQuery<TSort> | QueryParameterError {
  const sort = (getQueryString(sortValue)
    ?? options.defaultSort) as TSort;

  if (!options.allowedSorts.has(sort)) {
    return queryError(
      "INVALID_SORT",
      `sort must be one of: ${[...options.allowedSorts].join(", ")}.`,
      "invalid-sort",
      "sort",
      sortValue,
    );
  }

  const directionText = getQueryString(directionValue);
  const direction = (
    directionText?.toLowerCase()
    ?? options.defaultDirection
    ?? "asc"
  ) as SortDirection;
  const allowedDirections =
    options.allowedDirections
    ?? new Set<SortDirection>(["asc", "desc"]);

  if (!allowedDirections.has(direction)) {
    return queryError(
      "INVALID_DIRECTION",
      `direction must be one of: ${[...allowedDirections].join(", ")}.`,
      "invalid-sort",
      "direction",
      directionValue,
    );
  }

  return { sort, direction };
}

export function normalizeFilters(
  values: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, getQueryString(value)] as const)
      .filter((entry): entry is readonly [string, string] =>
        entry[1] !== undefined),
  );
}

export function getUnsupportedQueryParameters(
  query: Record<string, unknown>,
  supported: ReadonlySet<string>,
): string[] {
  return Object.keys(query)
    .filter((key) => !supported.has(key))
    .sort((left, right) => left.localeCompare(right));
}

export function getRouteParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}
