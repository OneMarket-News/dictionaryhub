import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";

export function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

export function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

export interface JwtClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

type ProviderJwk = Record<string, unknown> & { kid?: string };

interface JwksResponse {
  keys?: ProviderJwk[];
}

const jwksCache = new Map<string, { expiresAt: number; keys: ProviderJwk[] }>();

function parseJwt(token: string): {
  header: JwtHeader;
  claims: JwtClaims;
  signingInput: string;
  signature: Buffer;
} {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT must contain three segments.");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new Error("JWT segments are incomplete.");
  return {
    header: JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as JwtHeader,
    claims: JSON.parse(base64UrlDecode(encodedClaims).toString("utf8")) as JwtClaims,
    signingInput: `${encodedHeader}.${encodedClaims}`,
    signature: base64UrlDecode(encodedSignature),
  };
}

async function fetchJwks(url: string): Promise<ProviderJwk[]> {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Identity provider key request failed with HTTP ${response.status}.`);
  const payload = (await response.json()) as JwksResponse;
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (!keys.length) throw new Error("Identity provider returned no signing keys.");
  jwksCache.set(url, { expiresAt: Date.now() + 60 * 60 * 1000, keys });
  return keys;
}

function audienceMatches(actual: string | string[] | undefined, expected: string): boolean {
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

export async function verifyProviderJwt(input: {
  token: string;
  jwksUrl: string;
  issuer: string | string[];
  audience: string;
  nonce?: string;
}): Promise<JwtClaims> {
  const parsed = parseJwt(input.token);
  if (!parsed.header.kid) throw new Error("Identity token is missing a key identifier.");
  if (!['RS256', 'ES256'].includes(parsed.header.alg)) throw new Error(`Unsupported identity token algorithm: ${parsed.header.alg}`);
  const keys = await fetchJwks(input.jwksUrl);
  const jwk = keys.find((candidate) => candidate.kid === parsed.header.kid);
  if (!jwk) {
    jwksCache.delete(input.jwksUrl);
    const refreshed = await fetchJwks(input.jwksUrl);
    const retry = refreshed.find((candidate) => candidate.kid === parsed.header.kid);
    if (!retry) throw new Error("Identity token signing key was not found.");
    return verifyJwtWithKey(parsed, retry, input);
  }
  return verifyJwtWithKey(parsed, jwk, input);
}

function verifyJwtWithKey(
  parsed: ReturnType<typeof parseJwt>,
  jwk: ProviderJwk,
  input: { issuer: string | string[]; audience: string; nonce?: string },
): JwtClaims {
  const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });
  const verifyOptions = parsed.header.alg === "ES256"
    ? { key: publicKey, dsaEncoding: "ieee-p1363" as const }
    : publicKey;
  const valid = cryptoVerify("sha256", Buffer.from(parsed.signingInput), verifyOptions, parsed.signature);
  if (!valid) throw new Error("Identity token signature is invalid.");
  const issuers = Array.isArray(input.issuer) ? input.issuer : [input.issuer];
  if (!parsed.claims.iss || !issuers.includes(parsed.claims.iss)) throw new Error("Identity token issuer is invalid.");
  if (!audienceMatches(parsed.claims.aud, input.audience)) throw new Error("Identity token audience is invalid.");
  const now = Math.floor(Date.now() / 1000);
  if (!parsed.claims.exp || parsed.claims.exp <= now) throw new Error("Identity token has expired.");
  if (parsed.claims.iat && parsed.claims.iat > now + 120) throw new Error("Identity token issue time is invalid.");
  if (input.nonce && parsed.claims.nonce !== input.nonce) throw new Error("Identity token nonce is invalid.");
  if (!parsed.claims.sub) throw new Error("Identity token subject is missing.");
  return parsed.claims;
}

export function createAppleClientSecret(input: {
  teamId: string;
  clientId: string;
  keyId: string;
  privateKey: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: input.keyId, typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: input.teamId,
    iat: now,
    exp: now + 60 * 60,
    aud: "https://appleid.apple.com",
    sub: input.clientId,
  }));
  const signingInput = `${header}.${claims}`;
  const normalizedKey = input.privateKey.replace(/\\n/g, "\n");
  const key: KeyObject = createPrivateKey(normalizedKey);
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
