# Runtime Domain: Agent Runtime

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Invocation substrate for Agents specified by `Core/AGENT_SPECIFICATION.md` — does not design Agents.

## Purpose
Invoke, isolate, time-bound, and supervise Agent runs against mandates, tools, models, and context — so specialization remains enforceable at runtime.

## Owns
Agent run sandboxes; mandate binding checks (spec hash/version); tool/skill invocation through Registry+Trust; model calls via Model Routing; output capture to Artifact Runtime; run time limits; violation stops.

## Explicitly Does Not Own
Agent specification content (`Core/`); Department structure; Business/Executive judgment; prompt packs as architecture; multi-agent “society” policy beyond Orchestration graphs.

## Inputs
Dispatch from Orchestration as a **Work Package** (`Execution/WORK_MANAGEMENT_FRAMEWORK.md`) — never a bare Task; Agent spec version; Context handle; Trust principal; Resource envelope; allowed tool set.

## Outputs
Agent run results; artifact productions; violation events; completion/failure to Orchestration.

## Runtime Artifacts
Agent Run Record, Mandate Binding Attestation, Tool Call Record (agent-scoped).

## Runtime Events
`agent.run.started|completed|failed|killed`, `agent.mandate.violated`, `agent.tool.called`, `agent.output.sealed`.

## Interfaces
Orchestration; Trust; Registry Fabric; Model Routing; Context; Memory Access; Artifact; Extension; Control Plane; Session (when interactive); Audit; Observability.

## Dependencies
All of the above — Agent Runtime is a high-level consumer, not a second kernel.

## Failure Modes
Agents with unbound mandates; direct network egress bypassing Extension; unbounded tool loops; silent mandate expansion.

## Metrics
Mandate violation rate; kill rate; avg tools/run; success rate by Department; cost/run.

## Anti-Patterns
Monolith “do everything” Agent runs; Agent Runtime rewriting Org Chart; storing organizational memory only in Agent local state.

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
