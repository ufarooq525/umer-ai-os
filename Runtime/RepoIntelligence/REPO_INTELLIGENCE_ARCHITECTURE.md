# Repository Intelligence Architecture

> The Runtime continuously understands every registered repository — its
> dependencies, database, routes, APIs, permissions, calls, modules, ownership,
> and history — as one queryable graph, so that when the `Student` model
> changes, the system *immediately* knows Attendance, Fees, Transport, Parents,
> the API surface, Policies, and Reports are affected.

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. This is **not an 18th
Runtime domain** (`RUNTIME_DOMAIN_MAP.md` fixes 17): Repository Intelligence is
a **derived read-model plane** — the same positioning move as
`Runtime/EventBus/` being the event plane of Message Fabric. It is assembled
from existing domains: Extension Runtime (VCS bridges, file watchers), Message
Fabric (`change.*` events), Artifact Runtime (graph snapshots), Context Runtime
(consumption), Registry Fabric (project catalog).

**No implementation in this document** — architecture and contracts only.

---

## 1. Core stance

| Principle | Meaning |
| --- | --- |
| **The repository is the SoR** | Every graph is a *derived, rebuildable index* over code + git. Losing the graph store loses nothing that a full re-index cannot restore. |
| **One property graph, many views** | The nine graphs below are typed subgraphs of a single unified Code Graph, not nine silos. Impact analysis works *because* they join. |
| **Pinned to commits** | Every node/edge carries the commit SHA it was extracted at. A graph snapshot is immutable; "current" is a pointer. |
| **Event-driven freshness** | Commits/merges trigger incremental re-extraction of changed files only; full rebuild is a fallback, not the norm. |
| **Honest confidence** | Static analysis of PHP/JS has limits (dynamic dispatch, magic methods, string routes). Every edge carries `confidence: certain \| probable \| heuristic`, and consumers can filter. |
| **Read-only over the repo** | Extractors never mutate the working tree. Analysis is side-effect-free; writes go only to the graph store and Artifact Runtime. |

Scope: every project in the project catalog (`Projects/README.md`,
`projectId` → path under `UMER_PROJECTS_ROOT`), plus the OS monorepo itself.
Graphs are **per-project** with a thin cross-project layer (shared packages,
shared services).

---

## 2. Components

```
                        ┌──────────────────────────────────────────────────┐
  sources               │            REPOSITORY INTELLIGENCE               │        consumers
┌──────────────┐        │  ┌───────────┐   ┌────────────┐   ┌───────────┐  │  ┌─────────────────┐
│ Git hooks /  │──────▶ │  │ Ingestion │──▶│ Extractor  │──▶│  Code     │  │  │ Specialists      │
│ VCS webhooks │ change.*  │ (debounce,│   │ Pipeline   │   │  Graph    │──│─▶│ (QA scope, Sec   │
│ (Extension   │        │  │  batch,   │   │ (per-graph │   │  Store    │  │  │  review, Eng)    │
│  Runtime)    │        │  │  commit-  │   │  analyzers,│   │ (snapshot │  │  ├─────────────────┤
├──────────────┤        │  │  pin)     │   │  parallel) │   │  + HEAD)  │  │  │ Impact Engine →  │
│ FS watcher   │──────▶ │  └───────────┘   └────────────┘   └─────┬─────┘  │  │ Context Runtime, │
│ (local dev)  │        │                                         │        │  │ Orchestration,   │
├──────────────┤        │        ┌──────────────┐   ┌─────────────▼─────┐  │  │ Event Bus        │
│ Scheduled    │──────▶ │        │ Impact Engine│◀──│  Query API        │  │  │ (repo.* events)  │
│ full re-index│        │        │ (transitive  │   │  (graph queries,  │──│─▶│ Web UI views     │
└──────────────┘        │        │  closure +   │   │   path, blast     │  │  └─────────────────┘
                        │        │  weights)    │   │   radius, diff)   │  │
                        │        └──────────────┘   └───────────────────┘  │
                        └──────────────────────────────────────────────────┘
```

### 2.1 Ingestion

Single entry point for "the repo changed":

- **Bridges** (Extension Runtime): VCS webhooks → `change.pr.created|merged`,
  push events. Signed envelopes per `EVENT_SCHEMA.md`.
