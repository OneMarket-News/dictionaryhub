import type { Response } from "express";

import type {
  PaginationQuery,
  QueryParameterError,
  SortQuery,
} from "./query-params.js";

export const REGISTRY_API_CONTRACT_VERSION = "1.0";
export const EXACT_TOTAL_SEMANTICS = "exact" as const;

export interface ApiErrorOptions {
  category:
    | "invalid-query"
    | "invalid-pagination"
    | "invalid-filter"
    | "invalid-sort"
    | "validation-failure"
    | "not-found"
    | "conflict"
    | "unauthorized"
    | "forbidden"
    | "internal-error";
  field?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface StandardApiError {
  error: string;
  code: string;
  message: string;
  status: number;
  category: ApiErrorOptions["category"];
  field?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export function createApiError(
  code: string,
  message: string,
  status: number,
  options: ApiErrorOptions,
): StandardApiError {
  return {
    error: code,
    code,
    message,
    status,
    category: options.category,
    ...(options.field !== undefined
      ? { field: options.field }
      : {}),
    ...(options.details !== undefined
      ? { details: options.details }
      : {}),
    ...(options.requestId !== undefined
      ? { requestId: options.requestId }
      : {}),
  };
}

export function withRequestId(
  error: QueryParameterError | StandardApiError,
  response: Response,
): QueryParameterError | StandardApiError {
  return {
    ...error,
    requestId: response.locals.requestId,
  };
}

interface LegacyCollectionResult<TItem> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: TItem[];
}

export interface CollectionContractOptions<TSort extends string> {
  resource: string;
  pagination: PaginationQuery;
  filters: Record<string, string>;
  sort: SortQuery<TSort>;
  tieBreaker: string;
  legacyKeys: string[];
  ignoredQueryParameters?: string[];
  metadata?: Record<string, unknown>;
}

export function withCollectionContract<
  TItem,
  TResult extends LegacyCollectionResult<TItem>,
  TSort extends string,
>(
  result: TResult,
  options: CollectionContractOptions<TSort>,
) {
  const returned = result.items.length;
  const hasMore =
    options.pagination.offset + returned < result.total;

  return {
    ...result,
    contractVersion: REGISTRY_API_CONTRACT_VERSION,
    offset: options.pagination.offset,
    returned,
    hasMore,
    totalSemantics: EXACT_TOTAL_SEMANTICS,
    appliedFilters: options.filters,
    appliedSort: {
      field: options.sort.sort,
      direction: options.sort.direction,
      tieBreaker: options.tieBreaker,
    },
    pagination: {
      page: result.page,
      limit: result.limit,
      offset: options.pagination.offset,
      returned,
      total: result.total,
      totalPages: result.totalPages,
      hasMore,
      totalSemantics: EXACT_TOTAL_SEMANTICS,
    },
    registry: {
      resource: options.resource,
      legacyCollectionKeys: options.legacyKeys,
      ignoredQueryParameters:
        options.ignoredQueryParameters ?? [],
      ...(options.metadata ?? {}),
    },
  };
}

export function safeValidationDetails(
  details: unknown,
): Record<string, unknown> {
  if (!details || typeof details !== "object") {
    return {};
  }

  const safe: Record<string, unknown> = {};
  for (const key of ["field", "path", "issue", "expected", "received"]) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      safe[key] = (details as Record<string, unknown>)[key];
    }
  }
  return safe;
}
