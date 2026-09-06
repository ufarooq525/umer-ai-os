# Autonomy Status

Honest snapshot of how much of the autonomous-company loop
(Market → Opportunity → … → Production → Support → Revenue → Learning →
Market) is real, versus designed-but-not-built. Written from direct
inspection of the code, not from design docs — where a design doc's claims
turned out to be inaccurate, this file says so.

Update this file after every milestone that changes what's real.

## What actually exists today

**Work Package runtime loop (real, tested):**
`Orchestrator` (`packages/orchestration`) drives a Work Package through
`Draft → Queued → Dispatched → Running → AwaitingReview → Accepted/Rejected`.
`OrchestrationWorker` dispatches via the Message Fabric
(`cmd.agent.dispatch`); `AgentWorker` (`packages/agent-runtime`) executes and
publishes `agent.run.started/completed/failed`; `OrchestrationWorker`
subscribes to those same events and drives `markRunning` /
`markAwaitingReview` / `handleAgentFailure` (which retries up to
`DEFAULT_MAX_ATTEMPTS` then leaves the Work Package `Failed`). This is a real,
working, tested loop — not a simulation.

**Runtime → Gate → CEO review loop (real, added by this milestone):**
Until now, a genuinely-dispatched Work Package had no path to CEO visibility:
`agent.run.*` events reached the Agent Run read model
(`/v1/agent-runs`, `/v1/agents`), but `/v1/work-packages` and `/v1/gates`
only ever showed the separate simulated audit-pipeline intakes (see below).
`apps/control-api/src/runtime-work-package-bridge.ts` now subscribes to the
same `evt.runtime.agent.run.>` stream and: (1) projects real Work Package
state into `/v1/work-packages` (status, specialist, artifact, and — on
failure — the real error message), and (2) opens a real Gate review
(`gate-wp-<workPackageId>`) via the existing `ControlPlaneService` when a run
completes. `server.ts`'s `/v1/gates/:id/resolve` route now publishes the
matching `workpackage.accept`/`workpackage.reject` command back to
`cmd.orchestration` for `gate-wp-*` gates, which the existing
`OrchestrationWorker` already handles — closing the loop back to the
authoritative Orchestrator instance. No new event bus, no new contract, no
new abstraction — this only wires existing pieces together.

**Agent Run / Agent Registry observability (real):** `packages/observability`
projects `evt.runtime.agent.>` into an Agent Run read model and an Agent
Registry, both exposed over `/v1/agent-runs` and `/v1/agents`. In-memory only
(see Persistence Gaps below).

**Artifact Runtime (real):** `packages/artifacts`' `ArtifactEngine` seals,
validates, and tracks lineage/supersession for artifacts. Links to a Work
Package chain only via `sourceTaskId` (task) → `projectId`/`workPackageId`
(task) — there is no direct `workPackageId`/`projectId` field on the artifact
contract itself, so CEO navigation from artifact → project has to join
through the Task, when `sourceTaskId` is set (it is, for every handler
inspected).

**CEO Command & Decision Plane (real):** `packages/control-plane`'s
`CeoCommandService` handles `PauseAgent`/`ResumeAgent`/`CancelWork`,
`CreateProject`/`PauseProject`/`ResumeProject`/`CancelProject`,
`CreateTask`/`AssignTask`/`ReassignTask`, and Opportunity
select/reject/create-project — each authorized through `TrustRuntime`,
idempotency-checked, and audited.

**Gate/review mechanics (real, but historically only reachable from one
pipeline):** `ControlPlaneService`'s `GateWaitStore` + `resolveGate` is real
and tested. Before this milestone its only caller was the simulated
audit-pipeline intake system below; genuinely-dispatched Work Packages never
reached it.

**Commercial Intelligence (real, MySQL-backed):** `packages/opportunity-intelligence`
was, before this milestone, the only part of the system with real persistent
storage. The Work Graph (below) is now the second.

