# Runtime Domain: Resilience Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Failure Recovery + Retry + Checkpoint. Implements `Execution/FAILURE_RECOVERY.md` mechanically.

## Purpose
Provide consistent retry, checkpoint, rollback hooks, and incident-run mode transitions for Runtime/Execution instances without redefining organizational recovery *categories*.

## Owns
Checkpoint snapshots of mechanical run state; retry policies (bounded); compensation/rollback hooks triggered by authorized Execution recovery decisions; poison-message isolation; degraded-mode switches.

## Explicitly Does Not Own
Whether organizational Rollback is warranted (`Execution/FAILURE_RECOVERY` + CEO); incident customer communication (Support later); product incident command (Engineering/Security as applicable).

## Inputs
Failure signals from Orchestration/Agent/Model/Extension; authorized recovery decisions; Resource constraints.

## Outputs
Checkpoint IDs; retry dispatches; rollback mechanical effects; resilience events.

## Runtime Artifacts
Checkpoint Record, Retry Policy Binding, Recovery Action Record.

## Runtime Events
`resilience.checkpointed`, `resilience.retry.scheduled|exhausted`, `resilience.rollback.applied`, `resilience.degraded.entered|exited`.

## Interfaces
Execution Failure Recovery (authority); Orchestration; Artifact (preserve/discards per decision); Control Plane; Audit; Observability; Human Collaboration for CEO approvals.

## Dependencies
Kernel, Orchestration, Artifact, Message Fabric, Audit, Trust, Control Plane.

## Failure Modes
Infinite retries; checkpoint without tenant isolation; mechanical rollback without CEO authorization when required; hiding failures from Audit.

## Metrics
Retry exhaust rate; checkpoint restore success; unauthorized rollback attempts (0); MTTR mechanical; degraded-mode duration.

## Anti-Patterns
Resilience auto-approving organizational Rollbacks; retrying irreversible external side effects without idempotency contracts.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
