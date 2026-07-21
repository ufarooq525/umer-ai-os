# Engineering Interfaces

> Explicit contracts between Engineering and every layer/Department it touches. Extends — does not redefine — `Business/LAYER_INTERFACES.md`, `Execution/DEPARTMENT_HANDOFFS.md`, and `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`.

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Core → Engineering

**Core provides:** Constitution, Agent Specification (future Agents), Workflow Standard, Decision Framework, Output/Communication/Quality/Knowledge standards.

**Engineering cannot:** redefine Core; waive Quality gates by convenience; fabricate evidence; take irreversible action without authorization.

## Executive ↔ Engineering

| Executive asks / directs | Engineering answers / does |
|---|---|
| Mandate and scope trade-offs (CEO) | Feasibility, constraint notes, technical options with trade-offs |
| Schedule and capacity (PM) | Estimates, WIP, blockers, capacity signal |
| Process/doc audit (CoS) | Remediation of findings; no opt-out |

Engineering does not self-delegate cross-Department work or invent portfolio priorities.

## Governance → Engineering

Governance constrains: RACI, KPI Framework, Risk Management, Decision Log, ADRs, Document Lifecycle, Knowledge Governance.

Engineering logs technical ADRs per `Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md` and does not self-approve principal-level risk.

## Business → Engineering (Intent)

**Consumes:** Product priorities/roadmap and success criteria via approved initiatives (`Business/Contexts/Product_Management.md`, Business Case outcomes).

**Does not consume as orders:** raw Opportunity Records without Executive/Execution path.

**Traceability rule:** every in-flight Engineering work item names its Business Intent source.

## Execution ↔ Engineering (Runtime)

**Consumes:** request instances, priority scores, approval gates, context packages, failure/recovery procedures.

**Produces:** handoff packages, gate evidence Engineering owns, runtime progress signals.

**Forbidden:** executing delivery work outside an Execution instance.

## Enterprise Architecture → Engineering (Structural)

**Consumes:** Domain Map, Capability Model, Dependency Model, Taxonomy, Heat Map (descriptive).

**Produces:** proposals to realize Capabilities as Services; never silent local Capability invention — registry first.

## Intelligence ↔ Engineering (Evidence)

**Consumes:** patterns, best practices, case studies, decision intelligence.

**Produces:** harvested technical lessons post-delivery; ADRs as durable knowledge.

**Forbidden:** forking a parallel research/memory repository.

## Peer Departments

| Peer | Edge | Contract summary |
|---|---|---|
| Design | Sequential in | Design artifacts validated before build proceeds |
| QA | Sequential out | Release Candidate + evidence; QA validates independently |
| Security | Constraining + Enabling | Controls and threat requirements bound delivery; Eng implements |
| Analytics | Enabling | Instrumentation specs; Eng emits agreed events/signals |
| Marketing / Sales / Support / Finance / Operations | Out of Phase 2 staffing | Interfaces reserved: Informational/Enabling only when those Departments Charter; no Phase 2 Sequential dependence on them |

## Interface Completeness Rule

Every Peer edge Engineering declares must appear symmetrically on the peer’s Interface document once that peer is Chartered. Asymmetry is a Phase 2 verification defect.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering (stewardship), Chief of Staff (interface audit), CEO (ratification of material interface change)
```
