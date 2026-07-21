# Runtime Domain: Memory Access Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Plumbing for `Intelligence/` — not a second memory.

## Purpose
Execute authorized retrieval and writeback *handles* against Intelligence and governed Memory stores under contract, with tenancy, freshness, and attribution.

## Owns
Retrieval planners that implement Intelligence retrieval strategies mechanically; access brokers; writeback queues to Intelligence harvest endpoints; citation/attribution packaging for retrieved items.

## Explicitly Does Not Own
Organizational memory content, research libraries, pattern libraries (`Intelligence/`); Knowledge Governance rules authorship (`Governance/`); client preference meaning (`Memory/` content owners).

## Inputs
Retrieval requests from Context/Orchestration/Agent; Trust scope; Intelligence contracts; freshness requirements.

## Outputs
Retrieved bundles with citations; writeback acknowledgments; access-denied events.

## Interfaces
Intelligence (system of record); Governance Knowledge Governance; Context Runtime; Agent Runtime; Trust; Audit.

## Runtime Artifacts
Retrieval Request, Retrieval Bundle, Writeback Receipt.

## Runtime Events
`memory.retrieve.requested|completed|denied`, `memory.writeback.queued|acked`, `memory.citation.missing` (defect).

## Dependencies
Trust, Kernel, Audit, Message Fabric; Intelligence external to Runtime.

## Failure Modes
Caching Intelligence content as Runtime SoR; retrieval without citations; writeback that mutates immutable Intelligence records.

## Metrics
Citation completeness; retrieve latency p95; deny rate; cache-SoR incidents (0); writeback failure rate.

## Anti-Patterns
“Memory Runtime” as shadow Intelligence; Agents writing lessons only into session logs.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
