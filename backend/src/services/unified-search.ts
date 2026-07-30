import {
  CORE_LEXICAL_CORPUS_ID,
  CORE_LEXICAL_CORPUS_VERSION,
} from "../dictionaryroot/core-lexical-corpus.js";
import {
  searchDictionaryRootLexicalEvidence,
} from "./lexical-evidence-store.js";
import {
  searchKnowledge,
  type SearchResult,
  type SearchResultType,
} from "./search-store.js";

export const UNIFIED_SEARCH_DEFAULT_LIMIT = 10;
export const UNIFIED_SEARCH_MAX_LIMIT = 20;
export const UNIFIED_SEARCH_MAX_PAGE = 5;
export const UNIFIED_SEARCH_PER_ROOT_LIMIT = 100;
export const UNIFIED_SEARCH_SUMMARY_LIMIT = 280;
export const UNIFIED_SEARCH_MAX_QUERY_LENGTH = 200;
export const UNIFIED_SEARCH_ROOT_TIMEOUT_MS = 4_000;

export const HISTORYROOT_DATASET_ID =
  "historyroot-plymouth-knowledge-dataset-v1";
export const HISTORYROOT_DATASET_VERSION = "1.3.0";

export const UNIFIED_ROOT_IDS = [
  "DictionaryRoot",
  "HistoryRoot",
] as const;

export type UnifiedRootId = typeof UNIFIED_ROOT_IDS[number];

export const UNIFIED_RESULT_TYPES = [
  "lexical-sense",
  "context-entity",
  "context-claim",
  "context-evidence",
  "context-interpretation",
  "context-relationship",
  "context-account",
  "context-claim-version",
  "source",
] as const;

export type UnifiedResultType = typeof UNIFIED_RESULT_TYPES[number];

export type UnifiedMatchClassification =
  | "exact"
  | "normalized-exact"
  | "form-match"
  | "title-match"
  | "contextual-occurrence";

export interface UnifiedSearchOptions {
  query: string;
  roots: UnifiedRootId[];
  resultTypes: UnifiedResultType[];
  page: number;
  limit: number;
}

export interface UnifiedSearchResult {
  resultId: string;
  rootId: UnifiedRootId;
  rootDisplayName: string;
  canonicalObjectId: string;
  canonicalResultType: UnifiedResultType;
  title: string;
  summary: string | null;
  canonicalUrl: string;
  datasetId: string;
  datasetVersion: string;
  matchClassification: UnifiedMatchClassification;
  matchExplanation: string;
  sourceEvidenceAvailable: boolean;
  connectionBasis: "query-overlap-only";
  rootSpecificMetadata: Record<string, string | number | boolean | string[] | null>;
}

export interface UnifiedRootAvailability {
  rootId: UnifiedRootId;
  selected: boolean;
  status:
    | "available"
    | "unavailable"
    | "not-selected"
    | "excluded-by-result-type";
  resultTotal: number;
  message: string;
}

export interface UnifiedSearchResponse {
  query: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  returned: number;
  hasNextPage: boolean;
  items: UnifiedSearchResult[];
  counts: {
    combined: number;
    DictionaryRoot: number;
    HistoryRoot: number;
    exact: number;
    relatedOrContextual: number;
    duplicateResultIds: number;
  };
  appliedFilters: {
    roots: UnifiedRootId[];
    resultTypes: UnifiedResultType[];
  };
  availability: {
    status:
      | "all-available"
      | "partial-availability"
      | "all-unavailable"
      | "empty"
      | "filters-exclude-all-result-types";
    roots: UnifiedRootAvailability[];
    unavailableRoots: UnifiedRootId[];
  };
  ordering: {
    contract: string[];
    deterministic: true;
  };
  bounds: {
    defaultLimit: number;
    maximumLimit: number;
    maximumPage: number;
    perRootCandidateLimit: number;
    summaryCharacterLimit: number;
    maximumQueryLength: number;
    perRootTimeoutMs: number;
  };
}

