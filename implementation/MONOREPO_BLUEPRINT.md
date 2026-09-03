# Umer AI OS — Implementation Blueprint (Monorepo)

> **Status:** Implementation design for Architecture V1.  
> **Does not** extend enterprise architecture, departments, specialists, or work nouns.  
> **Does** define how software realizes the locked docs under `Core/`, `Execution/`, `Runtime/`, `Business/`, `Departments/`, etc.

Architecture SoR remains the markdown tree. This document is the software plan to build Version 1.

**Companion:** `implementation/LLM_AGENT_EXECUTION.md` documents how `@umer/model-routing` and
`@umer/extension` implement real LLM + tool-calling execution inside the Agent Runtime described here.

---

## 0. Implementation principles

1. **Docs own meaning; code owns machinery.** Execution/Business/Governance semantics stay in Architecture V1 markdown + DB rows that *reference* those contracts. Runtime packages implement `Runtime/Domains/*` only.
2. **One Accountable per concern in code** mirrors architecture: no “god service.”
3. **Work Package is the only Agent dispatch unit** (`Execution/WORK_MANAGEMENT_FRAMEWORK.md`).
4. **Fail closed** on unbound Capability, Suspended Specialist, missing AC, gate silence.
5. **Models are dependencies** — Model Routing only; no vendor IDs in Specialist specs.
6. **Intelligence content ≠ Memory plumbing** — separate packages/stores.
7. **TypeScript-first control plane** for typed contracts; Python workers optional later for ML-heavy skills via Extension Runtime — not required for V1 kernel.

**Baseline toolchain (V1)**

| Concern | Choice |
|---|---|
| Monorepo | `pnpm` workspaces + `turborepo` |
| Language | TypeScript (Node 22 LTS) |
| API | tRPC + OpenAPI gateway surface |
| Web | Next.js (App Router) |
| Primary DB | PostgreSQL 16 |
| Queue | NATS JetStream (commands + events = Message Fabric) |
| Cache | Redis |
| Object storage | S3-compatible (MinIO local / cloud S3) |
| Vector | pgvector in Postgres (V1); Qdrant optional later without API break |
| Auth | OIDC (Auth.js / Keycloak-compatible) + internal service mTLS |
| Observability | OpenTelemetry → Tempo/Jaeger + Prometheus + Loki |
| Containers | Docker Compose (local) → Kubernetes (prod-ready charts) |

---

## 1. Repository structure

Architecture V1 folders stay at repo root (frozen). Implementation lives beside them:

```text
umer-ai-os/
├── Core/ … Runtime/ …          # Architecture V1 (SoR — do not redesign)
├── Departments/ …
├── RFC/ …
│
├── apps/
│   ├── web/                    # Control-plane UI (HITL, projects, gates)
│   ├── api-gateway/            # Edge auth, routing, rate limits
│   ├── control-api/            # Request/EXEC/Work/Gate command API
│   ├── orchestration-worker/   # Orchestration Runtime consumers
│   ├── agent-worker/           # Agent Runtime sandboxed runners
│   ├── extension-worker/       # Extension Runtime (tools/plugins egress)
│   └── audit-sink/             # Audit Runtime consumer (immutable write)
│
├── packages/
│   ├── contracts/              # Shared DTOs: Request, EXEC, Task, WorkPackage…
│   ├── config/                 # Typed config + feature flags (Kernel concern)
│   ├── db/                     # Drizzle schema + migrations
│   ├── auth/                   # OIDC helpers, principals, session types
│   ├── message-fabric/         # NATS client: command + event planes
│   ├── kernel/                 # Runtime Kernel: boot, tenancy, hard stops
│   ├── trust/                  # Trust Runtime: identity, PEP hooks, allowlists
│   ├── control-plane/          # Gates wait + policy enforcement mechanics
│   ├── registry/               # Registry Fabric + Capability Resolver
│   ├── model-routing/          # Model Routing Engine
│   ├── context/                # Context Runtime
│   ├── memory-access/          # Memory Access Runtime (plumbing)
│   ├── orchestration/          # Orchestration Runtime (task graphs, WP dispatch)
│   ├── artifacts/              # Artifact Runtime
│   ├── resilience/             # Resilience Runtime
│   ├── session/                # Session & Human Collaboration Runtime
│   ├── resource-economy/       # Quotas, budgets, cost envelopes
│   ├── observability/          # OTel metrics/traces/logs helpers
│   ├── audit/                  # Audit event builders + sink client
│   ├── extension/              # Extension Runtime SDK (host side)
│   ├── agent-runtime/          # Agent Runtime (mandate.bind, sandbox, seal)
│   ├── specialist-sdk/         # Author/load Specialist Specs → runtime binding
│   ├── plugin-sdk/             # Third-party / tool plugin contract
│   └── ui/                     # Shared UI primitives for apps/web
│
├── specialists/                # Spec instances (markdown/YAML) — not prompts-as-architecture
│   └── engineering/…           # Mirrors Departments/*/Agents when staffed
│
├── infra/
│   ├── docker/                 # Dockerfiles + compose
│   ├── k8s/                    # Helm charts / Kustomize
│   ├── terraform/              # Optional cloud IaC (later)
│   └── policies/               # OPA/Rego or Cedar bundles (Governance→PEP)
│
├── scripts/                    # dev bootstrap, seed, migrate
├── tests/
│   ├── e2e/
│   ├── contract/
│   └── chaos/
├── .github/workflows/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── implementation/
    └── MONOREPO_BLUEPRINT.md   # this file
```

