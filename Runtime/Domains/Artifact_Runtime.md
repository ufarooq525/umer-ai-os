# Runtime Domain: Artifact Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Mechanics for `Execution/ARTIFACT_CONTRACTS.md`.

## Purpose
Store, version, validate-shape, transfer, and immutably seal artifacts that move across handoffs — without owning artifact *type meaning* registries’ organizational authorship beyond mechanical enforcement.

## Owns
Artifact object storage handles; version lineage; schema validation against registered types; transfer packages for handoffs; immutability seals for Accepted/Approved artifacts; retention pointers per Document Lifecycle mechanical hooks.

## Explicitly Does Not Own
Artifact type registry *policy* authorship (`Execution/ARTIFACT_CONTRACTS` + Department registries); Business Case meaning; Design System content authorship; QA Pass judgment.

## Inputs
Produce/consume requests from Departments/Agents; type schemas from registries; handoff package assemblies; Control Plane acceptance status.

## Outputs
Artifact handles; validation results; transfer receipts; seal records.

## Runtime Artifacts
Artifact Object, Artifact Version, Transfer Receipt, Immutability Seal.

## Runtime Events
`artifact.created`, `artifact.validated|rejected`, `artifact.transferred`, `artifact.sealed`, `artifact.superseded`.

## Interfaces
Execution contracts; Orchestration; Context (links); Agent Runtime; Audit; Trust (access); Departments as producers/consumers.

## Dependencies
Kernel, Trust, Audit, Message Fabric, Registry Fabric (type IDs).

## Failure Modes
Mutable “Accepted” artifacts; untyped blobs in handoffs; lost lineage; Department-private artifact stores as SoR.

## Metrics
Validation fail rate; seal violation attempts (0); transfer fail rate; orphan artifact rate.

## Anti-Patterns
Chat attachments as system of record; editing sealed artifacts in place; Artifact Runtime deciding quality Pass/Fail.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
