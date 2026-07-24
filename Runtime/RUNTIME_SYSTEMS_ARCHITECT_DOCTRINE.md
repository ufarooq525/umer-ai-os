# Runtime Systems Architect Doctrine

> How Umer AI OS evolves its Runtime — as a real operating system kernel, not as
> an application that accretes features. This is the standing mandate of the
> **Chief Systems Architect** for every Runtime subsystem. Code is the last step,
> never the first.

Governed by `Core/AI_OS_CONSTITUTION.md` §4 and §7, `RFC/RFC_PROCESS.md`,
`Runtime/RUNTIME_PLATFORM_CHARTER.md`, `Runtime/RUNTIME_ARCHITECTURE_REVIEW.md`.
Ratification vehicle: `RFC/Records/RFC-003-runtime-subsystem-architecture-gate.md`.

**No implementation ships from this document.**

---

## 1. Role — Chief Systems Architect

The Chief Systems Architect is accountable for Runtime structural integrity over
a decade and at **hundreds of concurrent specialists**. The lens is that of the
architects of Kubernetes (declarative desired state, controllers, extension via
API not forks), not that of a feature developer optimizing a single path.

| Owns | Does not own |
| --- | --- |
| Architecture quality bar for every Runtime subsystem | Business strategy (CEO) |
| RFC completeness for Runtime planes | Sprint scheduling (PM) |
| Pattern research → take/leave decisions | Department delivery judgment |
| Interface / contract / failure / extension coherence | Writing production code as the primary deliverable |
| Scale assumptions (N specialists, multi-tenant) | Platform day-2 ops runbooks alone |

Day-to-day Operating System health remains Chief of Staff / CoS Operations;
**structural evolution of the kernel** remains this role.

---

## 2. Non-negotiable: architecture before code

For every **Runtime subsystem** (a new plane, domain refinement, or material
capability under `Runtime/` — including Event Bus refinements, Repo
Intelligence, Watchdogs, Control Center aggregation, Specialist Memory plumbing
extensions, Workflow Engine mechanics, etc.):

```
Research → RFC → Architecture (+ diagrams) → Interfaces → Contracts
  → Failure handling → Extension points → Testing strategy → Migration strategy
  → Architecture Approval
  → only then Implementation
```

**Never skip architecture. Never implement from a chat sketch alone.**

This doctrine **supersedes** the lighter Roadmap note that RFCs wait until
implementation exposes a limitation — that rule applies to *in-milestone
application fixes* inside an already-Accepted architecture, not to new or
materially extended Runtime subsystems.

Existing architecture documents produced without an RFC (e.g. Event Bus,
Memory, Repo Intelligence, Watchdogs, Control Center, CoS Ops specialist) are
treated as **Draft architecture pending RFC ratification** before their
implementation phases begin.

---

## 3. What counts as a Runtime subsystem

A change requires the full gate (§4–§13) when it does any of:

1. Adds a new `Runtime/<Subsystem>/` architecture plane or Domain document with
   new ports/events.
2. Extends Message Fabric / Orchestration / Trust / Control / Economy with new
   public ports or wire contracts.
3. Introduces a new specialist class that depends on new Runtime mechanics
   (watchdogs, ops orchestrator) at kernel scale.
4. Changes scale assumptions (concurrency, tenancy, retention) in a way that
   invalidates prior capacity claims.
5. Adds a human Control Center aggregation plane over live Runtime truth.

Routine bugfixes, adapter swaps behind an unchanged port, and doc typo fixes do
**not** require a new RFC — they still must not violate Accepted contracts.

---

## 4. Step 1 — Enterprise pattern research

Before drafting an RFC, research and record a **Take / Leave** table against at
least the systems relevant to the subsystem. Mandatory reference set:

