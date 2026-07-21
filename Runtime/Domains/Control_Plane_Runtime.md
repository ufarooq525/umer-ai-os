# Runtime Domain: Control Plane Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Approval Engine + Policy Enforcement Engine.

## Purpose
Materialize Execution Approval Gates and Governance policies as mechanical wait-states, evaluations, and enforced decisions — without authoring policy or gate meaning.

## Owns
Policy Enforcement Points (PEP); approval wait-state machines; binding of gate evaluations to run state; waiver/exception *enforcement* of already-accepted Governance exceptions; escalation timers for stalled approvals.

## Explicitly Does Not Own
Gate *definitions* and organizational meaning (`Execution/APPROVAL_GATES.md`); policy *text* (`Governance/`); risk acceptance (`Governance` + Human/Executive RACI); QA Pass/Fail judgment content (QA supplies evidence; Control Plane records outcomes).

## Inputs
Execution gate requirements; Governance policy bundles; evidence references (QA/Security/Eng); approver decisions from Session/Human Collaboration; exception records.

## Outputs
Gate Pass/Fail/Wait; policy allow/deny; control-plane decision records consumed by Orchestration.

## Interfaces
Execution (semantics); Governance (policy bundles); Orchestration (blocks/releases stages); Trust (elevations); Audit; Human Collaboration (approval UX/session).

## Runtime Artifacts
Gate Evaluation Record, Policy Decision Point Record, Approval Wait Record.

## Runtime Events
`control.gate.wait|pass|fail`, `control.policy.allow|deny`, `control.approval.requested|resolved`, `control.exception.enforced`.

## Dependencies
Kernel, Trust, Message Fabric, Audit, Session & Human Collaboration.

## Failure Modes
Silent gate skip; policy not version-pinned; approval without authenticated principal; deadlock without escalation timer.

## Metrics
Gate skip incidents (0); median approval wait; stale approval rate; policy decision latency; exception usage rate.

## Anti-Patterns
Control Plane rewriting Quality Standard; auto-approving irreversible actions; parallel approval chats outside Runtime.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
