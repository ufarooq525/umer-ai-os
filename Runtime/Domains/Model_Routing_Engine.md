# Runtime Domain: Model Routing Engine

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.

## Purpose
Select and invoke AI model backends as replaceable dependencies based on task class, policy, cost envelopes, and quality constraints — so Agents and skills never hard-bind to a vendor model.

## Owns
Model catalog (mechanical); routing policies (Runtime-level); fallback chains; model invocation adapters; token/cost accounting hooks to Resource & Economy; safety filter hooks required before/after call as Trust/Control dictate.

## Explicitly Does Not Own
Agent judgment/mandate; Business decisions; Department standards content; prompt libraries as architecture; product LLM features owned by Engineering Application Delivery for *customer* products (distinct from OS kernel model use).

## Inputs
Task class / skill requirements; Trust allow; Resource quotas; Control Plane constraints; Observability feedback (error/latency).

## Outputs
Model invocation results; routing decision records; cost/usage events.

## Interfaces
Agent Runtime, Orchestration, Registry Fabric (skills declare model needs), Resource & Economy, Trust, Audit, Observability.

## Runtime Artifacts
Model Descriptor, Routing Decision Record, Model Invocation Record.

## Runtime Events
`model.routed`, `model.invoked`, `model.fallback`, `model.budget_exceeded`, `model.unsafe_blocked`.

## Dependencies
Kernel, Trust, Resource & Economy, Registry Fabric, Audit, Observability.

## Failure Modes
Hardcoded model IDs in Agents; silent fallback to weaker model on irreversible tasks; cost unbounded; routing without audit.

## Metrics
Fallback rate; p95 latency by class; cost per successful run; policy block rate; vendor concentration index.

## Anti-Patterns
“Default to newest model”; routing that bypasses Trust; Department-specific private routers.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
