import type { PoolClient } from "pg";

import type {
  ContextRecordBase,
  ContextRecordKind,
  ContextualBundle,
} from "../contextual-types.js";
import {
  chronologyBoundsForStructuredDate,
} from "./contextual-time.js";
import {
  insertContextualExtensions,
} from "./context-version-store.js";

type ContextRecordWithKind = {
  kind: ContextRecordKind;
  record: ContextRecordBase;
};

function allContextRecords(
  context: ContextualBundle,
): ContextRecordWithKind[] {
  return [
    ...(context.entities ?? []).map((record) => ({
      kind: "entity" as const,
      record,
    })),
    ...(context.temporalAssertions ?? []).map((record) => ({
      kind: "temporal_assertion" as const,
      record,
    })),
    ...(context.accounts ?? []).map((record) => ({
      kind: "account" as const,
      record,
    })),
    ...(context.claims ?? []).map((record) => ({
      kind: "claim" as const,
      record,
    })),
    ...(context.evidence ?? []).map((record) => ({
      kind: "evidence" as const,
      record,
    })),
    ...(context.interpretations ?? []).map((record) => ({
      kind: "interpretation" as const,
      record,
    })),
    ...(context.perspectives ?? []).map((record) => ({
      kind: "perspective" as const,
      record,
    })),
    ...(context.causalLinks ?? []).map((record) => ({
      kind: "causal_link" as const,
      record,
    })),
    ...(context.relationships ?? []).map((record) => ({
      kind: "relationship" as const,
      record,
    })),
    ...(context.culturalMemories ?? []).map((record) => ({
      kind: "cultural_memory" as const,
      record,
    })),
  ];
}

export async function deleteContextRecords(
  client: PoolClient,
  bundleId: string,
): Promise<void> {
  await client.query(
    `
      DELETE FROM context_records
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );
}

async function insertRecordRegistry(
  client: PoolClient,
  bundleId: string,
  bundleDomain: string | undefined,
  context: ContextualBundle,
): Promise<void> {
  for (const { kind, record } of allContextRecords(context)) {
    await client.query(
      `
        INSERT INTO context_records (
          context_id,
          bundle_id,
          record_kind,
          domain,
          label,
          summary,
          status,
          metadata,
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::JSONB,
          $9::JSONB
        );
      `,
      [
        record.id,
        bundleId,
        kind,
        record.domain ?? bundleDomain ?? "unknown",
        record.label,
        record.summary ?? null,
        record.status ?? "active",
        JSON.stringify(record.metadata ?? {}),
        JSON.stringify(record),
      ],
    );
  }
}

async function insertEntities(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const entity of context.entities ?? []) {
    await client.query(
      `
        INSERT INTO context_entities (
          context_id,
          entity_type,
          canonical_name,
          alternate_names,
          description
        )
        VALUES ($1, $2, $3, $4::TEXT[], $5);
      `,
      [
        entity.id,
        entity.entityType,
        entity.name,
        entity.alternateNames ?? [],
        entity.description ?? null,
      ],
    );
  }
}

async function insertEntityAliases(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const alias of context.aliases ?? []) {
    await client.query(
      `
        INSERT INTO context_entity_aliases (
          alias_id,
          entity_context_id,
          bundle_id,
          alias_text,
          alias_type,
          language_tag,
          script_identifier,
          notes,
          uncertainty,
          status,
          temporal_context_id,
          legacy_derived
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE
        );
      `,
      [
        alias.id,
        alias.entityId,
        bundleId,
        alias.text,
        alias.aliasType,
        alias.languageTag ?? null,
        alias.scriptIdentifier ?? null,
        alias.notes ?? null,
        alias.uncertainty ?? null,
        alias.status ?? null,
        alias.temporalAssertionId ?? null,
      ],
    );

    for (const sourceId of new Set(alias.sourceIds ?? [])) {
      await client.query(
        `
          INSERT INTO context_entity_alias_sources (
            alias_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [alias.id, sourceId, bundleId],
      );
    }
  }
}

