# Engineering Playbook

> Narrative integrator for the Engineering Department. Read after the Charter, Operating Model, Interfaces, Dependency Graph, Artifact Registry, Metrics, Failure Modes, Ten-Year Architecture, and `Contexts/`.

Governed by `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md` §12.

## 1. One-Sentence Mandate

Engineering turns approved intent into operable production systems and keeps those systems safely changeable.

## 2. Placement

- **Domain:** Engineering (Delivery)  
- **Capabilities:** Software Implementation (+ Platform Services, Release Mechanics, Production Telemetry, Engineering Systems as registered)  
- **Topology:** Pipeline Stage with internal Enabling contexts  

## 3. How Work Enters and Leaves

Enters only via Execution with Business-traceable intent and validated upstream artifacts. Leaves primarily to QA via Handoff Package; ownership transfers on acknowledgment.

## 4. Bounded Contexts

| Context | Role |
|---|---|
| Solution Architecture | System shape, reference architectures, ADRs |
| Application Delivery | Build/change product systems (all surfaces) |
| Platform | Shared runtime/environment golden paths (Infra merged here) |
| Release Engineering | Promotion, release, rollback models |
| Engineering Systems | Developer experience / productivity enablement |
| Production Observability | SLOs, system telemetry, restore signal |
| Technical Stewardship | Debt portfolio, engineering standards evolution |

Collaboration: Architecture sets boundaries → Delivery builds on Platform golden paths → Release promotes → Observability proves operability → Stewardship records decisions and debt.

## 5. End-to-End Example

Approved roadmap item enters Execution → Design handoff accepted → Solution Architecture Model + Interface Contracts produced → Application Delivery implements on Platform Standard → Engineering Test Evidence + Release Candidate → QA handoff → (on QA pass and gates) production release per Release Model → SLO Record updated → lessons to Intelligence → debt items logged if shortcuts taken under time pressure.

## 6. Business-Intent Traceability

“Why is Engineering building this?” → Product Management Roadmap / Business Case success criteria via the Execution instance — never “because someone asked in chat.”

## 7. Inheritance

Core, Governance, Execution, Intelligence, and Enterprise Architecture apply by inheritance. This Playbook links; it does not restate those layers.

## 8. Specialty Escalation

- Ambiguous product intent → Executive/Business, not silent scope invention  
- Design/Eng conflict → direct resolution then CEO  
- Control exception → Security + risk acceptance path  
- Chronic Platform blockage → CoS + possible Ten-Year split evaluation  

## 9. Local Anti-Patterns

Intent bypass; EA cosplay; QA capture; DevOps fossil; surface silos; platform ivory tower; AI side-system; zombie Active.

## 10. One-Sentence Summary

**Engineering is the Capability-bound technical delivery owner — Architecture, Delivery, Platform, Release, Systems, Observability, Stewardship — while Business intends, Execution runs, QA verifies, and Security constrains.**

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering
```
