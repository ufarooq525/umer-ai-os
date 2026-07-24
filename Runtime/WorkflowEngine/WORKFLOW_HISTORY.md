# Workflow History

Part of `Runtime/WorkflowEngine/WORKFLOW_ARCHITECTURE.md`.

Workflow History is the **append-only source of truth** for a Workflow Instance
(Temporal influence). Event Bus Event History records transport facts; Workflow
History records **orchestration decisions and stage lifecycle**. Both may share
`correlationId`; they are different stores with different retention and
semantics.

## 1. Why history is the SoT

- Crash recovery: rebuild tokens by replaying history; re-dispatch only
  side effects not marked completed.
- Auditability: every stage transition has a reason (Execution requirement).
- Query: “why is this EXEC blocked?” → last `GateWaitRequested` / `Blocked` /
  `ParallelJoined` waiting set.
- Rollback targets: checkpoints are history event ids / marks, not mutable row
  snapshots alone.

Mutable projections (`WorkflowInstance` row, stage activation rows) are caches.
If projection and history disagree, history wins and projection is rebuilt.

## 2. Event envelope (history record)

| Field | Description |
| --- | --- |
| `historyId` | Monotonic per `(workflowId, runId)` sequence number |
| `eventType` | See catalog §3 |
| `recordedAt` | Bus/engine time |
| `workflowId` / `runId` | Instance identity |
| `stageId` / `activationId` | When stage-scoped |
| `correlationId` | Copied from instance |
| `causation` | Prior `historyId` or external `eventId` / `commandId` |
| `payload` | Typed per `eventType` |
| `decisionHash` | Optional hash of inputs used for deterministic decisions |

Records are immutable. Corrections are new compensating events, never edits.

## 3. History event catalog (core)

### Lifecycle

| eventType | Meaning |
| --- | --- |
| `WorkflowStarted` | Template pinned; input recorded |
| `WorkflowCompleted` | All terminal success conditions met |
| `WorkflowFailed` | Unrecoverable failure |
| `WorkflowCanceled` | Cooperative cancel finished |
| `WorkflowAbandoned` | Organizational abandon |
| `WorkflowSignaled` | External signal applied |

### Stage

| eventType | Meaning |
| --- | --- |
| `StageEntered` | Token activated stage |
| `StageEntryEvaluated` | Entry clause results |
| `StageBlocked` | Waiting; reason |
| `StageActivityScheduled` | Activity / WP dispatch requested |
| `StageActivityStarted` | Worker acked |
| `StageActivityCompleted` | Result / verdict |
| `StageActivityFailed` | Classified failure |
| `StageExitEvaluated` | Exit clause results |
| `StageSucceeded` / `StageFailed` / `StageTimedOut` | Activation terminal |
| `StageFailureHandled` | Strategy chosen |
| `StageRetryScheduled` | Timer for next attempt |
| `StageReturned` | `returnTo` prior stage |
| `StageCompensating` / `StageCompensated` | Rollback |

### Gates & timers

| eventType | Meaning |
| --- | --- |
| `GateWaitRequested` | Control Plane wait opened |
| `GateResolved` | Pass / Fail / Escalated |
| `TimerStarted` / `TimerFired` / `TimerCanceled` | Durable timers |

### Graph

| eventType | Meaning |
| --- | --- |
| `DecisionTaken` | Conditional route chosen + reason |
| `ParallelForked` / `ParallelJoined` | Static parallel |
| `FanOutStarted` / `FanInCompleted` | Dynamic map/reduce |
| `EdgeFired` | Token moved along edge |

### Child / nest

| eventType | Meaning |
| --- | --- |
| `ChildWorkflowStarted` | Child id / run id |
| `ChildWorkflowCompleted` / `ChildWorkflowFailed` / `ChildWorkflowCanceled` | Terminal child |
| `NestCascadeCancel` | Parent cancel propagated |

### Markers

| eventType | Meaning |
| --- | --- |
| `CheckpointMarked` | Named rollback / resume point |
| `TemplateSideEffectMarker` | Idempotency key for outbound command already sent |

Align exported Event Bus names with Orchestration domain events
(`orch.instance.*`, `orch.stage.*`, `orch.parallel.*`) via a thin publisher —
history write first, bus notify second.

## 4. Deterministic decision replay

Temporal replays workflow **code**. Umer AI OS replays workflow **decisions**
against recorded inputs:

1. Controller rebuilds projected state from history 1..N.
2. For any decision point, if a `DecisionTaken` / `StageFailureHandled` already
   exists, that result is reused (no re-coin-flip).
3. New decisions only occur at the history frontier when new signals / activity
   completions arrive.
4. Side effects (dispatch WP, request gate) execute only if no matching
   `StageActivityScheduled` / `GateWaitRequested` with the same idempotency key
   exists; otherwise skip (already done).

Specialist internals are **not** replayed. Activity results are whatever was
recorded in `StageActivityCompleted`.

## 5. Checkpoints and rollback targets

- Auto checkpoints: after each `StageSucceeded`, after `ParallelJoined`, after
  successful gate Pass.
- Explicit `CheckpointMarked { name }` for templates that need named restore
  points (e.g. `pre-deploy`).
- `rollback(toCheckpoint)` appends `RollbackInitiated`, then compensation events;
  does not delete history (Temporal-style: history continues forward with
  compensate events).

## 6. Query API (read models)

| Query | Returns |
| --- | --- |
| `getStatus(workflowId)` | Projected instance + active tokens |
| `getHistory(workflowId, opts)` | Raw or filtered history |
| `getStageTree(workflowId)` | Stages with attempts, gates, children |
| `getBlockedReason(workflowId)` | Last blocking events summary |
| `listByCorrelation(correlationId)` | All runs sharing the bus correlation |
| `listByExec(execInstanceId)` | Runs bound to EXEC |

Web UI Event-tree / EXEC views should prefer these queries over scraping Event
Bus alone.

## 7. Retention

| Tier | Duration (default) | Content |
| --- | --- | --- |
| Hot | 90 days | Full history + projection |
| Warm | 18 months | Full history compressed; projection rebuildable |
| Cold | Per Governance | Archive; security-relevant mirrored in Audit forever |

Workflow History ≠ Audit chain. Consequential decisions still emit Audit appends
as today.

## 8. Dual-store clarity

| Store | Question it answers |
| --- | --- |
| Event Bus Event History | What facts were published/delivered on the fabric? |
| Workflow History | What did the orchestrator decide and which stage tokens moved? |
| Audit | What security-relevant actions occurred (tamper-evident)? |

A specialist completion appears in all three at different layers: bus event →
workflow `StageActivityCompleted` → optional audit if mandated.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
