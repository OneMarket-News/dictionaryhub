import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../lib/database.js";
import {
  contextualGovernanceTargetTypes,
  governanceVersionToken,
  hideNewGovernedTarget,
  loadGovernedTarget,
  materializeGovernedSnapshot,
  mergeGovernedPatch,
  validateGovernedChange,
  type GovernanceValidationResult,
} from "./contextual-governance.js";

export type ProposalStatus =
  | "draft" | "submitted" | "under_review" | "changes_requested"
  | "approved" | "rejected" | "published" | "superseded" | "withdrawn";

export class WorkflowError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function requireDatabase() {
  const database = getPool();
  if (!database) throw new WorkflowError(503, "DATABASE_REQUIRED", "The governed editorial workflow requires DATABASE_URL.");
  return database;
}

interface ProposalRow {
  proposal_id: string;
  proposal_number: string;
  organization_id: string | null;
  created_by_user_id: string;
  creator_name: string;
  assigned_reviewer_user_id: string | null;
  reviewer_name: string | null;
  target_type: string;
  target_id: string;
  root_key: string;
  bundle_id: string | null;
  change_type: string;
  proposal_title: string;
  proposal_summary: string;
  base_revision_id: string | null;
  base_version_token: string | null;
  base_snapshot: Record<string, unknown> | null;
  proposed_patch: Record<string, unknown> | null;
  validation_result: GovernanceValidationResult | null;
  last_validated_at: Date | null;
  editorial_rationale: string;
  interpretation_disclosure: string;
  status: ProposalStatus;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  approved_at: Date | null;
  published_at: Date | null;
  version_number: number;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total_count?: string;
}

function mapProposal(row: ProposalRow) {
  return {
    proposalId: row.proposal_id,
    proposalNumber: Number(row.proposal_number),
    organizationId: row.organization_id,
    createdByUserId: row.created_by_user_id,
    creatorName: row.creator_name,
    assignedReviewerUserId: row.assigned_reviewer_user_id,
    reviewerName: row.reviewer_name,
    targetType: row.target_type,
    targetId: row.target_id,
    rootKey: row.root_key,
    bundleId: row.bundle_id,
    changeType: row.change_type,
    title: row.proposal_title,
    summary: row.proposal_summary,
    baseRevisionId: row.base_revision_id,
    baseVersionToken: row.base_version_token,
    baseSnapshot: row.base_snapshot || {},
    proposedPatch: row.proposed_patch || {},
    validation: row.validation_result || {
      valid: true,
      errors: [],
      warnings: [],
      checkedAt: null,
      disclaimer:
        "Automated validation checks structure, provenance, attribution, and process; it does not prove historical truth.",
    },
    lastValidatedAt: row.last_validated_at?.toISOString() || null,
    editorialRationale: row.editorial_rationale,
    interpretationDisclosure: row.interpretation_disclosure,
    status: row.status,
    submittedAt: row.submitted_at?.toISOString() || null,
    reviewedAt: row.reviewed_at?.toISOString() || null,
    approvedAt: row.approved_at?.toISOString() || null,
    publishedAt: row.published_at?.toISOString() || null,
    versionNumber: row.version_number,
    lockedAt: row.locked_at?.toISOString() || null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    staleBase: false,
  };
}

const proposalFrom = `
  FROM dr_change_proposals p
  JOIN dr_users creator ON creator.user_id = p.created_by_user_id
  LEFT JOIN dr_users reviewer ON reviewer.user_id = p.assigned_reviewer_user_id`;

const proposalSelect = `
  SELECT p.*, creator.display_name AS creator_name, reviewer.display_name AS reviewer_name
  ${proposalFrom}`;

