# ADR-0002 — Message Fabric event plane (Event Bus)

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Need event-driven specialist orchestration at scale without a second bus.

## Decision
Adopt `Runtime/EventBus/*` as the Message Fabric event plane (ports, history,
schedule, subscriptions, retry/DLQ) per RFC-004. NATS is reference adapter only.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Shadow Kafka bus | Dual SoR |
| Temporal as primary orchestrator | Non-deterministic agents |
| Remain request-driven only | Does not scale |

## Consequences
Implementation only via IMPLEMENTATION_PLAN phases after contracts. Dual-run
before cutover.

## Related
`RFC/Records/RFC-004-message-fabric-event-plane.md`
