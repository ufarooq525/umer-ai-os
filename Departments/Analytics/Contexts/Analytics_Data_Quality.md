# Bounded Context: Analytics Data Quality

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

## Purpose

Keep the measurement plane trustworthy — detect, own, and age data quality breaches against published rules.

## Owns

Analytics Data Quality Rules, quality incident signals for the analytics plane.

## Does Not Own

Production system reliability (Eng Observability); Security incident command; Business interpretation of bad outcomes.

## Interfaces

Monitors Taxonomy compliance; opens remediation via Execution to Eng; escalates PII anomalies to Security.

## Primary Artifacts

Analytics Data Quality Rule; quality incidents (durable when elevated to Governance/Intelligence as needed).

## Anti-Patterns

Quality rules without owners/SLAs; silent backfills that rewrite Experiment Results history.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics / Analytics Data Quality
```
