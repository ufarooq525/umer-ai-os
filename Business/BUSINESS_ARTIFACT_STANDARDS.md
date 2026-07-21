# Business Artifact Standards

> Business produces durable decision assets, not narrative documents — every artifact below is a registered type extending `Execution/ARTIFACT_CONTRACTS.md`'s registry, so a Business output can be validated at a handoff exactly like a Code or Test Plan artifact. This document is the Business-layer's contribution to that shared registry, not a parallel format.

Governed by `Execution/ARTIFACT_CONTRACTS.md` (the registry mechanics these extend), `Business/BUSINESS_LAYER_CHARTER.md`.

## Registry Extension

Every Business artifact type below is added to `Execution/ARTIFACT_CONTRACTS.md`'s Artifact Type Registry with the same five columns (produced by, format, versioning, acceptance criteria source):

| Type | Produced by (context) | Versioning | Acceptance criteria source |
|---|---|---|---|
| Opportunity Record | Opportunity Management (`Contexts/Portfolio_Management.md`) | Semver until Validated, then immutable | Problem validity + evidence per template below |
| Product Portfolio | Portfolio Management | Semver, reviewed quarterly | Balance across lifecycle stages stated explicitly |
| Capability Map | Product Management | Semver, low-frequency change | Every capability traces to a customer problem |
| Product Roadmap | Product Management | Semver | Every item traces to a validated opportunity or Business Case |
| Initiative Backlog | Portfolio Management | Living document, append-only history | Every item carries a Priority score (`Execution/PRIORITY_FRAMEWORK.md`) |
| Business Case | Business Case Management | Immutable once Approved, superseded not edited | ROI/cost-benefit/assumptions all stated, evidenced |
| Investment Proposal | Business Case Management | Immutable once Decided | Links to a Business Case |
| Market Opportunity Model | Market Intelligence | Dated, shelf-life stated (mirrors `Intelligence/RESEARCH_LIBRARY_STANDARD.md`) | Sourced from `Intelligence/` research, not invented |
| Customer Segmentation Model | Customer Strategy | Semver | Evidenced by real usage/research data |
| Journey Map | Customer Strategy | Semver | Grounded in observed or researched behavior, not assumed |
| Value Proposition Model | Customer Strategy | Semver | Tied to a specific segment and validated problem |
| Product Brief | Product Management | Semver | Traces to Roadmap item |
| Positioning Model | Commercial Strategy | Semver | Cross-checked against `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md` |
| Pricing Model | Commercial Strategy | Immutable once Approved, superseded not edited | Revenue model assumptions stated and evidenced |
| Packaging Model | Commercial Strategy | Semver | Tied to Segmentation Model |
| Revenue Model | Commercial Strategy | Semver | Assumptions stated, linked to Business Case |
| Go-to-Market Strategy | Commercial Strategy + Customer Strategy | Semver | Traces to Positioning + Roadmap |
| Product Lifecycle State | Portfolio Management | Living record, state-transition logged | Explicit stage (Incubating/Growth/Mature/Sunset) with criteria met |
| Product Health Score | Portfolio Analytics | Recomputed each cadence, historical series kept | Formula and data source stated (`Business/BUSINESS_METRICS.md`) |
| Portfolio Heat Map | Portfolio Analytics | Recomputed each cadence | Derived from Product Health Scores + Investment data, not subjective |
| Prioritization Matrix | Portfolio Management | Recomputed each cadence | Uses `Execution/PRIORITY_FRAMEWORK.md` scoring |
| Strategic Theme | Business Strategy | Semver, low-frequency change | Traces to `Core/AI_OS_CONSTITUTION.md` Vision/Mission |
| Outcome Definition | Business Case Management | Semver | Falsifiable, measurable |
| Success Criteria | Business Case Management | Immutable once tied to an approved initiative | Same rigor as `Executive/Project_Manager/Templates/Task.md` acceptance criteria |
| Experiment Portfolio | Innovation | Living document | Each entry links an `Intelligence/INNOVATION_LAB.md` record |
| Innovation Pipeline | Innovation | Living document | Stage per entry (Captured/Scored/Validating/Validated) |
| Competitive Positioning Map | Market Intelligence | Dated | Sourced from `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md` |
| Value Stream Map | Business Strategy | Semver, low-frequency change | Connects opportunity → delivery → customer outcome explicitly |

