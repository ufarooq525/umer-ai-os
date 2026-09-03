# LLM Agent Execution (Model Routing + Tool Calling)

> Extends `MONOREPO_BLUEPRINT.md`. Does not redesign Architecture V1 or introduce a
> parallel agent system — this documents how `apps/agent-worker` now drives real
> LLM execution through the existing Work Package → Agent Worker → Agent Runtime
> path.

## 1. What changed

`AgentRuntime` no longer always calls the deterministic `runEngineeringApplicationDelivery`
handler. It now branches per Specialist:

```text
AgentRuntime.runSpecialist(workPackage, mandate)
  ├─ eng.app-delivery  → runEngineeringApplicationDelivery   (deterministic, unchanged)
  └─ every other spec  → runLlmAgent                          (Model Routing agent loop)
```

`eng.app-delivery`'s own mandate (`specialists/engineering/application-delivery.md`,
Constraints + E5) forbids invented code — it stays on the structured-change-set
handler. Every other registered Specialist runs the generic LLM agent loop, gated
by its own mandate's tool allowlist and Trust checks exactly as before.

## 2. Model Routing (`@umer/model-routing`)

```ts
interface LLMProvider {
  readonly providerId: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
```

`ChatRequest` carries `messages`, `tools`, `toolChoice`, `temperature`, `maxTokens`,
and an `AbortSignal`. `ChatResponse` normalizes `finishReason` and `message.toolCalls`
(`{ id, name, argumentsJson }`) regardless of provider wire format.

`OpenAICompatibleProvider` implements this against any OpenAI-wire-compatible
`/chat/completions` endpoint — LM Studio out of the box. `createLLMProviderFromEnv()`
picks the provider from typed config (`@umer/config`); no vendor id ever appears in
a Specialist spec (MONOREPO_BLUEPRINT.md §0.5).

### Configuration

```env
LLM_PROVIDER=lmstudio          # or: openai-compatible
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen/qwen3-8b
# LLM_API_KEY=                 # unset for local LM Studio
LLM_REQUEST_TIMEOUT_MS=60000
LLM_MAX_TOKENS=2048
LLM_TEMPERATURE=0.2
AGENT_LOOP_MAX_ITERATIONS=8
AGENT_LOOP_TIMEOUT_MS=300000
```

Validated at boot by `@umer/config`'s Zod schema — fails closed on an invalid value.

### Adding another OpenAI-compatible provider

1. Add the base URL / model to `.env` (or a new `LLM_PROVIDER` enum value in
   `packages/config/src/index.ts` if it needs distinct handling).
2. If it's wire-compatible with `/chat/completions`, no new code is needed —
   `OpenAICompatibleProvider` already works against it.
3. For a genuinely different wire protocol, implement `LLMProvider` in
   `packages/model-routing/src/providers/`, and branch on it in
   `createLLMProviderFromEnv` (`packages/model-routing/src/factory.ts`).
   `AgentRuntime` never changes — it only depends on the `LLMProvider` interface.

## 3. The agent loop (`packages/agent-runtime/src/handlers/llm-agent.ts`)

```text
build system+user messages from the Specialist mandate + Work Package
loop (bounded by maxIterations, whole run bounded by runTimeoutMs):
  provider.chat(messages, tools)        → agent.llm.requested / .completed / .failed
  no tool_calls?                        → final answer, break
  tool_calls present?
    for each call:
      Tool Router.execute(call, allowlist)  → agent.tool.requested/.started/.completed|.failed
      append {role:"tool", ...} result to messages
  (loop back to provider.chat with the updated conversation)
final answer → typed Artifact (ResearchFinding/Brief) → SpecialistRunResult
```

Safeguards, all enforced in `runLlmAgent`:

