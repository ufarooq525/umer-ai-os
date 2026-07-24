# Workflow Engine Architecture

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`.
Refines `Runtime/Domains/Orchestration_Runtime.md` into a durable, Temporal-like
stage engine. Consumes `Runtime/EventBus/` for triggers and side-effect commands.

> **Positioning.** `Execution/WORKFLOW_ENGINE.md` owns **pipeline semantics**
> (which organizational stages exist, what Research/QA/Learning mean, branch
> *policy*). This document set owns **pipeline mechanics** (durable instance
> state, stage contracts, graph execution, history, child workflows). The
> Runtime never invents business scope; it materializes Execution semantics as
> runnable graphs. There is **one** workflow engine — not a second orchestrator
> beside Orchestration Runtime.

## 1. Goal

Replace ad-hoc, request-driven progression (Control API synchronously plans →
runs audits → creates work packages) with **durable workflow instances**:

- A **Workflow Template** declares stages, edges, conditions, gates, and
  compensation (rollback) as data.
- A **Workflow Instance** is a durable execution of a template, identified by
  `workflowId` + `runId`, bound to one Execution instance (`EXEC-###`) and one
  Event Bus `correlationId`.
- Stage advancement is **event-sourced**: every transition is an append-only
  history event; the current graph state is a projection of that history
  (Temporal influence).
- Specialists and services are invoked only as **stage activities** (via Event
  Bus publish / `cmd.agent.dispatch`), never as in-process calls from the
  engine's decision loop.

## 2. Design influences

| System | What we take | What we deliberately do not take |
| --- | --- | --- |
| Temporal | Append-only workflow history as source of truth; deterministic *decision* replay; timers; child workflows; activity retries separate from workflow retries; signals for external input (gates) | Deterministic *code* replay of specialist bodies (agents are non-deterministic); Temporal SDK / worker model as a hard dependency |
| Kubernetes | Desired-state reconciliation for stuck instances; controllers that observe and advance | Controllers owning business policy |
| GitHub Actions | Declarative templates (`on` + jobs/stages as data); reusable workflow templates | Imperative shell steps as the unit of work |
| Existing Execution docs | Canonical stage names, gate policy, parallel rules, failure categories | Replacing those docs — Runtime *implements* them |

## 3. Framework independence

The engine is specified as **ports + contracts**. No broker, workflow SaaS, or
ORM is required by the architecture. Reference adapters use what the monorepo
already runs (Postgres, Message Fabric / NATS JetStream, Control Plane gates).

| Port | Responsibility | Reference adapter |
| --- | --- | --- |
| `WorkflowStorePort` | Persist instances, stage tokens, template versions | Postgres (`packages/db`) |
| `WorkflowHistoryPort` | Append-only history; query by workflow/run/stage | Postgres (separate from Event History) |
| `TimerPort` | Durable stage / gate / activity timers | Event Bus Schedule Store (`notBefore`) |
| `ActivityDispatcherPort` | Start / cancel stage activities (specialist WPs, service handlers) | Event Bus + Orchestration WP commands |
| `GatePort` | Request / await / resolve approval gates | Control Plane (`packages/control-plane`) |
| `SignalPort` | External signals into a waiting instance (human, webhook, child result) | Event Bus subscriptions + Control API |
| `TemplateRegistryPort` | Load / version workflow templates | Registry Fabric + `Workflows/` / contracts |

## 4. Component map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW ENGINE                                 │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐ │
│  │ Template     │──▶│ Instantiator │──▶│ Instance Controller        │ │
│  │ Registry     │   │ (bind EXEC,  │   │ (reconcile history → graph)│ │
│  └──────────────┘   │  correlation)│   └───────────┬────────────────┘ │
│                     └──────────────┘               │                    │
│         ┌──────────────────────────────────────────┼──────────────┐     │
│         ▼                      ▼                   ▼              ▼     │
│  ┌────────────┐        ┌────────────┐      ┌────────────┐  ┌─────────┐│
│  │ Stage      │        │ Graph      │      │ Timer      │  │ Gate    ││
│  │ Executor   │        │ Scheduler  │      │ Service    │  │ Binder  ││
│  │ (entry/exit│        │ (edges,    │      │            │  │         ││
│  │  timeout,  │        │  fan-out/  │      └────────────┘  └─────────┘│
│  │  retry,    │        │  fan-in,   │                                   │
│  │  rollback, │        │  child WF) │                                   │
│  │  failure)  │        └────────────┘                                   │
│  └─────┬──────┘                                                         │
│        │ activities                                                     │
│        ▼                                                                │
│  ┌────────────┐   ┌────────────────┐   ┌────────────────────────────┐ │
│  │ Activity   │──▶│ Workflow       │   │ Compensator                │ │
│  │ Dispatcher │   │ History Store  │   │ (rollback / saga steps)    │ │
│  └────────────┘   └────────────────┘   └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
         │ publish / subscribe                          │ gate.wait
         ▼                                              ▼
   Event Bus (Message Fabric)                    Control Plane + HITL
         │
         ▼
   Agent Worker / specialists / bridges
