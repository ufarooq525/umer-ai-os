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

**Planning trigger (real, added by the second 2026-09-06 milestone):**
`ReadyWorkPackagePlanner` now has a real, end-to-end invocation path.
`POST /v1/work-graph/:projectId/plan` (requires `{approver}` — a human stays
accountable for triggering it) creates a real `Task` per Ready node via the
CEO Command Plane's existing `CreateTask` handler (no synthetic Task ids),
mints an execution context, and publishes a new `workgraph.plan` command to
`cmd.orchestration`. `OrchestrationWorker` (running in
`apps/orchestration-worker`, which owns the real `Orchestrator`) handles it
by constructing a `ReadyWorkPackagePlanner` with those real Task ids and a
`resolveSpecialist` that maps **only** `Implementation` → `eng.app-delivery`
— the one Specialist `apps/agent-worker` actually registers for dispatch
today (its `specVersion`/`specHash` are read from the same
`specialists/engineering/application-delivery.md` file agent-worker loads,
not invented). Every other node type correctly has no Specialist mapped, so
the planner skips it (reported, not fabricated). The result
(`created`/`skipped`) is published as a new `evt.runtime.workgraph.planned`
event — genuinely eventually-consistent across the `control-api` ↔
`orchestration-worker` process boundary, not a synchronous HTTP response —
and surfaces in a follow-up `GET /v1/work-graph/:projectId`'s
`lastPlanResult`.

