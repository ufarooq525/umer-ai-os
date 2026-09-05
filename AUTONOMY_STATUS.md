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
is the only part of the system with real persistent storage. `control-api`
best-effort-connects its `opportunityReader` to MySQL when reachable.

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
implemented. **None of this exists in the codebase.** There is no
`work-graph.ts` anywhere, no such MySQL tables, no planner, no board
component. This file replaces that assumption with what's actually here;
building the Work Graph layer is real, not-yet-started work — see Next
Milestone below.

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

| Phase | Prior estimate | Revised | Why revised |
|---|---:|---:|---|
| V1 Foundation | 100% | 100% | Confirmed. |
| Phase 1 — Commercial Engine | ~35% | ~35% | Not re-audited this pass; no evidence to revise. |
| Phase 2 — Requirements Intake | ~0% | ~10% | `control-api` already has a real `/v1/intake` + `/v1/intake/route` flow (`routeIntakeGoal`) that turns a raw goal into an `IntakePlan`. It does not yet produce a `RequestContract`-driven Requirements → Product → Architecture decomposition — that part is genuinely ~0%. |
| Phase 3 — Product & Architecture | ~0% | ~0% | Confirmed no such pipeline exists. |
| Phase 4 — Software Factory | ~30% | ~30% | Not re-audited this pass. |
| Phase 5 — Delivery & Work Graph | ~50% | **~20%** | The Work Package ↔ Agent Run ↔ Gate loop is real and now closes end-to-end (this milestone). The "Work Graph" half of this phase's name — nodes/edges, dependency tracking, a planner, persistence, UI — does not exist at all. 50% materially overstated the graph half. |
| Phase 6 — Autonomous Operations | ~5% | ~7% | The gate-review bridge is a small real step toward Work Packages being reviewable without a human manually knowing to look; still far from autonomous. |
| Phase 7 — Autonomous Company | ~10% | ~10% | Not re-audited this pass; CEO Command Plane (pause/resume/cancel, project/task commands) is real and already supports this. |

## This milestone (2026-09-05)

- Fixed: `control-api` no longer fabricates a demo Work Package/Gate on
  every boot by default (`CONTROL_API_SEED_DEMO` opt-in only).
- Added: `apps/control-api/src/runtime-work-package-bridge.ts` — projects
  real `agent.run.*` events into `/v1/work-packages` and opens a real
  `gate-wp-*` Gate review on completion.
- Added: `/v1/gates/:id/resolve` now publishes `workpackage.accept`/
  `workpackage.reject` back to `cmd.orchestration` for `gate-wp-*` gates,
  so a CEO decision reaches the real Orchestrator.
- Added tests: `runtime-work-package-bridge.test.ts` (9 cases, projection
  logic + fail-open connection), `runtime-gate-resolve.test.ts` (4 cases,
  the accept/reject bridge, including the "unaffected non-runtime gate" and
  "fabric unavailable" cases).
- No new contracts, no new event bus, no new abstraction — reused
  `@umer/orchestration`'s existing `ORCHESTRATION_COMMANDS.ACCEPT/REJECT`
  handling and `@umer/control-plane`'s existing `requestGateReview`/
  `resolveGate`.

## Next highest-value milestone

**Persist the Runtime Truth.** Every store this milestone's loop depends on
(Work Package summaries, Gate Wait records, Agent Run read model, Agent
Registry, Task/Project stores) is in-memory. An "autonomous company" that
forgets every open review and every Work Package on restart is not
observably autonomous to a CEO who checks in once a day. This is larger than
today's change and deserves its own design pass (schema, which store(s) to
migrate first, migration tooling) rather than being folded in here.

After that: the Work Graph layer named in the product vision (dependency
edges between Requirements/Product/Architecture/UX/Implementation/QA/
Security/Release/Operations nodes, a Ready Work Package Planner that reads
that graph) is real, substantial, not-yet-started work — plan it as its own
milestone with explicit schema/API sign-off rather than improvised.
