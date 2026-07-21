# QA Metrics

Governed by `Departments/QA/QA_CHARTER.md`, `Governance/KPI_FRAMEWORK.md`.

## Department Health

| KPI | Type | Counter |
|---|---|---|
| Gate plan coverage for active deliverable classes | Leading | Escape rate |
| Independence incidents (overridden fails without log) | Lagging | — |

## Organizational Effectiveness

| KPI | Type | Counter |
|---|---|---|
| Escaped defect rate (joint accountability with Eng) | Lagging | Test cycle time |
| Time ready-for-QA → validation complete | Leading | Escaped defects |

## Quality

| KPI | Type | Counter |
|---|---|---|
| Gate compliance rate (no blank gates) | Leading | — |
| Eng handoff rejection rate (quality of upstream) | Leading | Rework without learning |
| Defect reopen rate | Lagging | Cycle time |

## Capability Maturity

| KPI | Type | Counter |
|---|---|---|
| Heat Map Clearly Owned for Quality Assurance | Lagging | Partial ownership duration |

## Operational Excellence

| KPI | Type | Counter |
|---|---|---|
| % Release Candidates with complete Validation Record | Leading | Release rollback frequency |
| N-functional assessment coverage on designated risk classes | Leading | Production NFR incidents |

No story points / velocity as primary KPIs.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA
```
