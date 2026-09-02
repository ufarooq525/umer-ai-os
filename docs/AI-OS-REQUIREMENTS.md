# Umer AI OS — Living Requirements

> This is the source-of-truth planning document for the AI OS. Every meaningful feature must update this file and add/adjust test cases before it is considered complete.

## Product objective

Build a company-like autonomous AI operating system where the CEO can understand, control, audit, and improve the entire workforce without asking an engineer or an agent what happened.

## Core operating chain

```text
CEO Objective
  → Project
  → Plan
  → Task
  → Agent
  → Tool Call
  → Evidence
  → Problem
  → Opportunity
  → Decision
  → Action
  → Result
  → Revenue
```

Every link should be persisted where technically available and explainable to the CEO.

## Non-negotiable principles

1. **CEO visibility:** current state, ownership, next action, blockers, errors, cost, and outcomes must be inspectable.
2. **Durable state:** important work cannot exist only in process memory or UI fixtures.
3. **Traceability:** tasks, agents, runs, evidence, decisions, and outcomes should be correlatable.
4. **Explainability:** important decisions and task creation must record a structured `why` context.
5. **Economics:** token usage, tool usage, estimated cost, cache usage, and evaluation quality must be observable.
6. **Recoverability:** abandoned work must be recoverable through leases/retry policy.
7. **Searchability:** the CEO must be able to find entities and follow their relationships.
8. **Testability:** each feature has explicit acceptance tests with a measurable coverage count.
9. **MySQL first:** durable operational state uses the project's MySQL database.
10. **No fake activity:** an agent is not shown as working unless the runtime has actually recorded its work.

## Current implementation status

### Completed

- [x] Persistent AI workforce registry and assignments.
- [x] Workforce event stream and CEO command center.
- [x] Durable kernel task queue in MySQL.
- [x] Atomic task claiming with leases and capability matching.
- [x] Task heartbeat and completion/failure lifecycle.
- [x] Expired lease recovery and retry policy.
- [x] Kernel workflow event persistence.
- [x] Model/tool/evaluation/cost telemetry schema and operations API.
- [x] Structured task `why_json` and entity linkage.
- [x] Task investigation API with attempts/events/model/tool/evaluation/cost/child-task lineage.
- [x] CEO task explorer and task investigation UI.
- [x] Global search across the operational AI OS entities currently stored in MySQL.

### In progress / next

- [ ] Search result deep-links for every entity type.
- [ ] Unified cross-system timeline: workforce + kernel + opportunity run events.
- [ ] Structured `why` metadata for opportunity scoring, decisions, and tool calls.
- [ ] Documentation/Guide generated from registered agents, tools, workflows, and schemas.
- [ ] Evidence → problem → opportunity → decision → action lineage.
- [ ] Revenue/outcome attribution.
- [ ] MCP control center with permissions, health, tool catalog, and usage.
- [ ] CEO controls for pause/resume/retry/reassign/cancel with audit trail.
- [ ] Autonomous worker supervisor. **Explicitly deferred until observability/control is solid.**

## Global search requirements

The search system must search the durable operational state, not just the current page's in-memory data.

### Searchable entities

- Agents
- Tasks
- Projects (when a project table is available)
- Runs / opportunity runs
- Niches
- Businesses
- Opportunities
- Evidence
- Problems
- Outreach drafts
- Workflow events

### Search result contract

Every result should expose:

- `entityType`
- `entityId`
- human-readable title
- short summary
- status where available
- timestamp where available
- searchable context/reason
- enough identity to navigate to the entity detail view

### Search behavior

- Minimum query length: 2 characters.
- Case-insensitive matching.
- Search IDs, titles/names, status, task type, agent, run, business, niche, and event message where applicable.
- Return a bounded result set so one query cannot overload the database.
- Never expose SQL errors as successful search results.
- Search must be read-only.
- Search must use no-store semantics because operational state changes continuously.

## Task lifecycle requirements

```text
QUEUED → RUNNING → COMPLETED
             ├──→ FAILED
             ├──→ WAITING/BLOCKED
             └──→ lease expiry → QUEUED or FAILED
```

A claim must atomically assign the task and create an active lease. Completion must require the valid lease identity. Expired leases must not permanently strand work.

## Observability requirements

For every meaningful operation, the system should eventually answer:

- What happened?
- When did it happen?
- Which agent did it?
- Which task/run/project/objective was involved?
- Which tool/model was used?
- What did it cost?
- What evidence supported it?
- Why was it done?
- What happened next?
- What was the result?

## Definition of done

A feature is not complete until:

1. requirements are documented here;
2. implementation is committed;
3. acceptance tests are added/updated in `docs/AI-OS-TEST-CASES.md`;
4. the coverage count is updated;
5. existing functionality is not silently replaced by fixtures or mock-only behavior;
6. CI/build/test status is checked when available.

## Current test coverage target

See `docs/AI-OS-TEST-CASES.md`. The test inventory is deliberately maintained separately so the CEO can see exactly how many behavioral cases are covered and which remain pending.
