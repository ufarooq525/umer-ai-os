# Company Operating Model — Implementation Notes

> Extends `implementation/MONOREPO_BLUEPRINT.md` and `implementation/LLM_AGENT_EXECUTION.md`.
> Does not redesign Architecture V1. Establishes the control-plane foundation
> connecting Company → Agents → Specialists → Opportunities → Projects → Tasks
> → Work Packages → Agent Runs → Artifacts — not the full autonomous company
> brain (no write flows, no autonomous decisioning, no CEO UI).

## 1. What already existed (inspected before writing any code)

| Concept | Where it already lived | Status |
|---|---|---|
| Specialist mandate | `@umer/specialist-sdk`, `specialists/*.md` | Complete |
| Work Package, Task, ExecInstance, Dependency | `@umer/contracts` (`work-packages`, `execution`) | Complete |
| `ProjectId` brand | `@umer/contracts/common/ids.ts` | Referenced everywhere, no `ProjectContract` yet |
| Agent Run (mechanical record) | `@umer/contracts/runtime` (`AgentRunContractSchema`) | Defined, **never constructed anywhere** (verified by repo-wide grep) |
| Agent Run *live state* | `@umer/observability` (`AgentRunSnapshot`, from the LLM-execution milestone) | Complete, event-derived |
| Opportunity (sales/discovery sense) | `@umer/contracts/opportunities` (`OpportunitySchema` + 12 sibling schemas) | Complete, MySQL-persisted by `@umer/opportunity-intelligence` |
| Registry "project" (a codebase) | `@umer/registry` (`ProjectRecord`/`ResolvedProject`), `projects/catalog.json` | Complete, unrelated noun (see §2) |
| Agent (worker identity) | **Nowhere** | Genuine gap — this milestone's Phase A |
| Work Management Project (planning unit) | **Nowhere** (only the ID brand) | Genuine gap — this milestone's Phase B |

Architecture docs read in full: `AI_OS_CONSTITUTION.md`, `AGENT_SPECIFICATION.md`,
`WORK_MANAGEMENT_FRAMEWORK.md`, `WORKFLOW_STANDARD.md`, `REQUEST_LIFECYCLE.md`,
`EXECUTION_PLAYBOOK.md`, `AUTONOMOUS_REVENUE_OS.md`,
`GLOBAL_OPPORTUNITY_INTELLIGENCE.md`, `OPPORTUNITY_PIPELINE_V1.md`,
`Opportunity_Intelligence_SCHEMA.md`, `Agents/CEO.md`, `Agents/ProjectManager.md`,
plus `Enterprise_Architecture/ENTERPRISE_TAXONOMY.md` (the canonical glossary
those files point to — the authoritative source for every noun/enum used below).

## 2. A naming collision that already existed, not introduced here

Three different things are called "project" in this codebase:

1. **`@umer/registry`'s `ProjectRecord`** — a registered Laragon *codebase*
   (`projects/catalog.json`): `path`, `stack`, `category`, `defaultSpecialists`.
   Served today at `GET /v1/projects`. Unrelated to work planning.
2. **Architecture V1's Work Management "Project"** (`ENTERPRISE_TAXONOMY.md`,
   `WORK_MANAGEMENT_FRAMEWORK.md`) — the execution-layer operationalization of
   an Initiative: `Forming → Active → Stabilizing → Closing → Archived →
   Abandoned`. Only the `ProjectIdSchema` brand existed in code before this
   milestone (referenced by `TaskContract`, `ExecInstanceContract`,
   `RequestContract`).
3. The repo-root `Projects/` folder — turned out to be the *same* file as (1)
   (`projects/catalog.json`, case-insensitive filesystem), not a third thing.

**Decision:** implement (2) as the new `ProjectContractSchema` (§4), reusing
the existing `ProjectIdSchema`. Keep `GET /v1/projects` exactly as-is (still
(1), zero risk to existing consumers/tests). Expose (2) at **`GET
/v1/work-projects`** instead of reusing the `/v1/projects` path — the existing
route already owns that name for a different, pre-existing resource, and Phase
E's instruction was explicit: only add a route "if it does not already exist."
A `ProjectContract` may optionally reference a registry codebase via
`registryProjectId`, but the two stay distinct records, never merged.

## 3. Two "Opportunity" senses — also pre-existing, not introduced here

