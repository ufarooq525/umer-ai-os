# Umer AI OS — JARVIS Requirements

## 1. Vision

JARVIS is the human-facing intelligence layer of Umer AI OS. It should behave as a persistent AI operating assistant: understand natural-language requests, reason over available context, use approved tools, delegate work to the agent workforce, monitor execution, remember useful information, and proactively surface important events to the CEO.

JARVIS is **not** a replacement for the existing Umer AI OS Runtime architecture. It is an orchestration and interaction layer built on top of the existing contracts, Runtime, Agent Runtime, tools, memory, observability, and control plane.

## 2. Primary user experience

The CEO must be able to interact with JARVIS through text first and voice later.

Examples:

- "Jarvis, give me my morning briefing."
- "What are the agents working on right now?"
- "Find profitable SaaS opportunities in healthcare."
- "Investigate this error and tell me what you recommend."
- "Delegate this research to the appropriate agents."
- "What happened while I was away?"
- "Why did this agent fail?"
- "Show me everything that requires my attention."

JARVIS responses should be concise for routine status and detailed when the user asks for investigation or explanation.

## 3. Functional requirements

### FR-01 — Conversational interface

- Accept natural-language text requests.
- Maintain conversation/session context.
- Stream responses where supported.
- Expose tool execution and delegated-work status in understandable language.
- Support confirmation before consequential or irreversible actions.

### FR-02 — Intent and planning

JARVIS must classify each request into one of:

1. Answer from available context.
2. Retrieve memory/data.
3. Use a tool.
4. Delegate to an existing specialist/agent.
5. Create or update governed work.
6. Request human approval.
7. Refuse safely when authority/capability is missing.

Planning must respect existing Umer AI OS Work Package and governance contracts. JARVIS must not invent a parallel task taxonomy.

### FR-03 — Tool router

Create a governed tool-routing layer that can discover and invoke allowlisted capabilities.

Initial tool families:

- Web/search.
- Database/read-model queries.
- File/document access.
- Agent status and run inspection.
- Work/project/task inspection.
- GitHub/repository operations where explicitly authorized.
- System/application operations where a future computer-control extension permits them.
- Notifications.

Every tool invocation must be attributable to a JARVIS session and execution/run identifier.

### FR-04 — Agent delegation

JARVIS must be able to delegate work to registered agents through the existing Agent Runtime/Work Package mechanism.

Requirements:

- Discover suitable registered capabilities.
- Select an eligible specialist/agent without bypassing Registry/Trust controls.
- Create/dispatch governed Work Packages.
- Track agent runs.
- Collect artifacts/results.
- Explain progress and blockers to the user.
- Never dispatch directly to an unregistered or suspended specialist.

### FR-05 — Persistent memory

JARVIS should use the existing Memory Access Runtime rather than creating a separate memory system.

Memory categories should include:

- Conversation/session summaries.
- User-approved preferences.
- Important decisions.
- Project context.
- Previous investigations.
- Useful facts and outcomes.

Sensitive information must follow existing Trust and data-retention policies.

### FR-06 — CEO command center

JARVIS must have a machine-readable status view over:

- Active agents.
- Agent runs.
- Current Work Packages.
- Opportunities.
- Blockers.
- Failed runs.
- Pending gates/approvals.
- Recent important events.
- Items requiring CEO attention.

The existing Mission Control UI should consume the same read models rather than maintaining a duplicate source of truth.

### FR-07 — Proactive monitoring

JARVIS should eventually monitor approved event streams and detect meaningful conditions such as:

- Agent failure/repeated failure.
- Blocked Work Package.
- Approval waiting too long.
- High-value opportunity discovered.
- Important system degradation.
- Budget/quota threshold.
- Completion of a significant delegated objective.

Proactive actions must be governed and should default to notifying the CEO rather than taking irreversible action.

### FR-08 — Voice interface

Voice is a later interface layer, not a separate intelligence core.

Pipeline:

`Microphone → Speech-to-Text → JARVIS → Tool/Agent execution → Text-to-Speech`

The same session, authorization, audit, and tool policies must apply to voice requests as text requests.

### FR-09 — Explainability

For every meaningful delegated action, JARVIS should be able to answer:

- What did you do?
- Why did you do it?
- Which agent/tool did you use?
- What is the current status?
- What evidence/result was produced?
- What needs my approval?

Technical details should remain available without overwhelming the normal CEO view.

### FR-10 — Safety and governance

JARVIS must fail closed when:

- A required capability is not registered.
- A specialist is suspended.
- A tool is not allowlisted.
- Authority is insufficient.
- A required acceptance criterion or gate is missing.
- A consequential action requires human approval.

