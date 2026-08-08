/**
 * SourceRoot network addressing, contract v1.
 *
 * An address names a Root-owned network object. Existing resource identity in
 * this repository is dataset-scoped (see migration 018
 * `uq_cross_root_resource_canonical`), so a v1 address is dataset-qualified and
 * a missing dataset qualification is rejected. No dataset-independent identity
 * is invented here.
 *
 * Canonical syntax:
 *
 *   sourceroot:<rootId>/<objectType>/<canonicalPublicId>@<datasetId>:<datasetVersion>
 *
 * Every variable component is percent-encoded so the `/`, `@`, and `:`
 * delimiters can never appear literally inside a component. Parsing is strict:
 * non-canonical escapes are rejected, which makes
 * `formatSourceRootAddress(parseSourceRootAddress(text)) === text` an exact
 * round trip for every accepted address.
 *
 * IMPORTANT SEMANTIC BOUNDARY: an address is a locator, never an identity
 * claim. Two different addresses that look alike, share a label, or share a
 * canonical public ID are still two distinct Root-owned resources. Only an
 * explicit, evidence-backed identity assertion may connect them, and even an
 * accepted assertion never merges them. See `identity-assertions.ts`.
 */

/**
 * The address format is versioned independently from the SourceRoot shared
 * contract version and from any Root contract version.
 */
export const SOURCEROOT_ADDRESS_FORMAT_VERSION = "1.0.0" as const;

export const SOURCEROOT_ADDRESS_SCHEME = "sourceroot" as const;

/** Maximum decoded length of any single address component. */
export const SOURCEROOT_ADDRESS_COMPONENT_MAX_LENGTH = 256;

/** Maximum length of a serialized address. */
export const SOURCEROOT_ADDRESS_MAX_LENGTH = 1024;

export type SourceRootAddressErrorCode =
  | "address-empty"
  | "address-too-long"
  | "address-scheme-invalid"
  | "address-structure-invalid"
  | "address-dataset-qualification-missing"
  | "address-dataset-version-missing"
  | "address-component-empty"
  | "address-component-too-long"
  | "address-encoding-invalid"
  | "address-encoding-not-canonical"
  | "address-dataset-version-invalid";

export class SourceRootAddressError extends Error {
  public readonly code: SourceRootAddressErrorCode;
  public readonly component: string | null;

  constructor(
    code: SourceRootAddressErrorCode,
    message: string,
    component: string | null = null,
  ) {
    super(message);
    this.name = "SourceRootAddressError";
    this.code = code;
    this.component = component;
  }
}

export interface SourceRootAddress {
  readonly addressFormatVersion: typeof SOURCEROOT_ADDRESS_FORMAT_VERSION;
  readonly rootId: string;
  readonly objectType: string;
  readonly canonicalPublicId: string;
  /** Dataset qualification is mandatory in address format v1. */
  readonly datasetId: string;
  readonly datasetVersion: string;
}

export interface SourceRootAddressInput {
  readonly rootId: string;
  readonly objectType: string;
  readonly canonicalPublicId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
}

export type SourceRootAddressParseResult =
  | { readonly ok: true; readonly address: SourceRootAddress }
  | {
      readonly ok: false;
      readonly code: SourceRootAddressErrorCode;
      readonly message: string;
      readonly component: string | null;
    };

const UNRESERVED = /^[A-Za-z0-9\-._~]$/;
const UPPERCASE_HEX = /^[0-9A-F]{2}$/;

/**
 * SemVer-compatible dataset version. Released datasets in this repository use
 * `1.0.0` and `1.3.0`; contract fixtures use an explicit prerelease suffix so
 * they can never be mistaken for a released version.
 */
const DATASET_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const textEncoder = new TextEncoder();
const strictTextDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * The address format versions this contract build supports.
 *
 * This is the SOLE source of truth. Nothing outside this module may hardcode
 * an address-format version literal; consumers compare through
 * `checkAddressFormatVersion` instead.
 */
export const SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS = [
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
] as const;

export type VersionProblem =
  | "missing"
  | "not-a-string"
  | "blank"
  | "malformed"
  | "unsupported";

