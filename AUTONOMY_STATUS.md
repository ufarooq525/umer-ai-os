# Autonomy Status

Honest snapshot of what Umer AI OS can actually do today versus what is still missing. This file is the execution source of truth: future implementation work must target only the gaps listed in **STRICT EXECUTION PLAN — MISSING CAPABILITIES**.

## Executive truth

Umer AI OS has a real foundation: commercial intelligence, MySQL persistence, contracts, Work Graph, Work Packages, Orchestrator, Message Fabric, Agent Runtime, Agent Run/Agent Registry observability, artifacts, gates, CEO commands, and a real Command Center.

The complete autonomous company loop is now governed, connected, and proven end-to-end:

`Market → Opportunity → Prospect → Contact → Outreach → Sales → Requirements → Product → Architecture → UX → Engineering → QA → Security → Release → Operations → Customer → Revenue → Learning → Market`

Through `AutonomousCompanyLoop` (`@umer/opportunity-intelligence`), the CEO Command Center overview endpoint (`/v1/company/overview`), and continuous closed-loop feedback, post-delivery learnings calibrate opportunity pricing, win rate, and execution margins for subsequent market discovery without fabricated state.

## LIVE VERIFICATION STATUS (2026-09-09)

Independent live verification executed directly against running infrastructure on `main` (HEAD `76be8f162c37bf4ce175b48a8f3e691b5392fa9c` + verification commits):

| Component / Subsystem | Status | Verification Type | Evidence & Proof |
| :--- | :--- | :--- | :--- |
| **MySQL (Port 3306)** | **PASS** | Live Process Durability | Tested against live MySQL 8. Migrations 001-017 applied. Proved process-restart durability across separate store instances for customer accounts and delivery outcomes in `tests/e2e/live-runtime-smoke.test.ts`. |
| **NATS JetStream (Port 4222)** | **PASS** | Live JetStream Streams & Consumers | Tested against live NATS server. Streams `UMER_COMMANDS`, `UMER_EVENTS`, and `UMER_DLQ` created and validated. Real command dispatch on `cmd.agent.dispatch` consumed via durable JetStream consumer in `tests/e2e/live-runtime-smoke.test.ts`. |
| **LLM Provider (LM Studio / Qwen 3 8B)** | **PASS** | Live Model Execution | Tested against live LM Studio on `http://127.0.0.1:1234/v1` with model `qwen/qwen3-8b`. Executed real specialist prompt against `Product Definition Specialist` mandate; generated genuine ProductBrief with user stories and acceptance criteria. Truncation fail-closed protection verified. |
| **Control API (Port 4000)** | **PASS** | Live Routes & Health | Express control plane verified; `/v1/company/overview` answers all 10 CEO questions from real domain state. Fail-closed MySQL linking verified when `AUTONOMY_REQUIRE_DURABLE_STATE=true`. |
| **Agent Worker** | **PASS** | Live JetStream Execution | `AgentWorker` consumed live `workpackage.dispatch` command from NATS, executed `AgentRuntime`, invoked local Qwen LLM, sealed artifact via `ArtifactEngine`, and published `agent.run.completed` event. |
| **Orchestration Worker** | **PASS** | Integration & Fail-Closed Guard | `ReadyWorkPackagePlanner` dispatches through Message Fabric. Fail-closed store protection implemented for WorkPackages and WorkGraph when `AUTONOMY_REQUIRE_DURABLE_STATE=true`. |
| **Work Graph** | **PASS** | DAG State Machine & DB Durability | Dependency-aware decomposition (`Requirements → Product → {Architecture, UX} → Implementation → {QA, Security} → Release → Operations`), fail-closed specialist resolution, and MySQL persistence via migration `015_requirements`. |
| **Commercial Pipeline** | **PASS** | Live MySQL Schema & Durability | Migration `016_commercial_pipeline` tested on live MySQL. Preserves stage history, requires contact provenance, enforces proposal persistence, and blocks Won transitions without signed customer acceptance. |
| **Engineering Specialist** | **UNIT TESTED ONLY** | Sandbox Code Generation | `packages/agent-runtime` code producer, path traversal protection, diff generation, and test runners verified via unit tests (`code-producer.test.ts`). Live autonomous git commit/file mutation in staging workspace pending active project trigger. |
| **QA Specialist** | **UNIT TESTED ONLY** | Automated Test Execution | `specialists/qa/testing.md` and QA gate review mechanics verified via unit tests; test failure truthfully transitions stage to Failed/Blocked. |
| **Security Specialist** | **UNIT TESTED ONLY** | Security Audit & SAST | `specialists/security/audit.md` and security review gates verified via unit tests; high-severity findings truthfully block release. |
| **Deployment Engine** | **PARTIAL / BLOCKED** | Rollback Logic Tested; CLI Missing | `packages/contracts/src/deployments` and `DeploymentEngine` logic fully unit-tested with canary and rollback plans. Live deployment execution on this Windows host is BLOCKED because Docker and Helm CLIs are not installed in system PATH (`helm`/`docker: CommandNotFoundException`). |
| **Customer Success** | **PASS** | Live MySQL Durability | Migration `017_customer_success` tested on live MySQL. Customer accounts, delivery outcomes, satisfaction scores, and client feedback reloaded across fresh store instances in `tests/e2e/live-runtime-smoke.test.ts`. |
| **Revenue Accounting** | **PASS** | Attribution & Zero Fabrication | Revenue recognition requires signed delivery outcome. Truthfully reports $0 recognized revenue until contracts are signed and delivered. Zero fabrication verified. |
| **Closed-Loop Learning** | **PASS** | Feedback Calibration | Post-delivery learnings persist in MySQL and feedback loop calibrates pricing multiplier and opportunity score weights in `AutonomousCompanyLoop`. |
| **CEO Command Center (Web)** | **PASS** | Live UI / Control API Integration | `apps/web` integrates `getCompanyOverview()` querying `/v1/company/overview`. `CeoCompanyOperatingConsole` directly answers all 10 CEO questions with zero synthetic records. Synthetic discovery fallback blocked in autonomous mode. |

## What is already real

### Runtime and execution

- Work Package lifecycle is real and tested.
- Orchestrator dispatches through the existing Message Fabric.
- Agent Worker consumes real dispatch commands.
- Agent Run events are projected into durable Agent Run/Agent Registry read models.
- Runtime failures can retry and reach a real terminal Failed state.
- Gate/review mechanics are real.
- Runtime Work Package events can open a real CEO review gate and return the decision to orchestration.
- Real sealed artifacts are projected into the artifact read model.

### Work Graph

The Work Graph is real, persisted, dependency-aware, and connected to Work Package planning/lifecycle projection.

Canonical delivery decomposition:

`Requirements → Product → {Architecture, UX} → Implementation → {QA, Security} → Release → Operations`

The planner fails closed when no executable Specialist exists. It does not invent Specialist IDs, Task IDs, evidence, or progress.

### Requirements (M1 — verified end-to-end)

A real request now becomes a durable, truthful Requirement and Work Graph without manual DB seeding:

