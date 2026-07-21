# Research Library Standard

> Where point-in-time research — competitor scans, technology evaluations, API/framework research, market reports — is stored so it's reusable across projects instead of re-commissioned every time a similar question comes up. Distinct from `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md`, which is the standing, continuously-updated tracking system for named competitors specifically; the Research Library holds the broader, more occasional research that framework draws on plus everything outside its scope (frameworks, APIs, market trends).

Governed by `Core/COMMUNICATION_STANDARD.md` (evidence-based sourcing rules apply in full here) and `Intelligence/ORGANIZATIONAL_MEMORY.md`.

## What Belongs Here

| Category | Example |
|---|---|
| Technology research | "Evaluation of Postgres vs. a document store for multi-tenant SaaS at our typical scale" |
| API research | "Stripe vs. a regional payment processor — feature and reliability comparison for a specific market" |
| Framework evaluations | "Next.js vs. Remix for a client needing heavy SSR + edge deployment" |
| Market reports | "State of the fleet-management SaaS market, 2026" (feeds a CEO's objective-decomposition per `Executive/CEO/CEO_AGENT.md`) |
| Competitor research (raw findings) | Feeds `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md`'s structured tracking — this library holds the source research those trackers are built from |

## Why Point-in-Time Research Needs Its Own Rules

Unlike a Pattern (`Intelligence/PATTERN_LIBRARY_STANDARD.md`), research is explicitly **time-bound** — a framework evaluation from 2024 may be actively wrong by 2027. Treating research like permanent semantic memory (never expiring, always retrieved as current) is dangerous; treating it like disposable project scratch-work (thrown away after use) wastes real re-usable effort. This library's rules exist specifically to hold that middle ground: retained, clearly dated, and never retrieved without a currency check.

## Research Entry Template

Stored at `Intelligence/ResearchLibrary/<Category>/<slug>-<YYYY-MM>.md` — note research entries **do** carry a date in the filename, unlike most documents in this repository (`Governance/DOCUMENT_LIFECYCLE.md`'s naming rule explicitly carves out this exception for genuinely point-in-time artifacts).

```markdown
# Research: <title>

## Category
Technology | API | Framework | Market

## Date Conducted
YYYY-MM-DD

## Question
The specific question this research answers — framed narrowly enough to be answerable, not "what's the best database" but "which database best fits our multi-tenant isolation and read-scale needs given current traffic projections."

## Method
How the research was conducted — sources consulted, tools used (wigolo search/research/crawl per this OS's web-intelligence tooling), benchmarks run if applicable.

## Findings
The substantive findings, with sources cited per Core/COMMUNICATION_STANDARD.md — every external claim has a link and an access date.

## Recommendation
What this research recommends, if a decision followed from it — link the resulting Governance/DECISION_LOG_STANDARD.md or ADR entry if one exists.

## Confidence & Shelf Life
- Confidence: High | Medium | Low — and why
- Expected shelf life: <e.g., "stable for 2+ years — fundamental DB architecture tradeoffs" vs. "reassess within 6 months — fast-moving competitive landscape">
- Revisit trigger: <specific condition that would make this stale sooner than the shelf-life estimate>

## Related
- Related Pattern/ADR/Decision: <links>
- Related Competitive Intelligence entry: Intelligence/CompetitiveIntelligence/ link, if applicable

## Metadata
version: 1.0.0
status: draft | review | approved | stale | archived
owner: <Department>
last_reviewed: YYYY-MM-DD
```

## Currency Rules

- **Every research entry states its own expected shelf life at creation** — the author is best positioned to know whether this is a durable technical trade-off or a fast-moving market fact.
- **Status `stale` is a required state**, distinct from Deprecated/Archived in `Governance/DOCUMENT_LIFECYCLE.md`'s general model — a research entry doesn't get superseded by a specific replacement the way an ADR does; it simply ages past its stated shelf life and is flagged `stale` until someone either refreshes it or confirms it still holds.
- **Retrieval always surfaces the status.** Per `Intelligence/ORGANIZATIONAL_MEMORY.md`'s retrieval strategy, an Agent pulling a Research Library entry sees its `status` and shelf-life estimate prominently — a `stale`-flagged entry can still be read, but must never be cited as current-state fact without a fresh check, per `Core/COMMUNICATION_STANDARD.md`'s no-hallucination rule applied to reused research.
- **The Monthly Business Review** (`Governance/MEETING_OPERATING_SYSTEM.md`) includes a Chief of Staff sweep: any Approved entry past its stated shelf life or revisit trigger is flipped to `stale` automatically.

## Refreshing Stale Research

Refreshing is cheaper than re-researching from scratch — the point of retaining stale entries rather than archiving them immediately is that the Method and Question sections are still valid; only the Findings need updating. A refresh:

1. Re-runs the same Method against current sources.
2. Adds a new dated Findings block rather than overwriting the old one (preserves the historical record of how the answer changed — itself sometimes valuable, e.g., "here's how the framework landscape shifted 2024→2027").
3. Updates `status` back to `approved` and resets the shelf-life clock.

## Cross-Referencing to Decision Intelligence

Research that led to an actual decision links forward to its `Governance/Decisions/` or ADR entry, and that entry's `decision_type`/`reasoning_pattern` tags (per `Intelligence/DECISION_INTELLIGENCE.md`) make it discoverable from the decision side too — a bidirectional link, not just research → decision.

## Anti-Patterns

- **Research without a shelf-life estimate.** Treated as incomplete at review — every entry must state how long it's expected to remain trustworthy.
- **Citing stale research as current without a refresh.** A direct `Core/COMMUNICATION_STANDARD.md` honesty violation — "per our 2024 research" must be flagged as needing a currency check if it's past its stated shelf life, not presented as settled fact.
- **Re-researching from scratch instead of refreshing.** Wastes the still-valid Method/Question framing — check the Research Library before commissioning new research on a question that's likely already been asked.
- **Market research treated as permanent.** Market/competitive facts have the shortest realistic shelf life in this library (see `Intelligence/COMPETITIVE_INTELLIGENCE_FRAMEWORK.md`'s update cadence) — author confidence should reflect that, not borrow the long shelf life appropriate to a stable technical trade-off.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Chief of Staff (standard stewardship), Business + Product (market research), Engineering (technology/API/framework research)
```
