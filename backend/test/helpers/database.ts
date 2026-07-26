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
      context_field_provenance,
      context_relationship_validity_sources,
      context_relationship_temporal_sources,
      context_relationship_temporal_links,
      context_temporal_proposal_sources,
      context_temporal_proposals,
      context_entity_identifier_sources,
      context_entity_identifiers,
      context_entity_alias_sources,
      context_entity_aliases,
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

  await pool.query(`
    INSERT INTO dr_permissions(permission_key, permission_description) VALUES
      ('account.read', 'Read account.'),
      ('account.update', 'Update account.'),
      ('revision.create', 'Create proposals.'),
      ('revision.submit', 'Submit proposals.'),
      ('revision.comment', 'Comment on proposals.'),
      ('revision.review', 'Review proposals.'),
      ('revision.publish', 'Publish and roll back.'),
      ('revision.edit_any', 'Edit proposals in scope.'),
      ('organization.read', 'Read organization.'),
      ('organization.manage', 'Manage organization.'),
      ('source.import', 'Import bundles.'),
      ('user.manage', 'Manage users.'),
      ('audit.read', 'Read audit.'),
      ('moderation.manage', 'Moderate records.'),
      ('system.admin', 'System administration.')
    ON CONFLICT (permission_key) DO NOTHING;

    INSERT INTO dr_roles(
      role_key, role_name, role_description, role_scope
    ) VALUES
      ('registered', 'Registered user', 'Account access.', 'system'),
      ('contributor', 'Contributor', 'Draft and submit.', 'organization'),
      ('reviewer', 'Reviewer', 'Review proposals.', 'organization'),
      ('publisher', 'Publisher', 'Publish and roll back.', 'organization'),
      ('organization_admin', 'Organization administrator', 'Manage an organization.', 'organization'),
      ('system_admin', 'System administrator', 'System access.', 'system')
    ON CONFLICT (role_key) DO NOTHING;

    INSERT INTO dr_role_permissions(role_key, permission_key) VALUES
      ('registered', 'account.read'),
      ('registered', 'account.update'),
      ('registered', 'organization.read'),
      ('contributor', 'account.read'),
      ('contributor', 'organization.read'),
      ('contributor', 'revision.create'),
      ('contributor', 'revision.submit'),
      ('contributor', 'revision.comment'),
      ('reviewer', 'account.read'),
      ('reviewer', 'organization.read'),
      ('reviewer', 'revision.create'),
      ('reviewer', 'revision.submit'),
      ('reviewer', 'revision.comment'),
      ('reviewer', 'revision.review'),
      ('publisher', 'account.read'),
      ('publisher', 'organization.read'),
      ('publisher', 'revision.create'),
      ('publisher', 'revision.submit'),
      ('publisher', 'revision.comment'),
      ('publisher', 'revision.review'),
      ('publisher', 'revision.publish'),
      ('system_admin', 'system.admin')
    ON CONFLICT DO NOTHING;
  `);
}

export async function closeTestDatabase(): Promise<void> {
  await closeDatabase();
}
