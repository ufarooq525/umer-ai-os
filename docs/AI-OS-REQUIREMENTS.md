# Umer AI OS — Living Requirements

> Source of truth for the AI OS. The current 71-case product acceptance milestone is implemented. Automated execution remains a follow-up where the repository harness does not exercise live MySQL behavior.

## Product objective
Build a company-like autonomous AI operating system where the CEO can understand, control, audit, and improve the entire workforce without asking an engineer or an agent what happened.

## Core operating chain
```text
CEO Objective → Project → Plan → Task → Agent → Tool Call → Evidence → Problem → Opportunity → Decision → Action → Result → Revenue
```

## Current implementation status

### Workforce & kernel
- [x] Persistent 8-agent workforce registry, assignments and events.
- [x] Durable MySQL task queue with atomic `SKIP LOCKED` claiming.
- [x] Capability matching, leases, heartbeats, completion/failure and recovery.
- [x] Structured task `why_json` and objective/project/run/entity linkage.
- [x] Task investigation with attempts, events, model/tool/evaluation/cost and child-task lineage.

### CEO visibility
- [x] Mission Control workforce command center.
- [x] 24h token/cache/tool/evaluation/cost economics.
- [x] Global operational search across agents, tasks, runs, niches, businesses, opportunities, evidence, problems, outreach and events.
- [x] Unified cross-system timeline for workforce + kernel + opportunity-run events.
- [x] Timeline agent/run/entity/text filters and correlation identifiers.
- [x] Entity investigation route for every searchable entity type.
- [x] Guide route for system documentation.

### CEO controls
- [x] Pause agent.
- [x] Resume agent.
- [x] Retry failed/blocked/waiting/cancelled task.
- [x] Reassign task to an available agent.
- [x] Safely cancel active task and release its lease.
- [x] Append-only control audit records with before/after state and reason.
- [x] Paused agents are prevented from claiming new kernel work.

### MCP control plane
- [x] Registered MCP server inventory and health/trust visibility.
- [x] MCP tool catalog, risk/read-only/approval metadata and enablement state.
- [x] Permission policy visibility.
- [x] 24h tool usage, failures, cache hits, latency and estimated cost.
- [x] Default-deny authorization for agent tool calls.
- [x] Hourly call limits and approval-required denial.
- [x] Denied calls are recorded in tool telemetry, control audit and workflow timeline.

### Evidence → revenue lineage
- [x] Durable generic lineage edges with relation, confidence, metadata and structured why.
- [x] Existing opportunity/problem/business/evidence relationships are materialized into the lineage graph.
- [x] Opportunity scoring is represented as an explainable decision edge using persisted score data.
- [x] Generic decision/action/result relationships can be persisted.
- [x] Business outcomes and revenue amounts/currencies are persisted.
- [x] Revenue can be traced through lineage to opportunity/evidence.
- [x] Investigation UI exposes lineage, outcomes and AI tracked cost.
- [x] Investigation API calculates revenue-to-AI-cost ROI when both are recorded.

## API surfaces
- `GET /api/workforce`
- `GET /api/kernel`
- `GET /api/kernel/operations`
- `GET /api/kernel/tasks/{taskId}`
- `GET /api/search?q=...`
- `GET /api/timeline?...`
- `GET/POST /api/control`
- `GET/POST /api/mcp`
- `GET/POST /api/lineage`

## Safety and operating rules
- Search is read-only, bounded and no-store.
- Timeline never invents missing correlation identifiers.
- CEO controls validate state transitions and audit before/after state.
- Paused agents cannot claim new kernel work.
- MCP authorization is default-deny and denied calls are audited.
- Lineage uses a flexible graph because opportunity relationships are stored partly in JSON arrays.
- No fake agent activity is introduced merely to make the dashboard look busy.

## Remaining full-vision work
The defined 71-case milestone is complete. A larger future milestone remains intentionally separate: a continuously running worker supervisor that autonomously schedules and executes queued work without a human-triggered worker. This is not counted as a failure of the current milestone; it is the next architectural stage after production verification of observability and controls.

## Definition of done
1. Requirement documented.
2. Implementation committed.
3. Acceptance case updated.
4. Coverage count updated.
5. No fake runtime activity introduced.
6. CI/build/test status checked before declaring a release healthy.
