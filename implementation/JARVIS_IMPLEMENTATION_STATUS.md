# JARVIS Implementation Status

Branch: `feature/jarvis-ai-assistant`

## Implemented

### Phase 1 — JARVIS Core
- Added `@umer/jarvis-core`.
- Uses the existing `@umer/model-routing` `LLMProvider` contract.
- Maintains conversation history at the API boundary.
- Supports multi-turn tool calling with a bounded reasoning loop.
- Sends only registered tools to the model.
- Fails closed when the model requests an unknown tool.
- Does not fabricate successful execution when a tool fails.
- Rejects provider `length` and `content_filter` finishes as incomplete answers.
- Produces a typed `JarvisTurn` containing the correlation ID and tool execution trace.

### Phase 1 — HTTP entry point
- Added `@umer/jarvis-api`.
- `GET /health` reports the configured model provider and registered JARVIS tools.
- `POST /v1/jarvis/chat` accepts `{ sessionId?, message }`.
- Session history is bounded to the latest 20 messages.
- Default local port: `3010` (`JARVIS_PORT` can override it).

### Phase 2 — Live Umer AI OS control-plane bridge
- Added `@umer/jarvis-tools`.
- `control_plane_snapshot` reads the authoritative `/v1/dashboard` state instead of inventing agent activity.
- `list_agents` reads registered workforce state.
- `list_opportunities` reads the opportunity API with a bounded limit.
- `delegate_work` submits normal control-plane intake and therefore preserves the existing planning, Work Package and human-gate lifecycle.
- JARVIS uses `CONTROL_API_BASE_URL` with a local `3002` fallback.
- No direct database writes or bypass of Trust/Control Plane were introduced.

### Phase 3 — Governed memory retrieval foundation
- Added `@umer/jarvis-memory` as a thin adapter over the existing `@umer/memory-access` runtime.
- Memory retrieval keeps the existing principal/scope checks and correlation path; JARVIS does not maintain a second memory store.
- Added `retrieve_memory` as a registered JARVIS tool with bounded limits and the canonical memory-kind enum.
- Memory evidence is explicitly separated from live control-plane state in the tool description.
- The adapter does not pretend that the current in-memory memory stack is durable persistence; a durable Memory Access store remains a separate implementation concern.

## Intentionally not claimed yet

- Durable cross-process JARVIS memory is not implemented or simulated.
- Full direct Agent Runtime run control is not exposed as an unrestricted JARVIS action; delegation stays behind the existing control-plane intake path.
- Proactive monitoring is not implemented yet.
- Voice and computer control are not implemented yet.

## Next implementation step

1. richer agent/run/artifact inspection
2. audit/trace correlation in JARVIS responses
3. durable Memory Access integration when a persistent store is available
4. proactive CEO attention events
5. voice interface
6. computer-control capabilities with explicit approval gates

The adapter must continue to preserve Trust, Registry, Control Plane, Work Package, and Agent Runtime boundaries.
