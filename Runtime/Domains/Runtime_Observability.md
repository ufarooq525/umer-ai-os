# Runtime Domain: Runtime Observability

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Execution Monitoring + Observability + Logging for the *kernel*.

## Purpose
Observe the health of the Runtime Platform itself — runs, buses, model calls, queues — distinct from Engineering product Observability and Analytics measurement.

## Owns
Platform metrics, traces, structured logs; run dashboards for kernel operators; SLO *for Runtime services*; alert routes for platform pages; correlation with Audit IDs (without becoming Audit).

## Explicitly Does Not Own
Product SLOs (`Departments/Engineering` Production Observability); business KPI definitions (`Analytics`/`Business`); Governance KPI Framework authorship; Security detection content ownership (may emit signals Security consumes).

## Inputs
Telemetry from all Runtime domains; Resource saturation; Trust denials (rate); Orchestration stuck signals.

## Outputs
Platform health views; alerts; trace spans; log streams; SLO burn signals for Runtime.

## Runtime Artifacts
Platform SLO Record, Trace Span, Structured Log Record, Platform Alert.

## Runtime Events
`obs.slo.burn`, `obs.alert.fired`, `obs.trace.exported` (mechanical).

## Interfaces
All Runtime domains; operators (CoS/platform stewards); Security (signal consumer); Engineering (boundary only).

## Dependencies
Kernel, Message Fabric, Audit (ID correlation).

## Failure Modes
Conflating product and platform SLOs; logs with secrets; observability that is the only audit trail; silent metric loss.

## Metrics
Platform SLO attainment; alert noise ratio; trace completeness; secret-in-log incidents (0).

## Anti-Patterns
One dashboard for “everything”; Agents writing printf as architecture; Observability authorizing deploys.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