**Rule:** Application code never imports Architecture markdown as logic. Specs are loaded via `specialist-sdk` parsers; policy via Control Plane + Trust.

---

## 2. Applications

| App | Implements | Notes |
|---|---|---|
| `apps/web` | Session & HITL UI, Project/Epic/Task boards, gate consoles, audit views | Humans approve irreversible actions |
| `apps/api-gateway` | Edge: TLS terminate (or mesh), authn, routing to control-api, WAF hooks | No business logic |
| `apps/control-api` | Request Lifecycle, Work Management commands, read models | Talks to packages; emits Message Fabric commands |
| `apps/orchestration-worker` | Orchestration Runtime | Consumes EXEC/WP commands; schedules stages |
| `apps/agent-worker` | Agent Runtime | Executes Work Packages only |
| `apps/extension-worker` | Extension Runtime | Network egress, tools, plugins — sandboxed |
| `apps/audit-sink` | Audit Runtime | Append-only; separate credentials |

No app may own Business intent, EA nouns, or Intelligence content schemas beyond storage plumbing.

---

## 3. Shared packages

| Package | Role |
|---|---|
| `@umer/contracts` | Zod/TS types for Request, Initiative ref, Project, Epic, Task, Sprint, Release, Work Package, Handoff, Gate, Artifact headers, Dependency, Blocker — names match Architecture V1 |
| `@umer/config` | Env schema (Zod), secrets refs, tenancy defaults |
| `@umer/db` | Schema, migrations, repositories |
| `@umer/auth` | Principal, OIDC, service identity |
| `@umer/ui` | Design-system-free shared components for control plane |

Contracts package is the **code mirror** of Work Management + Artifact headers — not a new taxonomy.

---

## 4. Runtime package(s)

Seventeen Architecture domains → seventeen packages (or focused modules under a single `@umer/runtime` workspace with subpath exports). **Preferred V1:** separate packages matching domain map for ownership clarity:

```text
@umer/kernel
@umer/trust
@umer/control-plane
@umer/registry
@umer/model-routing
@umer/context
@umer/memory-access
@umer/orchestration
@umer/artifacts
@umer/message-fabric
@umer/resilience
@umer/session
@umer/resource-economy
@umer/observability
@umer/audit
@umer/extension
@umer/agent-runtime
```

**Dependency direction (acyclic, mirrors Runtime ownership):**

```text
kernel → trust → control-plane → registry
message-fabric ← all
orchestration → agent-runtime → model-routing, context, memory-access, artifacts, extension
resource-economy, resilience, observability, audit cross-cut via interfaces
```

Kernel boots workers; does not schedule Specialist judgment.

---

## 5. Specialist SDK (`@umer/specialist-sdk`)

Implements `Core/AGENT_SPECIFICATION.md` + `Core/SPECIALIST_ARCHITECTURE_STANDARD.md` as **loadable mandates**, not prompt packs.

| Capability | Behavior |
|---|---|
| Parse Spec | Markdown/YAML → typed `SpecialistMandate` |
| Validate | Activation gate checklist (E1–E22 + 16 Agent sections presence) |
| Hash | Spec content hash for Runtime mandate.bind |
| Bind | Department, Capability IDs, tool allowlist, authority class |
| Register | Push provider binding to Registry Fabric |
| Refuse | Surface Non-Goals / Anti-Mandate to Agent Runtime |

SDK **does not** invent Specialists, Departments, or Capabilities. Staffing remains Architecture/DAS process; code only loads what humans register.

---

## 6. Memory package (`@umer/memory-access`)

Implements Memory Access Runtime only.

