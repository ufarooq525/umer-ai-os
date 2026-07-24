# Autonomous Watchdog Architecture

> Watchdogs are specialists that **run automatically** — on schedules and on
> repository signals — observe a narrow domain, and **publish events**. Those
> events trigger the corresponding action specialists (SEO audit, QA verify,
> security review, …). Watchdogs never silently fix; they detect, grade,
> notify, and escalate.

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md` and
`Core/SPECIALIST_ARCHITECTURE_STANDARD.md`. Scheduling substrate is the Event
Bus Schedule Store (`Runtime/EventBus/EVENT_ARCHITECTURE.md` §4.4). Triggers
and fan-out use the Subscription Model
(`Runtime/EventBus/SUBSCRIPTION_MODEL.md`). Risk scoring aligns with
`Governance/RISK_MANAGEMENT_FRAMEWORK.md`. Repository-aware signals consume
`Runtime/RepoIntelligence/REPO_INTELLIGENCE_ARCHITECTURE.md`.

**No implementation in this document** — architecture and contracts only.

---

## 1. Positioning

| Role | What it does | What it does not do |
| --- | --- | --- |
| **Watchdog specialist** | Observes continuously; emits typed finding events; maintains watchdog history | Mutate product code; auto-remediate; approve gates |
| **Action specialist** | Responds to watchdog (and demand) events with audits, fixes, reviews | Own the schedule that woke it |
| **Schedule Store** | Releases due tick events into the broker | Know domain meaning |
| **Dispatcher** | Matches tick/finding events to subscriptions | Decide severity or escalation |

Watchdogs are **first-class specialists** (specs under `specialists/`, Trust
mandate, Memory Contract, work-package execution). Their Authority Class is
**Advise** (default) or **Constrain** (Security Watchdog may emit blocking-class
findings that open gates — it still does not *pass* gates).

They are **not** Runtime Observability (platform health), not Analytics product
metrics, and not a shadow cron daemon outside Message Fabric.

```
┌─────────────┐    tick / change.*     ┌──────────────┐   watchdog.*.*      ┌─────────────────┐
│ Schedule /  │ ─────────────────────▶ │   Watchdog   │ ─────────────────▶ │ Action specialist│
│ Repo signals│                        │  specialist  │                    │ (audit / review) │
└─────────────┘                        └──────┬───────┘                    └────────┬────────┘
                                              │                                     │
                                              ▼                                     ▼
                                       History + notify                      Work / gates / memory