async function insertEvent(client: PoolClient, input: {
  proposalId: string;
  actorUserId: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await client.query(
    `INSERT INTO dr_proposal_events (
       proposal_event_id, proposal_id, actor_user_id, event_type,
       from_status, to_status, event_note, event_data
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [randomUUID(), input.proposalId, input.actorUserId, input.eventType,
      input.fromStatus || null, input.toStatus || null, input.note || "", JSON.stringify(input.data || {})],
  );
}

export async function workflowSummary(input: {
  userId: string;
  globalReview: boolean;
  reviewOrganizationIds: string[];
}) {
  const database = requireDatabase();
  const result = await database.query<{
    total: string; draft: string; submitted: string; under_review: string;
    changes_requested: string; approved: string; rejected: string; published: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status='draft')::text AS draft,
       COUNT(*) FILTER (WHERE status='submitted')::text AS submitted,
       COUNT(*) FILTER (WHERE status='under_review')::text AS under_review,
       COUNT(*) FILTER (WHERE status='changes_requested')::text AS changes_requested,
       COUNT(*) FILTER (WHERE status='approved')::text AS approved,
       COUNT(*) FILTER (WHERE status='rejected')::text AS rejected,
       COUNT(*) FILTER (WHERE status='published')::text AS published
     FROM dr_change_proposals
     WHERE (created_by_user_id = $1 OR $2::boolean OR organization_id = ANY($3::uuid[]))`,
    [input.userId, input.globalReview, input.reviewOrganizationIds],
  );
  const row = result.rows[0]!;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

export async function listProposals(input: {
  userId: string;
  globalReview: boolean;
  reviewOrganizationIds: string[];
  page: number;
  limit: number;
  status?: string;
  query?: string;
  targetType?: string;
  rootKey?: string;
  bundleId?: string;
  organizationId?: string;
  submitterId?: string;
  reviewerId?: string;
  warningStatus?: string;
  sort?: "submitted" | "activity";
}) {
  const database = requireDatabase();
  const conditions = ["(p.created_by_user_id = $1 OR $2::boolean OR p.organization_id = ANY($3::uuid[]))"];
  const values: unknown[] = [input.userId, input.globalReview, input.reviewOrganizationIds];
  if (input.status && input.status !== "all") {
    values.push(input.status);
    conditions.push(`p.status = $${values.length}`);
  }
  if (input.targetType && input.targetType !== "all") {
    values.push(input.targetType);
    conditions.push(`p.target_type = $${values.length}`);
  }
  if (input.rootKey) {
    values.push(input.rootKey);
    conditions.push(`p.root_key = $${values.length}`);
  }
  if (input.bundleId) {
    values.push(input.bundleId);
    conditions.push(`p.bundle_id = $${values.length}`);
  }
  if (input.organizationId) {
    values.push(input.organizationId);
    conditions.push(`p.organization_id = $${values.length}::UUID`);
  }
  if (input.submitterId) {
    values.push(input.submitterId);
    conditions.push(`p.created_by_user_id = $${values.length}::UUID`);
  }
  if (input.reviewerId) {
    values.push(input.reviewerId);
    conditions.push(`p.assigned_reviewer_user_id = $${values.length}::UUID`);
  }
  if (input.warningStatus === "warnings") {
    conditions.push(
      `JSONB_ARRAY_LENGTH(COALESCE(p.validation_result -> 'warnings', '[]'::JSONB)) > 0`,
    );
  } else if (input.warningStatus === "errors") {
    conditions.push(
      `JSONB_ARRAY_LENGTH(COALESCE(p.validation_result -> 'errors', '[]'::JSONB)) > 0`,
    );
  } else if (input.warningStatus === "clear") {
    conditions.push(
      `JSONB_ARRAY_LENGTH(COALESCE(p.validation_result -> 'warnings', '[]'::JSONB)) = 0
       AND JSONB_ARRAY_LENGTH(COALESCE(p.validation_result -> 'errors', '[]'::JSONB)) = 0`,
    );
  }
  if (input.query) {
    values.push(`%${input.query}%`);
    conditions.push(`(p.proposal_title ILIKE $${values.length} OR p.target_id ILIKE $${values.length} OR p.proposal_summary ILIKE $${values.length})`);
  }
  const offset = (input.page - 1) * input.limit;
  values.push(input.limit, offset);
  const result = await database.query<ProposalRow>(
    `SELECT p.*, creator.display_name AS creator_name, reviewer.display_name AS reviewer_name,
            COUNT(*) OVER()::text AS total_count
     ${proposalFrom}
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       CASE p.status WHEN 'submitted' THEN 1 WHEN 'under_review' THEN 2 WHEN 'changes_requested' THEN 3 WHEN 'approved' THEN 4 ELSE 5 END,
       ${input.sort === "submitted"
         ? "p.submitted_at DESC NULLS LAST, p.updated_at DESC"
         : "p.updated_at DESC"}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = Number(result.rows[0]?.total_count || 0);
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages: total ? Math.ceil(total / input.limit) : 0,
    items: result.rows.map(mapProposal),
  };
}

export async function getProposal(proposalId: string) {
  const database = requireDatabase();
  const proposalResult = await database.query<ProposalRow>(`${proposalSelect} WHERE p.proposal_id = $1`, [proposalId]);
  const row = proposalResult.rows[0];
  if (!row) return null;
  const [comments, events, evidence, publications] = await Promise.all([
    database.query<{
      comment_id: string; author_user_id: string; author_name: string; comment_type: string;
      comment_body: string; is_resolved: boolean; created_at: Date; updated_at: Date;
    }>(
      `SELECT c.comment_id, c.author_user_id, u.display_name AS author_name,
              c.comment_type, c.comment_body, c.is_resolved, c.created_at, c.updated_at
       FROM dr_proposal_comments c JOIN dr_users u ON u.user_id = c.author_user_id
       WHERE c.proposal_id = $1 ORDER BY c.created_at`, [proposalId],
    ),
    database.query<{
      proposal_event_id: string; actor_user_id: string | null; actor_name: string | null;
      event_type: string; from_status: string | null; to_status: string | null;
      event_note: string; event_data: Record<string, unknown>; created_at: Date;
    }>(
      `SELECT e.proposal_event_id, e.actor_user_id, u.display_name AS actor_name,
              e.event_type, e.from_status, e.to_status, e.event_note, e.event_data, e.created_at
       FROM dr_proposal_events e LEFT JOIN dr_users u ON u.user_id = e.actor_user_id
       WHERE e.proposal_id = $1 ORDER BY e.created_at`, [proposalId],
    ),
    database.query<{
      evidence_id: string; source_id: string; assertion_id: string | null;
      evidence_note: string; evidence_role: string; created_at: Date;
    }>(`SELECT evidence_id, source_id, assertion_id, evidence_note, evidence_role, created_at
        FROM dr_proposal_evidence WHERE proposal_id = $1 ORDER BY created_at`, [proposalId]),
    database.query<{
      publication_id: string; published_revision_id: string; publication_note: string;
      created_at: Date; rolled_back_at: Date | null; rollback_reason: string;
    }>(`SELECT publication_id, published_revision_id, publication_note, created_at, rolled_back_at, rollback_reason
        FROM dr_publications WHERE proposal_id = $1 ORDER BY created_at DESC`, [proposalId]),
  ]);
  const proposal = mapProposal(row);
  let currentPublished: Record<string, unknown> | null = null;
  let currentVersionToken: string | null = null;
  if (contextualGovernanceTargetTypes.has(row.target_type)) {
    const client = await database.connect();
    try {
      const current = await loadGovernedTarget(
        client,
        row.target_type,
        row.target_id,
      );
      currentPublished = current.exists ? current.snapshot : null;
      currentVersionToken = current.versionToken;
      proposal.staleBase =
        Boolean(row.base_version_token)
        && row.base_version_token !== current.versionToken;
    } finally {
      client.release();
    }
  }
  return {
    proposal,
    currentPublished,
    currentVersionToken,
    proposedRecord: mergeGovernedPatch(
      row.base_snapshot || {},
      row.proposed_patch || {},
      row.target_id,
    ),
    comments: comments.rows.map((item) => ({
      commentId: item.comment_id, authorUserId: item.author_user_id, authorName: item.author_name,
      commentType: item.comment_type, body: item.comment_body, isResolved: item.is_resolved,
      createdAt: item.created_at.toISOString(), updatedAt: item.updated_at.toISOString(),
    })),
    events: events.rows.map((item) => ({
      eventId: item.proposal_event_id, actorUserId: item.actor_user_id, actorName: item.actor_name,
      eventType: item.event_type, fromStatus: item.from_status, toStatus: item.to_status,
      note: item.event_note, data: item.event_data || {}, createdAt: item.created_at.toISOString(),
    })),
    evidence: evidence.rows.map((item) => ({
      evidenceId: item.evidence_id, sourceId: item.source_id, assertionId: item.assertion_id,
      note: item.evidence_note, role: item.evidence_role, createdAt: item.created_at.toISOString(),
    })),
    publications: publications.rows.map((item) => ({
      publicationId: item.publication_id, revisionId: item.published_revision_id,
      note: item.publication_note, createdAt: item.created_at.toISOString(),
      rolledBackAt: item.rolled_back_at?.toISOString() || null, rollbackReason: item.rollback_reason,
    })),
  };
}

export async function createProposal(input: {
  userId: string;
  organizationId?: string | null | undefined;
  targetType: string;
  targetId: string;
  rootKey?: string | undefined;
  bundleId?: string | null | undefined;
  changeType?: string | undefined;
  title: string;
  summary: string;
  baseRevisionId?: string | null | undefined;
  baseSnapshot: Record<string, unknown>;
  proposedPatch: Record<string, unknown>;
  editorialRationale: string;
  interpretationDisclosure: string;
  evidence: Array<{ sourceId: string; assertionId?: string | null | undefined; note?: string | undefined; role?: string | undefined }>;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  const proposalId = randomUUID();
  try {
    await client.query("BEGIN");
    let baseSnapshot = input.baseSnapshot;
    let baseVersionToken: string | null = null;
    let bundleId = input.bundleId || null;
    let validation: GovernanceValidationResult | null = null;
    const contextualRequest =
      contextualGovernanceTargetTypes.has(input.targetType)
      && Boolean(input.rootKey || input.bundleId);
    if (contextualRequest) {
      const current = await loadGovernedTarget(
        client,
        input.targetType,
        input.targetId,
      );
      if (current.exists) {
        if (bundleId && bundleId !== current.bundleId) {
          throw new WorkflowError(
            409,
            "GOVERNANCE_BUNDLE_MISMATCH",
            "The target belongs to a different dataset.",
          );
        }
        bundleId = current.bundleId;
        baseSnapshot = current.snapshot;
      } else {
        baseSnapshot = {};
      }
      if (!bundleId) {
        throw new WorkflowError(
          400,
          "GOVERNANCE_BUNDLE_REQUIRED",
          "A dataset is required for a new governed record.",
        );
      }
      const bundle = await client.query(
        "SELECT 1 FROM imported_bundles WHERE bundle_id = $1",
        [bundleId],
      );
      if (!bundle.rowCount) {
        throw new WorkflowError(
          404,
          "GOVERNANCE_BUNDLE_NOT_FOUND",
          "The governed dataset was not found.",
        );
      }
      baseVersionToken = current.versionToken;
      validation = await validateGovernedChange(client, {
        targetType: input.targetType,
        targetId: input.targetId,
        bundleId,
        baseSnapshot,
        proposedPatch: input.proposedPatch,
        editorialRationale: input.editorialRationale,
        evidenceSourceIds: input.evidence.map((item) => item.sourceId),
        changeType: input.changeType || "structured_update",
      });
    }
    await client.query(
      `INSERT INTO dr_change_proposals (
         proposal_id, organization_id, created_by_user_id, target_type, target_id,
         root_key, bundle_id, change_type, proposal_title, proposal_summary,
         base_revision_id, base_version_token, base_snapshot, proposed_patch,
         editorial_rationale, interpretation_disclosure, validation_result,
         last_validated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::JSONB,$14::JSONB,
         $15,$16,$17::JSONB,$18
       )`,
      [proposalId, input.organizationId || null, input.userId, input.targetType, input.targetId,
        input.rootKey || "", bundleId, input.changeType || "structured_update",
        input.title, input.summary, input.baseRevisionId || baseVersionToken,
        baseVersionToken, JSON.stringify(baseSnapshot),
        JSON.stringify(input.proposedPatch), input.editorialRationale,
        input.interpretationDisclosure,
        JSON.stringify(validation || { valid: true, errors: [], warnings: [] }),
        validation ? new Date(validation.checkedAt) : null],
    );
    for (const evidence of input.evidence) {
      await client.query(
        `INSERT INTO dr_proposal_evidence (
           evidence_id, proposal_id, source_id, assertion_id, evidence_note,
           evidence_role, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), proposalId, evidence.sourceId, evidence.assertionId || null,
          evidence.note || "", evidence.role || "supporting", input.userId],
      );
    }
    await insertEvent(client, {
      proposalId,
      actorUserId: input.userId,
      eventType: "proposal.created",
      toStatus: "draft",
      data: {
        rootKey: input.rootKey || "",
        bundleId,
        changeType: input.changeType || "structured_update",
        validation,
      },
    });
    await client.query("COMMIT");
    return await getProposal(proposalId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function updateProposal(input: {
  proposalId: string;
  userId: string;
  canEditAny: boolean;
  title: string;
  summary: string;
  proposedPatch: Record<string, unknown>;
  editorialRationale: string;
  interpretationDisclosure: string;
  evidence?: Array<{
    sourceId: string;
    assertionId?: string | null | undefined;
    note?: string | undefined;
    role?: string | undefined;
  }> | undefined;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      created_by_user_id: string;
      status: ProposalStatus;
      target_type: string;
      target_id: string;
      bundle_id: string | null;
      root_key: string;
      base_snapshot: Record<string, unknown>;
      change_type: string;
    }>(
      `SELECT created_by_user_id, status, target_type, target_id, bundle_id, root_key,
              base_snapshot, change_type
       FROM dr_change_proposals
       WHERE proposal_id = $1
       FOR UPDATE`,
      [input.proposalId],
    );
    const current = result.rows[0];
    if (!current) {
      throw new WorkflowError(
        404,
        "PROPOSAL_NOT_FOUND",
        "The proposal was not found.",
      );
    }
    if (!input.canEditAny && current.created_by_user_id !== input.userId) {
      throw new WorkflowError(
        403,
        "PROPOSAL_EDIT_DENIED",
        "Only the proposal owner or an authorized editor may change this draft.",
      );
    }
    if (!["draft", "changes_requested"].includes(current.status)) {
      throw new WorkflowError(
        409,
        "PROPOSAL_LOCKED",
        "Only draft or changes-requested proposals may be edited.",
      );
    }
    let validation: GovernanceValidationResult | null = null;
    const evidenceSourceIds = input.evidence
      ? input.evidence.map((item) => item.sourceId)
      : (
          await client.query<{ source_id: string }>(
            "SELECT source_id FROM dr_proposal_evidence WHERE proposal_id = $1",
            [input.proposalId],
          )
        ).rows.map((item) => item.source_id);
    if (
      contextualGovernanceTargetTypes.has(current.target_type)
      && Boolean(current.root_key)
      && current.bundle_id
    ) {
      validation = await validateGovernedChange(client, {
        targetType: current.target_type,
        targetId: current.target_id,
        bundleId: current.bundle_id,
        baseSnapshot: current.base_snapshot || {},
        proposedPatch: input.proposedPatch,
        editorialRationale: input.editorialRationale,
        evidenceSourceIds,
        changeType: current.change_type,
      });
    }
    await client.query(
      `UPDATE dr_change_proposals SET
         proposal_title=$1, proposal_summary=$2, proposed_patch=$3::JSONB,
         editorial_rationale=$4, interpretation_disclosure=$5,
         validation_result=COALESCE($6::JSONB, validation_result),
         last_validated_at=CASE WHEN $6::JSONB IS NULL THEN last_validated_at ELSE CURRENT_TIMESTAMP END,
         version_number=version_number+1, updated_at=CURRENT_TIMESTAMP
       WHERE proposal_id=$7`,
      [
        input.title,
        input.summary,
        JSON.stringify(input.proposedPatch),
        input.editorialRationale,
        input.interpretationDisclosure,
        validation ? JSON.stringify(validation) : null,
        input.proposalId,
      ],
    );
    if (input.evidence) {
      await client.query(
        "DELETE FROM dr_proposal_evidence WHERE proposal_id = $1",
        [input.proposalId],
      );
      for (const evidence of input.evidence) {
        await client.query(
          `INSERT INTO dr_proposal_evidence(
             evidence_id, proposal_id, source_id, assertion_id, evidence_note,
             evidence_role, created_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            randomUUID(),
            input.proposalId,
            evidence.sourceId,
            evidence.assertionId || null,
            evidence.note || "",
            evidence.role || "supporting",
            input.userId,
          ],
        );
      }
    }
    await insertEvent(client, {
      proposalId: input.proposalId,
      actorUserId: input.userId,
      eventType: "proposal.updated",
      data: { versionIncremented: true, validation },
    });
    await client.query("COMMIT");
    return getProposal(input.proposalId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addProposalComment(input: {
  proposalId: string;
  userId: string;
  body: string;
  type: string;
}) {
  const database = requireDatabase();
  const exists = await database.query(`SELECT 1 FROM dr_change_proposals WHERE proposal_id=$1`, [input.proposalId]);
  if (!exists.rowCount) throw new WorkflowError(404, "PROPOSAL_NOT_FOUND", "The proposal was not found.");
  await database.query(
    `INSERT INTO dr_proposal_comments (
       comment_id, proposal_id, author_user_id, comment_type, comment_body
     ) VALUES ($1,$2,$3,$4,$5)`,
    [randomUUID(), input.proposalId, input.userId, input.type, input.body],
  );
  return getProposal(input.proposalId);
}

const transitionStatus = {
  submit: "submitted",
  start_review: "under_review",
  request_changes: "changes_requested",
  approve: "approved",
  reject: "rejected",
  withdraw: "withdrawn",
} as const satisfies Record<string, ProposalStatus>;

type ProposalTransitionAction = keyof typeof transitionStatus;

const allowedTransitions: Record<ProposalTransitionAction, ProposalStatus[]> = {
  submit: ["draft", "changes_requested"],
  start_review: ["submitted"],
  request_changes: ["submitted", "under_review"],
  approve: ["submitted", "under_review"],
  reject: ["submitted", "under_review"],
  withdraw: ["draft", "submitted", "changes_requested"],
};

export async function transitionProposal(input: {
  proposalId: string;
  userId: string;
  action: ProposalTransitionAction;
  note: string;
  canReview: boolean;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      status: ProposalStatus;
      created_by_user_id: string;
      target_type: string;
      target_id: string;
      bundle_id: string | null;
      root_key: string;
      base_snapshot: Record<string, unknown>;
      base_version_token: string | null;
      proposed_patch: Record<string, unknown>;
      editorial_rationale: string;
      change_type: string;
    }>(
      `SELECT status, created_by_user_id, target_type, target_id, bundle_id, root_key,
              base_snapshot, base_version_token, proposed_patch,
              editorial_rationale, change_type
       FROM dr_change_proposals
       WHERE proposal_id=$1
       FOR UPDATE`,
      [input.proposalId],
    );
    const proposal = result.rows[0];
    if (!proposal) throw new WorkflowError(404, "PROPOSAL_NOT_FOUND", "The proposal was not found.");
    if (!allowedTransitions[input.action]?.includes(proposal.status)) throw new WorkflowError(409, "INVALID_PROPOSAL_TRANSITION", `A ${proposal.status} proposal cannot perform ${input.action}.`);
    if (["start_review", "request_changes", "approve", "reject"].includes(input.action) && !input.canReview) {
      throw new WorkflowError(403, "REVIEW_PERMISSION_REQUIRED", "Reviewer permission is required for this decision.");
    }
    if (["submit", "withdraw"].includes(input.action) && proposal.created_by_user_id !== input.userId && !input.canReview) {
      throw new WorkflowError(403, "PROPOSAL_OWNER_REQUIRED", "Only the proposal owner may perform this action.");
    }
    const allowSelfApproval = (process.env.ALLOW_SELF_APPROVAL || "false").toLowerCase() === "true";
    if (input.action === "approve" && proposal.created_by_user_id === input.userId && !allowSelfApproval) {
      throw new WorkflowError(409, "SELF_APPROVAL_BLOCKED", "A contributor cannot approve their own proposal.");
    }
    let validation: GovernanceValidationResult | null = null;
    if (
      ["submit", "approve"].includes(input.action)
      && contextualGovernanceTargetTypes.has(proposal.target_type)
      && Boolean(proposal.root_key)
      && proposal.bundle_id
    ) {
      const current = await loadGovernedTarget(
        client,
        proposal.target_type,
        proposal.target_id,
      );
      if (
        proposal.base_version_token
        && current.versionToken !== proposal.base_version_token
      ) {
        throw new WorkflowError(
          409,
          "STALE_PROPOSAL_BASE",
          "The published target changed after this proposal was created. Refresh the proposal before continuing.",
        );
      }
      const evidence = await client.query<{ source_id: string }>(
        "SELECT source_id FROM dr_proposal_evidence WHERE proposal_id = $1",
        [input.proposalId],
      );
      validation = await validateGovernedChange(client, {
        targetType: proposal.target_type,
        targetId: proposal.target_id,
        bundleId: proposal.bundle_id,
        baseSnapshot: proposal.base_snapshot || {},
        proposedPatch: proposal.proposed_patch || {},
        editorialRationale: proposal.editorial_rationale,
        evidenceSourceIds: evidence.rows.map((item) => item.source_id),
        changeType: proposal.change_type,
      });
      await client.query(
        `UPDATE dr_change_proposals
         SET validation_result = $1::JSONB,
             last_validated_at = CURRENT_TIMESTAMP
         WHERE proposal_id = $2`,
        [JSON.stringify(validation), input.proposalId],
      );
      if (!validation.valid) {
        throw new WorkflowError(
          422,
          "GOVERNANCE_VALIDATION_FAILED",
          "The proposal must resolve its validation errors before this workflow action.",
        );
      }
    }
    const nextStatus = transitionStatus[input.action];
    const timestampColumn =
      input.action === "submit"
        ? "submitted_at"
        : input.action === "approve"
          ? "approved_at"
          : null;
    const timestampSql = timestampColumn ? `, ${timestampColumn}=CURRENT_TIMESTAMP` : "";
    const reviewerSql = ["start_review", "request_changes", "approve", "reject"].includes(input.action)
      ? ", assigned_reviewer_user_id=$3, reviewed_at=CASE WHEN $4::text IN ('request_changes','approve','reject') THEN CURRENT_TIMESTAMP ELSE reviewed_at END"
      : "";
    await client.query(
      `UPDATE dr_change_proposals SET status=$1, updated_at=CURRENT_TIMESTAMP${timestampSql}${reviewerSql} WHERE proposal_id=$2`,
      reviewerSql ? [nextStatus, input.proposalId, input.userId, input.action] : [nextStatus, input.proposalId],
    );
    if (input.note) {
      await client.query(
        `INSERT INTO dr_proposal_comments (comment_id, proposal_id, author_user_id, comment_type, comment_body)
         VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), input.proposalId, input.userId,
          input.action === "request_changes" ? "change_request" : input.action === "approve" || input.action === "reject" ? "review_note" : "discussion",
          input.note],
      );
    }
    await insertEvent(client, {
      proposalId: input.proposalId,
      actorUserId: input.userId,
      eventType: `proposal.${input.action}`,
      fromStatus: proposal.status,
      toStatus: nextStatus,
      note: input.note,
      data: validation ? { validation } : {},
    });
    await client.query("COMMIT");
    return getProposal(input.proposalId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function resolveBundleId(client: PoolClient, targetType: string, targetId: string): Promise<string | null> {
  const queries: Record<string, string[]> = {
    concept: ["SELECT bundle_id FROM dictionaryroot_lexicon_synsets WHERE node_id=$1", "SELECT bundle_id FROM nodes WHERE node_id=$1"],
    meaning: ["SELECT bundle_id FROM dictionaryroot_lexicon_synsets WHERE node_id=$1", "SELECT bundle_id FROM nodes WHERE node_id=$1"],
    relationship: ["SELECT bundle_id FROM edges WHERE edge_id=$1", "SELECT bundle_id FROM dictionaryroot_lexicon_relations WHERE relation_id=$1"],
    source: ["SELECT bundle_id FROM sources WHERE source_id=$1"],
    assertion: ["SELECT bundle_id FROM assertions WHERE assertion_id=$1"],
  };
  for (const query of queries[targetType] || []) {
    const result = await client.query<{ bundle_id: string }>(query, [targetId]);
    if (result.rows[0]?.bundle_id) return result.rows[0].bundle_id;
  }
  return null;
}

function stringArrayFromSnapshot(
  snapshot: Record<string, unknown>,
): string[] {
  const values = Array.isArray(snapshot.sourceIds)
    ? snapshot.sourceIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (typeof snapshot.sourceId === "string" && snapshot.sourceId) {
    values.push(snapshot.sourceId);
  }
  return [...new Set(values)];
}

export async function getPublicationProposal(publicationId: string): Promise<{ proposalId: string; organizationId: string | null } | null> {
  const database = requireDatabase();
  const result = await database.query<{ proposal_id: string; organization_id: string | null }>(
    `SELECT p.proposal_id, p.organization_id
     FROM dr_publications publication
     JOIN dr_change_proposals p ON p.proposal_id = publication.proposal_id
     WHERE publication.publication_id = $1`,
    [publicationId],
  );
  const row = result.rows[0];
  return row ? { proposalId: row.proposal_id, organizationId: row.organization_id } : null;
}

export async function publishProposal(input: {
  proposalId: string;
  userId: string;
  note: string;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      status: ProposalStatus;
      target_type: string;
      target_id: string;
      root_key: string;
      bundle_id: string | null;
      change_type: string;
      base_snapshot: Record<string, unknown>;
      base_version_token: string | null;
      proposed_patch: Record<string, unknown>;
      editorial_rationale: string;
      created_by_user_id: string;
    }>(
      `SELECT status, target_type, target_id, root_key, bundle_id,
              change_type, base_snapshot, base_version_token, proposed_patch,
              editorial_rationale, created_by_user_id
       FROM dr_change_proposals
       WHERE proposal_id=$1
       FOR UPDATE`,
      [input.proposalId],
    );
    const proposal = result.rows[0];
    if (!proposal) throw new WorkflowError(404, "PROPOSAL_NOT_FOUND", "The proposal was not found.");
    if (proposal.status !== "approved") throw new WorkflowError(409, "PROPOSAL_NOT_APPROVED", "Only an approved proposal may be published.");
    const activeLock = await client.query<{ lock_reason: string }>(
      `SELECT lock_reason FROM dr_record_locks
       WHERE target_type = $1 AND target_id = $2 AND released_at IS NULL
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [proposal.target_type, proposal.target_id],
    );
    if (activeLock.rowCount) {
      throw new WorkflowError(423, "TARGET_RECORD_LOCKED", `Publication is blocked by an active moderation lock: ${activeLock.rows[0]!.lock_reason}`);
    }
    const publicationId = randomUUID();
    const contextualPublication =
      Boolean(proposal.root_key)
      && Boolean(proposal.bundle_id)
      && contextualGovernanceTargetTypes.has(proposal.target_type);
    const revisionId = contextualPublication
      ? `sourceroot-governed-${publicationId}`
      : `dictionaryroot-governed-${publicationId}`;
    const previous = await client.query<{ publication_id: string }>(
      `SELECT publication_id FROM dr_publications
       WHERE target_type=$1 AND target_id=$2 AND rolled_back_at IS NULL
       ORDER BY created_at DESC LIMIT 1`, [proposal.target_type, proposal.target_id],
    );
    let priorSnapshot: Record<string, unknown> = {};
    let publishedSnapshot: Record<string, unknown> =
      proposal.proposed_patch || {};
    let bundleId = proposal.bundle_id;
    let validation: GovernanceValidationResult | null = null;

    if (contextualPublication && bundleId) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [proposal.target_type, proposal.target_id],
      );
      const current = await loadGovernedTarget(
        client,
        proposal.target_type,
        proposal.target_id,
      );
      if (
        proposal.base_version_token
        && current.versionToken !== proposal.base_version_token
      ) {
        throw new WorkflowError(
          409,
          "STALE_PROPOSAL_BASE",
          "Publication was blocked because the target has changed since this proposal was created.",
        );
      }
      if (
        current.exists
        && current.bundleId !== bundleId
      ) {
        throw new WorkflowError(
          409,
          "GOVERNANCE_BUNDLE_MISMATCH",
          "Publication cannot move a governed target between datasets.",
        );
      }
      const evidence = await client.query<{ source_id: string }>(
        "SELECT source_id FROM dr_proposal_evidence WHERE proposal_id = $1",
        [input.proposalId],
      );
      validation = await validateGovernedChange(client, {
        targetType: proposal.target_type,
        targetId: proposal.target_id,
        bundleId,
        baseSnapshot: proposal.base_snapshot || {},
        proposedPatch: proposal.proposed_patch || {},
        editorialRationale: proposal.editorial_rationale,
        evidenceSourceIds: evidence.rows.map((item) => item.source_id),
        changeType: proposal.change_type,
      });
      if (!validation.valid) {
        throw new WorkflowError(
          422,
          "GOVERNANCE_VALIDATION_FAILED",
          "Publication revalidation found unresolved historical-governance errors.",
        );
      }
      priorSnapshot = current.exists ? current.snapshot : {};
      publishedSnapshot = mergeGovernedPatch(
        proposal.base_snapshot || {},
        proposal.proposed_patch || {},
        proposal.target_id,
      );
      await materializeGovernedSnapshot(
        client,
        proposal.target_type,
        proposal.target_id,
        bundleId,
        publishedSnapshot,
      );
      publishedSnapshot = (
        await loadGovernedTarget(
          client,
          proposal.target_type,
          proposal.target_id,
        )
      ).snapshot;
    } else {
      bundleId = await resolveBundleId(
        client,
        proposal.target_type,
        proposal.target_id,
      );
    }

    await client.query(
      `UPDATE dr_published_overlays SET is_active=FALSE, deactivated_at=CURRENT_TIMESTAMP
       WHERE target_type=$1 AND target_id=$2 AND is_active=TRUE`, [proposal.target_type, proposal.target_id],
    );
    await client.query(
      `INSERT INTO dr_publications (
         publication_id, proposal_id, target_type, target_id, published_revision_id,
         published_snapshot, published_by_user_id, publication_note,
         supersedes_publication_id, root_key, bundle_id, prior_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6::JSONB,$7,$8,$9,$10,$11,$12::JSONB)`,
      [publicationId, input.proposalId, proposal.target_type, proposal.target_id, revisionId,
        JSON.stringify(publishedSnapshot), input.userId, input.note,
        previous.rows[0]?.publication_id || null, proposal.root_key, bundleId,
        JSON.stringify(priorSnapshot)],
    );
    await client.query(
      `INSERT INTO dr_published_overlays (
         overlay_id, publication_id, target_type, target_id, overlay_data
       ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [randomUUID(), publicationId, proposal.target_type, proposal.target_id, JSON.stringify(publishedSnapshot)],
    );
    if (bundleId) {
      await client.query(
        `INSERT INTO revisions (
           revision_id, bundle_id, object_type, object_id, revision_type,
           summary, status, raw_data
         ) VALUES ($1,$2,$3,$4,'governed-publication',$5,'published',$6::jsonb)
         ON CONFLICT (revision_id) DO NOTHING`,
        [
          revisionId,
          bundleId,
          proposal.target_type,
          proposal.target_id,
          input.note || "Governed SourceRoot publication",
          JSON.stringify({
            proposalId: input.proposalId,
            publicationId,
            rootKey: proposal.root_key,
            changeType: proposal.change_type,
            before: priorSnapshot,
            after: publishedSnapshot,
            validation,
          }),
        ],
      );
    }
    await client.query(
      `UPDATE dr_change_proposals SET status='published', published_at=CURRENT_TIMESTAMP,
              validation_result=COALESCE($2::JSONB, validation_result),
              last_validated_at=CASE WHEN $2::JSONB IS NULL THEN last_validated_at ELSE CURRENT_TIMESTAMP END,
              updated_at=CURRENT_TIMESTAMP WHERE proposal_id=$1`,
      [input.proposalId, validation ? JSON.stringify(validation) : null],
    );
    await insertEvent(client, {
      proposalId: input.proposalId,
      actorUserId: input.userId,
      eventType: "proposal.published",
      fromStatus: "approved",
      toStatus: "published",
      note: input.note,
      data: {
        publicationId,
        revisionId,
        bundleRevisionWritten: Boolean(bundleId),
        materialized: contextualPublication,
        validation,
      },
    });
    await client.query("COMMIT");
    return getProposal(input.proposalId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function rollbackPublication(input: {
  publicationId: string;
  userId: string;
  reason: string;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      proposal_id: string;
      target_type: string;
      target_id: string;
      root_key: string;
      bundle_id: string | null;
      published_snapshot: Record<string, unknown>;
      prior_snapshot: Record<string, unknown>;
      published_revision_id: string;
      supersedes_publication_id: string | null;
      rolled_back_at: Date | null;
      is_active: boolean | null;
    }>(
      `SELECT publication.proposal_id, publication.target_type,
              publication.target_id, publication.root_key,
              publication.bundle_id, publication.published_snapshot,
              publication.prior_snapshot, publication.published_revision_id,
              publication.supersedes_publication_id,
              publication.rolled_back_at, overlay.is_active
       FROM dr_publications publication
       JOIN dr_published_overlays overlay
         ON overlay.publication_id = publication.publication_id
       WHERE publication.publication_id=$1
       FOR UPDATE OF publication, overlay`,
      [input.publicationId],
    );
    const publication = result.rows[0];
    if (!publication) throw new WorkflowError(404, "PUBLICATION_NOT_FOUND", "The publication was not found.");
    if (publication.rolled_back_at) throw new WorkflowError(409, "PUBLICATION_ALREADY_ROLLED_BACK", "This publication was already rolled back.");
    if (publication.is_active === false) {
      throw new WorkflowError(
        409,
        "PUBLICATION_NOT_CURRENT",
        "Only the current active publication can be rolled back.",
      );
    }
    const contextualRollback =
      Boolean(publication.root_key)
      && Boolean(publication.bundle_id)
      && contextualGovernanceTargetTypes.has(publication.target_type);
    let rollbackRevisionId: string | null = null;
    if (contextualRollback && publication.bundle_id) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [publication.target_type, publication.target_id],
      );
      const current = await loadGovernedTarget(
        client,
        publication.target_type,
        publication.target_id,
      );
      if (
        !current.exists
        || current.versionToken
          !== governanceVersionToken(publication.published_snapshot || {})
      ) {
        throw new WorkflowError(
          409,
          "ROLLBACK_TARGET_CONFLICT",
          "Rollback was blocked because the published target no longer matches this revision.",
        );
      }
      if (Object.keys(publication.prior_snapshot || {}).length === 0) {
        await hideNewGovernedTarget(
          client,
          publication.target_type,
          publication.target_id,
        );
      } else {
        const restoredValidation = await validateGovernedChange(client, {
          targetType: publication.target_type,
          targetId: publication.target_id,
          bundleId: publication.bundle_id,
          baseSnapshot: publication.prior_snapshot,
          proposedPatch: {},
          editorialRationale: input.reason,
          evidenceSourceIds: stringArrayFromSnapshot(
            publication.prior_snapshot,
          ),
          changeType: "governed_rollback",
        });
        if (!restoredValidation.valid) {
          throw new WorkflowError(
            409,
            "ROLLBACK_VALIDATION_FAILED",
            "The prior contextual snapshot no longer passes governed validation.",
          );
        }
        await materializeGovernedSnapshot(
          client,
          publication.target_type,
          publication.target_id,
          publication.bundle_id,
          publication.prior_snapshot,
        );
      }
      rollbackRevisionId = `sourceroot-rollback-${randomUUID()}`;
      await client.query(
        `INSERT INTO revisions(
           revision_id, bundle_id, object_type, object_id, revision_type,
           summary, status, raw_data
         ) VALUES ($1,$2,$3,$4,'governed-rollback',$5,'published',$6::JSONB)`,
        [
          rollbackRevisionId,
          publication.bundle_id,
          publication.target_type,
          publication.target_id,
          input.reason,
          JSON.stringify({
            publicationId: input.publicationId,
            rolledBackRevisionId: publication.published_revision_id,
            before: publication.published_snapshot,
            after: publication.prior_snapshot,
          }),
        ],
      );
    }
    await client.query(
      `UPDATE dr_publications SET rolled_back_at=CURRENT_TIMESTAMP, rolled_back_by_user_id=$1,
              rollback_reason=$2 WHERE publication_id=$3`, [input.userId, input.reason, input.publicationId],
    );
    await client.query(
      `UPDATE dr_published_overlays SET is_active=FALSE, deactivated_at=CURRENT_TIMESTAMP
       WHERE publication_id=$1`, [input.publicationId],
    );
    if (publication.supersedes_publication_id) {
      await client.query(
        `UPDATE dr_published_overlays SET is_active=TRUE, activated_at=CURRENT_TIMESTAMP,
                deactivated_at=NULL WHERE publication_id=$1`, [publication.supersedes_publication_id],
      );
    }
    await client.query(
      `UPDATE dr_change_proposals SET status='superseded', updated_at=CURRENT_TIMESTAMP
       WHERE proposal_id=$1`, [publication.proposal_id],
    );
    await insertEvent(client, {
      proposalId: publication.proposal_id,
      actorUserId: input.userId,
      eventType: "publication.rolled_back",
      fromStatus: "published",
      toStatus: "superseded",
      note: input.reason,
      data: {
        publicationId: input.publicationId,
        restoredPublicationId: publication.supersedes_publication_id,
        rollbackRevisionId,
        materialized: contextualRollback,
      },
    });
    await client.query("COMMIT");
    return getProposal(publication.proposal_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
