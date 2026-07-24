# Workflow Engine Implementation Plan

Part of `Runtime/WorkflowEngine/WORKFLOW_ARCHITECTURE.md`. **No code in this
plan** — sequencing only. Coordinates with `Runtime/EventBus/IMPLEMENTATION_PLAN.md`
(Event Bus phases should land far enough for timers, signals, and specialist
completion events before Workflow cutover).

## 0. Ground rules

- One engine under Orchestration Runtime — extend `packages/orchestration`, do
  not create a rival orchestrator package without an explicit ADR.
- Execution semantics docs remain SoR for *what* stages mean; Runtime templates
  encode them.
- History append precedes side effects; projections are rebuildable.
- Keep current WP state machine and Control API gate path working until dual-run
  proves parity.
- `pnpm build && pnpm typecheck && pnpm test` green every phase.

## Phase 1 — Contracts & template schema

**Where:** `packages/contracts`, `Workflows/` (docs), Registry types

- Add schemas: `WorkflowTemplate`, `WorkflowInstance`, `StageActivation`,
  history event union, gate binding, fan-out/join nodes, child-spawn config.
- Publish initial template docs: `canonical.delivery`, `qa.verify.only`,
  `seo.audit.only` (markdown/YAML) matching Execution branch table.
- Contract tests: template validation rules from `WORKFLOW_TEMPLATES.md` §7.

**Exit:** templates validate in CI; no runtime behavior change yet.

## Phase 2 — History store & projections

**Where:** `packages/db`, `packages/orchestration`

- Migrations: `workflow_instances`, `workflow_history`, `workflow_stage_activations`,
  `workflow_checkpoints`.
- `WorkflowHistoryPort` + append/query APIs; projection builder.
- In-memory adapter for unit tests.
- Emit existing `orch.*` events from history publisher (feature-flagged).

**Exit:** can start a *noop* instance that only writes `WorkflowStarted` /
`WorkflowCompleted` and query history.

## Phase 3 — Stage executor (single-path)

**Where:** `packages/orchestration`

- Implement stage state machine from `STAGE_MODEL.md` for `kind: activity` only.
- Entry/exit evaluation (predicate engine shared with Event Bus filters if
  extracted to a tiny shared package — or duplicated carefully with tests).
- Activity dispatch via existing `cmd.agent.dispatch` / WP path.
- Activity + stage retry via Resilience; timeouts via Event Bus Schedule Store
  (`TimerPort`).
- Gate binder: `AwaitingGate` ↔ Control Plane waits (reuse control-api gates).

**Exit:** `qa.verify.only` template runs end-to-end: start → activity → gate →
complete, with full history; dual-run comparable to today’s intake QA path.

## Phase 4 — Control flow

**Where:** `packages/orchestration` Graph Scheduler

- Sequential edges + decision nodes (Research skip reasons logged).
- Fork/join parallel + capacity vs dependency reasons.
- Fan-out / fan-in with concurrency caps.
- Failure edges / `returnTo` (QA → Development).
- Cancellation + compensate hooks for single-path rollback.

**Exit:** `canonical.delivery` happy path + QA reject loop + one parallel
SEO∥Dev scenario under test fixtures.

## Phase 5 — Child & nested workflows

- Child spawn/await/detach; deterministic child workflow ids.
- Nesting depth cap; cascade cancel.
- Template `security.review` as child of delivery fork.
- UI/query: stage tree includes children.

**Exit:** parent blocks on child; child failure triggers declared parent
strategy; history remains split across run ids.

## Phase 6 — Dual-run with Event Bus & cutover

- Instantiator subscribed to `work.feature.requested` / bug events (flagged).
- Control API intake: publish event + optionally `start(template)` ; legacy
  sync path remains until parity report is clean.
- Replace in-process `planIntake` specialist invocation with workflow-driven
  activities (aligned with Event Bus Phase 5–6).
- Compensator + authorized rollback API wired to Failure Recovery / HITL.
- Web: EXEC / correlation view backed by Workflow History queries.

**Exit:** flag default on; no specialist invoked by name outside Activity
Dispatcher; deleting/pausing a template trigger stops new starts.

## Phase 7 — Hardening

- Chaos: kill orchestration-worker mid-stage; verify replay does not double-dispatch.
- Load: fan-out caps + Resource Economy interaction.
- Retention jobs for history tiers.
- ADR: confirm package layout (`packages/orchestration` vs split
  `packages/workflow-engine`) — default stay unified unless size demands split.

## Dependency on Event Bus

| Workflow need | Event Bus phase |
| --- | --- |
| `TimerPort` / delayed retry | Schedule Store (Event Bus Phase 2–3) |
| Specialist completion signals | Subscriptions + `specialist.*.completed` (Phases 4–5) |
| Correlation / parent event ids | Envelope v2 (Phase 1) |
| DLQ for activity transport | Event Bus retry/DLQ (Phase 3) |

If Event Bus lags, Workflow Phase 3 may use Control API signals only for a
narrow QA template — but full canonical delivery waits on bus completions.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Two sources of truth (WP store vs workflow history) | WP remains activity substrate; instance position only in workflow history |
| Template drift from Execution docs | CI check: canonical template stages ⊆ Execution stage set; gate ids ⊆ Approval Gates table |
| Non-deterministic specialist breaks replay | Replay decisions only; record activity results; never re-execute agents on rebuild |
| God-orchestrator package growth | Phase 7 ADR; keep ports clean for extraction |
| Gate auto-timeout Pass | Forbidden in schema + tests |

## Non-deliverables

- No Temporal/Cadence cluster requirement.
- No implementation code in this documentation set.
- No removal of Execution semantic documents.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