async function insertEntityIdentifiers(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const identifier of context.externalIdentifiers ?? []) {
    await client.query(
      `
        INSERT INTO context_entity_identifiers (
          identifier_id,
          entity_context_id,
          bundle_id,
          identifier_scheme,
          identifier_value,
          normalized_value,
          identifier_uri,
          label,
          status,
          notes,
          uncertainty
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        );
      `,
      [
        identifier.id,
        identifier.entityId,
        bundleId,
        identifier.scheme,
        identifier.value,
        identifier.normalizedValue ?? null,
        identifier.uri ?? null,
        identifier.label ?? null,
        identifier.status ?? null,
        identifier.notes ?? null,
        identifier.uncertainty ?? null,
      ],
    );

    for (const sourceId of new Set(identifier.sourceIds ?? [])) {
      await client.query(
        `
          INSERT INTO context_entity_identifier_sources (
            identifier_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [identifier.id, sourceId, bundleId],
      );
    }
  }
}

async function insertPerspectives(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const perspective of context.perspectives ?? []) {
    await client.query(
      `
        INSERT INTO context_perspectives (
          context_id,
          perspective_name,
          description
        )
        VALUES ($1, $2, $3);
      `,
      [
        perspective.id,
        perspective.name,
        perspective.description,
      ],
    );
  }
}

async function insertTemporalAssertions(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const temporal of context.temporalAssertions ?? []) {
    const chronology = chronologyBoundsForStructuredDate(
      temporal.structuredDate,
    );
    await client.query(
      `
        INSERT INTO context_temporal_assertions (
          context_id,
          subject_context_id,
          temporal_kind,
          exact_date,
          start_date,
          end_date,
          before_date,
          after_date,
          proposed_dates,
          date_label,
          calendar_system,
          date_precision,
          start_uncertainty,
          end_uncertainty,
          date_notes,
          time_role,
          structured_date,
          chronology_start_year,
          chronology_end_year
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::JSONB,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::JSONB,
          $18,
          $19
        );
      `,
      [
        temporal.id,
        temporal.subjectId,
        temporal.temporalKind,
        temporal.exactDate ?? null,
        temporal.startDate ?? null,
        temporal.endDate ?? null,
        temporal.beforeDate ?? null,
        temporal.afterDate ?? null,
        JSON.stringify(temporal.proposedDates ?? []),
        temporal.dateLabel,
        temporal.calendarSystem ?? "unspecified",
        temporal.datePrecision ?? "unknown",
        temporal.startUncertainty ?? null,
        temporal.endUncertainty ?? null,
        temporal.dateNotes ?? null,
        temporal.timeRole ?? "unspecified",
        temporal.structuredDate
          ? JSON.stringify(temporal.structuredDate)
          : null,
        chronology?.startYear ?? null,
        chronology?.endYear ?? null,
      ],
    );
  }
}

async function insertTemporalProposals(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const temporal of context.temporalAssertions ?? []) {
    for (const proposal of temporal.proposedDates ?? []) {
      if (!proposal.id) {
        continue;
      }

      const chronology = chronologyBoundsForStructuredDate(
        proposal.structuredDate,
      );
      await client.query(
        `
          INSERT INTO context_temporal_proposals (
            proposal_id,
            temporal_context_id,
            bundle_id,
            proposed_date,
            date_label,
            structured_date,
            precision,
            uncertainty,
            note,
            chronology_start_year,
            chronology_end_year
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::JSONB, $7, $8, $9, $10, $11
          );
        `,
        [
          proposal.id,
          temporal.id,
          bundleId,
          proposal.date ?? null,
          proposal.label ?? null,
          proposal.structuredDate
            ? JSON.stringify(proposal.structuredDate)
            : null,
          proposal.precision ?? null,
          proposal.uncertainty ?? null,
          proposal.note ?? null,
          chronology?.startYear ?? null,
          chronology?.endYear ?? null,
        ],
      );

      for (const sourceId of new Set(proposal.sourceIds ?? [])) {
        await client.query(
          `
            INSERT INTO context_temporal_proposal_sources (
              proposal_id,
              source_id,
              bundle_id
            )
            VALUES ($1, $2, $3);
          `,
          [proposal.id, sourceId, bundleId],
        );
      }
    }
  }
}

async function insertAccounts(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const account of context.accounts ?? []) {
    await client.query(
      `
        INSERT INTO context_accounts (
          context_id,
          subject_context_id,
          author_context_id,
          source_id,
          account_type,
          content,
          publication_label
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        account.id,
        account.subjectId,
        account.authorEntityId ?? null,
        account.sourceId ?? null,
        account.accountType,
        account.content,
        account.publicationLabel ?? null,
      ],
    );
  }
}