```

### 4.1 Instantiator

Creates a Workflow Instance from a Template + trigger:

- Assigns `workflowId` (stable logical id, often = `correlationId` or EXEC id)
  and `runId` (this attempt; retries / restarts mint a new run under the same
  workflow id when policy allows).
- Pins `templateId` + `templateVersion` (instances never drift mid-flight when
  templates change — Temporal workflow-versioning influence).
- Binds `execInstanceId`, `tenantId`, `projectId`, `correlationId`, `rootEventId`.
- Appends history: `WorkflowStarted`.

### 4.2 Instance Controller

The only component that advances instance state. Loop:

1. Load instance + project history.
2. Derive current **token set** (which stages / joins / waits are live).
3. For each token, evaluate whether it can advance (entry conditions, signals,
   activity completions, timer fires, gate results).
4. Append history events for every decision; never mutate state without history.
5. Emit side effects **only after** history append (activities, timers, gates,
   child starts) — at-least-once side effects; activities must be idempotent.

Reconciliation recovers from crashes: replay history → same decisions →
re-dispatch missing side effects if not marked completed in history.

### 4.3 Stage Executor

Owns the per-stage lifecycle defined in `STAGE_MODEL.md`: entry checks, activity
dispatch, exit checks, timeout, retry, failure handler, gate wait, rollback
hooks. One stage activation = one history subtree under a `StageEntered` event.

### 4.4 Graph Scheduler

Owns edges between stages: sequential, conditional, parallel fork, fan-out,
fan-in join, child-workflow spawn/await. Spec in `CONTROL_FLOW.md`. Does not
own stage internals.

### 4.5 Compensator

Runs declared rollback / compensation graphs when Failure Recovery or explicit
rollback is authorized. Mechanical effects only after Audit + (when required)
CEO/HITL approval per `Execution/FAILURE_RECOVERY.md`.

## 5. Core concepts

| Concept | Definition |
| --- | --- |
| **Template** | Versioned, declarative graph: stages, edges, defaults (timeouts, retry, gates). See `WORKFLOW_TEMPLATES.md`. |
| **Instance** | One durable run of a template. |
| **Stage** | A node with full contract (state, entry/exit, timeout, rollback, retry, failure, gates). |
| **Activity** | Unit of side-effecting work inside a stage (specialist WP, bridge call, service handler). Retried independently of workflow decisions. |
| **Token** | Runtime marker that a stage / join / wait is active (Petri-net style for fan-out/fan-in). |
| **Signal** | External fact injected into a waiting instance (gate resolved, child completed, human clarification). |
| **History** | Append-only log; sole source of truth for instance position. See `WORKFLOW_HISTORY.md`. |
| **Child workflow** | Separate instance started by a parent stage; linked by parent/child ids; joins via signal or await edge. |
| **Nested workflow** | Child whose template is a subgraph of the parent's domain (same EXEC or sub-EXEC); still a full instance with own history. |

## 6. Relationship to Event Bus

| Concern | Owner |
| --- | --- |
| Publish/subscribe, DLQ, event envelope, correlation tree | Event Bus |
| Which event starts / advances / fails a stage | Workflow Template bindings (`on` + filters) |
| Durable stage graph position | Workflow History |
| Specialist invocation | Event Bus delivery → WP; stage records `ActivityScheduled` / `ActivityCompleted` |
| Aggregator joins (QA ∧ Security ∧ SEO) | Prefer **fan-in stage** in the template over ad-hoc aggregator services; aggregator services remain valid for cross-workflow patterns |

Event Bus events that matter to the engine (non-exhaustive):

- Triggers: `work.feature.requested`, `work.bug.reported`, …
- Activity outcomes: `specialist.*.completed`, `agent.run.failed`, `workpackage.*`
- Quality / delivery: `quality.*`, `delivery.*`, `change.*`
- Control: `gate.passed`, `gate.failed`, `control.gate.*`
- Engine meta: `orch.instance.*`, `orch.stage.*`, `orch.parallel.*` (existing Orchestration domain events)

## 7. Relationship to Work Packages

Work Packages remain the **dispatch unit** to a specialist (`packages/orchestration`
state machine: `Draft → Queued → … → Accepted`). A stage may schedule one or many
WPs as activities. Workflow Instance state is **above** WP state:

```
Workflow Instance (graph)
  └─ Stage "QA"
       └─ Activity → Work Package → Agent Run → specialist.qa.completed
```

The engine never replaces WP lifecycle; it schedules and awaits it.

## 8. Public API (ports, not code)

| Operation | Semantics |
| --- | --- |
| `start(templateId, input, opts)` | Instantiate; append `WorkflowStarted`; return `{ workflowId, runId }`. |
| `signal(workflowId, name, payload)` | Inject signal; wake waiting tokens. |
| `query(workflowId, selector)` | Read projected state or history slice (non-mutating). |
| `cancel(workflowId, reason)` | Cooperative cancel; run cancel handlers / compensations per template. |
| `rollback(workflowId, toCheckpoint, authz)` | Authorized compensation to a history checkpoint. |
| `registerTemplate(template)` | Versioned publish to Template Registry. |

## 9. Ownership boundaries

| Concern | Owner |
| --- | --- |
| Stage *meaning*, branch *policy*, Learning/Monitoring requirements | Execution (`WORKFLOW_ENGINE.md`, `APPROVAL_GATES.md`, …) |
| Durable graph execution, history, timers, child WF | This Workflow Engine (Orchestration Runtime) |
| Gate policy evaluation / HITL UX | Control Plane + Session |
| Activity retry backoff primitives | Resilience (consumed by Stage Executor) |
| Event transport | Message Fabric / Event Bus |
| Specialist mandates | Registry + specialist specs |

## 10. Non-goals

- No second Temporal cluster or vendor lock-in as a requirement.
- No embedding specialist logic inside workflow decision code.
- No bypassing Approval Gates for schedule pressure (Fabric / Orchestration
  anti-pattern stands).
- No implementation in this document set (see `IMPLEMENTATION_PLAN.md`).

## Metadata

```yaml
version: 1.0.0
status: proposed
supersedes: none (refines Runtime/Domains/Orchestration_Runtime.md)
aligns_with:
  - Execution/WORKFLOW_ENGINE.md
  - Runtime/EventBus/EVENT_ARCHITECTURE.md
last_reviewed: 2026-07-25
```
