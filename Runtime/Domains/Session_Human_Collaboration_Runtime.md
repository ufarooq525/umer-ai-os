# Runtime Domain: Session & Human Collaboration Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Session Management + Human Collaboration Runtime.

## Purpose
Manage interactive sessions (human and Agent) and implement Constitution §5 human-in-the-loop waits — approvals, clarifications, irreversible action confirmation — as first-class Runtime states.

## Owns
Session lifecycle; participant binding; HITL wait objects; clarification threads bound to Execution instances; presence/timeout policies; secure handover between human principals and Agents within a session.

## Explicitly Does Not Own
Meeting Operating System cadence (`Governance/`); Executive decision judgment; Department expertise content; prompt UX copy as architecture.

## Inputs
Human messages; approval tasks from Control Plane; Orchestration clarification needs; Trust principals.

## Outputs
Session transcripts handles (not SoR for decisions); HITL resolutions; timeout escalations.

## Runtime Artifacts
Session Record, HITL Wait, Clarification Record, Session Handover Attestation.

## Runtime Events
`session.opened|closed`, `hitl.requested|resolved|timed_out`, `session.handover`, `clarification.answered`.

## Interfaces
Control Plane; Orchestration; Trust; Audit; Executive/Human Principal; Message Fabric.

## Dependencies
Kernel, Trust, Control Plane, Audit, Message Fabric, Resource & Economy (session quotas).

## Failure Modes
Approvals in ephemeral chat with no HITL Wait artifact; timeout without escalation; session spanning tenants; Agents “approving” as humans.

## Metrics
HITL time-to-resolve; timeout rate; unauthenticated approval attempts (0); session orphan rate.

## Anti-Patterns
Automating away irreversible confirmations; dual approval UX outside Control Plane; treating Session transcript as Decision Log.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
