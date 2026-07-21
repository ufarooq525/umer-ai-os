# Security Artifact Registry

Governed by `Departments/Security/SECURITY_CHARTER.md`.

| Artifact | Owning context | Consumers | Versioning | Acceptance |
|---|---|---|---|---|
| Threat Model | Security Architecture & Threat Modeling | Eng, Design, QA, Governance | Semver per system/Capability | Trust boundaries + abuse cases explicit |
| Security Architecture Model | Security Architecture & Threat Modeling | Eng, EA (ref) | Semver | Control placement mapped to System Map |
| Control Catalog Entry | Compliance & Control Assurance | Eng, QA, Governance | Semver | Testable control statement |
| Identity & Access Control Spec | Identity & Access Control | Eng, Design, QA | Semver | AuthN/AuthZ requirements testable |
| Application Security Requirements | Product & Application Security | Eng, QA | Semver per class | Mapped to Threat Model |
| Security Verification Procedure | Product & Application Security | QA | Semver | Steps + fail criteria |
| Assurance Evidence Pack | Compliance & Control Assurance | Governance | Per audit period / candidate | Linked controls |
| Vulnerability Record | Vulnerability & Security Response | Eng, Governance risk | Living until closed | Severity + owner + due |
| Security Incident Record | Vulnerability & Security Response | Executive, Governance, Intelligence harvest | Immutable timeline | Facts vs hypotheses separated |

## Single-Owner Notes

Governance Decision/Risk records remain Governance-owned. Security supplies Assurance Evidence into them — does not replace them.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Security
```
