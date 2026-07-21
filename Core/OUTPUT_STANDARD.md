# Output Standard

> The canonical shape for a substantive AI response in this OS. Every Agent's `AGENT_SPECIFICATION.md` §7 (Outputs) either uses this shape directly or documents a specific, named exception. Consistent output shape is what lets a human skim 100 agents' work with one learned reading pattern instead of 100.

Governed by `AI_OS_CONSTITUTION.md`. Voice and tone rules live in `COMMUNICATION_STANDARD.md` — this document governs structure, not style.

## When This Applies

Use the full standard shape for substantive deliverables: audits, recommendations, designs, architecture decisions, reports, plans. Do not force this structure onto a one-line factual answer, a small clarifying question, or a trivial status update — over-structuring a two-sentence answer is itself a violation of `COMMUNICATION_STANDARD.md`'s concision rule. Judgment on "substantive enough" belongs to the responding agent; when in doubt, use the full shape.

## Canonical Structure

```markdown
## Executive Summary
## Analysis
## Recommendations
## Implementation Plan
## Risks
## Next Steps
## Checklist
```

### 1. Executive Summary

3–5 sentences, no jargon, answers: what was asked, what was found, what's recommended. Written so a stakeholder who reads only this section can still make a decision. If the honest summary is "I don't have enough information to recommend anything yet," say that — see `COMMUNICATION_STANDARD.md` on stating assumptions and unknowns.

### 2. Analysis

The evidence and reasoning behind the summary: what was examined, what was found, and why it matters. Cite specific files, data, or sources (`file.ext:line`, a metric, a quoted finding) rather than asserting conclusions ungrounded. This is where `DECISION_FRAMEWORK.md`'s "name the trade-offs" step becomes visible to the reader.

### 3. Recommendations

The specific, actionable calls this agent is making, each traceable to a point in Analysis. Distinguish clearly between "recommended" and "options considered and rejected" — don't bury a rejected alternative inside a recommendation as if it were still live.

### 4. Implementation Plan

The concrete path from here to done: ordered steps, owner (which Agent/Department/human) per step, and any dependency between steps. For small changes this can be 2–3 bullets; it should never be padded to look thorough.

### 5. Risks

What could go wrong, how likely, how bad, and the mitigation or explicit acceptance of each. A Risks section with nothing in it is a claim ("this has zero risk") — only write that when it's actually true, and say so explicitly rather than omitting the section.

### 6. Next Steps

The immediate, near-term actions — as distinct from the full Implementation Plan, this is "what happens in the next handoff," per `WORKFLOW_STANDARD.md`. Name the next Agent/Department/human and what they need from this output to start.

### 7. Checklist

A short, checkable list confirming this output meets its own claims — drawn from `QUALITY_STANDARD.md` gates relevant to this deliverable and any linked file in `Checklists/`. Every box should be genuinely verifiable, not aspirational.

```markdown
- [ ] Claims in Analysis are sourced or explicitly marked as inference
- [ ] Recommendations trace to Analysis, not asserted cold
- [ ] Risks section reflects real risk, not boilerplate
- [ ] Relevant Checklists/ file(s) applied: <name>
- [ ] Output handed off per WORKFLOW_STANDARD.md with explicit next owner
```

## Scaling the Structure

Not every section needs equal weight every time. Match section *depth* to the task's actual stakes — never delete a section just because it's inconvenient to fill in.

| Task size | Executive Summary | Analysis | Recommendations | Implementation Plan | Risks | Next Steps | Checklist |
|---|---|---|---|---|---|---|---|
| Quick fix / small task | 1–2 sentences | 1 short paragraph | 1 bullet | 2–3 bullets | 1 line, or "none identified" | 1 line | 3–4 items |
| Standard feature/audit | Full | Full | 2–5 bullets | Ordered steps w/ owners | Table: risk / likelihood / mitigation | Full | Full |
| Cross-department initiative | Full, stakeholder-facing | Full, with sourced evidence | Full, ranked by `DECISION_FRAMEWORK.md` | Full, with milestones and dependencies | Full risk register | Full, multi-agent | Full, cross-referenced to multiple Checklists/ |

## Format Rules

- Markdown headings exactly as named above (`## Executive Summary`, etc.) so outputs are diffable and greppable across the whole repository over time.
- Code, file paths, and identifiers in backticks or fenced blocks; prose stays prose.
- Tables for anything comparative (options, risks, trade-offs) — a table beats a paragraph trying to do a table's job.
- Mermaid diagrams for anything sequential, hierarchical, or state-based that a paragraph would obscure (see examples throughout `Core/`).
- No decorative filler — an empty or boilerplate section is worse than an honestly short one (see §"Scaling the Structure").

## Anti-Patterns

- **Padding a small answer into the full seven-section shape** to look thorough. Match depth to stakes (see scaling table).
- **Burying the recommendation** at the bottom of a long Analysis instead of stating it plainly in the Executive Summary.
- **A Risks section that's pure boilerplate** ("there is always some risk in software") instead of specific, named risks or an honest "none identified for this scope."
- **Skipping Next Steps** because the agent doesn't know who's next — that uncertainty is itself worth stating and is a `WORKFLOW_STANDARD.md` escalation trigger, not something to leave implicit.
