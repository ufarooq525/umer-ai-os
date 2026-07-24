# RFC-005 — Specialist Memory architecture (Intelligence + Memory Access)

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Intelligence (content SoR); Runtime Memory Access (plumbing); Specialist specs (E9); contracts memory kinds/events

## Summary
Ratify `Intelligence/MEMORY_ARCHITECTURE.md`: each specialist owns a persistent,
searchable, versioned, taggable, summarized, compressible memory store; every run
retrieves and writebacks via Memory Access; harvest bridges to organizational
memory — no local-only SoR.

## Motivation
Without per-mandate durable memory, hundreds of specialists re-derive the same
lessons; chat transcripts evaporate. Need automatic compounding with citations.

## Why This Requires an RFC
Doctrine §3 (specialist class + Runtime plumbing); Intelligence SoR extension;
cross-layer Memory Access contracts.

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Desired declarations; derived indexes rebuildable | etcd as memory content | Intelligence owns content |
| Temporal | Provenance / run linkage | Workflow replay as memory | — |
| Airflow | XCom-like handoff anti-pattern awareness | Storing OS memory in scheduler | — |
| LangGraph | Checkpoint intuition | Graph state as org memory | Violates SoR |
| Prefect | Result persistence patterns | — | — |
| OpenTelemetry | Cite correlation in writebacks | Traces as memory | — |
| GitHub Actions | — | Caches as durable memory | — |
| Ray | — | Actor local state as SoR | — |
| AutoGen | Multi-agent memory awareness | Conversation buffer as SoR | Forbidden by Standard E9 |

---

## 2. Architecture Proposal

Positioning, catalogs (Eng/QA/SEO/Security), summary/compression, run loop,
events: see `Intelligence/MEMORY_ARCHITECTURE.md`. Diagrams: ownership + run
sequence in that SoR. Scale: per-specialist partitions; hot caps + compress;
tenant isolation via existing scope guard.

---

## 3. Interfaces (Ports)

Extend Memory Access service ports: retrieve, writeback (MemoryDelta batch),
summary regen, compress job — in-memory store adapter required. No new domain.

---

## 4. Contracts

Specialist memory entry + MemoryDelta ops; optional `MemoryKind` extension;
events: existing `memory.*` + `memory.harvest.proposed`, `memory.compress.completed`,
`memory.store.diverged`. DedupKey on writeback.

---

## 5. Failure Handling

Skip retrieve/writeback defects; duplicate writeback idempotency; summary drift
reject; catalog/scope deny; compress SLO breach → job. See SoR §14.

---

## 6. Extension Points

Per-specialist category catalogs; peer read declarations in E9. **Non-extension:**
local SQLite/prompt cache as org memory; cross-tenant semantic join.

---

## 7. Testing Strategy

Contract round-trip; scope deny tests; idempotent writeback; compress temperature
transitions; citation-missing detection; rebuild index from entries.

---

## 8. Migration Strategy

Additive: map existing MemoryKind entries; specialists gain Memory Contract
blocks; dual-write optional until retrieve_policy enforced. Nothing deletes
`Memory/` markdown SoR.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Only org Intelligence layers | Misses mandate-specific operational memory |
| Vector DB product as SoR | Adapter detail only |
| Chat transcript archival | Not structured/versioned memory |
| Do nothing | Compounds ignorance at specialist scale |

## Trade-offs
Gain: compounding mandate knowledge. Cost: writeback discipline + storage —
mitigated by compression and noop audit.

---

## Architecture Review Notes
Doctrine §15: pass (SoR complete). No shadow Intelligence in Runtime.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness |
| CEO | Approved | Principal-authorized |
| Chief of Staff | Approved | Intelligence SoR preserved |

## Implementation Gate
No Memory Access feature work for specialist stores until contracts paired with
this RFC. Architecture SoR remains `Intelligence/MEMORY_ARCHITECTURE.md`.

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0003-specialist-memory.md`
- SoR: `Intelligence/MEMORY_ARCHITECTURE.md`

## Related
RFC-003; `Runtime/Domains/Memory_Access_Runtime.md`; ORGANIZATIONAL_MEMORY.md
