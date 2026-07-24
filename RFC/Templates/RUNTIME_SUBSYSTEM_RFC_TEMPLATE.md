# Runtime Subsystem RFC Template

> Authoring format for Runtime subsystem RFCs. Extends `RFC/Templates/RFC_TEMPLATE.md`
> with the Chief Systems Architect gate from
> `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md`. Copy into
> `RFC/Records/RFC-###-<slug>.md` — do not fill this file in place.

```markdown
# RFC-### — <verb phrase: Introduce | Extend | Replace … Runtime …>

## Status
Draft | Under Architecture Review | Under Approval | Accepted | Rejected | Implemented

## Date Proposed
YYYY-MM-DD

## Author
Chief Systems Architect / <steward>

## Layers Affected
Runtime (required). List others: Execution | Intelligence | Governance | Executive | packages/contracts | …

## Summary
2–4 sentences.

## Motivation
Problem, scale driver (hundreds of specialists), link to harvest/audit if any.

## Why This Requires an RFC
Cite `RFC/RFC_PROCESS.md` triggers and/or Runtime subsystem criteria in
`RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md` §3.

---

## 1. Enterprise Pattern Research (Take / Leave)

| System | Take | Leave | Why |
|---|---|---|---|
| Kubernetes | | | |
| Temporal | | | |
| Apache Airflow | | | |
| LangGraph | | | |
| Prefect | | | |
| OpenTelemetry | | | |
| GitHub Actions | | | |
| Ray | | | |
| Microsoft AutoGen | | | |
| (others as relevant) | | | |

---

## 2. Architecture Proposal

### 2.1 Positioning
Which of the 17 domains / which plane. Explicit non-goals. No shadow bus/orchestrator.

### 2.2 Diagrams
- Context (Mermaid)
- Components / ports
- Happy-path sequence
- Failure-path sequence

### 2.3 Scale assumptions
Concurrency, tenancy, retention, backpressure targets.

---

## 3. Interfaces (Ports)

| Port | Responsibility | In-memory adapter | Reference adapter |
|---|---|---|---|
| | | required: yes | |

---

## 4. Contracts

| Contract | Wire / schema name | Versioning | Taxonomy impact |
|---|---|---|---|
| | | | new events/commands: … |

Idempotency keys, correlation, deprecation rules.

---

## 5. Failure Handling

| Failure mode | Detection | Response |
|---|---|---|
| | | |

Retry policy refs · DLQ/replay · degraded mode · fail-open/closed · escalation.

---

## 6. Extension Points

Declarative records, manifests, adapters. Explicit **non-extension** list.

---

## 7. Testing Strategy

| Layer | What is proven |
|---|---|
| Contract | |
| Unit (in-memory ports) | |
| Integration | |
| Chaos | |
| Scale drill (≥ hundreds specialists story) | |
| Rebuild drill (if derived store) | |

---

## 8. Migration Strategy

What breaks · dual-run/flags · backfill · deprecation · rollback.

---

## 9. Alternatives Considered

| Option | Summary | Why not chosen |
|---|---|---|
| | | |
| Do nothing | | |

## Trade-offs
Per `Core/DECISION_FRAMEWORK.md`.

---

## Architecture Review Notes
(Stage 1 — completeness per Doctrine §15 checklist)
- Pattern research table complete: yes/no
- Diagrams present (4): yes/no
- Ports + contracts + failure + extension + test + migration: yes/no
- Scale story for hundreds of specialists: yes/no
- Loose coupling checklist: pass/fail
- Returned for gaps: <…>

## Approval
| Reviewer | Decision | Reasoning |
|---|---|---|
| Chief Systems Architect (Architecture Review) | | |
| CEO | Approved / Rejected | |
| Chief of Staff | Approved / Rejected | |

## Implementation Gate
Implementation may begin only when Status = Accepted.
Link to `IMPLEMENTATION_PLAN.md` (sequencing only) after Acceptance.

## Resulting Record
- ADR: <link>
- Architecture SoR files: <list>
- Contracts PRs: <list after implement>
- Layers updated: <list>

## Related
- Prior RFCs:
- Doctrine: Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md
```
