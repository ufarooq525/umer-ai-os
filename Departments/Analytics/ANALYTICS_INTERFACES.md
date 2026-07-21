# Analytics Interfaces

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

## Layer Interfaces

| Layer | Contract |
|---|---|
| Core | Evidence and honesty rules; no fabricated metrics |
| Executive | Supplies decision-grade insight; does not autopilot decisions |
| Governance | KPI Framework conformance; risk on data misuse |
| Business | Partners on business-meaningful metrics; Portfolio Analytics consumes Analytics outputs for value judgment |
| Execution | Analytics work and instrumentation changes are instances — no shadow pipeline |
| Enterprise Architecture | Analytics & Measurement Capability binding |
| Intelligence | Consumes research; contributes analytical lessons; no fork of memory systems |

## Peer Interfaces

| Peer | Edge | Summary |
|---|---|---|
| Engineering | Enabling | Instrumentation Specs; Eng emits events; Observability boundary respected |
| Design | Enabling | Experience event intent for key flows |
| QA | Enabling | Validates measurement wiring when success criteria require |
| Security | Constraining | PII/data handling rules for events and warehouses-of-record semantics |

## Boundary Triad (Non-Negotiable)

```text
Business Portfolio Analytics  →  "Did the investment pay off?"
Analytics Department          →  "What happened, measured how, defined how?"
Engineering Observability     →  "Is the system healthy per SLOs?"
```

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics, Chief of Staff
```
