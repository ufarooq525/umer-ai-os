# Event Bus Architecture

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.
Refines the **asynchronous event plane** of `Runtime/Domains/Message_Fabric.md`.

> **Positioning.** The Runtime charter merges Communication Bus + Event Bus into one
> Message Fabric. This document set does **not** introduce a second bus. It is the
> formal specification of the Fabric's event plane, extended with the capabilities
> the current architecture names but does not specify: priority, delayed execution,
> durable event history, parent-child lineage, and declarative specialist
> subscriptions. "Event Bus" below always means *the event plane of Message Fabric*.

## 1. Goal

Transform the Runtime from **request-driven orchestration** (Control API calls
`planIntake`, synchronously runs audits, manually creates work packages) into
**event-driven orchestration**:

- Producers publish facts (`work.feature.requested`, `specialist.qa.completed`).
- Specialists never get invoked by name. They **subscribe** to event types, and the
  Event Bus dispatches work to them when matching events occur.
- Workflow progression is emergent: each completed step publishes an event, and the
  next specialist's subscription picks it up.

## 2. Design influences

| System | What we take | What we deliberately do not take |
| --- | --- | --- |
| Kubernetes | Level-triggered, idempotent handlers; reconciliation over exactly-once delivery; desired-state records (Subscription Records) as declarative config | etcd-style shared mutable store as the coordination primitive |
| Temporal | Durable, append-only event history as the source of truth for a workflow; correlation of every event to a root; replayability | In-process workflow code replay (specialists are external agents, not deterministic functions) |
| GitHub Actions | Declarative `on:` trigger bindings owned by the workload (specialist spec), not by the router; filters on event payload | YAML-embedded imperative steps; per-repo isolation model |

## 3. Framework independence

The Event Bus is specified as **ports** (interfaces) plus **contracts** (schemas).
No document in this set names a broker as a requirement. NATS JetStream is the
*reference adapter* because it is what the monorepo runs today; Kafka, RabbitMQ,
Redis Streams, or an in-memory adapter (for tests) must be able to satisfy the same
ports without changing any consumer code.

Ports (architecture-level; signatures indicative, not code):

| Port | Responsibility | Reference adapter |
| --- | --- | --- |
| `BrokerPort` | Raw publish/consume/ack/nak on subjects; at-least-once delivery | NATS JetStream streams `UMER_EVENTS`, `UMER_DLQ` |
| `EventHistoryPort` | Append-only persistence and query of every published envelope | Postgres (`packages/db`) |
| `SchedulePort` | Durable storage of delayed events; release when due | Postgres table + due-poller (JetStream has no native delay) |
| `SubscriptionStorePort` | Persistence of Subscription Records; watch for changes | Registry-backed (compiled from specialist specs) + DB |
| `DeadLetterPort` | DLQ record persistence, inspection, replay | `dlq.>` subjects + DB mirror |

Capabilities that brokers provide natively (e.g. Kafka log retention as history)
MAY be used by an adapter to satisfy a port, but the port contract is what the
rest of the Runtime programs against.

## 4. Components

```
                 ┌──────────────────────────────────────────────────────┐
                 │                     EVENT BUS                        │
 producers      │                                                       │   consumers
┌───────────┐   │  ┌──────────┐   ┌────────────┐   ┌────────────────┐  │  ┌────────────────┐
│Control API│──▶│  │ Ingress  │──▶│  Broker    │──▶│  Dispatcher    │──│─▶│ Specialist      │
│Orchestr.  │   │  │ (validate│   │  (subjects,│   │  (match subs,  │  │  │ Workers         │
│Agent Wkr  │   │  │  enrich, │   │  priority  │   │  fan-out, ack) │  │  │ (via            │
│Webhooks   │   │  │  dedupe) │   │  lanes)    │   └───────┬────────┘  │  │ cmd.agent.      │
└───────────┘   │  └────┬─────┘   └─────┬──────┘           │           │  │ dispatch)       │
                │       │               │            retry / exhaust   │  └────────────────┘
                │       ▼               ▼                  ▼           │
                │  ┌──────────┐   ┌──────────┐      ┌────────────┐     │
                │  │ Schedule │   │  Event   │      │ Dead Letter│     │
                │  │ Store    │   │  History │      │ Queue      │     │
                │  │ (delayed)│   │  Store   │      └────────────┘     │
                │  └──────────┘   └──────────┘                         │
                └──────────────────────────────────────────────────────┘
```

### 4.1 Ingress

Single entry point behind `publish()`. Responsibilities:

- Validate the envelope against `EVENT_SCHEMA.md` (schema-free events are a named
  failure mode of the Fabric).
- Enrich: assign `eventId`, `occurredAt`, resolve `rootEventId` from
  `parentEventId`, stamp `producer`.
- Deduplicate on `dedupKey` within the dedup window (idempotent publish).
- Route: delayed events (`notBefore` in the future) go to the Schedule Store;
  immediate events go to the broker on the subject derived from type + priority.
- Append to Event History **before** broker publish (history is the source of
  truth; broker delivery is a projection of it — Temporal influence).

### 4.2 Broker (subjects and priority lanes)

Events travel on subjects `evt.<domain>.<type>` (see `EVENT_TYPES.md`). Because
priority is not portable across brokers, priority is implemented as **lanes**:
parallel consumer groups per priority band (`critical`, `high`, `normal`, `low`),
where the Dispatcher drains higher lanes first and applies lane-weighted
concurrency. Adapters on brokers with native priority MAY map lanes directly.