| Concern | Mechanism |
|---|---|
| Max iterations | `AGENT_LOOP_MAX_ITERATIONS` / mandate E22 `max_tools_per_run`, default 8 — throws `AgentRuntimeError('MAX_ITERATIONS_EXCEEDED')` |
| Run timeout | `AGENT_LOOP_TIMEOUT_MS` / mandate E11, default 300s — `@umer/resilience`'s `withTimeout` — throws `RUN_TIMEOUT` |
| Cancellation | An `AbortSignal` threads from `AgentRuntime.execute(..., signal)` through every `provider.chat` and tool call — `RUN_CANCELLED` |
| Malformed tool call | Router catches `JSON.parse` failure → `status: 'failed'`, reported back to the model as a tool error, loop continues |
| Unknown tool | Router returns `status: 'unknown_tool'` without ever calling a handler |
| Provider failure | Network/HTTP errors retried inside `OpenAICompatibleProvider` (via `@umer/resilience`'s `withRetry`); still-failing calls raise `LLM_PROVIDER_ERROR` and end the run |
| Tool failure | Handler throw → `status: 'failed'`, reported back to the model as a tool error (does not crash the run) |
| No provider configured | Any non-deterministic specialist with no `llm` wiring fails closed with `LLM_NOT_CONFIGURED` |

## 4. Tool calling (`@umer/extension`)

```text
ToolRegistry   — what tools exist (name, description, JSON-schema parameters, handler)
ToolRouter     — the only path from a tool_call to execution
```

`ToolRegistry.listForAllowlist(allowlist)` is what the model is shown — a tool the
model was never told about can't be requested. `ToolRouter.execute` re-verifies
independently before running the handler:

```text
requested tool
  → registered in ToolRegistry?          no  → status: 'unknown_tool'
  → present in the effective allowlist?  no  → status: 'denied'
  → JSON.parse(arguments) succeeds?      no  → status: 'failed' (malformed)
  → handler resolves within timeout      no  → status: 'failed'
  → yes                                      → status: 'completed', output returned
```

Fail-closed by construction — nothing above ever executes a handler on a
permission or registration failure.

### Tool permission enforcement

The **effective allowlist** passed to both `listForAllowlist` and `execute` is:

```ts
workPackage.toolAllowlist.length === 0
  ? mandate.contract.toolAllowlist               // dispatcher didn't narrow further
  : workPackage.toolAllowlist.filter(name => mandate.contract.toolAllowlist.includes(name));
```

A Work Package can only **narrow** what its Specialist mandate already allows,
never expand it. This mirrors the Specialist Standard's tool allowlist contract
(`E7 — Tool Permission Set`) — see `specialists/growth/opportunity-research.md`.

### `search_web`

`packages/extension/src/tools/search-web.ts` — a narrow, scoped adapter (not
general HTTP access). It always calls one fixed public, keyless endpoint
(DuckDuckGo's Instant Answer API) with the model-supplied query string; the model
never chooses a URL. No shell execution, no filesystem access, no arbitrary
network egress is ever exposed to a model.

### Full Extension Runtime egress note (limitation)

`apps/extension-worker` remains a skeleton (`cmd.extension` command consumer not
yet wired). For this milestone, `apps/agent-worker` imports `@umer/extension`'s
`ToolRegistry`/`ToolRouter` in-process rather than round-tripping tool calls over
the Message Fabric to a separate sandboxed `extension-worker` process. The
dependency direction the blueprint calls for (`Agent Runtime → Tool/Extension
interface`) is honored; the process-isolation half of Extension Runtime is not.
Tools stay narrow (fixed endpoints, no shell/filesystem) as a compensating
control. Moving execution out-of-process is future work, not a redesign.

## 5. Observability events

`packages/contracts/src/events/index.ts`'s `RuntimeEventNameSchema` gained:

```text
agent.llm.requested   agent.llm.completed   agent.llm.failed
agent.tool.requested  agent.tool.started    agent.tool.completed   agent.tool.failed
agent.decision
```

alongside the existing `agent.run.started|completed|failed`. All are published
through the existing Message Fabric event plane (`evt.runtime.*`) — no second
event system. `AgentRuntime` accepts an `AgentEventPublisher`
(`packages/agent-runtime/src/events.ts`); `createMessageFabricAgentEventPublisher`
wraps `MessageFabricClient.publishEvent`, matching the existing
Trust/Artifact/Audit "noop-by-default, fabric-backed-in-production" publisher
pattern already used elsewhere in this codebase.

Every payload carries `workPackageId`, `execId`, `specialistId`, and, for tool
events, `toolCallId` — the correlation fields a CEO-facing read model needs to
answer "what is this agent doing right now" (`correlationId` is the envelope's
own field, propagated from the dispatch command).

### `agent.decision` — operational reason, not chain-of-thought

Only the model's `message.content` field is ever read from a provider response —
`OpenAICompatibleProvider` never surfaces a separate reasoning/thinking field.
`agent.decision` payloads are built from structural facts (which tool, which
Work Package, why the loop is calling it) — e.g. `{ action: 'tool_call', tool:
'search_web', reason: 'Specialist requested tool "search_web" to continue Work
Package wp-1' }` — never from raw model reasoning text.

## 6. Artifact mapping

`runLlmAgent`'s final answer becomes a real `ArtifactContract` (not ad-hoc JSON):

- `artifactType`: `'ResearchFinding'` when the mandate's `mandateDomain` is
  `'Business'`, else `'Brief'` (both existing `ArtifactTypeSchema` members).
- `acceptanceCriteriaMet`: one entry per Work Package `taskId`, same shape the
  deterministic engineering handler already produces.
- `metadata.annotations.toolCallsSummary`: a JSON array of `{tool, input, status,
  durationMs}` — the operational tool-call record a dashboard can render.
- `contentHash`: the Specialist's `specHash` (same convention the deterministic
  handler already uses — no bytes are actually persisted out-of-process yet in
  either handler).

## 7. Local setup

1. Start LM Studio, load `qwen/qwen3-8b`, start its local server
   (`http://localhost:1234`).
2. `pnpm install`
3. `pnpm --filter @umer/contracts run build` (other packages import its `dist`)
4. `pnpm dev:infra` (Postgres/Redis/NATS/MinIO/OTel via Docker Compose)
5. `pnpm --filter @umer/app-agent-worker run dev`

The worker logs the specialists it registered
(`eng.app-delivery`, `growth.opportunity-research`) and the configured
`llmProvider`/`llmModel` on boot.

## 8. Manual integration test — proving a real tool call happened

Dispatch a `workpackage.dispatch` command (`cmd.agent.dispatch`) whose payload's
`workPackage.specialistId` is `growth.opportunity-research` and whose
`workPackage.metadata.annotations.instruction` is:

```text
Find profitable SaaS opportunities in the healthcare industry. Use the search_web tool.
```

Expected event sequence on `evt.runtime.*`:

```text
agent.run.started
agent.llm.requested → agent.llm.completed (finishReason: "tool_calls")
agent.tool.requested → agent.tool.started → agent.tool.completed (tool: "search_web")
agent.llm.requested → agent.llm.completed (finishReason: "stop")
agent.run.completed
```

`agent.tool.completed`'s presence with `tool: "search_web"` is the proof
requirement: a text response merely describing what it *would* search does not
produce this event — only an actual OpenAI-compatible `tool_calls` payload,
parsed and executed by the Tool Router, does.

## 8b. CEO read-model (Agent Run projection)

**Gap found during verification:** publishing to `evt.runtime.*` is not itself a
queryable read model. Nothing in this codebase previously subscribed to those
events into state a dashboard could query. (The existing "CEO worker supervisor
panel" — `apps/web/src/lib/ai-worker-supervisor.ts` — is a separate, MySQL-backed
heartbeat/task-lease system for the Opportunity Intelligence / Revenue OS product;
it does not consume Work Package / Agent Runtime events at all.) Postgres
(`DATABASE_URL`, the Architecture V1 system of record) currently has no schema —
Trust/Artifacts/Audit/Memory-Access all default to in-memory stores in this
codebase today, so adding Postgres persistence here would be a bigger step than
this fix, not a smaller one.

**Fix — smallest change consistent with existing patterns, now fully wired:**

- `packages/observability/src/agent-run-read-model.ts` — the pure reducer,
  `projectRuntimeEvent(existing, event) -> AgentRunSnapshot | undefined`
  (unchanged as the single source of truth for projection), plus
  `AgentRunReadModelStore` / `InMemoryAgentRunReadModelStore`. The store's
  `project(event)` is the one required, atomic entry point — same
  interface-plus-InMemory-default shape already used by `@umer/trust`
  (`GrantStore`), `@umer/artifacts` (`ArtifactStore`) and `@umer/audit`
  (`AuditStore`) — no new pattern, no database.
- `packages/agent-runtime/src/read-model.ts` — `subscribeAgentRunReadModel(fabric,
  store)` wires the projector to the real Message Fabric via the existing
  `subscribeEvents` API, filtering `evt.runtime.agent.>`, deduping redelivered
  events by `eventId` via `@umer/message-fabric`'s existing `IdempotencyStore`.
- `apps/control-api/src/agent-run-subscription.ts` — `startAgentRunReadModelSubscription(state)`,
  called once from `main.ts` boot (never from `createControlApiState()`, which
  the existing test suite calls directly with no NATS available). Connects via
  `createMessageFabric()` and wires the subscriber; if the broker is
  unreachable it logs a warning and control-api still starts normally —
  `/v1/agent-runs` just stays empty until the broker recovers, the same
  fail-open shape `resolveCodeProducer()` already uses in this file.
- `apps/control-api/src/server.ts` — `GET /v1/agent-runs` (optionally
  `?status=running|completed|failed`) and `GET /v1/agent-runs/:workPackageId`,
  reading straight from `state.agentRunReadModel`.

`AgentRunSnapshot` carries every field the CEO checklist asked for:
`specialistId` (agent/specialist), `workPackageId` (+ `execId` as the closest
available "project" correlation — see limitation below), `currentAction`
(`waiting_on_model` / `executing_tool` / `idle`), `currentTool` +
`currentToolInput`, `status`, `actionLog` (previous actions, one structural line
per transition), `toolCalls` (full history with status/duration/error),
`failures`, `artifactId` + `summary` (output), and `decisions` (why the last
tool was called — operational reason, never raw model text). There is
deliberately no "next action" field — the loop is reactive, not planned ahead,
so the honest answer is "nothing recorded yet" while `status: 'running'`.

**Concurrency and idempotency:** `InMemoryAgentRunReadModelStore.project()`
reads and writes its Map with no `await` in between, so JS run-to-completion
semantics make each projection atomic — concurrent callers can never interleave
mid-update, and two different Work Packages' snapshots (keyed independently by
`workPackageId`) can never clobber each other. JetStream's at-least-once
delivery can redeliver the same event after a crash between processing and
ack; since `EventEnvelope` (unlike `CommandEnvelope`) has no caller-supplied
`idempotencyKey`, the subscriber dedupes by the envelope's own unique `eventId`
using the exact `IdempotencyStore` abstraction `@umer/message-fabric` already
uses for command dedup.

