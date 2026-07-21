# Engineering Operating Model

> How Engineering runs day to day without inventing a private operating system. Composes with `Executive/EXECUTIVE_OPERATING_MODEL.md`, `Governance/MEETING_OPERATING_SYSTEM.md`, and `Execution/`.

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`, `Departments/DEPARTMENT_ARCHITECTURE_STANDARD.md`.

## How Work Enters

1. Intent originates in `Business/` (roadmap, case, success criteria) or other approved sources.  
2. Work enters `Execution/REQUEST_LIFECYCLE.md` — **no Engineering side channel**.  
3. Project Manager sequences capacity; CEO owns scope trade-offs.  
4. Engineering accepts only when: Execution instance exists, applicable gates allow start, entry artifacts from upstream (e.g. Design) validate per `Execution/DEPARTMENT_HANDOFFS.md`, and Business Intent is traceable.

**Rejected at the door:** “urgent” builds with no Execution instance; Design-incomplete packages; Security Constraining requirements unknown for the Capability class.

## How Work Moves Internally

```text
Solution Architecture → Application Delivery
         ↓                      ↓
      Platform (Enabling)   Engineering Systems (Enabling)
         ↓                      ↓
   Release Engineering ←—— Production Observability (signal)
         ↓
 Technical Stewardship (ADR, debt register continuous)
```

Internal context handoffs still use explicit artifacts. Ownership of the work item transfers only on receiver acknowledgment (same protocol discipline as cross-Department handoffs).

## How Work Exits

Engineering exits to **QA** (primary Sequential) with a Handoff Package:

- Implementation Package / Release Candidate  
- Service/Interface Contracts touched  
- Engineering test evidence bundle  
- Known caveats  
- Linked Execution instance + gate status  
- Observability/SLO notes for new or changed paths  

Ownership remains with Engineering until QA acknowledges. Itemized rejection returns ownership to Engineering.

Secondary exits: Support escalations (future), Analytics instrumentation contracts, Security control evidence packages (when required).

## Decision Boundaries

| Decision | Owner |
|---|---|
| Internal technical choice (library, module boundary, reversible) | Engineering alone |
| Cross-Department technical/design conflict | Departments attempt resolution → CEO |
| Scope / roadmap trade-off | CEO (Business evidence in) |
| Schedule / capacity | Project Manager |
| Process/doc health | Chief of Staff finding → CEO for standard change |
| Irreversible production, spend, external commitment | Human Principal accountability per Constitution §5 |
| Security control exception | Security + Governance risk acceptance — not Engineering alone |
| Release go/no-go | Per Org Chart RACI (CEO Accountable; Eng/QA Responsible as applicable) |

## Escalation Boundaries

1. Blocked on unclear intent → Business via Executive (not Engineering inventing product scope)  
2. Blocked on Design contract → reject handoff; escalate unresolved conflict to CEO  
3. Capacity overload → signal Project Manager with evidence (queue depth, SLO burn)  
4. Control/policy conflict → Security / Governance  
5. Suspected systemic process failure → Chief of Staff  

## Capacity Posture

Engineering publishes a standing capacity signal to the Project Manager: inbound queue, WIP, error-budget status, and Platform golden-path blockers. Engineering does not silently accept infinite WIP.

## Cadence

| Cadence | Engineering participation |
|---|---|
| Daily | Delivery sync as needed for in-flight Execution instances |
| Weekly | Interface/health with PM; debt and SLO review internal |
| Monthly | Metrics review; CoS sample audits |
| Quarterly | Capability Heat Map ownership refresh; DAS package review; dependency graph check |
| Annual | Ten-year spine check; split/merge evaluation |

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering (stewardship), Project Manager (capacity interface), Chief of Staff (process audit)
```
