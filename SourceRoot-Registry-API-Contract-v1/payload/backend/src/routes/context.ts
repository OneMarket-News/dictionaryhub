import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  contextEntityTypes,
  temporalKinds,
  type ContextRecordKind,
} from "../contextual-types.js";
import {
  createApiError,
  withCollectionContract,
  withRequestId,
} from "../lib/api-contract.js";
import {
  getUnsupportedQueryParameters,
  getRouteParam,
  getQueryString,
  isQueryParameterError,
  normalizeFilters,
  parsePagination,
  parseSort,
} from "../lib/query-params.js";
import {
  getContextRecordById,
  listContextRecords,
  type ListContextRecordsOptions,
} from "../services/context-store.js";

export const contextRouter = Router();

interface ContextCollection {
  path: string;
  recordKind: ContextRecordKind;
  responseKey: string;
}

const collections: ContextCollection[] = [
  {
    path: "/entities",
    recordKind: "entity",
    responseKey: "entities",
  },
  {
    path: "/temporal-assertions",
    recordKind: "temporal_assertion",
    responseKey: "temporalAssertions",
  },
  {
    path: "/accounts",
    recordKind: "account",
    responseKey: "accounts",
  },
  {
    path: "/claims",
    recordKind: "claim",
    responseKey: "claims",
  },
  {
    path: "/evidence",
    recordKind: "evidence",
    responseKey: "evidence",
  },
  {
    path: "/interpretations",
    recordKind: "interpretation",
    responseKey: "interpretations",
  },
  {
    path: "/perspectives",
    recordKind: "perspective",
    responseKey: "perspectives",
  },
  {
    path: "/causes-consequences",
    recordKind: "causal_link",
    responseKey: "causesConsequences",
  },
  {
    path: "/relationships",
    recordKind: "relationship",
    responseKey: "relationships",
  },
  {
    path: "/cultural-memories",
    recordKind: "cultural_memory",
    responseKey: "culturalMemories",
  },
];

const entityTypeSet = new Set<string>(contextEntityTypes);
const temporalKindSet = new Set<string>(temporalKinds);
const evidenceTypeSet = new Set(["evidence", "counterevidence"]);
const causalKindSet = new Set(["cause", "consequence"]);
const contextSorts = new Set([
  "label",
  "createdAt",
  "updatedAt",
  "recordId",
] as const);
const contextQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "domain",
  "status",
  "sourceId",
  "entityType",
  "relationshipType",
  "temporalKind",
  "dateFrom",
  "dateTo",
  "subjectId",
  "accountId",
  "claimId",
  "evidenceType",
  "causalKind",
  "perspectiveId",
  "fromId",
  "toId",
]);

function parseDateFilter(
  value: unknown,
): string | undefined | null {
  const text = getQueryString(value);

  if (text === undefined) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== text
    ? null
    : text;
}

function invalidEnumResponse(
  response: Response,
  field: string,
  allowed: ReadonlySet<string>,
) {
  return response.status(400).json({
    ...createApiError(
      "INVALID_CONTEXT_FILTER",
      `${field} must be one of: ${[...allowed].join(", ")}.`,
      400,
      {
        category: "invalid-filter",
        field,
        requestId: response.locals.requestId,
      },
    ),
  });
}

