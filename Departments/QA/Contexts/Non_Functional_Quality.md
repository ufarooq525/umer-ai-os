# Bounded Context: Non-Functional Quality

Governed by `Departments/QA/QA_CHARTER.md`.

## Purpose

Assess performance, reliability, accessibility verification, and related NFRs against stated budgets and Design/Security intent.

## Owns

Non-Functional Assessment Reports for candidates.

## Does Not Own

SLO definition authority (Engineering Observability owns system SLOs; QA assesses release fit); Design System; Security control frameworks.

## Interfaces

Consumes Design a11y intent, Eng SLO/telemetry notes, Security procedures when relevant; produces NFR Reports for Release Validation.

## Primary Artifacts

Non-Functional Assessment Report.

## Anti-Patterns

NFR skipped under schedule; conflating Observability ownership with QA assessment.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA / Non-Functional Quality
```
