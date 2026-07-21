# Bounded Context: Customer Strategy

> Represents customer interests across the organization — the context every other Business context and every delivery Department checks to answer "who is this actually for, and what do they need," rather than each independently guessing or relying on whoever last talked to a customer.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`.

## Purpose

Be the single, authoritative, evidenced source of who the customer is, what problem they actually have, and what they value — so Product Management's roadmap, Commercial Strategy's packaging, Design's UX goals, and Marketing's messaging all draw from the same customer truth.

## Owns

- Personas (evidenced customer archetypes, not invented)
- Segmentation (how the customer base divides meaningfully for product/pricing/messaging decisions)
- Jobs-to-be-done (the functional/emotional job a customer is hiring the product to do)
- Customer journeys (the real, evidenced path a customer takes, including pain points)
- Customer value propositions (what value is actually being delivered, to which segment)

## Does Not Own

- Pricing/packaging built from segmentation (Commercial Strategy consumes Customer Strategy's segments; it decides the price)
- Product roadmap sequencing (Product Management consumes validated problems; it decides what to build and when)
- UX/UI execution (Design, a delivery Department, consumes journey maps and personas as input to its own work)
- Raw market data (Market Intelligence)

## Key Artifacts

- **Customer Segmentation Model** — evidenced by real usage or research data, not assumption; cited per `Business/BUSINESS_ARTIFACT_STANDARDS.md`'s evidence requirement
- **Journey Map** — grounded in observed or researched behavior
- **Value Proposition Model** — tied to a specific segment and a validated problem, never generic

## The Validation Discipline

A persona, segment, or journey map is only as good as its evidence — this context is explicitly held to the same evidence-sourcing rigor as Market Intelligence, just drawing on different source material (direct customer research, support/success data, usage analytics) rather than `Intelligence/`'s market/competitor tracking. An unvalidated persona ("I imagine our user is...") is a draft, not an artifact ready for Product Management to build a roadmap against — this is exactly what `Business/BUSINESS_METRICS.md`'s Customer Problem Validation Rate metric measures.

## Interfaces

- **Consumes from:** `Departments/Analytics` usage data (once that Department is active), direct customer research, `Intelligence/CASE_STUDY_STANDARD.md` (prior engagements' customer context)
- **Produces for:** Product Management (validated problems, personas), Commercial Strategy (segments for packaging), Design and Marketing (journey maps, value propositions) — per `Business/LAYER_INTERFACES.md`'s Department dependency table

## Review Cadence

Personas and segments reviewed at Quarterly Business Review, or immediately if Portfolio Analytics or Analytics flags a material shift in usage patterns that contradicts current assumptions.

## Anti-Patterns

- **Personas built from assumption, presented as evidenced.** The single most common failure mode for this context — caught at review by checking for an actual evidence citation, exactly as Market Intelligence is checked.
- **A journey map that describes the ideal path rather than the real one.** Journey Maps document what actually happens, including friction — an aspirational-only journey map hides the actual problems Product Management needs to prioritize against.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Customer Strategy)
```
