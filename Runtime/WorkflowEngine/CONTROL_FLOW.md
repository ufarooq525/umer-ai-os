# Control Flow

Part of `Runtime/WorkflowEngine/WORKFLOW_ARCHITECTURE.md`.

Defines how tokens move through the graph: sequential edges, conditional
routing, parallel branches, fan-out, fan-in, child workflows, and nesting.
Organizational parallel *policy* remains in `Execution/PARALLEL_EXECUTION.md`;
this document is the mechanical graph semantics.

## 1. Graph primitives

| Primitive | Symbol (conceptual) | Meaning |
| --- | --- | --- |
| Stage node | `[Stage]` | Full stage contract (`STAGE_MODEL.md`) |
| Directed edge | `A → B` | On A `Succeeded`, place token on B (subject to edge condition) |
| Decision | `<>` | Exactly one outbound edge chosen |
| Fork | `Y` | All outbound edges receive a token (AND-split) |
| Join | `△` | Wait until required inbound tokens arrive (AND/OR-join) |
| Fan-out | `⇉` | Dynamic N tokens from a collection (map) |
| Fan-in | `⇇` | Join N dynamic tokens (reduce) |
| Child spawn | `⊙` | Start child workflow instance; optional await |

The Graph Scheduler executes only these primitives. Ad hoc “just call the next
specialist” edges are forbidden — every transition is a declared edge + history
event.

## 2. Sequential flow

Default. Edge `development → qa` fires when Development activation is
`Succeeded` and the edge condition (if any) passes. One token in, one token out.

## 3. Conditional routing

Decision nodes and conditional edges implement Execution's named branch table
(`Execution/WORKFLOW_ENGINE.md` Conditional Branches) without improvisation.

```text
Scoped ─<>─[condition: needsResearch]──▶ Research ──▶ Architecture
         └─[else]──────────────────────▶ Architecture
```

| Rule | Detail |
| --- | --- |
| Conditions | Same portable predicate grammar as Event Bus filters + stage/artifact refs |
| Exhaustiveness | Template validation requires full coverage (`else` or explicit default) |
| Logging | `DecisionTaken { nodeId, chosenEdge, reason, inputs }` in history |
| No silent skip | Skipping Research requires a logged reason edge (Execution anti-pattern ban) |
| Mid-flight changes | Branch choice is sticky once taken unless rollback returns before the decision |

Failure-driven routing (QA fail → Development) uses **failure edges** /
`returnTo` from the failure handler, not the happy-path decision table.

## 4. Parallel branches

Static AND-split / AND-join — the mechanical form of
`Execution/PARALLEL_EXECUTION.md`.

```text
          ┌──▶ SEO research ──┐
Dev late ─┤                   ├──△ (sync)──▶ Deployment
          └──▶ Marketing ─────┘
```

| Rule | Detail |
| --- | --- |
| Fork declaration | Explicit fork node; dependency check **result** is an input artifact/flag from Planning — engine does not invent “safe to parallel” |
| Sync point | Join node, usually followed by or coinciding with an approval gate |
| Early finisher | Token waits at join; optional `freshnessRecheck` on waiting branch outputs before join completes |
| Capacity queue | If Resource Economy denies parallel slots, Scheduler serializes with history reason `capacity` (distinct from `dependency`) |
| Conflict | Join may enter `Blocked` + escalate signal; resolution is organizational, then `signal` resumes |

History: `ParallelForked`, `ParallelJoined` (aligns with existing
`orch.parallel.forked|joined` events).

## 5. Fan-out

Dynamic parallelism over a collection in workflow input / artifact payload.

```text
[Discover pages] ⇉ (page in pages[]) ──▶ [SEO audit page] ⇇ △ ──▶ [SEO rollup]
```

| Field | Description |
| --- | --- |
| `itemsPath` | Path to array in instance data |
| `maxConcurrency` | Cap (Resource Economy + template) |
| `itemStage` | Stage template applied per item |
| `itemWorkflow` | Optional: each item is a **child workflow** instead of an inline stage |
| `failurePolicy` | `failFast` \| `continueAll` \| `quorum:N` |

