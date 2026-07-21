# Bounded Context: Business Strategy

> Translates organizational vision into economic direction. The context that answers "what strategic themes should the entire Business layer's other eight contexts organize around, right now" — the top of the Business layer's own internal hierarchy.

Governed by `Business/BUSINESS_LAYER_CHARTER.md`. Consumed by every other `Business/Contexts/` document as the source of Strategic Alignment.

## Purpose

Ensure every downstream Business decision — an opportunity scored, a product prioritized, a price set — traces back to a small number of explicit, current strategic themes, rather than each context independently guessing at direction.

## Owns

- Strategic themes (the 3-5 current organizational priorities, e.g., "expand into adjacent SaaS verticals," "deepen enterprise retention")
- Business objectives (the measurable expression of each theme)
- Growth initiatives (the major, multi-context bets pursuing a theme)
- Investment allocation *at the theme level* (how much of the portfolio's capacity is aimed at each theme — the actual dollar/effort split lives in Portfolio Management, but the target allocation ratio is set here)

## Does Not Own

- Individual opportunity scoring (Portfolio Management)
- Product-level roadmap detail (Product Management)
- Delegation or execution scheduling (`Executive/`, `Execution/`)

## Key Artifacts

- **Strategic Theme** — traces explicitly to `Core/AI_OS_CONSTITUTION.md` Vision/Mission; reviewed at every Quarterly Business Review, ratified at Annual Strategic Review for material changes (`Governance/MEETING_OPERATING_SYSTEM.md`)
- **Outcome Definition** (theme-level) — the falsifiable measure of whether a theme is working
- **Value Stream Map** — connects a theme, through opportunity and delivery, to a customer outcome, making the whole chain visible in one artifact

## Interfaces

- **Consumes from:** `Core/AI_OS_CONSTITUTION.md` (Vision/Mission), `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md` and `Intelligence/RESEARCH_LIBRARY_STANDARD.md` (via Market Intelligence's interpretation), `Governance/KPI_FRAMEWORK.md` trend data
- **Produces for:** every other Business context (Strategic Alignment scoring input), `Executive/CEO/CEO_AGENT.md` (roadmap direction), `Execution/PRIORITY_FRAMEWORK.md`'s Strategic Alignment dimension

## Review Cadence

Strategic Themes are set/reaffirmed at the **Annual Strategic Review** and checked (not necessarily changed) at every **Quarterly Business Review**, per `Governance/MEETING_OPERATING_SYSTEM.md` — a theme changing mid-quarter is a significant enough event to warrant an `RFC/` entry if it materially redirects active Portfolio investment.

## Anti-Patterns

- **Themes that are really just a list of every initiative already in flight.** A Strategic Theme should constrain what gets funded, not retroactively describe whatever's already being built.
- **More than 5 active themes.** Diffuses the entire point of having explicit strategic direction — if everything is a priority, `Execution/PRIORITY_FRAMEWORK.md`'s Strategic Alignment dimension can't meaningfully discriminate between requests.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Business (Strategy), ratified by CEO
```