```

---

## 2. Watchdog catalog (initial six)

Each watchdog owns one observation domain and a default cadence set. Cadences
are declarative on the specialist spec; they are not hard-coded in Runtime.

### 2.1 SEO Watchdog — `seo.watchdog`

| | |
| --- | --- |
| Observes | Crawlability, index signals, Lighthouse SEO category, structured data, sitemap/robots drift, ranking-history deltas (via SEO Memory) |
| Default cadence | Nightly (all registered web projects); Weekly deep audit trigger; on `delivery.deployment.completed` (prod) |
| Emits | `watchdog.seo.degraded`, `watchdog.seo.regression`, `watchdog.seo.anomaly` |
| Default subscribers | `seo.audit` (action), Observability (mirror) |
| Memory | Reads SEO Memory (`lighthouse_history`, `ranking_history`, `previous_audit`); writes watch outcomes |

### 2.2 QA Watchdog — `qa.watchdog`

| | |
| --- | --- |
| Observes | Flaky/ignored-test growth, coverage deltas, known-regression recurrence, suite health vs QA Memory |
| Default cadence | Every commit / PR (`change.pr.created|merged`, `quality.tests.failed`); Nightly suite pulse; Weekly ignored-test debt report |
| Emits | `watchdog.qa.flaky_surge`, `watchdog.qa.coverage_regress`, `watchdog.qa.ignored_debt`, `watchdog.qa.regression_recurred` |
| Default subscribers | `qa.verify`; `engineering` on recurrence |
| Memory | Reads/writes QA Memory (`known_regression`, `ignored_test`, `historical_failure`) |

### 2.3 Security Watchdog — `security.watchdog`

| | |
| --- | --- |
| Observes | Dependency advisories, secret-pattern hits in diffs, Permission Graph drift, expired `accepted_risk` entries, known-vuln age |
| Default cadence | Hourly advisory poll (deps); Every commit (diff + Permission Graph impact); Daily accepted-risk expiry sweep; Weekly posture digest |
| Emits | `watchdog.security.advisory`, `watchdog.security.secret_suspected`, `watchdog.security.policy_drift`, `watchdog.security.risk_expired` |
| Default subscribers | `security.review` (high/critical always); Control Plane on Critical |
| Memory | Security Memory (`accepted_risk`, `known_vulnerability`, `exception`) |
| Notes | Impact floor per Risk Framework — credential/data exposure never understated |

### 2.4 Performance Watchdog — `perf.watchdog`

| | |
| --- | --- |
| Observes | Lighthouse/perf budgets, CWV deltas, sustained drop windows (debounce), API latency SLO burn if product signals available |
| Default cadence | Hourly sample (prod URLs); Nightly full page set; on `delivery.deployment.completed`; Weekly trend digest |
| Emits | `watchdog.perf.budget_breach`, `watchdog.perf.sustained_drop`, `watchdog.perf.regression` |
| Default subscribers | Engineering performance track / `eng.app-delivery`; `seo.audit` when CWV-coupled |
| Notes | Sustained-drop uses Schedule Store debounce (same pattern as `quality.performance.dropped`) |

### 2.5 Architecture Watchdog — `arch.watchdog`

| | |
| --- | --- |
| Observes | Module Graph drift (`MODULES.yaml` vs reality), layering violations, cyclic module deps, forbidden package use, ADR-required change without ADR pointer |
| Default cadence | Every commit (structural diff via Repo Intelligence); Nightly full graph consistency; Weekly architecture health digest |
| Emits | `watchdog.arch.module_drift`, `watchdog.arch.cycle_detected`, `watchdog.arch.layer_violation`, `watchdog.arch.adr_missing` |
| Default subscribers | `eng.app-delivery`; Chief of Staff digest on Weekly |
| Depends on | Repository Intelligence Code Graph |

### 2.6 Dependency Watchdog — `deps.watchdog`

| | |
| --- | --- |
| Observes | Lockfile drift, major/minor bumps, abandoned packages, license policy breaks, transitive advisory fan-in |
| Default cadence | Hourly (registry metadata refresh); Every lockfile-touching commit; Weekly dependency hygiene report |
| Emits | `watchdog.deps.updated`, `watchdog.deps.policy_break`, `watchdog.deps.abandoned`, `watchdog.deps.advisory_fanin` |
| Default subscribers | `security.watchdog` / `security.review` (advisory path); Engineering on policy break |
| Notes | Complements Security Watchdog: deps owns *supply graph hygiene*; security owns *exploitability / accepted risk* |

---

## 3. Scheduling model

Watchdogs do **not** embed cron. They declare **Watch Schedules**; Runtime
materializes them as recurring Schedule Store entries that publish **tick
events**. Cadence meaning lives in the schedule; domain judgment lives in the
watchdog run.

### 3.1 Cadence vocabulary

| Cadence id | Semantics | Typical use |
| --- | --- | --- |
| `every_commit` | On `change.pr.created`, `change.pr.merged`, push-equivalent local batches | Diff-scoped checks (QA, Arch, Security, Deps) |
| `hourly` | Cron-like; Schedule Store releases `watchdog.tick` with `cadence: hourly` | Advisories, perf samples |
| `nightly` | Once per calendar day per timezone policy (default project/tenant TZ) | Broad health sweeps |
| `weekly` | Once per ISO week (configurable weekday/hour) | Digests, debt reports |
| `on_deploy` | On `delivery.deployment.completed` (filterable by environment) | SEO/Perf post-prod |
| `on_signal` | On named quality/repo events (already on the bus) | Reactive wake without waiting for cron |

A watchdog may bind **multiple** cadences. Each binding is an independent
schedule + subscription pair.

### 3.2 Watch Schedule record (desired state)

Declared on the specialist spec; Registry reconciles to Schedule Store +
Subscription Records (same desired-state pattern as ordinary subscriptions):

```yaml
# illustrative frontmatter — not implementation
specialist_id: seo.watchdog
authority_class: Advise
schedules:
  - id: seo.nightly
    cadence: nightly
    at: "02:30"
    timezone: project          # or fixed IANA
    scope: all_registered_web_projects
    priority: low
    jitter: 15m                # avoid thundering herd across projects
  - id: seo.on_prod_deploy
    cadence: on_deploy
    filter:
      payload.environment: production
    priority: normal
  - id: seo.weekly_deep
    cadence: weekly
    on: sunday
    at: "03:00"
    mode: deep                 # passed into the run as input
    priority: low
```

### 3.3 Tick → run flow

```
Schedule due
  → publish watchdog.tick { watchdogId, scheduleId, cadence, scope, notBefore }
  → Dispatcher matches seo.watchdog subscription on watchdog.tick
  → cmd.agent.dispatch (Work Package: WatchRun)
  → Watchdog observes (Repo Intelligence / tools / memory)
  → publish watchdog.<domain>.<finding>  (0..N) + watchdog.run.completed
  → Action specialists subscribe to findings
