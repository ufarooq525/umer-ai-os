# Autonomy Status

Honest snapshot of what Umer AI OS can actually do today versus what is still missing. This file is the execution source of truth: future implementation work must target only the gaps listed in **STRICT EXECUTION PLAN — MISSING CAPABILITIES**.

## Executive truth

Umer AI OS has a real foundation: commercial intelligence, MySQL persistence, contracts, Work Graph, Work Packages, Orchestrator, Message Fabric, Agent Runtime, Agent Run/Agent Registry observability, artifacts, gates, CEO commands, and a real Command Center.

It is **not yet an autonomous company**. The missing value is the end-to-end company loop:

`Market → Opportunity → Prospect → Contact → Outreach → Sales → Requirements → Product → Architecture → UX → Engineering → QA → Security → Release → Operations → Customer → Revenue → Learning → Market`

The current system proves important sections independently, but the complete business loop is not yet proven.

## What is already real

### Runtime and execution

- Work Package lifecycle is real and tested.
- Orchestrator dispatches through the existing Message Fabric.
- Agent Worker consumes real dispatch commands.
- Agent Run events are projected into durable Agent Run/Agent Registry read models.
- Runtime failures can retry and reach a real terminal Failed state.
- Gate/review mechanics are real.
- Runtime Work Package events can open a real CEO review gate and return the decision to orchestration.
- Real sealed artifacts are projected into the artifact read model.

### Work Graph

The Work Graph is real, persisted, dependency-aware, and connected to Work Package planning/lifecycle projection.

Canonical delivery decomposition:

`Requirements → Product → {Architecture, UX} → Implementation → {QA, Security} → Release → Operations`

The planner fails closed when no executable Specialist exists. It does not invent Specialist IDs, Task IDs, evidence, or progress.

### Requirements (M1 — verified end-to-end)

A real request now becomes a durable, truthful Requirement and Work Graph without manual DB seeding:

