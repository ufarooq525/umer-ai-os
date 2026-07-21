# Case Study Standard

> The internal format for preserving a complete project episode — not just its failures (`Intelligence/LESSONS_LEARNED_FRAMEWORK.md`) or its extracted reusable patterns (`Intelligence/PATTERN_LIBRARY_STANDARD.md`), but the *whole story*: context, approach, outcome, and what a future Agent facing a similar engagement should know before starting. A Case Study is episodic memory at its richest — the unit `Intelligence/ORGANIZATIONAL_MEMORY.md` calls an "episode," written to be genuinely readable, not just technically complete.

Governed by `Intelligence/ORGANIZATIONAL_MEMORY.md`, `Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md`.

## Why Case Studies Are Distinct From Lessons Learned

A Lessons Learned entry is diagnostic — it exists to find and fix a root cause. A Case Study is narrative and comprehensive — it exists so a future CEO or Department, scoping a new but similar engagement, can read one document and understand how a comparable project actually played out: what was tried, what the client/market context was, what trade-offs were made, and how it landed. Not every project needs a Lessons Learned entry with deep root-cause analysis (many close cleanly). Every project of meaningful size *does* benefit from a Case Study, because even a clean success is valuable precedent for the next similar engagement.

## When to Write One

- Every project above a minimal size threshold (a multi-sprint engagement, not a single bug fix) gets a Case Study at close, as part of the `Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md` harvest.
- A notable single deliverable (a major SEO audit, a significant marketing campaign, a hard architectural migration) also warrants one even outside a full project close, if it's likely to inform future similar work.
- Small, routine work (a standard bug fix, a minor content update) does not need a Case Study — only a Lessons Learned entry if something actually went wrong, per that framework's mandatory triggers.

## Universal Case Study Template

Stored at `Intelligence/CaseStudies/<Domain>/<slug>.md`. The template below is universal; the domain-specific sections that follow are appended based on the primary Department involved.

```markdown
# Case Study: <project/engagement name>

## Domain
Technical | Product | Marketing | SEO | Business | QA | Design (primary — may list a secondary)

## Summary
2-4 sentences: what this was, for whom, and how it turned out. A reader should be able to decide from this alone whether the full case study is relevant to their current situation.

## Context
The situation that led to this engagement — client/market context, constraints (budget, timeline, existing systems), and the stated objective per the CEO's original brief (Executive/CEO/CEO_AGENT.md).

## Approach
What was actually done — the delegation sequence, key decisions (link Governance/Decisions/ and ADRs), and any deviation from the default Core/WORKFLOW_STANDARD.md pipeline and why.

## Outcome
What happened — quantified where possible against the KPIs relevant to this domain (Governance/KPI_FRAMEWORK.md), and against the original success criteria from the brief.

## What Made the Difference
The specific factor(s) that most shaped the outcome — a pattern applied, a risk caught early, a constraint that forced a creative trade-off. This is the section most future readers actually want.

## Domain-Specific Detail
(See domain sections below — included based on primary Domain.)

## Related
- Related patterns/anti-patterns: Intelligence/PatternLibrary/ links
- Related Lessons Learned: Intelligence/LessonsLearned/ links
- Related Decision Log / ADR entries: Governance/ links
- Related client/Memory context: Memory/Clients.md link, if applicable

## Metadata
version: 1.0.0
status: draft | review | approved | archived
owner: <Department>
last_reviewed: YYYY-MM-DD
```

## Domain-Specific Sections

### Technical

```markdown
## Domain-Specific Detail — Technical
- Architecture summary and key ADRs
- Stack/technology choices and why (link ADRs)
- Scale achieved vs. scale planned for
- Technical debt knowingly accepted, and its current status
```

### Product

```markdown
## Domain-Specific Detail — Product
- Core hypothesis being tested and how it was validated (or invalidated)
- Adoption/Retention/Feature Usage data (Governance/KPI_FRAMEWORK.md Product KPIs)
- Roadmap decisions this outcome influenced afterward
```

### Marketing

```markdown
## Domain-Specific Detail — Marketing
- Channels used and relative performance
- CAC/Conversion/ROI achieved (Governance/KPI_FRAMEWORK.md Marketing KPIs)
- Messaging/positioning that worked or didn't, and why
```