```

Rules:

- **One tick → one WatchRun work package per scope unit** (usually per
  `projectId`). Multi-project nightly schedules fan out N packages, not one
  mega-run.
- **Jitter + lease**: due-poller already elects via lease; per-project jitter
  spreads load.
- **Idempotency**: `dedupKey = hash(watchdogId, scheduleId, scopeKey, periodBucket)`
  so a restart does not double-fire the same nightly bucket.
- **Catch-up policy** (declared per schedule): `skip` (default for hourly —
  miss is better than stampede) \| `run_latest` (nightly — one catch-up) \|
  `backfill` (operator-only; weekly digests rarely).
- **Pause**: schedule `state: paused` for a project (maintenance) without
  deleting history.

### 3.4 Every-commit schedules

These are **not** Schedule Store rows. They are ordinary event subscriptions
with `debounce` (e.g. 5–10m per `orderingKey = projectId+branch`) so push
bursts coalesce. Architecturally they still count as a cadence binding of type
`every_commit`.

---

## 4. Priorities

### 4.1 Event lanes (transport)

Finding events inherit or override priority lanes from
`EVENT_ARCHITECTURE.md`:

| Finding severity (domain) | Default lane | Notes |
| --- | --- | --- |
| Info / digest | `low` | Weekly reports, no action forced |
| Warning / degraded | `normal` | Action specialist may queue |
| Regression / policy break | `high` | Prompt action specialist |
| Critical (sec exposure, secret suspected, exploitability high) | `critical` | Security + notify + escalate ladder |

Tick events themselves are usually `low`/`normal` — **severity lives on
findings**, not on the clock.

### 4.2 Watchdog run priority vs demand work

WatchRuns compete for Agent Runtime capacity with demand-driven work packages.
Resource & Economy policy:

| Class | Default relative priority |
| --- | --- |
| Human-gated / Critical finding follow-up | Highest |
| Demand Work Packages (features/bugs) | High |
| `every_commit` watchdog (blocking signal path) | High |
| Hourly watchdogs | Normal |
| Nightly / Weekly watchdogs | Low (preemptible; must not starve demand) |

A Critical finding **promotes** the follow-up action specialist dispatch even if
the originating tick was low-priority.

### 4.3 Severity model (payload)

Every finding event carries a normalized severity block:

```yaml
severity:
  tier: info | warning | high | critical   # maps to lanes above
  riskScore: 1..25                         # Risk Framework Likelihood × Impact when applicable
  confidence: certain | probable | heuristic
  sticky: bool                             # remains open until cleared (see history)
```

Security findings apply the Impact scoring floor from
`RISK_MANAGEMENT_FRAMEWORK.md`.

---

## 5. Notifications

Notifications are **projections of events**, not a parallel messaging system.
A Notification Router (service consumer on the Fabric) subscribes to
`watchdog.*.*` and `watchdog.run.completed`, applies routing policy, and
delivers via Session & Human Collaboration / Extension channels.

### 5.1 Channels

| Channel | Use |
| --- | --- |
| In-app inbox (Control / Web UI) | Always — durable, auditable |
| Session / HITL surface | When a gate or human ack is required |
| External (email, chat webhook) | Per-project notification policy; Extension Runtime egress |
| Audit mirror | Security-relevant and Critical always |

### 5.2 Routing policy (per project / tenant)

```yaml
# illustrative policy — owned by project ops, not by watchdog code
notifications:
  watchdog.security.*:
    critical: [human_anchor, security_lead, in_app, audit]
    high: [security_lead, in_app]
  watchdog.qa.regression_recurred:
    high: [qa_lead, eng_owner, in_app]
  watchdog.*.*:
    info: [in_app_digest]          # folded into daily/weekly digest
  digests:
    daily: true
    weekly: true
