import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  claimRelationTypes,
  contextAliasTypes,
  contextEntityTypes,
  evidenceSupportRoles,
  temporalKinds,
  temporalRoles,
  type ContextRecordKind,
} from "../contextual-types.js";
import {
  createApiError,
  REGISTRY_API_CONTRACT_VERSION,
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
  type PaginationQuery,
  type QueryParameterError,
} from "../lib/query-params.js";
import {
  getContextClaimReview,
  getContextRecordReview,
} from "../services/context-review-store.js";
import {
  listContextExtensions,
  type ContextExtensionCollection,
} from "../services/context-version-store.js";
import {
  getContextRecordById,
  listEntityAliases,
  listEntityIdentifiers,
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
const temporalRoleSet = new Set<string>(temporalRoles);
const aliasTypeSet = new Set<string>(contextAliasTypes);
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
  "timeRole",
  "dateFrom",
  "dateTo",
  "validAt",
  "validFrom",
  "validTo",
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
    const validAt = parseDateFilter(request.query.validAt);
    const validFrom = parseDateFilter(request.query.validFrom);
    const validTo = parseDateFilter(request.query.validTo);

    if (
      dateFrom === null
      || dateTo === null
      || validAt === null
      || validFrom === null
      || validTo === null
    ) {
      const invalidField =
        dateFrom === null
          ? "dateFrom"
          : dateTo === null
            ? "dateTo"
            : validAt === null
              ? "validAt"
              : validFrom === null
                ? "validFrom"
                : "validTo";
      return response.status(400).json(
        createApiError(
          "INVALID_DATE_FILTER",
          "Date filters must use valid YYYY-MM-DD dates.",
          400,
          {
            category: "invalid-filter",
            field: invalidField,
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const entityType = getQueryString(request.query.entityType);
    const temporalKind = getQueryString(request.query.temporalKind);
    const timeRole = getQueryString(request.query.timeRole);
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

    if (timeRole && !temporalRoleSet.has(timeRole)) {
      return invalidEnumResponse(
        response,
        "timeRole",
        temporalRoleSet,
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
      timeRole,
      dateFrom,
      dateTo,
      validAt,
      validFrom,
      validTo,
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

const aliasSorts = new Set([
  "text",
  "createdAt",
  "updatedAt",
  "aliasId",
] as const);
const identifierSorts = new Set([
  "scheme",
  "value",
  "createdAt",
  "updatedAt",
  "identifierId",
] as const);
const aliasQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "aliasType",
  "languageTag",
  "status",
  "sourceId",
]);
const identifierQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "scheme",
  "status",
  "sourceId",
]);

interface ContextExtensionRoute {
  path: string;
  collection: ContextExtensionCollection;
  responseKey: string;
  filters: ReadonlySet<string>;
  sorts: ReadonlySet<
    "createdAt" | "updatedAt" | "id" | "ordinal"
  >;
}

const contextExtensionRoutes: ContextExtensionRoute[] = [
  {
    path: "/claim-versions",
    collection: "claimVersions",
    responseKey: "claimVersions",
    filters: new Set([
      "claimId",
      "versionId",
      "status",
      "sourceId",
      "current",
    ]),
    sorts: new Set(["createdAt", "id", "ordinal"]),
  },
  {
    path: "/evidence-versions",
    collection: "evidenceVersions",
    responseKey: "evidenceVersions",
    filters: new Set([
      "evidenceId",
      "versionId",
      "status",
      "supportRole",
      "sourceId",
      "current",
    ]),
    sorts: new Set(["createdAt", "id", "ordinal"]),
  },
  {
    path: "/claim-evidence-links",
    collection: "evidenceClaimLinks",
    responseKey: "claimEvidenceLinks",
    filters: new Set([
      "claimId",
      "evidenceId",
      "versionId",
      "supportRole",
      "sourceId",
    ]),
    sorts: new Set(["createdAt", "updatedAt", "id"]),
  },
  {
    path: "/claim-relationships",
    collection: "claimRelations",
    responseKey: "claimRelationships",
    filters: new Set(["claimId", "relationType", "sourceId"]),
    sorts: new Set(["createdAt", "updatedAt", "id"]),
  },
  {
    path: "/claim-attributions",
    collection: "claimAttributions",
    responseKey: "claimAttributions",
    filters: new Set(["claimId", "actorEntityId", "sourceId"]),
    sorts: new Set(["createdAt", "updatedAt", "id"]),
  },
];

const relationTypeSet = new Set<string>(claimRelationTypes);
const supportRoleSet = new Set<string>(evidenceSupportRoles);
const reviewIdPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const recordReviewQueryParameters = new Set([
  "page",
  "limit",
  "q",
  "status",
]);
const claimReviewQueryParameters = new Set([
  "version",
  "versionsPage",
  "versionsLimit",
  "evidencePage",
  "evidenceLimit",
  "relationsPage",
  "relationsLimit",
  "provenancePage",
  "provenanceLimit",
]);

function parseNamedPagination(
  request: Request,
  prefix: string,
  defaults: { limit: number; maxLimit: number },
): PaginationQuery | QueryParameterError {
  const pageKey = `${prefix}Page`;
  const limitKey = `${prefix}Limit`;
  const parsed = parsePagination(
    request.query[pageKey],
    request.query[limitKey],
    defaults,
  );
  if (!isQueryParameterError(parsed)) {
    return parsed;
  }
  return {
    ...parsed,
    field:
      parsed.field === "page"
        ? pageKey
        : limitKey,
    message:
      parsed.field === "page"
        ? `${pageKey} must be a positive integer.`
        : `${limitKey} must be an integer between 1 and ${defaults.maxLimit}.`,
  };
}

function invalidReviewId(
  response: Response,
  field: "recordId" | "claimId" | "version",
) {
  return response.status(400).json(
    createApiError(
      "INVALID_CONTEXT_REVIEW_ID",
      `${field} must be a bounded SourceRoot identifier.`,
      400,
      {
        category: "invalid-query",
        field,
        requestId: response.locals.requestId,
      },
    ),
  );
}

for (const route of contextExtensionRoutes) {
  contextRouter.get(
    route.path,
    async (request, response, next) => {
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
            allowedSorts: route.sorts,
            defaultSort:
              route.sorts.has("ordinal")
                ? "ordinal"
                : "createdAt",
          },
        );
        if (isQueryParameterError(sort)) {
          return response.status(400).json(
            withRequestId(sort, response),
          );
        }
        const relationType = route.filters.has("relationType")
          ? getQueryString(request.query.relationType)
          : undefined;
        if (
          relationType
          && !relationTypeSet.has(relationType)
          && !/^custom:[a-z0-9][a-z0-9_-]{0,63}$/.test(relationType)
        ) {
          return invalidEnumResponse(
            response,
            "relationType",
            relationTypeSet,
          );
        }
        const supportRole = route.filters.has("supportRole")
          ? getQueryString(request.query.supportRole)
          : undefined;
        if (
          supportRole
          && !supportRoleSet.has(supportRole)
          && !/^custom:[a-z0-9][a-z0-9_-]{0,63}$/.test(supportRole)
        ) {
          return invalidEnumResponse(
            response,
            "supportRole",
            supportRoleSet,
          );
        }
        const current = route.filters.has("current")
          ? getQueryString(request.query.current)
          : undefined;
        if (
          current
          && !["true", "false"].includes(current.toLowerCase())
        ) {
          return response.status(400).json(
            createApiError(
              "INVALID_CONTEXT_FILTER",
              "current must be true or false.",
              400,
              {
                category: "invalid-filter",
                field: "current",
                requestId: response.locals.requestId,
              },
            ),
          );
        }
        const filters = {
          claimId: getQueryString(request.query.claimId),
          evidenceId: getQueryString(request.query.evidenceId),
          versionId: getQueryString(request.query.versionId),
          relationType,
          supportRole,
          status: getQueryString(request.query.status),
          sourceId: getQueryString(request.query.sourceId),
          current: current?.toLowerCase(),
          actorEntityId: getQueryString(
            request.query.actorEntityId,
          ),
        };
        const applicableFilters = Object.fromEntries(
          Object.entries(filters).filter(
            ([key, value]) =>
              value !== undefined && route.filters.has(key),
          ),
        );
        const result = await listContextExtensions(
          route.collection,
          {
            page: pagination.page,
            limit: pagination.limit,
            offset: pagination.offset,
            sort: sort.sort,
            direction: sort.direction,
            ...applicableFilters,
          },
        );
        const supportedQueryParameters = new Set([
          "page",
          "limit",
          "offset",
          "sort",
          "direction",
          ...route.filters,
        ]);
        return response.status(200).json(
          withCollectionContract(
            {
              ...result,
              [route.responseKey]: result.items,
            },
            {
              resource: `context-${route.collection}`,
              pagination,
              filters: normalizeFilters(applicableFilters),
              sort,
              tieBreaker: "id:asc",
              legacyKeys: [route.responseKey],
              ignoredQueryParameters:
                getUnsupportedQueryParameters(
                  request.query,
                  supportedQueryParameters,
                ),
            },
          ),
        );
      } catch (error) {
        return next(error);
      }
    },
  );
}