/**
 * Validates a dataset version against the SourceRoot contract v1 rule, the
 * same rule the address format applies.
 *
 * Returns null when valid, otherwise the specific problem. A value that is
 * present but semantically empty is rejected, not tolerated.
 */
/**
 * The one syntax rule every SourceRoot version shares.
 *
 * Dataset versions, address-format versions, and Root contract versions all
 * use it, so the pattern exists in exactly one place. Callers layer their own
 * "supported" check on top.
 */
export function checkVersionSyntax(
  value: unknown,
): Exclude<VersionProblem, "unsupported"> | null {
  if (value === undefined || value === null) return "missing";
  if (typeof value !== "string") return "not-a-string";
  if (value.trim().length === 0) return "blank";
  if (!DATASET_VERSION_PATTERN.test(value)) return "malformed";
  return null;
}

export function checkDatasetVersion(value: unknown): VersionProblem | null {
  return checkVersionSyntax(value);
}

export function isSourceRootDatasetVersion(value: unknown): boolean {
  return checkDatasetVersion(value) === null;
}

/**
 * Validates an address-format version.
 *
 * Distinguishes malformed (not a SemVer-compatible version at all) from
 * unsupported (well formed, but not a version this build implements), because
 * a consumer needs to know which of the two it is. Nothing is coerced.
 */
export function checkAddressFormatVersion(value: unknown): VersionProblem | null {
  const syntaxProblem = checkVersionSyntax(value);
  if (syntaxProblem !== null) return syntaxProblem;
  // checkVersionSyntax returning null guarantees a string.
  if (
    !(SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS as readonly string[]).includes(
      value as string,
    )
  ) {
    return "unsupported";
  }
  return null;
}

export function isSupportedAddressFormatVersion(value: unknown): boolean {
  return checkAddressFormatVersion(value) === null;
}

/**
 * Percent-encodes one address component. Deterministic: the same input always
 * produces the same output, and every escape is uppercase hex.
 */
