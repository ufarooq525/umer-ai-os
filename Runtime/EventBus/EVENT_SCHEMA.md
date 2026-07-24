# Event Schema

Part of `Runtime/EventBus/EVENT_ARCHITECTURE.md`. Wire source of truth will live in
`packages/contracts` (Zod), as it does for the existing `EventEnvelopeSchema`.
This document is the architecture source of record for **Envelope v2**, which
extends the current envelope without breaking it.

## 1. Envelope v2

Every event on the bus is one envelope. Fields marked **(v1)** already exist in
`packages/contracts/src/events/index.ts`; the rest are additive.

| Field | Type | Req | Description |
| --- | --- | --- | --- |
| `eventId` | id (ULID) | yes **(v1)** | Globally unique, assigned by Ingress. ULID so ids sort by time. |
| `schemaVersion` | string | yes **(v1)** | Contracts package schema version. |
| `name` | string (event type) | yes **(v1)** | Dotted type from `EVENT_TYPES.md`, e.g. `specialist.qa.completed`. |
| `occurredAt` | ISO-8601 datetime | yes **(v1)** | When the fact happened (producer clock, Ingress-verified skew). |
| `producer` | string | yes **(v1)** | Emitting component id, e.g. `control-api`, `specialist:qa.verify`. |
| `payload` | object | yes **(v1)** | Type-specific body; each event type declares its payload schema (§3). |
| `tenantId` | id | no **(v1)** | Tenant scoping; Fabric never delivers across tenants. |
| `correlationId` | id | yes **(v1)** | Workflow identity. Constant across an entire flow (intake → deploy). |
| `causationId` | id | no **(v1)** | Id of the *message* (command or event) whose handling directly produced this event. |
| `parentEventId` | id | no | Id of the parent **event** in the event tree (§2). Absent ⇒ root event. |
| `rootEventId` | id | yes | Id of the tree root. Ingress derives it: parent's `rootEventId`, or self. |
| `priority` | enum `critical\|high\|normal\|low` | yes (default `normal`) | Selects the priority lane. Producers request; Ingress may clamp per Trust policy. |
| `notBefore` | ISO-8601 datetime | no | Delayed execution: do not deliver before this instant. Absent ⇒ immediate. |
| `dedupKey` | string | no | Producer-supplied idempotent-publish key. Duplicate within the dedup window (default 24h, per type) ⇒ publish is a no-op returning the original `eventId`. |
| `orderingKey` | string | no | Per-key ordered delivery within a lane. Defaults to `correlationId`. |
| `subject` | object | no | The entity the event is about: `{ kind, id }`, e.g. `{ kind: "project", id: "school-app" }`, `{ kind: "workPackage", id: "wp_..." }`. Enables entity-scoped filters. |
| `redelivery` | object | no | Set only by the bus on replay/redelivery: `{ attempt, reason, originalDeliveryAt }`. Never set by producers. |
| `signature` | string | no | Optional producer signature for events crossing trust boundaries (webhook bridges). Verified by Ingress against Trust. |

Envelope rules:

- `strict` schema — unknown top-level fields are rejected (no envelope drift).
- The envelope is immutable after Ingress accepts it. Redelivery metadata lives
  outside the original envelope in the delivery record; `redelivery` is attached
  only on the wire copy.
- Producers never set `eventId`, `rootEventId`, or `redelivery`.

## 2. Correlation, causation, and the event tree

Three distinct notions, all mandatory to keep straight:

- **`correlationId` — the workflow.** Assigned once at the edge (e.g. Control API
  intake) and copied verbatim onto every subsequent command and event in the flow.
  Query "everything about this request" = query by `correlationId`.
- **`causationId` — the immediate cause.** Points at whichever message id
  (command or event) the producer was handling. Gives the *why* for a single hop.
- **`parentEventId` / `rootEventId` — the event tree.** Parent-child is an
  event-to-event relation forming a forest per correlation:

```
work.feature.requested  (root: self)
├── work.feature.planned            parent = requested
│   └── specialist.engineering.completed   parent = planned
│       ├── specialist.qa.completed        parent = eng.completed
│       │   └── quality.tests.failed       parent = qa.completed
│       ├── specialist.security.completed  parent = eng.completed
│       └── specialist.seo.completed       parent = eng.completed
```

Rules:

- A child's `correlationId` MUST equal its parent's (Ingress rejects mismatches).
- `rootEventId` is derived by Ingress, never trusted from the producer.
- Tree depth is capped (default 64) to catch cycles/runaway loops; exceeding it is
  an Ingress rejection and an operator alert (`fabric.event.loop_suspected`).
- Fan-in (an event conceptually caused by *several* parents, e.g. "all three
  reviews completed") keeps a single `parentEventId` (the last-arriving trigger)
  and lists the others in `payload.joinedEventIds`. Trees stay trees.

## 3. Payload schemas and versioning

- Every event type in `EVENT_TYPES.md` declares a payload schema in
  `packages/contracts`. Publishing a payload that fails its type's schema is an
  Ingress rejection (`fabric.schema.incompatible`).
- Payload schemas are versioned **with the type name**, not the envelope:
  breaking changes mint a new type (`work.feature.requested.v2`) rather than
  mutating the existing one. Additive optional fields are allowed in place.
- Deprecation: a type marked deprecated keeps flowing for one deprecation window
  (default 2 minor releases); the Registry warns on subscriptions to it.
- Payloads carry **references, not blobs**: artifacts go through the Artifact
  domain and are referenced by `artifactId`. Envelope size cap 256 KiB.

## 4. Identity and time

- Ids are ULIDs (sortable, collision-safe, no coordination).
- `occurredAt` is the producer's fact time; Ingress also records `recordedAt`
  (bus receipt) in the history row. Ordering decisions use `recordedAt`;
  business logic uses `occurredAt`.
- Dedup window and schedule release both operate on bus time.

## 5. History record (persisted superset)

The Event History Store persists the envelope plus bus-side metadata (not on the
wire):

| Field | Description |
| --- | --- |
| `recordedAt` | Ingress receipt time. |
| `laneSubject` | Concrete broker subject the event was published on. |
| `deliveries[]` | Per-subscription delivery attempts: subscriptionId, attempt, outcome (`acked\|nakked\|termed\|dlq`), error, timestamps. |
| `scheduleState` | For delayed events: `pending\|released\|cancelled`. |
| `dedupHits` | Count of suppressed duplicate publishes. |

## 6. Example envelope

```json
{
  "eventId": "01J1ZK9W7QW3X8B2M4N5P6R7S8",
  "schemaVersion": "1.0.0",
  "name": "specialist.qa.completed",
  "occurredAt": "2026-07-25T03:12:45.120+05:00",
  "producer": "specialist:qa.verify",
  "correlationId": "corr_intake_9f3a",
  "causationId": "01J1ZK8...",
  "parentEventId": "01J1ZK8...",
  "rootEventId": "01J1ZJX...",
  "priority": "normal",
  "subject": { "kind": "project", "id": "school-app" },
  "payload": {
    "workPackageId": "wp_qa_118",
    "verdict": "pass",
    "suites": ["phpunit", "playwright"],
    "artifactId": "art_qa_evidence_552"
  }
}
```

## Metadata

```yaml
version: 1.0.0
status: proposed
wire_sot: packages/contracts (to be extended per IMPLEMENTATION_PLAN.md)
last_reviewed: 2026-07-25
```
