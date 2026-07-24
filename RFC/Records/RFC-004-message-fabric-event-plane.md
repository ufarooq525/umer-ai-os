# RFC-004 — Extend Message Fabric event plane (Event Bus)

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Runtime (Message Fabric event plane); `packages/contracts`; `packages/message-fabric`; `packages/specialist-sdk` / Registry (subscriptions); Orchestration (dispatch substrate); Control API / Web (dual-run then cutover)

## Summary
Ratify the Event Bus architecture set under `Runtime/EventBus/` as the formal
asynchronous event plane of Message Fabric: priority lanes, Schedule Store,
durable Event History, declarative specialist subscriptions, retry/DLQ, and
phased migration from request-driven intake to event-driven specialist
orchestration — without a shadow bus.

## Motivation
Request-driven `planIntake` does not scale to hundreds of specialists.
Orchestration must become emergent from facts on the bus; specialists must
declare triggers; history must answer "why did this run?" Scale and loose
coupling require ports, not broker lock-in.

## Why This Requires an RFC
Doctrine §3 items 1–2 (material Fabric plane extension; new public ports/events).
RFC-003 gate. Cross-cuts contracts + specialist registration.

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Level-triggered idempotent handlers; Subscription Records as desired state; reconcile | etcd as coordination SoR | Fabric + History already exist |
| Temporal | Append-only history as SoT; correlation/root; replay | Deterministic workflow replay | Specialists are non-deterministic agents |
| Apache Airflow | SLA / delayed concepts | Central DAG scheduler as SoR | Orchestration + subscriptions own progression |
| LangGraph | — | Embedding OS in one graph runtime | Kernel must outlive frameworks |
| Prefect | Run observability intuition | Prefect as bus | — |
| OpenTelemetry | Correlate eventId/correlationId with traces | Replacing Event History with traces | Distinct stores |
| GitHub Actions | Workload-owned `on:` / `subscriptions:` | YAML imperative steps; per-repo isolation as OS model | Specs own triggers |
| Ray | Resource-aware concurrency caps later via Economy | Ray as dispatcher | — |
| Microsoft AutoGen | Multi-agent fan-out awareness | Chat transcript as orchestration SoR | Events + Work Packages |

---

## 2. Architecture Proposal

### 2.1 Positioning
Refinement of Message Fabric **event plane** only — not an 18th domain, not a
second bus. SoR: `Runtime/EventBus/EVENT_ARCHITECTURE.md` (+ SCHEMA, TYPES,
SUBSCRIPTION_MODEL, RETRY_POLICY, IMPLEMENTATION_PLAN).

### 2.2 Diagrams
See EVENT_ARCHITECTURE.md §4 component diagram and §7 end-to-end flow.
Failure path: nak → Schedule backoff → exhaust → DLQ → targeted replay
(RETRY_POLICY.md).

### 2.3 Scale assumptions
Hundreds of specialists × independent consumer groups; lane-weighted
concurrency; per-subscription isolation; history tiered retention; tree-depth
cap against event loops; debounce/batch on noisy `change.*` / quality signals.

---

## 3. Interfaces (Ports)

| Port | Responsibility | In-memory adapter | Reference adapter |
|---|---|---|---|
| `BrokerPort` | publish/consume/ack/nak | yes | NATS JetStream |
| `EventHistoryPort` | append + query | yes | Postgres |
| `SchedulePort` | delayed release | yes | Postgres + due-poller |
| `SubscriptionStorePort` | desired/actual subs | yes | Registry + DB |
| `DeadLetterPort` | DLQ + replay | yes | `dlq.>` + DB |

Public ops: `publish`, `subscribe`, `unsubscribe`, `replay`, `query`.

---

## 4. Contracts

| Contract | Wire / schema | Versioning | Taxonomy |
|---|---|---|---|
| Envelope v2 | additive fields (parent/root, priority, notBefore, dedupKey, …) | optional-with-default; v1 round-trip | — |
| Subscription / Retry / DLQ / Delivery records | contracts schemas | semver | — |
| Event catalog | `work.*`, `specialist.*`, `quality.*`, `change.*`, `delivery.*`, `fabric.*` + absorbed existing | never silent delete | EVENT_TYPES.md |
| Alias | keep `release.deployed` canonical; `delivery.deployment.completed` display alias | migration note | IMPLEMENTATION_PLAN Phase 1 |

Idempotency: `eventId` per subscription; publish `dedupKey` window.

---

## 5. Failure Handling

| Failure mode | Detection | Response |
|---|---|---|
| Transient delivery fail | nak/timeout | Named retry via Schedule Store |
| Permanent / poison | term / quarantine | DLQ; poison isolated |
| Event loop | tree-depth / static cycle check | `fabric.event.loop_suspected`; reject |
| Subscriber storm | concurrency + circuit breaker | pause subscription + alert |
| History growth | retention tiers | hot/warm/archive |

Specialist run failures ≠ bus delivery failures (`agent.run.failed` vs DLQ).

---

## 6. Extension Points

- Specialist `subscriptions:` frontmatter → Subscription Records (reconcile).
- Imperative `subscribe()` for Runtime services.
- New event types via contracts + EVENT_TYPES paired PR.
- **Non-extension:** second broker SoR; invoking specialists by name outside Dispatcher after cutover; meta-of-meta `fabric.*` reactions.

---

## 7. Testing Strategy

| Layer | What is proven |
|---|---|
| Contract | v1→v2 envelope round-trip; catalog payloads |
| Unit | Ingress enrich/dedupe; filter match; retry classification (in-memory ports) |
| Integration | JetStream + Postgres adapters |
| Chaos | Kill consumer mid-delivery; DLQ; targeted replay |
| Scale | Fan-out to many subscriptions; lane fairness under load |
| Rebuild | History query answers lineage without broker |

---

## 8. Migration Strategy

Phased per IMPLEMENTATION_PLAN.md: contracts → ports/history → dispatcher/retry/DLQ → declarative subs → dual-run event dispatch → cutover → bridges.

- Feature flag on *publication* of intake events; legacy path until Phase 6.
- Dual-run sandbox comparison before default-on.
- Rollback: flag off restores request-driven path until cutover complete.

## Alternatives Considered

| Option | Summary | Why not chosen |
|---|---|---|
| Shadow Kafka bus | Parallel SoR | Blueprint forbids; dual truth |
| Temporal as orchestrator | Durable workflows | Agents non-deterministic; Fabric already substrate |
| Keep request-driven forever | Simplest short-term | Fails at specialist scale |
| Do nothing | | Blocks event-driven OS |

## Trade-offs
Gain: scale, decoupling, auditability. Cost: dual-run complexity and history
storage — mitigated by phases and tiered retention.

---

## Architecture Review Notes
- Pattern research table complete: yes
- Diagrams present: yes (SoR)
- Ports + contracts + failure + extension + test + migration: yes
- Scale story: yes
- Loose coupling checklist: pass (no shadow bus; ports mandatory)
- Returned for gaps: —

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness; aligns RFC-002 Fabric |
| CEO | Approved | Principal-authorized architecture ratification |
| Chief of Staff | Approved | Boundaries vs Execution preserved |

## Implementation Gate
Implementation may begin only per `Runtime/EventBus/IMPLEMENTATION_PLAN.md`
sequencing after this Acceptance. **No phase starts without contracts paired.**

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0002-message-fabric-event-plane.md`
- Architecture SoR: `Runtime/EventBus/*` → status active on implement start
- Contracts PRs: pending Phase 1

## Related
- RFC-002, RFC-003
- `Runtime/Domains/Message_Fabric.md`
