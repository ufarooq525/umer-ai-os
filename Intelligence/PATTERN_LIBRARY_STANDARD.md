# Pattern Library Standard

> How reusable patterns and anti-patterns — technical, product, design, SEO, marketing, or organizational — are documented so they become semantic memory (`Intelligence/ORGANIZATIONAL_MEMORY.md`) any future Agent can retrieve and apply, instead of each Department silently re-discovering the same solution (or repeating the same mistake) project after project.

Governed by `Intelligence/ORGANIZATIONAL_MEMORY.md` and `Governance/KNOWLEDGE_GOVERNANCE.md`. Stored at `Intelligence/PatternLibrary/<Domain>/<pattern-slug>.md` and `Intelligence/PatternLibrary/<Domain>/anti-patterns/<anti-pattern-slug>.md`.

## What Qualifies as a Pattern (Promotion Bar)

A Pattern is not "a thing we did once." Per `Intelligence/ORGANIZATIONAL_MEMORY.md`'s Memory Lifecycle, an entry is only promoted to the Pattern Library when it clears the same bar as any semantic-memory promotion:

- It has recurred across **2 or more distinct episodes** (projects, clients, or Departments), or
- It addresses a **single Critical-impact** situation (per `Governance/RISK_MANAGEMENT_FRAMEWORK.md` scoring) where waiting for recurrence would be irresponsible.

A one-off solution that hasn't cleared this bar stays in episodic memory (a Lessons Learned or Case Study entry) — logged and linked, but not yet generalized. Promoting too early pollutes the library with narrow, unproven "patterns" that erode trust in the whole library; this bar is enforced at review, not left to author discretion.

## Pattern Template

```markdown
# Pattern: <name — a noun phrase describing the reusable solution>

## Domain
<e.g., Database, API Design, Onboarding UX, Technical SEO, Pricing>

## Problem
The recurring problem this pattern solves, stated generally enough to recognize in a new context — not tied to the specific project it was first observed in.

## Context / When to Apply
The conditions under which this pattern is the right choice. Patterns are context-dependent by nature — state the conditions explicitly so a future Agent doesn't misapply it outside its proven scope.

## Solution
The reusable approach itself — described at the level of "here is the shape of the solution," with enough specificity to apply, not so much that it's a copy-paste script tied to one stack.

## Consequences
### Benefits
- <what this pattern reliably delivers>
### Trade-offs
- <what it costs — every pattern has a cost; a pattern with none listed hasn't been examined honestly>

## Evidence
| Episode | Project/Client | Outcome | Link |
|---|---|---|---|
| 1 | | | Case Study / Lessons Learned link |
| 2 | | | |

## Related
- Related patterns: <links>
- Related anti-patterns (the failure mode this pattern avoids): <links>
- Related ADRs: <Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md links, if technical>
- Related Best Practice: <Intelligence/BestPracticesLibrary/ link, if this pattern has matured into a default recommendation>

## Metadata
version: 1.0.0
status: draft | review | approved | deprecated | archived
owner: <Department>
last_reviewed: YYYY-MM-DD
```

## Anti-Pattern Template

Anti-patterns are documented with equal rigor — a library that only records what to do, not what to avoid, misses half of what makes memory valuable (per the "Redis cache invalidation" example in `Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md`: the point isn't just capturing the fix, it's capturing the trap so no one falls into it again).

```markdown
# Anti-Pattern: <name — describe the mistake, not the fix>

## Domain
<e.g., Database, API Design, Onboarding UX, Technical SEO, Pricing>

## The Mistake
What gets done that seems reasonable at first but produces a bad outcome. Written so a future Agent recognizes it from the *setup*, not only after the damage is done.

## Why It's Tempting
The reason this looks like a good idea in the moment — the seductive logic that leads to it. Naming this is what actually prevents recurrence; "don't do X" without "here's why X looks right" doesn't stick.

## What Actually Happens
The real consequence, evidenced by the episodes below.

## The Correct Alternative
Link to the Pattern that should be used instead, if one exists; if not, state the general direction even without a fully promoted pattern yet.

## Evidence
| Episode | Project/Client | What happened | Link |
|---|---|---|---|
| 1 | | | |

## Related
- Corrected by pattern: <link>
- Related risk category: <Governance/RISK_MANAGEMENT_FRAMEWORK.md category>

## Metadata
version: 1.0.0
status: draft | review | approved | deprecated | archived
owner: <Department>
last_reviewed: YYYY-MM-DD
```

