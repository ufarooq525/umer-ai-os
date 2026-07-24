# Event Types

Part of `Runtime/EventBus/EVENT_ARCHITECTURE.md`. This is the canonical taxonomy
for OS-runtime events on the bus. Analytics product events are explicitly out of
scope (Analytics owns that taxonomy; the Fabric may only transport it).

## 1. Naming convention

```
<domain>.<entity>.<pastTenseVerb>[.vN]
```

- Lowercase, dot-separated — consistent with the existing
  `RuntimeEventNameSchema` (`workpackage.queued`, `gate.passed`, …).
- **Past tense**: events are facts that happened, never instructions.
  Instructions are commands on the `cmd.>` plane.
- Broker subject = `evt.<name>` prefixed with the priority lane per
  `EVENT_ARCHITECTURE.md` §4.2; existing `evt.runtime.<name>` events migrate per
  `IMPLEMENTATION_PLAN.md`.
- PascalCase aliases (e.g. `FeatureRequested`) are **display names only** — used
  in UI and docs, never on the wire.

## 2. Domains

| Domain prefix | Meaning | Typical producers |
| --- | --- | --- |
| `work.*` | Demand entering or moving through the system | Control API intake, PM specialist |
| `specialist.*` | A specialist finished (or failed) its mandate | Agent workers |
| `quality.*` | A quality signal degraded or recovered | QA/perf/a11y specialists, CI bridges |
| `change.*` | Source/dependency/schema change facts | VCS bridge, engineering specialist |
| `delivery.*` | Build, release, deployment lifecycle | DevOps specialist, CI/CD bridge |
| `gate.*` / `control.*` | Human approval lifecycle (existing) | Control Plane |
| `workpackage.*`, `agent.run.*`, `artifact.*`, `audit.*`, `memory.*`, `trust.*` | Existing runtime lifecycle events — unchanged, absorbed into this taxonomy as-is | Orchestration, Agent Runtime, etc. |
| `fabric.*` | Bus meta-events (delivery failed, DLQ enqueued, schema incompatible, loop suspected) | Event Bus itself |

## 3. Catalog (new types)

Display name (requirements) → canonical wire type. Default priority and the
default subscribers are the initial wiring; subscriptions are declarative and can
change without touching this catalog.

### work.*

| Display | Wire type | Default priority | Key payload fields | Default subscribers |
| --- | --- | --- | --- | --- |
| FeatureRequested | `work.feature.requested` | normal | `title`, `description`, `projectId`, `requestedBy` | `pm.intake` |
| BugReported | `work.bug.reported` | high | `summary`, `severity`, `projectId`, `reproduction` | `pm.intake`, `qa.verify` (triage) |
| — | `work.feature.planned` | normal | `planArtifactId`, `workPackageIds[]` | `engineering.application-delivery` |

### specialist.*

Uniform shape: every specialist completion is `specialist.<mandate>.completed`
with a shared payload core (`workPackageId`, `verdict: pass|fail|partial`,
`artifactId`, `summary`). Failures of the *run itself* stay on the existing
`agent.run.failed`; a `completed` event with `verdict: fail` means the specialist
ran fine and the finding is negative.

| Display | Wire type | Default priority | Default subscribers |
| --- | --- | --- | --- |
| EngineeringCompleted | `specialist.engineering.completed` | normal | `qa.verify`, `security.review`, `seo.audit` |
| QACompleted | `specialist.qa.completed` | normal | delivery aggregator; `engineering` (on `verdict: fail`) |
| SecurityCompleted | `specialist.security.completed` | high | delivery aggregator; `engineering` (on `verdict: fail`) |
| SEOCompleted | `specialist.seo.completed` | normal | delivery aggregator |
| — | `specialist.pm.completed` | normal | (emits `work.feature.planned` as child event) |

### quality.*