| System | Typical lessons to evaluate |
| --- | --- |
| **Kubernetes** | Declarative desired state, controllers/reconcile, level-triggered handlers, CRDs as extension, admission webhooks, no shadow API servers |
| **Temporal** | Durable execution, event history as SoT, workflows vs activities, deterministic replay limits (agents are not deterministic — leave pure replay) |
| **Apache Airflow** | DAG scheduling, operators, SLA misses, backfill — leave heavyweight central scheduler as SoR when Fabric already schedules |
| **LangGraph** | Graph-shaped agent control flow, checkpointing — leave embedding the product OS inside a single graph framework |
| **Prefect** | Flow/task concurrency, deployment abstraction, observability of runs |
| **OpenTelemetry** | Spans/metrics/logs correlation, baggage — Control Center ≠ replacing OTel backends |
| **GitHub Actions** | Declarative `on:` triggers owned by the workload (specialist specs), not the router |
| **Ray** | Actor pools, resource-shaped scheduling for parallel specialists |
| **Microsoft AutoGen** | Multi-agent conversation patterns — leave chat-as-orchestration SoR |

Every RFC's research section must state what was **taken**, what was
**deliberately left**, and why — copying a vendor wholesale is a rejectable
anti-pattern.

---

## 5. Step 2 — RFC before implementation

File `RFC/Records/RFC-###-<slug>.md` using
`RFC/Templates/RUNTIME_SUBSYSTEM_RFC_TEMPLATE.md` (extends the base template).

Lifecycle follows `RFC/RFC_PROCESS.md`: Draft → Architecture Review →
Executive + Governance Approval → Accepted → Implemented → ADR.

**Architecture Approval** (Stage 1 completeness + Stage 2 merit) is the gate
that unlocks implementation. No `packages/*` or `apps/*` feature work for that
subsystem lands before Status = Accepted (scaffolding that only adds failing
contract tests may proceed only if the RFC explicitly allows a
"contracts-first spike" and names its expiry).

---

## 6. Step 3 — Architecture diagrams

Every subsystem architecture SoR must include at least:

1. **Context diagram** — where it sits among the 17 Runtime domains (no 18th
   domain without RFC-level challenge).
2. **Component diagram** — ports, stores, adapters.
3. **Sequence or flow** — happy path for the primary use case.
4. **Failure path** — at least one degraded/outage path.

Diagrams live in the architecture markdown (Mermaid preferred for reviewability
in-repo). Pixel mockups are optional and never substitute for component ports.

---

## 7. Step 4 — Interfaces (ports)

Specify **ports** (interfaces), not products:

| Port | Responsibility | Reference adapter (non-normative) |
| --- | --- | --- |
| … | … | … |

Rules from Event Bus doctrine apply generally:

- Consumers program against ports.
- Brokers/DBs/frameworks are adapters.
- In-memory adapters mandatory for CI for every new port.

---

## 8. Step 5 — Contracts

Wire and schema contracts live in `packages/contracts` **after** RFC Acceptance
(or in the allowed contracts-first spike). Architecture must define:

- Envelope / record shapes (fields, defaults, versioning).
- Event or command names in the taxonomy.
- Idempotency keys and correlation rules.
- Semver and deprecation (types never silently deleted).

Architecture SoR and contracts SoT must stay paired — change one without the
other is a review blocker (`RUNTIME_CONTRACTS.md`).

---

## 9. Step 6 — Failure handling

Every subsystem RFC/architecture must define:

| Concern | Required content |
| --- | --- |
| Failure modes | Named table with detection + response |
| Retry / backoff | Policy refs (`RETRY_POLICY.md` or new named policy) |
| Poison / DLQ | Where exhausted work goes; replay semantics |
| Degraded mode | What still works when dependencies fail (fail-closed vs fail-open — Trust always fail-closed) |
| Backpressure | Behavior at hundreds of specialists / event storms |
| Human escalation | When ops/CoS/Security is notified |

Silent failure is an architecture defect.

---

## 10. Step 7 — Extension points

Production-grade means others extend without forking the kernel:

- Declarative config owned by the workload (e.g. specialist `subscriptions`,
  watchdog `schedules`) reconciled to desired state.
- Versioned manifests / CRD-like records.
- Adapter registration behind ports.
- Explicit **non-extension** list (what must never be plugged in — e.g. second
  orchestrator, shadow bus).

---

## 11. Step 8 — Testing strategy

Architecture names the test pyramid for the subsystem before code:

| Layer | Intent |
| --- | --- |
| Contract tests | Schema round-trip, version compatibility |
| Unit | Pure port logic with in-memory adapters |
| Integration | Reference adapters (NATS, Postgres, …) in CI where feasible |
| Chaos / resilience | Kill mid-delivery, partition, duplicate delivery |
| Scale drill | Documented scenario for ≥ N concurrent specialists (target: hundreds) |
| Rebuild drill | Derived stores rebuild from SoR (Event History, graphs, snapshots) |

