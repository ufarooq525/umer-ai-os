# Bounded Context: Product Management

> Ensures every product solves a meaningful, validated customer problem. Owns the product's vision, positioning, and roadmap — the connective tissue between Customer Strategy's validated problems and Portfolio Management's investment decisions.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`.

## Purpose

Be the single authoritative source for "what is this product, who is it for, and what should it do next" — so Engineering, Design, and Marketing all build from the same product truth instead of independently-drifting interpretations.

## Owns

- Product vision (the durable, multi-year statement of what a product is for)
- Product positioning (how the product is understood relative to alternatives — informed by, not owned by, Commercial Strategy's pricing/packaging and Market Intelligence's competitive read)
- Product roadmap ownership (the authoritative sequence of what a product will do next, traceable to validated opportunities)
- Feature value analysis (is a proposed feature worth building, given its likely value vs. its cost — feeding, not replacing, `Execution/PRIORITY_FRAMEWORK.md`'s scoring)
- Customer problem definition (working with Customer Strategy to state precisely what problem a product or feature addresses)
- Capability maps (the stable, product-line-spanning inventory of what the organization's products can do — more durable than any single roadmap)

## Does Not Own

- Portfolio-level investment balancing across multiple products (Portfolio Management)
- Pricing and monetization (Commercial Strategy)
- Implementation, architecture, or delivery scheduling (Engineering, `Execution/`)
- Raw market/competitor research (Market Intelligence interprets it; Product Management consumes that interpretation)

## Key Artifacts

- **Product Roadmap** — every item traces to a validated Opportunity Record or Business Case (`Business/BUSINESS_ARTIFACT_STANDARDS.md`); never a wish list
- **Product Brief** — the per-initiative expression of the roadmap, handed to the CEO as input to `Executive/CEO/CEO_AGENT.md`'s Objective-Decomposition Pattern
- **Capability Map** — reviewed at Portfolio Analytics' cadence, since capabilities are more stable than roadmaps and serve as the shared vocabulary between Business and delivery Departments (per `Business/LAYER_INTERFACES.md`)
- **Product Lifecycle State** — jointly maintained with Portfolio Management (this context proposes a transition — e.g., Growth → Mature — Portfolio Management ratifies it at the portfolio level)

## Interfaces

- **Consumes from:** Customer Strategy (validated problems, personas), Market Intelligence (competitive read), Portfolio Management (investment envelope available), `Intelligence/PATTERN_LIBRARY_STANDARD.md` / `Intelligence/BEST_PRACTICES_LIBRARY.md` (proven product patterns)
- **Produces for:** `Executive/CEO/CEO_AGENT.md` (Product Briefs as delegation input), Engineering/Design (roadmap as the traceable "why" behind their work, per `Business/LAYER_INTERFACES.md`'s Department dependency table), Commercial Strategy (what's being positioned/priced)

## Review Cadence

Roadmap reviewed at every Monthly Business Review; vision and Capability Map reviewed at Quarterly Business Review, per `Governance/MEETING_OPERATING_SYSTEM.md`.

## Anti-Patterns

- **A roadmap item with no traceable Opportunity Record.** Exactly the artifact-standard violation `Business/BUSINESS_ARTIFACT_STANDARDS.md` flags — an untraceable roadmap item is scope invented at the Product Management layer without the evidentiary discipline the rest of Business is held to.
- **Product Management setting price.** A common boundary violation — pricing signals (willingness to pay) properly belong to Commercial Strategy, even though Product Management is often tempted to bundle them into positioning decisions.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Product Management)
```
