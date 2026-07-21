# Department Architecture Standard (DAS)

> The universal architectural contract for every Department in Umer AI OS. A Department that does not conform to this standard is not a Department — it is a folder, a wish, or a future proposal. This document is the Phase 2 foundation: every Core Delivery Department below is an instance of this contract.

Governed by `Core/AI_OS_CONSTITUTION.md`. Placement and RACI remain owned by `Governance/ORGANIZATIONAL_CHART.md`. Stable nouns remain owned by `Enterprise_Architecture/`. This standard does **not** create a new top-level layer; it lives under `Departments/` as the blueprint every Department instance must follow.

## 0. What a Department Is

| Term | Definition under DAS |
|---|---|
| **Department** | A long-lived organizational unit that realizes one or more registered Capabilities (`Enterprise_Architecture/ENTERPRISE_CAPABILITY_MODEL.md`), sits on `Governance/ORGANIZATIONAL_CHART.md`, and executes specialized work through Agents (future) without owning foundational-layer mandates. |
| **Not a Department** | An Agent, a Workflow, a prompt pack, a Project, a Capability, a Domain, a Foundational layer (`Core/`, `Governance/`, `Intelligence/`, `Execution/`, `Enterprise_Architecture/`), or a Leadership layer (`Executive/`, `Business/` as value engine). |

Departments are the **least stable** noun in the enterprise taxonomy by design — they may split, merge, or rename. Capabilities and Domains must outlive them. DAS exists so reorganization never requires reinventing interfaces, artifacts, or ownership rules.

## 1. Department Purpose (Why Departments Exist)

Departments exist so that:

1. Every registered Capability has an **Accountable organizational home**.
2. Execution has a durable unit to hand work to and receive work from.
3. Governance can apply KPIs, risk, RACI, and audits uniformly at scale.
4. Agents have exactly one organizational parent (`Enterprise_Architecture/ENTERPRISE_TAXONOMY.md`).
5. The organization can grow to 100+ specialized units without each inventing incompatible scope language.

**Enduring test:** If the unit disappeared tomorrow, could Capability ownership, handoff contracts, and KPI accountability be reassigned cleanly? If not, it was never a DAS-conformant Department.

## 2. Mission (Required Statement Shape)

Every Department Charter must state a mission in this form:

> **We exist to [durable organizational outcome], by [primary means], so that [downstream Departments / customers / the enterprise] can [consequent ability].**

The mission must remain valid across tool, model, and staffing changes for a decade. Missions framed around a specific stack, vendor, or Agent count are non-conformant.

## 3. Responsibilities (Required)

Every Department must declare:

| Block | Content |
|---|---|
| **Primary Capabilities** | Named Level-2 Capabilities from `Enterprise_Architecture/ENTERPRISE_CAPABILITY_MODEL.md` (add to the registry first if missing) |
| **Primary Domain** | Exactly one primary Domain from `Enterprise_Architecture/ENTERPRISE_DOMAIN_MAP.md` |
| **Topology class** | One of: Pipeline Stage · Cross-Cutting · Enabling · Platform · Customer-Facing |
| **Accountable outcomes** | What “good” means for this Department in outcome language, not activity language |
| **Internal decision rights** | What the Department decides alone (per Org Chart: Department-internal reversible decisions) |

## 4. Explicit Non-Responsibilities (Required)

Every Department must publish a **Does Not Own** table mapping each temptation to the correct owner among: Core, Executive, Governance, Business, Execution, Intelligence, Enterprise Architecture, or another named Department.

Silent omission is non-conformant. If a neighbor’s mandate is adjacent, name the boundary explicitly.

## 5. Organizational Boundaries (Required)

| Boundary | Rule |
|---|---|
| **Foundational layers** | Never staffed as Departments. Core, Governance, Intelligence, Execution, Enterprise Architecture remain layers. |
| **Leadership layers** | Executive and Business-the-value-engine are not Delivery Departments under DAS. (A future “Business operations” delivery unit, if ever created, must not collide with `Business/` layer ownership.) |
| **Capability ownership** | One primary Accountable Department per Capability. Shared Enabling access is allowed; dual Accountable is not. |
| **Domain binding** | One primary Domain per Department. Multi-Domain Departments require CoS + CEO review and are discouraged. |
| **Agent binding** | Every future Agent belongs to exactly one Department. |
| **Stub folders** | An empty `Departments/<Name>/` path is **Stage 0 — Stub**, not a Department. |