| Does | Does not |
|---|---|
| CRUD/search APIs over memory stores | Own lessons/patterns content ontology (Intelligence) |
| Embed + retrieve via vector index | Bypass Work Package context |
| Enforce Trust scopes on read/write | Store org SoR only in Agent local state |

Stores: Postgres tables for structured memory pointers + pgvector chunks; object storage for large blobs. Content types align with Intelligence libraries as **data**, curated outside the package.

---

## 7. Artifact package (`@umer/artifacts`)

Implements Artifact Runtime + registry validation against `Execution/ARTIFACT_CONTRACTS.md`.

| Feature | Notes |
|---|---|
| Seal | Immutable blob + header (`artifact_type`, `produced_for: EXEC-###`, AC refs) |
| Validate | AC must trace to Task/Brief — never invent at validation |
| Transfer | Handoff package references Artifact IDs |
| Supersede | Version lineage; no silent overwrite |

Storage: S3 for bytes; Postgres for metadata + acceptance_status.

---

## 8. Authentication

| Layer | Mechanism |
|---|---|
| Humans | OIDC (Auth.js in web + gateway validation) |
| Services | SPIFFE/SPIRE or mTLS service accounts (K8s); local: signed service JWTs |
| Principals | `TrustPrincipal` in `@umer/trust` — human, specialist-run, system |
| Sessions | `@umer/session` — interactive + HITL approval sessions |
| Impersonation | Forbidden except audited break-glass (Governance) |

Maps to Trust Runtime + Session & Human Collaboration Runtime. Security Department owns control *requirements*; Trust enforces.

---

## 9. API Gateway (`apps/api-gateway`)

| Responsibility | Out of scope |
|---|---|
| JWT/OIDC validation | Work decomposition |
| Route `/v1/*` → control-api | Model calls |
| Rate limit + tenancy header | Artifact business validation (delegates) |
| Request ID propagation | Direct DB access |

Public OpenAPI documents command/query surfaces; internal workers use Message Fabric, not the public gateway.

---

## 10. Event Bus (Message Fabric)

Single fabric, two planes (`Runtime/Domains/Message_Fabric.md`):

| Plane | Transport | Examples |
|---|---|---|
| **Command/Query** | NATS request-reply / JetStream work queues | `workpackage.dispatch`, `gate.evaluate` |
| **Event** | JetStream streams (durable) | `artifact.sealed`, `gate.passed`, `agent.run.completed` |

Event names follow Work Management §16 (`request.*`, `exec.*`, `workpackage.*`, `agent.run.*`, `artifact.*`, `gate.*`, `handoff.*`, …).

**No second Kafka “shadow bus” in V1.** If scale demands Kafka later, Message Fabric adapter swaps without changing domain APIs.

---

## 11. Queue architecture

| Queue / stream | Consumer | Purpose |
|---|---|---|
| `cmd.orchestration` | orchestration-worker | Stage transitions, WP create |
| `cmd.agent.dispatch` | agent-worker | Work Package runs |
| `cmd.extension` | extension-worker | Tool/plugin calls |
| `cmd.control.gates` | control-plane within control-api/worker | Approval waits |
| `evt.runtime.>` | observability, audit-sink, projections | Fan-out |
| `evt.audit.>` | audit-sink only | Tamper-evident |

Ack semantics: at-least-once + idempotent handlers (WP attempt IDs). Resilience Runtime owns retry/backoff/dead-letter.

---

## 12. Database architecture

**PostgreSQL** as system of record for mechanical + work state.

### Schema domains (logical)

| Schema | Contents |
|---|---|
| `exec` | requests, exec_instances, stages, gates, handoffs, context_packages |
| `work` | projects, milestones, epics, sprints, tasks, work_packages, dependencies, blockers |
| `registry` | skills, tools, plugins, capability_bindings, specialist_registrations |
| `artifact` | artifacts metadata, acceptance, lineage |
| `trust` | principals, grants, allowlists |
| `session` | human sessions, HITL approval records |
| `memory` | memory documents, chunks, embeddings (pgvector) |
| `economy` | quotas, budgets, cost_ledger |
| `audit` | optional hot index; cold in append log/object store |
| `obs` | not primary — metrics elsewhere |

**Initiative / Business Case** rows may live in `biz` schema as references to Architecture-defined IDs — Business remains value owner; DB does not invent funding rules.

ORM: Drizzle. Migrations: expand-contract. Every row carries `tenant_id` for multi-tenant readiness.

---

## 13. Vector database

**V1:** `pgvector` on Postgres `memory.chunks.embedding`.