JARVIS must never silently escalate its own authority.

## 4. Non-functional requirements

### NFR-01 — Provider independence

JARVIS must use the existing Model Routing layer. Provider/model identifiers must not leak into Specialist mandates or business logic.

### NFR-02 — Observability

Correlate JARVIS activity with existing identifiers wherever available:

`session_id`, `request_id`, `exec_id`, `work_package_id`, `agent_run_id`, `artifact_id`.

Emit structured events suitable for the existing observability and audit pipeline.

### NFR-03 — Reliability

- Tool calls must have bounded timeouts.
- Delegation must be idempotent.
- Retries must use existing Resilience mechanisms.
- Partial failures must be visible to the user.
- JARVIS must not claim an action succeeded without an authoritative result.

### NFR-04 — Security

- Reuse existing Trust/Auth/Session mechanisms.
- No secrets in prompts, logs, or persistent memory.
- Enforce tenant boundaries.
- Audit consequential actions.
- Keep computer-control capabilities disabled until explicitly implemented and allowlisted.

### NFR-05 — Local-first development

The initial implementation must work with the current local LM Studio/OpenAI-compatible setup where possible and remain compatible with the Model Routing abstraction.

## 5. Proposed implementation shape

Prefer adding focused components rather than creating a second platform:

```text
apps/
  jarvis-api/                 # JARVIS interaction/session API

packages/
  jarvis-core/                # intent, planning, response orchestration
  jarvis-tools/               # governed tool definitions/adapters
  jarvis-memory/              # JARVIS-facing memory adapter
  jarvis-voice/               # future STT/TTS adapters
```

These components should depend on existing packages such as `@umer/contracts`, `@umer/model-routing`, `@umer/orchestration`, `@umer/agent-runtime`, `@umer/memory-access`, `@umer/trust`, `@umer/session`, `@umer/observability`, and `@umer/audit` instead of duplicating them.

## 6. Initial implementation milestones

### Phase 1 — JARVIS Core

- [ ] Add JARVIS core package/service.
- [ ] Implement session-aware conversational endpoint.
- [ ] Connect to existing model routing.
- [ ] Implement structured intent classification.
- [ ] Implement safe response loop.
- [ ] Add request/run correlation.

### Phase 2 — Tool Use

- [ ] Define governed JARVIS tool contract.
- [ ] Connect existing search capability.
- [ ] Add read-only system/agent/work status tools.
- [ ] Add explicit approval flow for consequential tools.
- [ ] Record tool calls in audit/observability.

### Phase 3 — Agent Delegation

- [ ] Discover registered capabilities.
- [ ] Delegate through Work Package dispatch.
- [ ] Track agent runs.
- [ ] Retrieve artifacts/results.
- [ ] Provide natural-language progress reporting.

### Phase 4 — Memory

- [ ] Store/retrieve approved JARVIS conversation summaries.
- [ ] Store decisions and project context through Memory Access Runtime.
- [ ] Add semantic retrieval.
- [ ] Add memory-management/forget controls.

### Phase 5 — Proactive JARVIS

- [ ] Subscribe to relevant runtime events.
- [ ] Add attention detection rules.
- [ ] Generate CEO briefings.
- [ ] Notify on meaningful failures, completions, opportunities, and approvals.

### Phase 6 — Voice

- [ ] Add STT adapter.
- [ ] Add TTS adapter.
- [ ] Add wake-word/activation mechanism.
- [ ] Reuse all existing authorization and audit controls.

### Phase 7 — Computer Control

- [ ] Design a sandboxed computer-control extension.
- [ ] Implement explicit allowlists and confirmation gates.
- [ ] Support screenshots/visual state where appropriate.
- [ ] Keep destructive operations approval-gated.

## 7. Definition of Done for V1

JARVIS V1 is complete when a user can type a natural-language request, JARVIS can reason over current Umer AI OS state, answer from authoritative data or use an allowlisted tool, delegate governed work to an existing agent when appropriate, track the resulting run, and clearly report the result or blocker with correlated observability/audit data.

Voice, autonomous proactive behavior, and computer control are subsequent milestones and must not be simulated as completed functionality.

## 8. Architecture constraints

- Do not redesign frozen Architecture V1 documents.
- Do not create a parallel Business/Department/Specialist taxonomy.
- Do not bypass Trust, Registry, Control Plane, Agent Runtime, or Work Package contracts.
- Do not add a second message bus.
- Do not make the LLM the source of truth for execution state.
- Do not represent simulated agent activity as real activity.
- Keep the implementation incremental and testable.
