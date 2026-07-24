# Stage Model

Part of `Runtime/WorkflowEngine/WORKFLOW_ARCHITECTURE.md`.

A **stage** is the atomic schedulable node of a workflow graph. Organizational
stage names and exit-contract *meaning* come from Execution
(`Core/WORKFLOW_STANDARD.md`, `Execution/APPROVAL_GATES.md`). This document
defines the **mechanical contract** every stage must satisfy so the engine can
schedule, time out, retry, gate, fail, and roll back uniformly.

## 1. Stage identity

| Field | Description |
| --- | --- |
| `stageId` | Stable id within a template, e.g. `qa`, `development`, `seo`. |
| `displayName` | Human label (may match Execution stage names: `QA`, `Development`). |
| `kind` | `activity` (does work) \| `gate` (approval only) \| `join` (fan-in) \| `fork` (fan-out) \| `child` (spawns child WF) \| `decision` (conditional router) \| `compensate` (rollback step). |
| `ownerDepartment` | Optional Department / specialist binding hint for Registry resolution. |
| `templateStageVersion` | Version of this node within the pinned template. |

## 2. Stage state machine

Every stage activation (one token visiting the stage) follows:

```text
Pending → EvaluatingEntry → Ready → Running → EvaluatingExit
        ↘ Blocked (entry fail / wait signal)
Running → AwaitingGate → Running | Failed
Running → AwaitingSignal → Running
Running → TimedOut → FailureHandling
Running → Failed → FailureHandling
EvaluatingExit → Succeeded | Failed
FailureHandling → RetryScheduled | Compensating | Escalated | Abandoned
Compensating → Compensated | CompensationFailed
Succeeded | Compensated | Abandoned → (terminal for this activation)
RetryScheduled → Pending (new attempt; attempt counter ++)
```

| State | Meaning |
| --- | --- |
| `Pending` | Token arrived; not yet evaluated. |
| `EvaluatingEntry` | Entry conditions under evaluation. |
| `Blocked` | Entry not met; waiting on signal / upstream / human clarification. |
| `Ready` | Entry passed; activities may start. |
| `Running` | One or more activities in flight. |
| `AwaitingGate` | Approval gate requested; HITL / Control Plane owns the wait. |
| `AwaitingSignal` | Waiting on named signal (child done, webhook, join sibling). |
| `EvaluatingExit` | Exit conditions checked against artifacts / activity results. |
| `Succeeded` | Exit passed; outbound edges may fire. |
| `TimedOut` | Stage or activity deadline exceeded. |
| `Failed` | Activity or exit failure. |
| `FailureHandling` | Failure handler selecting retry / rollback / escalate. |
| `RetryScheduled` | Timer armed for next attempt. |
| `Compensating` / `Compensated` | Rollback path for this stage's effects. |
| `Escalated` / `Abandoned` | Organizational escalation or terminal abandon (Execution semantics). |

Instance-level state (`Admitted → StageActive → GateWait → Completed …` in
`RUNTIME_LIFECYCLES.md`) is the **projection** of all stage tokens.

## 3. Entry conditions

Declarative predicates evaluated before work starts. All must pass (AND), unless
the template marks an entry group as `anyOf`.

| Condition class | Examples | Failure behavior |
| --- | --- | --- |
| `upstream` | Prior stages in `Succeeded`; join satisfied | Stay `Blocked` until true |
| `artifact` | Required artifact ids present & sealed | `Blocked` or fail per policy |
| `context` | Context freshness OK; constraints unchanged | Trigger context refresh, then re-eval |
| `resource` | Quota / agent pool available | `Blocked` (resource); do not burn retries |
| `event` | Named Event Bus fact observed (filter) | `Blocked` until signal |
| `expr` | Payload/path predicates (same grammar as Event Bus filters — no scripts) | Fail entry if false when required |

