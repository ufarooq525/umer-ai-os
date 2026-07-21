# Runtime Domain: Orchestration Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Task Orchestrator, Workflow Scheduler, and plan *materialization* (not planning judgment).

## Purpose
Mechanically schedule and advance Execution workflow instances, task graphs, and parallel tracks in accordance with `Execution/WORKFLOW_ENGINE.md` and `Execution/PARALLEL_EXECUTION.md`.

## Owns
Run/instance state machines; stage scheduling; task graph execution; parallelism/joins; binding stages to Departments/Agent slots; plan materialization from Executive delegation artifacts; emitting wait points to Control Plane.

## Explicitly Does Not Own
Request classification/scoping meaning (`Execution/REQUEST_LIFECYCLE`); CEO planning judgment (`Executive/`); Department internal methods; priority *scoring formula ownership* (`Execution/PRIORITY_FRAMEWORK` — Orchestration consumes scores).

## Inputs
Scoped/routed Execution instances; priority scores; Department availability signals; Control Plane gate results; Resilience checkpoints/retries; Resource quotas.

## Outputs
Stage dispatch commands; instance state transitions; completion/abandon signals; orchestration events.

## Runtime Artifacts
Run Record (EXEC binding), Stage Dispatch, Task Graph Snapshot, Parallel Join Record.

## Runtime Events
`orch.instance.created|advanced|blocked|completed|abandoned`, `orch.stage.dispatched|completed`, `orch.parallel.forked|joined`.

## Interfaces
Execution (semantics); Agent Runtime; Control Plane; Context; Artifact; Resilience; Message Fabric; Resource & Economy; Departments (via Agent/handoff mechanics).

## Dependencies
Kernel, Trust, Control Plane, Message Fabric, Context, Artifact, Resilience, Registry Fabric, Resource & Economy.

## Failure Modes
Skipping gates; scheduling without Execution instance; orphan tasks; priority inversion vs Resource envelopes; private orchestrators per Department.

## Metrics
Stage SLA miss rate; gate-skip incidents (0); orphan task count; join latency; instance stuck rate.

## Anti-Patterns
Orchestration inventing Business scope; bypassing Approval waits; dual workflow engines beside Execution semantics.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