| Why | Tradeoff |
|---|---|
| One backup/ops plane | Scale ceiling lower than dedicated vector DB |
| Enough for org memory retrieval | Revisit Qdrant/Weaviate when Intelligence corpus demands |

`@umer/memory-access` hides the engine behind `VectorStore` interface so Architecture Memory contracts stay stable.

---

## 14. Storage

| Store | Use |
|---|---|
| Postgres | Relational SoR |
| Redis | Session cache, rate limits, short locks |
| S3/MinIO | Artifact bytes, audit segments, large memory blobs |
| Git (repo) | Architecture V1 docs + Specialist Spec files (source); Registry stores **registered versions** |

Artifacts never rely on chat history as storage.

---

## 15. Observability

`@umer/observability` = Runtime Observability domain.

| Signal | Backend |
|---|---|
| Traces | OTel → Tempo/Jaeger |
| Metrics | OTel → Prometheus |
| Platform health dashboards | Grafana |

Correlate: `request_id`, `exec_id`, `work_package_id`, `agent_run_id`, `artifact_id`.

**Not** Engineering product observability and **not** Analytics measurement plane — those stay Department concerns.

---

## 16. Logging

Logs are a **signal class under Observability** (Architecture merge decision) — not a separate domain package.

| Rule | Detail |
|---|---|
| Structured JSON | Pino |
| Redaction | Trust policies (secrets, PII) |
| Levels | fatal/error/warn/info/debug |
| Audit ≠ log | Security-relevant facts also emit Audit events |

Ship to Loki (or cloud equivalent) via OTel logs bridge.

---

## 17. Configuration

Kernel concern (`@umer/config` + Runtime Kernel).

| Layer | Source |
|---|---|
| Build | `turbo` / env per app |
| Deploy | K8s ConfigMap/Secret / Doppler/SOPS |
| Runtime flags | DB-backed flags with audit on change |
| Model routes | Registry + Model Routing config — not Specialist files |

No “config microservice.” Validation at boot; fail closed on missing required secrets.

---

## 18. Plugin SDK (`@umer/plugin-sdk`)

Implements Extension Runtime plugin contract.

| Plugin manifest | Fields |
|---|---|
| `id`, `version` | Registry identity |
| `permissions` | Egress, secrets scopes |
| `skills[]` | Callable units |
| `hooks` | Optional pre/post tool |

Host loads plugins in `extension-worker` only. Agent Runtime never opens raw network — tools go through Extension + Trust allowlist.

---

## 19. Deployment architecture

```text
Internet → Ingress/API Gateway → control-api / web
                ↓
         Message Fabric (NATS)
                ↓
    orchestration-worker → agent-worker → extension-worker
                ↓
         Postgres · Redis · MinIO
                ↓
         audit-sink (isolated SA)
```

Environments: `local` · `dev` · `staging` · `prod`.  
Tenancy: single-tenant V1 OK; schemas already tenant-scoped.

---

## 20. Docker

`infra/docker/`:

| Image | Context |
|---|---|
| `umer-web` | apps/web |
| `umer-gateway` | apps/api-gateway |
| `umer-control-api` | apps/control-api |
| `umer-orchestration` | apps/orchestration-worker |
| `umer-agent` | apps/agent-worker |
| `umer-extension` | apps/extension-worker |
| `umer-audit` | apps/audit-sink |

`docker-compose.yml`: Postgres, Redis, NATS, MinIO, OTel collector, all apps. One command local OS.

---

## 21. Kubernetes readiness

`infra/k8s/charts/umer-ai-os/`:

| Resource | Notes |
|---|---|
| Deployments | One per app; HPA on agent/orchestration workers |
| Services | ClusterIP + Ingress |
| PDB / topologySpread | Worker resilience |
| NetworkPolicy | agent-worker egress deny-all except extension-worker |
| ServiceAccount + IRSA/Workload Identity | Cloud roles for S3 |
| Secrets via External Secrets Operator | |
| NATS / Postgres | Helm deps or managed cloud services |

Ready for K8s without requiring K8s for local V1.

---

## 22. CI/CD

GitHub Actions (or equivalent):

```text
PR → lint → typecheck → unit → contract tests → build images
main → migrate (staging) → deploy staging → e2e → promote prod (manual approval)
```