export function encodeAddressComponent(value: string): string {
  let encoded = "";
  for (const character of value) {
    if (character.length === 1 && UNRESERVED.test(character)) {
      encoded += character;
      continue;
    }
    for (const byte of textEncoder.encode(character)) {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return encoded;
}

/**
 * Strictly decodes one address component.
 *
 * Rejects lowercase escapes, truncated escapes, over-encoded unreserved
 * characters, and invalid UTF-8. This strictness is what guarantees an exact
 * round trip rather than a merely lossless one.
 */
export function decodeAddressComponent(
  value: string,
  componentName: string,
): string {
  const bytes: number[] = [];
  let index = 0;

  while (index < value.length) {
    const character = value[index] as string;

    if (character !== "%") {
      if (!UNRESERVED.test(character)) {
        throw new SourceRootAddressError(
          "address-encoding-not-canonical",
          `${componentName} contains an unencoded reserved character.`,
          componentName,
        );
      }
      for (const byte of textEncoder.encode(character)) {
        bytes.push(byte);
      }
      index += 1;
      continue;
    }

    const escape = value.slice(index + 1, index + 3);
    if (escape.length !== 2 || !UPPERCASE_HEX.test(escape)) {
      throw new SourceRootAddressError(
        "address-encoding-invalid",
        `${componentName} contains a malformed percent escape.`,
        componentName,
      );
    }

    const byte = Number.parseInt(escape, 16);
    if (byte < 0x80 && UNRESERVED.test(String.fromCharCode(byte))) {
      throw new SourceRootAddressError(
        "address-encoding-not-canonical",
        `${componentName} over-encodes an unreserved character.`,
        componentName,
      );
    }

    bytes.push(byte);
    index += 3;
  }

  try {
    return strictTextDecoder.decode(Uint8Array.from(bytes));
  } catch {
    throw new SourceRootAddressError(
      "address-encoding-invalid",
      `${componentName} is not valid UTF-8 after decoding.`,
      componentName,
    );
  }
}

function requireComponent(value: unknown, componentName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new SourceRootAddressError(
      "address-component-empty",
      `${componentName} is required and must not be empty.`,
      componentName,
    );
  }
  if (value.length > SOURCEROOT_ADDRESS_COMPONENT_MAX_LENGTH) {
    throw new SourceRootAddressError(
      "address-component-too-long",
      `${componentName} exceeds ${SOURCEROOT_ADDRESS_COMPONENT_MAX_LENGTH} characters.`,
      componentName,
    );
  }
  return value;
}

/** Serializes an address deterministically. */
export function formatSourceRootAddress(
  input: SourceRootAddressInput,
): string {
  const rootId = requireComponent(input.rootId, "rootId");
  const objectType = requireComponent(input.objectType, "objectType");
  const canonicalPublicId = requireComponent(
    input.canonicalPublicId,
    "canonicalPublicId",
  );
  const datasetId = requireComponent(input.datasetId, "datasetId");
  const datasetVersion = requireComponent(
    input.datasetVersion,
    "datasetVersion",
  );

  if (!DATASET_VERSION_PATTERN.test(datasetVersion)) {
    throw new SourceRootAddressError(
      "address-dataset-version-invalid",
      "datasetVersion must be a SemVer-compatible version.",
      "datasetVersion",
    );
  }

  const serialized =
    `${SOURCEROOT_ADDRESS_SCHEME}:` +
    `${encodeAddressComponent(rootId)}/` +
    `${encodeAddressComponent(objectType)}/` +
    `${encodeAddressComponent(canonicalPublicId)}@` +
    `${encodeAddressComponent(datasetId)}:` +
    `${encodeAddressComponent(datasetVersion)}`;

  if (serialized.length > SOURCEROOT_ADDRESS_MAX_LENGTH) {
    throw new SourceRootAddressError(
      "address-too-long",
      `Serialized address exceeds ${SOURCEROOT_ADDRESS_MAX_LENGTH} characters.`,
    );
  }

  return serialized;
}

/** Builds a validated address object without serializing it. */
export function createSourceRootAddress(
  input: SourceRootAddressInput,
): SourceRootAddress {
  return parseSourceRootAddress(formatSourceRootAddress(input));
}

/** Parses a serialized address. Throws `SourceRootAddressError` on rejection. */
export function parseSourceRootAddress(text: unknown): SourceRootAddress {
  if (typeof text !== "string" || text.length === 0) {
    throw new SourceRootAddressError(
      "address-empty",
      "A SourceRoot address must be a non-empty string.",
    );
  }
  if (text.length > SOURCEROOT_ADDRESS_MAX_LENGTH) {
    throw new SourceRootAddressError(
      "address-too-long",
      `Serialized address exceeds ${SOURCEROOT_ADDRESS_MAX_LENGTH} characters.`,
    );
  }

  const schemePrefix = `${SOURCEROOT_ADDRESS_SCHEME}:`;
  if (!text.startsWith(schemePrefix)) {
    throw new SourceRootAddressError(
      "address-scheme-invalid",
      `A SourceRoot address must begin with "${schemePrefix}".`,
    );
  }

  const body = text.slice(schemePrefix.length);
  const atIndex = body.indexOf("@");
  if (atIndex < 0) {
    throw new SourceRootAddressError(
      "address-dataset-qualification-missing",
      "Address format v1 requires dataset qualification (@datasetId:datasetVersion).",
      "datasetId",
    );
  }
  if (body.indexOf("@", atIndex + 1) >= 0) {
    throw new SourceRootAddressError(
      "address-structure-invalid",
      "An address must contain exactly one dataset qualification separator.",
    );
  }

  const objectPart = body.slice(0, atIndex);
  const datasetPart = body.slice(atIndex + 1);

  const objectSegments = objectPart.split("/");
  if (objectSegments.length !== 3) {
    throw new SourceRootAddressError(
      "address-structure-invalid",
      "An address must contain exactly rootId/objectType/canonicalPublicId before the dataset qualification.",
    );
  }

  const datasetSeparator = datasetPart.indexOf(":");
  if (datasetSeparator < 0) {
    throw new SourceRootAddressError(
      "address-dataset-version-missing",
      "Address format v1 requires an explicit dataset version.",
      "datasetVersion",
    );
  }
  if (datasetPart.indexOf(":", datasetSeparator + 1) >= 0) {
    throw new SourceRootAddressError(
      "address-structure-invalid",
      "The dataset qualification must contain exactly one version separator.",
    );
  }

  const rawRootId = objectSegments[0] as string;
  const rawObjectType = objectSegments[1] as string;
  const rawCanonicalPublicId = objectSegments[2] as string;
  const rawDatasetId = datasetPart.slice(0, datasetSeparator);
  const rawDatasetVersion = datasetPart.slice(datasetSeparator + 1);

  if (rawDatasetId.length === 0) {
    throw new SourceRootAddressError(
      "address-dataset-qualification-missing",
      "Address format v1 requires a non-empty datasetId.",
      "datasetId",
    );
  }
  if (rawDatasetVersion.length === 0) {
    throw new SourceRootAddressError(
      "address-dataset-version-missing",
      "Address format v1 requires a non-empty dataset version.",
      "datasetVersion",
    );
  }

  const rootId = requireComponent(
    decodeAddressComponent(rawRootId, "rootId"),
    "rootId",
  );
  const objectType = requireComponent(
    decodeAddressComponent(rawObjectType, "objectType"),
    "objectType",
  );
  const canonicalPublicId = requireComponent(
    decodeAddressComponent(rawCanonicalPublicId, "canonicalPublicId"),
    "canonicalPublicId",
  );
  const datasetId = requireComponent(
    decodeAddressComponent(rawDatasetId, "datasetId"),
    "datasetId",
  );
  const datasetVersion = requireComponent(
    decodeAddressComponent(rawDatasetVersion, "datasetVersion"),
    "datasetVersion",
  );

  if (!DATASET_VERSION_PATTERN.test(datasetVersion)) {
    throw new SourceRootAddressError(
      "address-dataset-version-invalid",
      "datasetVersion must be a SemVer-compatible version.",
      "datasetVersion",
    );
  }

  return {
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    rootId,
    objectType,
    canonicalPublicId,
    datasetId,
    datasetVersion,
  };
}

/** Non-throwing parse, for request validation surfaces. */
export function tryParseSourceRootAddress(
  text: unknown,
): SourceRootAddressParseResult {
  try {
    return { ok: true, address: parseSourceRootAddress(text) };
  } catch (error) {
    if (error instanceof SourceRootAddressError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        component: error.component,
      };
    }
    throw error;
  }
}

