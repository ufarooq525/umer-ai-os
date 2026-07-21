# QA Interfaces

Governed by `Departments/QA/QA_CHARTER.md`.

## Layer Interfaces

| Layer | Contract |
|---|---|
| Core | Applies `QUALITY_STANDARD.md` gates; cannot redefine them |
| Executive | Provides validation status for release RACI; capacity to PM; audit to CoS |
| Governance | KPI, risk, decision/ADR where quality policy changes |
| Business | Verifies against Business success criteria; does not invent value metrics |
| Execution | Gate evidence producer; handoff consumer/producer; no side-channel “quiet ship” |
| Enterprise Architecture | Bound to Quality Assurance Capability |
| Intelligence | Consumes patterns; contributes defect/lesson harvest |

## Peer Interfaces

| Peer | Edge | Summary |
|---|---|---|
| Engineering | Sequential in | Accept/reject Release Candidates |
| Design | Enabling | Experience/a11y criteria |
| Security | Constraining / Enabling | Executes Security-specified verification where delegated; does not own control design |
| Analytics | Enabling | Validates measurement wiring when success criteria require it |

## Independence Rule

QA reporting judgment on gate Pass/Fail must not be overridden by Engineering preference without logged Executive/Governance path.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA, Chief of Staff
```
