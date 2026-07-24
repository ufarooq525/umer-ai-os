# Workflow Templates

Part of `Runtime/WorkflowEngine/WORKFLOW_ARCHITECTURE.md`.

Templates are the **declarative desired graphs** the Instantiator pins onto
instances. They play the role of Temporal workflow definitions and GitHub
reusable workflows — as data, not as specialist code.

## 1. What a template is

A versioned document that declares:

- Trigger bindings (which Event Bus events may `start` it)
- Stage set + per-stage contracts (`STAGE_MODEL.md`)
- Control-flow graph (`CONTROL_FLOW.md`)
- Defaults (timeouts, retry policies, gate profiles)
- Compensation / cancel hooks
- Input / output schemas
- Compatibility / nestability flags

Organizational pipeline meaning (why QA follows Development) stays in Execution;
the template **encodes** that policy so Runtime can enforce it mechanically.

## 2. Identity and versioning

| Field | Description |
| --- | --- |
| `templateId` | Stable id, e.g. `canonical.delivery`, `hotfix.fast-track`, `qa.verify.only` |
| `version` | Semver; instances pin exact version at start |
| `status` | `draft` \| `active` \| `deprecated` \| `retired` |
| `replaces` | Optional prior template id for migrations |
| `nestable` | Whether allowed as nested child |
| `execBinding` | `required` \| `optional` — must bind `EXEC-###` or not |
| `checksum` | Hash of normalized template body (Registry integrity) |

**Version rules (Temporal influence):**

- Running instances never auto-upgrade mid-flight.
- Additive stage optional fields may be introduced in a new version; removing /
  renaming stages requires a new `templateId` or a migration guide.
- Patch versions: documentation / default timeout tweaks only if explicitly marked
  `safeForPinBump` (default false).

## 3. Trigger bindings

```yaml
triggers:
  - on: work.feature.requested
    filter: { payload.projectId: { exists: true } }
    inputMap:
      title: payload.title
      projectId: payload.projectId
  - on: work.bug.reported
    filter: { payload.severity: [high, critical] }
  - manual: true   # Control API / HITL start
```

Only the Workflow Engine Instantiator (or a thin Control API façade) calls
`start()`. Specialists do not start arbitrary templates unless a Trust-authorized
bridge exists.

Conflict: two active templates matching the same event ⇒ Registry validation
error unless `priority` / `exclusive: true` disambiguates (prefer exclusive
canonical delivery template).

## 4. Template structure (logical)

```text
WorkflowTemplate
  meta (id, version, owner, description)
  inputSchema / outputSchema
  triggers[]
  defaults
    retry, timeout, gateProfile, priority
  stages[]          # STAGE_MODEL declarations
  edges[]           # from, to, condition?, kind: success|failure|cancel
  nodes[]           # decision | fork | join | fanOut | fanIn (if not implied)
  children[]        # allowed child template ids
  compensation
    strategy: saga | explicitGraph
    graph?: …
  policies
    maxNestingDepth, maxFanOut, cancellation
```

Storage SoR candidates (architecture allows either or both):

- Markdown / YAML under `Workflows/` (human-editable, reviewed like specialists)
- Validated copy in `packages/contracts` + Registry Fabric (wire SoT)

Both must agree; PR rule: template doc + contract checksum land together.

## 5. Template catalog (initial)

| templateId | Purpose | Typical trigger |
| --- | --- | --- |
| `canonical.delivery` | Full Execution pipeline (Research…Learning) with declared branches | `work.feature.requested` |
| `hotfix.fast-track` | Shortened path: Development → QA → Deploy → Learning (skips via logged edges) | `work.bug.reported` + severity |
| `qa.verify.only` | Single-stage / short graph for intake type `qa` | intake / manual |
| `seo.audit.only` | SEO specialist track | intake / `change.pr.merged` (web) |
| `security.review` | Nestable child for security parallel arm | child spawn from delivery |
| `release.deploy` | Gate → deploy → smoke | `delivery.release.requested` |

Project-specific templates MAY add gates/stages; they MUST NOT remove mandatory
Execution gates without Governance amendment (Approval Gates rule).

## 6. Defaults and profiles

Named profiles reduce duplication:

| Profile | Use |
| --- | --- |
| `timeout.standard` | Default stage/activity/gate timers |
| `timeout.critical` | Shorter stage, longer gate escalate |
| `retry.standard` | Maps to Event Bus / Resilience `standard` |
| `gate.standard` | Normal approver set |
| `gate.security` | Security-critical locks |

Stages inherit defaults then override locally.

## 7. Validation (register-time)

Template Registry rejects templates that:

- Have unreachable stages or edges to unknown stages
- Fan-out without fan-in (or explicit `detach`)
- Decision nodes without exhaustive routes
- Reference unknown specialist ids / gate profiles
- Declare `ignore` failure on security-critical gates
- Exceed `maxFanOut` / nesting policy
- Fail input schema lint
- Conflict on exclusive triggers

Validation produces a machine-readable report used by CI (`pnpm` contract tests
later).

## 8. Materialization from Executive plans

Orchestration “plan materialization” (domain charter): an Executive / PM
delegation artifact may **select** a template + fill input + enable optional
arms (SEO yes/no) rather than inventing a free-form graph. Free-form graphs are
out of scope for V1 — only registered templates.

## 9. Deprecation

1. Mark `deprecated`; stop new `start` (in-flight continue).
2. After retention window, `retired`; history remains queryable.
3. `replaces` pointer guides operators to the successor template.

## Metadata

```yaml
version: 1.0.0
status: proposed
last_reviewed: 2026-07-25
```
