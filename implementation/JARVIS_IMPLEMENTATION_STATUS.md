# JARVIS Implementation Status

Branch: `feature/jarvis-ai-assistant` — merged to `main` via PR #2. Reconciliation with `main`, full CI/typecheck/lint/test/build verification, and removal of the temporary lockfile-sync workflow are complete; work below Phase 7 continues directly on `main`.

## Implemented

### Phase 1 — JARVIS Core
- Added `@umer/jarvis-core` using the existing `@umer/model-routing` `LLMProvider` contract.
- Bounded multi-turn tool calling; only registered tools are exposed and unknown tools fail closed.
- Does not fabricate successful execution when tools fail.
- Tool execution context now carries the authenticated principal and Trust authorization callback.

### Phase 1 — HTTP entry point
- Added `@umer/jarvis-api` with `GET /health` and `POST /v1/jarvis/chat`.
- Conversation history is bounded to the latest 20 messages.

### Phase 2 — Live Umer AI OS control-plane bridge
- Added `@umer/jarvis-tools` for authoritative dashboard, agents, opportunities and governed intake/delegation.
- Delegation preserves the existing planning, Work Package and human-gate lifecycle.
- No direct database writes or Trust/Control Plane bypass.

### Phase 3 — Durable Memory Access
- Added durable MySQL `MemoryStore` and vector-store adapters behind the existing Memory Access interfaces.
- Added MySQL migrations for durable memory records and embedding chunks.
- JARVIS initializes the persistent store at startup; it does not silently fall back to ephemeral memory in MySQL mode.
- Successful JARVIS turns are persisted as governed `WorkingNote` memories with durable retention.
- Semantic retrieval survives API restarts using persisted embeddings.
- Added governed memory deletion in the Memory Access Runtime.
- In-memory memory remains available for tests/non-persistent deployments.

### Phase 4 — CEO workforce briefing
- Added `ceo_briefing`, gathering dashboard, workforce, opportunity, failed-run and audit read models.
- Supports CEO questions about active work, workforce status, blockers, attention, failures and pipeline from authoritative data.

### Phase 5 — Execution, audit and artifact intelligence
- Added `inspect_agent_runs` and `inspect_agent_run` for runtime observability.
- Added `list_work_packages` and `list_tasks` so JARVIS can map specialists to concrete work.
- Added `inspect_audit_trail` over the existing append-only audit read model.
- Added `list_artifacts` and `inspect_artifact` over the existing Artifact Store read model.

### Phase 5/6 — CEO Attention and proactive delivery
- Added deterministic `ceo_attention` evaluation over watchdog findings, pending gates, failed runs and audit evidence.
- Added `attention_feed`, `GET /v1/jarvis/attention`, and an SSE attention stream.
- Background polling uses the existing Control API attention evaluator and does not create a second event bus.
- Attention changes are fingerprint-deduplicated.

### Phase 6 foundation — Timeline / catch-up intelligence
- Added `company_timeline`, combining audit, agent-run, task and opportunity read models into a bounded time-window timeline.
- Added `away_briefing` for questions such as "what happened while I was away?".
- Timeline entries retain source evidence and authoritative timestamps where available.

### Phase 6 — Identity and Trust integration
- Added `@umer/auth` session/authentication boundary with pluggable bearer-token resolution.
- Development mode supports an explicitly configured single-operator principal; production mode fails closed without a configured session resolver.
- JARVIS HTTP chat and attention endpoints now authenticate requests and bind the resulting human principal through the existing Trust Runtime.
- Added Trust authorization at the JARVIS tool boundary: read tools require `read` on `jarvis`; governed delegation requires `execute` on `command`.
- Authorization denials fail closed and are returned to the JARVIS reasoning loop as tool errors rather than bypassing Trust.
- Trust grants are explicit and configurable through `JARVIS_TRUST_ACTIONS`; development defaults to `read,execute`, while production defaults to `read`.
- Correlation IDs are preserved through authentication, Trust decisions and JARVIS tool execution.
- Added authentication and Trust-boundary tests for missing credentials, bearer authentication and denied/allowed tool execution.

### Phase 7 — Cross-entity CEO intelligence
- Added `ceo_intelligence`, an evidence-graph tool spanning agents, projects, tasks, Work Packages, agent runs, artifacts, opportunities and audit records.
- Supports an optional focus keyword so the CEO can investigate a specific project, specialist, task, Work Package, run, artifact or opportunity.
- Normalizes observed relationships such as agent → project/task, task → project/Work Package, Work Package → specialist/project/run/artifact, run → Work Package/specialist/project/artifact and artifact → execution/Work Package.
- Separates observed evidence from derived recommended next steps; recommendations are never executed by this tool.
- Failed runs and pending human gates are surfaced with evidence and suggested follow-up tools.
- The LLM remains a reasoning layer over authoritative read models; it is not treated as the source of truth.