interface DictionarySearchPayload {
  page: number;
  limit: number;
  total: number;
  exactTotal?: number;
  totalPages: number;
  items: Record<string, unknown>[];
}

export interface UnifiedSearchProviders {
  dictionaryRoot: (options: {
    query: string;
    page: number;
    limit: number;
  }) => Promise<DictionarySearchPayload>;
  historyRoot: (options: {
    query: string;
    page: number;
    limit: number;
    types: SearchResultType[];
    bundleId: string;
    domain: string;
    unifiedOrdering: true;
  }) => Promise<{
    total: number;
    results: SearchResult[];
    matchCounts?: {
      exact: number;
      related: number;
    };
  }>;
}

const defaultProviders: UnifiedSearchProviders = {
  dictionaryRoot: searchDictionaryRootLexicalEvidence,
  historyRoot: searchKnowledge,
};

const HISTORY_RESULT_TYPES = new Set<UnifiedResultType>(
  UNIFIED_RESULT_TYPES.filter((type) => type !== "lexical-sense"),
);

const MATCH_ORDER: Record<UnifiedMatchClassification, number> = {
  exact: 0,
  "normalized-exact": 1,
  "form-match": 2,
  "title-match": 3,
  "contextual-occurrence": 4,
};

const ROOT_ORDER: Record<UnifiedRootId, number> = {
  DictionaryRoot: 0,
  HistoryRoot: 1,
};

