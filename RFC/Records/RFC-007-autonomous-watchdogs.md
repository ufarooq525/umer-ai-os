# RFC-007 — Autonomous Watchdog specialists

## Status
Accepted

## Date Proposed
2026-07-25

## Author
Chief Systems Architect

## Layers Affected
Runtime (Schedule Store usage; `watchdog.*` taxonomy); Executive/Departments (six watchdog specialists); Notification / Escalation services

## Summary
Ratify `Runtime/Watchdogs/WATCHDOG_ARCHITECTURE.md`: SEO, QA, Security,
Performance, Architecture, Dependency watchdogs run on declared cadences
(nightly/hourly/weekly/every-commit/on-deploy), emit findings, never
auto-remediate; action specialists subscribe.

## Motivation
Demand-driven audits miss regressions between intakes. Autonomous observation
with event fan-out is required at specialist scale.

## Why This Requires an RFC
Doctrine §3 (new specialist class + Runtime schedule/event mechanics).

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | Controllers reconcile; CronJob-like schedules as desired state | K8s CronJob as SoR | Schedule Store |
| Temporal | Durable timers | Workflow-as-watchdog | — |
| Airflow | SLA miss / sensors | DAG farm for all watches | — |
| LangGraph | — | Continuous agent loops without events | — |
| Prefect | Deployments / schedules | — | — |
| OpenTelemetry | Alert routing separation | Obs alerts as watchdog findings | Domain findings ≠ platform |
| GitHub Actions | `schedule:` + `push:` triggers | — | cadence vocabulary |
| Ray | — | — | — |
| AutoGen | — | Agents silently fixing | Non-goal |

---

## 2. Architecture Proposal

Six watchdogs, tick→WatchRun→findings, priorities, notifications, escalation
ladder, history fingerprints: see SoR. Depends on RFC-004 Schedule Store and
optionally RFC-006 for Arch/Deps/QA scope.

---

## 3. Interfaces (Ports)

Watch Schedule reconcile (Registry); Notification Router (service subscriber);
Escalation timer service (Schedule Store). Watchdogs are specialists via Agent
Runtime — no new domain.

---

## 4. Contracts

`watchdog.tick`, `watchdog.run.*`, domain findings, `watchdog.finding.cleared`,
`watchdog.escalation.raised`; WatchRun/Finding records; schedule frontmatter
schema.

---

## 5. Failure Handling

Tick storm dedup; noise policy; missing subscriber = registration reject;
catch-up `skip` for hourly; escalate notify ack required. SoR §11.

---

## 6. Extension Points

New watchdog = specialist spec + catalog + emissions. **Non-extension:**
auto-merge remediations; separate cron product; notify-on-tick.

---

## 7. Testing Strategy

Schedule honor; fingerprint coalesce; severity→lane mapping; escalation timer;
idempotent ticks; subscription wiring tests.

---

## 8. Migration Strategy

Additive specialists; cadences default paused per project until enabled; no
change to demand-driven audits.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Only human-triggered audits | Misses continuous regression |
| Auto-remediate bots | Authority / safety violation |
| External cron only | Bypasses Fabric history |
| Do nothing | — |

## Trade-offs
Gain: continuous quality. Cost: noise risk — mitigated by digests + fingerprints.

---

## Architecture Review Notes
Doctrine §15: pass.

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect | Approved | Completeness |
| CEO | Approved | Principal-authorized |
| Chief of Staff | Approved | Escalation vs CoS Agent boundaries clear |

## Implementation Gate
Requires RFC-004 Schedule Store phases for ticks. Specialist markdown may be
drafted after contracts for `watchdog.*` exist.

## Resulting Record
- ADR: `Knowledge/Architecture/ADR/ADR-0005-watchdog-specialists.md`
- SoR: `Runtime/Watchdogs/WATCHDOG_ARCHITECTURE.md`

## Related
RFC-004, RFC-005, RFC-006