### Phase 8 — Deeper CEO reasoning
- Added `ceo_root_cause_analysis`, a deterministic Evidence -> Causal Analysis -> Root Cause -> Business Impact -> Recommended Action -> Governed Delegation pipeline over the same authoritative read models as `ceo_intelligence`.
- Extracted the shared evidence-gathering/normalization step into `evidence.ts` (`gatherEvidence`) so both tools correlate the exact same facts across agents, projects, tasks, Work Packages, agent runs, artifacts, opportunities, audit records, correlation IDs and execution IDs — no duplicated read-model logic.
- Root cause is only ever "established" when a failing fact carries a concrete error/failure detail *and* resolves to a real structural relation already present in evidence; otherwise the tool reports "Root cause not established" and names exactly which evidence is missing. It never fabricates a root cause.
- Confidence is fixed arithmetic over three evidence checks (error detail, structural relation, correlated audit record) computed in TypeScript — never asked of or invented by the LLM.
- Business impact is only reported as an OBSERVED_FACT when a linked opportunity fact carries a real `estimatedValueMin`/`estimatedValueMax`/`timeToRevenueDays` field; otherwise it is explicitly labeled an INFERENCE with no invented revenue, customer, deadline, cost or severity figure.
- Every statement in the output is tagged `OBSERVED_FACT`, `INFERENCE`, or `RECOMMENDATION`. Recommendations name existing governed tools (`inspect_agent_run`, `inspect_audit_trail`, `ceo_attention`, `delegate_work`) by their literal registered name and are never executed by this tool.
- Governed delegation fails closed unless all six gates pass: the agent is registered (linked to the affected project in evidence), not suspended (`controlState !== 'paused'`), the `delegate_work` tool is actually registered, Trust confirms `execute`/`command` authority, explicit CEO approval was supplied for this specific delegation, and acceptance criteria (`doneWhen`) was supplied. Each failing gate is named explicitly.
- Added deterministic tests: known failure chain, missing relationship, no fabricated root cause, explicit vs. inferred business impact, recommendation/tool mapping, no automatic execution, suspended/unregistered agent, insufficient authority, missing approval/acceptance criteria, and correlation ID preservation.
- Added `ceo_project_summary` (`project-summary.ts`), a project-scoped summary over the same evidence: current state, active agents, active tasks, active Work Packages, failed runs, pending gates, recent artifacts, opportunities, blockers, business impact and recommended next action — each populated only where matching evidence exists; an unknown project returns no summary rather than an empty-but-shaped one.

### Phase 9 — Production identity provider and durable authorization grants
- Added `createOidcSessionResolver` (`packages/auth/src/oidc.ts`): a standards-based OIDC/JWT + JWKS `SessionResolver` that works with any real OIDC-compliant identity provider (Auth0, Okta, Azure AD/Entra ID, Google Identity, Keycloak, ...) without hardcoding a vendor. Verifies signature, issuer, audience and expiry against the IdP's JWKS; every verified token maps to its own principal (and tenant, if the IdP issues one) from its claims — this is what makes multiple real users/tenants distinguishable, unlike the single-operator static-token resolver. Fails closed (returns no principal, never a guessed/partial one) on any verification failure. Configured via `JARVIS_OIDC_ISSUER`, `JARVIS_OIDC_AUDIENCE`, and optionally `JARVIS_OIDC_JWKS_URI`, `JARVIS_OIDC_PRINCIPAL_CLAIM` (default `sub`), `JARVIS_OIDC_TENANT_CLAIM`, `JARVIS_OIDC_KIND_CLAIM`; takes priority over the static-token resolver when configured, which remains available for controlled single-operator deployments.
- Added `MySqlGrantStore` (`packages/trust/src/mysql-store.ts`) and a `trust_grants` migration. `apps/jarvis-api` now sources Trust grants from this durable store instead of re-asserting them from `JARVIS_TRUST_ACTIONS` on every restart: the env var only seeds grants the first time the configured principal has none, so grants administered directly against the store afterward are not overwritten on the next restart. Falls back to `InMemoryGrantStore` when running without durable persistence (`JARVIS_MEMORY_PERSISTENCE` != `mysql`).
- Fixed tenant propagation into Memory Access: `rememberTurn`/`retrieve`/`delete` on `JarvisMemory` now accept an optional per-call principal that overrides the principal bound at construction. `apps/jarvis-api` passes the actual authenticated session's principal (with its real tenantId) on every request instead of the single hardcoded startup principal that every prior request silently shared — durable memory is now genuinely tenant-isolated per authenticated caller, enforced by Memory Access's existing scope guard.
- Added durable JARVIS conversation history: `MySqlSessionHistoryStore` (`apps/jarvis-api/src/session-history-store.ts`) backed by a new `jarvis_session_turns` migration, replacing the anonymous in-memory session `Map` that lost every conversation on restart. Falls back to `InMemorySessionHistoryStore` (same bounded-history behavior) when running without durable persistence.
- All three durable stores share the one MySQL pool/executor `initializePersistentJarvisMemory` already established, gated on the same `JARVIS_MEMORY_PERSISTENCE=mysql` toggle as durable memory, so there is exactly one "durable persistence" mode for the whole app rather than several independent env vars.
- Added tests: `oidc.test.ts` (valid claims mapping, custom claim names, wrong audience/issuer/signature, expired token, missing principal claim, garbage token — all fail closed), `mysql-store.test.ts` for grants, `session-history-store.test.ts` for both history store implementations, and `jarvis-memory/index.test.ts` proving per-call tenant isolation on write, retrieve and delete.
- Added Trust grant admin tooling (`apps/jarvis-api/src/grant-admin.ts` + `GET/POST /v1/admin/grants`, `DELETE /v1/admin/grants/:grantId`) so provisioning access for a newly-authenticated real OIDC principal beyond the one bootstrap principal is a governed, authenticated API call rather than a direct DB write. Deliberately not a JARVIS chat tool — granting/revoking authority is kept out of the LLM tool-calling loop. Every admin route itself requires the caller to already hold an explicit `admin` grant on the `trust` resource (seeded once for the bootstrap principal alongside its other grants); fails closed for everyone else, including a principal otherwise fully authorized for ordinary `read`/`execute` actions. `GrantStore` gained a `revoke(grantId)` method (both `InMemoryGrantStore` and `MySqlGrantStore`) to support real revocation, not just an overriding deny grant.

