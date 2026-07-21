# Bounded Context: Portfolio Analytics

> Measures whether Business's decisions actually created value. The closing context in the Business layer's own internal loop — every other context proposes, evaluates, or decides; this one is the honest scoreboard that tells the rest of Business (and the CEO) whether those decisions were actually good ones.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`, `Business/BUSINESS_METRICS.md` (the metric formulas this context computes), `Intelligence/DECISION_INTELLIGENCE.md` (the outcome-tracking mechanism this context feeds).

## Purpose

Close the loop from investment decision to realized outcome — without this context, Business Case Management's projections and Portfolio Management's prioritization would never be checked against reality, and the whole layer would optimize on plausible-sounding reasoning rather than actual track record.

## Owns

- Portfolio performance measurement (aggregate, across all active investments)
- Product health scoring (per-product, feeding Portfolio Management's balance decisions)
- Strategic KPI computation (`Business/BUSINESS_METRICS.md`'s formulas — this context is where they're actually calculated, not just defined)
- Value realization tracking (realized vs. expected, per Business Case)

## Does Not Own

- Setting the expected value in the first place (Business Case Management — Portfolio Analytics measures against that fixed baseline, it doesn't set it)
- Deciding what to do with a bad result (Portfolio Management re-prioritizes; the CEO re-decides — Portfolio Analytics reports, it doesn't act)
- Raw usage/operational data collection (a future Analytics Department's instrumentation — Portfolio Analytics consumes that data and rolls it into business-meaningful metrics, per `Business/LAYER_INTERFACES.md`'s Department dependency table: "Analytics depends on Business to define meaningful business KPIs rather than purely operational metrics" — this context is the definer)

## Key Artifacts

- **Product Health Score** — formula and data source stated per `Business/BUSINESS_METRICS.md`; recomputed each cadence, historical series retained (never just a current snapshot — trend matters more than any single reading)
- **Portfolio Heat Map** — derived mechanically from Product Health Scores + investment data, never a subjective coloring
- **Realized vs. Expected Value reports** — the direct input to `Intelligence/DECISION_INTELLIGENCE.md`'s `outcome_status` field for every Business Case-linked decision

## The Honesty Requirement

This context's entire value depends on reporting what actually happened, not a flattering interpretation of it — mirroring `Executive/Project_Manager/PROJECT_MANAGER_AGENT.md`'s "ground-truth reporting over comfortable reporting" principle, applied at the portfolio-economic level instead of the sprint-status level. A Portfolio Analytics report that quietly reframes a missed target as "directionally positive" is a `Core/COMMUNICATION_STANDARD.md` honesty violation with outsized consequence, since it's the input every other Business context uses to calibrate its own future judgment.

## Interfaces

- **Consumes from:** Business Case Management (expected-value baselines), Product Management (product-level data), a future Analytics Department (raw usage/operational data), `Governance/KPI_FRAMEWORK.md` (existing financial KPIs — Revenue, MRR, Churn — as inputs to Product Health Score)
- **Produces for:** Portfolio Management (rebalancing input), `Intelligence/DECISION_INTELLIGENCE.md` (outcome_status for tracked decisions), CEO (via `Business/BUSINESS_METRICS.md`'s roll-up), Quarterly Business Review (`Governance/MEETING_OPERATING_SYSTEM.md`)

## Review Cadence

Product Health Scores and Portfolio Heat Map recomputed monthly; full Realized vs. Expected Value review at Quarterly Business Review, feeding directly into `Intelligence/DECISION_INTELLIGENCE.md`'s review-cadence enforcement for any Business Case whose stated review date falls in that quarter.

## Anti-Patterns

- **Reframing a miss as a near-win.** The single most damaging failure mode for this context specifically, since every other Business context's future calibration depends on this one reporting honestly.
- **Computing Product Health Score from a single metric.** Per `Business/BUSINESS_METRICS.md`'s design rules (inherited from `Governance/KPI_FRAMEWORK.md`), health scoring should reflect paired leading/lagging signals and counter-metrics, not one number that can be gamed.
- **Measuring only what's easy to measure.** If a Business Case's Outcome Definition requires an instrumentation effort that wasn't built, that gap is reported as "cannot yet measure," not silently substituted with an easier, less relevant proxy.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Portfolio Analytics)
```
