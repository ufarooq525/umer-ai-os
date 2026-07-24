# Implementation Plan

Part of `Runtime/EventBus/EVENT_ARCHITECTURE.md`. **No code in this plan** — it
sequences the build so each phase ships alone, keeps the system working
throughout, and ends with fully event-driven specialists.

## 0. Ground rules

- The existing Message Fabric (`packages/message-fabric`, NATS JetStream,
  `UMER_COMMANDS` / `UMER_EVENTS` / `UMER_DLQ`) is the substrate. We extend it;
  we do not stand up a parallel bus (blueprint constraint: no shadow bus).
- Every phase keeps `pnpm build && pnpm typecheck && pnpm test` green and the
  request-driven path functional until Phase 6 removes it.
- Wire SoT is `packages/contracts`; architecture SoR is this folder. A change to
  one without the other is a review blocker.
- All new components register with the Runtime Kernel (`packages/kernel`) like
  existing services (lifecycle, health, DI).

## Phase 1 — Contracts (Envelope v2 + catalog)

**Where:** `packages/contracts`

- Extend `EventEnvelopeSchema` with the additive fields from `EVENT_SCHEMA.md`
  (`parentEventId`, `rootEventId`, `priority`, `notBefore`, `dedupKey`,
  `orderingKey`, `subject`, `redelivery`, `signature`). All optional-with-default
  ⇒ existing producers keep validating.
- Extend `RuntimeEventNameSchema` with the `work.*`, `specialist.*`, `quality.*`,
  `change.*`, `delivery.*`, `fabric.*` types from `EVENT_TYPES.md`, plus payload
  schemas per type.
- Record the `release.deployed` vs `delivery.deployment.completed` alias
  decision here (recommendation: keep `release.deployed` as canonical, make the
  new name a display alias — smallest migration surface).
- Add `SubscriptionRecordSchema`, `RetryPolicySchema` (named policies),
  `DlqRecordSchema`, `DeliveryRecordSchema`.

**Exit:** contracts tests cover round-trip of v1 envelopes through v2 schema.

## Phase 2 — Bus core (ports + ingress + history)

**Where:** `packages/message-fabric` (extend), `packages/db` (new tables)

- Define ports: `BrokerPort`, `EventHistoryPort`, `SchedulePort`,
  `SubscriptionStorePort`, `DeadLetterPort`. Refactor the existing JetStream
  client behind `BrokerPort` (behavior-preserving; existing
  `MessageFabricClient` API stays).
- Implement Ingress inside `publish()`: validation, enrichment
  (`rootEventId` derivation, tree-depth cap), dedup window, history-append-first.
- DB migrations: `event_history`, `event_deliveries`, `event_schedule`,
  `event_subscriptions`, `event_dlq` tables.
- In-memory adapter for every port (unit tests, local dev without NATS).
- `query(selector)` read path (by correlation, root, type, time).

**Exit:** an event published via the new `publish()` is durable in history,
delivered via JetStream, and queryable by correlation — proven by integration
tests against both adapters.

## Phase 3 — Dispatcher, priority lanes, retry, DLQ

**Where:** `packages/message-fabric` (dispatcher module), `apps/orchestration-worker` (hosting)

- Priority lanes: subject scheme + lane-weighted consumer draining.
- Dispatcher: subscription matching, filter evaluation, per-group fan-out,
  delivery records, ack/nak/term contract.
- Retry engine per `RETRY_POLICY.md`: classification, named policies, backoff via
  Schedule Store redelivery, circuit breaker (reuse `packages/resilience`).
- DLQ: `dlq.evt.*` + DB mirror, `fabric.dlq.enqueued` emission, replay operation
  (targeted per subscription), poison quarantine.
- Schedule Store due-poller with lease election, hosted in orchestration-worker.

**Exit:** chaos test (`tests/chaos`): kill a consumer mid-delivery, verify
at-least-once redelivery with backoff, DLQ on exhaustion, targeted replay
succeeds, other subscriptions unaffected.

## Phase 4 — Declarative subscriptions (specialist SDK + registry)

**Where:** `packages/specialist-sdk`, `packages/registry`

- Specialist-sdk: parse + validate the `subscriptions:` frontmatter block
  (`SUBSCRIPTION_MODEL.md` §2), including filter grammar and Trust-mandate
  cross-check (subscribed types ⊆ mandate-allowed types).