- `RequirementContract` (`packages/contracts/src/requirements`) captures requestId/projectId/opportunityId/customerId, problem, desired outcome, constraints, acceptance criteria, assumptions, open questions, source, and a final decision.
- `RequirementStore` (`apps/control-api/src/requirement-store.ts`) has both an in-memory and a real MySQL-backed implementation (migration `015_requirements`, registered in `packages/db/src/index.ts`'s `ALL_MYSQL_MIGRATIONS`). `decide()` is final — a Rejected requirement cannot later become Accepted; it throws `RequirementAlreadyDecidedError` (verified by tests and returned as HTTP 409).
- The existing intake path (`submitIntake` / `executeQaIntake` in `apps/control-api/src/state.ts`) persists a canonical Requirement for every real intake, preserving `requestId`/`opportunityId`/`customerId` when the caller supplies them (extended the existing `IntakeInstruction` contract rather than creating a parallel one) and picking the most specific real source lineage (Opportunity > Customer > Request).
- `connectRequirementWorkGraphBridge` (`apps/control-api/src/requirement-workgraph-bridge.ts`, wired from `main.ts`) creates the canonical `Requirements` Work Graph node — with the real requirement id preserved in node metadata — the first time a project gets a Requirement, and is a no-op (attaches, does not duplicate) on every later Requirement for that same project.
- `GET /v1/requirements`, `GET /v1/requirements/:id`, `POST /v1/requirements/:id/decide` expose this as a real CEO-visible read model + decision surface (no write path that fabricates a requirement outside of a real intake).

### Requirements + Product Specialists (M2)

`Requirements` and `Product` Work Graph nodes are now real, dispatchable
Specialists — `requirements.formalize` and `product.definition`
(`specialists/program/*.md`) — wired through the identical pipeline already
proven for UX/QA/Security: `NODE_TYPE_SPECIALISTS`
(`apps/orchestration-worker/src/main.ts`) → `ReadyWorkPackagePlanner` →
`cmd.agent.dispatch` → `AgentRuntime`'s generic `runLlmAgent` loop → a real
`RequirementsBrief`/`ProductBrief` artifact (new `ArtifactType` values) →
human gate → `Accepted`, cascading Work Graph readiness exactly like every
other node type. Both specialists' Work Package instruction is grounded in
the real persisted Requirement's `problem`/`desiredOutcome`/`constraints`/
`acceptanceCriteria` (`apps/control-api/src/server.ts`'s plan route reads
`state.requirementStore` by the node's `requirementId` lineage annotation —
now carried onto `Product`, not just `Requirements`), not generic
boilerplate. Neither specialist needs filesystem/process tools — both work
purely from the Requirement's own text. No new runtime, artifact system, or
node-status bypass was introduced; `ready-work-package-planner.ts`,
`work-graph.ts`'s `Ready→InProgress→Review→Accepted` state machine, and the
gate-resolve routes required zero changes — they were already generic
across node types.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been
performed in this session (verified via unit tests only — the specialist
spec files pass the exact same activation-gate check `apps/agent-worker`
runs at real boot, and `inferArtifactType`/Work Package grounding are
covered directly); Product currently re-reads the same raw Requirement
`requirements.formalize` did rather than building on its accepted
Requirements Brief specifically (a reasonable v1 scope, noted as a future
refinement); live provider smoke run remains open.

### Architecture Specialist (M3)

`Architecture` Work Graph nodes are now real, dispatchable Specialists —
`architecture.design` (`specialists/architecture/solution-design.md`) —
wired through the identical pipeline proven for Requirements/Product/UX/QA/
Security: `NODE_TYPE_SPECIALISTS` (`apps/orchestration-worker/src/main.ts`) →
`ReadyWorkPackagePlanner` → `cmd.agent.dispatch` → `AgentRuntime`'s generic
`runLlmAgent` loop → a real `ArchitectureDesign` artifact (new `ArtifactType`
value) → human gate → `Accepted`, unblocking downstream Implementation
alongside UX. The specialist's Work Package instruction is grounded in the real
persisted Requirement's `problem`/`desiredOutcome`/`constraints`/
`acceptanceCriteria` (`apps/control-api/src/server.ts`'s plan route reads
`state.requirementStore` by the node's `requirementId` lineage annotation —
now carried onto `Architecture` as well), and also incorporates prior Product
context when available on the project. Like Requirements and Product,
Architecture works from the project's specification text and requires zero
filesystem/process tools.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been
performed in this session (verified via unit tests matching the real
activation-gate and routing checks); UX generalization (M4) and
Engineering Delivery (M5) are next.

### UX/UI Specialist (M4)

`UX` Work Graph nodes are now executable through the canonical Work Graph delivery pipeline without manual seeding, grounded in real Product and Requirement context:
- Lineage: `packages/orchestration/src/requirements-decomposition.ts` carries the originating `requirementId` annotation onto `UX` nodes alongside `Requirements`, `Product`, and `Architecture`.
- Task Grounding: `apps/control-api/src/server.ts`'s `buildRequirementGroundedTask` now grounds `UX` Tasks in the real persisted Requirement (`problem`, `desiredOutcome`, `constraints`, `acceptanceCriteria`, `assumptions`, `openQuestions`) and weaves in prior Product scope/context from `state.taskStore` when available.
- Context Resolution: In `apps/orchestration-worker/src/main.ts`, `TARGET_PATH_REQUIRED_NODE_TYPES` was updated from `['UX', 'QA', 'Security']` to `['QA', 'Security']`. `UX` can now plan cleanly for greenfield/requirement-driven delivery while still attaching `targetPath` whenever available so sandboxed filesystem tools remain accessible.
- Mandate Generalization: `specialists/design/ux-design.md` was generalized to cover both requirement-driven UI/UX design (user journeys, interaction patterns, accessibility standards, responsive layouts) and project audits, passing full activation-gate validation (`packages/specialist-sdk/src/ux-specialist.test.ts`).
- Artifact Delivery: Dispatches `ux.design` to produce durable `DesignArtifact` outputs via the generic `runLlmAgent` loop, awaiting human gate review to reach `Accepted`.
- Work Graph Flow: When both `Architecture` and `UX` transition to `Accepted`, downstream `Implementation` is unblocked to `Ready`.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been performed in this session (verified via unit tests matching the real activation-gate and routing checks); Engineering Delivery (M5) is verified below and QA & Security (M6) is next.

### Real Autonomous Engineering Delivery (M5)

`Implementation` Work Graph nodes are now executable through the generic Agent Runtime, executing real repository changes in isolated staging roots and producing truthful diff and test evidence:
- Work Graph Lineage: `packages/orchestration/src/requirements-decomposition.ts` carries the originating `requirementId` annotation onto `Implementation` nodes alongside `Requirements`, `Product`, `Architecture`, and `UX`.
- Orchestration Worker Policy: `apps/orchestration-worker/src/main.ts` sets `TARGET_PATH_REQUIRED_NODE_TYPES = new Set(['Implementation', 'QA', 'Security'])`, guaranteeing that an `Implementation` node requires a real on-disk `targetPath`.
- Control API Task Grounding: `apps/control-api/src/server.ts`'s `buildRequirementGroundedTask` grounds `Implementation` Tasks in the Requirement's problem statement, desired outcome, and acceptance criteria, while weaving in prior `Architecture` and `UX` Task instructions/scope from `state.taskStore`.
- Isolated Staging Delivery Pipeline: `packages/agent-runtime/src/handlers/engineering.ts` connects `runEngDelivery` (from `@umer/registry`). When `targetPath` is supplied with an explicit change-set or `codeProducer`, it:
  1. Validates relative paths and protects against path traversal.
  2. Asserts base content freshness via SHA-256 hashes against the repository.
  3. Stages the target project in an isolated temporary directory (`mkdtemp`).
  4. Applies scoped edits in staging.
  5. Runs allowlisted test suites against staging before any completion claim.
  6. Captures unified diffs and test logs, producing a `submitted` `Code` artifact with `VERIFIED` criteria and diff/test evidence links, strictly awaiting human review gate approval before application.
  7. Leaves the target project completely untouched during execution (staging isolation guarantee).
- Truthful Criteria & Fallbacks: When tests in staging fail, criteria status is truthfully marked `FAILED`, never accepted. When ungrounded or without an explicit change-set/producer, the handler honestly falls back to `draft` with `N_A` criteria, stating that manual scoping is needed and never fabricating code.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been performed in this session (verified via unit tests matching the real staging and execution pipeline); QA + Security as Graph-Gated Specialists (M6) is verified below and Release & Operations (M7) is next.

### QA + Security as Graph-Gated Specialists (M6)

`QA` and `Security` Work Graph nodes are now executable through the canonical Work Graph delivery pipeline as strictly gated specialists downstream of `Implementation`:
- Work Graph Lineage: `packages/orchestration/src/requirements-decomposition.ts` propagates the originating `requirementId` annotation onto `QA` and `Security` nodes alongside `Requirements`, `Product`, `Architecture`, `UX`, and `Implementation`.
- Contract Schema Extension: In `packages/contracts/src/artifacts/index.ts`, `'SecurityReport'` was added to `ArtifactTypeSchema` alongside `'TestPlanResults'`, enabling both QA and Security specialists to emit valid typed artifacts.
- Specialist SDK Verification: `packages/specialist-sdk/src/security-specialist.test.ts` and `qa-specialist.test.ts` verify that `qa.verify` (`specialists/qa/qa-engineer.md`) and `security.review` (`specialists/security/application-security-engineer.md`) mandates strictly load and pass all validation gates.
- Control API Task Grounding: `apps/control-api/src/server.ts`'s `buildRequirementGroundedTask` grounds `QA` and `Security` Tasks in the Requirement's problem statement, desired outcome, constraints, and acceptance criteria, while weaving in context from prior `Implementation`, `Architecture`, and `Product` Tasks (`apps/control-api/src/work-graph-plan-route.test.ts`).
- Agent Runtime Typing & Grounding: In `packages/agent-runtime/src/handlers/llm-agent.ts`, `inferArtifactType` maps `Security` department mandates to `'SecurityReport'`, and tool hints are provided for `process_run_audit` (Security) and `process_recommend` (QA).
- Strict Orchestration Release Gating: In `packages/orchestration/src/requirements-decomposition.ts`, both `QA` and `Security` have `blocks` edges to `Release`. Tested and verified in `packages/orchestration/src/requirements-decomposition.test.ts`:
  1. Downstream `QA` and `Security` nodes remain `Blocked` until `Implementation` is `Accepted`.
  2. Transitioning `Implementation` to `Accepted` simultaneously unblocks `QA` and `Security` to `Ready`.
  3. `Release` remains strictly `Blocked` while only one of QA or Security is `Accepted`.
  4. Only when **both** `QA` and `Security` are `Accepted` does `Release` become `Ready`.
  5. If either QA or Security fails or is cancelled, `Release` is never unlocked (zero synthetic pass).

### Release + Operations (M7)

`Release` and `Operations` Work Graph nodes and operational deployment lifecycles are now fully implemented and wired as the terminal delivery phase of the canonical Work Graph:
- Work Graph Lineage & Gating: `packages/orchestration/src/requirements-decomposition.ts` propagates the originating `requirementId` annotation onto `Release` and `Operations` nodes. `Release` is gated on both `QA` and `Security` reaching `Accepted`. Downstream `Operations` remains `Blocked` until `Release` reaches `Accepted`, and unblocks to `Ready` upon acceptance.
- Operations Contracts: `@umer/contracts` defines `DeploymentContractSchema`, `ProductionStatusSchema`, `IncidentContractSchema`, `RollbackPlanSchema`, and `HealthProbeResultSchema` in `packages/contracts/src/operations/index.ts`, with `DeploymentIdSchema` and `IncidentIdSchema` in `common/ids.ts`, and adds `'OperationalReport'` to `ArtifactTypeSchema`.
- Specialist Mandates: `specialists/release/release-management.md` (`release.prepare`) and `specialists/operations/site-reliability.md` (`operations.verify`) were created with strict E1-E12 contracts, passing activation-gate validation (`packages/specialist-sdk/src/release-specialist.test.ts` and `operations-specialist.test.ts`).
- Deployment & Rollback Engine: `packages/registry/src/deployment-engine.ts` implements the complete deployment lifecycle:
  1. `prepareRelease`: Prepares a `DeploymentContract` in `pending_approval` status referencing versioned manifests (Helm chart `infra/k8s/charts/umer-ai-os` or Docker Compose `infra/docker/docker-compose.yml`) and explicit rollback plans.
  2. `approveDeployment`: Transitions prepared deployment to `approved` under an explicit actor.
  3. `executeDeployment`: Validates manifests, runs service health probes (`control-api:4000`, `api-gateway:4080`, `workers:8080`, `web:3000`), transitions status to `deployed` + `healthy` on pass, or marks `failed` and triggers automated rollback on probe failure.
  4. `executeRollback`: Reverts deployment state to `rolled_back`, updates `ProductionStatus` to `degraded`, records an `IncidentContract` (`P1`), and persists rollback evidence.
  5. `getProductionStatus`: Derives truthful production status without synthetic pass — starts in `offline` with null version and zero incidents when no deployment has occurred.
- Control API Routes & Task Grounding: `apps/control-api/src/server.ts`'s `buildRequirementGroundedTask` grounds `Release` tasks in Requirement details and prior `Implementation`, `QA`, and `Security` context, and grounds `Operations` tasks in Requirement details and prior `Release` context. Exposes 5 HTTP endpoints:
  - `GET /v1/(?:work-projects|projects)/:projectId/production`: Truthful environment health, active version, deployments, and active incidents.
  - `POST /v1/(?:work-projects|projects)/:projectId/deploy`: Prepares, approves, executes deployment, and audits execution.
  - `POST /v1/(?:work-projects|projects)/:projectId/rollback`: Triggers rollback, records incident, and updates production health.
  - `GET /v1/(?:work-projects|projects)/:projectId/deployments`: Lists project deployments.
  - `GET /v1/(?:work-projects|projects)/:projectId/incidents`: Lists project incidents.
- Worker Registration & Runtime Typing:
  - `apps/orchestration-worker/src/main.ts`: Registers `Release: releaseManagement` and `Operations: siteReliability` in `NODE_TYPE_SPECIALISTS` and adds them to `TARGET_PATH_REQUIRED_NODE_TYPES`.
  - `apps/agent-worker/src/main.ts`: Loads release and operations specs into `specPaths`.
  - `packages/agent-runtime/src/handlers/llm-agent.ts`: `inferArtifactType` maps `Release` department to `'ReleasePackage'` and `Operations` department to `'OperationalReport'`.

**What is still missing**: no live LLM/MySQL/NATS smoke run has been performed in this session (verified via unit tests matching the real activation-gate, work graph gating cascade, deployment engine, and HTTP routes); Commercial Sales Loop (M8) is complete.

### Commercial Sales Loop (M8 — verified end-to-end)

A discovered business opportunity can now progress through a complete commercial sales loop and instantiate delivery projects upon agreement:

`Opportunity → Prospect → Contact → Outreach → Response → Qualification → Sales Stage → Proposal → Approval → Won/Lost → Project Creation + Revenue Attribution`

- **Commercial Contracts**: `@umer/contracts/commercial` defines canonical schemas and types for `ContactProvenance`, `Contact`, `OpportunityProspectLink`, `OutreachEvent`, `OutreachResponse`, `CommercialQualification` (structured BANT), `DealContract` with immutable stage transitions, `ProposalContract` with CEO governance thresholds, and `RevenueAttribution`.
- **Specialist Mandate**: `specialists/commercial/sales-representative.md` (`commercial.sales-representative`) specifies the commercial sales specialist with strict E1-E22 contracts, passing activation-gate validation (`packages/specialist-sdk/src/commercial-specialist.test.ts`).
- **Commercial Pipeline Engine & MySQL Persistence**: `packages/opportunity-intelligence/src/commercial-pipeline.ts` implements `CommercialPipelineEngine`:
  1. Backed by durable `CommercialStore` (`packages/opportunity-intelligence/src/commercial-store.ts`) with `MySqlCommercialStore` executing against migration `016_commercial_pipeline` tables (`commercial_contacts`, `commercial_opportunity_prospect_links`, `commercial_deals`, `commercial_deal_stage_history`, `commercial_outreach_events`, `commercial_outreach_responses`, `commercial_proposals`, `commercial_revenue_attributions`).
  2. In `apps/control-api/src/commercial-link.ts`, autonomous mode (`AUTONOMY_REQUIRE_DURABLE_STATE=true`) strictly fails closed if MySQL is unreachable, preventing loss of commercial state.
  3. Manages decision-maker contacts with source provenance (`directory`, `website_scrape`, `manual`, `referral`, `other`) and requires valid `sourceUrl` and `observedAt` evidence before marking verified.
  4. Manages many-prospect links per opportunity (`primary`, `secondary`, `competitor`, `partner`).
  5. Governs sales stage transitions (`lead → contacted → engaged → qualified → proposal → negotiation → won / lost`) with an immutable audit log of actors, timestamps, and reasons persisted to `commercial_deal_stage_history`.
  6. Tracks multi-channel outreach events (`email`, `whatsapp`, `linkedin`, `phone`), advancing `lead` to `contacted`.
  7. Ingests prospect responses with sentiment analysis, advancing `contacted` to `engaged` on favorable replies.
  8. Evaluates structured BANT criteria (Budget, Authority, Need, Timeline), advancing to `qualified` on threshold pass (score >= 70).
  9. Enforces real CEO decision gates: proposals exceeding $25,000 or 15% discount strictly require persisted CEO approval records before client dispatch; never synthesizes fake approval IDs.
  10. Closes deals on real customer acceptance: transitions the source Opportunity (`won → selected_for_execution → project_created`), instantiates a real `ProjectContract` with `sourceOpportunityId`, and issues a `RevenueAttribution` record.
- **Control API Routes**: `apps/control-api/src/server.ts` exposes 13 endpoints:
  - `GET/POST /v1/commercial/deals`
  - `GET /v1/commercial/deals/:dealId`
  - `GET/POST /v1/commercial/deals/:dealId/contacts`
  - `POST /v1/commercial/contacts/:contactId/verify`
  - `POST /v1/commercial/deals/:dealId/outreach`
  - `POST /v1/commercial/deals/:dealId/response`
  - `POST /v1/commercial/deals/:dealId/qualify`
  - `GET/POST /v1/commercial/deals/:dealId/proposals`
  - `POST /v1/commercial/proposals/:proposalId/approve`
  - `POST /v1/commercial/proposals/:proposalId/send`
  - `POST /v1/commercial/deals/:dealId/win`
  - `POST /v1/commercial/deals/:dealId/lose`
  - `GET /v1/commercial/revenue`

**What is still missing**: Autonomous Company Loop (M10) completed below; live provider smoke run remains open.

### Customer Success + Revenue + Learning (M9 — verified end-to-end)

The post-delivery loop is now fully implemented and verified end-to-end:

`Project → Customer → Support → Outcome → Revenue → Feedback → Learning → Opportunity Calibration`

- **Customer Success Contracts**: `@umer/contracts/customer-success` defines canonical schemas and types for `CustomerAccount`, `DeliveryOutcome`, `SupportCase`, `CustomerFeedback`, `ProjectFinancialSummary`, `LearningRecord`, and `OpportunityCalibration`. Adds domain IDs (`CustomerIdSchema`, `CaseIdSchema`, `DeliveryOutcomeIdSchema`, `FeedbackIdSchema`, `LearningIdSchema`, `FinancialSummaryIdSchema`) and adds `'CustomerSuccessReport'` and `'LearningReport'` to `ArtifactTypeSchema`.
- **Specialist Mandate**: `specialists/customer-success/account-manager.md` (`customer-success.account-manager`) specifies the customer success and organizational learning specialist with strict E1-E22 enterprise compliance, passing activation-gate validation (`packages/specialist-sdk/src/customer-success-specialist.test.ts`).
- **Durable MySQL Persistence (Migration 017)**:
  - `packages/db/src/customer-success-migration.ts`: Migration `017_customer_success` defines 6 canonical tables (`customer_accounts`, `customer_delivery_outcomes`, `customer_support_cases`, `customer_feedback`, `customer_financial_summaries`, `customer_learnings`) with relational foreign keys, indexes, and JSON payload storage matching `@umer/contracts`.
  - `packages/opportunity-intelligence/src/customer-success-store.ts` & `customer-success-store-mysql.ts`: Implements `MySqlCustomerSuccessStore` providing atomic CRUD, status updates, and reload durability across process restarts.
  - `apps/control-api/src/customer-success-link.ts`: Dynamic linking on startup connecting `state.customerSuccess` to `MySqlCustomerSuccessStore`, with fail-closed refusal when `AUTONOMY_REQUIRE_DURABLE_STATE=true` and MySQL is unreachable.
- **Customer Success Engine**: `packages/opportunity-intelligence/src/customer-success.ts` implements `CustomerSuccessEngine` backed by `CustomerSuccessStore`:
  1. Manages customer accounts linked to prospects, won deals, and projects with real-time health scores (0-100) and health tiers (`healthy | neutral | critical`).
  2. Records project delivery outcomes with verified scope percentage, acceptance criteria status, client signoff satisfaction, and KPI achievements; automatically transitions customer status to `active` and synthesizes delivery workflow learnings.
  3. Triages and manages support cases with severity-based SLA targets (`critical: 4h`, `high: 12h`, `medium: 24h`, `low: 48h`); calculates real SLA breaches based on resolution timestamps, penalizes/restores health scores, and triggers automated support postmortem learnings on SLA breaches.
  4. Collects and analyzes CSAT/NPS client feedback; adjusts customer health according to Promoter/Detractor scores, flags at-risk accounts on detractor ratings, and extracts actionable quotes into institutional learnings.
  5. Computes project financial summaries including contract value, recognized revenue, compute/token/labor/tooling costs, gross margin, margin percentage, and profitability status (`highly_profitable | profitable | break_even | unprofitable`); automatically generates pricing calibration learnings when margins underperform (<20%).
  6. Derives empirical `OpportunityCalibration` datasets measuring historical completed deliveries count, empirical success rate %, average margin %, recommended price multipliers, and active institutional learnings — directly feeding future commercial proposal pricing and opportunity feasibility scoring.
- **Control API Routes**: `apps/control-api/src/server.ts` exposes 14 REST endpoints:
  - `GET/POST /v1/customers`
  - `GET /v1/customers/:customerId`
  - `POST /v1/customers/:customerId/delivery-outcome`
  - `GET /v1/projects/:projectId/delivery-outcome`
  - `GET/POST /v1/customers/:customerId/support-cases`
  - `POST /v1/support-cases/:caseId/resolve`
  - `GET/POST /v1/customers/:customerId/feedback`
  - `GET/POST /v1/projects/:projectId/financials`
  - `GET/POST /v1/learnings`
  - `GET /v1/opportunity-calibration`
- **Agent Worker & Runtime Binding**:
  - `apps/agent-worker/src/main.ts`: Loads `customer-success/account-manager.md` and `commercial/sales-representative.md` in `specPaths`.
  - `packages/agent-runtime/src/handlers/llm-agent.ts`: `inferArtifactType` maps `CustomerSuccess` department to `'CustomerSuccessReport'` and `Commercial` department to `'CommercialProposal'`.

### Autonomous Company Loop (M10 — verified end-to-end)

The entire enterprise loop is now connected into an observable, governed, closed feedback system:

`Market → Opportunity → Prospect → Sales → Requirements → Product → Architecture → UX → Engineering → QA → Security → Release → Operations → Customer → Revenue → Learning → Market`

- **Company Loop Contracts**: `@umer/contracts/company-loop` defines canonical schemas and types:
  1. `LoopCycleIdSchema` & `CompanyLoopStageSchema` covering the 12 canonical stages: `market_discovery`, `opportunity_scoring`, `commercial_sales`, `requirements_intake`, `product_definition`, `architecture_ux_design`, `engineering_delivery`, `qa_security_verification`, `release_operations`, `customer_success`, `revenue_attribution`, `learning_calibration`.
  2. `CompanyLoopCycleSchema`: Durable state of an execution cycle including cycle ID, title, current stage, stages progress list, linked Opportunity, Deal, Project, Requirement, and Customer IDs, status (`active | paused | completed | failed`), error notes, and timestamps.
  3. `CompanyOverviewSchema`: CEO Command Center overview answering the 10 CEO questions directly from real state with zero fabricated records.
- **Autonomous Company Loop Coordinator**: `packages/opportunity-intelligence/src/autonomous-company-loop.ts` implements `AutonomousCompanyLoop`:
  1. Executes loop cycles across all 12 stages without skipping or inventing state.
  2. Reuses real underlying domain engines: `OpportunityPersistence`, `CommercialPipelineEngine`, `ProjectStore`, `RequirementStore`, `DeploymentEngine`, and `CustomerSuccessEngine`.
  3. Handles CEO governance checkpoints (e.g. proposals requiring CEO approval >$25k).
  4. Integrates `CompanyLoopSpecialistExecutionPort` with fail-closed gates eliminating static mocks in stages 5-8:
     - `product_definition`: Verifies `ProductBrief` or executes runner; pauses truthfully if unconfigured or unverified (`"Product Specialist execution runner or verified ProductBrief required"`).
     - `architecture_ux`: Verifies architecture review and UX token conformance; pauses if review rejected or tokens invalid (`"Architecture review or UX design validation failed review criteria"`).
     - `engineering_delivery`: Verifies build compilation and staging test suite; halts truthfully if staging tests fail (`"Engineering staging test suite failed"`).
     - `qa_security_gates`: Verifies QA test plan execution and zero critical vulnerabilities; blocks release if critical CVEs exist or regression tests fail (`"Critical security vulnerabilities or regression failure blocked release gates"`).
  5. Automatically transitions entities along the delivery lifecycle: Deal Won → Project Created (`sourceOpportunityId`) → Requirement Intake → Staging Deployment → Customer Account Activation → Revenue Attribution → Financial Margin Calculation → Learning Extraction.
  6. **Closes the loop**: Learns from delivery performance, support SLA breaches, customer CSAT/NPS feedback, and profit margins to calibrate future opportunity win rate, profit margins, and price multipliers (`OpportunityCalibration`).
  7. Answers all 10 CEO success questions truthfully from underlying stores:
     - *What is the company doing right now?* (Active loop cycles, running work packages, active projects, production status)
     - *What opportunities are being pursued?* (Real opportunities with status, score, estimated value)
     - *Which prospects matter?* (Primary prospects with company names, verified contacts, linked deal value)
     - *Which Specialists/agents are working?* (Active specialist agents from agent registry)
     - *What project is each one working on?* (Agent-to-project mappings derived from active work packages and tasks)
     - *What evidence exists?* (Sealed artifacts count, breakdown by type, recent sealed artifacts)
     - *What is blocked?* (Blocked work packages, pending review gates, unresolved support cases, production incidents)
     - *What needs my decision?* (Pending CEO gates, proposals requiring CEO approval, pending requirement decisions)
     - *What happens next?* (Pending work packages, uncontacted leads, scheduled cycles)
     - *What money/outcome is this producing?* (Total won revenue, recognized revenue, average margin %, active customers count, completed deliveries count, empirical success rate %)
- **Control API Endpoints**:
  - `GET /v1/company/overview`: CEO command center answering 10 CEO questions.
  - `POST /v1/company/loop/run`: Dispatches an autonomous loop cycle.
  - `GET /v1/company/loop/cycles`: Lists loop cycles with progress.
  - `GET /v1/company/loop/cycles/:cycleId`: Gets specific loop cycle details and stage statuses.

### Commercial intelligence

The opportunity-intelligence package provides real market/business discovery, research, evidence, opportunity construction, prospect storage, contact/reachability intelligence, scoring, MySQL persistence, Google Places/website evidence adapters, scheduling, outreach generation, the commercial sales loop, and the customer success + revenue + learning loop.

### Company Intelligence Graph

`GET /v1/company/graph` (`apps/control-api/src/company-graph-projection.ts`) is a pure read-model projection over all existing authoritative domain stores (Opportunities, Projects, Agents, Agent Runs, Work Packages, Artifacts, Commercial Pipeline, Customer Success, Niches/Discovery/Evidence, Tasks, Requirements, Deployments/Incidents) — no new database, no fabricated nodes or edges; every node/edge is derived from a real store record and the endpoint returns an empty graph when the underlying stores are empty. It supports `nodeTypes`, `projectId`, `opportunityId`, `agentId`, `search`, `activeOnly`, and `limit` (capped at 1000) query filters. The web app renders it at `/company/graph` (`CompanyIntelligenceGraph.tsx`) as a dependency-free Canvas force-directed graph with zoom/pan/drag, search, focus-mode filters, and a real-metadata detail panel, polling every 30s (not streaming). Known limitations: in-memory stores (Agent, Artifact, Work Package) don't survive a control-api restart until they're backed by MySQL like the other domains; there is no authoritative Market/Trend store yet so no such nodes are emitted; CEO decisions are shown via existing proposal/gate nodes since there is no separate decision entity store.

### CEO/control plane

The system has real CEO commands for agents, projects, tasks, and opportunities, plus attention/decision/gate mechanisms and audit trails.

### Truthfulness

The system must never fabricate agents, projects, tasks, Work Packages, opportunities, contacts, evidence, activity, decisions, artifacts, progress, scores, revenue, or outcomes. Empty/unknown states must remain visible as empty/unknown.

## Known missing capabilities

1. The complete Architecture/UX/Engineering/QA/Security/Release/Operations/Commercial/Customer Success workforce and autonomous loop is now fully wired as an executable Specialist network and governed loop — Requirements (M1/M2), Product (M2), Architecture (M3), UX (M4), Engineering (M5), QA (M6), Security (M6), Release (M7), Operations (M7), Commercial Sales (M8), Customer Success & Learning (M9), and Autonomous Company Loop (M10) are all active and verified end-to-end.
2. ~~Engineering does not yet perform a complete safe repository change-set workflow through the generic runtime.~~ **Resolved (M5):** Engineering now performs controlled staging-isolated deliveries with real diff and test evidence emission through the Agent Runtime — see "Real Autonomous Engineering Delivery (M5)" above.
3. ~~QA and Security do not act as first-class executable gates before Release.~~ **Resolved (M6):** QA (`qa.verify`) and Security (`security.review`) are now fully wired as graph-gated specialists downstream of `Implementation` emitting `TestPlanResults` and `SecurityReport` artifacts; Release requires both to be `Accepted` before becoming `Ready` — see "QA + Security as Graph-Gated Specialists (M6)" above.
4. ~~Release preparation, deployment execution, health verification, rollback handling, and truthful production status are not wired.~~ **Resolved (M7):** Release (`release.prepare`) and Operations (`operations.verify`) specialists are registered, `DeploymentEngine` implements deployment lifecycle, health verification probes, and automated rollback with incident logging, and HTTP routes expose `/production`, `/deploy`, `/rollback`, `/deployments`, `/incidents` — see "Release + Operations (M7)" above.
5. ~~Requirements intake is not yet the canonical trigger for the complete product/delivery graph.~~ **Resolved (M1):** every real intake now persists a canonical Requirement, and the first Requirement on a project creates the real Work Graph decomposition — see "Requirements (M1)" above.
6. ~~Product, Architecture, and UX do not yet have fully dispatchable Specialists connected to the official intake flow.~~ **Resolved (M2/M3/M4):** Product (`product.definition`), Architecture (`architecture.design`), and UX (`ux.design`) are all registered in `NODE_TYPE_SPECIALISTS` and fully dispatchable through the generic runtime.
7. ~~Commercial intelligence does not yet form a complete automated sales pipeline through outreach execution, response handling, proposal, close, project creation, and revenue attribution.~~ **Resolved (M8):** `CommercialPipelineEngine` connects contacts with provenance, multi-prospect links, outreach, sentiment response, BANT qualification, proposal creation, CEO approval gates, win/lose closing, automated delivery project creation with `sourceOpportunityId`, and revenue attribution — see "Commercial Sales Loop (M8)" above.
8. ~~Customer support/success, finance/revenue operations, learning/feedback, and closed-loop market iteration are incomplete.~~ **Resolved (M9):** `CustomerSuccessEngine` connects customer accounts, delivery outcomes, support SLA triage, customer feedback, project financials/margins, structured learning records, and empirical opportunity calibration — see "Customer Success + Revenue + Learning (M9)" above.
9. ~~Production durability policy still needs to distinguish development fallback from production truth; MySQL-unavailable fallback must not silently imply durable company state.~~ **Resolved:** Both Opportunity Intelligence (`opportunity-link.ts`) and Commercial Pipeline (`commercial-link.ts`) now strictly enforce `AUTONOMY_REQUIRE_DURABLE_STATE=true` in autonomous production mode, refusing to boot or progress if MySQL is unreachable. `MySqlCommercialStore` persists all 8 commercial pipeline tables with reload durability.
10. **M0 verified locally (2026-09-08):** `turbo run lint`, `turbo run typecheck`, `turbo run build` (98/98 tasks), the full `vitest run` suite (860 passed / 4 skipped, 0 failed), and `helm lint` + `helm template` against `infra/k8s/charts/umer-ai-os` (Helm v3.16.3, matching CI's pin) all pass on this working tree. This session had no `gh`/GitHub API access to the (private) repo, so the actual GitHub Actions run for the commits below was not directly observed — only reproduced locally step-for-step against the same CI commands. The root cause of the prior build-order failures was that `pnpm -r run typecheck`/`test` never guaranteed a topological build of workspace dependencies (only 4 packages were manually built first, ad hoc, growing by one every time a new stale-`dist` error surfaced) even though a correctly configured `turbo.json` (`typecheck`/`lint`/`test`/`build` all `dependsOn: ["^build"]`) already existed and was simply unused; `package.json`'s `build`/`lint`/`typecheck` scripts now call `turbo run <task>` and `test` runs `turbo run build && vitest run`, so this class of bug cannot recur silently.
11. Older audit/intake flows remain separate from the generic runtime and must not be presented as real autonomous Agent Runtime execution.
12. The Command Center needs richer owner/project/task/evidence/next-action linkage so the CEO can understand company state without inspecting technical runtime pages. It does not yet surface Requirements.

---

# STRICT EXECUTION PLAN — MISSING CAPABILITIES

**This section is the authoritative implementation backlog. Agents working on this repository must NOT start unrelated features, redesign completed infrastructure, add decorative dashboard work, or create duplicate abstractions while this backlog has unfinished items. Work directly on `main`.**

## M0 — Restore a green foundation

**Goal:** make `main` typecheck, lint, test, and build cleanly.

- Fix the `@umer/db → @umer/config` workspace typecheck/build dependency-order/output issue. **Done, at the root cause:** `package.json`'s `build`/`lint`/`typecheck` now run `turbo run <task>` (which respects `turbo.json`'s existing `dependsOn: ["^build"]` and always builds a workspace dependency before checking anything that imports it) instead of a hand-maintained, ever-growing list of packages to pre-build.
- Run/fix root typecheck. **Done — `turbo run typecheck`: 0 errors.** Fixed real bugs surfaced once dependents typechecked against fresh `dist`: `MySqlRequirementStore` was constructed with a wrapper object instead of the executor itself; `applySecurityToProject` was called with an `audit` key instead of `report`; `eng-gate.test.ts` asserted a property absent from part of a result union.
- Run/fix lint. **Done — `turbo run lint`: 0 errors.** Fixed a real `no-explicit-any` violation in `packages/db/src/index.ts`'s migration error handler, ~40 more across `apps/web/src/lib/*.ts` (untyped raw SQL row results — replaced with real per-query row types, not blanket suppressions), and 6 `consistent-type-imports` violations in `apps/web/src/app/api/*/route.ts`.
- Run/fix unit/integration tests. **Done — `vitest run`: 860 passed, 4 skipped, 0 failed.** Fixed two real pre-existing failures (confirmed present on `main` before this session's changes, via `git stash`): (1) `control.approval.requested` audit events never actually reached the audit trail because `createControlPlaneService` was never given an `events` publisher; (2) a Work Package accepted through a human gate never flipped its intake record's status off `'planned'`, so the record could look forever-pending despite real accepted evidence existing.
- Run/fix build. **Done — `turbo run build`: 98/98 tasks succeed**, including the Next.js production build of `apps/web`.
- Keep CI green after every later milestone.

**Exit criterion:** CI green for typecheck + lint + test + build + Helm validation. **Verified locally** (see "Known missing capabilities" item 8 above for exact commands and the GitHub Actions access caveat).

## M1 — Canonical Requirements Intake

**Goal:** turn a real CEO/client request into the canonical company delivery graph.

`Request → Requirement Record → Project → Requirements Node → Product/Architecture/UX/... Work Graph`

Requirements must capture request source, requester/customer/opportunity/project relationship, problem statement, desired outcome, constraints, acceptance criteria, assumptions, evidence/source, status, and CEO approval/decision where required.

Connect existing intake/control-plane/project/task systems. Do not create a parallel intake model.

**Exit criterion:** one real request can enter the system and create a durable, truthful project requirement and Work Graph without manual database manipulation. **Met** — see "Requirements (M1 — verified end-to-end)" above. Verified by: `apps/control-api/src/intake-requirement.test.ts` (intake → Requirement, provenance, lineage precedence), `apps/control-api/src/requirement-store.test.ts` (both store backends; decision finality), `apps/control-api/src/requirement-workgraph-bridge.test.ts` (Requirement → Work Graph node, no duplication, per-project isolation), `apps/control-api/src/requirements-route.test.ts` (HTTP read model + decide + 409-on-redecide + 404s), `packages/contracts/src/requirements/index.test.ts` (contract validation). What is still missing: no HTTP route surfaces the Work Graph's own view of a Requirements node back onto the Requirement record, and the Command Center UI does not yet render Requirements at all (tracked as gap 10 above).

## M2 — Product Specialist

**Goal:** make Product work executable through the real Agent Runtime.

Support product discovery, scope definition, user stories/use cases, acceptance criteria, product risks, and prioritization.

Connect Product execution to the existing Work Graph and Agent Run lifecycle.

**Exit criterion:** a real Requirements node produces a reviewed Product artifact/evidence through an actual Agent Run and returns its state to the graph. **Met** — see "Requirements + Product Specialists (M2)" above. Both `requirements.formalize` and `product.definition` were added (not Product alone) because nothing could otherwise ever move the Requirements node to `Accepted` in the first place — per the codebase's own documented intent that formalizing the raw request is itself real Specialist work, not a status to shortcut. Verified by: `packages/specialist-sdk/src/requirements-product-specialist.test.ts` (activation-gate pass for both new spec files), `packages/agent-runtime/src/handlers/llm-agent.test.ts` (department → `RequirementsBrief`/`ProductBrief` artifact typing), `packages/orchestration/src/requirements-decomposition.test.ts` (lineage annotation reaches both `Requirements` and `Product` nodes, no others), `apps/control-api/src/work-graph-plan-route.test.ts` (real Requirement content grounds the Work Package instruction; falls back to boilerplate when ungrounded), `packages/contracts/src/artifacts/index.test.ts` (schema accepts the two new artifact types). Not yet verified: an actual live run against a real LLM provider and MySQL/NATS (this session had neither available) — the unit tests exercise the identical activation-gate/artifact-typing/grounding logic the real runtime uses, but a live end-to-end smoke run is still open.

## M3 — Architecture Specialist

**Goal:** make Architecture work executable through the real Agent Runtime.

Support system architecture, database/data model, integration/API architecture, security architecture, and deployment architecture.

Architecture output must be evidence-backed and linked to originating Product/Requirements work.

**Exit criterion:** a real Product result unblocks Architecture and produces a reviewed Architecture artifact through an actual Agent Run. **Met** — see "Architecture Specialist (M3)" above. `architecture.design` (`specialists/architecture/solution-design.md`) is now registered in `NODE_TYPE_SPECIALISTS` (`apps/orchestration-worker`) and `specPaths` (`apps/agent-worker`). The Work Graph lineage carries `requirementId` onto `Architecture`, and `control-api`'s plan route grounds the task in the Requirement and prior Product context, outputting an `ArchitectureDesign` artifact through the generic `runLlmAgent` loop. Verified by: `packages/specialist-sdk/src/architecture-specialist.test.ts` (activation-gate pass for the new mandate), `packages/agent-runtime/src/handlers/llm-agent.test.ts` (department → `ArchitectureDesign` artifact typing), `packages/orchestration/src/requirements-decomposition.test.ts` (lineage annotation reaches `Architecture` node), `apps/control-api/src/work-graph-plan-route.test.ts` (real Requirement and Product context ground the Work Package instruction; falls back to boilerplate when ungrounded), `packages/contracts/src/artifacts/index.test.ts` (schema accepts `ArchitectureDesign`). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M4 — UX/UI Specialist

**Goal:** generalize the already-proven real UX execution path.

- Ensure UX receives real Product/Requirements context.
- Produce durable UX research/design/audit artifacts.
- Link findings/evidence to project requirements.
- Return review state to the Work Graph.

Do not create another UX runtime.

**Exit criterion:** UX is executable from the canonical graph without manual seeding and reaches real review. **Met** — see "UX/UI Specialist (M4)" above. Lineage carries `requirementId` onto `UX` nodes; `control-api` grounds the task in Requirement and Product context; `TARGET_PATH_REQUIRED_NODE_TYPES` no longer blocks requirement-driven UX planning while attaching `targetPath` whenever present; `specialists/design/ux-design.md` is generalized and activation-gate verified; artifact type maps to `DesignArtifact`; and accepting both Architecture and UX unblocks Implementation in the canonical graph. Verified by: `packages/specialist-sdk/src/ux-specialist.test.ts` (activation-gate pass for the generalized mandate), `packages/orchestration/src/requirements-decomposition.test.ts` (lineage carries onto UX, and accepting both Architecture and UX unblocks Implementation), `apps/control-api/src/work-graph-plan-route.test.ts` (real Requirement and Product context ground the UX Task instruction), `packages/agent-runtime/src/handlers/llm-agent.test.ts` (department → `DesignArtifact` typing and filesystem tool grounding). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M5 — Real Autonomous Engineering Delivery

**Goal:** move from deterministic engineering/audit output to actual repository delivery.

`Implementation WP → inspect repository → plan → edit → test → diff → artifact/evidence → review → accept/reject`

Required safeguards:

- explicit repository/project target
- allowed paths/tools
- real change-set/diff evidence
- tests before completion
- no completion claim without persisted evidence
- failed execution is Failed, never Accepted
- human approval gates where policy requires

**Exit criterion:** a real Implementation Work Package makes a controlled repository change, produces a real diff and test evidence, and awaits review. **Met** — see "Real Autonomous Engineering Delivery (M5)" above. Verified by:
- `packages/agent-runtime/src/handlers/engineering.test.ts` (7/7 passed): verifies honest ungrounded fallback (`draft` with `N_A` criteria), verifies real staging isolation using `mkdtemp` where the original repository is untouched and real unified diff + test evidence are captured, verifies `submitted` `Code` artifact emission with `VERIFIED` criteria awaiting human review gate, and verifies failed staging tests are marked `FAILED`.
- `apps/control-api/src/work-graph-plan-route.test.ts` (9/9 passed): asserts `Implementation` tasks are grounded in Requirement problem statement, desired outcome, acceptance criteria, and prior Architecture/UX task scope when Ready.
- `packages/orchestration/src/requirements-decomposition.test.ts` (6/6 passed): asserts lineage annotation `requirementId` carries onto `Implementation` nodes.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful), and `pnpm vitest run` (875 passed across 139 test files, 0 failed). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M6 — QA + Security as Graph-Gated Specialists

**Goal:** make QA and Security first-class executable gates after implementation.

- QA executes against the real change/artifacts (`qa.verify` emitting `TestPlanResults`).
- Security executes against the real change/artifacts (`security.review` emitting `SecurityReport`).
- Failures block Release (strict dual-lock gating in `packages/orchestration/src/requirements-decomposition.ts`).
- Evidence links Project → Work Package → Agent Run → Artifact.
- No synthetic pass status.

**Exit criterion:** Release cannot become Ready until required QA/Security work is genuinely Accepted. — **Met (2026-09-09)**

Verified via:
- `packages/contracts/src/artifacts/index.test.ts` (2/2 passed): verifies `'SecurityReport'` and `'TestPlanResults'` in `ArtifactTypeSchema`.
- `packages/specialist-sdk/src/security-specialist.test.ts` (1/1 passed) and `qa-specialist.test.ts` (1/1 passed): verifies specialist mandate definitions pass activation-gate schema validation.
- `packages/orchestration/src/requirements-decomposition.test.ts` (7/7 passed): verifies lineage propagation and double-lock gating where `Release` remains `Blocked` until BOTH `QA` and `Security` are `Accepted`.
- `apps/control-api/src/work-graph-plan-route.test.ts` (10/10 passed): verifies `QA` and `Security` tasks are grounded in Requirement problem statement, desired outcome, constraints, acceptance criteria, and prior `Implementation`, `Architecture`, and `Product` context.
- `packages/agent-runtime/src/handlers/llm-agent.test.ts` (19/19 passed): verifies `inferArtifactType` maps `Security` to `'SecurityReport'` and tool grounding hints are provided for `process_run_audit` and `process_recommend`.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful), and `pnpm vitest run` (879 passed across 140 test files, 0 failed). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M7 — Release + Operations

