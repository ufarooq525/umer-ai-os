# RFC-006 — Repository Intelligence (derived Code Graph plane)

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Runtime (derived plane via Extension + Fabric + Artifact); Engineering extractor quality; project `MODULES.yaml`

## Summary
Ratify `Runtime/RepoIntelligence/REPO_INTELLIGENCE_ARCHITECTURE.md`: continuous,
commit-pinned, rebuildable Code Graph (nine views) with Impact Analysis so a
model change immediately surfaces affected modules (e.g. Student → Attendance,
Fees, Transport, Parents, API, Policies, Reports).

## Motivation
Specialists and watchdogs cannot safely scope work without structural +
empirical impact. Ad-hoc grep does not scale to hundreds of agents.

## Why This Requires an RFC
Doctrine §3 (new Runtime architecture plane; new `repo.*` events). Not an 18th
domain — derived read-model plane (same move as Event Bus under Fabric).

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Desired/actual; rebuildable controllers | Cluster as code graph | — |
| Temporal | History/pinning intuition | — | commitSha pin |
| Airflow | — | Parsing app code in scheduler | Extractors are workers |
| LangGraph | — | — | — |
| Prefect | Job/flow for extract pipelines | — | — |
| OpenTelemetry | Confidence upgrade later via traces | Live prod traces as only call graph | Static-first |
| GitHub Actions | change.* triggers | Actions as impact engine | — |
| Ray | Parallel extractors | — | scale extract |
| AutoGen | — | Agents inventing deps without graph | — |

Also: language servers / SCIP-style indexes as future adapters behind ports.

---

## 2. Architecture Proposal

Nine graphs, Impact Engine, freshness, `repo.*` events: see SoR. Student blast
radius example is normative acceptance scenario. Scale: incremental extract;
per-project isolation; debounce watcher storms.

---

## 3. Interfaces (Ports)

| Port | Responsibility | In-memory | Reference |
|---|---|---|---|
| `RepoIngestPort` | commit/path batches | yes | VCS bridge / watcher |
| `ExtractorPort` | per-graph analyzers | yes | PHP/Laravel + JS adapters |
| `CodeGraphStorePort` | nodes/edges/snapshots | yes | Postgres adjacency |
| `RepoGraphPort` | query/neighbors/blast/diff | yes | — |
| `ImpactEnginePort` | Impact Report | yes | — |

---

## 4. Contracts

Node/edge types; Impact Report artifact; events `repo.index.*`,
`repo.graph.updated`, `repo.impact.computed`, `repo.contract.breaking`,
`repo.graph.diverged`, `repo.modules.drifted`. Every edge: confidence + evidence.

---

## 5. Failure Handling

Stale consumption; heuristic-as-certain forbidden; impact explosion caps;
per-file extract isolate; module drift; rebuild drills. SoR §9.

---

## 6. Extension Points

New stack analyzers; `MODULES.yaml`. **Non-extension:** graph as SoR replacing
git; enforcement of merges by RI alone; cross-tenant joins.

---

## 7. Testing Strategy

Extractor fixtures per stack; incremental vs full parity; blast radius golden
(Student example); rebuild-from-repo drill; confidence propagation tests.

---

## 8. Migration Strategy

Additive indexing per registered project; consumers optional until watchdogs/QA
subscribe; no change to gate semantics.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Only git grep in agents | Non-deterministic; no impact fusion |
| External SaaS graph only | Lock-in; offline Laragon |
| 18th Runtime domain | Domain map frozen at 17 |
| Do nothing | Blind specialists |

## Trade-offs
Gain: precise automation scope. Cost: extractor maintenance — owned by
Engineering quality bars.

---

## Architecture Review Notes
Doctrine §15: pass. Derived-only stance explicit.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness |
| CEO | Approved | Principal-authorized |
| Chief of Staff | Approved | No domain sprawl |

## Implementation Gate
No extractor/store code until contracts + SoR paired PR. Implementation plan TBD
post-Acceptance (separate sequencing doc).

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0004-repository-intelligence.md`
- SoR: `Runtime/RepoIntelligence/REPO_INTELLIGENCE_ARCHITECTURE.md`

## Related
RFC-003, RFC-004 (`change.*` bridges); Extension Runtime
