# Engineering Metrics

> Department metrics conforming to `Governance/KPI_FRAMEWORK.md` and `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`. No story points or velocity theater as primary KPIs.

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Department Health

| KPI | Formula / definition | Type | Counter-metric |
|---|---|---|---|
| Capacity honesty | Declared WIP vs completed exits per period; unexplained overrun rate | Leading | Lead time |
| Context coverage | % primary Capabilities with Staffed context ownership | Leading | Handoff rejection rate |

## Organizational Effectiveness

| KPI | Formula / definition | Type | Counter-metric |
|---|---|---|---|
| Lead time | Task/instance start → production | Leading | Escaped defects |
| Business-traceable work ratio | % active items with named Business Intent source | Leading | Untethered rework incidents |

## Quality

| KPI | Formula / definition | Type | Counter-metric |
|---|---|---|---|
| Escaped defect rate | Production defects / defects found pre-production | Lagging | Lead time |
| Eng→QA handoff acceptance rate | Accepted first-pass / total handoffs | Leading | Rework cycles |
| Gate compliance | % deliverables with explicit Pass/Fail/N/A on applicable Quality gates | Leading | — |

## Capability Maturity

| KPI | Formula / definition | Type | Counter-metric |
|---|---|---|---|
| Capability realization clarity | % bound Capabilities with Clearly Owned on Heat Map | Lagging | Dual-ownership incidents |
| Reference architecture adoption | % new services conforming to an accepted Reference Architecture | Leading | Exception count |

## Operational Excellence

| KPI | Formula / definition | Type | Counter-metric |
|---|---|---|---|
| Change fail rate | Failed changes / total changes | Lagging | Deployment frequency |
| Deployment frequency | Production-affecting releases per period | Leading | Change fail rate |
| SLO attainment / error budget burn | Per published SLO | Lagging | Feature throughput |
| MTTR | Detect → restore for Engineering-owned systems | Lagging | Change fail rate |
| Tech debt burn-down vs intake | Closed debt items / new debt items (risk-weighted) | Leading | Feature throughput |
| Platform golden-path adoption | % services on golden path | Leading | Shadow-tooling incidents |
| CI friction | Median CI wait + flake rate | Leading | Deployment frequency |

## Review Cadence

Weekly operational signals; Monthly Department review; Quarterly roll-up into Governance KPI reviews and Capability Heat Map refresh.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering, Chief of Staff (KPI design compliance)
```
