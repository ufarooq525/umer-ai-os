# Runtime Domain: Message Fabric

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Communication Bus + Event Bus.

## Purpose
Provide one fabric with two planes — synchronous command/query and asynchronous events — so Runtime domains do not invent private channels.

## Owns
Command/query routing; event topics/schemas; delivery guarantees classes (at-least-once / exactly-once *where declared*); subscription authz via Trust; dead-letter handling; correlation/causation IDs.

## Explicitly Does Not Own
Business notification content; Executive meeting cadence; Department chat culture; Analytics product event taxonomy (Analytics owns product events — Fabric may transport OS-runtime events only, or carry product events under Analytics contracts without owning definitions).

## Inputs
Publish/subscribe/request calls from Runtime domains; Trust authz; schema registry entries.

## Outputs
Delivered messages; ack/nack; dead-letter events; fabric health signals.

## Runtime Artifacts
Message Envelope, Event Schema, Subscription Record, Dead-Letter Record.

## Runtime Events
`fabric.message.delivered|failed`, `fabric.event.published`, `fabric.dlq.enqueued`, `fabric.schema.incompatible`.

## Interfaces
All Runtime domains; Audit (security-relevant); Observability; external Extension adapters (bridged, not raw).

## Dependencies
Kernel, Trust, Audit, Observability.

## Failure Modes
Dual buses with divergent truth; fire-and-forget for approvals; schema-free events; cross-tenant delivery.

## Metrics
Delivery failure rate; DLQ depth/age; schema incompatibility rate; p95 command latency.

## Anti-Patterns
Side-channel Department APIs bypassing Fabric for Runtime coordination; using Fabric to silently waive gates.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
