# Design Interfaces

Governed by `Departments/Design/DESIGN_CHARTER.md`.

## Layer Interfaces

| Layer | Contract |
|---|---|
| Core | Inherits Constitution, Quality (incl. Accessibility gate intent), Communication, Output |
| Executive | CEO mandate/trade-offs; PM capacity; CoS audit |
| Governance | RACI, KPIs, risk, document lifecycle |
| Business | Intent from Customer Strategy + Product Management; Design does not own segmentation/roadmap |
| Execution | Runtime participation; handoffs; no side channel |
| Enterprise Architecture | Capability/Domain binding for Visual & UX Design |
| Intelligence | Consumes research/patterns; contributes experience lessons; no fork |

## Peer Interfaces

| Peer | Edge | Summary |
|---|---|---|
| Engineering | Sequential out | Design handoff package is Engineering entry contract when UX in scope |
| QA | Enabling / Informational | Experience acceptance criteria; a11y intent — QA verifies |
| Security | Constraining | Auth/consent/privacy UX must satisfy Security requirements |
| Analytics | Enabling | Instrumentation hooks for key experience moments coordinated with Analytics event taxonomy |
| Marketing (later) | Informational | Product UI ≠ campaign creative ownership |

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Design, Chief of Staff
```