| Display | Wire type | Default priority | Key payload fields | Default subscribers |
| --- | --- | --- | --- | --- |
| TestsFailed | `quality.tests.failed` | high | `suite`, `failedCases[]`, `commitRef`, `workPackageId?` | `engineering` (fix loop), `qa.verify` |
| PerformanceDropped | `quality.performance.dropped` | high | `metric`, `baseline`, `current`, `window` | `engineering.performance` |
| CoverageReduced | `quality.coverage.reduced` | normal | `previousPct`, `currentPct`, `threshold`, `commitRef` | `qa.verify` |
| AccessibilityFailed | `quality.accessibility.failed` | high | `standard` (e.g. WCAG 2.2 AA), `violations[]`, `pages[]` | `engineering`, `qa.verify` |

`quality.*` degradation events use the Schedule Store for debounce where noisy
(e.g. `performance.dropped` publishes only after the drop sustains its window).

### change.*

| Display | Wire type | Default priority | Key payload fields | Default subscribers |
| --- | --- | --- | --- | --- |
| DependencyUpdated | `change.dependency.updated` | normal | `package`, `from`, `to`, `advisoryIds[]` | `security.review`, `qa.verify` |
| MigrationAdded | `change.migration.added` | high | `migrationId`, `direction`, `destructive: bool` | `security.review`, DBA review gate |
| PRCreated | `change.pr.created` | normal | `repo`, `prNumber`, `branch`, `author`, `linkedWorkPackageId?` | `qa.verify`, `security.review` (diff scan) |
| PRMerged | `change.pr.merged` | normal | `repo`, `prNumber`, `mergeCommit` | `delivery` pipeline trigger, `seo.audit` (if web surface touched) |

`change.*` events typically arrive via **bridges** (VCS webhooks → Extension
worker → `publish()`); bridges are producers like any other and must sign
envelopes (`EVENT_SCHEMA.md` §1 `signature`).

### delivery.*

| Display | Wire type | Default priority | Key payload fields | Default subscribers |
| --- | --- | --- | --- | --- |
| BuildFailed | `delivery.build.failed` | high | `pipeline`, `stage`, `logArtifactId`, `commitRef` | `engineering` (fix loop) |
| DeploymentCompleted | `delivery.deployment.completed` | normal | `environment`, `version`, `releaseId` | `qa.verify` (smoke), `seo.audit` (prod), Observability |
| — | `delivery.release.requested` | normal | `workPackageIds[]`, `gateId` | Control Plane (gate), DevOps specialist |
| — | `delivery.deployment.failed` | critical | `environment`, `stage`, `error` | DevOps specialist, incident opener |

### fabric.* (bus meta-events)

`fabric.event.published`, `fabric.message.delivered`, `fabric.message.failed`,
`fabric.dlq.enqueued`, `fabric.dlq.replayed`, `fabric.schema.incompatible`,
`fabric.event.loop_suspected`, `fabric.subscription.activated|deactivated`.
Meta-events are never re-processed by the Dispatcher into `fabric.*` reactions
(no meta-of-meta) — they flow to Observability and Audit only.

## 4. Absorbed existing types

All ~60 names in `RuntimeEventNameSchema` (`request.*`, `workpackage.*`,
`agent.run.*`, `artifact.*`, `gate.*`, `control.*`, `audit.*`, `memory.*`,
`trust.*`, `incident.*`, `release.*`, …) remain valid types in this taxonomy with
unchanged payload semantics. `release.deployed` is aliased by
`delivery.deployment.completed` during migration; the migration plan retires one
of the two (decision recorded in `IMPLEMENTATION_PLAN.md` §Phase 1).

## 5. Governance of the catalog

- New types are added by PR to `packages/contracts` + this document; both must
  land together (wire SoT and architecture SoR stay in sync).
- A type must declare: wire name, payload schema, default priority, retention
  tier, whether it is security-relevant (⇒ Audit mirror), and at least one
  intended subscriber or an explicit "observability-only" marker.
- Types are never deleted, only deprecated (`EVENT_SCHEMA.md` §3) — history must
  remain interpretable.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-25
```
