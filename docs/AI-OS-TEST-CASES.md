# Umer AI OS — Test Case Inventory

This file is the living acceptance-test register.

## Coverage summary

| Area | Covered | Pending | Total |
|---|---:|---:|---:|
| Workforce visibility | 8 | 0 | 8 |
| Kernel task lifecycle | 10 | 0 | 10 |
| Explainability & lineage | 7 | 0 | 7 |
| Economics & telemetry | 7 | 0 | 7 |
| Global search | 14 | 0 | 14 |
| CEO controls | 6 | 0 | 6 |
| Cross-system timeline | 5 | 0 | 5 |
| MCP control center | 6 | 0 | 6 |
| Evidence → revenue lineage | 8 | 0 | 8 |
| Worker supervisor | 5 | 0 | 5 |
| **Total** | **76** | **0** | **76** |

> **76/76 acceptance cases are implemented.** This is product acceptance coverage, not a claim that 76 CI tests have executed against a live database. Automated/live integration testing and production verification remain separate validation work.

## Worker supervisor — 5/5
- [x] SUP-001 Worker heartbeat records durable worker/agent status.
- [x] SUP-002 Heartbeat records expose queue depth and active lease count.
- [x] SUP-003 Supervisor detects workers whose heartbeat exceeds the configured timeout.
- [x] SUP-004 Supervisor reconciles expired task leases using the kernel retry policy.
- [x] SUP-005 Mission Control exposes worker health, stale workers and supervisor events.

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

## Explainability & lineage — 7/7
- [x] EXP-001 Task detail exposes the why payload.
- [x] EXP-002 Task detail exposes objective/project/run/parent/agent/capability/entity chain.
- [x] EXP-003 Task detail exposes attempts and workflow events.
- [x] EXP-004 Task detail exposes model/tool/evaluation/cost records.
- [x] EXP-005 Child tasks are discoverable from the parent task.
- [x] EXP-006 CEO can open task investigation from Task Explorer.
- [x] EXP-007 Opportunity scoring is represented as an explainable decision lineage edge.

## Economics & telemetry — 7/7
- [x] ECO-001 24h model input/output tokens are visible.
- [x] ECO-002 Cached-token count and cache rate are visible.
- [x] ECO-003 Tool calls/failures/cache rate are visible.
- [x] ECO-004 Model/tool tracked cost is visible.
- [x] ECO-005 Evaluation count/score/confidence is visible.
- [x] ECO-006 Task/tool/model/cost records can be inspected from task detail.
- [x] ECO-007 Revenue attribution can be compared against tracked AI spend through lineage ROI data.

## Global search — 14/14
- [x] SRCH-001 Query shorter than 2 characters returns an empty result set.
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
- [x] SRCH-013 Every result type has an investigation URL shape backed by the dynamic entity investigation page.
- [x] SRCH-014 Exact entity IDs and title matches are ranked ahead of broad text matches.

## CEO controls — 6/6
- [x] CTRL-001 Pause an agent.
- [x] CTRL-002 Resume an agent.
- [x] CTRL-003 Retry a failed/blocked/waiting/cancelled task.
- [x] CTRL-004 Reassign a task to an available agent.
- [x] CTRL-005 Cancel a task safely and release an active lease.
- [x] CTRL-006 Every control action creates a before/after audit event and workflow event.

## Cross-system timeline — 5/5
- [x] TL-001 Workforce events and kernel events appear in one chronological stream.
- [x] TL-002 Opportunity run events join the same stream.
- [x] TL-003 Timeline can be filtered by agent.
- [x] TL-004 Timeline can be filtered by run/project/entity type/entity ID and searched by text.
- [x] TL-005 Timeline preserves correlation IDs without fabricating missing identifiers.

## MCP control center — 6/6
- [x] MCP-001 Registered MCP servers are visible.
- [x] MCP-002 Tool catalog and capabilities are visible.
- [x] MCP-003 Permission policy is visible and auditable.
- [x] MCP-004 MCP health/latency/errors are visible.
- [x] MCP-005 Tool usage/cost is correlated with task/agent in durable telemetry.
- [x] MCP-006 Unsafe/unauthorized tool calls are denied and audited.

## Evidence → revenue lineage — 8/8
- [x] REV-001 Evidence can be linked to a problem through durable lineage edges.
- [x] REV-002 Problem can be linked to an opportunity through durable lineage edges.
- [x] REV-003 Opportunity can be linked to a decision through durable lineage edges.
- [x] REV-004 Decision can create an action/task through durable lineage edges.
- [x] REV-005 Action result can be persisted as a business outcome.
- [x] REV-006 Revenue outcome can be persisted with amount/currency.
- [x] REV-007 Revenue can be traced through lineage to opportunity/evidence.
- [x] REV-008 CEO can inspect lineage, outcomes and AI spend from the investigation surface.

## Validation note
Acceptance coverage and automated test execution are intentionally separate. Before production release, run the MySQL migrations and exercise the API/UI paths against the configured database, then verify CI. No case is called an automated test merely because the code path exists.
