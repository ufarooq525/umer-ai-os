# Runtime Domain: Trust Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Absorbs Identity + Permission + Security *enforcement* candidates.

## Purpose
Enforce identity, authentication, authorization, and Security-Department control requirements at every Runtime invocation boundary.

## Owns
Principal identity binding for runs/sessions; permission checks; secret handle resolution (not secret storage policy authorship); enforcement of Security Specs/Control requirements at call time; sandbox boundary checks for Agent/Tool invocation.

## Explicitly Does Not Own
Security control *design* (`Departments/Security`); org risk appetite (`Governance/`); Agent mandate text (`Core/AGENT_SPECIFICATION`); human HR identity systems (future IT) beyond Runtime principal mapping.

## Inputs
Identity assertions; Permission policies (from Governance/Security); Security Control Specs; invocation requests from Agent/Extension/Orchestration.

## Outputs
Allow/Deny decisions; attested caller context; security violation events.

## Interfaces
Security Dept (Constraining requirements); Governance (access policy); Agent Runtime / Extension / Orchestration (PEP calls); Audit (all denies of consequence).

## Runtime Artifacts
Principal Binding, Permission Decision Record, Sandbox Attestation.

## Runtime Events
`trust.allow`, `trust.deny`, `trust.sandbox.violated`, `trust.principal.bound`.

## Dependencies
Kernel; Audit; Control Plane (for approval-gated elevations); Registry Fabric (tool permission scopes).

## Failure Modes
Fail-open allows; permission cache poisoning; Security Specs not loaded; dual identity stores.

## Metrics
Deny rate by class; authn failure rate; time-to-decision p95; sandbox violation count; fail-open incidents (target 0).

## Anti-Patterns
Trust Runtime inventing controls; bypass paths “for Agents”; embedding Security Architecture inside Kernel without Security Dept.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
