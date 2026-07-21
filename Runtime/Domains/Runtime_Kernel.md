# Runtime Domain: Runtime Kernel

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.

## Purpose
Provide boot, tenancy isolation baselines, configuration of record for the kernel, hard safety stops, and the invariant surface every other Runtime domain depends on.

## Owns
Kernel boot sequence; tenant/partition baselines; kernel configuration schema; global kill/pause switches; process identity of the Runtime itself; admission that a run may exist at all.

## Explicitly Does Not Own
Business intent; Execution request semantics; Department delivery; Governance policy text; model selection (Model Routing); product SLOs (Engineering).

## Inputs
Deployment/environment declarations; ratified Runtime config; Trust attestations that kernel may start; Human Principal emergency stop signals.

## Outputs
Kernel-ready signal; tenant context handles; config snapshots; hard-stop events.

## Interfaces
Upstream: Core Constitution constraints, Governance emergency policies. Downstream: all Runtime domains. Side: Audit (boot/stop events), Observability (kernel health).

## Runtime Artifacts
Kernel Config Snapshot, Tenant Partition Record, Hard-Stop Record.

## Runtime Events
`kernel.booted`, `kernel.config.applied`, `kernel.hard_stop`, `tenant.partition.opened|closed`.

## Dependencies
None inside Runtime (root). Constrained by Core + Governance + Security requirements.

## Failure Modes
Split-brain config; tenant bleed; hard-stop ignored; config drift without version.

## Metrics
Boot success rate; config drift detections; hard-stop mean acknowledge time; tenant isolation violation count (target 0).

## Anti-Patterns
Kernel making routing/business decisions; per-Department private kernels; config-as-chat.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