## Remaining / intentionally gated

### Further identity work
- Replace the bounded-history read model with a proper paginated conversation view if/when conversations need to exceed the current MAX_HISTORY window.
- No UI for grant administration yet — `/v1/admin/grants` is a plain authenticated JSON API; an operator console would sit on top of it.

### Phase 10 — Durable specialist registry for governed delegation
- Added a specialist-*type* lifecycle control axis, orthogonal to per-agent-instance control (`AgentControlPort`): `SuspendSpecialist`/`ActivateSpecialist` CEO commands (`packages/contracts/src/commands/index.ts`) halt new delegated work of a specialist type (e.g. `eng.app-delivery`) company-wide, regardless of which agent instance would have performed it.
- Added `SpecialistControlPort` (`packages/control-plane/src/commands/ports.ts`) with `InMemorySpecialistControlStore` and `MySqlSpecialistControlStore` (new `specialist_control` migration). Sparse by design, matching `AgentControlStore`'s own philosophy: a missing row means `active` — the table only ever holds specialists that have been explicitly suspended (or previously suspended, then reactivated); it is never seeded with a canonical list of every specialist that could exist.
- `apps/control-api` wires this in with the same best-effort MySQL swap pattern as every other durable store (`specialist-control-link.ts`) and exposes it read-only via `GET /v1/specialists` / `GET /v1/specialists/:specialistId`; writes happen exclusively through `POST /v1/commands` (`SuspendSpecialist`/`ActivateSpecialist`), consistent with every other CEO Command Plane entity.
- `ceo_root_cause_analysis`'s governed delegation now fails closed on specialist-type suspension as well as agent-instance pause: `evaluateGovernedDelegation` resolves the candidate agent's `specialistId`, looks up its (sparse) specialist fact in the same shared evidence graph (`gatherEvidence` now also fetches `/v1/specialists`), and adds a `suspended_specialist: ...` reason distinct from `suspended_agent: ...` when the type itself is suspended — even for an agent instance that is not itself paused.
- Added tests at every layer: `service.test.ts` (SuspendSpecialist/ActivateSpecialist round-trip, double-suspend rejection, `specialist.control.changed` events, per-specialist isolation), `mysql-store.test.ts` (upsert/read-back/list for the new store), and `reasoning.test.ts` (fails closed on specialist suspension distinct from agent pause; eligible when the specialist type has never been suspended).

### Further CEO reasoning
- Add budget/quota and system-health attention policies where authoritative read models exist.
- Add richer project-level summaries and decision-quality scoring without fabricating missing evidence.
- No admin UI yet for `SuspendSpecialist`/`ActivateSpecialist` — issuing them today means a direct `POST /v1/commands` call.

### Voice
- Real STT → JARVIS → TTS provider/runtime integration with the same authorization, correlation and audit boundaries.

### Computer control
- Real sandboxed browser/desktop runtime with allowlists and explicit approval gates for destructive, financial, account-changing or irreversible operations.
- Screenshot/visual-state evidence and action audit trail.

## Verification note

CI is configured for pull requests. Results are not claimed until an actual run is observed.

JARVIS remains a human-facing intelligence layer over Umer AI OS and must preserve Trust, Registry, Control Plane, Work Package, and Agent Runtime boundaries. Current execution state comes from authoritative read models; memory is governed evidence and must not be treated as current runtime state.