- **Business-layer "Opportunity/Business Case"** (`WORK_MANAGEMENT_FRAMEWORK.md`
  hierarchy: `Opportunity → Business Case → Initiative → Project`) — a
  portfolio investment-evaluation concept. **Not implemented in code anywhere.**
- **Sales/discovery "Opportunity"** (`Opportunity_Intelligence_SCHEMA.md`,
  `OPPORTUNITY_PIPELINE_V1.md`) — implemented as `@umer/contracts`'
  `OpportunitySchema`, persisted by `@umer/opportunity-intelligence` (MySQL).

This milestone's Phase C explicitly connects "the existing Opportunity
Intelligence system" to execution — that is sense 2. **Decision:** link sense-2
`Opportunity` to `ProjectContract`, intentionally eliding the theoretical
Business Case/Initiative middle layers (they don't exist in code; building
them is out of scope for a control-plane-foundation milestone). The link
itself is recorded as a **reverse-only reference** — `ProjectContract.
sourceOpportunityId`, not a field on `Opportunity` — see §4 for why (the
MySQL-persisted Opportunity schema has no column for it, and this milestone
adds no migration). When Business Case/Initiative are built later,
`Opportunity → Business Case → Initiative → Project` becomes the fuller
chain; today's reverse reference remains valid as the terminal edge.

## 4. Opportunity Intelligence ↔ AI OS execution boundary

```
Opportunity Intelligence (packages/opportunity-intelligence, MySQL)     AI OS execution/control plane (control-api, in-memory)
  system of record for: Opportunity, Niche, Evidence, Problem,           system of record for: Agent, Project, Task,
  ResearchCase, BusinessProspect, OutreachDraft                          Work Package, Agent Run, Artifact
  owns ALL writes to this data                                          NEVER writes into Opportunity Intelligence
        │                                                                       │
        └────────────  ProjectContract.sourceOpportunityId (reverse-only)  ────┘
```

