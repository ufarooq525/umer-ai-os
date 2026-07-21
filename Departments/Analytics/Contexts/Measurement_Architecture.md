# Bounded Context: Measurement Architecture

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

## Purpose

Own the shared language of measurement — entities, events, metrics — so every Department stops inventing private definitions.

## Owns

Event Taxonomy, Metric Dictionary, Instrumentation Specs.

## Does Not Own

Business Case metrics judgment; SLO records; Governance KPI framework rules.

## Interfaces

Produces Specs for Eng; Dictionary for Business/Governance consumers; Constrained by Security PII flags.

## Primary Artifacts

Event Taxonomy, Metric Dictionary, Instrumentation Spec.

## Anti-Patterns

Unversioned breaking event changes; metrics without formulas/sources.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics / Measurement Architecture
```
