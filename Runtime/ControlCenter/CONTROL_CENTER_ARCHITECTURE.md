# AI OS Control Center Architecture

> The single human-facing **operations surface** for Umer AI OS: what is running,
> what is waiting, who is working, how healthy the machine is, what it costs, and
> how quality scores trend — so a CEO, Project Manager, Chief of Staff, or human
> principal can see the live system without reading Event History by hand.

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Consumes (does not own)
Orchestration, Event History, Control Plane gates, Resource & Economy, Memory
Access, Watchdogs, CoS Operations' Live Operations Model, and specialist
completion artifacts. Extends the thin `GET /v1/dashboard` already in
`apps/control-api` / `apps/web` into a first-class Control Center.

**No implementation in this document** — architecture and contracts only.

---

## 1. Positioning

| Surface | Question | Owner |
| --- | --- | --- |
| **Control Center (this)** | *What is the OS doing right now, and is it healthy?* | Runtime product UI (`apps/web`) + Control API read models |
| Control Plane Runtime | Gate waits / policy enforcement | Mechanical PEP — Control Center *displays* waits, does not redefine them |
| Runtime Observability | Are Runtime *services* (bus, workers) within SLO? | Grafana / OTel — platform, not portfolio |
| Analytics Department | Product/business KPIs | Out of scope here |
| CoS Operations Specialist | Live judgment / interventions | Publishes `ops.*`; Control Center renders the model |

**Noun rule.** The Control Center is a **read-optimized projection + interaction
shell**. It never becomes a second Orchestration, never invents priority scores,
and never auto-approves gates. Drill-downs end in the same Work Package / gate /
event trees the Runtime already owns.

```
 Event History · LiveOpsModel · Economy ledgers · Memory stats
 Watchdog History · Specialist completions · Gate waits · Audit
                         │
                         ▼
              ┌─────────────────────┐
              │  Control Center     │
              │  Aggregation Plane  │  ← derived, rebuildable
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  apps/web Control   │
              │  Center shell       │
              └─────────────────────┘
```

---

## 2. Goal

One composition that answers, at a glance:

1. Work in motion (running / queued workflows)
2. Who is busy (specialists) and whether memory/cost/health are OK
3. How work is connected (workflow / event graph)
4. What went wrong (failures, retries)
5. Quality posture (QA / SEO / Security / Performance averages)
6. Economy (cost per workflow, average completion time)

…with every tile drillable to evidence (instance, event, artifact, audit).

---

## 3. Information architecture

### 3.1 Primary layout (one Control Center home)

Not a sprawl of equal cards. One viewport composition with a fixed hierarchy:

| Zone | Role | Widgets |
| --- | --- | --- |
| **A — System pulse** | Top strip: is the machine OK? | System Health, open Critical findings, pending gates count |
| **B — Work motion** | Dominant left/center | Running Workflows, Queued Workflows, Workflow Graph |
| **C — Agents & memory** | Right rail | Specialists, Memory Usage |
| **D — Quality & economy** | Lower band | Avg QA / SEO / Security / Performance, Cost/Workflow, Avg Completion Time |
| **E — Incident stream** | Lower or side drawer | Events (tail), Failures, Retries |

Secondary routes (not the home composition): per-EXEC detail, Event tree,
DLQ/replay, Routing table, Watchdog findings, Audit — linked from tiles,
already partially scoped in Event Bus Phase 6.

### 3.2 Required widgets (contracts)

Each widget declares: **metric definition**, **primary data source**,
**refresh**, **drill-down**.

#### Running Workflows

| | |
| --- | --- |
| Shows | EXEC instances / Work Packages in `Running` / `Dispatched` / stage-in-progress |
| Fields | `execId`, `projectId`, `stage`, bound `specialistId`, elapsed, SLA timer state, ETA (from CoS Ops) |
| Source | Live Operations Model + Orchestration Run Records |
| Refresh | Realtime on `orch.*` / `workpackage.*` |
| Drill | EXEC detail → stage list → Work Package → event tree |

#### Queued Workflows

| | |
| --- | --- |
| Shows | Work Packages in `Queued` / `Draft` awaiting dispatch; gate-blocked waits called out separately |
| Fields | priority score, wait time, specialist target, blocker class if any |
| Source | LiveOps queue[] + Control Plane pending gates |
| Refresh | Realtime |
| Drill | Queue item → priority/Opportunity Cost context; gate wait → resolve panel |

#### Specialists

| | |
| --- | --- |
| Shows | Registered specialists: health, utilization (slots in use / max), open Work Packages, recent error rate |
| States | `healthy` \| `degraded` \| `paused` \| `offline` (from `ops.specialist.*` + Registry) |
| Source | Registry Fabric + CoS Ops specialists[] + Agent Runtime heartbeats |
| Refresh | Near-realtime (≤15s) |
| Drill | Specialist detail → recent runs, memory store summary, subscriptions |

#### Memory Usage

