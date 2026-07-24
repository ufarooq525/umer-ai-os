# RFC-003 — Establish Runtime subsystem architecture gate (Chief Systems Architect doctrine)

## Status
Implemented

## Date Proposed
2026-07-25

## Author
Chief Systems Architect (per human principal direction)

## Layers Affected
Runtime (process + review bar); RFC workspace (template extension); Roadmap interpretation for Runtime evolution; no change to Execution/Intelligence semantics.

## Summary
Mandate that every new or materially extended Runtime subsystem follows an
architecture-first lifecycle — enterprise pattern research, RFC, diagrams,
ports, contracts, failure handling, extension points, testing strategy, and
migration strategy — with implementation only after Architecture Approval.
Codify this as the Chief Systems Architect doctrine and a Runtime Subsystem RFC
template, suitable for a kernel that will orchestrate hundreds of specialists.

## Motivation
Umer AI OS Runtime is an operating-system kernel, not a feature app. Recent
subsystem drafts (Event Bus plane, Specialist Memory, Repo Intelligence,
Watchdogs, Control Center, CoS Operations) correctly started as architecture,
but the standing Roadmap line ("RFC only when implementation exposes a
limitation") and the base RFC triggers under-specify the bar for *Runtime
plane* evolution. Without a hard gate, pressure to code will recreate the
failure mode Kubernetes avoided: ad-hoc control loops, shadow APIs, and
framework lock-in before interfaces exist.

## Why This Requires an RFC
`RFC/RFC_PROCESS.md` trigger #2 (cross-cutting change to how architectural
evolution is gated for Runtime) and trigger spirit #1 (clarifies Runtime as
kernel-evolved, not casually extended). Adds no 18th domain; adds process +
template + doctrine.

## Detailed Proposal

1. Accept `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md` as active mandate for
   Runtime subsystem evolution (10-step gate; scale invariant; loose-coupling
   checklist; draft-architecture ratification rule).
2. Add `RFC/Templates/RUNTIME_SUBSYSTEM_RFC_TEMPLATE.md` for Runtime RFCs.
3. Clarify Roadmap: the "RFC when limitation exposed" rule applies to
   in-milestone fixes inside Accepted architecture — **not** to new Runtime
   subsystems.
4. Treat existing unratified Runtime architecture folders as Draft pending
   individual RFCs before implementation phases proceed.
5. Architecture Review Stage 1 for Runtime RFCs uses Doctrine §15 checklist.

### Enterprise Pattern Research (for this process RFC itself)

| System | Take | Leave |
|---|---|---|
| Kubernetes | API review before features; extension via stable APIs; declarative reconcile | Requiring KEPs for typo fixes |
| Temporal | Public visibility of behavioral changes; compatibility windows | Blocking all patches on full redesign |
| Airflow / Prefect | Provider/interface stability expectations | Central scheduler as process owner |
| OTel | Spec-first signals | Replacing product UI with raw backends |
| GitHub Actions | Workflow-owned triggers as design principle (already in Event Bus) | — |
| LangGraph / AutoGen / Ray | Remind multi-agent scale needs resource & isolation design | Adopting any as kernel |

## Alternatives Considered

| Option | Summary | Why not chosen |
|---|---|---|
| Keep Roadmap-light RFC rule only | Fast coding | Undermines kernel-grade evolution; hundreds of specialists amplify coupling debt |
| Require full RFC for every bugfix | Maximum ceremony | Violates existing RFC anti-pattern; Doctrine excludes routine fixes |
| Architecture docs without RFC | Current informal path | No Approval gate, no Take/Leave research mandate, weak migration discipline |
| Do nothing | | Principal explicitly directed OS-style evolution |

## What Breaks / Migration Path
Nothing breaks at runtime. Process change only:

- New Runtime subsystem work pauses at architecture until RFC Accepted.
- In-flight architecture drafts remain valid as Draft SoR; implementation plans
  wait on per-subsystem RFCs.
- Roadmap wording gains a clarifying note (additive).

## Trade-offs
**Gain:** production-grade, extensible, loosely coupled Runtime evolution;
reviewable history; scale honesty. **Cost:** slower start of coding for new
planes — accepted deliberately (Correctness & Maintainability over Velocity per
`Core/DECISION_FRAMEWORK.md`).

## Architecture Review Notes
- Alternatives rigor met: yes
- Migration path identified: yes (process-only)
- Pattern research / loose-coupling completeness (Doctrine §15): pass (process RFC)
- Returned for gaps: —

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect (Architecture Review) | Approved | Completeness gate met; process-only; no shadow domain |
| CEO | Approved | Human principal directed OS-style Runtime evolution ("do whatever is recommended") |
| Chief of Staff | Approved | Fits RFC workspace + Runtime Charter; does not invent competing authority |

## Resulting Record
- ADR created: `Knowledge/Architecture/ADR/ADR-0001-runtime-subsystem-architecture-gate.md`
- Layers updated:
  - `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md` → status active
  - `RFC/Templates/RUNTIME_SUBSYSTEM_RFC_TEMPLATE.md`
  - `ROADMAP.md` clarifying note
  - `RFC/RFC_PROCESS.md` pointer to Runtime template + Doctrine

## Related
- `RFC/RFC_PROCESS.md`
- `RFC/Records/RFC-002-runtime-platform.md`
- `Runtime/RUNTIME_ARCHITECTURE_REVIEW.md`
- Draft SoRs: EventBus, RepoIntelligence, Watchdogs, ControlCenter, MEMORY_ARCHITECTURE, CoS Operations Specialist
