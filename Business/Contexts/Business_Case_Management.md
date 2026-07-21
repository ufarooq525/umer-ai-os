# Bounded Context: Business Case Management

> Ensures every investment is economically justified before it's funded — the context that turns a scored Opportunity Record (Portfolio Management) into a rigorous ROI/cost-benefit case, and the primary producer of the immutable, outcome-tracked artifacts `Intelligence/DECISION_INTELLIGENCE.md` later evaluates.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`, `Business/BUSINESS_ARTIFACT_STANDARDS.md` (the Business Case artifact's immutability rule).

## Purpose

Answer "is this specific investment actually worth it, in concrete economic terms" — the rigor layer between "this is a promising, prioritized opportunity" (Portfolio Management) and "we are funding this" (CEO decision, per `Business/LAYER_INTERFACES.md`).

## Owns

- ROI modeling
- Cost-benefit analysis
- Expected outcomes (falsifiable, per Outcome Definition artifacts)
- Financial assumptions (stated explicitly, sourced)
- Strategic alignment verification (does this trace to a current Strategic Theme — checked here as a Business Case completeness requirement, even though Strategy owns the themes themselves)

## Does Not Own

- The opportunity scoring that precedes this stage (Portfolio Management)
- Actual investment approval (CEO, per `Business/LAYER_INTERFACES.md`'s Executive interface — Business Case Management builds the case, it doesn't ratify it)
- Ongoing performance tracking post-investment (Portfolio Analytics — Business Case Management sets the *expected* value; Portfolio Analytics measures the *realized* value against it)

## Key Artifacts

- **Business Case** — the full ROI/cost-benefit/assumptions package, per `Business/BUSINESS_ARTIFACT_STANDARDS.md`'s template and immutability rule
- **Investment Proposal** — the funding ask built from an Approved Business Case, immutable once Decided
- **Outcome Definition** — a falsifiable statement of what success looks like, fixed before funding (never added retroactively — this is explicitly checked by `Business/BUSINESS_METRICS.md`'s "% Initiatives With Measurable Outcomes" metric)
- **Success Criteria** — held to the same rigor as `Executive/Project_Manager/Templates/Task.md` acceptance criteria

## Evidence Discipline

Every financial assumption in a Business Case cites its source — a Revenue Model from Commercial Strategy, a market size from Market Intelligence's Market Opportunity Model, a cost estimate from an Architecture spike (`Execution/WORKFLOW_ENGINE.md`'s Research/Architecture stages, if the opportunity has progressed that far). A Business Case built on unsourced assumptions is incomplete, per `Business/BUSINESS_ARTIFACT_STANDARDS.md`'s `evidence_sources` requirement — and per `Core/COMMUNICATION_STANDARD.md`, an unstated assumption anywhere in this chain is a communication failure, not a minor gap.

## Immutability and Outcome Tracking

Once Approved, a Business Case is never edited — a materially changed understanding produces a new version with a supersession link, exactly like an ADR (`Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md`). This is what makes it usable by `Intelligence/DECISION_INTELLIGENCE.md`: the Business Case's original projection stays fixed so Portfolio Analytics' later "realized vs. expected" comparison (`Business/Contexts/Portfolio_Analytics.md`) is comparing against a stable baseline, not a moving target quietly adjusted to match reality after the fact.

## Interfaces

- **Consumes from:** Portfolio Management (scored Opportunity Records), Commercial Strategy (Revenue Models), Market Intelligence (market sizing), Strategy (theme alignment check)
- **Produces for:** `Executive/CEO/CEO_AGENT.md` (the Investment Proposal as the CEO's decision input), `Governance/DECISION_LOG_STANDARD.md` (the resulting funding decision is logged there, cross-linked back to this Business Case), Portfolio Analytics (the baseline it measures actuals against)

## Review Cadence

A Business Case's stated Review Cadence/Revisit Trigger (mirroring `Governance/DECISION_LOG_STANDARD.md`'s own requirement) is checked at Quarterly Business Review — an approved case with no realized outcome data yet stays `pending` in `Intelligence/DECISION_INTELLIGENCE.md`'s tracking exactly as any other decision would.

## Anti-Patterns

- **Editing an Approved Business Case to match how things turned out.** Destroys the entire point of immutability — supersede instead, and let the discrepancy show up honestly in Portfolio Analytics.
- **A Business Case with an unfalsifiable Outcome Definition** ("this will improve customer satisfaction") instead of a measurable one ("NPS increases by X points within 6 months of launch, measured via [instrumented mechanism]").
- **Skipping strategic alignment verification because the opportunity already scored well in Portfolio Management.** The two checks are related but distinct — a well-scored opportunity can still fail to trace to any current Strategic Theme, which is itself information the CEO needs before funding.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Business Case Management)
```