## Universal Business Artifact Header

Every artifact above carries this header, in addition to whatever `Execution/ARTIFACT_CONTRACTS.md`'s universal contract shape requires:

```yaml
artifact_type: <from the table above>
bounded_context: <one of the nine Business/Contexts/>
version: <per versioning column>
produced_by: Business
produced_for: <a decision, a Projects/<name>/, or Governance/Decisions/ entry — never "informational only">
evidence_sources: [<Intelligence/ links, or "primary research — link">]
acceptance_status: draft | submitted | accepted | rejected
```

`evidence_sources` is mandatory and specific to Business artifacts — per `Business/LAYER_INTERFACES.md`'s Intelligence boundary, a Business artifact with no evidence source is either pure assumption (flagged, per `Core/COMMUNICATION_STANDARD.md`) or a boundary violation (Business inventing research it should have sourced from Intelligence).

## Validation

A Business artifact is validated at any handoff (into Executive, into Execution, or between two Business bounded contexts) using the identical mechanism `Execution/ARTIFACT_CONTRACTS.md` already defines — registered type, complete header, acceptance criteria traced to source, applicable gates evaluated. No separate validation path is introduced; Business plugs into the existing mechanism.

## Immutability Rules

Following `Execution/ARTIFACT_CONTRACTS.md`'s pattern: **Business Cases, Investment Proposals, Pricing Models, and Success Criteria are immutable once Approved/Decided** — a change is a new version with an explicit supersession link (mirroring `Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md`'s ADR immutability), because these are exactly the artifacts `Intelligence/DECISION_INTELLIGENCE.md` later tracks for `outcome_status` (confirmed/contradicted) — an editable Business Case would corrupt that historical record.

## Worked Example

```yaml
artifact_type: Business Case
bounded_context: Business_Case_Management
version: 1.0.0 (Approved — immutable)
produced_by: Business
produced_for: Governance/Decisions/DEC-021-fleet-mgmt-saas-investment.md
evidence_sources:
  - Intelligence/ResearchLibrary/Market/fleet-management-2026-market-report.md
  - Intelligence/CompetitiveIntelligence/competitor-x.md
acceptance_status: accepted
```

```markdown
## ROI
Projected 18-month payback based on [market sizing link], assuming X% capture of SAM per [segmentation model link].

## Cost-Benefit
Estimated build cost per Architecture spike (Execution/WORKFLOW_ENGINE.md EXEC-203 Research stage) vs. projected Year-1 revenue per Revenue Model.

## Expected Outcomes
[Outcome Definition artifact link] — falsifiable: "X paying customers within 6 months of launch, or this investment is reassessed."

## Financial Assumptions
[stated explicitly, each sourced]

## Strategic Alignment
Traces to Strategic Theme: "Expand into adjacent SaaS verticals" (Business/Contexts/Strategy.md)
```

## Anti-Patterns

- **Narrative documents masquerading as artifacts.** A "strategy memo" with no registered type, no evidence sources, and no acceptance criteria is not a Business artifact under this standard — it's an unstructured note, and unstructured notes don't survive a handoff validation.
- **Missing evidence sources.** Any Business artifact making a market or customer claim without an `Intelligence/` link or explicit "primary research" citation.
- **Editing an Approved Business Case.** Exactly the same violation as editing an Accepted ADR — supersede instead.
- **Artifacts with no acceptance criteria.** A Product Brief or Roadmap item with no traceable link back to a validated Opportunity or Business Case is not ready to hand off.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (registry stewardship), Chief of Staff (registry compliance audit, per Execution/ARTIFACT_CONTRACTS.md)
```
