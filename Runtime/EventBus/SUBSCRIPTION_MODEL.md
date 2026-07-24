# Subscription Model

Part of `Runtime/EventBus/EVENT_ARCHITECTURE.md`. Defines how consumers — above
all specialists — bind to events declaratively, replacing manual invocation.

## 1. Principle: triggers live with the workload

GitHub Actions influence: a workflow declares `on:`; the platform routes. Here,
a **specialist spec declares its triggers**, and the Registry compiles them into
Subscription Records. Nobody calls a specialist by name; the Control API and
Orchestrator stop being routers of business logic and become event producers.

Kubernetes influence: handlers are **level-triggered and idempotent**. A
specialist receiving `specialist.engineering.completed` twice must converge to
the same outcome (dedup on `eventId`, reconcile against current state).

## 2. Declaring triggers in specialist specs

Specialist markdown specs (`specialists/**/*.md`) gain a `subscriptions` block in
frontmatter, parsed by `packages/specialist-sdk` alongside the existing mandate
sections and validated against the specialist's Trust mandate (a specialist may
only subscribe to types its mandate allows):

```yaml
# specialists/qa/qa-verify.md (frontmatter excerpt — illustrative, not implementation)
specialistId: qa.verify
subscriptions:
  - on: specialist.engineering.completed
    filter:
      payload.verdict: pass
    priority: inherit          # take the event's lane
    concurrency: 2             # max parallel work packages from this trigger
  - on: quality.tests.failed
    priority: high
  - on: change.pr.created
    filter:
      subject.kind: project
    debounce: 10m              # coalesce bursts per orderingKey
  - on: delivery.deployment.completed
    filter:
      payload.environment: production
    mode: smoke                # trigger-specific input passed to the run
```

Compilation: Registry parses spec → produces one **Subscription Record** per
`on:` entry → `subscribe()` is called with it at registration time. Editing the
spec re-compiles; removing an entry `unsubscribe()`s it. The spec is the desired
state; the store is reconciled to it (Kubernetes influence again).

## 3. Subscription Record

The persisted, authoritative object the Dispatcher matches against:

| Field | Description |
| --- | --- |
| `subscriptionId` | Stable id: `sub:<consumerId>:<hash(on+filter)>`. |
| `consumerId` | `specialist:qa.verify`, `orchestration`, `observability`, … |
| `consumerKind` | `specialist` (delivery = work package via `cmd.agent.dispatch`) \| `service` (delivery = in-process handler via fabric client) \| `bridge` (outbound webhook). |
| `eventTypes[]` | One or more types; suffix wildcard allowed per domain (`quality.*`). Wildcards across domains (`*`) are operator-only. |
| `filter` | Predicate over envelope + payload (§4). |
| `groupId` | Consumer group. Defaults to `consumerId`: all replicas of a worker share one group ⇒ each event handled once per consumer. Distinct groups ⇒ independent copies. |
| `priorityPolicy` | `inherit` (default) or a fixed lane override for this consumer. |
| `concurrency` | Max in-flight deliveries for this subscription. |
| `debounce` / `batch` | Optional coalescing: deliver at most once per window per `orderingKey`, or deliver arrays of up to N events. |
| `retryPolicyRef` | Named policy from `RETRY_POLICY.md` (default `standard`). |
| `startFrom` | `now` (default) \| `beginning` \| timestamp — new subscriptions can backfill from Event History. |
| `state` | `active` \| `paused` \| `tombstoned`. Unsubscribe ⇒ tombstoned (kept for history integrity). |
| `authzRef` | Trust decision record authorizing this binding. |

## 4. Filters

Declarative, side-effect-free predicates evaluated by the Dispatcher **before**
fan-out (cheap rejection; no work package created for non-matches):

- Path equality / set membership: `payload.verdict: pass`,
  `payload.environment: [staging, production]`.
- Comparison on numerics: `payload.currentPct: { lt: 80 }`.
- Envelope fields: `subject.kind`, `priority`, `tenantId`, `producer`.
- Conjunction only (all clauses must hold). No negation-of-existence, no regex,
  no scripting — anything richer belongs in the consumer, which can ack-and-skip.
  This keeps filters portable across broker adapters and statically analyzable
  ("which specialists can this event reach?" must be answerable by the Registry).

## 5. Delivery contract per consumer kind

### 5.1 Specialists (`consumerKind: specialist`)

Match ⇒ Dispatcher creates a work package command on `cmd.agent.dispatch`:

```
{ specialistId, triggerEventId, correlationId (copied), mode?, payloadRef }
```

The existing orchestration state machine executes it. Ack semantics: the
*delivery* is acked once the work package is durably `Queued` — specialist
execution failure is **not** a delivery failure (it surfaces as
`agent.run.failed` / `workpackage.failed` events with their own subscribers).
This separates transport reliability (bus, retry policy) from business outcome
(events, workflow).

Completion contract: a specialist run MUST end by publishing its
`specialist.<mandate>.completed` event (with `parentEventId` = trigger event)
or the run is marked non-conforming by the mandate checker.

### 5.2 Services (`consumerKind: service`)

Runtime domains (Orchestration, Observability, Audit mirror, delivery
aggregator) subscribe with in-process handlers via the fabric client. Ack/nak
explicit, per `RETRY_POLICY.md`.

### 5.3 Bridges (`consumerKind: bridge`)

Outbound integrations (notify Slack, call external webhook). Same record shape;
delivery is an HTTP call with signature; retries per policy; exhaustion → DLQ.

## 6. Subscription lifecycle API

| Operation | Behavior |
| --- | --- |
| `subscribe(record)` | Authz check (Trust) → validate types exist in catalog → persist → activate consumer group → emit `fabric.subscription.activated`. Idempotent on `subscriptionId`. |
| `unsubscribe(subscriptionId)` | Stop fan-out, drain in-flight deliveries (grace period, then nak-to-retry), tombstone record, emit `fabric.subscription.deactivated`. |
| `pause / resume` | Keep the record; buffer (up to lag limits) or drop per `pausePolicy`. Operator action for incident response. |
| `list / describe` | Registry surface: full routing table, per event type — powers the "who reacts to what" view in the web UI. |

## 7. Ordering, fan-in, and joins

- Ordering is per `orderingKey` within a lane (see `EVENT_ARCHITECTURE.md` §6).
  Consumers needing cross-type ordering must key on the same `orderingKey`
  (default `correlationId` makes workflow-local ordering the easy path).
- **Joins** ("run release when QA *and* Security *and* SEO completed") are not a
  bus primitive. They are implemented by an **aggregator consumer**: a small
  service-kind subscriber that tracks completion state per `correlationId` in its
  own store and publishes the fan-in event (`delivery.release.requested`) with
  `payload.joinedEventIds`. Keeping joins out of the bus keeps the bus
  framework-independent and the join logic testable, replaceable, and observable
  like any other consumer (Temporal keeps workflow logic out of its transport for
  the same reason).

## 8. Backpressure and lag

- Per-subscription lag (unacked backlog) is a first-class metric; thresholds
  emit `fabric.message.failed`-adjacent warnings to Observability.
- `concurrency` caps protect specialists (agent runs are expensive); the lane
  system protects the bus (a flood of `low` never starves `critical`).
- Hard lag ceiling per subscription ⇒ automatic `paused` + operator alert rather
  than unbounded broker growth.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
