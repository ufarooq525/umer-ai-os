# Retry Policy and Dead Letter Queue

Part of `Runtime/EventBus/EVENT_ARCHITECTURE.md`. Retry applies to **deliveries**
(one event → one subscription), never to the event itself — the event is an
immutable fact; only its delivery can fail. Primitives (backoff, jitter,
circuit-breaking) are consumed from the Resilience domain
(`packages/resilience`), not re-invented here.

## 1. Failure classification

The consumer (or the Dispatcher on its behalf) classifies every failed delivery;
the class decides the path:

| Class | Meaning | Examples | Path |
| --- | --- | --- | --- |
| `transient` | Likely to succeed later | broker hiccup, consumer restart, timeout, 5xx from bridge target | retry per policy |
| `resource` | Succeeds when capacity frees | concurrency cap hit, agent pool exhausted, rate limit | retry with longer backoff; does not count against `maxAttempts` until a real attempt is made |
| `permanent` | Will never succeed as-is | schema validation failure at consumer, authz revoked mid-flight, 4xx from bridge target | no retry → DLQ immediately (`term`) |
| `poison` | The message itself breaks consumers | handler crash/panic reproducibly on this envelope | quarantine (§6) |

Unclassified failures default to `transient` (optimistic, bounded by
`maxAttempts`).

## 2. Named policies

Subscriptions reference a policy by name (`retryPolicyRef`); policies are defined
in contracts and versioned like event types.

| Policy | maxAttempts | Backoff | Jitter | Use |
| --- | --- | --- | --- | --- |
| `standard` (default) | 5 | exponential, base 5s, factor 4, cap 15m (5s, 20s, 80s, ~5m, 15m) | full | Specialist dispatch, service handlers |
| `aggressive` | 8 | exponential, base 1s, factor 2, cap 2m | full | `critical` lane, gate/control events |
| `patient` | 10 | exponential, base 1m, factor 3, cap 6h | full | Bridges to flaky external systems |
| `none` | 1 | — | — | Observability-only taps (loss-tolerant) |

Rules:

- `maxAttempts` includes the first attempt. Attempt counter is per
  `(eventId, subscriptionId)` and survives consumer restarts (persisted in the
  delivery record; broker redelivery count is advisory only — portable across
  adapters).
- Backoff is enforced through the **Schedule Store**: a nakked delivery is
  re-enqueued as a delayed redelivery (`notBefore = now + backoff(attempt)`),
  not by blocking a broker consumer. This keeps lanes flowing and makes backoff
  broker-independent (JetStream `nak` with delay MAY be used by the adapter as an
  optimization, but the durable truth is the delivery record).
- Redelivered copies carry `redelivery: { attempt, reason, originalDeliveryAt }`
  (`EVENT_SCHEMA.md` §1); consumers can distinguish first delivery from retries.
- Per-subscription **circuit breaker** (Resilience primitive): N consecutive
  transient failures across *different* events ⇒ open circuit ⇒ subscription
  auto-pauses with alert, instead of burning retries on a down consumer.

## 3. Ack contract

| Signal | Meaning | Effect |
| --- | --- | --- |
| `ack` | Delivery handled (or intentionally skipped) | Delivery record closed `acked`. |
| `nak(class?)` | Failed, retry me | Classified (default `transient`); schedule redelivery or DLQ if attempts exhausted. |
| `term(reason)` | Failed permanently | Straight to DLQ with reason. |
| timeout | No signal within `ackWait` (default 60s; specialist dispatch 5m) | Treated as `nak(transient)`. |

For specialist deliveries, remember the split from `SUBSCRIPTION_MODEL.md` §5.1:
the delivery is acked at durable work-package enqueue. Specialist *run* failures
are business events (`agent.run.failed`), retried by Orchestration's own state
machine (`Failed → Queued`), not by the bus.

## 4. Interaction with priority and delay

- Redeliveries stay in their original priority lane; retries never jump lanes.
- A delayed event (`notBefore`) that fails delivery retries relative to its
  release time, not its publish time.
- Retry storms are damped by full jitter plus per-subscription concurrency caps;
  lane-weighted draining guarantees `critical` retries are not starved by
  `normal` floods.

## 5. Dead Letter Queue

### 5.1 Record

DLQ entry = full original envelope + delivery forensic:

```
{ dlqId, eventId, subscriptionId, originalSubject,
  attempts: [{ n, at, class, error, consumerInstance }],
  terminalReason, enqueuedAt,
  replay: { count, lastAt, lastBy } }
```

Persisted via `DeadLetterPort` (broker `dlq.evt.<...>` subject + DB mirror so DLQ
survives broker retention and is queryable/joinable with Event History).

### 5.2 Semantics

- DLQ is **per subscription**: event E dead-lettering for `qa.verify` does not
  affect its successful delivery to `security.review`.
- Enqueue emits `fabric.dlq.enqueued` (itself an event — Observability and an
  operator-notification bridge subscribe to it).
- DLQ depth and age are the Fabric's headline health metrics (already named in
  `Runtime/Domains/Message_Fabric.md`).

### 5.3 Replay

- Operator (or automated remediation subscriber) replays by `dlqId`, by
  subscription, or by selector (type + time range).
- Replay re-delivers the **original envelope** (same `eventId` — idempotent
  consumers required) with `redelivery.reason = "dlq-replay"`; attempt counter
  resets, replay count increments (replay loops are capped, default 3, then
  permanent-park with mandatory human decision).
- Replay never re-publishes to all subscribers — it targets the failed
  subscription only.

### 5.4 Retention and escalation

- DLQ records: 90 days hot, then archived with Event History.
- Age-based escalation: DLQ entry older than its policy's `escalateAfter`
  (default 24h) emits `incident.opened` via the existing incident event types.

## 6. Poison messages

A message that reproducibly crashes consumers (class `poison`, detected by ≥2
crashes at the same attempt point) is **quarantined**: moved to DLQ immediately
with `terminalReason: poison`, subscription circuit stays closed (other events
keep flowing), and a `fabric.schema.incompatible`-style alert fires for schema
review. Poison entries are excluded from bulk replay selectors by default.

## 7. Consumer obligations

- **Idempotency**: dedupe on `(eventId, subscriptionId)`; redelivery is normal
  operation, not an edge case.
- **Classify honestly**: `term` permanent failures instead of burning retries;
  never `ack` on failure to silence noise (that is the "fire-and-forget for
  approvals" anti-pattern the Fabric charter forbids).
- **No side effects before durability**: a consumer must not take irreversible
  action and then `nak` (retry would duplicate the action). Persist first, act,
  then ack — or make the action idempotent.

## Metadata

```yaml
version: 1.0.0
status: active
depends_on: packages/resilience (backoff/jitter/circuit primitives)
last_reviewed: 2026-07-25
```
