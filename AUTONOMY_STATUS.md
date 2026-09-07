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

### Commercial intelligence

The opportunity-intelligence package provides real market/business discovery, research, evidence, opportunity construction, prospect storage, contact/reachability intelligence, scoring, MySQL persistence, Google Places/website evidence adapters, scheduling, and outreach generation.

This is the beginning of an autonomous Commercial department, but the full sales-to-customer loop is incomplete.

### CEO/control plane

The system has real CEO commands for agents, projects, tasks, and opportunities, plus attention/decision/gate mechanisms and audit trails.

### Truthfulness

The system must never fabricate agents, projects, tasks, Work Packages, opportunities, contacts, evidence, activity, decisions, artifacts, progress, scores, revenue, or outcomes. Empty/unknown states must remain visible as empty/unknown.

## Known missing capabilities

1. The complete Product/Architecture/UX/Engineering/QA/Security/Release/Operations workforce is not yet wired as a fully executable Specialist network.
2. Engineering does not yet perform a complete safe repository change-set workflow through the generic runtime.
3. Requirements intake is not yet the canonical trigger for the complete product/delivery graph.
4. Product and Architecture do not yet have fully dispatchable Specialists connected to the official intake flow.
5. Commercial intelligence does not yet form a complete automated sales pipeline through outreach execution, response handling, proposal, close, project creation, and revenue attribution.
6. Customer support/success, finance/revenue operations, learning/feedback, and closed-loop market iteration are incomplete.
7. Production durability policy still needs to distinguish development fallback from production truth; MySQL-unavailable fallback must not silently imply durable company state.
8. Current CI on `main` is failing during workspace typecheck: `packages/db/src/index.ts(1,25): Cannot find module '@umer/config' or its corresponding type declarations.`
9. Older audit/intake flows remain separate from the generic runtime and must not be presented as real autonomous Agent Runtime execution.
10. The Command Center needs richer owner/project/task/evidence/next-action linkage so the CEO can understand company state without inspecting technical runtime pages.

---

# STRICT EXECUTION PLAN — MISSING CAPABILITIES

**This section is the authoritative implementation backlog. Agents working on this repository must NOT start unrelated features, redesign completed infrastructure, add decorative dashboard work, or create duplicate abstractions while this backlog has unfinished items. Work directly on `main`.**

## M0 — Restore a green foundation

**Goal:** make `main` typecheck, lint, test, and build cleanly.

- Fix the `@umer/db → @umer/config` workspace typecheck/build dependency-order/output issue.
- Run/fix root typecheck.
- Run/fix lint.
- Run/fix unit/integration tests.
- Run/fix build.
- Keep CI green after every later milestone.

**Exit criterion:** CI green for typecheck + lint + test + build + Helm validation.

## M1 — Canonical Requirements Intake

**Goal:** turn a real CEO/client request into the canonical company delivery graph.

`Request → Requirement Record → Project → Requirements Node → Product/Architecture/UX/... Work Graph`

Requirements must capture request source, requester/customer/opportunity/project relationship, problem statement, desired outcome, constraints, acceptance criteria, assumptions, evidence/source, status, and CEO approval/decision where required.

Connect existing intake/control-plane/project/task systems. Do not create a parallel intake model.

**Exit criterion:** one real request can enter the system and create a durable, truthful project requirement and Work Graph without manual database manipulation.

## M2 — Product Specialist

**Goal:** make Product work executable through the real Agent Runtime.

Support product discovery, scope definition, user stories/use cases, acceptance criteria, product risks, and prioritization.

Connect Product execution to the existing Work Graph and Agent Run lifecycle.

**Exit criterion:** a real Requirements node produces a reviewed Product artifact/evidence through an actual Agent Run and returns its state to the graph.

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