## Cross-Referencing Rules

1. **Every Pattern links to at least one piece of Evidence** (a Case Study or Lessons Learned entry) — a Pattern with no evidence trail is a hypothesis, not organizational memory, and is not eligible for Approved status.
2. **Patterns and Anti-Patterns cross-link each other** where one is the corrective for the other — a reader who finds the mistake should be one click from the fix, and vice versa.
3. **A Pattern that graduates into a default recommendation** (used without exception across a domain) links forward to `Intelligence/BEST_PRACTICES_LIBRARY.md` once it clears that document's own promotion bar — Pattern and Best Practice are different maturity stages, not duplicate entries; see that document for the distinction.
4. **Technical patterns cross-link relevant ADRs** (`Governance/ARCHITECTURE_DECISION_RECORDS_STANDARD.md`) where a specific project's ADR is an instance of the general pattern — the ADR is the project-specific decision record; the Pattern is the generalized, reusable shape extracted from one or more ADRs.
5. **No pattern is documented twice under different names.** Before authoring a new Pattern, the author searches `Intelligence/PatternLibrary/<Domain>/` for an existing near-match; if found, the new evidence is added to the existing entry instead of forking, per `Core/KNOWLEDGE_STANDARD.md`'s "update in place" rule extended to this library.

## Review and Promotion

| Stage | Trigger | Reviewer |
|---|---|---|
| Draft | Author believes 2+ episodes (or 1 Critical) now support generalization | Author's Department |
| Review | Draft submitted | Owning Department lead + Chief of Staff (cross-domain consistency, duplicate check) |
| Approved | Reviewer confirms promotion bar met, evidence linked, trade-offs honestly stated | Same reviewers |
| Deprecated | A newer pattern supersedes it, or its trade-offs are found to outweigh benefit at current scale | Owning Department, logged with `superseded_by` |

## Worked Example

### Pattern: Idempotent Webhook Handlers for Third-Party Integrations

```markdown
## Domain
API Design / Integrations

## Problem
Third-party webhook senders (payment processors, CRMs, shipping providers) frequently retry delivery on timeout or ambiguous response, causing the same event to be processed more than once if the handler isn't designed for it.

## Context / When to Apply
Any integration receiving inbound webhooks from a system we don't control the retry behavior of — which is nearly all third-party webhook integrations by default.

## Solution
Every webhook handler checks a persisted idempotency key (the sender's event ID, or a computed hash of the payload if none is provided) before processing, and short-circuits with a success response if already processed.

## Consequences
### Benefits
- Eliminates duplicate-processing bugs regardless of sender retry behavior
### Trade-offs
- Requires a persisted idempotency-key store with its own retention policy — a small ongoing infrastructure cost

## Evidence
| Episode | Project/Client | Outcome | Link |
|---|---|---|---|
| 1 | Client A — payment webhook | Duplicate charge recorded internally before this pattern was applied; fixed and pattern extracted | Memory/Lessons Learned.md#2026-03-payment-webhook-dup |
| 2 | NitroTickets — shipping webhook | Applied proactively at build time after pattern existed; zero incidents | Case Study link |

## Related
- Related anti-pattern: Intelligence/PatternLibrary/API/anti-patterns/trusting-webhook-sender-not-to-retry.md
- Related ADR: Knowledge/Architecture/ADR/ADR-0019-idempotency-key-store.md
```

## Anti-Patterns of This Library Itself

- **Premature promotion.** A single project's solution documented as a Pattern before recurrence or Critical-impact justification — reviewed against the Promotion Bar and rejected back to episodic memory if it doesn't clear it.
- **Evidence-free patterns.** A Pattern with no linked Case Study/Lessons Learned — not eligible for Approved status.
- **Duplicate forks.** Two similarly-named Patterns in the same domain because the author didn't search first — caught at Review by the Chief of Staff's duplicate check.
- **Trade-off omission.** A Pattern that reads like marketing copy (all benefit, no cost) — sent back for honest revision.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Chief of Staff (standard stewardship), each Department (its own domain's patterns)
```