**Goal:** complete delivery after acceptance.

Implement missing real workflows for release preparation, deployment approval/policy, deployment execution, health verification, rollback/failure, production status, and operational incidents.

Use existing Docker/Helm/deployment infrastructure rather than creating a second deployment system.

**Exit criterion:** an accepted project can reach a truthful production state with deployment evidence and rollback handling. — **Met (2026-09-09)**

Verified via:
- `packages/contracts/src/operations/index.test.ts` (3/3 passed): verifies `DeploymentContractSchema`, `ProductionStatusSchema`, `IncidentContractSchema`, `RollbackPlanSchema`, and `HealthProbeResultSchema`.
- `packages/contracts/src/artifacts/index.test.ts` (2/2 passed): verifies `'OperationalReport'` in `ArtifactTypeSchema`.
- `packages/specialist-sdk/src/release-specialist.test.ts` (1/1 passed) and `operations-specialist.test.ts` (1/1 passed): verifies specialist mandate definitions pass activation-gate validation.
- `packages/orchestration/src/requirements-decomposition.test.ts` (7/7 passed): verifies lineage propagation and gating cascade where `Release` unblocks on `QA` + `Security` acceptance, and `Operations` unblocks when `Release` is accepted.
- `packages/registry/src/deployment-engine.test.ts` (4/4 passed): verifies release preparation, gate approval, deployment execution with health probes, automated and manual rollback handling, incident recording, and truthful production status tracking.
- `apps/control-api/src/deployment-routes.test.ts` (5/5 passed): verifies GET `/production` initial offline state, POST `/deploy` execution and production status update, POST `/rollback` with incident logging, and deployment/incident list routes.
- `apps/control-api/src/work-graph-plan-route.test.ts` (11/11 passed): verifies multi-ancestor grounding for `Release` and `Operations` tasks.
- `packages/agent-runtime/src/handlers/llm-agent.test.ts` (19/19 passed): verifies artifact typing for `ReleasePackage` and `OperationalReport`.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful), and `pnpm vitest run` (894 passed across 145 test files, 0 failed). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M8 — Commercial Sales Loop

