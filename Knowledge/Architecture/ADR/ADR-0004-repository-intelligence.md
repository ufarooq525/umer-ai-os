# ADR-0004 — Repository Intelligence

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Need continuous impact analysis across code structure for safe specialist automation.

## Decision
Adopt derived Code Graph + Impact Engine per RFC-006 / REPO_INTELLIGENCE_ARCHITECTURE.md.

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Agent grep only | Non-deterministic |
| 18th Runtime domain | Map fixed at 17 |
| SaaS-only graph | Laragon/offline |

## Consequences
Extractors owned by Engineering; graph rebuildable from repo.

## Related
`RFC/Records/RFC-006-repository-intelligence.md`
