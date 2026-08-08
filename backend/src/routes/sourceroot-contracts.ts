/**
 * Read-only SourceRoot contract discovery routes.
 *
 * These routes serve contract grammar only. They read no database, expose no
 * Root data, and provide no mutation surface: SourceRoot contract v1 is
 * read-only, so only GET handlers exist here.
 */

import { Router } from "express";

import { createApiError } from "../lib/api-contract.js";
import {
  buildObjectTypeMaturityMatrix,
  buildRootIntegrationContract,
  describeAddressFormat,
  describeIdentityAssertionContract,
  describeQueryVocabulary,
  describeRootRegistry,
  describeSourceRootContract,
  isQueryParameterError,
  listRootIntegrationContracts,
  parsePagination,
  SOURCEROOT_CONTRACT_VERSION,
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
  SOURCEROOT_MAX_PAGE_SIZE,
  tryParseSourceRootAddress,
} from "../sourceroot/contracts.js";

export const sourceRootContractsRouter = Router();

function versionHeader() {
  return {
    sourcerootContractVersion: SOURCEROOT_CONTRACT_VERSION,
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
  };
}

sourceRootContractsRouter.get("/contracts", (_request, response) => {
  response.status(200).json(describeSourceRootContract());
});

sourceRootContractsRouter.get("/contracts/roots", (request, response) => {
  const pagination = parsePagination(
    request.query.page,
    request.query.limit,
    { limit: SOURCEROOT_MAX_PAGE_SIZE, maxLimit: SOURCEROOT_MAX_PAGE_SIZE },
  );
  if (isQueryParameterError(pagination)) {
    response.status(400).json({
      ...pagination,
      requestId: response.locals.requestId,
    });
    return;
  }

  const contracts = listRootIntegrationContracts();
  const items = contracts.slice(
    pagination.offset,
    pagination.offset + pagination.limit,
  );

  // Only `rootIntegrationContracts` is paginated. The registry description is
  // returned separately and explicitly labelled as non-paginated metadata, so
  // the response can never suggest that both views share one pagination
  // contract.
  const { roots, ...registryMetadata } = describeRootRegistry();

  response.status(200).json({
    ...versionHeader(),
    paginatedCollection: "rootIntegrationContracts",
    rootIntegrationContracts: items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset,
      returned: items.length,
      total: contracts.length,
      totalPages: Math.ceil(contracts.length / pagination.limit),
      hasMore: pagination.offset + items.length < contracts.length,
      totalSemantics: "exact",
    },
    registryMetadata: {
      ...registryMetadata,
      paginated: false,
      note: "Registry metadata is complete and is not subject to the pagination contract above.",
    },
    fullRegistry: {
      paginated: false,
      total: roots.length,
      roots,
      note: "The complete Root registry, returned unpaginated. Use rootIntegrationContracts for the paginated view.",
    },
    semanticConclusion: null,
  });
});

sourceRootContractsRouter.get(
  "/contracts/roots/:rootId",
  (request, response) => {
    const contract = buildRootIntegrationContract(request.params.rootId);
    if (!contract) {
      response.status(404).json(
        createApiError(
          "SOURCEROOT_ROOT_NOT_REGISTERED",
          "The requested Root is not registered in the SourceRoot network Root registry.",
          404,
          {
            category: "not-found",
            field: "rootId",
            requestId: response.locals.requestId,
          },
        ),
      );
      return;
    }
    response.status(200).json({
      ...versionHeader(),
      rootIntegrationContract: contract,
      semanticConclusion: null,
    });
  },
);

sourceRootContractsRouter.get("/contracts/object-types", (_request, response) => {
  const contract = describeSourceRootContract();
  response.status(200).json({
    ...versionHeader(),
    ...contract.objectTypes,
    matrix: buildObjectTypeMaturityMatrix(),
    semanticConclusion: null,
  });
});

sourceRootContractsRouter.get(
  "/contracts/identity-assertions",
  (_request, response) => {
    response.status(200).json({
      ...versionHeader(),
      ...describeIdentityAssertionContract(),
    });
  },
);

sourceRootContractsRouter.get("/contracts/query", (_request, response) => {
  response.status(200).json({
    ...versionHeader(),
    ...describeQueryVocabulary(),
  });
});

/**
 * Address contract description, plus optional validation of a supplied
 * address. Validation echoes the parsed components and never implies that two
 * addresses refer to the same thing.
 */
sourceRootContractsRouter.get("/contracts/address", (request, response) => {
  const supplied = request.query.address;
  if (supplied === undefined) {
    response.status(200).json({
      ...versionHeader(),
      ...describeAddressFormat(),
    });
    return;
  }

  if (typeof supplied !== "string") {
    response.status(400).json(
      createApiError(
        "SOURCEROOT_ADDRESS_INVALID",
        "address must be supplied exactly once as a string.",
        400,
        {
          category: "invalid-query",
          field: "address",
          requestId: response.locals.requestId,
        },
      ),
    );
    return;
  }

  const parsed = tryParseSourceRootAddress(supplied);
  if (!parsed.ok) {
    response.status(400).json(
      createApiError(
        "SOURCEROOT_ADDRESS_INVALID",
        parsed.message,
        400,
        {
          category: "invalid-query",
          field: parsed.component ?? "address",
          details: { code: parsed.code },
          requestId: response.locals.requestId,
        },
      ),
    );
    return;
  }

  response.status(200).json({
    ...versionHeader(),
    valid: true,
    address: parsed.address,
    identitySemantics:
      "An address is a locator. It never implies shared identity between Root-owned resources.",
    semanticConclusion: null,
  });
});