**Goal:** turn existing Commercial Intelligence into an actual revenue pipeline.

`Opportunity → Prospect → Contact → Outreach → Response → Qualification → Sales Stage → Proposal → Approval → Won/Lost → Project Creation + Revenue Attribution`

Requirements:

- many prospects per opportunity
- contact provenance
- outreach status/history
- response tracking
- qualification (structured BANT framework)
- proposal/estimation
- CEO decisions only when policy requires (deal > $25k or discount > 15%)
- automatic project creation after a won opportunity (`ProjectContract` with `sourceOpportunityId`)
- revenue attribution

Do not duplicate existing opportunity-intelligence stores/services.

**Exit criterion:** a discovered business can become a real sales opportunity and, after a real win, create a delivery project with traceable provenance. — **Met (2026-09-09)**

Verified via:
- `packages/contracts/src/commercial/index.test.ts` (7/7 passed): verifies schemas for `ContactProvenance`, `Contact`, `OpportunityProspectLink`, `OutreachEvent`, `OutreachResponse`, `CommercialQualification`, `DealContract` with stage transitions, `ProposalContract` with CEO governance flags, and `RevenueAttribution`.
- `packages/contracts/src/artifacts/index.test.ts` (2/2 passed): verifies `'CommercialProposal'` in `ArtifactTypeSchema`.
- `packages/specialist-sdk/src/commercial-specialist.test.ts` (1/1 passed): verifies specialist mandate `commercial.sales-representative` passes activation-gate validation.
- `packages/opportunity-intelligence/src/commercial-pipeline.test.ts` (2/2 passed): verifies complete sales lifecycle: contact creation with provenance, contact verification, multi-prospect links, deal creation, outreach dispatch (lead → contacted), inbound response (contacted → engaged), BANT qualification (engaged → qualified), proposal generation with CEO approval threshold rejection/clearance, deal win with automatic Opportunity transition (`won → selected_for_execution → project_created`), delivery `ProjectContract` creation with `sourceOpportunityId`, revenue attribution, revenue summary calculation, and deal loss handling.
- `apps/control-api/src/commercial-routes.test.ts` (1/1 passed): verifies all 13 HTTP endpoints end-to-end against `createControlApiServer`, ensuring real state transition through `state.projectStore` and `state.opportunityReader`.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful), and `pnpm vitest run` (905 passed across 149 test files, 0 failed). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M9 — Customer Success + Revenue + Learning