```

Rules:

- **No notify-on-tick.** Humans are notified on findings (and digests), not on
  "watchdog woke up."
- **Digest folding.** `info`/`warning` without sticky open issues fold into
  daily/weekly digests to prevent alert fatigue.
- **Dedup.** Same `fingerprint` (below) within a quiet window does not
  re-page; it updates the open finding's last-seen.
- **Watchdog failure** (`watchdog.run.failed`) notifies platform operators
  (Runtime Observability path), not the domain lead — unless failure repeats
  N times (then escalate as operational risk).

---

## 6. Escalation

Escalation is time- and severity-based progression of an **open finding**, not
a one-shot page.

### 6.1 Ladder (default)

| Stage | Trigger | Action |
| --- | --- | --- |
| S0 Detected | Finding published | Action specialist subscribed; in-app notify per policy |
| S1 Acknowledged | Human or specialist ack within SLA | Clock pauses for ack SLA; remediation SLA starts |
| S2 Overdue | No ack or no remediation progress by SLA | Notify next owner (Department lead); bump priority lane |
| S3 Executive | Still open past escalation SLA, or Critical+Security | CEO / human principal path per Risk Framework; may open Incident |
| S4 Systemic | Same fingerprint recurred ≥ N times across periods | Chief of Staff: process/standard gap; optional harvest to org memory |

SLAs are **per severity and domain** (config), e.g. Critical security ack ≤ 1h;
Weekly SEO warning may have multi-day SLA.

### 6.2 Auto-escalation signals

- `watchdog.escalation.raised` — emitted by an Escalation service when timers
  fire (Schedule Store delayed events keyed by finding id).
- Sticky Critical findings auto-open or attach to
  `Execution/FAILURE_RECOVERY.md` Incident path when policy says so.
- Watchdogs **do not** escalate themselves by calling executives; they publish
  findings; Escalation service owns the ladder (separation of detect vs
  escalate — same spirit as Runtime never owning business judgment).

### 6.3 Clearance

Findings clear only via:

- Action specialist completion with `verdict: pass` referencing `findingId`, or
- Explicit human `wontfix` / accepted risk write to Security Memory (Security
  domain), or
- Supersession by a newer finding fingerprint with resolution notes.

Cleared findings emit `watchdog.finding.cleared` and remain in history.

---

## 7. History

Watchdog history is operational truth: **why did this audit run at 02:30?**
and **has this regression recurred?**

### 7.1 Records

| Record | Contents | Retention |
| --- | --- | --- |
| **WatchRun** | `runId`, watchdogId, scheduleId, cadence, projectId, commitSha/`asOf`, started/finished, outcome, findingIds[], cost/tokens | Hot 90d; warm per Audit/Governance |
| **Finding** | `findingId`, fingerprint, severity, evidence refs, status (`open\|acked\|mitigating\|cleared\|wontfix`), escalation stage, firstSeen/lastSeen | Durable while sticky; then warm |
| **Notification** | channel, recipients, template, result | Align with Audit for Critical |
| **Escalation** | stage transitions + timestamps | With finding |

Fingerprints: `hash(watchdogId, projectId, findingKind, stableTarget)` so the
same Lighthouse SEO regression on `/pricing` coalesces across nights.

### 7.2 Stores (no duplication of SoR)

- **Event History** — every tick, finding, clearance, escalation event
  (lineage via `parentEventId` / `correlationId`).
- **Watchdog History Store** — query-optimized projection (open findings,
  SLA timers, fingerprints). Rebuildable from Event History ⇒ derived, like
  Repo Intelligence graphs.
- **Specialist Memory** — durable lessons and baselines (Lighthouse history,
  ignored tests, accepted risks) per
  `Intelligence/MEMORY_ARCHITECTURE.md`; WatchRuns *update* memory, they do
  not replace it.
- **Audit** — security-relevant and Critical mirrored.

### 7.3 Query surfaces

- By project: open findings, MTTR, recurrence counts.
- By watchdog: false-positive rate, run success rate, mean findings/run.
- By fingerprint: timeline (first → escalations → clear) — feeds Continuous
  Improvement harvest.

---

## 8. Event catalog (`watchdog.*`)

Added to the Event Bus taxonomy under the same governance as `EVENT_TYPES.md`
(contracts + this architecture together):

### 8.1 Control / lifecycle

| Wire type | Purpose |
| --- | --- |
| `watchdog.tick` | Schedule or cadence wake |
| `watchdog.run.started` | WatchRun began |
| `watchdog.run.completed` | WatchRun finished (may have zero findings) |
| `watchdog.run.failed` | WatchRun errored |
| `watchdog.finding.cleared` | Finding closed |
| `watchdog.escalation.raised` | Ladder advanced |
| `watchdog.schedule.paused\|resumed` | Ops control |

### 8.2 Domain findings (emitters → default action subscribers)

| Wire type | Emitter | Default action subscriber |
| --- | --- | --- |
| `watchdog.seo.degraded\|regression\|anomaly` | seo.watchdog | seo.audit |
| `watchdog.qa.flaky_surge\|coverage_regress\|ignored_debt\|regression_recurred` | qa.watchdog | qa.verify |
| `watchdog.security.advisory\|secret_suspected\|policy_drift\|risk_expired` | security.watchdog | security.review |
| `watchdog.perf.budget_breach\|sustained_drop\|regression` | perf.watchdog | eng / perf track |
| `watchdog.arch.module_drift\|cycle_detected\|layer_violation\|adr_missing` | arch.watchdog | eng.app-delivery |
| `watchdog.deps.updated\|policy_break\|abandoned\|advisory_fanin` | deps.watchdog | security.review / eng |

Finding payloads share a core: `findingId`, `fingerprint`, `projectId`,
`asOf`, `severity`, `summary`, `evidenceArtifactIds[]`, `impactModules[]`
(from Repo Intelligence when available), `memoryRefs[]`.

Tree example:

```
watchdog.tick (nightly, seo.watchdog, project X)
  └─ watchdog.run.completed
       ├─ watchdog.seo.regression          → seo.audit subscription
       │    └─ specialist.seo.completed
       └─ (no critical) → folded to digest notification
