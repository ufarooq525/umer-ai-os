# Engineering Artifact Registry

> Durable enterprise artifacts Engineering is authoritative for. Extends `Execution/ARTIFACT_CONTRACTS.md`. Narrative-only docs are not registry entries.

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Registry

| Artifact | Owning context | Primary consumers | Versioning | Acceptance source |
|---|---|---|---|---|
| Solution Architecture Model | Solution Architecture | Eng, Design, QA, Security, EA (reference) | Semver; major on boundary break | Traces to Capability + initiative; trade-offs stated |
| System Map | Solution Architecture | Eng, QA, Security, Support (future) | Semver | Components, trust boundaries, data flows explicit |
| Reference Architecture | Solution Architecture | Application Delivery, Platform | Semver; low frequency | Fit-for-Capability classes named |
| ADR (technical) | Solution Architecture / Technical Stewardship | Governance ADR store, Eng | Immutable once Accepted; supersede not edit | Per `Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md` |
| API / Event / Interface Contract | Application Delivery | QA, Security, Analytics, peers | Semver; compatibility policy stated | Schema + semantics + owner |
| Implementation Package | Application Delivery | Release Engineering, QA | Linked to Execution instance | Builds from accepted contracts + Design when in scope |
| Engineering Test Evidence Bundle | Application Delivery | QA | Per change set | Scope of automation stated; not a substitute for QA authority |
| Platform Standard | Platform | Application Delivery, Release Engineering | Semver | Golden paths + exceptions process |
| Environment / Runtime Model | Platform | Release Engineering, Security | Semver | Promotion stages explicit |
| Release Model | Release Engineering | QA, Executive, Execution | Semver | Promotion + rollback + ownership |
| Release Candidate Record | Release Engineering | QA, Execution gates | Immutable per candidate | Linked artifacts + known caveats |
| Rollback / Runbook Model | Release Engineering + Observability | Eng, Support (future) | Semver | Tested restore path named |
| SLO / Error Budget Record | Production Observability | Eng, Executive, QA | Living + historical series | Formula + data source |
| Telemetry & Instrumentation Spec | Observability + Application Delivery | Analytics, Support (future) | Semver | Distinct business vs system signals |
| Technical Debt Register Entry | Technical Stewardship | Executive/Business prioritization | Living; history append-only | Cost-of-delay and risk stated |
| Engineering Standard | Technical Stewardship | Application Delivery | Semver | Refines Core/Standards; no contradiction |
| Feasibility / Constraint Note | Solution Architecture | Executive, Business | Dated | Explicit unknowns |

## Universal Header

```yaml
artifact_type: <from registry>
department: Engineering
bounded_context: <Contexts/*>
version: <per table>
produced_for: <Execution instance | Projects/<name>/ | Governance ADR | Capability>
acceptance_status: draft | submitted | accepted | rejected
```

## Single-Owner Rule

No other Department may publish a competing authoritative type with the same name. Consumers reference Engineering’s type. Shared *use* is allowed; shared *authorship authority* is not.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering, Chief of Staff (registry audit vs Execution/ARTIFACT_CONTRACTS.md)
```
