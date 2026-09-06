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

## Persistence gaps (updated 2026-09-06, sixth pass — epic closed)

Every store named in every prior pass of this section is now MySQL-backed,
best-effort (same fail-open pattern throughout — falls back to in-memory and
logs a warning if MySQL is unreachable, never crashes the process):
Opportunity Intelligence, the Work Graph, the Orchestrator's Work Package
store, the Gate Wait store, the Work Management Project/Task stores, and —
closed this pass — the **Agent Run read model + Agent Registry**
(`observability_agent_runs`/`observability_agents`) and the **Artifact
store** (`artifact_runtime_artifacts`).

**A more fundamental bug found and fixed alongside the Artifact store**:
`state.artifactStore` was never populated by anything in production, MySQL
or not. `apps/agent-worker` seals real artifacts into its OWN separate
`ArtifactEngine`/store (a different process, no shared storage), and the
`artifact.sealed` event it already publishes carried only IDs — nothing in
`control-api` ever called `.save()` on `state.artifactStore` outside of
tests. `GET /v1/artifacts` was permanently empty regardless of how much real
work happened, independent of persistence. Fixed in two parts: (1)
`packages/agent-runtime`'s `AgentWorker` now includes the full sealed
`ArtifactContract` on `artifact.sealed` when a real `ArtifactEngine` actually
sealed one (omitted otherwise — verified with a dedicated test for both
cases), and (2) a new `apps/control-api/src/artifact-bridge.ts` (a third
subscription on the same Message Fabric client `runtime-work-package-bridge.ts`
already holds) projects that straight into `state.artifactStore`. This is
the same class of gap Milestone 1 fixed for Work Packages
(`runtime-work-package-bridge.ts`) — found by checking who actually calls
`.save()` on the store, not by trusting that a read endpoint existing meant
data reached it.

Nothing in this system is fake-persisted anymore: every store this file has
ever flagged as in-memory-only is now durable when MySQL is reachable, and
every one of the new adapters was verified against this dev environment's
real, live MySQL instance (`pnpm --filter @umer/db run migrate` applied all
six new migrations cleanly) — not just mocked unit tests. No Postgres schema
exists anywhere despite
`implementation/MONOREPO_BLUEPRINT.md`'s original design assuming
Postgres as the primary store.

## Phase progress (revised from prior estimates)

