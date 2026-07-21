# Security Operating Model

Governed by `Departments/Security/SECURITY_CHARTER.md`.

## How Work Enters

1. **Constraining path:** Capability classes or initiatives designated as security-relevant require Security requirements/threat model before Engineering exit to QA (may start earlier). Entered via Execution — Security is Consulted/Constrained, not a side channel.  
2. **Assurance path:** Control reviews, vulnerability intakes, incident technical response — logged and tied to Execution or Governance risk records as applicable.  
3. **Exception path:** Control exceptions require Governance risk acceptance — Security recommends, does not unilaterally accept principal-level risk.

## How Work Moves Internally

```text
Security Architecture & Threat Modeling → Product & Application Security
                ↓                              ↓
     Identity & Access Control          Compliance & Control Assurance
                ↓
     Vulnerability & Security Response
```

## How Work Exits

- Threat Models / Control Requirements → Engineering, Design  
- Security Verification Procedures → QA (delegated execution)  
- Assurance Evidence → Governance risk / compliance consumers  
- Exception recommendations → Executive/Governance/Human Principal per blast radius  

## Decision Boundaries

| Decision | Owner |
|---|---|
| Control requirements for a Capability class | Security |
| Implementation design within requirements | Engineering |
| Residual risk acceptance above threshold | Governance process + Executive/Human Principal |
| Gate Fail on security verification | Security Accountable for control judgment; QA records evidence |
| Product scope vs security scope trade-off | CEO with Security + Business input |

## Escalation

Unresolved Eng/Security conflict → CEO; critical vulnerability → Risk framework Critical bypass of calendar; process abuse → CoS.

## Cadence

Per-instance threat/control reviews as designated; Weekly vuln posture; Monthly assurance metrics; Quarterly risk alignment with Governance; Annual control catalog review.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Security, Chief of Staff, CEO (exceptions)
```
