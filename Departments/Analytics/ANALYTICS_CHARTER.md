# Analytics Department Charter

> Analytics is the organizational owner of **measurement systems and analytical insight delivery** — event taxonomies, analytics models, experimentation operations, and attribution. It is not Business Portfolio Analytics (value vs investment), not Engineering Observability (system SLOs), and not Intelligence (organizational memory).

Governed by `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`. Domain: Analytics (Insight). Topology: **Cross-Cutting** (Insight) with Enabling edges into delivery and Business.

## Mission

> We exist to make organizational reality measurable and interpretable, by owning measurement architecture, product analytics, experimentation, attribution, and analytics data quality, so that Business can judge value, Engineering can instrument correctly, and Executive decisions rest on shared definitions rather than competing dashboards.

## Purpose

Provide a single authoritative measurement plane for product and operational analytics. Without Analytics, every Department invents metrics, Business cannot trust instrumentation, and Observability is mistaken for product insight.

## Primary Capabilities

| Capability | Notes |
|---|---|
| Analytics & Measurement | Registered — Insight; Analytics Department is primary Accountable for measurement systems & insight delivery |

**Explicit non-collision:** `Business/Contexts/Portfolio_Analytics.md` remains Accountable for **portfolio value realization vs Business Case** — it *consumes* Analytics outputs and Business-meaningful KPI definitions partnership, it does not own the measurement platform.

## Responsibilities

1. Measurement architecture (event taxonomy, entity model, metric dictionary)  
2. Product and operational analytics models and insight artifacts  
3. Experimentation design ops and experiment portfolio mechanics (business framing of bets may sit in Business Innovation — Analytics owns experiment measurement integrity)  
4. Attribution and funnel analytics models  
5. Analytics data quality rules and monitoring for the measurement plane  
6. Instrumentation contracts with Engineering; privacy constraints with Security  

## Does Not Own

| Temptation | Actual owner |
|---|---|
| Portfolio investment decisions / realized-vs-expected value judgment | `Business/Contexts/Portfolio_Analytics.md` / Portfolio Management |
| System SLO / error budget ownership | Engineering / Production Observability |
| Organizational memory repositories | Intelligence |
| KPI *governance design rules* | `Governance/KPI_FRAMEWORK.md` (Analytics metrics must conform) |
| Defining product strategy | Business |
| Implementing instrumentation in code | Engineering (per Analytics contracts) |
| Security/PII policy | Security / Governance |

## Lifecycle Status

```yaml
lifecycle: Chartered
das_maturity: 2
topology: Cross-Cutting
primary_domain: Analytics
```

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: CEO (mandate), Chief of Staff (DAS), Analytics (stewardship once Staffed)
```