Each item gets a token with `itemKey` / index for idempotency. Fan-out without a
matching fan-in is a template validation error.

## 6. Fan-in

| Join type | Completes when |
| --- | --- |
| `all` | All expected tokens arrived `Succeeded` |
| `allSettled` | All arrived terminal (Succeeded/Failed/Abandoned); payload includes per-item outcomes |
| `quorum` | N successes |
| `first` | First success; cancel remaining (cooperative cancel activities) |

Fan-in produces a join artifact (results list) for downstream stages. Partial
failure handling is declared on the join (`onPartial`), not improvised.

**Event Bus note:** Cross-workflow “wait for QA ∧ Security ∧ SEO” that is part of
a known template SHOULD be a fan-in join stage. Ad-hoc aggregators remain for
events outside a single instance.

## 7. Child workflows

A parent stage of `kind: child` starts a separate Workflow Instance.

```text
Parent: Feature delivery
  Stage "Run security review track"
    └─ startChild(template: security-review, input: {…})
         await: signal child.completed | child.failed
```

| Field | Description |
| --- | --- |
| `childTemplateId` | Template to run |
| `childWorkflowId` | Deterministic id derivation (e.g. `{parentWorkflowId}/security`) for idempotent start |
| `propagation` | `correlationId` inherited; `parentEventId` / `rootEventId` linked on start event |
| `wait` | `await` (parent blocks) \| `detach` (fire-and-forget; parent continues) |
| `onChildFail` | Parent failure handler strategy |
| `cancellation` | Parent cancel ⇒ cancel child (default true for `await`) |

Child has **its own history**. Parent history stores `ChildWorkflowStarted` /
`ChildWorkflowCompleted` with child `runId` — never inlines child events
(Temporal parent/child separation).

Use children when: different SLA, different approvers, reusable sub-template, or
fan-out items that are themselves multi-stage.

## 8. Nested workflows

**Nested** = child whose lifetime and EXEC binding are scoped under the parent
(sub-pipeline), not a peer EXEC instance.

| Aspect | Child (general) | Nested (subtype) |
| --- | --- | --- |
| Template | Any registered template | Marked `nestable: true`; often a fragment of the canonical pipeline |
| EXEC binding | May create sub-EXEC or share parent EXEC | Shares parent `execInstanceId` by default |
| Context | Fresh package or inherited-by-ref | Inherits parent context by reference (`Context Runtime`) |
| Visibility | Appears as child run in UI | Rendered as expandable subgraph of parent |
| Rollback | Compensates itself; parent decides cascade | Parent rollback cascades to nested runs by default |

Nesting depth is capped (default 8) to prevent runaway recursion; exceeding cap
is Instantiator rejection + `orch.instance.rejected` style alert.

## 9. Cancellation and preemption

- **Cancel** walks active tokens: cancel activities (cooperative), cancel
  awaiting children, run `onCancel` compensate hooks if declared.
- **Preempt** (higher-priority EXEC / Resource reclaim): same as cancel with
  reason `preempted`; may re-queue a new run under same `workflowId`.
- Cancel is a history event; queries must show canceled stages explicitly.

## 10. Idempotent edge firing

Every edge fire is keyed by `(runId, edgeId, fromActivationId)`. Controller
reconciliation must not double-place tokens. Duplicate activity completions are
ignored if activation already terminal.

## 11. Example: feature delivery graph (illustrative)

```text
start
  → intake (pm)
  → <> needsEngineering?
        yes → engineering
                → fork
                    → qa ────────┐
                    → security ──┼─△ all → <> publicSurface?
                    → seo? ──────┘         yes → seo → join already done
                                           no  → (noop)
                → gate release
                → deploy
                → monitor
                → learn
        no  → (light path…)
  → end
```

SEO arm may be a conditional edge from the fork (omit token) rather than a
failed stage — omission is an edge choice with logged reason, not a silent skip.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
