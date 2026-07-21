# Runtime Domain: Context Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Implements `Execution/CONTEXT_MANAGEMENT.md` mechanically.

## Purpose
Carry, version, window, and freshness-check Context Packages for Execution instances and Agent invocations without re-deriving or silently rewriting organizational meaning.

## Owns
Context Package mechanical storage/pointers; version counters; windowing/compaction strategies that preserve required fields; freshness recheck triggers; stage inheritance by reference.

## Explicitly Does Not Own
What belongs in a Context Package semantically (`Execution/CONTEXT_MANAGEMENT`); Intelligence content; Business brief authorship; Department findings content (Departments append; Context Runtime stores).

## Inputs
Execution instance IDs; handoff events; Intelligence retrieval handles from Memory Access; Department append operations; Control Plane constraint updates.

## Outputs
Context snapshots/handles; staleness signals; inheritance confirmations.

## Interfaces
Execution (schema/semantics); Orchestration (attach to stages); Memory Access; Artifact Runtime (links); Agent Runtime (read models); Audit (mutations).

## Runtime Artifacts
Context Handle, Context Version Snapshot, Staleness Notice.

## Runtime Events
`context.created`, `context.appended`, `context.inherited`, `context.stale`, `context.compacted`.

## Dependencies
Kernel, Orchestration, Memory Access, Artifact Runtime, Message Fabric, Audit.

## Failure Modes
Summary-lossy compaction that drops constraints; per-stage private context forks; stale context used after constraint change.

## Metrics
Stale-use incidents; inheritance miss rate; compaction data-loss incidents (0 for required fields); context size p95.

## Anti-Patterns
Re-summarizing instead of reference inheritance; chat transcript as sole context store; Context Runtime calling Business decisions.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
