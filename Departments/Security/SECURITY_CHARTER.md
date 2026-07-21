# Security Department Charter

> Security is the organizational owner of **security control design and assurance for the enterprise’s systems and data**. It is an Enabling Department with Constraining authority — not a Pipeline Stage that every ticket must visit as a build step, and not a duplicate of `Governance/RISK_MANAGEMENT_FRAMEWORK.md`.

Governed by `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`. Domain: Security (`Enterprise_Architecture/ENTERPRISE_DOMAIN_MAP.md`). Topology: **Enabling** (cross-cutting Constraining edges).

## Mission

> We exist to define and assure the security controls that keep organizational systems and data within acceptable risk, by owning security architecture, threat models, identity/access control requirements, product security, and control assurance, so that Engineering can implement safely, QA can verify delegated checks, and Governance can score residual risk honestly.

## Purpose

Separate **control ownership** from **delivery ownership**. Engineering implements; Security decides what “secure enough” means for controls and verifies control adequacy. Governance remains the org-wide risk policy plane.

## Primary Capabilities

| Capability | Notes |
|---|---|
| Security Controls & Assurance | Register at ratification under Governance/Security Level-1 as delivery Capability distinct from Governance Risk & Compliance *policy* |
| Identity Control Delivery | Authentication/Authorization *control requirements and assurance* — implementation may sit in Engineering under Security Constraining specs |

Clarify: Nascent Identity Capabilities in EA may be realized by Engineering Services under Security’s control requirements — Security remains Accountable for control adequacy; Engineering for implementation of Services.

## Responsibilities

1. Security architecture and threat modeling for systems/Capabilities  
2. Identity and access control requirements and assurance  
3. Product/application security requirements and review  
4. Compliance-facing control definitions and assurance evidence (with Legal later for counsel)  
5. Vulnerability management policy for product systems and security incident technical direction  
6. Constraining interfaces into Engineering, Design, QA, Analytics, Execution  

## Does Not Own

| Temptation | Actual owner |
|---|---|
| Org-wide risk scoring framework & risk appetite policy | `Governance/RISK_MANAGEMENT_FRAMEWORK.md` |
| Building product features | Engineering |
| Independent functional QA authority | QA |
| Enterprise Architecture taxonomy | EA |
| Business investment trade-offs (incl. accepting risk commercially) | Business + Executive + Human Principal per RACI |
| Privacy legal counsel | Legal (later) |
| Corporate IT endpoint ops | IT/Operations (later) |
| Embedding as Engineering/Security stub folder architecture | Pre-DAS stub only — this Charter is authoritative |

## Lifecycle Status

```yaml
lifecycle: Chartered
das_maturity: 2
topology: Enabling
primary_domain: Security
```

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: CEO (mandate), Chief of Staff (DAS), Security (stewardship once Staffed)
```