- **Local watcher**: for Laragon working copies without remotes; debounced
  filesystem events collapsed into synthetic commit-like batches.
- **Scheduler**: periodic full re-index (drift correction) and on-demand
  rebuild command.

Ingestion resolves each trigger to `(projectId, commitSha, changedPaths[])`,
dedupes (same SHA = no-op), and enqueues extraction jobs on the Fabric command
plane.

### 2.2 Extractor pipeline

One analyzer per graph type (§3), run in parallel where independent, ordered
where dependent (Call Graph consumes Module Graph symbols). Each analyzer:

- Declares which file patterns it cares about (`composer.*`, `routes/**`,
  `database/migrations/**`, `app/Policies/**`, …) so incremental runs skip it
  when nothing relevant changed.
- Emits **typed nodes and edges** into a staging area; the store commits the
  batch atomically per `(projectId, commitSha, graphType)`.
- Records extraction diagnostics (files skipped, parse failures) — a parse
  failure degrades confidence, it never silently drops a subgraph.

Stack coverage is adapter-based: first-class analyzers for the registered
Laragon stack (PHP/Laravel: composer, Eloquent, artisan routes, Policies/Gates,
Blade/Livewire; JS/TS: package.json, import graph) — new stacks add analyzers,
not new architecture.

### 2.3 Code Graph Store

A property graph, addressed as:

```
node_id  = <projectId>:<nodeType>:<stable-key>        e.g. acme-lms:model:App\Models\Student
edge     = (from_node, edge_type, to_node, commitSha, confidence, meta)
snapshot = (projectId, commitSha) → immutable graph version
HEAD     = (projectId) → latest fully-extracted commitSha
```

- Physical backing is adapter-private (Postgres adjacency tables are the
  reference adapter; a dedicated graph DB may satisfy the same port later).
- Snapshots are **immutable**; incremental extraction copies-forward unchanged
  subgraphs by reference (cheap), replaces re-extracted ones.
- Periodic snapshots are sealed to Artifact Runtime for audit/time-travel;
  intermediate ones are retention-tiered.

### 2.4 Query API (`RepoGraphPort`)

Indicative operations (port contract, not code):

| Operation | Question it answers |
| --- | --- |
| `neighbors(node, edgeTypes[], direction, depth)` | What touches X directly / transitively |
| `path(from, to)` | *Why* is X affected by Y — the evidence chain |
| `blastRadius(nodes[], options)` | Full impact set for a change (see §5) |
| `diff(shaA, shaB)` | What did this commit/PR change *structurally* |
| `owners(paths[] \| nodes[])` | Who owns / who last touched |
| `hotspots(window)` | Churn × complexity ranking from history |
| `subgraph(view, filter)` | Render one of the nine views for UI/context |

### 2.5 Impact Engine

Consumes the Query API; owns traversal policy (edge-type weights, depth caps,
confidence thresholds, cycle handling) and produces **Impact Reports** (§5).
Exposed both as a synchronous query and as an event-driven reaction to
`change.*`.

---

## 3. The nine graphs

All are typed subgraphs of the one Code Graph. Per graph: node types, edge
types, extraction sources.

### 3.1 Dependency Graph

| | |
| --- | --- |
| Nodes | `package` (external), `project`, `workspace-package` |
| Edges | `depends_on {versionRange, dev, transitive}` |
| Sources | `composer.json`/`composer.lock`, `package.json`/lockfiles, monorepo workspace manifests |
| Extras | Advisory join: `package --has_advisory--> cve` (fed by security bridge) so `change.dependency.updated` impact includes vulnerability context |

### 3.2 Database Graph

| | |
| --- | --- |
| Nodes | `table`, `column`, `index`, `model` (Eloquent/ORM class), `migration` |
| Edges | `model --maps_to--> table`, `table --fk--> table`, `model --relates--> model {hasMany, belongsTo, morphMany…}`, `migration --alters--> table` |
| Sources | Migration files (parsed, not executed), model relationship declarations, optional live-schema introspection to verify (confidence upgrade) |
| Notes | Polymorphic and pivot relationships modeled explicitly — they are exactly where "what touches Student" hides |

### 3.3 Route Graph

