# Engineering Failure Modes

> What breaks if Engineering is poorly designed — architectural, organizational, and decade-scale consequences.

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Architectural Risks

| Failure mode | Consequence |
|---|---|
| Intent bypass (no Execution / no Business trace) | Untethered systems; portfolio analytics cannot close the value loop |
| EA cosplay | Shadow taxonomy; Capability Model becomes fiction |
| QA capture (self-certifying release) | Independent verification collapses; escaped defects normalize |
| Shadow Security Department inside Eng | Dual control ownership; compliance gaps or theater |
| DevOps fossil org | Nobody owns Platform, Release, or Observability end-to-end |
| Surface silos (Backend vs Frontend as contexts) | Contract voids; handoff tax; decade-obsolete org shape |
| Platform ivory tower | Golden-path rejection; shadow tooling; toil explosion |
| Observability ≠ Analytics confusion | Operable systems without business signal — or dashboards without operators |
| AI side-systems | Unobservable, ungated production AI outside Application Delivery/Platform contracts |

## Organizational Risks

| Failure mode | Consequence |
|---|---|
| Bottleneck monopoly | Entire value stream waits on Engineering; org invents side channels |
| Charter drift | Agents and stubs expand mandate; RACI becomes theater |
| Zombie Active | Heat Map lies; intake of new work against hollow capacity |
| Debt denial | Change cost compounds until delivery freezes |
| Debt-only Engineering | No value realization; Business loses trust in technical delivery |

## Long-Term Consequences (10-year)

- Repositories and systems that cannot be safely changed  
- Every new product invents its own delivery culture  
- Reconciliation projects that cost more than original delivery  
- Loss of the OS’s compounding advantage: contracts and memory replaced by heroics  

## Detection Signals

Rising handoff rejection without learning; Heat Map “Partially Owned” stuck; SLO burn with rising deploy frequency and rising fail rate together; CoS repeated findings on side channels.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering, Chief of Staff
```
