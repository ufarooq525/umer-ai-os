# ADR-0007 — Chief of Staff Operations specialist

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Live execution plane needs an Orchestrate specialist distinct from org-health CoS Agent and from Orchestration Runtime.

## Decision
Adopt CoS Operations specialist (RFC-009): observe/recommend; reversible audited interventions only; fail-safe observe-only on stale model.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Fold into org CoS Agent | Wrong mandate/horizon |
| Put judgment in Orchestration | Mechanism ≠ judgment |
| Full auto-reassign | Irreversible without anchor |

## Consequences
New `ops.*` events; feature-flag interventions.

## Related
`RFC/Records/RFC-009-chief-of-staff-operations.md`
