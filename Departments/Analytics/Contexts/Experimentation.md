# Bounded Context: Experimentation

Governed by `Departments/Analytics/ANALYTICS_CHARTER.md`.

## Purpose

Own experiment measurement integrity — design records, guardrails, result integrity — while Business owns whether to bet and how to interpret commercial meaning.

## Owns

Experiment Design Records, Experiment Result Records (integrity-certified).

## Does Not Own

Innovation pipeline funding (Business Innovation); Lab research ownership (Intelligence Innovation Lab); feature implementation (Engineering).

## Interfaces

Consumes Metric Dictionary; coordinates Eng for assignment/instrumentation; outputs Results to Business; harvests to Intelligence.

## Primary Artifacts

Experiment Design Record, Experiment Result Record.

## Anti-Patterns

Peeking / peeking-biased stops; primary metric switching post-hoc; experiments without guardrail metrics.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Analytics / Experimentation
```