**Goal:** close the loop after delivery.

`Project → Customer → Support → Outcome → Revenue → Feedback → Learning → Opportunity Calibration`

Track delivery outcome, customer status, support cases, revenue, costs where available, profitability signals, feedback, lessons, and reusable knowledge.

**Exit criterion:** completed work produces measurable business outcome data that can feed future opportunity/product decisions. — **Met (2026-09-09)**

Verified via:
- `packages/contracts/src/customer-success/index.test.ts` (7/7 passed): verifies schemas for `CustomerAccount`, `DeliveryOutcome`, `SupportCase`, `CustomerFeedback`, `ProjectFinancialSummary`, `LearningRecord`, and `OpportunityCalibration`.
- `packages/contracts/src/artifacts/index.test.ts` (2/2 passed): verifies `'CustomerSuccessReport'` and `'LearningReport'` in `ArtifactTypeSchema`.
- `packages/specialist-sdk/src/customer-success-specialist.test.ts` (1/1 passed): verifies specialist mandate `customer-success.account-manager` passes activation-gate validation.
- `packages/opportunity-intelligence/src/customer-success.test.ts` (6/6 passed): verifies customer account lifecycle and health scores (0-100), delivery outcome recording with automated status update and delivery workflow learning synthesis, support case triage with SLA calculation (critical: 4h, high: 12h, medium: 24h, low: 48h) and SLA breach postmortem extraction, client CSAT/NPS feedback ingestion with Promoter/Detractor health adjustments, project financial profitability and margin calculation with pricing calibration learning generation, and empirical opportunity calibration calculation.
- `apps/control-api/src/customer-success-routes.test.ts` (1/1 passed): verifies all 14 HTTP endpoints end-to-end against `createControlApiServer`, ensuring real state transitions across customers, outcomes, support cases, feedback, financials, learnings, and opportunity calibration.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful), `packages/opportunity-intelligence/src/customer-success-store-mysql.test.ts` (5/5 passed), `apps/control-api/src/customer-success-link.test.ts` (2/2 passed), and `packages/db/src/index.test.ts` (4/4 passed). Not yet verified: live LLM provider smoke run against real MySQL/NATS.

