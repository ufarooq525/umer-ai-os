# Umer AI OS — Engineering Roadmap

Architecture V1 and the Implementation Blueprint remain the system-of-record for platform semantics. The roadmap below now tracks the **Autonomous Company Program** that builds on the completed V1 foundation.

> **Operating principle:** Umer AI OS is being evolved from an agent/runtime platform into an autonomous software company. It should be able to discover commercial opportunities, qualify real prospects, intake real client requirements, plan delivery, dispatch capable specialists, produce evidence-backed artifacts, release software, operate it, and learn from outcomes — while remaining truthful about state and preserving policy/approval gates for consequential actions.

## Foundation — V1

| Milestone | Deliverable | Status |
|---|---|---|
| Architecture V1 | Enterprise, Org, Runtime, Specialist, Work Mgmt, Blueprint | ✅ Complete |
| Scaffold | Monorepo skeleton | ✅ Complete |
| **M1** | `@umer/contracts` | ✅ Complete |
| **M2** | Runtime Kernel | ✅ Complete |
| **M3** | Message Fabric | ✅ Complete |
| **M4** | Orchestrator | ✅ Complete |
| **M5** | Specialist SDK | ✅ Complete |
| **M6** | First end-to-end flow | ✅ Complete |
| **M7** | Memory Access | ✅ Complete |
| **M8** | Artifact Engine | ✅ Complete |
| **M9** | Trust & Audit | ✅ Complete |
| **M10** | Control-plane UI | ✅ Complete |
| **M11** | Production deployment | ✅ Complete |

## Autonomous Company Program

### Phase 1 — Autonomous Commercial Engine
**Goal:** continuously turn market intelligence into real, evidence-backed commercial opportunities and qualified prospects.

| Capability | Status |
|---|---|
| Market Intelligence | ⬜ Remaining |
| Opportunity Discovery | 🟡 Existing implementation — expand into company-wide loop |
| Business Research | 🟡 Existing implementation — expand coverage/provenance |
| Prospect Intelligence | 🟡 Existing implementation — strengthen Opportunity → many Prospects |
| Lead Qualification | ⬜ Remaining |
| Contact Intelligence + verification state | 🟡 Partial |
| Outreach readiness | 🟡 Partial |
| Outreach execution | ⬜ Remaining |
| Sales pipeline / CRM lifecycle | ⬜ Remaining |
| Proposal + estimation | ⬜ Remaining |
| Revenue attribution | ⬜ Remaining |

**Acceptance:** every commercial claim shown to the CEO must trace to persisted evidence/source data; no invented prospects, scores, contacts, outreach, or revenue.

### Phase 2 — Client Requirements Intake
**Goal:** a real client can provide raw requirements and the company can convert them into a structured, reviewable requirements package.

| Capability | Status |
|---|---|
| New Client Project intake command/UI | ⬜ Remaining |
| Text requirement intake | ⬜ Remaining |
| PDF / Word / image requirement extraction | ⬜ Remaining |
| Audio / meeting transcript intake | ⬜ Future |
| Requirements Agent | ⬜ Remaining |
| Business Analyst validation | ⬜ Remaining |
| Ambiguity / contradiction detection | ⬜ Remaining |
| Client questions + clarification loop | ⬜ Remaining |
| Assumptions and unknowns | ⬜ Remaining |
| Requirements Package with provenance/confidence | ⬜ Remaining |

### Phase 3 — Product & Architecture Planning
**Goal:** transform an accepted requirements package into an executable product and technical plan.

| Capability | Status |
|---|---|
| Product Manager specialist | ⬜ Remaining |
| Personas / journeys / product scope | ⬜ Remaining |
| Epics / features / stories / acceptance criteria | ⬜ Remaining |
| UX Research specialist | ⬜ Remaining |
| Solution Architect | ⬜ Remaining |
| System Architect | ⬜ Remaining |
| Database Architect | ⬜ Remaining |
| Security Architect | ⬜ Remaining |
| Integration Architect | ⬜ Remaining |
| Product Package | ⬜ Remaining |
| Architecture Package | ⬜ Remaining |
| Dependency + risk plan | ⬜ Remaining |

### Phase 4 — Autonomous Software Factory
**Goal:** convert the approved/authorized product and architecture packages into executable Work Packages for a generic specialist workforce.

| Capability | Status |
|---|---|
| Specialist Registry — contract-backed resolution | 🟢 Implemented on `autonomous-company-program` branch |
| Specialist capability / department resolution | 🟢 Implemented |
| Generic specialist instances (not hard-coded agents) | 🟡 Foundation exists; expand |
| UX/UI specialist | ⬜ Remaining |
| Frontend specialist | ⬜ Remaining |
| Backend specialist | ⬜ Remaining |
| Database specialist | ⬜ Remaining |
| Integration specialist | ⬜ Remaining |
| QA Architect / Test Architect | ⬜ Remaining |
| QA execution | 🟡 Existing audit/run primitives; connect to autonomous graph |
| Security testing | 🟡 Existing audit/run primitives; connect to autonomous graph |
| Code review | ⬜ Remaining |
| Documentation specialist | ⬜ Remaining |

### Phase 5 — Autonomous Delivery & Work Graph
**Goal:** agents pull authorized work from a durable dependency graph instead of relying on manual CEO assignment.