- Registry: compile parsed triggers → Subscription Records; reconcile desired
  state (specs) against `SubscriptionStorePort` on registration and on spec
  change (activate / update / tombstone).
- Routing-table read API: "which subscriptions match event type X" — consumed by
  Control API for a UI view later.
- Update the four existing specs (`pm-intake`, `application-delivery`,
  `qa-verify`, `seo-audit`) with their `subscriptions:` blocks per the defaults
  in `EVENT_TYPES.md` §3.

**Exit:** editing a specialist spec's triggers changes the live routing table
with no code change; invalid subscriptions (outside mandate) are rejected at
registration with a clear error.

## Phase 5 — Event-driven dispatch (dual-run)

**Where:** `apps/orchestration-worker`, `apps/control-api`, `apps/agent-worker`

- Dispatcher's specialist delivery: matched event → work package on
  `cmd.agent.dispatch` carrying `triggerEventId` + copied `correlationId`
  (delivery acked at durable enqueue, per `SUBSCRIPTION_MODEL.md` §5.1).
- Agent worker: on run completion, publish `specialist.<mandate>.completed`
  (`parentEventId` = trigger event) — the completion contract.
- Control API: `POST /v1/intake` now *also* publishes `work.feature.requested` /
  `work.bug.reported` (feature-flagged, default off). Existing synchronous
  `planIntake` path stays as-is — **dual-run**: both paths execute against
  sandbox projects; results compared via Event History vs in-memory WP state.
- Delivery aggregator service (join consumer for
  QA + Security + SEO ⇒ `delivery.release.requested`), hosted in
  orchestration-worker.
- Gate flow unchanged: gates remain commands/approvals on the control plane;
  gate outcomes already emit `gate.passed|failed` events the pipeline consumes.

**Exit:** with the flag on, an intake flows intake → PM → engineering → QA/SEO
entirely through subscriptions, visible as one event tree under one
`correlationId`, while the legacy path still works with the flag off.

## Phase 6 — Cutover and removal

- Flip the flag on by default; legacy synchronous audit invocation in
  `packages/registry` (`planIntake` calling `runSeoAudit` / `runQaAudit`
  in-process) is replaced by event publication only.
- Remove the request-driven dispatch code path; `planIntake` shrinks to
  validation + event emission.
- Web UI (`apps/web`): event-tree view per correlation (replaces/augments the
  work-package list), DLQ inspection + replay page, routing table view.
- Update architecture SoR: `Runtime/Domains/Message_Fabric.md` bumps to 2.0.0
  referencing this folder; `RUNTIME_COMMUNICATION_MODEL.md` and
  `RUNTIME_LIFECYCLES.md` note the event-plane refinement.

**Exit:** no code path invokes a specialist by name outside the Dispatcher;
deleting a subscription provably stops the corresponding automation.

## Phase 7 — Bridges and quality signals (post-cutover)

- Extension-worker bridges: VCS webhooks → `change.pr.created|merged`,
  `change.dependency.updated`, `change.migration.added` (signed envelopes).
- CI bridge: `delivery.build.failed`, `quality.tests.failed`,
  `quality.coverage.reduced`, `quality.accessibility.failed`.
- Observability-fed signals: `quality.performance.dropped` with debounce via
  Schedule Store.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Event loops (A triggers B triggers A) | Tree-depth cap + `fabric.event.loop_suspected` alert (Phase 2); Registry static cycle check over the routing table (Phase 4). |
| History table growth | Tiered retention from day one; history writes batched; hot-path index only on `(correlationId)`, `(rootEventId)`, `(name, recordedAt)`. |
| Dual-run divergence | Sandbox-only comparison, explicit diff report, no prod cutover until N consecutive matching runs. |
| Broker lock-in creep | In-memory adapter exercised in CI for every port; adapter-specific features only inside adapters. |
| Specialist double-execution during cutover | Feature flag gates *publication*, not subscription — only one trigger source can be live per environment. |

## Explicit non-deliverables (this plan)

- No code, migrations, or schema files are created by this document set.
- No new broker, no Kafka, no external workflow engine.
- No change to gate/approval semantics — human control points stay where they are.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