| Gate | Enforces |
|---|---|
| `contracts` package tests | Work Package / Artifact schema stability |
| No Architecture folder “logic” | CI check: apps/packages must not parse random Core/*.md except via specialist-sdk allowlist paths |
| Image scan | Trivy/Grype |
| SBOM | Attested on release |

RFC remains process for cross-layer **architecture** change; code RFCs are normal ADRs in Governance when needed.

---

## 23. Testing strategy

| Layer | What |
|---|---|
| Unit | Domain packages (mandate.bind, gate evaluator, AC trace) |
| Contract | Message schemas + OpenAPI + Artifact header fixtures |
| Integration | Testcontainers: Postgres, NATS, MinIO |
| E2E | Request → Project → Task → Work Package → Artifact → Gate |
| Chaos | Worker kill mid-WP; retry/idempotency (Resilience) |
| Spec conformance | Specialist fixtures must pass Activation checklist |
| Security | Trust allowlist bypass attempts must fail |

Forbid story-point theater metrics in CI — use Architecture KPI-aligned quality signals (gate pass, mandate violations).

---

## 24. Security architecture

Maps to Trust Runtime + Security Department requirements:

| Control | Implementation |
|---|---|
| Authn/z | OIDC + PEP in Trust/Control Plane |
| Sandbox | agent-worker: no egress; gVisor/Firecracker later; V1 process isolation + NetworkPolicy |
| Tool egress | extension-worker only |
| Secrets | Never in Specs; vault/K8s secrets |
| Audit | Immutable stream; separate sink credentials |
| HITL | Irreversible / spend / external — Session Runtime wait; non-auto-approvable |
| Supply chain | Lockfiles, image signing, plugin signature verify in Registry |

---

## 25. Scalability strategy

| Axis | V1 approach | Next |
|---|---|---|
| Agent throughput | HPA on agent-worker; WP queue partitions by tenant | Cell-based tenancy |
| Orchestration | Horizontal consumers; EXEC sticky by id hash | Sharded streams |
| DB | Single Postgres + read replicas | Partition `work`/`exec` by tenant |
| Artifacts | S3 scale-out | CDN for large reads |
| Models | Model Routing pools + Resource Economy quotas | Multi-provider failover |
| Memory search | pgvector | Dedicated vector store behind interface |
| Message Fabric | NATS cluster | Kafka adapter if needed |

Scale **workers**, not “one smarter monolith Agent.”

---

## 26. Local development workflow

```bash
pnpm install
pnpm dev:infra     # compose: postgres redis nats minio otel
pnpm db:migrate
pnpm db:seed       # demo Project/Epic/Task + one Engineering Specialist registration
pnpm dev           # turbo: web + gateway + control-api + workers
```

| Step | Result |
|---|---|
| Open web UI | Login (local OIDC mock or Dev user) |
| Create Request | Request Lifecycle |
| Plan Epic/Task | Work Management |
| Run | Orchestration emits Work Package → agent-worker |
| Approve gate | HITL in Session UI |
| Inspect | Grafana + audit view |

**Seed data** references Architecture Capability IDs and Department Eng — does not invent new Departments.

---

## Mapping: Architecture V1 → Code

| Architecture | Code |
|---|---|
| Execution work meaning | `control-api` + `work`/`exec` schemas + `@umer/contracts` |
| Work Package | `@umer/orchestration` + `agent-worker` |
| Specialist Standard | `@umer/specialist-sdk` + `specialists/` |
| 17 Runtime domains | 17 `@umer/*` packages |
| Message Fabric | `@umer/message-fabric` + NATS |
| Intelligence SoR | Content in DB/files; access only via `@umer/memory-access` |
| Business value | `biz` schema + UI; no self-approval paths |
| Governance policy | `infra/policies` + Control Plane PEP |
| EA Capability nouns | Registry Resolver bindings only |
| Departments | Org metadata + Specialist `department` field — not code folders per Dept service |

---

## V1 delivery slices (implementation order)

1. Monorepo skeleton + `@umer/contracts` + `@umer/db`  
2. Message Fabric + Kernel boot  
3. control-api: Request → Project → Task  
4. Orchestration + Work Package dispatch  
5. Agent Runtime + Specialist SDK (one Engineering Specialist)  
6. Artifacts + Gates + HITL Session  
7. Trust + Audit + Observability  
8. Memory Access + Model Routing + Extension  
9. Web UI hardening + K8s charts  

---

## Explicit non-goals (this blueprint)

- New enterprise architecture docs or nouns  
- New Departments or Specialist taxonomy changes  
- Prompt-centric OS  
- Runtime owning Business/Execution meaning  
- Microservices per Department  

---

## Metadata

```yaml
version: 1.0.0
kind: implementation_blueprint
architecture_baseline: V1
last_reviewed: 2026-07-22
```