const RESULT_TYPE_ORDER = new Map<UnifiedResultType, number>(
  UNIFIED_RESULT_TYPES.map((type, index) => [type, index]),
);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function comparable(value: unknown): string {
  return clean(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ");
}

function boundedSummary(value: unknown): string | null {
  const normalized = clean(value).replace(/\s+/gu, " ");
  if (!normalized) return null;
  if (normalized.length <= UNIFIED_SEARCH_SUMMARY_LIMIT) return normalized;
  return `${normalized.slice(0, UNIFIED_SEARCH_SUMMARY_LIMIT - 1).trimEnd()}…`;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function dictionaryClassification(
  query: string,
  title: string,
): UnifiedMatchClassification {
  const trimmedQuery = clean(query);
  const trimmedTitle = clean(title);
  if (trimmedQuery.toLocaleLowerCase() === trimmedTitle.toLocaleLowerCase()) {
    return "exact";
  }
  if (comparable(trimmedQuery) === comparable(trimmedTitle)) {
    return "normalized-exact";
  }
  return "form-match";
}

function historyClassification(
  query: string,
  item: SearchResult,
): UnifiedMatchClassification {
  if (comparable(query) === comparable(item.title)) return "title-match";
  const alternateNames = readStringArray(item.metadata.alternateNames);
  if (alternateNames.some((name) => comparable(name) === comparable(query))) {
    return "normalized-exact";
  }
  return "contextual-occurrence";
}

function dictionaryResult(
  query: string,
  item: Record<string, unknown>,
): UnifiedSearchResult | undefined {
  const objectId = clean(item.senseId);
  const title = clean(item.canonicalWrittenForm);
  if (!objectId || !title) return undefined;
  const matchClassification = dictionaryClassification(query, title);
  const canonicalUrl = new URLSearchParams({
    q: title,
    nodeId: objectId,
  });
  return {
    resultId: `DictionaryRoot:lexical-sense:${objectId}`,
    rootId: "DictionaryRoot",
    rootDisplayName: "DictionaryRoot",
    canonicalObjectId: objectId,
    canonicalResultType: "lexical-sense",
    title,
    summary: boundedSummary(item.definition),
    canonicalUrl: `concept-v2.html?${canonicalUrl.toString()}`,
    datasetId: CORE_LEXICAL_CORPUS_ID,
    datasetVersion: CORE_LEXICAL_CORPUS_VERSION,
    matchClassification,
    matchExplanation: matchClassification === "exact"
      ? "The canonical lexical form exactly matches the submitted term."
      : matchClassification === "normalized-exact"
        ? "The canonical lexical form matches after case and spacing normalization."
        : "A canonical or recorded lexical form begins with the submitted term.",
    sourceEvidenceAvailable: Boolean(clean(item.definition)),
    connectionBasis: "query-overlap-only",
    rootSpecificMetadata: {
      lemmaId: clean(item.lemmaId) || null,
      partOfSpeech: clean(item.partOfSpeech) || null,
      lexicalCategory: clean(item.lexicalCategory) || null,
      reviewStatus: clean(item.reviewStatus) || null,
      uncertainty: clean(item.uncertainty) || null,
      domainLabel: clean(item.domainLabel) || null,
      registerLabel: clean(item.registerLabel) || null,
    },
  };
}

function historyCanonicalUrl(item: SearchResult): string {
  const reviewUrl = clean(item.metadata.reviewUrl);
  if (reviewUrl) return reviewUrl;
  const query = new URLSearchParams({ id: item.id });
  return `history-record-v1.html?${query.toString()}`;
}

function historyResult(
  query: string,
  item: SearchResult,
): UnifiedSearchResult | undefined {
  if (!HISTORY_RESULT_TYPES.has(item.resultType as UnifiedResultType)) {
    return undefined;
  }
  const resultType = item.resultType as UnifiedResultType;
  const matchClassification = historyClassification(query, item);
  const alternateNames = readStringArray(item.metadata.alternateNames);
  return {
    resultId: `HistoryRoot:${resultType}:${item.id}`,
    rootId: "HistoryRoot",
    rootDisplayName: "HistoryRoot",
    canonicalObjectId: item.id,
    canonicalResultType: resultType,
    title: item.title,
    summary: boundedSummary(item.summary),
    canonicalUrl: historyCanonicalUrl(item),
    datasetId: HISTORYROOT_DATASET_ID,
    datasetVersion: HISTORYROOT_DATASET_VERSION,
    matchClassification,
    matchExplanation: matchClassification === "title-match"
      ? "The historical record title matches the submitted term."
      : matchClassification === "normalized-exact"
        ? "A recorded historical name matches after normalization."
        : "The term occurs in searchable historical record context.",
    sourceEvidenceAvailable: [
      "source",
      "context-claim",
      "context-claim-version",
      "context-evidence",
    ].includes(resultType),
    connectionBasis: "query-overlap-only",
    rootSpecificMetadata: {
      objectType: item.objectType,
      domain: item.domain,
      recordKind: clean(item.metadata.recordKind) || null,
      entityType: clean(item.metadata.entityType) || null,
      relationshipType: clean(item.metadata.relationshipType) || null,
      parentRecordId: clean(item.metadata.parentRecordId) || null,
      claimId: clean(item.metadata.claimId) || null,
      matchedVersionId: clean(item.metadata.matchedVersionId) || null,
      isHistorical: item.metadata.isHistorical === true,
      alternateNames,
    },
  };
}

export function compareUnifiedResults(
  left: UnifiedSearchResult,
  right: UnifiedSearchResult,
): number {
  return MATCH_ORDER[left.matchClassification]
    - MATCH_ORDER[right.matchClassification]
    || ROOT_ORDER[left.rootId] - ROOT_ORDER[right.rootId]
    || (RESULT_TYPE_ORDER.get(left.canonicalResultType) ?? 99)
      - (RESULT_TYPE_ORDER.get(right.canonicalResultType) ?? 99)
    || comparable(left.title).localeCompare(comparable(right.title), "en")
    || left.canonicalObjectId.localeCompare(right.canonicalObjectId, "en");
}

function rootAvailability(
  rootId: UnifiedRootId,
  selected: boolean,
  compatible: boolean,
  result: PromiseSettledResult<unknown> | undefined,
  total: number,
): UnifiedRootAvailability {
  if (!selected) {
    return {
      rootId,
      selected: false,
      status: "not-selected",
      resultTotal: 0,
      message: `${rootId} was not selected.`,
    };
  }
  if (!compatible) {
    return {
      rootId,
      selected: true,
      status: "excluded-by-result-type",
      resultTotal: 0,
      message: "The selected result types do not belong to this Root.",
    };
  }
  if (result?.status === "fulfilled") {
    return {
      rootId,
      selected: true,
      status: "available",
      resultTotal: total,
      message: `${rootId} search completed.`,
    };
  }
  return {
    rootId,
    selected: true,
    status: "unavailable",
    resultTotal: 0,
    message: `${rootId} could not be queried; no fallback data was used.`,
  };
}

export async function searchUnified(
  options: UnifiedSearchOptions,
  providers: UnifiedSearchProviders = defaultProviders,
  rootTimeoutMs = UNIFIED_SEARCH_ROOT_TIMEOUT_MS,
): Promise<UnifiedSearchResponse> {
  const selectedRoots = new Set(options.roots);
  const selectedTypes = new Set(options.resultTypes);
  const allTypes = selectedTypes.size === 0;
  const dictionaryCompatible = selectedRoots.has("DictionaryRoot")
    && (allTypes || selectedTypes.has("lexical-sense"));
  const selectedHistoryTypes = UNIFIED_RESULT_TYPES.filter(
    (type): type is Exclude<UnifiedResultType, "lexical-sense"> =>
      type !== "lexical-sense" && (allTypes || selectedTypes.has(type)),
  );
  const historyCompatible = selectedRoots.has("HistoryRoot")
    && selectedHistoryTypes.length > 0;
  const candidateLimit = Math.min(
    UNIFIED_SEARCH_PER_ROOT_LIMIT,
    options.page * options.limit,
  );

  const dictionaryPromise = dictionaryCompatible
    ? providers.dictionaryRoot({
        query: options.query,
        page: 1,
        limit: candidateLimit,
      })
    : undefined;
  const historyPromise = historyCompatible
    ? providers.historyRoot({
        query: options.query,
        page: 1,
        limit: candidateLimit,
        types: selectedHistoryTypes as SearchResultType[],
        bundleId: HISTORYROOT_DATASET_ID,
        domain: "HistoryRoot",
        unifiedOrdering: true,
      })
    : undefined;

  function settledWithTimeout<T>(
    promise: Promise<T> | undefined,
    rootId: UnifiedRootId,
  ) {
    if (!promise) return Promise.resolve(undefined);
    return new Promise<
      | { status: "fulfilled"; value: T }
      | { status: "rejected"; reason: unknown }
    >((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          status: "rejected",
          reason: new Error(`${rootId} search exceeded ${rootTimeoutMs} ms.`),
        });
      }, rootTimeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timeout);
          resolve({ status: "fulfilled", value });
        },
        (reason: unknown) => {
          clearTimeout(timeout);
          resolve({ status: "rejected", reason });
        },
      );
    });
  }

  const [dictionarySettled, historySettled] = await Promise.all([
    dictionaryPromise
      ? settledWithTimeout(dictionaryPromise, "DictionaryRoot")
      : Promise.resolve(undefined),
    historyPromise
      ? settledWithTimeout(historyPromise, "HistoryRoot")
      : Promise.resolve(undefined),
  ]);

  const dictionaryPayload = dictionarySettled?.status === "fulfilled"
    ? dictionarySettled.value
    : undefined;
  const historyPayload = historySettled?.status === "fulfilled"
    ? historySettled.value
    : undefined;
  const dictionaryItems = dictionaryPayload
    ? dictionaryPayload.items
        .map((item) => dictionaryResult(options.query, item))
        .filter((item): item is UnifiedSearchResult => item !== undefined)
    : [];
  const historyItems = historyPayload
    ? historyPayload.results
        .map((item) => historyResult(options.query, item))
        .filter((item): item is UnifiedSearchResult => item !== undefined)
    : [];

  const dictionaryTotal = dictionaryPayload?.total ?? 0;
  const historyTotal = historyPayload?.total ?? 0;
  const combinedTotal = dictionaryTotal + historyTotal;
  const sorted = [...dictionaryItems, ...historyItems].sort(
    compareUnifiedResults,
  );
  const unique = sorted.filter((item, index, items) =>
    items.findIndex((candidate) => candidate.resultId === item.resultId)
      === index);
  const duplicateResultIds = sorted.length - unique.length;
  const offset = (options.page - 1) * options.limit;
  const items = unique.slice(offset, offset + options.limit);
  const exactLoaded = unique.filter((item) => [
    "exact",
    "normalized-exact",
    "title-match",
  ].includes(item.matchClassification)).length;
  const dictionaryExact = dictionaryPayload?.exactTotal
    ?? dictionaryItems.filter((item) => [
      "exact",
      "normalized-exact",
    ].includes(item.matchClassification)).length;
  const historyExact = historyPayload?.matchCounts?.exact
    ?? historyItems.filter((item) => [
      "normalized-exact",
      "title-match",
    ].includes(item.matchClassification)).length;
  const exactTotal = Math.min(
    Math.max(exactLoaded, dictionaryExact + historyExact),
    combinedTotal,
  );

  const availabilityRoots = [
    rootAvailability(
      "DictionaryRoot",
      selectedRoots.has("DictionaryRoot"),
      dictionaryCompatible,
      dictionarySettled,
      dictionaryTotal,
    ),
    rootAvailability(
      "HistoryRoot",
      selectedRoots.has("HistoryRoot"),
      historyCompatible,
      historySettled,
      historyTotal,
    ),
  ];
  const queried = availabilityRoots.filter((root) =>
    root.selected && root.status !== "excluded-by-result-type");
  const unavailableRoots = queried
    .filter((root) => root.status === "unavailable")
    .map((root) => root.rootId);
  const availableCount = queried.filter((root) =>
    root.status === "available").length;
  let availabilityStatus: UnifiedSearchResponse["availability"]["status"];
  if (queried.length === 0) {
    availabilityStatus = "filters-exclude-all-result-types";
  } else if (availableCount === 0) {
    availabilityStatus = "all-unavailable";
  } else if (unavailableRoots.length > 0) {
    availabilityStatus = "partial-availability";
  } else if (combinedTotal === 0) {
    availabilityStatus = "empty";
  } else {
    availabilityStatus = "all-available";
  }

  return {
    query: options.query,
    page: options.page,
    limit: options.limit,
    total: combinedTotal,
    totalPages: combinedTotal === 0
      ? 0
      : Math.min(
          UNIFIED_SEARCH_MAX_PAGE,
          Math.ceil(combinedTotal / options.limit),
        ),
    returned: items.length,
    hasNextPage: options.page < UNIFIED_SEARCH_MAX_PAGE
      && offset + items.length < combinedTotal,
    items,
    counts: {
      combined: combinedTotal,
      DictionaryRoot: dictionaryTotal,
      HistoryRoot: historyTotal,
      exact: exactTotal,
      relatedOrContextual: Math.max(0, combinedTotal - exactTotal),
      duplicateResultIds,
    },
    appliedFilters: {
      roots: options.roots,
      resultTypes: options.resultTypes,
    },
    availability: {
      status: availabilityStatus,
      roots: availabilityRoots,
      unavailableRoots,
    },
    ordering: {
      contract: [
        "match-classification",
        "root",
        "canonical-result-type",
        "normalized-title",
        "canonical-object-id",
      ],
      deterministic: true,
    },
    bounds: {
      defaultLimit: UNIFIED_SEARCH_DEFAULT_LIMIT,
      maximumLimit: UNIFIED_SEARCH_MAX_LIMIT,
      maximumPage: UNIFIED_SEARCH_MAX_PAGE,
      perRootCandidateLimit: UNIFIED_SEARCH_PER_ROOT_LIMIT,
      summaryCharacterLimit: UNIFIED_SEARCH_SUMMARY_LIMIT,
      maximumQueryLength: UNIFIED_SEARCH_MAX_QUERY_LENGTH,
      perRootTimeoutMs: rootTimeoutMs,
    },
  };
}
