import { Router } from "express";

import {
  getLexicalEvidenceGraphNeighborhood,
  getLexicalEvidenceRelationship,
  listLexicalEvidenceRelationshipEvidence,
  lookupLexicalEvidenceGraphSeeds,
} from "../dictionaryroot/lexical-evidence-graph.js";
import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";
import {
  getDictionaryRootDynamicNeighborhood,
} from "../services/dynamic-neighborhood.js";
import {
  getDictionaryRootCoverageDashboard,
  getDictionaryRootLemmaCoverage,
  getDictionaryRootLexiconStatus,
  listDictionaryRootLemmaCoverage,
  type DictionaryRootHistoryCoverageFilter,
  type DictionaryRootLemmaCoverageFilter,
  type DictionaryRootLemmaCoverageSort,
  type DictionaryRootReviewCoverageFilter,
  type DictionaryRootSourceCoverageFilter,
} from "../services/lexical-store.js";
import {
  getDictionaryRootLexicalEvidenceLemma,
  getDictionaryRootLexicalEvidenceSense,
  getDictionaryRootLexicalEvidenceCoverage,
  listDictionaryRootLexicalEvidenceResource,
  listDictionaryRootLexicalEvidenceSources,
  searchDictionaryRootLexicalEvidence,
} from "../services/lexical-evidence-store.js";

export const lexiconRouter = Router();

const evidenceResources = new Set([
  "claims", "forms", "etymologies", "comparisons", "locators", "provenance",
] as const);

const coverageFilters = new Set<DictionaryRootLemmaCoverageFilter>([
  "all",
  "complete",
  "incomplete",
  "partial",
  "lexical-only",
]);
const sourceFilters = new Set<DictionaryRootSourceCoverageFilter>([
  "all",
  "source-backed",
  "unsupported",
]);
const historyFilters = new Set<DictionaryRootHistoryCoverageFilter>([
  "all",
  "with-history",
  "no-history",
]);
const reviewFilters = new Set<DictionaryRootReviewCoverageFilter>([
  "all",
  "reviewed",
  "needs-review",
]);

lexiconRouter.get("/evidence/graph/seeds", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json({
        error: "INVALID_QUERY",
        message: "q must contain a lexical form to use as a graph seed.",
      });
    }
    const pagination = parsePagination(request.query.page, request.query.limit, {
      limit: 25,
      maxLimit: 100,
    });
    if (isQueryParameterError(pagination)) {
      return response.status(400).json(pagination);
    }
    return response.status(200).json(await lookupLexicalEvidenceGraphSeeds({
      query,
      page: pagination.page,
      limit: pagination.limit,
    }));
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get(
  "/evidence/graph/neighborhood/:seedId",
  async (request, response, next) => {
    try {
      const depth = Number(getQueryString(request.query.depth) || "1");
      const limit = Number(getQueryString(request.query.limit) || "40");
      if (![1, 2].includes(depth) || !Number.isInteger(limit)
        || limit < 2 || limit > 100) {
        return response.status(400).json({
          error: "INVALID_LEXICAL_GRAPH_EXPANSION",
          message: "depth must be 1 or 2 and limit must be an integer from 2 through 100.",
        });
      }
      const result = await getLexicalEvidenceGraphNeighborhood({
        seedId: request.params.seedId,
        depth: depth as 1 | 2,
        limit,
      });
      return result
        ? response.status(200).json(result)
        : response.status(404).json({
          error: "LEXICAL_GRAPH_SEED_NOT_FOUND",
          message: `No lexical-evidence graph object found with ID ${request.params.seedId}.`,
        });
    } catch (error) {
      return next(error);
    }
  },
);

lexiconRouter.get(
  "/evidence/relationships/:relationshipId",
  async (request, response, next) => {
    try {
      const result = await getLexicalEvidenceRelationship(
        request.params.relationshipId,
      );
      return result
        ? response.status(200).json(result)
        : response.status(404).json({
          error: "LEXICAL_RELATIONSHIP_NOT_FOUND",
          message: `No lexical relationship found with ID ${request.params.relationshipId}.`,
        });
    } catch (error) {
      return next(error);
    }
  },
);