**Work Graph (real, tested, MySQL-backed — added by this milestone):**
`packages/orchestration` now has a full Work Graph engine:
`WorkGraph` (nodes/edges, cycle/duplicate/project-mismatch validation,
readiness computation via `blocks`/`requires` precedence edges),
`WorkGraphStore`/`PersistentWorkGraph`/`MySqlWorkGraphStore` (persistence,
same best-effort-MySQL-else-in-memory pattern as `opportunityReader`, backed
by `packages/db`'s `work_graph_nodes`/`work_graph_edges` migration),
`ReadyWorkPackagePlanner` (turns a Ready node with no attached Work Package
into a real, dispatched Work Package — fails closed, never fabricates a
Task id or Specialist), `WorkGraphProjector` (projects real Work Package
lifecycle transitions — `markRunning`/`markAwaitingReview`/`accept`/
`reject`/`fail`/`cancel`/`retry` — back onto the originating graph node,
wired into `OrchestrationWorker`), and `decomposeRequirementIntoWorkGraph`/
`applyRequirementDecomposition` (builds the canonical Requirements → Product
→ {Architecture, UX} → Implementation → {QA, Security} → Release →
Operations graph for a project). `control-api` exposes
`GET /v1/work-graph/:projectId` and `POST /v1/work-graph/:projectId/decompose`;
`apps/web`'s `WorkGraphBoard` renders it on a Project's detail page.

**Known real gap in this same area:** `ReadyWorkPackagePlanner` requires a
real Task id per node (fails closed / skips the node with a reason if none
resolves) — and nothing yet creates a real Task per Work Graph node
automatically. So today, decomposing a project's Requirements produces a
real, persisted, correctly-computed graph, and the planner/projector
machinery is real and fully tested, but actually turning a Ready node into a
dispatched Work Package in a live deployment requires a caller to supply
real Task ids (e.g. via the CEO Command Plane's existing `CreateTask`) —
this wiring is deliberately not faked with synthetic Task ids; see Next
Milestone.

**Command Center UI (real data, not fabricated):** `apps/web`'s
`command-center/page.tsx` fetches every tile from `control-api`'s real
`/v1/*` routes, with `settled()` fallbacks to empty (never fabricated)
values on failure. `deriveAttentionCases` (`apps/web/src/lib/company-derive.ts`)
derives "needs you" cases only from real Agent Run failures, stale
running/task state, and high-scoring undecided opportunities — no synthetic
activity.

## Corrections to prior assumptions

A prior planning document for this repo asserted a Work Graph layer
(`work_graph_nodes`/`work_graph_edges` MySQL tables, a `PersistentWorkGraph`,
a `ReadyWorkPackagePlanner`, and a `WorkGraphBoard` UI component) was already
implemented, as of 2026-09-05. At that time **none of it existed** — there
was no `work-graph.ts` anywhere, no such MySQL tables, no planner, no board
component. As of the 2026-09-06 milestone below, all of it now genuinely
exists (contracts, engine, persistence, planner, projector, decomposition,
API, UI) — this correction is kept here as the historical record of the
gap between that planning document and the codebase at the time it was
written, not as a claim about current state (see "Work Graph" above for
that).

A second, separate "audit-pipeline intake" system (`packages/registry`'s
`planIntakeForControl` + `apply*ToProject`/`apply*OnGatePass` functions,
wired in `apps/control-api/src/state.ts`) simulates a Work Package/Gate flow
for eng/qa/security/perf/ux/seo intakes entirely in a local
`WorkPackageSummary[]` array, with fabricated `execId`s (e.g. `EXEC-9200`)
and `workPackageId`s — it never touches the real `@umer/orchestration`
Orchestrator or dispatches a real Agent. It is a legitimate, separate,
already-real system for auditing existing client projects, not a stand-in
for the generic runtime loop above. The two systems are intentionally
distinct; this file exists partly to keep that distinction from being
confused with the Work Graph gap above.

**Fabrication bug fixed by this milestone:** `control-api`'s
`bootstrapDemoState()` unconditionally seeded a hardcoded fake Work Package
(`wp-e2e-1`), a fake Gate (`gate-dev-qa`), and fake audit entries into every
boot of `control-api`, including production — meaning a fresh deployment's
CEO Command Center showed a fabricated "1 awaiting review" / pending gate as
real company activity. `apps/control-api/src/main.ts` now only seeds this
when `CONTROL_API_SEED_DEMO=true` is explicitly set (for local demos of the
intake→gate flow). Tests that need the seed call `bootstrapDemoState()`
directly and are unaffected.

## Persistence gaps (self-documented, not new)

Only Opportunity Intelligence has real database persistence (MySQL). Agent
Run read model, Agent Registry, Work Package store (`state.workPackages`),
Task store, Project store, Artifact store, and Gate Wait store are all
in-memory — every one of them resets on restart. No Postgres schema exists
anywhere despite `implementation/MONOREPO_BLUEPRINT.md`'s original design
assuming Postgres as the primary store. This means the "Runtime Truth Loop"
closed by this milestone is real for the lifetime of one `control-api`
process, but not yet durable — a restart loses every open gate and Work
Package summary (Message Fabric replay would eventually reconstruct the
Agent Run read model from JetStream retention if configured for it, but not
the local `state.workPackages` array or Gate Wait store, which are pure
in-memory `Map`s).

## Phase progress (revised from prior estimates)

| Phase | 2026-09-05 estimate | Revised 2026-09-06 | Why revised |
|---|---:|---:|---|
| V1 Foundation | 100% | 100% | Confirmed. |
| Phase 1 — Commercial Engine | ~35% | ~35% | Not re-audited this pass; no evidence to revise. |
| Phase 2 — Requirements Intake | ~10% | ~20% | `decomposeRequirementIntoWorkGraph` now turns a project into a real, persisted Requirements→...→Operations graph. Still missing: a `RequestContract`-driven trigger that calls it automatically from the existing `/v1/intake` flow (today it's a standalone route, `POST /v1/work-graph/:projectId/decompose`, called on demand). |
| Phase 3 — Product & Architecture | ~0% | ~15% | The graph's Architecture/Product/UX nodes are real and correctly gated by real dependency edges (Architecture and UX both required before Implementation is Ready). No specialist yet actually produces a Product/Architecture artifact for these nodes — the graph structure is real, the content-producing work behind each node is not yet connected. |
| Phase 4 — Software Factory | ~30% | ~30% | Not re-audited this pass. |
| Phase 5 — Delivery & Work Graph | ~20% | **~55%** | The Work Graph engine, persistence, planner, and Orchestrator projection are now all real and tested end-to-end (`orchestrator-work-graph.test.ts` proves a node going Ready → InProgress → Review → Accepted, unblocking its dependent). The remaining gap is Task-id resolution for the planner (see "Known real gap" above) and a CEO-facing trigger for planning (there's no `/v1/work-graph/:projectId/plan` route yet — the planner is a tested library primitive, not yet wired to an HTTP/command entry point). |
| Phase 6 — Autonomous Operations | ~7% | ~10% | `WorkGraphProjector` makes Work Package status changes visible on the graph automatically, with zero manual bookkeeping — a real (if small) step toward routine work needing no human attention to track. |
| Phase 7 — Autonomous Company | ~10% | ~10% | Not re-audited this pass. |

## This milestone (2026-09-06)

Built the Work Graph layer end-to-end, real and tested at every layer:

- **Contracts** (`packages/contracts/src/work-graph`): `WorkGraphNodeContract`
  (10 node types: Project/Requirements/Product/Architecture/UX/
  Implementation/QA/Security/Release/Operations; 8 statuses: Planned/Ready/
  Blocked/InProgress/Review/Accepted/Failed/Cancelled) and
  `WorkGraphEdgeContract` (`blocks`/`requires`).
- **Engine** (`packages/orchestration/src/work-graph.ts`): `WorkGraph` class —
  duplicate node/edge rejection, cross-project edge rejection, cycle
  detection (direct, transitive, and mixed blocks/requires), and
  `recomputeReadiness` (a node is Ready only once every real precedence
  predecessor is Accepted).
- **Persistence** (`work-graph-store.ts`, `work-graph-mysql-store.ts`,
  `packages/db/src/work-graph-migration.ts`): `InMemoryWorkGraphStore` +
  `MySqlWorkGraphStore` (new `work_graph_nodes`/`work_graph_edges` tables) +
  `PersistentWorkGraph` (loads a project's graph, persists only what a
  mutation actually changed, including cascaded readiness flips).
- **Planner** (`ready-work-package-planner.ts`): turns each Ready,
  unattached node into a real `WorkPackageContract`, queues + dispatches it
  through the real `Orchestrator`, attaches the resulting `workPackageId`
  back onto the node. Fails closed on missing execId/contextHandle/
  correlationId; skips (with a reason, not a fabricated value) any node
  whose Task ids or Specialist can't be resolved.
- **Projector** (`work-graph-projector.ts`, wired into `OrchestrationWorker`):
  every real `markRunning`/`markAwaitingReview`/`accept`/`reject`/`fail`/
  `retry`/`cancel` now updates the originating graph node automatically — a
  Work Package with no originating node (e.g. the separate audit-pipeline
  system) is a no-op, never an error.
- **Requirements decomposition** (`requirements-decomposition.ts`): builds
  the canonical pipeline graph for a project; Architecture and UX gate
  Implementation together, QA and Security gate Release together.
- **API/UI**: `control-api` exposes `GET /v1/work-graph/:projectId` and
  `POST /v1/work-graph/:projectId/decompose`; `apps/web`'s new
  `WorkGraphBoard` component renders it on `/company/projects/:id`, with an
  honest "No Work Graph recorded yet" empty state — wired into
  `apps/orchestration-worker` (owns the live `WorkGraphProjector`) and
  `apps/control-api` (owns reads/decompose), both best-effort-connected to
  the same MySQL tables so they see the same graph.
- **Tests**: 72 tests total in `packages/orchestration` (up from 38),
  covering the engine, persistence, planner, MySQL row-mapping, and a full
  end-to-end Work Graph ↔ Orchestrator integration test
  (`orchestrator-work-graph.test.ts`).

## Next highest-value milestone

**Wire real Task creation into the planning path.** The planner is fully
real and tested but will skip every node in a live deployment until
something creates a real Task per node — the honest, non-fabricating fix is
to have the decomposition (or a first planning pass) call the CEO Command
Plane's existing `CreateTask` handler per node before resolving task
context, rather than inventing a Task id. Alongside that: a
`POST /v1/work-graph/:projectId/plan` route/command so a CEO (or, once
proven safe, an automatic trigger) can actually invoke
`ReadyWorkPackagePlanner` against the real graph — today it's a tested
library primitive with no HTTP/command entry point.

After that, unchanged from the prior milestone: **persist the Runtime
Truth** for the stores that are still in-memory (Work Package summaries,
Gate Wait records, Agent Run read model, Agent Registry, Task/Project
stores) — the Work Graph is now the second MySQL-backed domain after
Opportunity Intelligence, but everything else listed here still resets on
restart.