## 6. Required Bounded Contexts

Every Department declares **bounded contexts** — coherent internal areas of concern.

**Rules:**

1. Every bound Capability maps to ≥1 context.
2. Each context has Purpose, Owns, Does Not Own, Interfaces, Primary Artifacts, Anti-patterns.
3. Prefer **3–9** contexts. More than ~12 is a Split signal.
4. Contexts are not Agents and not sub-Departments.
5. Optional **Teams** may exist under a context for scale without creating new Departments.

## 7. Required Interfaces

Every Department maintains an Interface Registry covering at least:

| Class | Counterpart |
|---|---|
| Constitutional | `Core/` |
| Control | `Governance/` |
| Leadership | `Executive/` |
| Intent | `Business/` |
| Runtime | `Execution/` |
| Structural | `Enterprise_Architecture/` |
| Evidence | `Intelligence/` |
| Peer | Every Department with a standing handoff or Enabling edge |

Every Peer edge names artifact types and which side validates entry (per `Execution/DEPARTMENT_HANDOFFS.md`).

**No side channels:** delivery-affecting work enters through `Execution/REQUEST_LIFECYCLE.md`.

## 8. Required Dependency Graph

Every Department declares:

- **Inputs** (artifacts / intent / constraints consumed)
- **Outputs** (artifacts produced)
- **Required dependencies** (Sequential or Constraining — work cannot proceed without them)
- **Optional dependencies** (Enabling / Informational)

Edge types follow `Enterprise_Architecture/CROSS_DOMAIN_DEPENDENCY_MODEL.md`: Sequential, Enabling, Constraining, Informational.

**Hard rules:** no undeclared Sequential cycles; new Sequential inbound edges onto known bottlenecks require Chief of Staff review.

## 9. Required Artifact Registry

Every Department registers **durable enterprise artifacts** it is authoritative for — typed, versioned, contract-bound assets — not narrative docs-for-docs’-sake.

Each entry: name, owning context, consumers, versioning rule, acceptance source, applicable `Core/QUALITY_STANDARD.md` gates.

Cross-Department artifacts extend `Execution/ARTIFACT_CONTRACTS.md`. Single owner per artifact type.

## 10. Required Metrics

Every Department defines metrics under these families (conform to `Governance/KPI_FRAMEWORK.md`):

| Family | Intent |
|---|---|
| Department Health | Can this unit fulfill its mandate sustainably? |
| Organizational Effectiveness | Does the enterprise get what it needs from this unit? |
| Quality | Defect, rework, gate, and contract health |
| Capability Maturity | Progress of bound Capabilities (aligned with Heat Map, not replacing it) |
| Operational Excellence | Flow, restore, reliability, interface health |

**Rules:** ≥2 leading + ≥2 lagging; every KPI has formula, source, cadence, counter-metric. **Forbidden as primary KPIs:** story points, velocity theater, lines of code, message volume.

## 11. Required Operating Model

Every Department publishes:

1. How work **enters** (Execution for delivery work)
2. How work **exits** (handoff package + receiver acknowledgment)
3. **Decision boundaries** (composes with Org Chart §5)
4. **Escalation boundaries** (CEO / PM / CoS / Human Principal)
5. Capacity signal to Project Manager
6. Audit posture for Chief of Staff
7. Participation in Governance cadence (`Governance/MEETING_OPERATING_SYSTEM.md`)

Lighter *application* for new Departments is allowed; exemption from requirements is not (`Governance/GOVERNANCE_PLAYBOOK.md`).

## 12. Required Playbook Structure

Every Department Playbook uses this fixed outline:

1. One-sentence mandate  
2. Domain / Capability / Topology placement  
3. How work enters and leaves  
4. Bounded contexts and how they collaborate  
5. End-to-end example  
6. Business-intent traceability  
7. Inheritance from Core / Governance / Execution / Intelligence / EA (link, do not restate)  
8. Specialty escalation patterns  
9. Local anti-patterns  
10. One-sentence summary  

## 13. Required Maturity Model