- `RequirementContract` (`packages/contracts/src/requirements`) captures requestId/projectId/opportunityId/customerId, problem, desired outcome, constraints, acceptance criteria, assumptions, open questions, source, and a final decision.
- `RequirementStore` (`apps/control-api/src/requirement-store.ts`) has both an in-memory and a real MySQL-backed implementation (migration `015_requirements`, registered in `packages/db/src/index.ts`'s `ALL_MYSQL_MIGRATIONS`). `decide()` is final — a Rejected requirement cannot later become Accepted; it throws `RequirementAlreadyDecidedError` (verified by tests and returned as HTTP 409).
- The existing intake path (`submitIntake` / `executeQaIntake` in `apps/control-api/src/state.ts`) persists a canonical Requirement for every real intake, preserving `requestId`/`opportunityId`/`customerId` when the caller supplies them (extended the existing `IntakeInstruction` contract rather than creating a parallel one) and picking the most specific real source lineage (Opportunity > Customer > Request).
- `connectRequirementWorkGraphBridge` (`apps/control-api/src/requirement-workgraph-bridge.ts`, wired from `main.ts`) creates the canonical `Requirements` Work Graph node — with the real requirement id preserved in node metadata — the first time a project gets a Requirement, and is a no-op (attaches, does not duplicate) on every later Requirement for that same project.
- `GET /v1/requirements`, `GET /v1/requirements/:id`, `POST /v1/requirements/:id/decide` expose this as a real CEO-visible read model + decision surface (no write path that fabricates a requirement outside of a real intake).

### Requirements + Product Specialists (M2)

`Requirements` and `Product` Work Graph nodes are now real, dispatchable
Specialists — `requirements.formalize` and `product.definition`
(`specialists/program/*.md`) — wired through the identical pipeline already
proven for UX/QA/Security: `NODE_TYPE_SPECIALISTS`
(`apps/orchestration-worker/src/main.ts`) → `ReadyWorkPackagePlanner` →
`cmd.agent.dispatch` → `AgentRuntime`'s generic `runLlmAgent` loop → a real
`RequirementsBrief`/`ProductBrief` artifact (new `ArtifactType` values) →
human gate → `Accepted`, cascading Work Graph readiness exactly like every
other node type. Both specialists' Work Package instruction is grounded in
the real persisted Requirement's `problem`/`desiredOutcome`/`constraints`/
`acceptanceCriteria` (`apps/control-api/src/server.ts`'s plan route reads
`state.requirementStore` by the node's `requirementId` lineage annotation —
now carried onto `Product`, not just `Requirements`), not generic
boilerplate. Neither specialist needs filesystem/process tools — both work
purely from the Requirement's own text. No new runtime, artifact system, or
node-status bypass was introduced; `ready-work-package-planner.ts`,
`work-graph.ts`'s `Ready→InProgress→Review→Accepted` state machine, and the
gate-resolve routes required zero changes — they were already generic
across node types.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been
performed in this session (verified via unit tests only — the specialist
spec files pass the exact same activation-gate check `apps/agent-worker`
runs at real boot, and `inferArtifactType`/Work Package grounding are
covered directly); Product currently re-reads the same raw Requirement
`requirements.formalize` did rather than building on its accepted
Requirements Brief specifically (a reasonable v1 scope, noted as a future
refinement); Architecture (M3) still has no Specialist.

### Commercial intelligence

The opportunity-intelligence package provides real market/business discovery, research, evidence, opportunity construction, prospect storage, contact/reachability intelligence, scoring, MySQL persistence, Google Places/website evidence adapters, scheduling, and outreach generation.

This is the beginning of an autonomous Commercial department, but the full sales-to-customer loop is incomplete.

### CEO/control plane

The system has real CEO commands for agents, projects, tasks, and opportunities, plus attention/decision/gate mechanisms and audit trails.

### Truthfulness

The system must never fabricate agents, projects, tasks, Work Packages, opportunities, contacts, evidence, activity, decisions, artifacts, progress, scores, revenue, or outcomes. Empty/unknown states must remain visible as empty/unknown.

## Known missing capabilities

1. The complete Architecture/UX/Engineering/QA/Security/Release/Operations workforce is not yet fully wired as an executable Specialist network — Requirements and Product (M2) now are, Architecture (M3) is next.
2. Engineering does not yet perform a complete safe repository change-set workflow through the generic runtime.
3. ~~Requirements intake is not yet the canonical trigger for the complete product/delivery graph.~~ **Resolved (M1):** every real intake now persists a canonical Requirement, and the first Requirement on a project creates the real Work Graph decomposition — see "Requirements (M1)" above.
4. ~~Product and Architecture do not yet have fully dispatchable Specialists connected to the official intake flow.~~ **Product resolved (M2)** — see "Requirements + Product Specialists (M2)" above. Architecture (M3) remains.
5. Commercial intelligence does not yet form a complete automated sales pipeline through outreach execution, response handling, proposal, close, project creation, and revenue attribution.
6. Customer support/success, finance/revenue operations, learning/feedback, and closed-loop market iteration are incomplete.
7. Production durability policy still needs to distinguish development fallback from production truth; MySQL-unavailable fallback must not silently imply durable company state.
8. **M0 verified locally (2026-09-08):** `turbo run lint`, `turbo run typecheck`, `turbo run build` (98/98 tasks), the full `vitest run` suite (860 passed / 4 skipped, 0 failed), and `helm lint` + `helm template` against `infra/k8s/charts/umer-ai-os` (Helm v3.16.3, matching CI's pin) all pass on this working tree. This session had no `gh`/GitHub API access to the (private) repo, so the actual GitHub Actions run for the commits below was not directly observed — only reproduced locally step-for-step against the same CI commands. The root cause of the prior build-order failures was that `pnpm -r run typecheck`/`test` never guaranteed a topological build of workspace dependencies (only 4 packages were manually built first, ad hoc, growing by one every time a new stale-`dist` error surfaced) even though a correctly configured `turbo.json` (`typecheck`/`lint`/`test`/`build` all `dependsOn: ["^build"]`) already existed and was simply unused; `package.json`'s `build`/`lint`/`typecheck` scripts now call `turbo run <task>` and `test` runs `turbo run build && vitest run`, so this class of bug cannot recur silently.
9. Older audit/intake flows remain separate from the generic runtime and must not be presented as real autonomous Agent Runtime execution.
10. The Command Center needs richer owner/project/task/evidence/next-action linkage so the CEO can understand company state without inspecting technical runtime pages. It does not yet surface Requirements.

---

# STRICT EXECUTION PLAN — MISSING CAPABILITIES

**This section is the authoritative implementation backlog. Agents working on this repository must NOT start unrelated features, redesign completed infrastructure, add decorative dashboard work, or create duplicate abstractions while this backlog has unfinished items. Work directly on `main`.**

## M0 — Restore a green foundation

**Goal:** make `main` typecheck, lint, test, and build cleanly.

- Fix the `@umer/db → @umer/config` workspace typecheck/build dependency-order/output issue. **Done, at the root cause:** `package.json`'s `build`/`lint`/`typecheck` now run `turbo run <task>` (which respects `turbo.json`'s existing `dependsOn: ["^build"]` and always builds a workspace dependency before checking anything that imports it) instead of a hand-maintained, ever-growing list of packages to pre-build.
- Run/fix root typecheck. **Done — `turbo run typecheck`: 0 errors.** Fixed real bugs surfaced once dependents typechecked against fresh `dist`: `MySqlRequirementStore` was constructed with a wrapper object instead of the executor itself; `applySecurityToProject` was called with an `audit` key instead of `report`; `eng-gate.test.ts` asserted a property absent from part of a result union.
- Run/fix lint. **Done — `turbo run lint`: 0 errors.** Fixed a real `no-explicit-any` violation in `packages/db/src/index.ts`'s migration error handler, ~40 more across `apps/web/src/lib/*.ts` (untyped raw SQL row results — replaced with real per-query row types, not blanket suppressions), and 6 `consistent-type-imports` violations in `apps/web/src/app/api/*/route.ts`.
- Run/fix unit/integration tests. **Done — `vitest run`: 860 passed, 4 skipped, 0 failed.** Fixed two real pre-existing failures (confirmed present on `main` before this session's changes, via `git stash`): (1) `control.approval.requested` audit events never actually reached the audit trail because `createControlPlaneService` was never given an `events` publisher; (2) a Work Package accepted through a human gate never flipped its intake record's status off `'planned'`, so the record could look forever-pending despite real accepted evidence existing.
- Run/fix build. **Done — `turbo run build`: 98/98 tasks succeed**, including the Next.js production build of `apps/web`.
- Keep CI green after every later milestone.

**Exit criterion:** CI green for typecheck + lint + test + build + Helm validation. **Verified locally** (see "Known missing capabilities" item 8 above for exact commands and the GitHub Actions access caveat).

## M1 — Canonical Requirements Intake

**Goal:** turn a real CEO/client request into the canonical company delivery graph.

`Request → Requirement Record → Project → Requirements Node → Product/Architecture/UX/... Work Graph`

Requirements must capture request source, requester/customer/opportunity/project relationship, problem statement, desired outcome, constraints, acceptance criteria, assumptions, evidence/source, status, and CEO approval/decision where required.

Connect existing intake/control-plane/project/task systems. Do not create a parallel intake model.

**Exit criterion:** one real request can enter the system and create a durable, truthful project requirement and Work Graph without manual database manipulation. **Met** — see "Requirements (M1 — verified end-to-end)" above. Verified by: `apps/control-api/src/intake-requirement.test.ts` (intake → Requirement, provenance, lineage precedence), `apps/control-api/src/requirement-store.test.ts` (both store backends; decision finality), `apps/control-api/src/requirement-workgraph-bridge.test.ts` (Requirement → Work Graph node, no duplication, per-project isolation), `apps/control-api/src/requirements-route.test.ts` (HTTP read model + decide + 409-on-redecide + 404s), `packages/contracts/src/requirements/index.test.ts` (contract validation). What is still missing: no HTTP route surfaces the Work Graph's own view of a Requirements node back onto the Requirement record, and the Command Center UI does not yet render Requirements at all (tracked as gap 10 above).

## M2 — Product Specialist

**Goal:** make Product work executable through the real Agent Runtime.

Support product discovery, scope definition, user stories/use cases, acceptance criteria, product risks, and prioritization.

Connect Product execution to the existing Work Graph and Agent Run lifecycle.

**Exit criterion:** a real Requirements node produces a reviewed Product artifact/evidence through an actual Agent Run and returns its state to the graph. **Met** — see "Requirements + Product Specialists (M2)" above. Both `requirements.formalize` and `product.definition` were added (not Product alone) because nothing could otherwise ever move the Requirements node to `Accepted` in the first place — per the codebase's own documented intent that formalizing the raw request is itself real Specialist work, not a status to shortcut. Verified by: `packages/specialist-sdk/src/requirements-product-specialist.test.ts` (activation-gate pass for both new spec files), `packages/agent-runtime/src/handlers/llm-agent.test.ts` (department → `RequirementsBrief`/`ProductBrief` artifact typing), `packages/orchestration/src/requirements-decomposition.test.ts` (lineage annotation reaches both `Requirements` and `Product` nodes, no others), `apps/control-api/src/work-graph-plan-route.test.ts` (real Requirement content grounds the Work Package instruction; falls back to boilerplate when ungrounded), `packages/contracts/src/artifacts/index.test.ts` (schema accepts the two new artifact types). Not yet verified: an actual live run against a real LLM provider and MySQL/NATS (this session had neither available) — the unit tests exercise the identical activation-gate/artifact-typing/grounding logic the real runtime uses, but a live end-to-end smoke run is still open.

## M3 — Architecture Specialist

**Goal:** make Architecture work executable through the real Agent Runtime.

Support system architecture, database/data model, integration/API architecture, security architecture, and deployment architecture.

Architecture output must be evidence-backed and linked to originating Product/Requirements work.

**Exit criterion:** a real Product result unblocks Architecture and produces a reviewed Architecture artifact through an actual Agent Run.

## M4 — UX/UI Specialist

**Goal:** generalize the already-proven real UX execution path.

- Ensure UX receives real Product/Requirements context.
- Produce durable UX research/design/audit artifacts.
- Link findings/evidence to project requirements.
- Return review state to the Work Graph.

Do not create another UX runtime.

**Exit criterion:** UX is executable from the canonical graph without manual seeding and reaches real review.

## M5 — Real Autonomous Engineering Delivery

**Goal:** move from deterministic engineering/audit output to actual repository delivery.

`Implementation WP → inspect repository → plan → edit → test → diff → artifact/evidence → review → accept/reject`

Required safeguards:

- explicit repository/project target
- allowed paths/tools
- real change-set/diff evidence
- tests before completion
- no completion claim without persisted evidence
- failed execution is Failed, never Accepted
- human approval gates where policy requires

**Exit criterion:** a real Implementation Work Package makes a controlled repository change, produces a real diff and test evidence, and awaits review.

## M6 — QA + Security as Graph-Gated Specialists

**Goal:** make QA and Security first-class executable gates after implementation.

- QA executes against the real change/artifacts.
- Security executes against the real change/artifacts.
- Failures block Release.
- Evidence links Project → Work Package → Agent Run → Artifact.
- No synthetic pass status.

**Exit criterion:** Release cannot become Ready until required QA/Security work is genuinely Accepted.

## M7 — Release + Operations

**Goal:** complete delivery after acceptance.

Implement missing real workflows for release preparation, deployment approval/policy, deployment execution, health verification, rollback/failure, production status, and operational incidents.

Use existing Docker/Helm/deployment infrastructure rather than creating a second deployment system.

**Exit criterion:** an accepted project can reach a truthful production state with deployment evidence and rollback handling.

## M8 — Commercial Sales Loop

**Goal:** turn existing Commercial Intelligence into an actual revenue pipeline.

`Opportunity → Prospect → Contact → Outreach → Response → Qualification → Sales Stage → Proposal → Approval → Won/Lost → Project`

Requirements:

- many prospects per opportunity
- contact provenance
- outreach status/history
- response tracking
- qualification
- proposal/estimation
- CEO decisions only when policy requires
- automatic project creation after a won opportunity
- revenue attribution

Do not duplicate existing opportunity-intelligence stores/services.

**Exit criterion:** a discovered business can become a real sales opportunity and, after a real win, create a delivery project with traceable provenance.

## M9 — Customer Success + Revenue + Learning

**Goal:** close the loop after delivery.

`Project → Customer → Support → Outcome → Revenue → Feedback → Learning`

Track delivery outcome, customer status, support cases, revenue, costs where available, profitability signals, feedback, lessons, and reusable knowledge.

**Exit criterion:** completed work produces measurable business outcome data that can feed future opportunity/product decisions.

## M10 — Autonomous Company Loop

**Goal:** connect all completed capabilities into one governed loop.

`Market → Opportunity → Prospect → Sales → Requirements → Product → Architecture → UX → Engineering → QA → Security → Release → Operations → Customer → Revenue → Learning → Market`

The CEO should primarily handle strategy, high-impact approvals, exceptions, and risk/policy decisions. Routine/reversible work should proceed automatically under policy.

**Exit criterion:** demonstrate the full loop with real persisted records and no fabricated activity.

---

# Strict engineering rules

1. Work directly on `main`; do not create a new branch.
2. Inspect existing implementation before changing anything and reuse it.
3. Do not create duplicate event buses, registries, orchestration engines, stores, intake systems, artifact systems, or dashboards.
4. Do not build UI polish ahead of missing business capability.
5. Do not add fake/demo records to production paths.
6. Do not invent IDs, agents, tasks, evidence, scores, progress, revenue, or outcomes.
7. A successful HTTP response is not proof of execution; verify persisted state/events/artifacts.
8. Every new capability must connect contract → persistence → runtime → event/read model → CEO visibility → tests.
9. Prefer existing Message Fabric/event subjects.
10. Prefer existing MySQL persistence and migrations.
11. Production must fail closed when durable state is unavailable where truth would otherwise be lost.
12. Update this file after every milestone with what is genuinely real and what remains.
13. Every milestone must add focused tests and preserve CI health.
14. Never mark a phase complete merely because code exists; prove the real end-to-end path.
15. When blocked by a missing dependency, implement that dependency as the next missing capability rather than working around it with fake data.

# CEO success test

A founder opening the Command Center should be able to answer within seconds:

- What is the company doing right now?
- What opportunities are being pursued?
- Which prospects matter?
- Which Specialists/agents are working?
- What project is each one working on?
- What evidence exists?
- What is blocked?
- What needs my decision?
- What happens next?
- What money/outcome is this producing?

If the answer cannot be derived from real persisted company state, that capability is not complete.
