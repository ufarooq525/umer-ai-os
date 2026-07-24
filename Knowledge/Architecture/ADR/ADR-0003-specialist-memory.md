# ADR-0003 — Specialist Memory

## Status
Accepted

## Date
2026-07-25

## Deciders
CEO; Chief of Staff; Chief Systems Architect

## Context
Specialists need durable per-mandate memory without local SoR or chat-only recall.

## Decision
Adopt `Intelligence/MEMORY_ARCHITECTURE.md` via Memory Access plumbing (RFC-005).

## Alternatives Considered
| Option | Why not chosen |
|---|---|
| Org memory only | Misses mandate operations |
| Vector DB as SoR | Adapter only |
| Transcript archival | Unstructured |

## Consequences
Mandatory retrieve/writeback policies; compression required.

## Related
`RFC/Records/RFC-005-specialist-memory.md`
