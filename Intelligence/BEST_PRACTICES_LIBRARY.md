# Best Practices Library

> The most mature tier of semantic memory (`Intelligence/ORGANIZATIONAL_MEMORY.md`) — proven engineering, design, SEO, QA, marketing, and product practices curated into defaults every relevant Agent applies unless a stated reason says otherwise. Distinct from `Intelligence/PATTERN_LIBRARY_STANDARD.md`: a Pattern is "a reusable solution, evidenced, applicable in stated contexts." A Best Practice is a Pattern that has matured further — proven across enough contexts and enough time that it becomes the **default**, not just an available option.

Governed by `Intelligence/PATTERN_LIBRARY_STANDARD.md` (the maturity stage below this one), `Core/AI_OS_CONSTITUTION.md` §9 (Quality Philosophy), `Governance/OPERATING_PRINCIPLES.md`.

## Pattern vs. Best Practice — The Actual Distinction

| | Pattern | Best Practice |
|---|---|---|
| Maturity | 2+ episodes, or 1 Critical | Proven across multiple Departments/projects over a sustained period, with no significant contradicting evidence |
| Applicability | Context-dependent, stated explicitly | Default — deviation requires a stated reason |
| Review bar | Owning Department + Chief of Staff | Cross-department review, since it becomes a default others build on |
| Where it lives | `Intelligence/PatternLibrary/` | `Intelligence/BestPracticesLibrary/` |

A Best Practice entry always originates as a Pattern first — nothing enters this library directly. This ordering matters: it forces every default recommendation in the organization to have gone through the evidentiary rigor of the Pattern Library before becoming a default, rather than someone's opinion being fast-tracked to "best practice" status without the recurrence/evidence bar.

## Promotion Bar (Pattern → Best Practice)

A Pattern is proposed for promotion when:

1. It has **evidence from 3+ distinct episodes**, spanning more than one client/project context, or
2. It has been formally adopted as the stated default in 2+ Department-level `Standards/` documents, and
3. No **contradicted** outcome exists in `Intelligence/DECISION_INTELLIGENCE.md`'s tracking for decisions that relied on it.