async function listCollection(
  collection: ContextCollection,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const pagination = parsePagination(
      request.query.page,
      request.query.limit,
      { offsetValue: request.query.offset },
    );

    if (isQueryParameterError(pagination)) {
      return response.status(400).json(
        withRequestId(pagination, response),
      );
    }

    const sort = parseSort(
      request.query.sort,
      request.query.direction,
      {
        allowedSorts: contextSorts,
        defaultSort: "label",
      },
    );

    if (isQueryParameterError(sort)) {
      return response.status(400).json(
        withRequestId(sort, response),
      );
    }

    const dateFrom = parseDateFilter(request.query.dateFrom);
    const dateTo = parseDateFilter(request.query.dateTo);

    if (dateFrom === null || dateTo === null) {
      return response.status(400).json(
        createApiError(
          "INVALID_DATE_FILTER",
          "dateFrom and dateTo must use valid YYYY-MM-DD dates.",
          400,
          {
            category: "invalid-filter",
            field: dateFrom === null ? "dateFrom" : "dateTo",
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const entityType = getQueryString(request.query.entityType);
    const temporalKind = getQueryString(request.query.temporalKind);
    const evidenceType = getQueryString(request.query.evidenceType);
    const causalKind = getQueryString(request.query.causalKind);

    if (entityType && !entityTypeSet.has(entityType)) {
      return invalidEnumResponse(
        response,
        "entityType",
        entityTypeSet,
      );
    }

    if (temporalKind && !temporalKindSet.has(temporalKind)) {
      return invalidEnumResponse(
        response,
        "temporalKind",
        temporalKindSet,
      );
    }

    if (evidenceType && !evidenceTypeSet.has(evidenceType)) {
      return invalidEnumResponse(
        response,
        "evidenceType",
        evidenceTypeSet,
      );
    }

    if (causalKind && !causalKindSet.has(causalKind)) {
      return invalidEnumResponse(
        response,
        "causalKind",
        causalKindSet,
      );
    }

    const queryFields = {
      bundleId: getQueryString(request.query.bundleId),
      domain: getQueryString(request.query.domain),
      status: getQueryString(request.query.status),
      sourceId: getQueryString(request.query.sourceId),
      entityType,
      relationshipType: getQueryString(
        request.query.relationshipType,
      ),
      temporalKind,
      dateFrom,
      dateTo,
      subjectId: getQueryString(request.query.subjectId),
      accountId: getQueryString(request.query.accountId),
      claimId: getQueryString(request.query.claimId),
      evidenceType,
      causalKind,
      perspectiveId: getQueryString(request.query.perspectiveId),
      fromId: getQueryString(request.query.fromId),
      toId: getQueryString(request.query.toId),
    };

    const options: ListContextRecordsOptions = {
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset,
      sort: sort.sort,
      direction: sort.direction,
      recordKind: collection.recordKind,
      ...Object.fromEntries(
        Object.entries(queryFields).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    };

    const result = await listContextRecords(options);

    const legacyResult = {
      ...result,
      [collection.responseKey]: result.items,
    };

    return response.status(200).json(
      withCollectionContract(legacyResult, {
        resource: `context-${collection.recordKind}`,
        pagination,
        filters: normalizeFilters(queryFields),
        sort,
        tieBreaker: "recordId:asc",
        legacyKeys: [collection.responseKey],
        ignoredQueryParameters:
          getUnsupportedQueryParameters(
            request.query,
            contextQueryParameters,
          ),
        metadata: {
          recordKind: collection.recordKind,
        },
      }),
    );
  } catch (error) {
    return next(error);
  }
}

async function getCollectionRecord(
  collection: ContextCollection,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const contextId = getRouteParam(request.params.contextId);

    if (!contextId) {
      return response.status(400).json(
        createApiError(
          "INVALID_CONTEXT_ID",
          "A contextual record ID is required.",
          400,
          {
            category: "invalid-query",
            field: "contextId",
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const record = await getContextRecordById(
      contextId,
      collection.recordKind,
    );

    if (!record) {
      return response.status(404).json(
        createApiError(
          "CONTEXT_RECORD_NOT_FOUND",
          `No ${collection.recordKind} contextual record found with ID ${contextId}.`,
          404,
          {
            category: "not-found",
            field: "contextId",
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    return response.status(200).json(record);
  } catch (error) {
    return next(error);
  }
}

for (const collection of collections) {
  contextRouter.get(
    collection.path,
    (request, response, next) =>
      listCollection(collection, request, response, next),
  );
  contextRouter.get(
    `${collection.path}/:contextId`,
    (request, response, next) =>
      getCollectionRecord(collection, request, response, next),
  );
}

contextRouter.get(
  "/records/:contextId",
  async (request, response, next) => {
    try {
      const contextId = getRouteParam(request.params.contextId);

      if (!contextId) {
        return response.status(400).json(
          createApiError(
            "INVALID_CONTEXT_ID",
            "A contextual record ID is required.",
            400,
            {
              category: "invalid-query",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      const record = await getContextRecordById(contextId);

      if (!record) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_RECORD_NOT_FOUND",
            `No contextual record found with ID ${contextId}.`,
            404,
            {
              category: "not-found",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response.status(200).json(record);
    } catch (error) {
      return next(error);
    }
  },
);