### 4.3 Dispatcher

The only component that knows about subscriptions. For each delivered event:

1. Load active Subscription Records matching the event type and filters
   (`SUBSCRIPTION_MODEL.md`).
2. For each match, fan out one **delivery** per consumer group. A delivery to a
   specialist becomes a command on `cmd.agent.dispatch` (a work package), keeping
   the existing orchestration state machine (`Queued → Dispatched → Running → …`)
   as the execution substrate. The Event Bus decides *what runs*; Orchestration
   still owns *how it runs*.
3. Track delivery outcome per subscription (ack / nak / term), independently per
   subscriber — one subscriber's failure never blocks another's delivery.
4. Apply the subscription's retry policy on failure (`RETRY_POLICY.md`); exhausted
   deliveries go to the DLQ.

### 4.4 Schedule Store (delayed execution)

Durable table of `(envelope, notBefore)` rows. A due-poller (in the
orchestration-worker process, elected via a lease) releases due events into the
broker. Delay is a property of the *event*, not of the subscription, so all
subscribers see the event at the same time. Used for: debounced triggers
(`quality.performance.dropped` after a sustained window), scheduled re-audits,
retry backoff for redelivery (see `RETRY_POLICY.md` §4).

### 4.5 Event History Store

Append-only record of every accepted envelope plus per-subscription delivery
attempts. Queryable by `eventId`, `correlationId`, `rootEventId`, type, time
range. Retention is tiered (hot 30d queryable, warm 12mo archived, then per
Governance policy). History answers: "why did the QA specialist run?" — walk the
parent chain. Audit (`packages/audit`) remains the tamper-evident security log;
Event History is the operational log. They are distinct stores with distinct
retention; security-relevant events are additionally mirrored to Audit as today.

### 4.6 Dead Letter Queue

Per original subject: `dlq.evt.<domain>.<type>`. DLQ records carry the full
envelope, the subscription id, every attempt's error, and replay metadata.
Replay re-publishes with the same `eventId` (consumers must be idempotent) and a
`redelivery` marker. Specified in `RETRY_POLICY.md` §5.

## 5. Public API (ports, not code)

| Operation | Semantics |
| --- | --- |
| `publish(envelope)` | Validate → dedupe → history-append → route (broker or schedule). Returns the accepted `eventId`. At-least-once from this point on. |
| `subscribe(subscription)` | Register/activate a Subscription Record (declarative; usually compiled from specialist specs, but available imperatively for Runtime domains). Returns a subscription handle. |
| `unsubscribe(subscriptionId)` | Deactivate the record. In-flight deliveries drain; no new fan-out. Record is retained (tombstoned) for history integrity. |
| `replay(selector)` | Re-deliver historical or dead-lettered events to a subscription (operator / recovery path). |
| `query(selector)` | Read Event History by correlation, root, type, time. |

## 6. Delivery semantics

- **At-least-once** end to end. Exactly-once is not promised; consumers are
  required to be idempotent (Kubernetes influence: handlers reconcile, they do not
  assume single delivery). Idempotency keys: `eventId` per subscription.
- **Ordering** is guaranteed only per `orderingKey` (defaults to
  `correlationId`) within one priority lane. No global ordering.
- **Isolation**: per-subscription consumer groups; a slow subscriber backlogs its
  own group only.
- **Authz**: subscription creation and publish rights are checked against Trust
  (`packages/trust`) — a specialist may only subscribe to types allowed by its
  mandate, and only publish types it produces.

## 7. Event flow example (feature request, end to end)

```
work.feature.requested            (Control API intake publishes; correlationId = req)
  └─▶ pm.intake subscription      → specialist plans → publishes
      work.feature.planned          (parent = requested)
        └─▶ engineering subscription → implements → publishes
            specialist.engineering.completed (parent = planned)
              ├─▶ qa.verify subscription        → publishes specialist.qa.completed
              ├─▶ security.review subscription  → publishes specialist.security.completed
              └─▶ seo.audit subscription        → publishes specialist.seo.completed
                    └─(all three observed by delivery aggregator subscription)─▶
                       delivery.release.requested → gate → delivery.deployment.completed
```

Failure branches (`quality.tests.failed`, `delivery.build.failed`) are ordinary
events with their own subscribers — there is no special error channel in the
workflow topology.

## 8. Ownership boundaries

| Concern | Owner |
| --- | --- |
| Envelope schema, subjects, delivery, DLQ, history, schedule | Message Fabric (this spec) |
| Which events a specialist reacts to | The specialist spec (`specialists/**.md`), compiled by Registry |
| Work package lifecycle once dispatched | Orchestration |
| Retry/backoff primitives shared with non-fabric code | Resilience (Fabric consumes, does not fork) |
| Subscription/publish authorization | Trust |
| Security-relevant event mirroring | Audit |

## 9. Non-goals

- No second broker ("no Kafka shadow bus" — blueprint constraint stands).
- No business/product analytics event taxonomy (Analytics owns that; the Fabric
  may transport it under Analytics contracts).
- No synchronous request/reply — that stays on the command plane (`cmd.>`).
- No implementation in this document set (see `IMPLEMENTATION_PLAN.md` for the
  build order, still code-free).

## Metadata

```yaml
version: 1.0.0
status: proposed
supersedes: none (refines Runtime/Domains/Message_Fabric.md event plane)
last_reviewed: 2026-07-25
```
