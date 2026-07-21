# Runtime Contracts

> Typed contracts between Runtime domains and between Runtime and completed layers. Architecture only — no API code.

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.

## A. Cross-Layer Contracts

| Contract | Provider | Consumer | Guarantee |
|---|---|---|---|
| Execution Instance Binding | Execution semantics | Orchestration | Every Run Record maps to exactly one organizational instance ID |
| Context Package Schema | Execution Context Management | Context Runtime | Required fields never dropped by compaction |
| Artifact Type Registry | Execution + Department registries | Artifact Runtime | Validate-before-seal |
| Approval Gate Spec | Execution Approval Gates | Control Plane | Wait/pass/fail only; no invented gates |
| Failure Category Map | Execution Failure Recovery | Resilience | Mechanical actions only after org authority |
| Intelligence Retrieval Contract | Intelligence | Memory Access | Citations mandatory; SoR remains Intelligence |
| Capability Noun Contract | Enterprise Architecture | Registry Fabric Resolver | No undeclared Capabilities |
| Policy Bundle Contract | Governance | Control Plane | Version-pinned evaluation |
| Control Requirements Contract | Security Department | Trust Runtime | Enforce; do not author |
| Agent Spec Binding | Core Agent Specification | Agent Runtime | Spec hash/version attested at run start |
| Human Irreversible Wait | Constitution §5 | Session HITL + Control Plane | No auto-approve |

## B. Inter-Domain Contracts (Runtime)

| From → To | Contract |
|---|---|
| Orchestration → Agent | Dispatch: mandate, context handle, tool allowlist, budget |
| Agent → Model Routing | Invoke: task class, constraints, max cost |
| Agent → Registry | Resolve tool/skill |
| Agent → Extension | Invoke adapter with idempotency key |
| Any → Trust | Check(principal, action, resource) → allow/deny |
| Orchestration → Control | Evaluate(gate, evidence refs) → wait/pass/fail |
| Any consequential → Audit | Append(event) immutable |
| Any → Economy | Admit/charge(usage) |
| Resilience → Orchestration | Restore(checkpoint) / Retry(policy) |
| Message Fabric | Envelope: correlation_id, tenant_id, causation_id, authz |

## C. Non-Contracts (Forbidden Couplings)

- Agent → Intelligence DB directly (must use Memory Access)  
- Model Routing → approve gates  
- Economy → change Business scope  
- Observability → waive Trust  
- Extension → raw kernel config mutation  

## D. Versioning

All contracts carry `contract_version`. Breaking changes require RFC if cross-layer; Runtime-internal major versions require Charter steward approval + Audit of migration.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Chief Platform Architect, Chief of Staff (cross-layer audit)
```