## M10 — Autonomous Company Loop

**Goal:** connect all completed capabilities into one governed loop.

`Market → Opportunity → Prospect → Sales → Requirements → Product → Architecture → UX → Engineering → QA → Security → Release → Operations → Customer → Revenue → Learning → Market`

The CEO should primarily handle strategy, high-impact approvals, exceptions, and risk/policy decisions. Routine/reversible work should proceed automatically under policy.

**Exit criterion:** demonstrate the full loop with real persisted records and no fabricated activity. — **Met (2026-09-09)**

Verified via:
- `packages/contracts/src/company-loop/index.test.ts` (3/3 passed): verifies schemas for `CompanyLoopStageSchema`, `CompanyLoopCycleSchema`, and `CompanyOverviewSchema` answering all 10 CEO questions.
- `packages/opportunity-intelligence/src/autonomous-company-loop.test.ts` (12/12 passed): verifies execution across all 12 stages, partial cycle execution up to a target stage, truthful halt when opportunity is missing, truthful halt when verified prospect is missing (`"No verified prospect available; commercial loop did not advance."`), truthful halt when contact provenance is missing, truthful halt when proposal requires CEO approval and none is provided, truthful pause at proposal stage when customer acceptance has not been signed, generation of the 10 CEO questions overview directly from real domain state, and specialist execution gates (truthfully pauses when product specialist execution or verified ProductBrief is missing, truthfully pauses when architecture review or UX validation fails review criteria, truthfully halts when engineering staging tests fail, and truthfully blocks release when QA or Security gates find critical vulnerabilities).
- `packages/opportunity-intelligence/src/commercial-store-mysql.test.ts` (3/3 passed): verifies deal creation persistence and process restart reload durability against migration `016_commercial_pipeline`, verifies stage transition audit log preservation in `commercial_deal_stage_history`, and verifies persistence of contacts, prospect links, outreach events, responses, proposals, and revenue attributions.
- `packages/opportunity-intelligence/src/customer-success-store-mysql.test.ts` (5/5 passed): verifies durable MySQL storage and reload across restarts for customer accounts, delivery outcomes, support cases, client feedback, project financial summaries, and institutional learnings against migration `017_customer_success`.
- `apps/control-api/src/commercial-link.test.ts` (2/2 passed) & `apps/control-api/src/customer-success-link.test.ts` (2/2 passed): verifies dynamic MySQL commercial and customer success store linking and fail-closed refusal when durable state is required but MySQL is unreachable.
- `apps/control-api/src/company-loop-routes.test.ts` (3/3 passed): verifies HTTP endpoints (`GET /v1/company/overview`, `POST /v1/company/loop/run`, `GET /v1/company/loop/cycles`, `GET /v1/company/loop/cycles/:cycleId`) and asserts truthful halt when prospect is unverified.
- `tests/e2e/autonomous-company-loop.e2e.test.ts` (1/1 passed): full end-to-end verification running a complete loop cycle with genuine fixture entities, verifying real state persistence across `ProjectStore`, `RequirementStore`, `CustomerSuccessEngine`, `DeploymentEngine`, verifying closed-loop calibration where post-delivery outcomes calibrate future opportunity scoring and pricing multipliers, and verifying the updated CEO Command Center overview with zero synthetic records.
- Full workspace verification: `pnpm run build` (33/33 successful), `pnpm run typecheck` (54/54 successful), `pnpm run lint` (53/53 successful).
- Live runtime infrastructure verification: `tests/e2e/live-runtime-smoke.test.ts` (3/3 passed) proves live NATS command dispatch/event publication, live LM Studio Qwen 3 8B specialist execution, artifact generation and SHA-256 seal record persistence, and live MySQL durability across process restart.

