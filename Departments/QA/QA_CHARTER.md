# Quality Assurance Department Charter

> QA is the organizational owner of **independent verification and release validation**. QA is not Engineering’s test sub-team, not Security’s control owner, and not a substitute for Core Quality Standard — it applies and evidences those gates with independence.

Governed by `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`. Domain: QA. Topology: **Pipeline Stage** (downstream of Engineering). Folder: `Departments/QA/`.

## Mission

> We exist to independently determine whether deliverables meet stated quality bars before they are treated as releasable, by owning quality strategy, verification, non-functional assessment, and release validation, so that the enterprise does not confuse “built” with “fit for production.”

## Purpose

Preserve an adversarial-healthy separation: Engineering produces; QA validates. Without QA, Engineering self-certifies and escaped defects become cultural norms.

## Primary Capabilities

| Capability | Notes |
|---|---|
| Quality Assurance | Registered — Product Delivery; QA is primary Accountable |

## Responsibilities

1. Quality strategy for how Core Quality gates are evidenced per deliverable class  
2. Functional verification & validation against acceptance criteria  
3. Non-functional quality assessment (performance, reliability, accessibility verification — with Design/Eng intent as input)  
4. Release validation sign-off inputs per Org Chart RACI  
5. Quality evidence artifacts and gate records for Execution  
6. Defect taxonomy signals feeding Intelligence / Continuous Improvement (does not own Intelligence)  

## Does Not Own

| Temptation | Actual owner |
|---|---|
| Building the product | Engineering |
| Defining Core Quality Standard itself | `Core/QUALITY_STANDARD.md` |
| Security control frameworks & security test authority for controls | Security |
| Design System authority | Design |
| Business success criteria definition | Business |
| Runtime orchestration of gates | Execution (QA supplies evidence; Execution owns gate mechanics) |
| “Quality Engineering” as absorbing Engineering testability | Engineering owns build-path testability; QA owns independent assurance |

## Lifecycle Status

```yaml
lifecycle: Chartered
das_maturity: 2
topology: Pipeline Stage
primary_domain: QA
```

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: CEO (mandate), Chief of Staff (DAS), QA (stewardship once Staffed)
```
