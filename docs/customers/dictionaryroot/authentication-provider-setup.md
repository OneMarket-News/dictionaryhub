# DictionaryRoot authentication provider setup

## Local first run

1. Copy `backend/.env.example` to `backend/.env`.
2. Start PostgreSQL and set `DATABASE_URL`.
3. Run `npm.cmd ci` inside `backend`.
4. Run `npm.cmd run db:migrate`.
5. Keep `ALLOW_DEVELOPMENT_AUTH=true` only for local testing.
6. Put your email in `BOOTSTRAP_ADMIN_EMAILS` before your first sign-in.

The first matching account receives the `system_admin` role. Remove or rotate the bootstrap value after administrators are established.

## Email magic links

Local mode:

```env
EMAIL_DELIVERY_MODE=console
EXPOSE_DEVELOPMENT_AUTH_LINK=true
```

The backend prints and may return the one-time link for local testing.

Staging and production:

```env
EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=...
EMAIL_FROM=DictionaryRoot <accounts@your-domain.example>
EXPOSE_DEVELOPMENT_AUTH_LINK=false
```

Verify the sender domain with the email provider before inviting users.

## Google

Create an OAuth 2.0 web application and configure this exact redirect URI:

```text
https://YOUR-BACKEND-DOMAIN/api/v1/auth/google/callback
```

Set:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

The implementation uses the authorization-code flow, state, nonce, and PKCE. Keep the client secret server-side.

## Apple

Create a Sign in with Apple Services ID for the web application. Configure this exact return URL:

```text
https://YOUR-BACKEND-DOMAIN/api/v1/auth/apple/callback
```

Set:

```env
APPLE_CLIENT_ID=YOUR_SERVICES_ID
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

Apple private keys must be stored in the hosting secret manager, never committed to Git.

## Linked identities

A verified provider identity can be linked to an existing signed-in account. Verified matching email addresses may resolve to the same account. The backend prevents a provider subject from being linked to two users and prevents removal of the final sign-in method.

## Callback and cookie rules

- `FRONTEND_PUBLIC_URL` and `BACKEND_PUBLIC_URL` must match the deployed HTTPS origins.
- `CORS_ORIGIN` must explicitly list trusted frontend origins.
- `SESSION_COOKIE_SECURE=true` is mandatory for production.
- `SESSION_COOKIE_SAME_SITE=lax` supports top-level provider callbacks while reducing cross-site cookie exposure.
