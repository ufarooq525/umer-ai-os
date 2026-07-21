# Analytics Artifact Registry

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

| Artifact | Owning context | Consumers | Versioning | Acceptance |
|---|---|---|---|---|
| Event Taxonomy | Measurement Architecture | Eng, Design, QA, Business | Semver; breaking = major | Entities, properties, PII flags |
| Metric Dictionary | Measurement Architecture | Business, Eng, Governance KPI users | Semver | Formula + source + owner |
| Analytics Model | Product Analytics / Attribution | Business, Executive | Semver | Assumptions explicit |
| Instrumentation Spec | Measurement Architecture | Engineering, QA | Semver | Maps events → code touchpoints |
| Experiment Design Record | Experimentation | Business Innovation, Eng | Per experiment | Hypothesis + guardrails + primary metric |
| Experiment Result Record | Experimentation | Business, Intelligence harvest | Immutable per run | Integrity checks stated |
| Attribution Model | Attribution & Funnel Analytics | Business, Marketing (later) | Semver | Windowing + bias notes |
| Funnel Model | Attribution & Funnel Analytics | Business, Design, Eng | Semver | Steps mapped to Event Taxonomy |
| Analytics Data Quality Rule | Analytics Data Quality | Analytics, Eng | Semver | Detect → owner → SLA |
| Insight Artifact | Product Analytics | Executive, Business | Dated | Decision enabled named |

## Single-Owner Notes

- Business Case / Portfolio Heat Map / Product Health Score remain Business-owned.  
- SLO/Error Budget Records remain Engineering-owned.  
- Metric Dictionary may *feed* Governance KPIs; KPI Framework rules remain Governance-owned.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics
```
