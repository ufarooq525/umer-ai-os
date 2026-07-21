# Runtime Domain: Resource & Economy Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Cost Management, Resource Allocation, Performance Optimization.

## Purpose
Allocate compute/model/tool quotas, enforce cost envelopes, and apply performance policies so the OS remains economically sustainable and fair across tenants and Departments.

## Owns
Quota plans; budget envelopes per tenant/run/Department; admission control under saturation; cost accounting from Model Routing and Tools; performance policy hooks (rate limits, concurrency caps); optimization *recommendations* that never bypass Control Plane/Trust.

## Explicitly Does Not Own
Business investment budgets (`Business/`/Finance later); Engineering product infra cost accounting (may share signals); priority scoring formula (`Execution/PRIORITY_FRAMEWORK`).

## Inputs
Usage events; priority scores; tenant plans; Governance spend policies; Observability saturation signals.

## Outputs
Admission allow/deny; throttle signals; cost ledgers; allocation decisions.

## Runtime Artifacts
Quota Plan, Cost Ledger Entry, Admission Decision, Throttle Policy.

## Runtime Events
`economy.admitted|rejected`, `economy.throttle`, `economy.budget_warning|exceeded`, `economy.quota_adjusted`.

## Interfaces
Model Routing; Orchestration; Extension; Kernel; Governance spend rules; Audit; Observability; Executive (capacity visibility — not dual PM).

## Dependencies
Kernel, Trust, Audit, Observability, Message Fabric.

## Failure Modes
Optimization that skips approvals to “save money”; noisy-neighbor without quotas; cost data without attribution; shadow cloud accounts.

## Metrics
Budget breach rate; rejection under saturation; cost per completed EXEC; fairness index across tenants; throttle effectiveness.

## Anti-Patterns
FinOps daemon changing product scope; per-Agent unlimited keys; performance tuning that disables Audit.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