| | |
| --- | --- |
| Nodes | `route {method, uri, name}`, `controller`, `action`, `middleware`, `view/page` |
| Edges | `route --handled_by--> action`, `route --guarded_by--> middleware`, `action --renders--> view` |
| Sources | Route files, route caches/`artisan route:list`-equivalent static parse, framework conventions |

### 3.4 API Graph

| | |
| --- | --- |
| Nodes | `endpoint` (route subtype with contract), `request-schema`, `response-schema`, `api-resource` (transformer), `consumer` (known client/app) |
| Edges | `endpoint --serializes--> model` (via api-resource), `endpoint --accepts--> request-schema`, `consumer --calls--> endpoint` |
| Sources | API route files, resource/transformer classes, OpenAPI specs when present, form-request validation classes |
| Notes | The API Graph is the Route Graph's contract-bearing subset: breaking-change detection = schema diff on `endpoint` nodes between snapshots |

### 3.5 Permission Graph

| | |
| --- | --- |
| Nodes | `policy`, `gate/ability`, `role`, `permission`, `guarded-resource` (model/route) |
| Edges | `policy --governs--> model`, `route --requires--> ability`, `role --grants--> permission`, `ability --checked_in--> action` |
| Sources | Policy classes, gate registrations, middleware params (`can:`), spatie-style permission tables (static seed/migration parse) |
| Notes | Security review specialist's primary view; joins with Trust concerns but does **not** replace Trust Runtime (OS-level auth ≠ product-level authz) |

### 3.6 Call Graph

| | |
| --- | --- |
| Nodes | `symbol` (class, method, function), `job`, `event-listener`, `command` |
| Edges | `calls {static\|dynamic}`, `dispatches` (jobs/events), `listens_to`, `imports/uses` |
| Sources | AST static analysis; framework-aware resolution for container bindings, facades, events, queued jobs |
| Notes | Lowest average confidence of the nine — dynamic dispatch and magic methods are marked `heuristic`, never guessed silently. Depth-capped in traversals to keep blast radius meaningful |

### 3.7 Module Graph

| | |
| --- | --- |
| Nodes | `module` (bounded feature area: Attendance, Fees, Transport…), `namespace`, `directory` |
| Edges | `module --contains--> symbol/route/table`, `module --depends_on--> module` (aggregated from call/import edges) |
| Sources | Namespace/directory conventions + an optional per-project `MODULES.yaml` mapping (declared once, validated against reality — drift emits a defect event) |
| Notes | This is the graph that turns raw edges into the human answer "Attendance and Fees are affected" instead of 400 file paths |

### 3.8 File Ownership

