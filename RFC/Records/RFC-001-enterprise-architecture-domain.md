# RFC-001 — Introduce an Enterprise Architecture domain

## Status
Accepted

## Date Proposed
2026-07-22

## Author
Chief of Staff (drafted per human principal's direction)

## Layers Affected
New top-level layer: `Enterprise_Architecture/`. Read by all existing layers (`Core/`, `Executive/`, `Governance/`, `Intelligence/`, `Execution/`, `Business/`); no existing layer's files are modified.

## Summary
Introduce `Enterprise_Architecture/` as a new foundational domain that models the organization's stable structure — capabilities, value streams, domains, a shared taxonomy, and cross-domain dependencies — independent of whichever Departments or products exist in a given quarter. This is created *before* any delivery Department (Engineering, Design, QA, Marketing, etc.) so those Departments inherit consistent terminology, non-overlapping ownership, and compatible interfaces from day one, rather than each evolving its own vocabulary and later requiring reconciliation.

## Motivation
As the repository scales toward 100+ Departments and 500+ Agents, the highest-cost failure mode is not a missing Department — it's inconsistent terminology and overlapping ownership discovered only after several Departments have already been built around incompatible assumptions. `Governance/ORGANIZATIONAL_CHART.md` already models reporting lines and RACI for what exists today; it does not yet provide a stable, product/Department-independent map of *what capabilities the organization has* or *how value flows end to end*. That gap is what this RFC closes.

## Why This Requires an RFC
Per `RFC/RFC_PROCESS.md`'s trigger #3: this introduces a wholly new top-level folder at layer scope. It also touches trigger #2 in a narrow sense — `Governance/ORGANIZATIONAL_CHART.md` and `Business/LAYER_INTERFACES.md` both gain a new upstream reference point (capabilities and domains as a stable naming source) — but neither existing interface is redefined, only extended with an additional shared reference.

## Detailed Proposal
Create `Enterprise_Architecture/` containing:
- `ENTERPRISE_ARCHITECTURE_CHARTER.md` — mission and strict boundary (models structure; never makes business, governance, or execution decisions)
- `ENTERPRISE_TAXONOMY.md` — canonical definitions for Capability, Department, Artifact, Workflow, Initiative, Objective, Goal, Project, Product, Service, Platform
- `ENTERPRISE_CAPABILITY_MODEL.md` — the capability taxonomy and registry
- `ENTERPRISE_VALUE_STREAMS.md` — end-to-end value stream maps
- `ENTERPRISE_DOMAIN_MAP.md` — the full domain list and their relationships
- `CROSS_DOMAIN_DEPENDENCY_MODEL.md` — the dependency graph rules extending `Governance/ORGANIZATIONAL_CHART.md`
- `CAPABILITY_HEAT_MAP.md` — maturity/ownership/investment view over the Capability Model
- `ENTERPRISE_ARCHITECTURE_PLAYBOOK.md` — narrative tying the above together and defining how future Departments/RFCs consume it

No existing layer's documents are edited. `Governance/ORGANIZATIONAL_CHART.md`'s §6 Department intake gate will, going forward, reference the Capability Model and Domain Map as an additional input (a future Department proposal should name its capability and domain) — this is a forward-looking consumption pattern, not a rewrite of that document.

## Alternatives Considered
| Option | Summary | Why not chosen |
|---|---|---|
| Fold this into `Governance/ORGANIZATIONAL_CHART.md` | Extend the existing chart document with capability/value-stream/taxonomy sections | That document is already scoped to hierarchy, RACI, and reporting lines; folding in six more concerns would make it unreviewable and violate the same single-responsibility principle this whole architecture is built on |
| Fold this into `Business/` | Business already models value creation | Business decides *what* to invest in; capabilities and domains are stable structural facts independent of any investment decision — conflating them would make Business responsible for organizational taxonomy, which isn't its mandate per `Business/BUSINESS_LAYER_CHARTER.md`'s own boundary |
| Do nothing, let Departments define their own terms as created | Defer structural modeling until Departments exist | This is the exact failure mode the human principal flagged — Departments built without a shared capability/taxonomy reference risk inconsistent terminology and overlapping ownership discovered only after the fact, which is expensive to unwind |

## What Breaks / Migration Path
Nothing breaks — this is purely additive. No existing Agent, Workflow, or artifact type depends on the current absence of an Enterprise Architecture layer. Going forward, `Governance/ORGANIZATIONAL_CHART.md` §6's Department intake gate gains one additional recommended check (name the capability/domain a new Department maps to); this is non-breaking since no Department has been created yet in this repository.

## Trade-offs
**Gain:** every future Department inherits consistent vocabulary and non-overlapping ownership from the start, avoiding costly reconciliation later. **Cost:** one more layer to keep current as the organization evolves — mitigated by keeping this layer's content deliberately stable (capabilities and domains change far less often than products or Departments) and by routing any material change through this same RFC process, per `Enterprise_Architecture/ENTERPRISE_ARCHITECTURE_CHARTER.md`'s own governing rules.

## Architecture Review Notes
- Alternatives rigor met: yes — three real alternatives considered, including "do nothing."
- Migration path identified: yes — none required; purely additive.
- Returned for gaps: no.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| CEO | Approved | Directly serves `Core/AI_OS_CONSTITUTION.md`'s Long-Term Philosophy (§4) — building for the 100-Department horizon rather than the current 0-Department state. Sequencing this before any delivery Department is the correct order of operations. |
| Chief of Staff | Approved | Fits cleanly as a new top-level layer with a narrow, non-overlapping mandate; does not duplicate `Governance/`, `Business/`, or `Core/`. |

## Resulting Record
- ADR created: not applicable — this is an organizational/structural decision, not a technical one; this RFC record itself, once Accepted, is the durable record (per `RFC/RFC_PROCESS.md`, a lightweight structural addition with no competing technical alternative does not require a separate Decision Log entry beyond this RFC).
- Layers updated: new layer `Enterprise_Architecture/` created (see file list above).

## Related
- Related prior RFCs: none (first RFC filed in this repository)
- Related Governance/CONTINUOUS_IMPROVEMENT_SYSTEM.md harvest item: none — proactive architectural sequencing, not harvest-driven

## Metadata

```yaml
version: 1.0.0
status: Implemented
last_reviewed: 2026-07-22
```
