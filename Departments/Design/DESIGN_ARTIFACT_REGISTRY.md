# Design Artifact Registry

Governed by `Departments/Design/DESIGN_CHARTER.md`. Extends `Execution/ARTIFACT_CONTRACTS.md`.

| Artifact | Owning context | Consumers | Versioning | Acceptance |
|---|---|---|---|---|
| Experience Architecture Model | Experience Architecture | Eng, QA, Business (ref) | Semver | Traces to customer problem + initiative |
| Interaction / Flow Spec | Experience Architecture | Eng, QA | Semver | States, errors, empty paths included |
| Interface Design Spec | Interface Design | Eng, QA | Semver | Maps to Design System; a11y intent stated |
| Design System | Design Systems | Eng, Design, QA | Semver; breaking = major | Adoption rules + contribution rules |
| Component / Pattern Spec | Design Systems | Eng | Semver | Behavior + accessibility contract |
| Design Research Record | Design Research & Validation | Design, Business (ref), Intelligence harvest | Dated | Method + evidence + decision impact |
| Usability Validation Report | Design Research & Validation | Design, QA, Executive | Dated | Findings severity + disposition |
| Design Handoff Package | All (at boundary) | Engineering | Per Execution instance | Per `Execution/DEPARTMENT_HANDOFFS.md` |

## Single-Owner Notes

- **Design System** is Design-authoritative; Engineering implements conforming components — Engineering does not fork a rival system.  
- Business **Journey Map** (Customer Strategy) is business-level; Design Experience Architecture specializes it for product UI — do not duplicate competing journey authorities.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Design
```