| | |
| --- | --- |
| Nodes | `file`, `owner` (specialist, department, human) |
| Edges | `owns {declared\|inferred}`, `last_touched_by`, `expert {score}` |
| Sources | CODEOWNERS-style declarations (declared), git blame/commit frequency (inferred expertise), specialist mandate mapping (which specialist's Work Packages touch which paths) |
| Notes | Routing input: impact reports name *who* should react, not just *what* is affected |

### 3.9 Git History Intelligence

| | |
| --- | --- |
| Nodes | `commit`, `pr`, `release`, `author` |
| Edges | `commit --touches--> file`, `co_changed {support, confidence}` (files that historically change together), `commit --linked_to--> workPackageId`, `fixes --> incident/bug` |
| Sources | git log topology, PR metadata via bridges, Work Package links from `change.pr.*` payloads |
| Notes | `co_changed` is the *empirical* impact signal — it catches couplings no static analyzer sees (config + code, seed data + report). Impact analysis fuses it with structural edges (§5) |

---

## 4. Unified schema rules

- **Node identity is stable across commits** — keyed by semantic identity
  (FQCN, table name, route name), not file offsets, so history and diffs work.
- **Every edge carries** `commitSha`, `confidence`, `extractor@version`, and
  `evidence` (file:line or command) — impact claims are always traceable to
  source, mirroring the citation rule in
  `Intelligence/MEMORY_ARCHITECTURE.md`.
- **Cross-graph joins are first-class**: `model` appears in Database, Call,
  Permission, and Module graphs as *one node* with edges from each extractor.
  This is the entire trick that makes §5 work.
- **Contracts** live in `packages/contracts` when implemented (node/edge type
  enums, Impact Report schema); this document is the SoR for their meaning.

---

## 5. Impact Analysis

### 5.1 Algorithm (architecture-level)

Given a change set (files, or resolved nodes like `model:Student`):

1. **Resolve** changed files → semantic nodes at HEAD snapshot.
2. **Traverse** outward over *all* edge types with per-type weights and
   direction rules (e.g. `fk` propagates both ways; `calls` propagates
   caller-ward; `serializes` propagates to endpoints and their consumers).
3. **Fuse** structural reachability with historical `co_changed` correlation —
   a file with no static edge but 0.9 co-change confidence still enters the
   set, marked `empirical`.
4. **Score** each impacted node: path length, edge confidences, historical
   defect density (from Git History Intelligence + QA memory).
5. **Aggregate** up the Module Graph and File Ownership graph → module-level
   summary + owner routing.
6. **Emit** an Impact Report artifact + `repo.impact.computed` event.

### 5.2 The worked example

`app/Models/Student.php` changes:

```
model:Student
 ├─ Database Graph:  hasMany → Attendance, Fees, TransportAssignment
 │                   belongsToMany → Parent (pivot guardian_student)
 │                   fk ← attendance.student_id, fees.student_id, …
 ├─ API Graph:       serialized_by → StudentResource, AttendanceResource
 │                   → endpoints GET/POST /api/students*, /api/attendance*
 │                   → consumers: mobile-app, parent-portal
 ├─ Permission Graph: governed_by → StudentPolicy; abilities checked in
 │                   StudentController, ReportController
 ├─ Call Graph:      used_by → AttendanceService, FeeCalculator,
 │                   TransportRoster, ReportGenerator (heuristic: dynamic)
 ├─ Module Graph:    rollup → Attendance, Fees, Transport, Parents, Reports
 ├─ Ownership:       eng.app-delivery (declared), qa.verify (test scope)
 └─ History:         co_changed → database/seeders/StudentSeeder.php (0.87),
                     reports/templates/student-card.blade.php (0.74)
```

Impact Report (summary form):

| Affected | Via | Confidence | Suggested reaction |
| --- | --- | --- | --- |
| Attendance module | FK + relation + service calls | certain | QA regression scope |
| Fees module | FK + FeeCalculator | certain | QA + eng review |
| Transport module | relation + roster service | probable | QA scope |
| Parents module | pivot relation + portal API | certain | QA + API contract check |
| API surface (`/api/students*`, resources) | serialization | certain | Contract diff, consumer notice |
| Policies (`StudentPolicy`) | governs | certain | Security review if authz fields changed |
| Reports module | dynamic calls + co-change history | probable/empirical | QA scope, template check |

### 5.3 Consumers of impact

| Consumer | Use |
| --- | --- |
| `qa.verify` | Test selection: regression scope = impacted modules ∩ known-regression memory |
| `security.review` | Auto-scope: triggered when Permission Graph nodes are in the impact set |
| `eng.app-delivery` | Pre-change awareness: blast radius shown *before* work starts (planning input on the Work Package) |
| Orchestration | Subscription filters can match on impact payload (`modules[]`, `severity`) per `SUBSCRIPTION_MODEL.md` |
| Context Runtime | Impact Report attached to the Context Package as retrieved evidence |
| Web UI | Blast-radius visualization per PR / work package |

---

## 6. Freshness and lifecycle

| Trigger | Action | Latency target |
| --- | --- | --- |
| Commit / push / PR event | Incremental extract of changed paths | Seconds–minutes |
| `change.migration.added` | Database Graph re-extract + immediate impact | High priority lane |
| Dependency lockfile change | Dependency Graph re-extract + advisory join | Normal |
| Scheduled (daily) | Drift check: sampled full extract vs incremental state; divergence → full rebuild + `repo.graph.diverged` | — |
| Analyzer version bump | Full re-extract of that graph type (new extractor may see more) | Background |
| Project registered | Initial full index of all nine graphs | Background |

Staleness is explicit: every query response carries `asOf: commitSha` +
`extractedAt`. A consumer needing the true tip compares against the project's
actual HEAD and may demand a refresh; specialists must not present stale-graph
conclusions as current (same honesty rule as `Core/COMMUNICATION_STANDARD.md`).

---

## 7. Events (`repo.*`)

New wire types under the existing Event Bus taxonomy (added to
`EVENT_TYPES.md` catalog + `packages/contracts` together, per catalog
governance):

| Wire type | When | Default subscribers |
| --- | --- | --- |
| `repo.index.completed` | Snapshot sealed for `(projectId, commitSha)` | Observability |
| `repo.index.failed` | Extraction failure (parse storm, timeout) | Engineering, Observability |
| `repo.graph.updated` | Incremental update applied; payload: graph types + changed node counts | Impact Engine |
| `repo.impact.computed` | Impact Report ready; payload: `modules[]`, `owners[]`, `severity`, `reportArtifactId` | `qa.verify`, `security.review` (filtered), Orchestration |
| `repo.contract.breaking` | API Graph diff detected a breaking endpoint change | `qa.verify`, gate opener |
| `repo.graph.diverged` | Drift check failed; rebuild scheduled | Observability |
| `repo.modules.drifted` | `MODULES.yaml` declaration no longer matches reality | Owning department |

All carry `projectId`, `commitSha`, `correlationId` per envelope rules.

---

## 8. Ownership boundaries

| Concern | Owner |
| --- | --- |
| Graph schema + traversal policy (this architecture) | Runtime (this document set) |
| Extractor correctness per stack | Engineering Department (analyzer quality bars) |
| Module boundaries (`MODULES.yaml` meaning) | Owning project's department/specialist |
| What *to do* about an impact | Specialists + Execution — Repository Intelligence informs, never decides |
| VCS credentials, webhook auth | Trust + Extension Runtime |
| Graph snapshots as artifacts | Artifact Runtime |

Explicitly does **not** own: code review judgment, release decisions, product
authz semantics, Analytics product metrics, and Intelligence organizational
memory (an Impact Report may be *cited into* specialist memory, but the graph
store is not a memory store — it is rebuildable state, the opposite of SoR
memory).

---

## 9. Failure modes

| Failure | Detection | Response |
| --- | --- | --- |
| Silent stale graph (consumer trusts old snapshot) | `asOf` mismatch check at consumption | Refuse-or-refresh; stale-use is a defect event |
| Heuristic edges presented as certain | Confidence stripped in a consumer view | Contract requires confidence propagation end-to-end |
| Impact explosion (everything affects everything) | Blast radius > threshold | Depth/weight caps; report flags "low-signal impact" instead of dumping the repo |
| Extractor crash on one file poisons index | Per-file error isolation | Skip + diagnostic + confidence downgrade for that subtree |
| Module map rots | `repo.modules.drifted` | Block module-level reporting until reconciled; fall back to path-level |
| Watcher storm (mass refactor / branch switch) | Ingestion debounce metrics | Collapse to single re-index; never queue per-file jobs |
| Graph store as accidental SoR (data no one can rebuild) | Rebuild drill (scheduled) | Any non-rebuildable data found in store is an architecture violation |

---

## 10. Metrics

| Metric | Intent |
| --- | --- |
| Index freshness lag (HEAD commit → snapshot sealed) p95 | Seconds–minutes, not hours |
| Impact precision/recall (vs post-hoc actual changed-together sets) | Track per release; tune weights |
| Extraction failure rate per analyzer | Near zero on supported stacks |
| Stale-graph consumption incidents | Zero |
| Blast-radius query latency p95 | Interactive (< a few seconds) |
| Rebuild-from-scratch success (drill) | Always passes — proves derived-only stance |

---

## 11. Non-goals

- No live production telemetry (that is Observability/Analytics; runtime
  traces may later *upgrade* call-edge confidence, as a fusion input only).
- No semantic code search / embeddings product (Memory Access owns retrieval;
  it may index graph node summaries like any other content).
- No enforcement: Repository Intelligence never blocks a merge itself — it
  feeds gates and specialists who decide.
- No cross-tenant graph joins; project isolation follows the same tenancy
  rules as the rest of the Runtime.
- No implementation, schema files, or migrations ship from this document.

---

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
owner: Runtime (architecture), Engineering (extractor quality), project departments (module maps)
related:
  - Runtime/EventBus/EVENT_ARCHITECTURE.md
  - Runtime/Domains/Extension_Runtime.md
  - Runtime/Domains/Context_Runtime.md
  - Runtime/Domains/Artifact_Runtime.md
  - Intelligence/MEMORY_ARCHITECTURE.md
  - Departments/Engineering/ENGINEERING_DEPENDENCY_GRAPH.md
```
