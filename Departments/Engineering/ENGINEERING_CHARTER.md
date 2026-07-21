# Engineering Department Charter

> Engineering is the organizational owner of **technical delivery**. It transforms approved Business initiatives — once entered through Execution — into durable, operable production systems. Engineering is not “a software team,” not a prompt pack, and not a substitute for Enterprise Architecture, Business, QA, or Security.

Governed by `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`. Placement: `Governance/ORGANIZATIONAL_CHART.md` (Pipeline Stage). Domain: Engineering (`Enterprise_Architecture/ENTERPRISE_DOMAIN_MAP.md`).

## Mission

> We exist to turn approved organizational intent into reliable production systems, by owning solution architecture, application delivery, platform foundations, release mechanics, engineering systems, production observability, and technical stewardship, so that QA can verify, Security can constrain, Support can operate against known systems, and the enterprise can change software safely for a decade.

## Purpose

Close the gap between **funded intent** and **running reality**. Without Engineering, Capabilities remain aspirational, Design has no producer to hand to, QA has nothing independent to verify, and “who owns the running system?” has no answer.

## Topology

**Pipeline Stage** (primary value stream segment: Design → Engineering → QA), with internal **Enabling** contexts (Platform, Engineering Systems, Observability).

## Primary Capabilities

| Capability | Registry status |
|---|---|
| Software Implementation | Registered — Product Delivery (`Enterprise_Architecture/ENTERPRISE_CAPABILITY_MODEL.md`) |
| Platform Services | To be registered at Charter ratification as Level-2 under Product Delivery / Platform |
| Release Mechanics | To be registered — delivery of safe promotion/rollback ability |
| Production Telemetry (system) | To be registered — distinct from Analytics & Measurement |
| Engineering Systems | To be registered — internal delivery enablement |

Primary Accountable owner for **Software Implementation**. Shared/Enabling participation in related Capabilities must not create dual Accountable ownership.

## Responsibilities

1. Technical realization of approved, Execution-entered initiatives  
2. Solution Architecture for how Capabilities become Services/Platforms  
3. Application systems across all delivery surfaces (API, web, mobile, edge, AI-in-production as modality)  
4. Platform foundations (environments, shared runtime substrate, golden paths)  
5. Release mechanics (build → promote → release → rollback), gated by Execution/Governance  
6. Engineering systems (CI foundations, developer platform ergonomics)  
7. System-level production observability (SLOs, error budgets, operational telemetry)  
8. Engineering-side quality (testability, automated verification in the delivery path)  
9. Technical debt as a managed portfolio (visibility + remediation proposals)  
10. Technical ADRs and Engineering standards that refine — never contradict — Core/Governance  

## Does Not Own

| Temptation | Actual owner |
|---|---|
| What to invest in / why | `Business/` |
| Delegation, schedule, capacity arbitration | `Executive/` |
| Workflow routing, approval gate mechanics, instance state | `Execution/` |
| Org-wide policy, RACI, risk thresholds | `Governance/` |
| Enterprise Capability/Domain taxonomy | `Enterprise_Architecture/` |
| Organizational memory and research libraries | `Intelligence/` |
| Product UX authority and visual design system product ownership | `Departments/Design` |
| Independent verification and release validation authority | `Departments/QA` |
| Security control framework and compliance control ownership | `Departments/Security` |
| Business KPI definitions and portfolio value measurement | `Business/` / `Departments/Analytics` (see Analytics Charter for split) |
| Customer communication of incidents | Support (future phase) |
| Commercial commitments | Sales / Business (future / existing layers) |

## Organizational Boundaries

- **Enterprise Architecture vs Solution Architecture:** EA models stable structure; Engineering owns delivery-time system shape. Engineering never redefines Domains/Capabilities locally.  
- **Backend/Frontend:** delivery surfaces under Application Delivery — not separate Departments or contexts.  
- **DevOps:** dissolved as an org concept; responsibilities live in Platform, Release Engineering, and Observability.  
- **Security Engineering:** control ownership stays in Security Department; Engineering implements secure delivery under Constraining interfaces.  
- **Pre-DAS stub folders** under `Departments/Engineering/` (e.g. role-named empty dirs) remain historical scaffolding until Agents are specified against Contexts; they do not define architecture.

## Lifecycle Status

```yaml
lifecycle: Chartered
das_maturity: 2
topology: Pipeline Stage
primary_domain: Engineering
```

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: CEO (strategic mandate), Chief of Staff (DAS compliance), Engineering (stewardship once Staffed)
```
