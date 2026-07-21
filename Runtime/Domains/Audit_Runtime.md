# Runtime Domain: Audit Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.

## Purpose
Emit and retain immutable audit events for consequential Runtime actions so Governance Decision Log / ADR / compliance consumers can rely on a non-repudiable stream.

## Owns
Append-only audit log; event integrity (hash chaining or equivalent architectural guarantee); retention classes; query APIs for auditors; redaction rules that never rewrite history (issue superseding corrections).

## Explicitly Does Not Own
Decision *reasoning* documents (`Governance/DECISION_LOG_STANDARD`); ADR content; Security Incident narrative ownership; Session transcript SoR.

## Inputs
Consequential events from Trust, Control Plane, Orchestration, Artifact seals, Model Routing, Extension side effects, HITL resolutions, Kernel hard-stops.

## Outputs
Audit records; auditor query results; integrity attestations.

## Runtime Artifacts
Audit Event, Integrity Chain Head, Auditor Access Record.

## Runtime Events
`audit.appended`, `audit.integrity.verified|failed`, `audit.access.granted|denied`.

## Interfaces
Governance; Security; CoS; all Runtime domains (emitters); Trust (access to audit).

## Dependencies
Kernel, Trust; independent storage class from mutable run state.

## Failure Modes
Mutable audit; sampling that drops irreversible actions; audit stored only in vendor model logs; dual unsynced audit stores.

## Metrics
Integrity verify success; consequential-action coverage %; auditor query latency; tamper alarms (0 expected).

## Anti-Patterns
Using Observability logs as Audit; Agents deleting audit; “debug mode” disabling audit.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
