# Bounded Context: Release Engineering

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Purpose

Own the technical mechanics of promotion, release, and rollback — distinct from building features and from defining the Platform. Absorbs the release half of classical “DevOps.”

## Owns

Release Models, Release Candidate Records, Rollback/Runbook Models (with Observability), promotion stage mechanics.

## Does Not Own

Independent quality authority (QA); Executive go/no-go accountability; Platform substrate definition; product scope.

## Interfaces

Consumes Implementation Packages; produces Release Candidates for QA; executes promotions only under Execution gates and Org Chart release RACI.

## Primary Artifacts

Release Model, Release Candidate Record, Rollback/Runbook Model.

## Anti-Patterns

Release as paperwork without rollback; Release Engineering as a bottleneck that re-does QA; silent production changes outside Execution.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering / Release Engineering
```
