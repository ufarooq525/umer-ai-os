# Bounded Context: Production Observability

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Purpose

Own system-level operability signal — SLOs, error budgets, telemetry for running Services. Distinct from `Departments/Analytics` (business/product measurement) and from `Business/Contexts/Portfolio_Analytics.md` (value realization).

## Owns

SLO/Error Budget Records, system Telemetry Specs, restore signal partnerships with Release Runbooks.

## Does Not Own

Business KPI definitions (Business/Analytics); product experiment analysis (Analytics); security detection control ownership (Security); customer comms (Support future).

## Interfaces

Consumes Application Delivery instrumentation; supplies signal to Engineering operating decisions, QA non-functional assessment, Executive health views; partners with Analytics on event boundary clarity.

## Primary Artifacts

SLO/Error Budget Record, Telemetry & Instrumentation Spec (system portion).

## Anti-Patterns

Dashboard theater; conflating Analytics with Observability; SLOs without owners; ignoring error budgets when shipping.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering / Production Observability
```
