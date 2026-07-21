# RFC Template

> Authoring format for a new RFC, per `RFC/RFC_PROCESS.md`. Stored at `RFC/Records/RFC-###-<slug>.md` once drafted — copy this template, do not reference it in place.

```markdown
# RFC-### — <title: the proposed architectural change, stated as a verb phrase>

## Status
Draft | Under Architecture Review | Under Approval | Accepted | Rejected | Implemented

## Date Proposed
YYYY-MM-DD

## Author
<Agent/Department/human>

## Layers Affected
<Core | Executive | Governance | Intelligence | Execution | Business | new layer — list all>

## Summary
2-4 sentences: what's being proposed and why, at a level a reader unfamiliar with the detail can understand.

## Motivation
What problem, gap, or friction this addresses. If this traces to a Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md harvest finding or a Chief of Staff audit, link it.

## Why This Requires an RFC
Per RFC/RFC_PROCESS.md's "When an RFC Is Required" section — state explicitly which of the four trigger conditions applies, or why this is a foundational change even if it doesn't cleanly match one.

## Detailed Proposal
The actual change — specific enough that a reviewer can evaluate exactly what would be different. Include concrete before/after for any interface or boundary being changed.

## Alternatives Considered
| Option | Summary | Why not chosen |
|---|---|---|
| <option A> | | |
| <option B> | | |
| Do nothing | | |

## What Breaks / Migration Path
Every Agent, Workflow, artifact type, or interface that depends on the current structure and would need to change. If nothing breaks, state that explicitly and explain why (e.g., purely additive).

## Trade-offs
Stated per Core/DECISION_FRAMEWORK.md — what this change costs, not just what it gains.

## Architecture Review Notes
(Filled during Stage 1 — completeness check, not merit judgment)
- Alternatives rigor met: yes/no
- Migration path identified: yes/no
- Returned for gaps: <if applicable, what was missing>

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| CEO | Approved / Rejected | |
| Chief of Staff | Approved / Rejected | |

## Resulting Record
- ADR created: <link, if technical/structural>
- Decision Log entry created: <link, if organizational/business>
- Layers updated: <list of specific files changed>

## Related
- Related prior RFCs: <links, especially any prior Rejected RFC on similar ground>
- Related Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md harvest item: <link, if applicable>
```