Condition 3 is a hard gate — a Pattern with even one tracked contradiction is not eligible for Best Practice status until the contradiction is understood and either resolved (the Pattern is refined) or explained (the contradiction was due to a context outside the Pattern's stated applicability, and that boundary is now explicit).

## Best Practice Entry Template

```markdown
# Best Practice: <name>

## Domain
Engineering | Design | SEO | QA | Marketing | Product

## Statement
The practice, stated as a clear default: "Unless <stated exception condition>, do X."

## Rationale
Why this is the default — the accumulated evidence and reasoning, not just an assertion. Link the originating Pattern and its full evidence trail.

## Default Application
What following this practice looks like concretely — specific enough that a new Agent can apply it without further interpretation.

## Exception Conditions
The specific, named conditions under which deviating from this default is legitimate — a Best Practice with no stated exceptions either has none (rare, and should say so explicitly) or hasn't been examined honestly.

## Deviation Protocol
If an Agent deviates from this Best Practice, what must be recorded: a Governance/DECISION_LOG_STANDARD.md or ADR entry stating which Exception Condition applied and why — deviation is allowed, silent deviation is not.

## Origin
- Promoted from Pattern: Intelligence/PatternLibrary/<domain>/<slug>.md
- Promotion date: YYYY-MM-DD
- Evidence count at promotion: <n episodes>

## Related
- Related Standards/ document (if formalized there too): <link>
- Related Checklists/ item (if this practice is checked at a quality gate): <link>

## Metadata
version: 1.0.0
status: draft | review | approved | superseded | archived
owner: <Department>
last_reviewed: YYYY-MM-DD
supersedes: <if replacing an older best practice>
```

## Review and Approval Process

| Stage | Reviewer | Bar |
|---|---|---|
| Draft (promotion proposed) | Owning Department | Promotion Bar conditions 1-3 met, drafted with full template |
| Review | Chief of Staff + at least one other Department that would apply this practice | Cross-department applicability check — does this genuinely generalize, or is it narrower than it appears |
| Approved | CEO ratification for cross-cutting practices (affecting multiple Departments); Department lead alone for single-Department practices | Becomes the stated default from this point forward |
| Superseded | Triggered by a new, better-evidenced practice, or by a `Intelligence/DECISION_INTELLIGENCE.md` contradiction surfacing after approval | `supersedes`/`superseded_by` links maintained, never silently replaced |

Because a Best Practice becomes a default other Agents build on without re-evaluating it each time, its review bar is deliberately the highest in the entire `Intelligence/` folder — higher than a Pattern, comparable to a `Core/` or `Governance/` amendment for anything cross-cutting.

## Worked Examples (Abridged, One Per Domain)

```markdown
### Best Practice: Idempotent Webhook Handlers (Engineering)
Statement: Unless the integration is strictly one-directional with no external retry behavior, every webhook handler must check a persisted idempotency key before processing.
Origin: Promoted from Intelligence/PatternLibrary/API/idempotent-webhook-handlers.md after 3 episodes (Client A, NitroTickets, ToolWorks) with zero contradicted outcomes.

### Best Practice: Design System Components Before Custom UI (Design)
Statement: Unless the design system has no matching component and a genuine UX need can't be met by an available primitive, build with existing design system components.
Exception Condition: A validated, high-value custom interaction proven via Intelligence/INNOVATION_LAB.md experimentation.

### Best Practice: Canonical Tags on All Templated Pages (SEO)
Statement: Unless a page is intentionally a distinct indexable variant, every templated page (paginated lists, filtered views) carries an explicit canonical tag.
Origin: Promoted after repeated crawlability findings across 4+ SEO audits (Checklists/SEO Audit.md).

### Best Practice: Regression Test Added for Every Escaped Bug (QA)
Statement: Every bug that reaches production (an "escaped" bug per Governance/KPI_FRAMEWORK.md) gets a regression test added before the fix is considered closed — not optional cleanup, part of the fix's Definition of Done.

### Best Practice: Message-Market Fit Validated Before Spend Scale-Up (Marketing)
Statement: Unless a campaign is a direct, low-cost continuation of an already-validated message, new positioning is validated at small spend before scaling budget.
Origin: Promoted after Intelligence/CASE_STUDY_STANDARD.md evidence across 3 campaigns showed early small-scale validation consistently predicted large-scale ROI direction (Intelligence/DECISION_INTELLIGENCE.md tracking: all 3 confirmed).

### Best Practice: Time-to-Value Instrumented Before Feature Launch (Product)
Statement: Every feature ships with its "aha moment" event instrumented in Analytics before launch, not added retroactively.
```

## Handling Deviation

A Best Practice is a strong default, not an unconditional rule (per `Core/AI_OS_CONSTITUTION.md`'s "principles over rigid rules where judgment is warranted") — but deviation is never silent. The Deviation Protocol (see template) requires a logged decision stating which Exception Condition applied. An Agent that deviates without logging is out of spec the same way skipping a `Core/QUALITY_STANDARD.md` gate without logging debt would be.

## Currency and Supersession

Best Practices are reviewed at every Quarterly Business Review for continued validity against `Intelligence/DECISION_INTELLIGENCE.md`'s outcome tracking — a Best Practice that accumulates a `contradicted` outcome post-approval is flagged for immediate re-review, not left standing until the next scheduled check, mirroring `Governance/RISK_MANAGEMENT_FRAMEWORK.md`'s escalation-trigger-bypasses-the-calendar principle.

## Anti-Patterns

- **Promoting from opinion, not evidence.** Every Best Practice traces back to a Pattern with a real evidence trail — no shortcuts, regardless of how senior or confident the proposing Agent/Department is.
- **No stated exceptions.** A Best Practice presented as universally true without limits is either genuinely universal (rare, state so explicitly) or under-examined.
- **Silent deviation.** Departing from a Best Practice without the Deviation Protocol's logged decision.
- **Never revisiting after approval.** Treating Best Practice status as permanent rather than continuously checked against `Intelligence/DECISION_INTELLIGENCE.md` outcomes.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Chief of Staff (cross-department promotion review), each Department (domain practices), CEO (ratifies cross-cutting practices)
```