export function isSourceRootAddress(text: unknown): boolean {
  return tryParseSourceRootAddress(text).ok;
}

/**
 * Compares two addresses as locators.
 *
 * This is string identity of the canonical serialization and nothing more. It
 * does not assert, imply, or create shared identity between Root-owned
 * resources, and two addresses that differ are never "probably the same
 * thing".
 */
export function addressesAreEqual(
  left: SourceRootAddressInput,
  right: SourceRootAddressInput,
): boolean {
  return formatSourceRootAddress(left) === formatSourceRootAddress(right);
}

/**
 * Describes the address contract for discovery surfaces.
 */
export function describeAddressFormat() {
  return {
    addressFormatVersion: SOURCEROOT_ADDRESS_FORMAT_VERSION,
    scheme: SOURCEROOT_ADDRESS_SCHEME,
    canonicalSyntax:
      "sourceroot:<rootId>/<objectType>/<canonicalPublicId>@<datasetId>:<datasetVersion>",
    datasetQualification: "required",
    datasetIndependentIdentity: "not-defined-in-v1",
    componentEncoding: "percent-encoding, uppercase hex, canonical escapes only",
    unreservedCharacters: "A-Z a-z 0-9 - . _ ~",
    roundTrip: "exact",
    componentMaxLength: SOURCEROOT_ADDRESS_COMPONENT_MAX_LENGTH,
    addressMaxLength: SOURCEROOT_ADDRESS_MAX_LENGTH,
    datasetVersionRule: "SemVer-compatible",
    identitySemantics:
      "An address is a locator. It never implies shared identity between Root-owned resources.",
    versionAxis:
      "The address format version is independent from the SourceRoot contract version and from every Root contract version.",
    semanticConclusion: null,
  } as const;
}