contextRouter.get(
  "/review/records/:recordId",
  async (request, response, next) => {
    try {
      const recordId = getRouteParam(request.params.recordId);
      if (!reviewIdPattern.test(recordId)) {
        return invalidReviewId(response, "recordId");
      }
      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { limit: 25, maxLimit: 100 },
      );
      if (isQueryParameterError(pagination)) {
        return response.status(400).json(
          withRequestId(pagination, response),
        );
      }
      const query = getQueryString(request.query.q);
      const status = getQueryString(request.query.status);
      const result = await getContextRecordReview(recordId, {
        pagination,
        ...(query ? { query } : {}),
        ...(status ? { status } : {}),
      });
      if (!result) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_REVIEW_RECORD_NOT_FOUND",
            `No visible contextual record found with ID ${recordId}.`,
            404,
            {
              category: "not-found",
              field: "recordId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }
      return response.status(200).json(
        withCollectionContract(
          {
            ...result,
            requestId: response.locals.requestId,
          },
          {
            resource: "context-review-record-claims",
            pagination,
            filters: normalizeFilters({ q: query, status }),
            sort: { sort: "label", direction: "asc" },
            tieBreaker: "claimId:asc",
            legacyKeys: ["claims"],
            ignoredQueryParameters:
              getUnsupportedQueryParameters(
                request.query,
                recordReviewQueryParameters,
              ),
            metadata: { recordId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

contextRouter.get(
  "/review/claims/:claimId",
  async (request, response, next) => {
    try {
      const claimId = getRouteParam(request.params.claimId);
      if (!reviewIdPattern.test(claimId)) {
        return invalidReviewId(response, "claimId");
      }
      const version = getQueryString(request.query.version);
      if (version && !reviewIdPattern.test(version)) {
        return invalidReviewId(response, "version");
      }
      const sectionPagination = {
        versions: parseNamedPagination(
          request,
          "versions",
          { limit: 25, maxLimit: 50 },
        ),
        evidence: parseNamedPagination(
          request,
          "evidence",
          { limit: 25, maxLimit: 50 },
        ),
        relations: parseNamedPagination(
          request,
          "relations",
          { limit: 25, maxLimit: 50 },
        ),
        provenance: parseNamedPagination(
          request,
          "provenance",
          { limit: 25, maxLimit: 50 },
        ),
      };
      const invalidPagination = Object.values(
        sectionPagination,
      ).find(isQueryParameterError);
      if (invalidPagination) {
        return response.status(400).json(
          withRequestId(invalidPagination, response),
        );
      }
      const result = await getContextClaimReview(claimId, {
        ...(version ? { requestedVersionId: version } : {}),
        versions: sectionPagination.versions as PaginationQuery,
        evidence: sectionPagination.evidence as PaginationQuery,
        relations: sectionPagination.relations as PaginationQuery,
        provenance: sectionPagination.provenance as PaginationQuery,
      });
      if (!result) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_REVIEW_CLAIM_NOT_FOUND",
            `No visible contextual claim found with ID ${claimId}.`,
            404,
            {
              category: "not-found",
              field: "claimId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }
      if (!result.requestedVersionFound) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_REVIEW_VERSION_NOT_FOUND",
            `No visible claim version found with ID ${version}.`,
            404,
            {
              category: "not-found",
              field: "version",
              requestId: response.locals.requestId,
            },
          ),
        );
      }
      return response.status(200).json({
        ...result,
        contractVersion: REGISTRY_API_CONTRACT_VERSION,
        requestId: response.locals.requestId,
        registry: {
          resource: "context-review-claim",
          claimId,
          ignoredQueryParameters:
            getUnsupportedQueryParameters(
              request.query,
              claimReviewQueryParameters,
            ),
          boundedSections: {
            versions: result.versions.pagination,
            evidence: result.evidence.pagination,
            relationships: result.relatedClaims.pagination,
            provenance: result.provenance.pagination,
            attributions: result.attributions.pagination,
            sources: result.sources.summary,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

contextRouter.get(
  "/entities/:contextId/aliases",
  async (request, response, next) => {
    try {
      const contextId = getRouteParam(request.params.contextId);
      if (!contextId) {
        return response.status(400).json(
          createApiError(
            "INVALID_CONTEXT_ID",
            "A contextual entity ID is required.",
            400,
            {
              category: "invalid-query",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      const entity = await getContextRecordById(contextId, "entity");
      if (!entity) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_RECORD_NOT_FOUND",
            `No entity contextual record found with ID ${contextId}.`,
            404,
            {
              category: "not-found",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

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
          allowedSorts: aliasSorts,
          defaultSort: "text",
        },
      );
      if (isQueryParameterError(sort)) {
        return response.status(400).json(
          withRequestId(sort, response),
        );
      }

      const aliasType = getQueryString(request.query.aliasType);
      if (
        aliasType
        && !aliasTypeSet.has(aliasType)
        && !/^custom:[a-z0-9][a-z0-9_-]{0,63}$/.test(aliasType)
      ) {
        return invalidEnumResponse(
          response,
          "aliasType",
          aliasTypeSet,
        );
      }
      const filters = {
        aliasType,
        languageTag: getQueryString(request.query.languageTag),
        status: getQueryString(request.query.status),
        sourceId: getQueryString(request.query.sourceId),
      };
      const result = await listEntityAliases({
        entityId: contextId,
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        ...Object.fromEntries(
          Object.entries(filters).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      });
      return response.status(200).json(
        withCollectionContract(
          {
            ...result,
            aliases: result.items,
          },
          {
            resource: "context-entity-aliases",
            pagination,
            filters: normalizeFilters(filters),
            sort,
            tieBreaker: "aliasId:asc",
            legacyKeys: ["aliases"],
            ignoredQueryParameters:
              getUnsupportedQueryParameters(
                request.query,
                aliasQueryParameters,
              ),
            metadata: { entityId: contextId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

contextRouter.get(
  "/entities/:contextId/identifiers",
  async (request, response, next) => {
    try {
      const contextId = getRouteParam(request.params.contextId);
      if (!contextId) {
        return response.status(400).json(
          createApiError(
            "INVALID_CONTEXT_ID",
            "A contextual entity ID is required.",
            400,
            {
              category: "invalid-query",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      const entity = await getContextRecordById(contextId, "entity");
      if (!entity) {
        return response.status(404).json(
          createApiError(
            "CONTEXT_RECORD_NOT_FOUND",
            `No entity contextual record found with ID ${contextId}.`,
            404,
            {
              category: "not-found",
              field: "contextId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

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
          allowedSorts: identifierSorts,
          defaultSort: "scheme",
        },
      );
      if (isQueryParameterError(sort)) {
        return response.status(400).json(
          withRequestId(sort, response),
        );
      }
      const filters = {
        scheme: getQueryString(request.query.scheme),
        status: getQueryString(request.query.status),
        sourceId: getQueryString(request.query.sourceId),
      };
      const result = await listEntityIdentifiers({
        entityId: contextId,
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        ...Object.fromEntries(
          Object.entries(filters).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      });
      return response.status(200).json(
        withCollectionContract(
          {
            ...result,
            externalIdentifiers: result.items,
          },
          {
            resource: "context-entity-identifiers",
            pagination,
            filters: normalizeFilters(filters),
            sort,
            tieBreaker: "identifierId:asc",
            legacyKeys: ["externalIdentifiers"],
            ignoredQueryParameters:
              getUnsupportedQueryParameters(
                request.query,
                identifierQueryParameters,
              ),
            metadata: { entityId: contextId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

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