Entry evaluation is logged as `StageEntryEvaluated` with per-clause results
(auditable; mirrors Execution's "no silent transition" rule).

## 4. Exit conditions

Checked after activities complete (and after gate Pass when the stage includes a
gate). Map 1:1 onto Execution exit contracts where the template binds them.

| Condition class | Examples |
| --- | --- |
| `activityVerdict` | All required activities `pass` (or allow `partial` if declared) |
| `artifact` | Named outputs sealed; schema valid |
| `handoff` | Receiver ack recorded (`Execution/DEPARTMENT_HANDOFFS.md` mechanics) |
| `gate` | Linked gate result = Pass (or accepted N/A) |
| `customChecklist` | References to Core quality checklist items |

Exit fail ⇒ stage `Failed` ⇒ failure handler (not silent skip).

## 5. Timeout

| Timer | Scope | Default (overridable per template) | On fire |
| --- | --- | --- | --- |
| `stageTimeout` | Wall time from `Ready` / `Running` | Per Execution SLA class; else 72h | `TimedOut` → failure handler |
| `activityTimeout` | Single activity attempt | Specialist-class default (e.g. 30m) | Activity fail `transient` or `term` per policy |
| `gateTimeout` | Wait in `AwaitingGate` | Control Plane policy | Escalate (HITL / Executive), not auto-Pass |
| `signalTimeout` | `AwaitingSignal` | Template-declared | Failure handler or alternate edge |

Timers are durable via `TimerPort` → Event Bus Schedule Store. Timer fire is a
history event (`TimerFired`); the controller never relies on in-process sleep.

## 6. Retry

Stage-level retry is **distinct** from activity-level retry and from Event Bus
delivery retry.

| Layer | What retries | Policy source |
| --- | --- | --- |
| Event Bus delivery | Transport to dispatcher / WP enqueue | `Runtime/EventBus/RETRY_POLICY.md` |
| Activity | Specialist run / bridge call | Stage `activityRetry` → Resilience |
| Stage activation | Whole stage attempt after exit/activity exhaustion | Stage `stageRetry` |

### 6.1 `activityRetry`

Named policy ref (`standard` | `aggressive` | `patient` | `none`) or inline:

- `maxAttempts`, backoff, jitter (Resilience primitives)
- `retryOn`: failure classes (`transient`, `resource`)
- `nonRetryable`: `permanent`, mandate violation, Security gate fail

### 6.2 `stageRetry`

- `maxAttempts` (default 2 — aligns with Approval Gates second-failure escalation)
- `backoff` before re-entering `Pending`
- `resetActivities`: whether to re-dispatch all activities or only failed ones
- On exhaustion ⇒ failure handler (`escalate` default for recurring gate failure)

## 7. Failure handler

Declarative strategy selected when a stage reaches `Failed` or `TimedOut`:

| Strategy | When | Effect |
| --- | --- | --- |
| `retry` | Retryable class & attempts remain | → `RetryScheduled` |
| `returnTo` | Gate reject / fix-forward | Move token to named prior stage (e.g. QA → Development); history `StageReturned` |
| `compensate` | Downstream defect / rollback authorized | Invoke stage or graph compensation |
| `alternateEdge` | Conditional recovery path declared | Fire named failure edge |
| `escalate` | Blocked / recurring / Security | Control Plane + Executive escalation; instance may `Escalated` |
| `abandon` | CEO/HITL authorized | Terminal abandon for instance or branch |
| `ignore` | Explicit observability-only stages | Mark Succeeded with warning (forbidden on gated quality stages) |

Failure handlers emit `StageFailureHandled` with chosen strategy and reason.
Security gate failures **never** use `ignore` or auto-Pass
(`Execution/APPROVAL_GATES.md`).

## 8. Approval gates

A stage may declare zero or more gates (usually one exit gate).

| Field | Description |
| --- | --- |
| `gateId` | Stable id; maps to Control Plane wait |
| `when` | `beforeActivity` \| `afterActivity` \| `onExit` (default) |
| `requiredApprovers` | Roles / principals (RACI from Governance — engine stores refs, does not invent policy) |
| `checklistRef` | Link to Core / Execution gate criteria |
| `onPass` | Continue |
| `onFail` | Failure handler strategy (typically `returnTo`) |
| `onTimeout` | Escalate only — never silent Pass |
| `securityCritical` | If true, second-failure and override paths are locked down |

Mechanics:

1. Append `GateWaitRequested`.
2. `GatePort.request` → Control Plane → HITL Session.
3. Instance token → `AwaitingGate`.
4. Signal `gate.passed` / `gate.failed` → `GateResolved` history → resume.

Gates are **signals**, not activities: humans are not retried like HTTP calls.

## 9. Rollback (compensation)

Each stage may declare how to undo its effects if a later rollback targets a
checkpoint before or at this stage.

| Field | Description |
| --- | --- |
| `compensate` | `none` \| `activity` \| `childWorkflow` \| `manual` |
| `compensateActivity` | Specialist / service that reverses effects (idempotent) |
| `compensateTimeout` | Bound for compensation run |
| `preserveArtifacts` | Artifact ids to keep (rollback discards reasoning, not always blobs — Execution rule) |
| `requiresAuthz` | e.g. `ceo` for discarding substantial work |

Compensation runs under the Compensator; order is reverse stage success order
(saga style) unless the template declares an explicit compensate graph.
Mechanical rollback without required authz is a Trust deny + Audit event.

## 10. Stage record (runtime)

Projected (not source of truth — history is):

```text
StageActivation {
  activationId, workflowId, runId, stageId,
  attempt, state,
  enteredAt, exitedAt?,
  entryResults[], exitResults[],
  activityIds[], gateIds[],
  timeoutAt?, failureStrategy?,
  parentActivationId?   // for nested/retry linkage
}
```

## 11. Minimal stage declaration (template fragment)

Illustrative shape only — not an implementation schema:

```yaml
stageId: qa
kind: activity
ownerDepartment: QA
entry:
  - type: upstream
    stages: [development]
    state: Succeeded
  - type: artifact
    ids: [build_package]
exit:
  - type: activityVerdict
    require: pass
  - type: gate
    gateId: gate-qa-exit
timeout:
  stageTimeout: 48h
  activityTimeout: 2h
  gateTimeout: 72h
activity:
  specialistId: qa.verify
  on: specialist.engineering.completed   # optional event binding
activityRetry: { policy: standard }
stageRetry: { maxAttempts: 2, onExhaustion: escalate }
gates:
  - gateId: gate-qa-exit
    when: onExit
    onFail: { strategy: returnTo, stageId: development }
failureHandler:
  TimedOut: escalate
  Failed: retry
rollback:
  compensate: activity
  compensateActivity: qa.verify.rollback
  requiresAuthz: none
```

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