**Remaining limitation:** `apps/control-api`'s read model is in-process,
in-memory, and single-instance — it reflects events since that process last
started, and does not survive a restart or generalize to multiple control-api
replicas without a shared store. Postgres (the Architecture V1 SoR) still has
no schema anywhere in this codebase — every other domain (Trust/Artifacts/Audit)
also defaults to in-memory today, so this is consistent with, not behind, the
rest of the system. When durable/cross-instance state is needed, the same
`AgentRunReadModelStore` interface can grow a Postgres-backed implementation
without changing the reducer, the subscriber, or the HTTP routes.

## 9. Automated tests

| Area | File |
|---|---|
| OpenAI-compatible provider (request shape, tool_calls parsing, retries, errors) | `packages/model-routing/src/providers/openai-compatible.test.ts` |
| Tool registry (allowlist projection, duplicates) | `packages/extension/src/registry.test.ts` |
| Tool router (execute, denied, unknown, malformed, failure, timeout) | `packages/extension/src/router.test.ts` |
| `search_web` adapter | `packages/extension/src/tools/search-web.test.ts` |
| Agent loop (tool call → result → final answer, multi-iteration, permission denial, unknown tool, tool failure, max iterations, provider failure, run timeout, observability events) | `packages/agent-runtime/src/handlers/llm-agent.test.ts` |
| Full `AgentRuntime.execute` path (`LLM_NOT_CONFIGURED` fail-closed, end-to-end mandate → provider → tool → artifact) | `packages/agent-runtime/src/runtime.llm.test.ts` |
| Existing deterministic `eng.app-delivery` path | `packages/agent-runtime/src/runtime.test.ts` (unmodified, still green) |
| `@umer/resilience` retry/timeout primitives | `packages/resilience/src/retry.test.ts`, `packages/resilience/src/timeout.test.ts` |

Run everything: `pnpm test` (root `vitest run`). All of the above use a scripted
fake `LLMProvider` — no LM Studio instance is required for CI.