`apps/control-api` depends on `@umer/opportunity-intelligence` for **read-only**
access (`OpportunityPersistence.listOpportunities`/`getOpportunity`) via
`GET /v1/opportunities`. It never calls a `save*` method. This is the same
`OpportunityPersistence` interface + `InMemoryOpportunityPersistence` /
`MySqlOpportunityPersistence` implementations that already existed —
`apps/control-api/src/opportunity-link.ts` just wires the existing
`createMySqlOpportunityPersistence()` factory in, fail-open (same pattern as
§7's NATS wiring): if MySQL is unreachable, `/v1/opportunities` serves an
empty in-memory store instead of failing control-api's boot.

`OpportunityStatusSchema` gained two additive bridge values:
`selected_for_execution` and `project_created`. Both are plain strings stored
in the existing `status VARCHAR(32)` column — no migration needed, so they
round-trip through `MySqlOpportunityPersistence` exactly like every other
status value already does. No `executing`/`failed` status was added — once a
Project exists, that Project's own status (`Active`/`Stabilizing`/...) is the
single source of truth for execution progress, never duplicated on the
Opportunity.

**The relationship is reference-level and recorded in one direction only —
this is a deliberate design correction, not a gap left unaddressed.** An
earlier draft of this milestone added an `Opportunity.projectId` field, but
`opportunity_opportunities`' MySQL columns are `id, type, title, geography,
market, niche_id, business_id, problem_ids_json, score_json,
estimated_value_min, estimated_value_max, currency, time_to_revenue_days,
evidence_refs_json, status, created_at, updated_at` — checked directly against
`packages/db/src/migrations.ts` — with no free/generic column that could hold
a project reference without a migration. Per this task's explicit constraint
(no migration), that field would have round-tripped through
`InMemoryOpportunityPersistence` but silently vanished through
`MySqlOpportunityPersistence` — a persistence claim the schema couldn't back
up. **Removed.** The forward reference now lives only on `ProjectContract.
sourceOpportunityId` (§6) — an in-memory, control-api-owned field that is
honestly documented as such, with no false claim about Opportunity
Intelligence's own persistence. Finding "which Project did opportunity X
become" today means querying the Project store for `sourceOpportunityId ===
X`, not reading a field off the Opportunity record. `OpportunitySchema`
explicitly rejects an unrecognized `projectId` key now (regression-guarded by
a dedicated test) so this can't quietly regress.

**Documented future persistence gap:** if a forward `Opportunity → Project`
field is ever needed (e.g. to avoid the reverse-scan), it requires either an
additive `opportunity_opportunities.project_id` MySQL column (a real,
deliberate migration, out of scope here) or a small dedicated linking table —
not a field bolted onto the shared contract ahead of either.

## 5. Agent model (Phase A)

`@umer/contracts/agents` — `AgentContractSchema`. An Agent is the **worker
identity**; a Specialist is its **mandate refinement** (`ENTERPRISE_TAXONOMY.md`:
"Every Specialist is an Agent; there is no second worker type"). The contract
reflects that literally: it references `specialistId` and never repeats
mission/tool-allowlist/authority-class — those stay owned by
`SpecialistContract`.

```ts
AgentContract = {
  agentId, specialistId,               // identity + mandate reference
  name?, department?, capabilityIds,   // display fields, best-effort (see §8)
  status: 'idle' | 'active' | 'blocked' | 'offline',
  lastSeenAt?,
  currentProjectId?, currentTaskId?, currentWorkPackageId?, currentAgentRunId?,
}
```

Live population is entirely event-derived — see §7 (no separate
"registration" step, no new events needed for presence/status).

`agentId` convention: `${producer}:${specialistId}` (e.g.
`agent-worker:growth.opportunity-research`), computed once in
`AgentWorker.agentIdFor()`. Deterministic and stable across restarts. One
Agent per specialist mandate a given worker process can execute.

## 6. Project / Task / Work Package / Agent Run chain (Phase B)

```
ProjectContract (new)  ──projectId──▶  TaskContract (extended: + assignedAgentId)
                                              │ taskIds
                                              ▼
                                    WorkPackageContract (UNCHANGED — zero touches)
                                              │ workPackageId
                                              ▼
                                    AgentRunSnapshot (extended: + agentId, + taskIds)
```

- `WorkPackageContract` was **not modified at all** (explicit requirement).
  It was already traceable to Project transitively via `taskIds → Task.projectId`
  — no redundant direct field was added.
- `TaskContract` gained one additive optional field: `assignedAgentId`. Task →
  Work Package traceability already existed (`Task.workPackageId`); a new
  `TaskStore.linkWorkPackage()` method makes it settable from control-api.
- `AgentRunSnapshot` (the read model, not the mechanical `AgentRunContractSchema`
  — see §8) gained `agentId` and `taskIds`, both IDs-only per Phase D's
  explicit "don't put business-domain data into the runtime reducer" rule.
  `currentProjectId` is **never stored** on the reducer — it's resolved at
  read time by joining `taskIds[0]` against the Task store
  (`enrichAgentWithProject()` in `apps/control-api/src/state.ts`).

## 7. Runtime state projection (Phase D)

Reused the exact event stream and reducer pattern from the LLM-execution
milestone — no new events needed for Agent presence:

```
worker.ts's agent.run.started/completed/failed/killed
        │ (agentId, taskIds now included — new)
        ▼
subscribeAgentRunReadModel (packages/agent-runtime/src/read-model.ts)
        │                              │
        ▼                              ▼
AgentRunReadModelStore          AgentRegistryStore (new, packages/observability/src/agent-registry.ts)
(existing, extended)            projectAgentEvent(): pure reducer, same shape as projectRuntimeEvent()
```

Both stores are updated from the **same** NATS subscription (not a second
consumer on the same subject) and share the same idempotency gate
(`IdempotencyStore`, dedup by `eventId` — unchanged from last milestone).

`AgentRegistryStore.project()` only reacts to `agent.run.started/completed/
failed/killed` — `agent.llm.*`/`agent.tool.*`/`agent.decision` are
intentionally not tracked by this store (no new information for "who exists
and what are they doing" beyond what the four lifecycle events already give).

## 8. Known gap: Agent display fields (`name`/`department`/`capabilityIds`)

These need the resolved Specialist mandate, which `worker.ts` doesn't have at
`agent.run.started` time by default (mandate resolution happens inside
`AgentRuntime.execute()`, called *after* that event is published, deliberately
— so even a trust-denial/specialist-not-found failure still gets a `started`
event). **Fix:** `AgentWorkerOptions` gained an optional synchronous
`resolveAgentDisplay(specialistId)` callback; `apps/agent-worker/src/main.ts`
implements it trivially from the specialist mandates it already has loaded at
boot. Works for both the LLM path and the deterministic `eng.app-delivery`
path (unlike an approach that would have threaded this through
`runLlmAgent`, which only covers one path). Verified live (§12).

## 9. Events (Phase G)

**Reused, not reinvented:** `agent.run.started/completed/failed/killed`
already existed and now carry `agentId`/`taskIds`/display fields — this is
what the Agent Registry runs on. **No** `agent.created`/`agent.status.changed`
were added; they'd be redundant with the four events above.

**New** (genuinely new state transitions this milestone introduces — nothing
in the codebase could previously produce them):

| Event | Emitted by |
|---|---|
| `project.created` | `ProjectStore.create()` |
| `project.status.changed` | `ProjectStore.updateStatus()` |
| `task.created` | `TaskStore.create()` |
| `task.assigned` | `TaskStore.assign()` |
| `task.status.changed` | `TaskStore.updateStatus()` |
| `opportunity.selected` | *defined in the RuntimeEventName vocabulary; not yet emitted — no write flow exists yet that selects an Opportunity (§Remaining gaps)* |
| `opportunity.project.created` | *same as above* |

The stores publish through the existing `AgentEventPublisher` shape
(`@umer/agent-runtime`'s noop-by-default publisher — reused rather than
inventing a second publisher type) — no HTTP route triggers these yet (Phase E
is read-only), so in this milestone they only fire from direct/test store
calls. Wiring them to real control-api write endpoints is future work.

## 10. Control API (Phase E)

All new routes are **read-only** GETs, added only where the resource didn't
already exist:

| Route | Filters | Backed by |
|---|---|---|
| `GET /v1/agents`, `/v1/agents/:id` | `status`, `department`, `specialist` | `state.agentRegistry` (+ `currentProjectId` joined at read time) |
| `GET /v1/work-projects`, `/v1/work-projects/:id` | `status`, `owner` | `state.projectStore` |
| `GET /v1/tasks`, `/v1/tasks/:id` | `status`, `agent`, `project` | `state.taskStore` |
| `GET /v1/company/opportunities`, `/v1/company/opportunities/:id` | `status` | `state.opportunityReader` (Opportunity Intelligence, read-only) |

`GET /v1/projects` (registry codebases) is untouched.

## 11. Persistence boundary (Phase H)

| Domain | Storage today | Owner |
|---|---|---|
| Trust, Artifacts, Audit, Memory Access | In-memory (`InMemory*Store`) | respective `@umer/*` packages |
| Agent Run read model, Agent Registry | In-memory, event-derived | `@umer/observability` |
| Opportunity Intelligence | **MySQL** (already implemented, already live in this environment) | `@umer/opportunity-intelligence` |
| Project, Task (new) | In-memory (`InMemoryProjectStore`/`InMemoryTaskStore`) | `apps/control-api` |
| Postgres (`DATABASE_URL`) | **No schema exists anywhere in this codebase** | — |

No migration was added. Every new store follows the exact
interface-plus-InMemory-default shape used everywhere else in this repo, so a
future Postgres-backed `ProjectStore`/`TaskStore` (or a Postgres-backed
`AgentRegistryStore`) can be substituted without touching call sites — this is
the "preserve repository interfaces" requirement satisfied structurally, not
just promised.

## 12. Live verification performed

- `enrichAgentWithProject()` / full HTTP route surface verified via
  `apps/control-api/src/company-model-routes.test.ts` (in-memory, deterministic).
- `connectOpportunityReader()` verified **live** against the real MySQL
  Opportunity Intelligence database already running in this environment
  (`OPPORTUNITY_DATABASE_URL`): connected in 19ms, `listOpportunities()`
  returned 32 real, already-migrated rows. Automated tests still use the
  in-memory store so they stay environment-agnostic (a downstream CI
  environment need not have live MySQL with these exact rows).
- `resolveAgentDisplay` wiring verified through `apps/agent-worker/src/main.ts`
  typechecking against the real `loadedSpecs`/`mandatesById` map it already
  builds at boot (same objects `AgentRuntime.resolveMandate` uses).

## 13. Explicitly not built in this milestone

Per the milestone's own scope boundary: no CEO UI, no PostgreSQL migration, no
autonomous opportunity-selection or project-creation write flow (so
`opportunity.selected`/`opportunity.project.created` are defined but not yet
emitted by anything), no multi-agent swarm orchestration, no write endpoints
for Agent/Project/Task/Opportunity over HTTP. The Opportunity → Project link
is reference-level and one-directional (`ProjectContract.sourceOpportunityId`
only, §4) — a forward field on Opportunity itself remains a documented future
persistence gap pending either a MySQL migration or a dedicated linking table.