| Phase | 2026-09-05 estimate | Revised 2026-09-06 (end of session) | Why revised |
|---|---:|---:|---|
| V1 Foundation | 100% | 100% | Confirmed. |
| Phase 1 — Commercial Engine | ~35% | ~35% | Not re-audited this pass; no evidence to revise. |
| Phase 2 — Requirements Intake | ~10% | ~20% | `decomposeRequirementIntoWorkGraph` now turns a project into a real, persisted Requirements→...→Operations graph. Still missing: a `RequestContract`-driven trigger that calls it automatically from the existing `/v1/intake` flow (today it's a standalone route, `POST /v1/work-graph/:projectId/decompose`, called on demand). |
| Phase 3 — Product & Architecture | ~0% | **~26%** | The graph's Architecture/Product/UX/QA nodes are real and correctly gated by real dependency edges. `ux.design` and `qa.verify` can genuinely execute against a real registered codebase's files, and — new this pass — can seal real findings to disk under their own sandboxed `.umer/<slug>/` evidence subtree rather than only returning a summary string. Product/Architecture themselves still have no dispatchable Specialist at all. |
| Phase 4 — Software Factory | ~30% | ~15% | Unchanged: `eng.app-delivery` still produces zero real code (no change-set field exists on the contract for it to act on). This phase is specifically Engineering delivery, not UX/QA — the `targetPath`/tool-sandboxing work benefits Phase 3/6, not this one directly. |
| Phase 5 — Delivery & Work Graph | ~20% | **~70%** | Unchanged this pass — `filesystem_write` needed no new orchestration/planner wiring at all (it derives its sandbox from `specialistId`, already present on every tool context), which is itself further evidence the mechanism/policy split holds. |
| Phase 6 — Autonomous Operations | ~7% | **~20%** | `ux.design` and `qa.verify` can now seal real evidence files, closing the gap between what their mandates promise ("seal findings under `.umer/ux/`" / "`.umer/qa/`") and what the code actually does — still no end-to-end run has exercised this against a live LLM provider (only unit-tested in isolation), and `process_recommend` still never executes anything itself. The plan route still requires a named human `approver` per invocation, which remains correct. |
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

## This milestone (2026-09-06, fifth pass): Project/Task persistence + a real closure bug

Continued "persist the Runtime Truth" rather than the registered-project
context option — deliberately, after actually investigating that option
first: it turned out to require new sandboxed filesystem/process-execution
tools for `qa.verify`/`security.review`/`ux.design` that don't exist yet
(their tool permission sets — `filesystem.read`, `process.run.audit_allowlist`,
etc. — have no implementation in `apps/agent-worker`'s tool registry, which
today only has `search_web`). Wiring those specialists for dispatch without
real tools would mean an LLM generating "findings" about a codebase it never
actually read — exactly the fabrication class this file exists to catch.
That work is real but belongs in its own carefully-scoped, security-reviewed
milestone, not rushed as a side effect of this one.

- **New migration** (`packages/db/src/work-management-migration.ts`):
  `work_management_projects` and `work_management_tasks`.
- **`MySqlProjectStore`/`MySqlTaskStore`** (`apps/control-api`): implement
  the existing `ProjectStore`/`TaskStore` interfaces. Live in `apps/control-api`
  itself (not a shared package) because that's where the interfaces are
  already defined and owned.
- **Closure bug found and fixed**: `state.commandService`'s `projects`/`tasks`
  ports captured the store instances by value at construction time — see the
  Persistence gaps section above for the full explanation of the split-brain
  bug this would have caused the moment the MySQL swap landed. Fixed before
  wiring the swap, not after.
- **Tests**: `project-store-mysql.test.ts` (6 cases), `task-store-mysql.test.ts`
  (8 cases) — row-mapping, create/assign/reassign/list/linkWorkPackage
  behavior, and the "unknown id touches no write" guard for each mutating
  method. `apps/control-api` is now at 129 tests (was 115).

## This milestone (2026-09-06, sixth pass): the persistence epic closes

Finished persisting every store this file has ever flagged, plus found and
fixed a deeper bug than persistence along the way:

- **New migrations** (`packages/db`): `artifact-migration.ts`
  (`artifact_runtime_artifacts`), `observability-migration.ts`
  (`observability_agent_runs`, `observability_agents`).
- **`MySqlArtifactStore`** (`packages/artifacts`): implements `ArtifactStore`,
  preserving the same seal-immutability guard as the in-memory version (a
  `submitted`/`accepted` artifact can't be overwritten).
- **`MySqlAgentRunReadModelStore`/`MySqlAgentRegistryStore`**
  (`packages/observability`): implement the existing interfaces. `project()`
  still folds events through the SAME shared `projectRuntimeEvent`/
  `projectAgentEvent` reducers the in-memory versions use — MySQL only
  durably stores the result, no SQL-side read-modify-write logic duplicated.
- **The artifact-never-populated bug** (see Persistence gaps above for the
  full writeup): fixed by enriching `artifact.sealed`'s payload with the full
  sealed contract (only when a real `ArtifactEngine` sealed one) and adding
  `artifact-bridge.ts` to project it into `state.artifactStore`.
- **Wiring**: `agent-run-subscription.ts` now best-effort-connects to MySQL
  before subscribing (so projected events land on the durable store from the
  start); new `artifact-store-link.ts` does the same for the Artifact store.
- **Verified against real infrastructure, not just mocks**: ran
  `pnpm --filter @umer/db run migrate` against this dev environment's actual
  MySQL instance — all six new migrations (this pass's two, plus the four
  from prior passes) applied cleanly. This caught a real gap in the test
  suite itself: `agent-run-subscription.test.ts` asserted a specific
  in-memory class where reachable-MySQL now legitimately wins, and initially
  failed against the live database with `Table doesn't exist` before the
  migration ran — both fixed (the assertion loosened to check behavior, not
  a concrete class; the migration actually applied).
- **Tests**: 6 new in `packages/artifacts/mysql-store.test.ts`, 8 new in
  `packages/observability/mysql-store.test.ts`, 2 new in
  `packages/agent-runtime/worker.test.ts` (the enriched/omitted artifact
  payload), 3 new in `apps/control-api/artifact-bridge.test.ts`.
  `packages/artifacts`: 15 tests (was 9). `packages/observability`: 29 tests
  (was 21). `packages/agent-runtime`: 37 tests (was 35). `apps/control-api`:
  132 tests (was 129).

## This milestone (2026-09-06, seventh pass): the first grounded Specialist

Closed the last deferred item — threaded real registered-project context
into planning, end to end, for one specialist (`ux.design`) as a deliberate
pilot before extending further. This is the first time this codebase
dispatches a Specialist that can genuinely read a real project's files
rather than either running a deterministic no-op (`eng.app-delivery`) or an
LLM working from a raw-text instruction alone.

- **Contract**: `WorkPackageContractSchema` gained an optional `targetPath`
  — the real, resolved filesystem root a Specialist's tools are sandboxed
  to. Never a guess: only set when a real registered codebase actually
  resolved (see below).
- **The tool** (`packages/extension/src/tools/filesystem-read.ts`,
  `filesystem_read`): the first real filesystem tool in this codebase.
  Fails closed with no `targetPath` configured; rejects `../` traversal, an
  absolute-path escape, and a symlink that resolves outside the root
  (checked via `realpath()`, both before and after resolving symlinks).
  8 tests, including a real temp-directory fixture (the symlink case skips
  gracefully where the OS denies unprivileged symlink creation — confirmed
  that's a real Windows permission limitation in this dev environment, not
  a gap in the tool's logic, since the same containment check also covers
  the non-symlink escape tests, which do run everywhere).
- **Threading `targetPath` through**: `ToolExecutionContext` (`@umer/extension`)
  gained the field; `llm-agent.ts` now passes `workPackage.targetPath` into
  every tool call's context — the one place in the whole chain that could
  have silently dropped it.
- **Mandate correction**: `specialists/design/ux-design.md`'s E7 list named
  a tool as `filesystem.read` (a dot) — `readList()`
  (`@umer/specialist-sdk`) parses E7 verbatim into `toolAllowlist`, and
  tool-calling APIs don't allow dots in tool names, so that entry could
  never have matched a real registered tool. Renamed to `filesystem_read` to
  match; this is also the first time this repo has actually needed E7's
  parsed literalness to matter, since every other LLM-dispatched specialist
  (`growth.opportunity-research`) only ever used `search_web`, which was
  already written correctly.
- **Mechanism/policy split** (`packages/orchestration/src/worker.ts`):
  `WorkGraphPlanningOptions` gained an optional `resolveTaskContext` hook
  taking `(node, {taskIds, targetPath})` — this is where "a UX node needs a
  real targetPath, an Implementation node doesn't" is decided, entirely in
  `apps/orchestration-worker`'s deployment-specific wiring. `packages/orchestration`
  itself stays generic; it doesn't know what any node type requires. Omitting
  the hook falls back to the pre-`targetPath` behavior (real Task ids alone
  are enough) — nothing about the existing `Implementation` path changed.
- **Real resolution** (`apps/control-api`'s plan route): looks up the Work
  Graph's owning `ProjectContract`, and only when its `registryProjectId`
  resolves to a catalog entry that's genuinely `onDisk` does `targetPath`
  get set — an unknown/stale `registryProjectId`, or no link at all,
  produces `targetPath: null` in the response and no `targetPath` in the
  `workgraph.plan` command payload, never a fabricated path.
- **Registration**: `ux.design` added to `apps/agent-worker`'s `specPaths`
  (now genuinely dispatchable) and to `orchestration-worker`'s
  `resolveSpecialist` mapping (UX → ux.design, loaded from the same spec
  file agent-worker loads, same pattern as `eng.app-delivery`).
- **`inferArtifactType`** (`llm-agent.ts`) also gained a `Design` department
  → `DesignArtifact` mapping, rather than the generic `Brief` fallback every
  non-Business specialist got before.
- **Tests**: 8 new in `filesystem-read.test.ts`, 1 new in `llm-agent.test.ts`
  (targetPath threading), 3 new in `worker-plan.test.ts` (default behavior
  unchanged, a custom resolver skipping cleanly without targetPath, and
  planning successfully with one), 3 new in
  `work-graph-plan-target-path.test.ts` (real on-disk resolution, no link,
  stale link) using a self-contained fixture catalog rather than depending
  on whatever happens to be checked out on this machine.
  `packages/extension`: 21 tests (was 13). `packages/agent-runtime`: still
  37 (one test changed, none added net-new beyond the targetPath one which
  replaced no test). `packages/orchestration`: 89 (was 86).
  `apps/control-api`: 135 (was 132).

**What this does NOT yet do**: `qa.verify` and `security.review` are still
unregistered — they need `filesystem.write.umer_*` and
`process.run.audit_allowlist` tools respectively, neither of which exist.
`ux.design`'s own `filesystem.write.umer_ux` and `process.recommend`
permissions are also still just aspirational list entries with no real tool
behind them (harmless: the router fails closed with `unknown_tool` if the
model ever tries). This pilot proved the sandbox/threading model end to end
with the lowest-risk case (read-only, no subprocess); extending it is now
mechanical repetition of this same pattern, not new design.

## This milestone (2026-09-06, eighth pass): a second grounded Specialist, and a non-executing tool

Extended the exact pattern from the seventh pass to `qa.verify` — proving
the mechanism/policy split generalizes to a second Specialist and a second
tool with zero changes to `packages/orchestration`'s engine, only new policy
wiring at the app layer, as the prior pass predicted.

- **New tool** (`packages/extension/src/tools/process-recommend.ts`,
  `process_recommend`): records a recommended verification command
  (e.g. a test-runner invocation) and classifies it against a fixed
  allowlist of known read-only verification-command prefixes
  (`npx playwright test`, `./vendor/bin/phpunit`, `pnpm test`, etc.). It has
  **no subprocess-execution capability at all** — not "executes but is
  restricted," genuinely cannot run anything — matching `qa.verify`'s
  `Advise` authority class exactly. 7 tests: allowlisted match, non-match,
  prefix-plus-arguments match, a same-prefix-different-word rejection
  (`npm testing-something-else` is not `npm test`), and malformed-input
  rejection for both required fields.
- **Mandate correction**: `specialists/qa/qa-verify.md`'s E7 list had the
  same two defects the prior pass found and fixed in `ux-design.md`:
  `filesystem.read` (a dot — renamed to `filesystem_read` to match the real
  tool) and `process.recommend (does not execute destructive commands)` (the
  parenthetical would have polluted the exact-match allowlist check even
  after fixing the dot — renamed to bare `process_recommend`).
  `catalog.read` and `filesystem.write.umer_qa` are left as dotted
  placeholders, consistent with how `ux-design.md` still lists
  `filesystem.write.umer_ux` — neither has a real tool behind it yet, so the
  literal name doesn't matter until one exists.
- **`inferArtifactType`** (`llm-agent.ts`) gained a `QA` department →
  `TestPlanResults` mapping (an artifact type that already existed in
  `ArtifactTypeSchema` but nothing produced until now).
- **Registration**: `qa.verify` added to `apps/agent-worker`'s `specPaths`
  and its `process_recommend` tool registered alongside `filesystem_read`;
  added to `orchestration-worker`'s `resolveSpecialist` mapping (`QA` →
  `qa.verify`) and to the `targetPath`-required set alongside `UX` (QA needs
  a real project to read before it can recommend anything about it).
- **Tests**: 7 new in `process-recommend.test.ts`, 1 new in
  `llm-agent.test.ts` (Design → `DesignArtifact` and QA → `TestPlanResults`
  mapping, closing a coverage gap the Design branch had had since the prior
  pass). `packages/extension`: 28 tests (was 21). `packages/agent-runtime`:
  39 (was 37). `packages/orchestration` and `apps/control-api` unaffected
  (89 / 135) — the generic `resolveTaskContext` hook these depend on was
  already fully covered by the UX-specific tests; only the app-layer wiring
  changed, which (consistent with every other `main.ts` change in this repo)
  has no dedicated test file of its own.

**What this does NOT yet do**: `qa.verify` still cannot write its
`TEST_PLAN`/`APPLY_REPORT` output to `.umer/qa/` (`filesystem.write.umer_qa`
doesn't exist as a real tool), and `process_recommend` never executes
anything — a human or a separately-audited runner still has to actually run
the recommended command. `security.review` remains unregistered; it's the
one that genuinely needs subprocess execution and deserves its own focused
review before it's wired.

## This milestone (2026-09-06, ninth pass): Specialists can seal real evidence to disk

Closed the gap the eighth pass flagged: `ux.design` and `qa.verify` can now
actually write their findings under a real, sandboxed `.umer/<slug>/`
evidence subtree instead of only returning a summary string on the
Artifact — the last missing piece of what both mandates already promised
("seal findings under `.umer/ux/<runId>/`" / "seal evidence under
`.umer/qa/`").

- **New tool** (`packages/extension/src/tools/filesystem-write.ts`,
  `filesystem_write`): writes one text file under the calling specialist's
  own `.umer/<slug>/` evidence subtree inside its Work Package's real
  `targetPath`. `<slug>` is derived generically from the specialistId's
  first dot-segment (`ux.design` → `ux`, `qa.verify` → `qa`) — never chosen
  by the model, so one specialist's evidence subtree is structurally
  unreachable to another, and product code outside `.umer/` is unreachable
  to any of them. Containment is checked with `realpath()` after every
  directory-creating step (an intermediate symlinked directory, or the
  target file itself being a symlink, are both caught before the write),
  the same before/after-symlink-resolution pattern `filesystem_read` uses.
  Also enforces a 2MB single-write cap and rejects writing onto an existing
  directory. 13 tests, including a symlinked-evidence-root escape test that
  skips gracefully on this Windows environment's unprivileged-symlink
  limitation (same accommodation as `filesystem-read.test.ts`).
- **Mandate correction**: both `ux-design.md`'s `filesystem.write.umer_ux`
  and `qa-verify.md`'s `filesystem.write.umer_qa` — each a distinct dotted,
  per-specialist tool name — are replaced with the single bare
  `filesystem_write`, since containment is now enforced by the tool
  deriving its own subtree from context, not by registering a differently
  named tool per specialist.
- **Registration**: `filesystem_write` registered in `agent-worker`'s tool
  registry alongside `filesystem_read` and `process_recommend`. No
  orchestration-worker or control-api changes needed — deriving the subtree
  from `specialistId` (already present on every `ToolExecutionContext`)
  needed no new context field and no new app-layer policy wiring, unlike
  `targetPath` itself.
- **Tests**: 13 new in `filesystem-write.test.ts`. `packages/extension`: 41
  tests (was 28). No other package's test count changed — `llm-agent.ts`
  needed no changes since `targetPath` was already threaded through to every
  tool call, including this new one.

**What this does NOT yet do**: nothing in this codebase actually calls
`filesystem_write` yet outside of its own unit tests — the pilot proved the
sandbox is safe to grant, but no end-to-end run has driven an LLM through
"read via `filesystem_read`, then seal a real `FINDINGS.md` via
`filesystem_write`" against a live provider. `security.review` remains
unregistered.

## Next highest-value milestone

**`security.review`** is now the only one of the three specialists flagged
in the seventh pass's scope still unregistered, and the only remaining
piece of "next steps" left over from that pass. It genuinely needs process
execution (`npm audit`/`composer audit`), which is qualitatively
higher-risk than pure file reads (`filesystem_read`, now `filesystem_write`,
both non-executing) and deserves its own focused review of the exact
allowlist/sandboxing mechanism — a fixed, non-shell-interpreted argv rather
than a free-text command string like `process_recommend` accepts, and a
real allowlist of resolvable binaries — before it's wired for real, rather
than being treated as mechanical repetition of the read-only pattern.