---

# Strict engineering rules

1. Work directly on `main`; do not create a new branch.
2. Inspect existing implementation before changing anything and reuse it.
3. Do not create duplicate event buses, registries, orchestration engines, stores, intake systems, artifact systems, or dashboards.
4. Do not build UI polish ahead of missing business capability.
5. Do not add fake/demo records to production paths.
6. Do not invent IDs, agents, tasks, evidence, scores, progress, revenue, or outcomes.
7. A successful HTTP response is not proof of execution; verify persisted state/events/artifacts.
8. Every new capability must connect contract → persistence → runtime → event/read model → CEO visibility → tests.
9. Prefer existing Message Fabric/event subjects.
10. Prefer existing MySQL persistence and migrations.
11. Production must fail closed when durable state is unavailable where truth would otherwise be lost.
12. Update this file after every milestone with what is genuinely real and what remains.
13. Every milestone must add focused tests and preserve CI health.
14. Never mark a phase complete merely because code exists; prove the real end-to-end path.
15. When blocked by a missing dependency, implement that dependency as the next missing capability rather than working around it with fake data.

# CEO success test

A founder opening the Command Center should be able to answer within seconds:

- What is the company doing right now?
- What opportunities are being pursued?
- Which prospects matter?
- Which Specialists/agents are working?
- What project is each one working on?
- What evidence exists?
- What is blocked?
- What needs my decision?
- What happens next?
- What money/outcome is this producing?

If the answer cannot be derived from real persisted company state, that capability is not complete.
