export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface QueryParameterError {
  error: "INVALID_PAGE" | "INVALID_LIMIT";
  message: string;
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

export function parsePagination(
  pageValue: unknown,
  limitValue: unknown,
  defaults: {
    page?: number;
    limit?: number;
    maxLimit?: number;
  } = {},
): PaginationQuery | QueryParameterError {
  const defaultPage = defaults.page ?? DEFAULT_PAGE;
  const defaultLimit = defaults.limit ?? DEFAULT_LIMIT;
  const maxLimit = defaults.maxLimit ?? MAX_LIMIT;

  const page = parsePositiveInteger(pageValue, defaultPage);

  if (page === undefined) {
    return {
      error: "INVALID_PAGE",
      message: "page must be a positive integer.",
    };
  }

  const limit = parsePositiveInteger(limitValue, defaultLimit);

  if (limit === undefined || limit > maxLimit) {
    return {
      error: "INVALID_LIMIT",
      message: `limit must be an integer between 1 and ${maxLimit}.`,
    };
  }

  return { page, limit };
}

export function isQueryParameterError(
  value: PaginationQuery | QueryParameterError,
): value is QueryParameterError {
  return "error" in value;
}
