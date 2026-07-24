# RFC-009 — Chief of Staff Operations specialist (live execution plane)

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Executive (new specialist); Runtime (`ops.*` events; reversible command surface);
distinct from existing Chief of Staff Agent (org-health)

## Summary
Ratify `Executive/Chief_of_Staff/CHIEF_OF_STAFF_OPERATIONS_SPECIALIST.md`:
Executive Orchestrate specialist that monitors workflows, blockers, SLAs, load,
duplicates, specialist health, ETAs, and assignment recommendations — acting only
on reversible audited interventions; never a second Orchestration Runtime.

## Motivation
At hundreds of specialists, humans cannot stare at Event History. Need a live
ops brain that is explicitly not the PM, not org CoS Agent, and not the
scheduler.

## Why This Requires an RFC
Doctrine §3 (specialist class + new `ops.*` Runtime mechanics).

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Controllers reconcile; observe-only on bad cache | Operator replacing apiserver | Fail-safe degrade |
| Temporal | Visibility / stack traces intuition | — | — |
| Airflow | SLA miss handling | Scheduler ownership | PM/Orchestration own schedule |
| LangGraph | — | Supervisor agent owning all tools | Mandate bounds |
| Prefect | Concurrency / work pools intuition | — | Economy rebalance recommend |
| OpenTelemetry | Saturation signals | — | — |
| GitHub Actions | — | — | — |
| Ray | Autoscaler inspiration for rebalance *recommendations* | Ray autoscaler mutating OS | Recommend only |
| AutoGen | Multi-agent coordination patterns | Chat boss agent | Events + LiveOps |

---

## 2. Architecture Proposal

Ten responsibilities, Live Operations Model, reversible vs irreversible rule,
three-way duplicate bar, `ops.*` catalog, E1–E22: see SoR. Distinct from
`CHIEF_OF_STAFF_AGENT.md`.

---

## 3. Interfaces (Ports)

| Port | Responsibility | In-memory | Reference |
|---|---|---|---|
| `LiveOpsModelPort` | derived projection | yes | Event History rebuild |
| `OpsInterventionPort` | reversible cancel/re-rank/rebalance request | yes | Orchestration/Economy commands |

---

## 4. Contracts

`ops.blocker.*`, `ops.sla.*`, `ops.duplicate.detected`,
`ops.workpackage.cancelled`, `ops.specialist.*`, `ops.rebalance.recommended`,
`ops.assignment.recommended`, `ops.eta.updated`, `ops.escalation.raised`.

---

## 5. Failure Handling

Stale model → observe-only; false duplicate bar; escalation debounce; priority
vs Resource conflict → recommend not force. SoR failure modes.

---

## 6. Extension Points

Named skills via Registry. **Non-extension:** shadow scheduler; irreversible
cancel without Human Anchor; silent unaudited interventions.

---

## 7. Testing Strategy

Duplicate three-way evidence; observe-only on partition; SLA timer events;
recommendation-only paths never call irreversible APIs; audit completeness.

---

## 8. Migration Strategy

Additive specialist; interventions feature-flagged; default recommend-only until
confidence SLOs met; org CoS Agent unchanged.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Extend org CoS Agent only | Wrong horizon/mandate |
| Put logic in Orchestration Runtime | Judgment in mechanism |
| Full auto-reassign | Irreversible without anchor |
| Do nothing | Blind at scale |

## Trade-offs
Gain: operable live plane. Cost: careful authority design — mitigated by
fail-safe and audit.

---

## Architecture Review Notes
Doctrine §15: pass. Separation from Orchestration/PM/CoS Agent explicit.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness |
| CEO | Approved | Principal-authorized |
| Chief of Staff | Approved | No collapse of three CoS/PM/CEO roles |

## Implementation Gate
Requires Event History + Orchestration signals (RFC-004). Specialist
registration after `ops.*` contracts. No code in this RFC.

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0007-cos-operations-specialist.md`
- SoR: `Executive/Chief_of_Staff/CHIEF_OF_STAFF_OPERATIONS_SPECIALIST.md`

## Related
RFC-004, RFC-007, RFC-008; Orchestration Runtime; PRIORITY_FRAMEWORK
