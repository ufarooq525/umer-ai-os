# Design Operating Model

Governed by `Departments/Design/DESIGN_CHARTER.md`, `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`.

## How Work Enters

Via `Execution/REQUEST_LIFECYCLE.md` with Business-traceable intent (Customer Strategy problems, Product Brief/roadmap items). Design does not invent portfolio scope.

Entry requires: clear problem/outcome, audience context from Business (or explicit research plan), and Execution instance.

## How Work Moves Internally

```text
Design Research & Validation → Experience Architecture → Interface Design
                                         ↓
                                  Design Systems (continuous Enabling)
```

## How Work Exits

Primary Sequential exit to **Engineering** with Handoff Package: experience specs, interface specs, Design System references, accessibility intent, known caveats, linked Execution instance.

Secondary: QA receives design acceptance criteria relevant to experience gates; Marketing (later) may consume brand-adjacent product UI guidance without owning Design System.

Ownership transfers on Engineering acknowledgment.

## Decision Boundaries

| Decision | Owner |
|---|---|
| Experience/interaction choice within approved scope | Design |
| Design System breaking change | Design Accountable; Engineering Consulted; CoS Informed |
| Conflict Design vs Engineering on feasibility | Direct resolution → CEO |
| Scope/problem reframing | Business/Executive — not silent Design scope expand |
| Irreversible customer-facing brand/legal | Human Principal / future Marketing-Legal path |

## Escalation

Unclear customer problem → Business Customer Strategy; capacity → PM; process defects → CoS; Security-affecting UX (auth, consent) → Security Constraining review.

## Cadence

Weekly delivery sync; Monthly Design System health; Quarterly DAS/metrics; Annual system coherence review.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Design, Project Manager (capacity), Chief of Staff (audit)
```
