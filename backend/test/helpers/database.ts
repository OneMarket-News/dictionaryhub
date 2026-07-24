import { closeDatabase, getPool } from "../../src/lib/database.js";

export async function resetTestDatabase(): Promise<void> {
  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  await pool.query(`
    TRUNCATE TABLE
      context_record_sources,
      context_cultural_memories,
      context_relationships,
      context_causal_links,
      context_record_perspectives,
      context_perspectives,
      context_interpretations,
      context_evidence,
      context_claims,
      context_accounts,
      context_temporal_assertions,
      context_entities,
      context_records,
      dictionaryroot_lexicon_relations,
      dictionaryroot_lexicon_synsets,
      dictionaryroot_lexicon_datasets,
      dr_published_overlays,
      dr_publications,
      dr_proposal_events,
      dr_proposal_comments,
      dr_proposal_evidence,
      dr_change_proposals,
      dr_record_locks,
      dr_moderation_reports,
      dr_account_actions,
      dr_audit_events,
      dr_invitations,
      dr_role_assignments,
      dr_role_permissions,
      dr_roles,
      dr_permissions,
      dr_organization_memberships,
      dr_organizations,
      dr_auth_email_challenges,
      dr_auth_oauth_states,
      dr_auth_sessions,
      dr_auth_identities,
      dr_users,
      edge_sources,
      assertion_sources,
      node_sources,
      revisions,
      edges,
      assertions,
      nodes,
      sources,
      imported_bundles
    RESTART IDENTITY
    CASCADE;
  `);
}

export async function closeTestDatabase(): Promise<void> {
  await closeDatabase();
}
