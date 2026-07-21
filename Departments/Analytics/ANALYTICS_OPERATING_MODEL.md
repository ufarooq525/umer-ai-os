# Analytics Operating Model

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

## How Work Enters

Via Execution when measurement, experiment, or insight delivery is in initiative scope; standing Enabling work for metric dictionary and taxonomy evolution; Business requests for instrumentation to support Portfolio Analytics — still through Execution when it changes systems.

## How Work Moves Internally

```text
Measurement Architecture → Product Analytics
         ↓                      ↓
 Analytics Data Quality    Experimentation
         ↓                      ↓
              Attribution & Funnel Analytics
```

## How Work Exits

- Instrumentation Specs / Metric Dictionary → Engineering, Business  
- Analytics Models / Insight Artifacts → Business, Executive  
- Experiment Results (measurement-integrity certified) → Business Innovation / Portfolio  
- Data quality incidents → Eng/Security as applicable  

## Decision Boundaries

| Decision | Owner |
|---|---|
| Event taxonomy and metric definitions (product/ops) | Analytics |
| Whether a metric is a Governance KPI | Must satisfy KPI Framework; CoS/Governance audit |
| Business interpretation of value realized | Business Portfolio Analytics |
| SLO definitions | Engineering Observability |
| PII event allowance | Security Constraining |
| Roadmap priority for analytics work | Executive/Business via Execution |

## Escalation

Metric wars between Departments → CoS + Analytics dictionary arbitration; Security conflict on data → Security + risk path; capacity → PM.

## Cadence

Weekly instrumentation/quality; Monthly metric dictionary review with Business; Quarterly DAS/Heat Map; Annual taxonomy coherence.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics, Project Manager, Chief of Staff
```
