# QA Operating Model

Governed by `Departments/QA/QA_CHARTER.md`.

## How Work Enters

Primary: Engineering Handoff Package on an Execution instance (Release Candidate + contracts + Eng evidence + caveats). QA validates entry per `Execution/DEPARTMENT_HANDOFFS.md` before acknowledging ownership.

Also enters: Design experience criteria (Enabling), Security-required verification procedures (Constraining/Enabling), Analytics measurement acceptance when in success criteria.

## How Work Moves Internally

```text
Quality Strategy & Gates → Verification & Validation
                ↓                    ↓
     Non-Functional Quality    Release Validation
                ↓
        Quality Intelligence (signals out)
```

## How Work Exits

- **Pass path:** Release Validation Record + gate evidence into Execution / release RACI consumers (CEO, Eng, CoS as applicable).  
- **Fail path:** Itemized rejection — ownership returns to Engineering (or Design if design-defect class).  
- **Learning path:** defect themes to Intelligence / Governance continuous improvement — not a private QA wiki empire.

## Decision Boundaries

| Decision | Owner |
|---|---|
| Pass/Fail/N/A on applicable gates for a candidate | QA Accountable for verification judgment |
| Waiving a Core gate | Not QA alone — Governance/Quality waiver path + risk acceptance |
| Scope of what “done” means (product) | Business/Executive acceptance criteria — QA verifies against them |
| Security control adequacy | Security |
| Schedule pressure vs quality | Escalate trade-off to CEO; QA does not silently drop gates |

## Escalation

Chronic Eng→QA reject loops → CoS process audit; disputed gate applicability → Core/Governance; production escape → joint Eng+QA with Risk framework; capacity → PM.

## Cadence

Per-instance validation; Weekly escape/reject trends; Monthly gate compliance; Quarterly DAS/Heat Map; Annual independence review (is QA still independent?).

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA, Project Manager, Chief of Staff
```