| Stage | Meaning | Allowed operations |
|---|---|---|
| **0 — Stub** | Folder/name only | Not a Department |
| **1 — Proposed** | DAS package drafted | Review only |
| **2 — Chartered** | Package ratified; on Org Chart | No production handoffs yet |
| **3 — Staffed** | Lead + minimum specialist coverage (future Agents) | May accept declared-scope handoffs |
| **4 — Operational** | Proven on real instances; metrics baselined; audits clean | Steady state |
| **5 — Governing** | Specialty standards consumed by others; low interface defect | May sponsor strong Enabling edges |
| **6 — Platformized** | Multi-Team; split/merge discipline active | Large Departments only |

Aspiration is not maturity. Capability Heat Map maturity and DAS stage may differ — that difference is signal.

## 14. Department Lifecycle

```text
Idea → Proposed → Chartered → Staffed → Operational
         ↓           ↓           ↓           ↓
      Rejected    Suspended   Suspended   Suspended
                     ↓
        Split | Merge | Transfer | Sunset
```

Sunset never orphans a Capability — ownership transfers or the Capability is explicitly retired via Business + Enterprise Architecture process.

## 15. Review Criteria

**Creation / material change (pass/fail):**

1. Primary Domain set; not Foundational/Leadership-as-Department  
2. Capabilities registered; ownership conflict cleared  
3. Topology + Org Chart attachment answered (`Governance/ORGANIZATIONAL_CHART.md` §6)  
4. Owns / Does Not Own complete  
5. Interfaces complete for all Peer edges  
6. Dependency graph present; no Sequential cycles; bottleneck check done  
7. Business Intent interface named  
8. Metrics satisfy KPI Framework minimums  
9. Operating model composes with Executive/Governance  
10. Playbook structure complete  
11. Maturity stage honest  
12. Lifecycle + metadata present  
13. No anti-pattern without logged, time-boxed waiver  

**Ongoing:** handoff rejection trend, gate compliance, Heat Map ownership clarity, CoS findings, zombie risk (Active but idle).

## 16. Anti-Patterns (Universal)

1. Folder-as-Department  
2. Domain clone without Capability binding  
3. Layer cosplay (recreating Business/Governance/Intelligence/Execution/EA inside a Department)  
4. Pipeline hardcoding (every engagement must visit every Department)  
5. Capability hoarding  
6. Agent monolith spanning unbound contexts  
7. Interface improvisation  
8. Side-channel delivery (bypassing Execution)  
9. Metric theater  
10. Shadow taxonomy  
11. Premature Department split (should be Team/Agent/Capability)  
12. Zombie Active Department  
13. Dual Accountable for one Capability  
14. Staffing Foundational layers as Departments  
15. Charter drift without versioned change  

## 17. Rules for Introducing New Departments

Prefer, in order: new Agent → new Team → new Capability on existing Department → new Department → new Domain (RFC, rare).

A new Department requires DAS package + Org Chart §6 answers + EA bindings + Business Intent traceability + Human Principal approval per RACI.

**Out of Phase 2 scope (do not create yet):** Marketing, Sales, HR, Finance, Legal, Operations, Support, SEO, Product-as-Department, and any other non-listed unit. Existing stub folders for those remain Stage 0 until a later phase.

## 18. Mandatory File Package (Instance Shape)

Every Chartered Department under `Departments/<Name>/` must contain:

| File / folder | Role |
|---|---|
| `*_CHARTER.md` | Mission, purpose, responsibilities, does not own, boundaries |
| `*_OPERATING_MODEL.md` | Enter/exit/decision/escalation |
| `*_INTERFACES.md` | All interface classes |
| `*_DEPENDENCY_GRAPH.md` | Inputs/outputs/required/optional |
| `*_ARTIFACT_REGISTRY.md` | Durable enterprise artifacts |
| `*_METRICS.md` | Required metric families |
| `*_FAILURE_MODES.md` | Architectural and organizational risks |
| `*_TEN_YEAR_ARCHITECTURE.md` | Decade spine |
| `*_PLAYBOOK.md` | Narrative integrator (§12 structure) |
| `Contexts/` | One file per bounded context |

## Metadata

```yaml
version: 1.0.0
status: active
phase: 2
last_reviewed: 2026-07-22
owner: Chief of Staff (stewardship), CEO (ratification), Human Principal (new Department approval per RACI)
```
