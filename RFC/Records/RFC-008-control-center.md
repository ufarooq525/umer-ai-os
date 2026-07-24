# RFC-008 — AI OS Control Center aggregation plane

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Runtime Control API / `apps/web`; derived read model; consumes Orchestration,
Event History, Economy, Memory, Watchdogs, CoS Ops LiveOps — owns none of them

## Summary
Ratify `Runtime/ControlCenter/CONTROL_CENTER_ARCHITECTURE.md`: human operations
surface with the mandated dashboard tiles (running/queued workflows, specialists,
memory usage, workflow graph, events, failures, retries, QA/SEO/Security/Perf
averages, system health, cost/workflow, avg completion time).

## Motivation
Thin `/v1/dashboard` is insufficient for OS operations. Operators need one
composition over live Runtime truth without Grafana-as-portfolio or a shadow
orchestrator UI.

## Why This Requires an RFC
Doctrine §3 (Control Center aggregation plane; new read APIs/stream).

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Dashboard as view over API state | Dashboard mutating cluster freely | Actions stay gated |
| Temporal | Workflow list / history UI patterns | — | event tree |
| Airflow | DAG run UI intuition | Airflow UI as product | — |
| LangGraph | — | Studio as OS control plane | — |
| Prefect | Flow run dashboards | — | — |
| OpenTelemetry | Health factors from obs backends | Embedding full Grafana | Link out |
| GitHub Actions | Run list + annotations | — | — |
| Ray | — | — | — |
| AutoGen | — | Chat as control center | — |

---

## 2. Architecture Proposal

Zones A–E, widget contracts, `ControlCenterSnapshot`, stream refresh, score
formula governance, authority matrix: see SoR. Extends existing dashboard.

---

## 3. Interfaces (Ports)

| Port | Responsibility | In-memory | Reference |
|---|---|---|---|
| `ControlCenterReadPort` | snapshot + queries | yes | Control API |
| `ControlCenterStreamPort` | tile patches | yes | SSE/WS |

No write port for orchestration state.

---

## 4. Contracts

Snapshot schema; quality average formula versions; routes
`/v1/control-center`, `/stream`, exec detail; compat `/v1/dashboard`.

---

## 5. Failure Handling

Stale `asOf`; security green-cap; client-side metric invention forbidden;
redaction on event tail. SoR §8.

---

## 6. Extension Points

Role-default filters; secondary routes (DLQ, routing table). **Non-extension:**
UI as scheduler; Analytics KPI wall; replacing Observability product.

---

## 7. Testing Strategy

Snapshot rebuild from fixtures; formula version golden tests; authz on replay;
staleness UI contract; drill-through links resolve.

---

## 8. Migration Strategy

Additive APIs; old dashboard aliases pulse; Event Bus Phase 6 UI items land as
secondary routes under this shell.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Grafana only | Wrong audience; not Work Package/gate native |
| Per-department dashboards first | Fragments OS view |
| Do nothing | Operators blind |

## Trade-offs
Gain: operable OS. Cost: aggregation lag engineering — mitigated by event patches.

---

## Architecture Review Notes
Doctrine §15: pass. Read-only orchestration stance explicit.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness |
| CEO | Approved | Principal-authorized |
| Chief of Staff | Approved | Boundaries clear |

## Implementation Gate
Depends on LiveOps / Event History / Economy signals (RFC-004+). UI build after
snapshot contract exists. No implementation in this RFC.

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0006-control-center.md`
- SoR: `Runtime/ControlCenter/CONTROL_CENTER_ARCHITECTURE.md`

## Related
RFC-004, RFC-007, RFC-009; Control Plane Runtime