```

---

## 9. Specialist shape (watchdog-specific)

Beyond standard Agent/Specialist sections, every watchdog declares:

| Section | Content |
| --- | --- |
| `schedules[]` | Cadences (§3.2) |
| `observes` | Signals, graphs, URLs, memory categories in scope |
| `emits` | Allowed finding types (Trust-checked) |
| `severity_policy` | Mapping from raw metrics → tier / riskScore |
| `noise_policy` | Debounce, fingerprint quiet window, min-delta thresholds |
| `escalation_policy_ref` | Named SLA ladder |
| `notification_policy_ref` | Named routing |
| Non-goals | Explicit: no auto-fix, no gate pass, no cross-domain expansion |

Watchdog vs action specialist pairing is **convention**, not a hard Runtime
couple — wiring is subscriptions. A finding with no subscriber is a Registry
defect at registration time (must declare ≥1 intended subscriber or
`observability-only`).

---

## 10. Interaction with Repo Intelligence & Memory

| Input | Watchdogs that use it |
| --- | --- |
| Impact / Module Graph | Arch, QA (scope), Security (permission impact), Deps |
| API / Permission Graph | Security, Arch |
| Dependency Graph | Deps, Security |
| Git History / co-change | QA recurrence confidence, Arch churn hotspots |
| Specialist Memory baselines | All — compare *now* vs remembered healthy/last |

Watchdogs must stamp `asOf: commitSha` (or observation timestamp for prod URL
checks) and refuse to claim "current" against a stale graph when freshness
policy requires refresh — same honesty rule as Repo Intelligence.

---

## 11. Failure modes

| Failure | Response |
| --- | --- |
| Tick storm / schedule bug | Dedup keys + jitter; circuit-break schedule on runaway publish rate |
| Watchdog forever-red (noise) | Noise policy + fingerprint quiet window; CoS reviews false-positive metric |
| Action specialist not subscribed | Registration reject |
| Watchdog auto-remediates code | Mandate violation; Trust deny; architecture non-goal |
| Silent schedule pause forgotten | Weekly digest includes paused schedules |
| Escalation without notify | Escalation events require Notification Router ack or Audit defect |
| Hourly catch-up stampede after outage | Default `skip` catch-up for hourly |

---

## 12. Metrics

| Metric | Intent |
| --- | --- |
| Schedule honor rate (ticks due vs runs started) | Scheduling reliability |
| Finding precision (cleared-as-fixed vs wontfix/false) | Noise control |
| Mean time to ack / clear by severity | Escalation health |
| Recurrence rate by fingerprint | Whether action specialists actually improve the system |
| WatchRun cost by cadence | Economy — nightly must stay in budget class |
| Demand-work starvation incidents | Low-priority watchdogs preempted correctly |

---

## 13. Non-goals

- No separate cron product or Kubernetes CronJob SoR — Schedule Store only.
- No auto-merge / auto-remediate from watchdogs.
- No replacement for demand-driven specialists (intake still publishes
  `work.*`; watchdogs are the autonomous plane).
- No conflation with Runtime Observability platform alerts (`obs.*`).
- No implementation, migrations, or specialist markdown files from this
  document alone.

---

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-25
owner: Runtime (scheduling/events), owning Departments (watchdog judgment), Chief of Staff (escalation/noise health)
related:
  - Runtime/EventBus/EVENT_ARCHITECTURE.md
  - Runtime/EventBus/SUBSCRIPTION_MODEL.md
  - Runtime/RepoIntelligence/REPO_INTELLIGENCE_ARCHITECTURE.md
  - Intelligence/MEMORY_ARCHITECTURE.md
  - Governance/RISK_MANAGEMENT_FRAMEWORK.md
  - Execution/FAILURE_RECOVERY.md
  - Core/SPECIALIST_ARCHITECTURE_STANDARD.md
```