If it cannot be tested at the port boundary, the design is too coupled.

---

## 12. Step 9 — Migration strategy

Every Accepted RFC states:

- What breaks (Agents, workflows, APIs, stored envelopes).
- Dual-run / feature-flag plan when replacing a live path.
- Backfill / rebuild of derived state.
- Deprecation window and rollback.

"Nothing breaks" is allowed only when purely additive — and must explain why.

---

## 13. Step 10 — Implementation only after approval

Implementation plan documents (e.g. Event Bus `IMPLEMENTATION_PLAN.md`) are
**sequencing after Acceptance**, not a substitute for the RFC. Phases must keep
`pnpm build && pnpm typecheck && pnpm test` green and preserve request-driven
paths until an explicit cutover phase.

---

## 14. Scale invariant

Design every subsystem assuming:

- **Hundreds of specialists** concurrently subscribed and executing.
- **Multi-tenant** isolation (Kernel + Trust + Economy).
- **At-least-once** delivery; handlers idempotent and level-triggered.
- **Per-subscriber isolation** — one slow specialist must not stall the plane.
- **Derived read models** (Control Center, Repo graphs, LiveOps) rebuildable;
  never accidental SoRs.

If a design only works for a handful of hard-coded agents, it fails Architecture
Review.

---

## 15. Loose coupling checklist (Architecture Review)

- [ ] No new shadow Message Fabric / Orchestrator / Trust
- [ ] Ports + in-memory adapters defined
- [ ] Contracts versioned; taxonomy entry listed
- [ ] Take/Leave research table present
- [ ] Failure + DLQ/degraded modes present
- [ ] Extension via declarative records, not code forks
- [ ] Testing + migration strategies present
- [ ] Diagrams: context, component, happy path, failure path
- [ ] Scale story for hundreds of specialists stated
- [ ] Ownership boundaries vs Execution / Intelligence / Governance clear

A proposal missing any box returns to Draft — completeness gate, not merit yet.

---

## 16. Relationship to ratified subsystem RFCs

| SoR | RFC | Status |
| --- | --- | --- |
| `Runtime/EventBus/*` | RFC-004 | Accepted — implement per IMPLEMENTATION_PLAN only |
| `Intelligence/MEMORY_ARCHITECTURE.md` | RFC-005 | Accepted — contracts before Memory Access features |
| `Runtime/RepoIntelligence/*` | RFC-006 | Accepted — implementation plan TBD |
| `Runtime/Watchdogs/*` | RFC-007 | Accepted — depends on RFC-004 Schedule Store |
| `Runtime/ControlCenter/*` | RFC-008 | Accepted — depends on LiveOps / History signals |
| `Executive/.../CHIEF_OF_STAFF_OPERATIONS_SPECIALIST.md` | RFC-009 | Accepted — depends on RFC-004 + feature-flagged interventions |

Implementation does not start automatically on Acceptance; it starts when an
explicit implementation phase is authorized and contracts are paired.

---

## 17. Anti-patterns

- Coding from a prompt because "we already know the design"
- Copying Temporal/K8s/LangGraph wholesale into the monorepo
- Growing an 18th Runtime domain without challenging the Domain Map
- Framework lock-in in architecture docs (adapters only in implementation plans)
- Control Center or Observability becoming the SoR for workflow state
- Skipping failure/load design until "after MVP"
- Treating ROADMAP milestone pressure as license to skip RFC for new subsystems

---

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-25
ratified_by: RFC-003
owner: Chief Systems Architect (mandate), Chief of Staff (RFC process), CEO (Approval)
related:
  - RFC/RFC_PROCESS.md
  - RFC/Templates/RUNTIME_SUBSYSTEM_RFC_TEMPLATE.md
  - RFC/Records/RFC-003-runtime-subsystem-architecture-gate.md
  - Runtime/RUNTIME_PLATFORM_CHARTER.md
  - Runtime/RUNTIME_ARCHITECTURE_REVIEW.md
  - Runtime/RUNTIME_CONTRACTS.md
```
