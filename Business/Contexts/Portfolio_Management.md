# Bounded Context: Portfolio Management

> Optimizes the organization's investments across all opportunities and products at once. Where Product Management thinks in terms of one product's roadmap, Portfolio Management thinks in terms of the whole set — balance, capacity, and where the next dollar/effort is best spent across everything competing for it.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`.

## Purpose

Answer "given everything we could invest in, what's the best-balanced set to actually fund right now" — including opportunity discovery/evaluation/scoring, which sits here rather than in Product Management because a new opportunity often competes across product lines, not within one.

## Owns

- Opportunity discovery, evaluation, scoring, prioritization (before an opportunity is funded — this is the portfolio-wide funnel every candidate investment passes through)
- Portfolio strategy and balance (growth vs. maintenance vs. innovation, per `Business/BUSINESS_METRICS.md`'s Product Portfolio Balance metric)
- Investment balancing across competing opportunities
- Sunset decisions (when a product's lifecycle state, jointly tracked with Product Management, indicates it should be retired)
- Product hierarchy (how products/capabilities relate to each other at the portfolio level)
- Prioritization Matrix maintenance (using `Execution/PRIORITY_FRAMEWORK.md` scoring, portfolio-wide)

## Does Not Own

- Single-product roadmap detail (Product Management)
- The actual financial ROI model math (Business Case Management — Portfolio Management consumes Business Cases as scoring input, it doesn't build them)
- Approval of high-stakes reallocation (routed through `Governance/DECISION_LOG_STANDARD.md` and CEO, per `Business/LAYER_INTERFACES.md`)

## Owns: Opportunity Management (Detail)

An Opportunity Record is the first artifact any candidate investment takes, before it becomes a Business Case:

```markdown
# Opportunity Record: <name>
## Problem (from Customer Strategy)
## Market Context (from Market Intelligence)
## Initial Value Estimate
## Initial Effort/Risk Estimate
## Score (per Execution/PRIORITY_FRAMEWORK.md-style dimensions, portfolio-scoped)
## Status: Discovered | Evaluated | Scored | Prioritized | Promoted to Business Case | Rejected
```

This deliberately mirrors `Intelligence/INNOVATION_LAB.md`'s scoring shape — Portfolio Management is where a validated Innovation Lab experiment graduates into a scored, portfolio-competing Opportunity Record, not a separate re-invented scoring system.

## Key Artifacts

- **Opportunity Portfolio** — every live Opportunity Record, ranked
- **Product Portfolio** — every active product/initiative, with lifecycle state and health
- **Initiative Backlog** — the ranked queue of funded-but-not-yet-executing work, feeding `Execution/REQUEST_LIFECYCLE.md`
- **Prioritization Matrix** — the current ranked view across all competing opportunities
- **Product Lifecycle State** — jointly with Product Management

## Interfaces

- **Consumes from:** Innovation (validated experiments graduating into opportunities), Business Case Management (ROI evaluation per opportunity), Portfolio Analytics (health/performance data informing rebalancing), Strategy (theme-level allocation targets)
- **Produces for:** `Executive/CEO/CEO_AGENT.md` (the ranked recommendation the CEO consumes for "what should we invest in"), `Execution/PRIORITY_FRAMEWORK.md` (Business Value and Strategic Alignment scoring inputs)

## Review Cadence

Opportunity Portfolio reviewed at every Weekly Executive Review (new opportunities move through scoring continuously); Product Portfolio balance and sunset decisions reviewed at Monthly Business Review; full portfolio strategy reviewed at Quarterly Business Review.

## Anti-Patterns

- **Funding based on loudest advocate rather than portfolio balance.** The entire reason a Prioritization Matrix exists is to make relative ranking explicit and resistant to whoever argues most persuasively in the room.
- **Sunset decisions made unilaterally by Product Management without Portfolio Management's portfolio-wide view.** A product can look healthy in isolation while still being the right one to sunset given where the portfolio needs balance.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Portfolio Management)
```
