# Runtime Domain: Extension Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Plugin Runtime + External Integration Runtime.

## Purpose
Load, isolate, version, and invoke plugins and external system adapters under Trust scopes — the controlled extension surface for a decade of integrations without forking the kernel.

## Owns
Plugin lifecycle (load/unload); adapter contracts; egress controls; webhook ingress authentication; idempotency keys for external side effects; extension health probes.

## Explicitly Does Not Own
Third-party product roadmaps; Department business logic; Security control design; Marketing integrations ownership (later Departments use Extension under contracts).

## Inputs
Plugin packages/manifests; external credentials *handles* via Trust; Orchestration/Agent invoke requests; Resource quotas.

## Outputs
Extension call results; side-effect receipts; egress deny events.

## Runtime Artifacts
Plugin Package Record, Adapter Contract, Egress Receipt, Idempotency Record.

## Runtime Events
`ext.loaded|unloaded`, `ext.invoked`, `ext.egress.allowed|denied`, `ext.side_effect.recorded`, `ext.health.failed`.

## Interfaces
Registry Fabric; Trust; Agent Runtime; Orchestration; Resource & Economy; Audit; Resilience (retries with idempotency).

## Dependencies
Kernel, Trust, Registry Fabric, Audit, Message Fabric, Resource & Economy, Resilience.

## Failure Modes
Unsigned plugins; egress without allowlist; non-idempotent retries causing double charges; plugins calling Model Routing secretly.

## Metrics
Egress deny rate; plugin crash rate; duplicate side-effect rate; load success rate.

## Anti-Patterns
Installing plugins that bypass Control Plane; “temporary” curl from Agents; per-tenant unsigned code execution without sandbox.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
