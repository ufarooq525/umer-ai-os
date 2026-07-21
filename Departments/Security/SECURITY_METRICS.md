# Security Metrics

Governed by `Departments/Security/SECURITY_CHARTER.md`, `Governance/KPI_FRAMEWORK.md`.

## Department Health

| KPI | Type | Counter |
|---|---|---|
| % security-designated initiatives with Threat Model before Eng→QA | Leading | Exception rate |
| Control catalog coverage for in-production Capabilities | Leading | Critical vuln aging |

## Organizational Effectiveness

| KPI | Type | Counter |
|---|---|---|
| Mean time to remediate Critical/High vulns | Lagging | Change fail / availability impact |
| Security exception aging (open unaccepted/unclosed) | Leading | Residual risk incidents |

## Quality

| KPI | Type | Counter |
|---|---|---|
| Security verification fail escape (control fails found post-release) | Lagging | Procedure coverage |
| % delegated procedures executed with evidence by QA | Leading | Escaped control defects |

## Capability Maturity

| KPI | Type | Counter |
|---|---|---|
| Heat Map ownership clarity for Security Controls Capability | Lagging | Dual-ownership incidents with Eng |

## Operational Excellence

| KPI | Type | Counter |
|---|---|---|
| Incident detection→containment time (security class) | Lagging | False positive rate |
| Constraining-edge clarity (% Eng work with explicit Sec N/A or requirements) | Leading | Mid-flight security surprises |

No vanity “number of blockers raised.”

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Security
```