lexiconRouter.get(
  "/evidence/relationships/:relationshipId/evidence",
  async (request, response, next) => {
    try {
      const pagination = parsePagination(request.query.page, request.query.limit, {
        limit: 25,
        maxLimit: 100,
      });
      if (isQueryParameterError(pagination)) {
        return response.status(400).json(pagination);
      }
      return response.status(200).json(
        await listLexicalEvidenceRelationshipEvidence(
          request.params.relationshipId,
          pagination.page,
          pagination.limit,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);
const coverageSorts = new Set<DictionaryRootLemmaCoverageSort>([
  "gaps",
  "coverage",
  "senses",
  "lemma",
]);

function validatedFilter<T extends string>(
  rawValue: unknown,
  fallback: T,
  allowed: Set<T>,
): T | undefined {
  const value = getQueryString(rawValue) || fallback;
  return allowed.has(value as T) ? (value as T) : undefined;
}

lexiconRouter.get("/evidence/search", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json({
        error: "INVALID_QUERY",
        message: "q must contain a lexical form to inspect.",
      });
    }
    const pagination = parsePagination(request.query.page, request.query.limit, {
      limit: 25,
      maxLimit: 100,
    });
    if (isQueryParameterError(pagination)) {
      return response.status(400).json(pagination);
    }
    return response.status(200).json(await searchDictionaryRootLexicalEvidence({
      query,
      page: pagination.page,
      limit: pagination.limit,
    }));
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/evidence/coverage", async (_request, response, next) => {
  try {
    return response.status(200).json(
      await getDictionaryRootLexicalEvidenceCoverage(),
    );
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/evidence/sources", async (_request, response, next) => {
  try {
    return response.status(200).json(
      await listDictionaryRootLexicalEvidenceSources(),
    );
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/evidence/lemmas/:lemmaId", async (request, response, next) => {
  try {
    const result = await getDictionaryRootLexicalEvidenceLemma(
      request.params.lemmaId,
    );
    return result
      ? response.status(200).json(result)
      : response.status(404).json({
        error: "LEXICAL_LEMMA_NOT_FOUND",
        message: `No lexical lemma found with ID ${request.params.lemmaId}.`,
      });
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/evidence/senses/:senseId", async (request, response, next) => {
  try {
    const result = await getDictionaryRootLexicalEvidenceSense(
      request.params.senseId,
    );
    return result
      ? response.status(200).json(result)
      : response.status(404).json({
        error: "LEXICAL_SENSE_NOT_FOUND",
        message: `No lexical sense found with ID ${request.params.senseId}.`,
      });
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get(
  "/evidence/objects/:subjectId/:resource",
  async (request, response, next) => {
    try {
      const resource = request.params.resource;
      if (!evidenceResources.has(resource as typeof evidenceResources extends
      Set<infer T> ? T : never)) {
        return response.status(400).json({
          error: "INVALID_LEXICAL_EVIDENCE_RESOURCE",
          message: "resource must be claims, forms, etymologies, comparisons, locators, or provenance.",
        });
      }
      const items = await listDictionaryRootLexicalEvidenceResource(
        resource as "claims" | "forms" | "etymologies" | "comparisons"
          | "locators" | "provenance",
        request.params.subjectId,
      );
      return response.status(200).json({ total: items.length, items });
    } catch (error) {
      return next(error);
    }
  },
);


lexiconRouter.get("/neighborhood/:nodeId", async (request, response, next) => {
  try {
    const depthValue = Number(getQueryString(request.query.depth) || "1");
    const limitValue = Number(getQueryString(request.query.limit) || "40");
    if (![1, 2].includes(depthValue) || !Number.isInteger(limitValue) || limitValue < 2 || limitValue > 100) {
      return response.status(400).json({
        error: "INVALID_EXPANSION",
        message: "depth must be 1 or 2 and limit must be an integer from 2 through 100.",
      });
    }

    const neighborhood = await getDictionaryRootDynamicNeighborhood(
      request.params.nodeId,
      { depth: depthValue as 1 | 2, limit: limitValue },
    );
    if (!neighborhood) {
      return response.status(404).json({
        error: "NODE_NOT_FOUND",
        message: `No node found with ID ${request.params.nodeId}.`,
      });
    }
    return response.status(200).json(neighborhood);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/status", async (request, response, next) => {
  try {
    const bundleId = getQueryString(request.query.bundleId);
    const status = await getDictionaryRootLexiconStatus(bundleId);
    return response.status(200).json(status);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/coverage", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json({
        error: "INVALID_QUERY",
        message: "q must contain a lemma to inspect.",
      });
    }
    const bundleId = getQueryString(request.query.bundleId);
    const coverage = await getDictionaryRootLemmaCoverage(query, bundleId);
    return response.status(200).json(coverage);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/dashboard", async (request, response, next) => {
  try {
    const bundleId = getQueryString(request.query.bundleId);
    const dashboard = await getDictionaryRootCoverageDashboard(bundleId);
    return response.status(200).json(dashboard);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/lemmas", async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, {
      limit: 25,
      maxLimit: 100,
    });
    if (isQueryParameterError(pagination)) {
      return response.status(400).json(pagination);
    }

    const coverage = validatedFilter(request.query.coverage, "all", coverageFilters);
    const source = validatedFilter(request.query.source, "all", sourceFilters);
    const history = validatedFilter(request.query.history, "all", historyFilters);
    const review = validatedFilter(request.query.review, "all", reviewFilters);
    const sort = validatedFilter(request.query.sort, "gaps", coverageSorts);

    if (!coverage || !source || !history || !review || !sort) {
      return response.status(400).json({
        error: "INVALID_FILTER",
        message: "Coverage dashboard filters contain an unsupported value.",
      });
    }

    const result = await listDictionaryRootLemmaCoverage({
      page: pagination.page,
      limit: pagination.limit,
      bundleId: getQueryString(request.query.bundleId),
      query: getQueryString(request.query.q),
      partOfSpeech: getQueryString(request.query.partOfSpeech),
      coverage,
      source,
      history,
      review,
      sort,
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
