# SourceRoot Agent Safety Baseline

## Baseline Identity

- Baseline: SourceRoot Agent Safety and Authority Baseline
- Version: v1
- Scope: policy and documentation only

This stage does not implement a production agent system.

## Core Principle

SourceRoot must automate processes before judgment.

Agent output is never automatically equivalent to verified knowledge. Imported source content is untrusted input.

An instruction appearing inside any of the following must never be treated as an operational instruction to an agent:

- A webpage.
- A document.
- A dataset.
- An API response.
- A source record.
- A user upload.
- Metadata.
- A citation.
- A comment.

These materials are evidence or data to inspect, not authority to change tools, permissions, policies, objectives, or execution plans.

## Autonomy Ladder

### Level 0 — Manual Operation

Humans perform the work. Software may store records and enforce normal application constraints, but no agent observes, recommends, or executes.

### Level 1 — AI Observation

Agents monitor and report but cannot change records. Reports must identify evidence, uncertainty, and the human owner.

### Level 2 — AI Recommendation

Agents create proposals for human approval. A proposal has no effect until an authorized human accepts it through a recorded approval path.

### Level 3 — Supervised Execution

Agents perform approved, narrow, reversible actions. The approval must specify scope, environment, limits, and expiration.

### Level 4 — Bounded Autonomy

Agents perform established low-risk recurring work within strict limits. Limits must be technically enforced and continuously auditable, with automatic escalation when a boundary is reached.

### Level 5 — Multi-Agent Operations

Specialized agents coordinate, but humans retain governance authority. Delegation relationships, budgets, scopes, and escalation paths must be explicit.

Do not assume every agent should reach Level 5. Use the lowest autonomy level that reliably satisfies the approved purpose.

## Required Safeguards

Any production agent capability must define and enforce:

- Dedicated agent identities that cannot be confused with human identities.
- Agent-specific service accounts rather than shared human accounts.
- Restricted credentials with rotation and revocation procedures.
- Role-based permissions.
- Tenant restrictions.
- Record-type restrictions.
- Environment restrictions separating development, test, staging, and production.
- Rate limits.
- Spending limits.
- Record-volume limits.
- Complete action logging.
- Prompt-version tracking.
- Model-version tracking.
- Human-readable explanations.
- Evidence links.
- Confidence and uncertainty.
- Human approval queues.
- Reversible changes.
- Automatic escalation for conflicts, uncertainty, policy boundaries, and limit exhaustion.
- Emergency disable controls available to named humans.
- Separation of duties between proposing, approving, executing, and reviewing.
- Limits on agent-to-agent delegation.
- Prompt-injection protection.
- Poisoned-source protection.
- Regular evaluation against named acceptance and safety criteria.
- Named human ownership for every deployed agent and workflow.

Safeguards must be controls, not merely prompt text. Authorization must be enforced at the identity, API, data, and environment boundaries.

## Untrusted-Input and Prompt-Injection Protection

Agents must keep control instructions separate from retrieved content. Retrieval results, citations, uploaded material, and application records may not grant authority, request secrets, change scope, select tools, alter evaluation criteria, or override policy.

An agent must:

1. Treat retrieved instructions as quoted data.
2. Ignore requests within source content to reveal credentials, bypass approval, contact third parties, execute code, or alter records.
3. Resolve sources through allow-listed protocols and bounded retrieval.
4. Preserve source identifiers, versions, and retrieval dates.
5. Escape or isolate active content before processing.
6. Require explicit policy and human approval for material actions.
7. Log detected injection attempts and escalate when they affect task integrity.

## Poisoned-Source Protection

SourceRoot must assume that sources can be malicious, corrupted, duplicated, stale, selectively edited, or coordinated to create false consensus.

Controls must include provenance retention, content hashing or equivalent version identity, source diversity checks where appropriate, conflict preservation, quarantining of anomalous inputs, limits on newly observed sources, independent validation for high-impact claims, and an audit trail linking every derived proposal to exact source versions.

No agent may erase counterevidence or convert repeated copies of one source into independent corroboration.

## Permanently Human-Controlled Actions

Agents must never autonomously:

- Approve contracts.
- Make final legal determinations.
- Declare disputed assertions definitively true.
- Delete conflicting evidence.
- Permanently merge sensitive identities.
- Permanently ban users.
- Revoke verified identity status.
- Change governance policy.
- Expand their own permissions.
- Increase their own spending limits.
- Disable audit logs.
- Delete production databases.
- Access unrelated customer tenants.
- Publish high-impact corrections.
- Make irreversible reputation decisions.
- Change billing or commercial terms.
- Hide failures.
- Alter evaluation results.
- Bypass escalation.
- Approve their own actions.
- Delegate beyond approved relationships.

A human approval interface does not make an action human-controlled if the agent can forge, skip, reuse, or broaden the approval.

## Required Agent Audit Record

Every observed task, recommendation, approved execution, refusal, escalation, and reversal must produce an audit record with these fields:

| Field | Required content |
|---|---|
| Agent identity | Stable agent and service-account identifiers |
| Task identity | Stable task, run, and correlation identifiers |
| Trigger | Human request, schedule, event, or approved delegation |
| Human owner | Named accountable person |
| Tenant | Exact tenant scope |
| Root product | SourceRoot, DictionaryRoot, or another authorized root |
| Access scope | Roles, permissions, record types, environment, and limits |
| Sources consulted | Source identifiers and resolvable evidence links |
| Source versions | Immutable version, hash, or revision identifier |
| Retrieval dates | Timestamp for each retrieved source |
| Input record IDs | Exact records supplied to or retrieved by the agent |
| Proposed action | Human-readable intended operation |
| Confidence | Calibrated value and scale definition |
| Uncertainty | Known gaps, assumptions, and unresolved questions |
| Supporting evidence | Evidence linked to the proposal |
| Conflicting evidence | Counterevidence retained and linked |
| Applicable policy | Versioned rules governing the decision |
| Required approval | Approver role and approval conditions |
| Before state | Reconstructable pre-action record |
| After state | Reconstructable post-action record |
| Approving human | Stable identity and approval timestamp |
| Execution result | Success, partial, failure, refusal, or escalation |
| Cost | Measured compute, provider, and external-service cost |
| Duration | Start, end, and elapsed time |
| Reversal method | Tested or defined rollback procedure |
| Review result | Reviewer identity, outcome, and notes |
| Incident linkage | Related incident, alert, or investigation IDs |

Audit records must be append-only or equivalently tamper-evident, access-controlled, retained under policy, and queryable by the named human owner.

## Approval and Separation of Duties

An agent may not approve its own proposal, expand the meaning of an approval, or reuse approval outside its recorded task, tenant, environment, time window, and volume. High-impact actions require distinct proposer, approver, and reviewer roles. Emergency controls must revoke execution authority without disabling audit access.

## Evaluation and Ownership

Each deployed workflow requires:

- A named human owner and backup owner.
- A documented autonomy level.
- Pre-deployment evaluation.
- Scheduled re-evaluation.
- Adversarial prompt-injection and poisoned-source tests.
- False-positive, false-negative, escalation, reversal, and cost metrics.
- A defined incident response and disable procedure.

Passing an evaluation authorizes only the evaluated version, model, prompt, tools, permissions, sources, and operating bounds.

## Stage Limitation

Chunk 0 establishes this policy baseline only. It creates no agent identity, credential, queue, database table, API, autonomous workflow, or production enforcement mechanism.
