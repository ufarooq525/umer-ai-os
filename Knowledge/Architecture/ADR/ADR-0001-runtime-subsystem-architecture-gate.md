# ADR-0001 — Runtime subsystem architecture gate (Chief Systems Architect doctrine)

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO / human principal; Chief of Staff; Chief Systems Architect

## Context
Runtime must evolve like an OS kernel toward hundreds of concurrent specialists. The base RFC process and Roadmap under-specified when architecture approval is mandatory for new Runtime planes, risking code-first coupling.

## Decision
Adopt `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md`: architecture-before-code for Runtime subsystems, with `RFC/Templates/RUNTIME_SUBSYSTEM_RFC_TEMPLATE.md` and Implementation only after RFC Acceptance. Roadmap's lighter RFC rule applies only inside already-Accepted designs.

## Technical Rationale
Correctness and Maintainability over Velocity for kernel planes; ports-first and pattern Take/Leave prevent framework lock-in and shadow orchestrators/buses.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Roadmap-light RFC only | Insufficient for kernel-scale planes |
| RFC for every bugfix | Ceremony anti-pattern |
| Architecture docs without RFC | No approval / migration discipline |

## Consequences
- New Runtime subsystem implementation blocked until per-subsystem RFC Accepted
- Existing draft SoRs (Event Bus, Memory, Repo Intelligence, Watchdogs, Control Center, CoS Ops) need RFCs before coding
- Process overhead accepted deliberately

## Related
- RFC: `RFC/Records/RFC-003-runtime-subsystem-architecture-gate.md`
- Doctrine: `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md`