async function insertClaims(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const claim of context.claims ?? []) {
    await client.query(
      `
        INSERT INTO context_claims (
          context_id,
          account_context_id,
          subject_context_id,
          object_context_id,
          claim_type,
          statement,
          confidence,
          uncertainty
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `,
      [
        claim.id,
        claim.accountId,
        claim.subjectId,
        claim.objectId ?? null,
        claim.claimType,
        claim.statement,
        claim.confidence ?? "unknown",
        claim.uncertainty ?? null,
      ],
    );
  }
}

async function insertEvidence(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const evidence of context.evidence ?? []) {
    await client.query(
      `
        INSERT INTO context_evidence (
          context_id,
          claim_context_id,
          evidence_type,
          source_id,
          account_context_id,
          evidence_context_id,
          explanation,
          strength,
          confidence,
          uncertainty
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `,
      [
        evidence.id,
        evidence.claimId,
        evidence.evidenceType,
        evidence.sourceId ?? null,
        evidence.accountId ?? null,
        evidence.evidenceRecordId ?? null,
        evidence.explanation,
        evidence.strength ?? "unknown",
        evidence.confidence ?? "unknown",
        evidence.uncertainty ?? null,
      ],
    );
  }
}

async function insertInterpretations(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const interpretation of context.interpretations ?? []) {
    await client.query(
      `
        INSERT INTO context_interpretations (
          context_id,
          subject_context_id,
          account_context_id,
          source_id,
          interpretation_text,
          confidence,
          uncertainty,
          published_conclusion
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `,
      [
        interpretation.id,
        interpretation.subjectId,
        interpretation.accountId ?? null,
        interpretation.sourceId ?? null,
        interpretation.interpretation,
        interpretation.confidence ?? "unknown",
        interpretation.uncertainty ?? null,
        interpretation.publishedConclusion ?? false,
      ],
    );
  }
}

async function insertCausalLinks(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const link of context.causalLinks ?? []) {
    await client.query(
      `
        INSERT INTO context_causal_links (
          context_id,
          cause_context_id,
          effect_context_id,
          causal_kind,
          explanation,
          confidence,
          uncertainty
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        link.id,
        link.causeId,
        link.effectId,
        link.causalKind,
        link.explanation,
        link.confidence ?? "unknown",
        link.uncertainty ?? null,
      ],
    );
  }
}

async function insertRelationships(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const relationship of context.relationships ?? []) {
    await client.query(
      `
        INSERT INTO context_relationships (
          context_id,
          from_context_id,
          to_context_id,
          relationship_type,
          relationship_role,
          explanation,
          confidence,
          uncertainty,
          review_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `,
      [
        relationship.id,
        relationship.fromId,
        relationship.toId,
        relationship.relationshipType,
        relationship.relationshipRole ?? null,
        relationship.explanation ?? null,
        relationship.confidence ?? "unknown",
        relationship.uncertainty ?? null,
        relationship.reviewStatus ?? null,
      ],
    );
  }
}

async function insertRelationshipValidity(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const relationship of context.relationships ?? []) {
    for (const link of relationship.validity?.temporalLinks ?? []) {
      await client.query(
        `
          INSERT INTO context_relationship_temporal_links (
            relationship_context_id,
            temporal_context_id,
            link_type,
            note
          )
          VALUES ($1, $2, $3, $4);
        `,
        [
          relationship.id,
          link.temporalAssertionId,
          link.linkType,
          link.note ?? null,
        ],
      );

      for (const sourceId of new Set(link.sourceIds ?? [])) {
        await client.query(
          `
            INSERT INTO context_relationship_temporal_sources (
              relationship_context_id,
              temporal_context_id,
              link_type,
              source_id,
              bundle_id
            )
            VALUES ($1, $2, $3, $4, $5);
          `,
          [
            relationship.id,
            link.temporalAssertionId,
            link.linkType,
            sourceId,
            bundleId,
          ],
        );
      }
    }

    for (
      const sourceId
      of new Set(relationship.validity?.sourceIds ?? [])
    ) {
      await client.query(
        `
          INSERT INTO context_relationship_validity_sources (
            relationship_context_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [relationship.id, sourceId, bundleId],
      );
    }
  }
}