| | |
| --- | --- |
| Shows | Per specialist-store and aggregate: entry counts, Hot/Warm/Cold mix, summary token budget used, recent writeback rate |
| Not | Host RAM/disk (that is Runtime Observability) |
| Source | Memory Access stats + Specialist Memory STORE metadata |
| Refresh | Periodic (1–5 min) + on `memory.writeback.acked` |
| Drill | Store → SUMMARY + top Hot entries; compress backlog |

#### Workflow Graph

| | |
| --- | --- |
| Shows | For selected EXEC (or portfolio overview): stage/specialist graph with live edge status — completed / running / waiting / failed |
| Also | Optional overlay: event parent-child tree under one `correlationId` |
| Source | Orchestration stage graph + Event History lineage |
| Refresh | Realtime for selected instance |
| Drill | Node → Work Package / gate / artifact |

#### Events

| | |
| --- | --- |
| Shows | Live tail of Event History (filterable by domain, priority, project, correlation) |
| Source | Event History `query()` |
| Refresh | Realtime stream (SSE/WebSocket projection) or short poll |
| Drill | Envelope detail → parent chain → deliveries / DLQ |

#### Failures

| | |
| --- | --- |
| Shows | Recent `agent.run.failed`, `workpackage.failed`, `watchdog.run.failed`, gate fails, `fabric.dlq.enqueued` |
| Fields | type, instance, specialist, error class, attempt, link to retry/DLQ |
| Source | Event History + Resilience / DLQ mirrors |
| Refresh | Realtime |
| Drill | Failure → run log artifact; DLQ → replay action (authorized) |

#### Retries

| | |
| --- | --- |
| Shows | In-flight and recent retries: attempt n/N, backoff `notBefore`, policy name |
| Source | Schedule Store redelivery rows + delivery records (`RETRY_POLICY.md`) |
| Refresh | Near-realtime |
| Drill | Retry → original event + subscription |

#### Average QA Score

| | |
| --- | --- |
| Definition | Mean of sealed QA verdict scores (or checklist pass-rate) over window W for completed `specialist.qa.completed` / QaAuditReport artifacts — **not** an invented 0–100 without evidence |
| Source | Specialist completion payloads + QA artifacts; baseline from QA Memory |
| Window | Default 7d / 30d toggle; per-project filter |
| Drill | Score → contributing runs → findings |

#### Average SEO Score

| | |
| --- | --- |
| Definition | Mean of sealed SEO audit scores / Lighthouse SEO category (declare which in UI) over W |
| Source | `specialist.seo.completed` + SEO Memory `lighthouse_history` |
| Drill | Same pattern as QA |

#### Average Security Score

| | |
| --- | --- |
| Definition | Composite of review verdicts + open Critical/High finding burden inverted into a 0–100 posture index (formula versioned; never a vanity number) |
| Source | `specialist.security.completed`, Security Watchdog open findings, accepted-risk count |
| Notes | Critical open findings **cap** the score (cannot look "green" with Critical open) |
| Drill | Open findings + recent reviews |

#### Average Performance

| | |
| --- | --- |
| Definition | Mean of perf budget attainment / Lighthouse perf (or CWV pass-rate) over W — label which metric is active |
| Source | Perf Watchdog samples + engineering/perf completion artifacts |
| Drill | Budget breaches timeline |

#### System Health

| | |
| --- | --- |
| Definition | Rollup: Runtime service SLOs (from Observability) ∧ Fabric DLQ depth ∧ Orchestration stuck rate ∧ CoS open Critical blockers ∧ Watchdog Critical findings |
| States | `green` \| `amber` \| `red` with contributing factors listed |
| Source | Observability health API + LiveOps + DLQ counts — **aggregated, not duplicated Grafana** |
| Drill | Factor → owning surface (obs / ops / DLQ) |

#### Cost Per Workflow

| | |
| --- | --- |
| Definition | Mean attributed cost (model + tools + extension egress) per completed EXEC (or per Work Package — UI toggle) over W |
| Source | Resource & Economy cost ledger (`economy.*` attribution) |
| Drill | EXEC cost breakdown by specialist/run |

#### Average Completion Time

| | |
| --- | --- |
| Definition | Mean wall-clock from EXEC start → `orch.instance.completed` (and P50/P90), excluding Abandoned |
| Source | Event History timestamps / Orchestration Run Records; CoS ETA accuracy shown adjacent |
| Drill | Distribution histogram; outliers → instance detail |

---

## 4. Aggregation plane

### 4.1 Control Center Read Model

A derived store (rebuildable from Event History + ledgers + LiveOps snapshots):

```
ControlCenterSnapshot
  asOf: timestamp
  systemHealth: { state, factors[] }
  running: WorkflowCard[]
  queued: QueueCard[]
  specialists: SpecialistCard[]
  memory: MemoryUsageCard
  quality: { qa, seo, security, performance, window }
  economy: { costPerWorkflow, avgCompletionMs, p50, p90, window }
  stream: { recentEvents[], recentFailures[], recentRetries[] }
```

- **SoR remains upstream.** Snapshot loss ⇒ rebuild.
- **Windows** for averages are explicit query params (`7d`, `30d`, `projectId`).
- **Tenant isolation** via Trust — same scope guards as Memory Access.

### 4.2 API surface (Control API extension)