| Capability | Status |
|---|---|
| Project → Requirements → Product → Architecture → UX → Implementation → QA → Security → Release graph | ⬜ Remaining |
| Work Graph dependency model | ⬜ Remaining |
| Executable Work Package generation | 🟡 Work Package contract/runtime already exists; graph integration remaining |
| Capability-based agent allocation | 🟡 Specialist Registry foundation implemented; orchestration integration remaining |
| Agent work pulling / assignment | ⬜ Remaining |
| Blocker detection | ⬜ Remaining |
| Retry / reassign / dependency creation | ⬜ Remaining |
| Delivery Manager | ⬜ Remaining |
| Release Manager | ⬜ Remaining |
| DevOps / deployment execution | ⬜ Remaining |
| Production release gates | 🟡 Existing gate/control primitives; autonomous delivery integration remaining |

**Acceptance:** a real project can progress from requirements to release through persisted Work Packages, dependencies, agent runs, artifacts, evidence, gates, and events without fabricated progress.

### Phase 6 — Autonomous Operations
**Goal:** keep delivered systems healthy and close the bug/support/engineering loop.

| Capability | Status |
|---|---|
| SRE / production monitoring | ⬜ Remaining |
| Incident detection | ⬜ Remaining |
| Incident response / recovery | ⬜ Remaining |
| Customer support | ⬜ Remaining |
| Customer success | ⬜ Remaining |
| Bug → engineering Work Package loop | ⬜ Remaining |
| Release rollback / recovery policy | ⬜ Remaining |
| Continuous improvement loop | ⬜ Remaining |

### Phase 7 — Autonomous Company
**Goal:** close the full commercial and operational loop and optimize for durable business outcomes.

```text
Market
  → Opportunity
  → Prospect
  → Qualification
  → Contact / Outreach
  → Sales
  → Proposal
  → Client Requirements
  → Product
  → Architecture
  → Work Graph
  → Specialist Workforce
  → QA / Security
  → Release
  → Production
  → Support / Success
  → Revenue
  → Learning
  → Market
```

| Capability | Status |
|---|---|
| Executive Orchestrator / Company Brain | ⬜ Remaining |
| Department/workforce coordination | ⬜ Remaining |
| Strategy + goal management | ⬜ Remaining |
| Marketing / SEO / content growth | 🟡 Existing specialist/audit primitives; company loop remaining |
| Sales management | ⬜ Remaining |
| Finance / cost / profitability | ⬜ Remaining |
| Revenue attribution | ⬜ Remaining |
| Company-wide memory / learning | 🟡 Memory foundation exists; company learning loop remaining |
| Opportunity → Revenue feedback | ⬜ Remaining |
| Autonomous portfolio optimization | ⬜ Remaining |

## Workforce Architecture Requirement

Do **not** implement the above as 25 unrelated hard-coded agents. The target abstraction is:

```text
Specialist Registry
  → Specialist Contract / Mandate
  → Capabilities + Tool Allowlist + Policy
  → Agent Instance
  → Work Package
  → Agent Run
  → Evidence / Artifact
  → Domain Event
  → Read Model
  → Company Brain / CEO Control Plane
```

The existing Work Package contract remains the dispatch unit. The Specialist Registry resolves already-registered specialist contracts; it must not invent business roles or bypass policy. The Agent Runtime remains responsible for executing Work Packages against mandates.

## Project Intake Requirement

A real client requirement must follow this path:

```text
Raw Client Requirement
  → Requirements Intake
  → Requirements Package
  → Product Package
  → Architecture Package
  → UX Package
  → Work Graph
  → Executable Work Packages
  → Specialist Runs
  → QA / Security
  → Release
  → Production Operations
```

Every generated decision, requirement, conclusion, artifact, and execution state must preserve provenance and confidence where applicable. Unknown information remains unknown until evidence is obtained or the client clarifies it.

## CEO Control Plane Requirement

The CEO should be able to answer, from real persisted state:

- What is happening now?
- Which agents/specialists are working?
- Which project, opportunity, prospect, task, and Work Package are they working on?
- What evidence supports the current state?
- What needs CEO attention?
- What decisions require approval?
- What failed, why, and what recovery is underway?
- Which opportunities are commercially promising and why?
- Which projects are at risk?
- What has actually been delivered and released?
- What revenue/cost/profit outcomes are attributable to the company workflow?

No dashboard surface may manufacture activity, agent communication, progress percentages, contacts, prospects, decisions, or outcomes merely to make the company appear active.

## Current Work — `autonomous-company-program`

The first implementation slice establishes a **contract-backed Specialist Registry** inside the existing `@umer/registry` package rather than creating a duplicate agent taxonomy. It supports registration, replacement, lookup, active-only resolution, department filtering, capability filtering, lifecycle filtering, and fail-closed active checks. Tests cover duplicate registration, suspended specialists, active capability resolution, and inactive specialist rejection.

This branch is intentionally the starting point for Phase 4/5 integration. The next implementation slice should connect specialist resolution to the existing orchestration/Work Package dispatch path, then introduce the durable Work Graph rather than building isolated agent screens or fake agent-to-agent chat.

## Workflow

1. Implement one milestone slice on the autonomous-company program branch.
2. Add/update contracts and tests first where domain state crosses process boundaries.
3. Run `pnpm build && pnpm test && pnpm typecheck && pnpm lint` in a writable worktree.
4. Verify behavior against real persisted data; never seed fake CEO-facing activity.
5. Review the diff and update this roadmap's status.
6. Merge only after review/approval.

New architectural ideas inside an already-accepted milestone design require an RFC only when implementation exposes a real limitation.

**Runtime exception (RFC-003):** new or materially extended Runtime subsystems must follow `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md` — research, RFC, architecture approval — before implementation. See `RFC/Records/RFC-003-runtime-subsystem-architecture-gate.md`.
