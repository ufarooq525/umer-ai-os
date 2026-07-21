# QA Artifact Registry

Governed by `Departments/QA/QA_CHARTER.md`.

| Artifact | Owning context | Consumers | Versioning | Acceptance |
|---|---|---|---|---|
| Quality Gate Plan | Quality Strategy & Gates | Eng, Execution | Semver per deliverable class | Maps each Core gate → evidence method |
| Test Suite (assurance) | Verification & Validation | QA, Eng (visibility) | Semver | Coverage intent vs criteria stated |
| Verification Record | Verification & Validation | Execution, Eng | Per candidate immutable | Pass/Fail/N/A explicit — no blanks |
| Non-Functional Assessment Report | Non-Functional Quality | Eng, Executive | Per candidate | Perf/a11y/reliability scope stated |
| Release Validation Record | Release Validation | Executive RACI, Execution | Immutable per candidate | Linked gate evidence complete |
| Defect Record | Verification & Quality Intelligence | Eng, Intelligence harvest | Living until closed | Severity, owner, escape flag |
| Quality Model (assurance) | Quality Strategy & Gates | QA, Governance | Semver low frequency | Independent from Eng testability model |

## Single-Owner Notes

Engineering owns Engineering Test Evidence Bundles (build-path). QA owns assurance Test Suites and Verification Records. Both may exist; they are not the same artifact type.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: QA
```
