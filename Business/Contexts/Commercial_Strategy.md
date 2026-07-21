# Bounded Context: Commercial Strategy

> Optimizes value capture — pricing, packaging, licensing, and monetization. Where Customer Strategy and Product Management establish what value is created, Commercial Strategy decides how the organization is compensated for it.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`.

## Purpose

Answer "given the value we create and the market we're in, how should we price, package, and monetize it" — kept as its own context specifically so pricing decisions are made with commercial discipline, not bundled informally into Product Management's roadmap thinking or left to whichever Department ships last.

## Owns

- Pricing (the actual price points and pricing logic)
- Packaging (how features/capabilities bundle into purchasable units)
- Monetization models (subscription, usage-based, licensing, etc.)
- Licensing terms (at the business-model level — legal contract language itself is a Legal Department concern once that Department exists, per `Business/LAYER_INTERFACES.md`)
- Revenue models (how monetization translates into projected revenue, feeding Business Case Management)
- Go-to-Market Strategy (jointly with Customer Strategy — Commercial Strategy owns the pricing/packaging half, Customer Strategy owns the audience/messaging half)

## Does Not Own

- Segmentation itself (Customer Strategy — Commercial Strategy consumes segments to decide packaging tiers)
- Competitive research (Market Intelligence — Commercial Strategy consumes Competitive Positioning Maps to inform pricing, it doesn't track competitor pricing itself; that's `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md`'s Pricing History)
- Actual revenue recognition/accounting (a future Finance Department concern — Commercial Strategy models projected revenue, Finance tracks actual)

## Key Artifacts

- **Pricing Model** — immutable once Approved (per `Business/BUSINESS_ARTIFACT_STANDARDS.md`), since it's exactly the kind of decision `Intelligence/DECISION_INTELLIGENCE.md` tracks for later outcome confirmation/contradiction
- **Packaging Model** — tied explicitly to a Customer Segmentation Model
- **Revenue Model** — assumptions stated and evidenced, feeding directly into Business Case Management's ROI calculations
- **Go-to-Market Strategy** — traces to a Positioning Model and a Product Roadmap item

## Interfaces

- **Consumes from:** Customer Strategy (segments), Market Intelligence (competitive pricing context via Competitive Positioning Map), Product Management (what's being packaged)
- **Produces for:** Business Case Management (Revenue Model as ROI input), Marketing and Sales Departments (pricing/packaging/GTM as their standing input, per `Business/LAYER_INTERFACES.md`), Legal (when licensing/monetization requires contractual support)

## Approval

Per `Business/LAYER_INTERFACES.md`'s Governance interface, a **new pricing model** is exactly the kind of decision that requires `Governance/DECISION_LOG_STANDARD.md` logging and CEO sign-off — Commercial Strategy proposes with commercial rigor, it does not unilaterally ratify a pricing change with organization-wide revenue consequences.

## Review Cadence

Pricing and packaging reviewed at Quarterly Business Review, or immediately if `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md` flags a Tier 1 competitor pricing move significant enough to warrant a reactive check (per that document's Update Workflow "flag to CEO" branch).

## Anti-Patterns

- **Pricing decided informally by whichever Department ships a feature last.** Pricing is this context's exclusive mandate — a Department setting its own price for a feature it built is a boundary violation.
- **A Revenue Model with no stated assumptions.** Exactly the evidence-discipline failure `Business/BUSINESS_ARTIFACT_STANDARDS.md` flags — every revenue projection states what it assumes about conversion, retention, and market capture.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Commercial Strategy)
```