### SEO

```markdown
## Domain-Specific Detail — SEO
- Starting technical/content state vs. ending state
- Keyword/ranking/traffic movement (Governance/KPI_FRAMEWORK.md SEO KPIs)
- Any algorithm-update exposure encountered and how it was handled
```

### Business

```markdown
## Domain-Specific Detail — Business
- Financial outcome vs. projection (Revenue/MRR/Margin — Governance/KPI_FRAMEWORK.md Business KPIs)
- Pricing/commercial model decisions and rationale
- Risk category realized, if any (Governance/RISK_MANAGEMENT_FRAMEWORK.md Financial/Business categories)
```

### QA

```markdown
## Domain-Specific Detail — QA
- Escaped bug rate and test coverage achieved (Governance/KPI_FRAMEWORK.md QA KPIs)
- Any quality gate that required more than one pass, and why
- Regression tests added as a lasting artifact of this engagement
```

### Design

```markdown
## Domain-Specific Detail — Design
- Design system adoption / new components introduced
- Usability findings and resolution (Governance/KPI_FRAMEWORK.md Design KPIs)
- Accessibility conformance achieved
```

## Review and Approval

| Stage | Owner |
|---|---|
| Draft | Author (typically the Project Manager or primary Department lead at project close) |
| Review | Chief of Staff (completeness, cross-linking) + owning Department (accuracy) |
| Approved | Both sign off; entry becomes retrievable per `Intelligence/ORGANIZATIONAL_MEMORY.md`'s retrieval strategy |

A Case Study is never Approved with an empty "What Made the Difference" section — a case study that doesn't identify what actually mattered is a project summary, not usable intelligence.

## Worked Example (Abridged)

```markdown
# Case Study: NitroTickets — Ticketing Platform MVP to Public Launch

## Domain
Product (primary), Technical (secondary)

## Summary
Built and launched a multi-tenant event ticketing MVP for a mid-size client in 10 weeks. Prioritized a validated core loop (event creation → ticket sale → check-in) over a broader feature set; launched on schedule with strong early adoption but had to defer a promised reporting dashboard.

## Context
Client needed a functioning ticketing platform ahead of a specific event season, with a hard external deadline (not movable). Budget was fixed; scope was the only lever.

## Approach
CEO set an explicit Velocity-favored bias per Executive/CEO/CEO_AGENT.md, given the immovable deadline (see Governance/Decisions/DEC-009). Delegation sequence: Research → Architecture → Design → Development → QA → Deployment, with SEO/Marketing deferred to post-launch since the client's initial customers were pre-committed, not search-acquired. A scope-cut decision (deferring the reporting dashboard) was made mid-project when Engineering flagged it as a 2-week timeline risk.

## Outcome
Launched on the fixed date with the core loop fully functional. Adoption of the core loop was strong in week 1 (per Governance/KPI_FRAMEWORK.md Product KPIs). Reporting dashboard shipped 3 weeks post-launch as a fast-follow.

## What Made the Difference
The CEO's explicit, stated Velocity bias let Engineering and Design make consistent scope-cut calls without re-litigating priority each time — every deferred-feature conversation took minutes instead of becoming a recurring debate, because the bias was already decided and known.

## Related
- Related pattern: Intelligence/PatternLibrary/Product/deadline-driven-scope-cut.md
- Related decision: Governance/Decisions/DEC-009-nitrotickets-velocity-bias.md
```

## Anti-Patterns

- **The sanitized success story.** A Case Study that omits real trade-offs and scope cuts to look cleaner — the value of this library depends on honesty per `Core/COMMUNICATION_STANDARD.md`; a case study that misrepresents what actually happened actively misleads the next Agent who relies on it.
- **No "What Made the Difference."** A summary of activities without identifying the actual causal factor is not yet a usable case study.
- **Writing it too late.** Case studies drafted months after close lose the specific reasoning behind mid-project pivots — write it at close, per `Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md`'s harvest timing.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Chief of Staff (standard stewardship), each Department (domain-specific sections)
```
