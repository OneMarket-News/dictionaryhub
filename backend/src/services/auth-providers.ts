import { createAppleClientSecret, pkceChallenge, randomToken, verifyProviderJwt } from "../lib/security.js";
import type { ProviderProfile } from "../auth/types.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

export function backendPublicUrl(): string {
  return (process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || "3000"}`).replace(/\/$/, "");
}

export function frontendPublicUrl(): string {
  return (process.env.FRONTEND_PUBLIC_URL || "http://localhost:8080").replace(/\/$/, "");
}

export function sanitizeReturnTo(value: string | undefined): string {
  const fallback = "/account-v1.html";
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, frontendPublicUrl());
    if (url.origin !== new URL(frontendPublicUrl()).origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authProviderConfig() {
  const emailMode = (process.env.EMAIL_DELIVERY_MODE || "console").toLowerCase();
  return {
    google: {
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      label: "Continue with Google",
    },
    apple: {
      configured: Boolean(
        process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY,
      ),
      label: "Continue with Apple",
    },
    email: {
      configured: emailMode === "console" || Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      deliveryMode: emailMode,
      label: "Email me a sign-in link",
    },
    development: {
      configured: (process.env.ALLOW_DEVELOPMENT_AUTH || "false").toLowerCase() === "true",
    },
  };
}

export function createProviderRequestMaterial(): { codeVerifier: string; nonce: string } {
  return { codeVerifier: randomToken(48), nonce: randomToken(24) };
}

export function buildGoogleAuthorizationUrl(input: {
  state: string;
  codeVerifier: string;
  nonce: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("Google sign-in is not configured.");
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${backendPublicUrl()}/api/v1/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", pkceChallenge(input.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<ProviderProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google sign-in is not configured.");
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${backendPublicUrl()}/api/v1/auth/google/callback`,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const tokenPayload = await response.json() as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !tokenPayload.id_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Google token exchange failed.");
  }
  const claims = await verifyProviderJwt({
    token: tokenPayload.id_token,
    jwksUrl: GOOGLE_JWKS_URL,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    nonce: input.nonce,
  });
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  return {
    provider: "google",
    subject: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerified,
    displayName: typeof claims.name === "string" ? claims.name : "",
    avatarUrl: typeof claims.picture === "string" ? claims.picture : "",
    profile: {
      issuer: claims.iss,
      locale: claims.locale,
      givenName: claims.given_name,
      familyName: claims.family_name,
    },
  };
}

export function buildAppleAuthorizationUrl(input: {
  state: string;
  nonce: string;
}): string {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
    throw new Error("Apple sign-in is not configured.");
  }
  const url = new URL(APPLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${backendPublicUrl()}/api/v1/auth/apple/callback`);
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

export async function exchangeAppleCode(input: {
  code: string;
  nonce: string;
  userJson?: string;
}): Promise<ProviderProfile> {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!clientId || !teamId || !keyId || !privateKey) throw new Error("Apple sign-in is not configured.");
  const clientSecret = createAppleClientSecret({ teamId, clientId, keyId, privateKey });
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: `${backendPublicUrl()}/api/v1/auth/apple/callback`,
  });
  const response = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const tokenPayload = await response.json() as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !tokenPayload.id_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Apple token exchange failed.");
  }
  const claims = await verifyProviderJwt({
    token: tokenPayload.id_token,
    jwksUrl: APPLE_JWKS_URL,
    issuer: "https://appleid.apple.com",
    audience: clientId,
    nonce: input.nonce,
  });
  let suppliedUser: { name?: { firstName?: string; lastName?: string }; email?: string } = {};
  if (input.userJson) {
    try { suppliedUser = JSON.parse(input.userJson) as typeof suppliedUser; } catch { suppliedUser = {}; }
  }
  const email = typeof claims.email === "string" ? claims.email : suppliedUser.email || null;
  const displayName = [suppliedUser.name?.firstName, suppliedUser.name?.lastName].filter(Boolean).join(" ");
  return {
    provider: "apple",
    subject: String(claims.sub),
    email,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    displayName,
    avatarUrl: "",
    profile: {
      issuer: claims.iss,
      isPrivateEmail: claims.is_private_email,
      realUserStatus: claims.real_user_status,
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export async function deliverMagicLink(email: string, link: string): Promise<{ mode: string; exposedLink?: string }> {
  const mode = (process.env.EMAIL_DELIVERY_MODE || "console").toLowerCase();
  if (mode === "console") {
    console.log(`DictionaryRoot email sign-in link for ${email}: ${link}`);
    const expose = (process.env.EXPOSE_DEVELOPMENT_AUTH_LINK || (process.env.NODE_ENV === "production" ? "false" : "true")).toLowerCase() === "true";
    return expose ? { mode, exposedLink: link } : { mode };
  }
  if (mode !== "resend") throw new Error(`Unsupported EMAIL_DELIVERY_MODE: ${mode}`);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Resend email delivery requires RESEND_API_KEY and EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "DictionaryRoot/1.0",
      "idempotency-key": randomToken(18),
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your DictionaryRoot sign-in link",
      text: `Open this one-time link to sign in to DictionaryRoot:\n\n${link}\n\nThis link expires shortly. If you did not request it, ignore this email.`,
      html: `<p>Open this one-time link to sign in to DictionaryRoot:</p><p><a href="${escapeHtml(link)}">Sign in to DictionaryRoot</a></p><p>This link expires shortly. If you did not request it, ignore this email.</p>`,
      tags: [{ name: "category", value: "dictionaryroot_auth" }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email delivery failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  return { mode };
}

export async function deliverInvitationEmail(input: {
  email: string;
  link: string;
  organizationName?: string;
  roleName?: string;
}): Promise<{ mode: string; exposedLink?: string }> {
  const mode = (process.env.EMAIL_DELIVERY_MODE || "console").toLowerCase();
  const organization = input.organizationName || "a DictionaryRoot organization";
  const role = input.roleName || "member";
  if (mode === "console") {
    console.log(`DictionaryRoot invitation for ${input.email}: ${input.link}`);
    const expose = (process.env.EXPOSE_DEVELOPMENT_AUTH_LINK || (process.env.NODE_ENV === "production" ? "false" : "true")).toLowerCase() === "true";
    return expose ? { mode, exposedLink: input.link } : { mode };
  }
  if (mode !== "resend") throw new Error(`Unsupported EMAIL_DELIVERY_MODE: ${mode}`);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Invitation delivery requires RESEND_API_KEY and EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "DictionaryRoot/1.0",
      "idempotency-key": randomToken(18),
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `DictionaryRoot invitation to ${organization}`,
      text: `You were invited to join ${organization} as ${role}.\n\nSign in with this email address and open:\n${input.link}\n\nThe invitation expires in seven days.`,
      html: `<p>You were invited to join <strong>${escapeHtml(organization)}</strong> as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(input.link)}">Accept the DictionaryRoot invitation</a></p><p>Sign in with this email address. The invitation expires in seven days.</p>`,
      tags: [{ name: "category", value: "dictionaryroot_invitation" }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Invitation delivery failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  return { mode };
}
