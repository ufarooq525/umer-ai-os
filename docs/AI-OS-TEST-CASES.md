# Umer AI OS — Test Case Inventory

This file is the living acceptance-test register. Update it whenever functionality changes.

## Coverage summary

| Area | Covered | Pending | Total |
|---|---:|---:|---:|
| Workforce visibility | 8 | 0 | 8 |
| Kernel task lifecycle | 10 | 0 | 10 |
| Explainability & lineage | 6 | 1 | 7 |
| Economics & telemetry | 6 | 1 | 7 |
| Global search | 12 | 2 | 14 |
| CEO controls | 0 | 6 | 6 |
| Cross-system timeline | 0 | 5 | 5 |
| MCP control center | 0 | 6 | 6 |
| Evidence → revenue lineage | 0 | 8 | 8 |
| **Total** | **42** | **29** | **71** |

> Covered means implemented and represented by an acceptance case. It does not mean a CI automation suite has already executed every case. CI/automated execution should be added as the implementation matures.

## Workforce visibility — 8/8

- [x] WF-001 Agent registry shows all seeded agents.
- [x] WF-002 Agent status is read from durable MySQL state.
- [x] WF-003 Current task/project/run/business are visible when assigned.
- [x] WF-004 Heartbeat timestamp is visible.
- [x] WF-005 Next action is visible when available.
- [x] WF-006 Workforce events are persisted.
- [x] WF-007 Opportunity pipeline updates workforce state without fake activity.
- [x] WF-008 CEO dashboard polls current workforce state.

## Kernel task lifecycle — 10/10

- [x] KRN-001 Creating a task persists a durable queued task.
- [x] KRN-002 Task creation records structured why context.
- [x] KRN-003 Task creation records project/run/entity linkage when available.
- [x] KRN-004 Highest-priority eligible queued task is claimable.
- [x] KRN-005 Concurrent workers do not claim the same task because claiming is transactional/locked.
- [x] KRN-006 Capability mismatch prevents a worker from claiming an incompatible task.
- [x] KRN-007 Valid worker heartbeat extends the lease.
- [x] KRN-008 Invalid/expired lease cannot heartbeat the task.
- [x] KRN-009 Completion releases the active lease and records the result.
- [x] KRN-010 Expired leases requeue work or fail it after max attempts.

## Explainability & lineage — 6/7

- [x] EXP-001 Task detail exposes the why payload.
- [x] EXP-002 Task detail exposes objective/project/run/parent/agent/capability/entity chain.
- [x] EXP-003 Task detail exposes attempts and workflow events.
- [x] EXP-004 Task detail exposes model/tool/evaluation/cost records.
- [x] EXP-005 Child tasks are discoverable from the parent task.
- [x] EXP-006 CEO can open task investigation from Task Explorer.
- [ ] EXP-007 Opportunity scoring and decisions persist first-class structured why records.

## Economics & telemetry — 6/7

- [x] ECO-001 24h model input/output tokens are visible.
- [x] ECO-002 Cached-token count and cache rate are visible.
- [x] ECO-003 Tool calls/failures/cache rate are visible.
- [x] ECO-004 Model/tool tracked cost is visible.
- [x] ECO-005 Evaluation count/score/confidence is visible.
- [x] ECO-006 Task/tool/model/cost records can be inspected from task detail.
- [ ] ECO-007 Revenue attribution can be compared against AI spend.

## Global search — 12/14

- [x] SRCH-001 Query shorter than 2 characters returns an empty result set without querying broad data.
- [x] SRCH-002 Search is case-insensitive.
- [x] SRCH-003 Search agents by ID/name/role/status.
- [x] SRCH-004 Search tasks by ID/title/type/status/agent/run.
- [x] SRCH-005 Search opportunity runs by run ID/niche.
- [x] SRCH-006 Search niches by ID/name/description.
- [x] SRCH-007 Search businesses by ID/name/website/geography/industry.
- [x] SRCH-008 Search opportunities by ID/title/market/status.
- [x] SRCH-009 Search evidence by ID/title/source/observation.
- [x] SRCH-010 Search problems by ID/business/niche/statement.
- [x] SRCH-011 Search outreach drafts by ID/opportunity/business/subject/body.
- [x] SRCH-012 Search workflow/run events by ID/type/message/entity IDs.
- [ ] SRCH-013 Every result type has a dedicated deep-link/detail page.
- [ ] SRCH-014 Search relevance ranking groups exact IDs/titles ahead of broad text matches.

## CEO controls — 0/6

- [ ] CTRL-001 Pause an agent.
- [ ] CTRL-002 Resume an agent.
- [ ] CTRL-003 Retry a failed task.
- [ ] CTRL-004 Reassign a task.
- [ ] CTRL-005 Cancel a task safely.
- [ ] CTRL-006 Every control action creates an immutable audit event.

## Cross-system timeline — 0/5

- [ ] TL-001 Workforce events and kernel events appear in one chronological stream.
- [ ] TL-002 Opportunity run events join the same stream.
- [ ] TL-003 Timeline can be filtered by agent.
- [ ] TL-004 Timeline can be filtered by run/project/business/opportunity.
- [ ] TL-005 Timeline preserves correlation IDs across all stages.

## MCP control center — 0/6

- [ ] MCP-001 Registered MCP servers are visible.
- [ ] MCP-002 Tool catalog and capabilities are visible.
- [ ] MCP-003 Permission policy is visible and auditable.
- [ ] MCP-004 MCP health/latency/errors are visible.
- [ ] MCP-005 Tool usage/cost is correlated with task/agent.
- [ ] MCP-006 Unsafe/unauthorized tool calls are denied and audited.

## Evidence → revenue lineage — 0/8

- [ ] REV-001 Evidence can be linked to a problem.
- [ ] REV-002 Problem can be linked to an opportunity.
- [ ] REV-003 Opportunity can be linked to a decision.
- [ ] REV-004 Decision can create an action/task.
- [ ] REV-005 Action result is persisted.
- [ ] REV-006 Revenue outcome is persisted.
- [ ] REV-007 Revenue can be traced back to opportunity/evidence.
- [ ] REV-008 CEO can inspect the complete chain from one screen.

## How to update coverage

When implementing a feature:

1. Add the requirement to `docs/AI-OS-REQUIREMENTS.md`.
2. Add one or more acceptance cases here.
3. Change `[ ]` to `[x]` only when the behavior exists in the repository.
4. Update the summary numbers.
5. If a requirement is intentionally deferred, leave it pending and explain why in the requirements document.
