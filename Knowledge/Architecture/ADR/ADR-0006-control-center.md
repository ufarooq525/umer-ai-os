# ADR-0006 — Control Center

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Need a human OS operations surface beyond thin gate dashboard.

## Decision
Adopt Control Center aggregation plane (RFC-008); read-only over Runtime SoRs.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Grafana as portfolio UI | Wrong abstraction |
| UI as orchestrator | Forbidden |

## Consequences
Versioned score formulas; `/v1/control-center` extends Control API.

## Related
`RFC/Records/RFC-008-control-center.md`
