# Security Interfaces

Governed by `Departments/Security/SECURITY_CHARTER.md`.

## Layer Interfaces

| Layer | Contract |
|---|---|
| Core | Security gate in Quality Standard is non-optional; Constitution privacy/security rules bind all |
| Executive | Advises on risk trade-offs; does not replace CEO Accountable decisions |
| Governance | Supplies control evidence into Risk Framework; does not rewrite Risk Framework |
| Business | Constrains commercially attractive but unsafe options; Business does not waive controls alone |
| Execution | Security checkpoints as gates/Consulted — no shadow workflow |
| Enterprise Architecture | Domain Security; Capability bindings for controls/identity |
| Intelligence | Consumes threat intel patterns; contributes incident lessons; no fork |

## Peer Interfaces

| Peer | Edge | Summary |
|---|---|---|
| Engineering | Constraining + Enabling | Requirements, threat models, secure delivery constraints; reviews |
| Design | Constraining | Auth/consent/privacy UX requirements |
| QA | Enabling / Constraining | Delegated verification procedures; control fails not silently overridable |
| Analytics | Constraining | Data handling, PII event rules in measurement design |

## Boundary Clarifications

- **Governance vs Security:** Governance owns how risk is scored and accepted; Security owns what controls exist and whether they are adequate.  
- **Engineering vs Security:** Engineering implements Services; Security owns control adequacy.  
- **QA vs Security:** QA may run Security’s procedures; Security owns the procedure and fail authority for controls.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Security, Chief of Staff
```