async function insertFieldProvenance(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const provenance of context.fieldProvenance ?? []) {
    await client.query(
      `
        INSERT INTO context_field_provenance (
          provenance_id,
          context_id,
          bundle_id,
          field_path,
          subrecord_type,
          subrecord_id,
          source_id,
          support_type,
          note,
          confidence,
          uncertainty
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        );
      `,
      [
        provenance.id,
        provenance.targetId,
        bundleId,
        provenance.fieldPath,
        provenance.subrecordType ?? null,
        provenance.subrecordId ?? null,
        provenance.sourceId,
        provenance.supportType ?? null,
        provenance.note ?? null,
        provenance.confidence ?? null,
        provenance.uncertainty ?? null,
      ],
    );
  }
}

async function insertCulturalMemories(
  client: PoolClient,
  context: ContextualBundle,
): Promise<void> {
  for (const memory of context.culturalMemories ?? []) {
    await client.query(
      `
        INSERT INTO context_cultural_memories (
          context_id,
          subject_context_id,
          perspective_context_id,
          source_id,
          memory_type,
          narrative,
          period_label
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        memory.id,
        memory.subjectId,
        memory.perspectiveId ?? null,
        memory.sourceId ?? null,
        memory.memoryType,
        memory.narrative,
        memory.periodLabel ?? null,
      ],
    );
  }
}

async function insertRecordPerspectives(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const link of context.recordPerspectives ?? []) {
    await client.query(
      `
        INSERT INTO context_record_perspectives (
          record_context_id,
          perspective_context_id,
          bundle_id,
          stance,
          notes
        )
        VALUES ($1, $2, $3, $4, $5);
      `,
      [
        link.recordId,
        link.perspectiveId,
        bundleId,
        link.stance ?? null,
        link.notes ?? null,
      ],
    );
  }
}

function explicitSourceId(record: ContextRecordBase): string | undefined {
  const sourceId = (record as ContextRecordBase & {
    sourceId?: string;
  }).sourceId;
  return sourceId;
}

async function insertRecordSources(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const { record } of allContextRecords(context)) {
    const sourceIds = new Set(record.sourceIds ?? []);
    const directSourceId = explicitSourceId(record);

    if (directSourceId) {
      sourceIds.add(directSourceId);
    }

    for (const sourceId of sourceIds) {
      await client.query(
        `
          INSERT INTO context_record_sources (
            context_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [record.id, sourceId, bundleId],
      );
    }
  }
}

export async function insertContextualBundle(
  client: PoolClient,
  bundleId: string,
  bundleDomain: string | undefined,
  context: ContextualBundle | undefined,
): Promise<void> {
  if (!context) {
    return;
  }

  await insertRecordRegistry(client, bundleId, bundleDomain, context);
  await insertEntities(client, context);
  await insertPerspectives(client, context);
  await insertTemporalAssertions(client, context);
  await insertEntityAliases(client, bundleId, context);
  await insertEntityIdentifiers(client, bundleId, context);
  await insertTemporalProposals(client, bundleId, context);
  await insertAccounts(client, context);
  await insertClaims(client, context);
  await insertEvidence(client, context);
  await insertInterpretations(client, context);
  await insertCausalLinks(client, context);
  await insertRelationships(client, context);
  await insertRelationshipValidity(client, bundleId, context);
  await insertCulturalMemories(client, context);
  await insertRecordPerspectives(client, bundleId, context);
  await insertContextualExtensions(client, bundleId, context);
  await insertFieldProvenance(client, bundleId, context);
  await insertRecordSources(client, bundleId, context);
}
