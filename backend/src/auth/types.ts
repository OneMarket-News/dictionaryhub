export type IdentityProvider = "email" | "google" | "apple" | "development";

export interface AuthUser {
  userId: string;
  primaryEmail: string | null;
  displayName: string;
  avatarUrl: string;
  publicHandle: string | null;
  accountStatus: "active" | "suspended" | "deleted";
  emailVerifiedAt: string | null;
  lastSignedInAt: string | null;
  createdAt: string;
}

export interface AuthIdentity {
  identityId: string;
  provider: IdentityProvider;
  providerEmail: string | null;
  emailVerified: boolean;
  profile: Record<string, unknown>;
  lastSignedInAt: string | null;
  createdAt: string;
}

export interface AuthOrganization {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipStatus: string;
  roles: string[];
  permissions: string[];
}

export interface AuthContext {
  authenticated: boolean;
  sessionId: string | null;
  csrfToken: string | null;
  user: AuthUser | null;
  identities: AuthIdentity[];
  roles: string[];
  permissions: string[];
  systemPermissions: string[];
  organizations: AuthOrganization[];
  activeIdentityId: string | null;
}

export interface ProviderProfile {
  provider: IdentityProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string;
  profile: Record<string, unknown>;
}
