# Bounded Context: Verification & Validation

Governed by `Departments/QA/QA_CHARTER.md`.

## Purpose

Execute independent functional verification against acceptance criteria and produce Pass/Fail/N/A evidence.

## Owns

Assurance Test Suites, Verification Records, Defect Records (functional).

## Does Not Own

Implementation fixes (Engineering); requirement invention (Business); Security control design.

## Interfaces

Consumes Eng RC + criteria; produces Verification Records; rejects with itemization.

## Primary Artifacts

Test Suite (assurance), Verification Record, Defect Record.

## Anti-Patterns

Rubber-stamp Eng evidence; blank gates; defects without severity/owner.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA / Verification & Validation
```
