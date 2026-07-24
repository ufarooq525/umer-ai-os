# ADR-0005 — Autonomous Watchdog specialists

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Continuous observation required between demand-driven audits.

## Decision
Adopt Watchdog architecture (RFC-007): cadence ticks → findings → action specialists; no auto-remediate.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Human-only audits | Blind gaps |
| Auto-fix bots | Unsafe authority |
| External cron SoR | Bypasses Fabric |

## Consequences
Depends on Schedule Store (RFC-004); noise controls mandatory.

## Related
`RFC/Records/RFC-007-autonomous-watchdogs.md`