**Known real gap that remains:** only `Implementation` nodes can currently
be planned into a real, executable Work Package, because `eng.app-delivery`
is the only Specialist `apps/agent-worker` actually loads for dispatch (see
its `main.ts` — `specPaths` lists only `eng.app-delivery` and
`growth.opportunity-research`, and the latter doesn't fit this pipeline).
Requirements/Product/Architecture/UX/QA/Security/Release/Operations nodes
will report `skipped: "no active Specialist resolved for node type X"`
until more Specialists are wired into a running agent-worker's dispatch
list — deliberately not faked with a Specialist id nothing can execute.

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

## Persistence gaps (updated 2026-09-06, fourth pass)

Now MySQL-backed, best-effort (same fail-open pattern throughout — falls
back to in-memory and logs a warning if MySQL is unreachable, never crashes
the process): Opportunity Intelligence, the Work Graph
(`work_graph_nodes`/`work_graph_edges`), the **Orchestrator's own Work
Package store** (`orchestration_work_packages` — the authoritative record
of every Work Package ever queued/dispatched/run, in `apps/orchestration-worker`),
and the **Gate Wait store** (`control_plane_gate_waits` — the CEO's actual
"needs your attention" review queue, in `apps/control-api`). These were
picked first because losing them on restart is the most damaging: an
in-flight Work Package (attempt count, timeout tracking, "Running" status
itself) or a pending Gate silently vanishing is a CEO losing track of real
work or a real decision that was waiting on them.

Still in-memory, still reset on restart: the Agent Run read model, Agent
Registry, `state.workPackages` (control-api's own read-projection summary —
distinct from the Orchestrator's now-durable store above), Task store,
Project store, and Artifact store. No Postgres schema exists anywhere
despite `implementation/MONOREPO_BLUEPRINT.md`'s original design assuming
Postgres as the primary store.

## Phase progress (revised from prior estimates)

| Phase | 2026-09-05 estimate | Revised 2026-09-06 | Why revised |
|---|---:|---:|---|
| V1 Foundation | 100% | 100% | Confirmed. |
| Phase 1 — Commercial Engine | ~35% | ~35% | Not re-audited this pass; no evidence to revise. |
| Phase 2 — Requirements Intake | ~10% | ~20% | `decomposeRequirementIntoWorkGraph` now turns a project into a real, persisted Requirements→...→Operations graph. Still missing: a `RequestContract`-driven trigger that calls it automatically from the existing `/v1/intake` flow (today it's a standalone route, `POST /v1/work-graph/:projectId/decompose`, called on demand). |
| Phase 3 — Product & Architecture | ~0% | ~15% | The graph's Architecture/Product/UX nodes are real and correctly gated by real dependency edges (Architecture and UX both required before Implementation is Ready). No specialist yet actually produces a Product/Architecture artifact for these nodes — the graph structure is real, the content-producing work behind each node is not yet connected. |
| Phase 4 — Software Factory | ~30% | **~15%** | Confirmed by reading the actual handler code (not just its mandate doc) that `eng.app-delivery` — the one Engineering specialist wired for real dispatch — produces zero real code today: `runEngineeringApplicationDelivery` never scoped, diffed, or applied anything (see the fabrication fix below); `WorkPackageContractSchema` has no field to carry a change-set even if one existed. The 30% figure was based on the mandate's prose, not verified against the code behind it. |
| Phase 5 — Delivery & Work Graph | ~20% | **~65%** | The Work Graph engine, persistence, planner, projector, AND a real CEO-triggered planning path (`POST /v1/work-graph/:projectId/plan`, real Task creation, real dispatch) are all built, wired cross-process, and tested end-to-end. The remaining gap is breadth, not plumbing: only `Implementation` nodes map to a Specialist agent-worker can actually execute, and that Specialist itself does no real code work yet (see Phase 4). |
| Phase 6 — Autonomous Operations | ~7% | ~12% | `WorkGraphProjector` makes Work Package status changes visible on the graph automatically. The plan route still requires a named human `approver` per invocation — genuinely CEO-triggered, not yet autonomous — which is the correct conservative default until this path has a track record. |
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

## This milestone (2026-09-06, continued)

Closed the last real gap flagged in the prior milestone — the planner now
has a genuine, invokable end-to-end path, not just tested library code:

- **New command**: `ORCHESTRATION_COMMANDS.PLAN_PROJECT` (`workgraph.plan`)
  on `cmd.orchestration`, handled by `OrchestrationWorker` — constructs a
  `ReadyWorkPackagePlanner` per invocation from the command's real Task ids,
  runs it, and publishes the result as a new `evt.runtime.workgraph.planned`
  event (added to `RuntimeEventNameSchema`).
- **Real Specialist resolution**: `apps/orchestration-worker` now loads
  `specialists/engineering/application-delivery.md` via
  `@umer/specialist-sdk`'s `loadSpecFromFile` at boot — the same file
  `apps/agent-worker` loads — so the `specVersion`/`specHash` on any Work
  Package it plans are real, current, and match what would actually execute
  it. Only `Implementation` nodes get a Specialist; every other node type
  correctly resolves to nothing and gets skipped.
- **Real Task creation**: `POST /v1/work-graph/:projectId/plan` (control-api)
  requires a human `approver`, creates one real `Task` per Ready node via
  the CEO Command Plane's `CreateTask` handler (audited, trust-authorized,
  same write path as every other Task in this system), mints an execution
  context, and publishes the plan command.
- **Cross-process result visibility**: `runtime-work-package-bridge.ts`
  gained a second subscription (`evt.runtime.workgraph.planned`) on the same
  Message Fabric client, recording the latest plan result per project in
  `state.workGraphPlanResults` — surfaced via `GET /v1/work-graph/:projectId`'s
  new `lastPlanResult` field.
- **Tests**: `worker-plan.test.ts` (4 cases: rejects without planning
  configured, plans a real Implementation node with real task ids, skips a
  node with no task ids, never fabricates a Specialist for QA), plus control-api
  route tests (`work-graph-plan-route.test.ts`, 4 cases) and bridge
  projection tests (3 new cases in `runtime-work-package-bridge.test.ts`).
  `packages/orchestration` is now at 81 tests (up from 77); `control-api` at
  115 (up from 108).

## Critical fabrication bug found and fixed (2026-09-06, third pass)

While investigating "register more Specialists" (the milestone named below
in the prior version of this file), inspecting the REAL handler code behind
`eng.app-delivery` — not just its `.md` mandate — turned up a serious,
pre-existing fabrication: `runEngineeringApplicationDelivery`
(`packages/agent-runtime/src/handlers/engineering.ts`) unconditionally
marked every task's acceptance criterion `VERIFIED` with an `evidenceRef`
of `mem://runs/<workPackageId>` — a URI nothing in the codebase ever writes
to — regardless of whether any real work happened. `WorkPackageContractSchema`
has no change-set/target-files field at all, so this handler could never
have actually scoped, diffed, or applied anything; it was a placeholder from
milestone M6 that fabricated a "verified, completed delivery" for work that
never occurred. The exact same pattern existed in `runLlmAgent`
(`handlers/llm-agent.ts`), used by every other specialist — an LLM
self-reporting its own run as `VERIFIED` evidence, with the same
unresolvable `mem://runs/` reference.

**Why this matters more than an ordinary bug**: this session's Work Graph +
planner + plan-trigger milestones are the first thing that makes
`eng.app-delivery` genuinely, repeatedly reachable from a CEO-initiated
action — before this, almost nothing in the codebase dispatched real Work
Packages through it. Shipping the planning trigger without this fix would
have meant every CEO-triggered "plan" could produce a Gate showing "delivery
completed, criteria verified" for a task where literally zero code was
written or checked.

**Fix**: both handlers now report `N_A` (not independently verified) with
no evidence reference, and `eng.app-delivery`'s summary says "needs manual
scoping" instead of "completed" — matching what its own mandate says should
happen for a missing change-set. `ArtifactEngine.seal()` still moves the
artifact to `acceptanceStatus: 'submitted'` (unchanged, and correct — a
Gate should still open so a human can see the honest "nothing to review yet"
state), but no criterion claims verification that didn't happen. Confirmed
no other code decides anything based on `VERIFIED` specifically (it's
schema-validated, not used for auto-approval anywhere) — nothing else broke.
4 new tests in `engineering.test.ts`, 1 new assertion in `llm-agent.test.ts`;
`packages/agent-runtime` is at 35 tests.

## Corrected understanding: what "register more Specialists" actually requires

The other specialist mandates (`qa.verify`, `security.review`, `ux.design`,
`pm.intake`) all declare a Context Contract requiring `project_id, goal,
absolute_path, acceptance_criteria` — `absolute_path` being a real
filesystem path to a **registered catalog codebase**
(`projects/catalog.json`, owned by `@umer/registry`), the same system the
separate audit-pipeline intake flow operates on. A generic Work Graph
Project (`ProjectContract`) is a different notion of "project" and is not
guaranteed to have one (it MAY reference one via `registryProjectId` — see
the doc comment on `ProjectContractSchema`). Wiring these specialists into
`ReadyWorkPackagePlanner` today, for a Work Graph project with no such link,
would force a choice between skipping the node (correct, but no better than
today) or inventing an `absolute_path` / letting an LLM run ungrounded
(fabrication of exactly the kind this file exists to catch) — so this
milestone did not do either. There is also nowhere on
`WorkPackageContractSchema` to carry a resolved `absolute_path` even if one
existed, and `orchestration-worker` (where `resolveSpecialist` runs) has no
access to `@umer/registry`'s catalog or the Work Management `ProjectStore`
today — both live only in `control-api`'s process. Registering more
Specialists for real, grounded Work Graph dispatch is real work spanning a
contract change and cross-process context threading, not a quick
`specPaths` edit — scope it as its own milestone rather than rushing it.

## This milestone (2026-09-06, fourth pass): persist the Runtime Truth

Took the "persist the Runtime Truth" option from the prior milestone's two
choices — picked over threading registered-project context into planning
because it's real, bounded, safe (no fabrication surface at all — it's pure
plumbing), and closes the most damaging class of data loss first.

- **New migrations** (`packages/db`): `control_plane_gate_waits`
  (gate-wait-migration.ts) and `orchestration_work_packages`
  (work-package-migration.ts), both registered in `ALL_MYSQL_MIGRATIONS`.
- **`MySqlGateWaitStore`** (`packages/control-plane/src/mysql-store.ts`):
  implements the existing `GateWaitStore` interface — no changes to
  `ControlPlaneService` itself. Wired via new
  `apps/control-api/src/gate-store-link.ts` (best-effort MySQL, same
  fail-open pattern as `work-graph-link.ts`/`opportunity-link.ts`) — since
  `ControlPlaneService` has no store setter, this reconstructs the service
  around the resolved store at boot, before the server starts listening.
- **`MySqlWorkPackageStore`** (`packages/orchestration/src/work-package-mysql-store.ts`):
  implements the existing `WorkPackageStore` interface. `createOrchestrator`'s
  `store` option was previously typed as the concrete `InMemoryWorkPackageStore`
  class rather than the `WorkPackageStore` interface — widened so any real
  implementation can be passed in. Wired in `apps/orchestration-worker/src/main.ts`,
  same fail-open pattern.
- **Tests**: `mysql-store.test.ts` in `packages/control-plane` (5 cases:
  row-mapping both when the driver returns JSON columns as strings and
  as already-parsed arrays, missing-row, upsert column values, the
  `listPending` query shape) and `work-package-mysql-store.test.ts` in
  `packages/orchestration` (5 equivalent cases). No dedicated test for
  the two `*-link.ts` boot connectors — matches the codebase's own existing
  convention for `work-graph-link.ts`/`opportunity-link.ts`.
- Neither `*-link.ts` file has a test because — consistent with the existing
  pattern — the connector itself is a thin `pingMySql()` + construct call;
  the real logic lives in, and is tested via, the MySQL store classes above.

`packages/control-plane` is now at 38 tests (was 33); `packages/orchestration`
is now at 86 tests (was 81) — the `factory.ts` store-type widening is
covered by its existing tests unchanged.

## Next highest-value milestone

**Thread real registered-project context into planning**, so
`qa.verify`/`security.review`/`ux.design` can be safely wired for the (real,
legitimate) case where a Work Graph Project's `registryProjectId` points at
an actual catalog codebase — skipping cleanly, as today, when it doesn't.
Needs: a `WorkPackageContract` field (or a resolvable `contextHandle`) to
actually carry `absolute_path`/target scope, and `orchestration-worker`
gaining read access to `@umer/registry`'s catalog (or control-api resolving
it and passing it through the `workgraph.plan` command, the same pattern
already used for real Task ids).

After that: the remaining in-memory stores (Agent Run read model, Agent
Registry, `state.workPackages`, Task store, Project store, Artifact store)
are still real, bounded, low-risk persistence work in the same shape as this
milestone — just not yet the highest-value slice.