Indicative routes (evolve existing `/v1/dashboard`; do not fork a second API app):

| Route | Purpose |
| --- | --- |
| `GET /v1/control-center` | Full snapshot (home) |
| `GET /v1/control-center/stream` | SSE/WS of incremental tile patches |
| `GET /v1/exec/:id` | EXEC detail + workflow graph + event tree |
| `GET /v1/events` | Event History query (filters) |
| `GET /v1/dlq` / `POST /v1/dlq/:id/replay` | DLQ inspect/replay (authz) |
| Existing | `/v1/gates/*`, `/v1/work-packages`, `/v1/audit/recent` |

`GET /v1/dashboard` remains as a **compat slim summary** or aliases into the
pulse strip of Control Center.

### 4.3 Refresh model

| Class | Mechanism |
| --- | --- |
| Live motion (running/queued/events/failures/retries/graph) | Subscribe to Fabric events → patch snapshot → push to UI stream |
| Quality / economy averages | Materialized periodically (1–5 min) + on completion events |
| Memory usage | On writeback + slow poll |
| System Health | Combine obs health endpoint + LiveOps Critical factors on each pulse |

UI never computes scores client-side from raw events when a server definition
exists — one formula version, one number.

---

## 5. Interaction & authority

| Action from UI | Allowed? | Path |
| --- | --- | --- |
| View all tiles / drill to evidence | Yes (role-scoped) | Read APIs |
| Resolve gate | Yes | Existing Control Plane resolve |
| Replay DLQ | Yes, Trust-gated | Fabric replay |
| Cancel duplicate / rebalance | No direct from UI by default | Surfaces CoS Ops recommendation; human confirms → audited command |
| Edit priority formula / quotas | No | Governance / Resource ownership |
| Approve irreversible without gate | Never | Constitution |

Notifications inbox (Watchdog / ops escalations) docks into the same shell.

---

## 6. Audience & views

| Audience | Default emphasis |
| --- | --- |
| Human principal / CEO | System Health, quality averages, cost, completion time, Critical escalations |
| Project Manager | Running/queued, ETAs, blockers, completion time |
| Chief of Staff (org) | Recurring failures, gate-skip signals, digest health |
| CoS Operations | LiveOps fidelity, specialist degradation, duplicates |
| Department leads | Their specialist cards + domain score + open findings |
| Platform operator | System Health factors, DLQ, retries (deep link to Grafana for service SLOs) |

Same Control Center; **saved filters / role defaults**, not separate products.

---

## 7. Score formula governance

Quality tiles are **versioned definitions** in contracts (not UI folklore):

- Each average declares: artifact fields used, inclusion/exclusion (partial
  verdicts, abandoned runs), window, and formula semver.
- Security score must document the Critical-cap rule.
- Changing a formula is a minor/major contract change with a migration note —
  historical charts annotate formula version boundaries.

---

## 8. Failure modes

| Failure | Response |
| --- | --- |
| Stale snapshot presented as live | Every payload carries `asOf`; UI shows staleness; stream reconnect required |
| Green security with Critical open | Forbidden by score definition + health factor |
| Client-side metric invention | Rejected — server formulas only |
| Control Center as shadow orchestrator | Actions limited to §5; architecture review blocker if violated |
| Conflating platform Grafana with Control Center | Health tile links out; does not embed full obs product |
| PII/secrets in event tail | Redaction via Trust before projection |

---

## 9. Metrics (of the Control Center itself)

| Metric | Intent |
| --- | --- |
| Snapshot freshness lag p95 | Seconds, not minutes, for live tiles |
| Stream disconnect rate | UX reliability |
| Drill-through success (tile → evidence) | Every number must be accountable |
| Formula/version mismatch incidents | 0 |
| Unauthorized action attempts | Audited denials |

---

## 10. Non-goals

- Not Analytics product dashboards or marketing KPI walls.
- Not a replacement for Grafana Runtime Observability.
- Not implementation of CoS Ops judgment (display + confirm only).
- Not a second Event History SoR.
- No implementation, schema files, or UI redesign from this document alone.

---

## 11. Relationship to existing thin dashboard

Today `apps/web` shows pending gates / awaiting review / resolved today. That
becomes the **pulse strip + work list seed** of Zone A/B. Event Bus Phase 6's
event-tree, DLQ, and routing views become Control Center secondary routes.
CoS Operations LiveOpsModel and Watchdog notification inbox plug into Zones
B/C/E without new SoRs.

---

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-25
owner: Runtime (Control API + apps/web), CoS Operations (LiveOps feed), Departments (score evidence)
related:
  - Runtime/Domains/Control_Plane_Runtime.md
  - Runtime/Domains/Runtime_Observability.md
  - Runtime/EventBus/EVENT_ARCHITECTURE.md
  - Executive/Chief_of_Staff/CHIEF_OF_STAFF_OPERATIONS_SPECIALIST.md
  - Runtime/Watchdogs/WATCHDOG_ARCHITECTURE.md
  - Intelligence/MEMORY_ARCHITECTURE.md
  - Runtime/Domains/Resource_Economy_Runtime.md
```
