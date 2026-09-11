/**
 * Company Intelligence Graph — Read-Model Projection
 *
 * Reads existing authoritative domain stores and emits a canonical
 * { nodes, edges } graph.  This is purely a READ MODEL — it never
 * writes to any store and never invents data.
 *
 * Architecture:
 *   Authoritative Domain Stores  (unchanged)
 *         ↓
 *   buildCompanyGraph()           (this file)
 *         ↓
 *   GET /v1/company/graph         (server.ts route)
 *         ↓
 *   Graph UI                      (apps/web)
 *
 * The graph can be rebuilt from the same authoritative state at any time
 * and will produce an identical result — it has no state of its own.
 */

import type { ControlApiState } from './state.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | 'Niche'
  | 'Opportunity'
  | 'Prospect'
  | 'Contact'
  | 'Outreach'
  | 'Deal'
  | 'Proposal'
  | 'Project'
  | 'Requirement'
  | 'Agent'
  | 'WorkPackage'
  | 'Gate'
  | 'AgentRun'
  | 'Artifact'
  | 'Customer'
  | 'Learning'
  | 'Deployment'
  | 'Incident';

export type GraphEdgeType =
  | 'niche_opportunity'
  | 'opportunity_prospect'
  | 'prospect_contact'
  | 'contact_outreach'
  | 'outreach_deal'
  | 'opportunity_deal'
  | 'deal_proposal'
  | 'deal_project'
  | 'opportunity_project'
  | 'project_requirement'
  | 'project_workpackage'
  | 'workpackage_gate'
  | 'gate_artifact'
  | 'project_agent'
  | 'agent_workpackage'
  | 'workpackage_agentrun'
  | 'workpackage_artifact'
  | 'agentrun_artifact'
  | 'project_customer'
  | 'opportunity_customer'
  | 'customer_learning'
  | 'project_learning'
  | 'learning_opportunity'
  | 'project_deployment'
  | 'deployment_incident';

export type CompanyGraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: string;
  /** Arbitrary metadata for the detail panel — only real fields from domain state. */
  metadata: Record<string, unknown>;
};

export type CompanyGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  metadata: Record<string, unknown>;
};

export type CompanyGraph = {
  nodes: CompanyGraphNode[];
  edges: CompanyGraphEdge[];
  generatedAt: string;
  filtered: boolean;
  totalNodesBeforeLimit: number;
};

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export type GraphFilterOptions = {
  nodeTypes?: GraphNodeType[];
  projectId?: string;
  opportunityId?: string;
  agentId?: string;
  customerId?: string;
  /** Exact match against a node's real status field. */
  status?: string;
  search?: string;
  activeOnly?: boolean;
  /** When true, only nodes in a real stuck/blocked status survive. */
  blockedOnly?: boolean;
  limit?: number;
  /** When focal filters (projectId, opportunityId, agentId) are specified, expand neighborhood by N hops. */
  depth?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set([
  'rejected', 'cancelled', 'lost', 'closed_lost', 'closed_won',
  'Cancelled', 'Rejected', 'Failed', 'Done', 'Accepted',
  'completed', 'failed', 'offline',
]);

function isActive(status: string | undefined): boolean {
  if (!status) return true;
  return !TERMINAL_STATUSES.has(status);
}

/** Real stuck/blocked statuses actually used across domain stores in this codebase. */
const BLOCKED_STATUSES = new Set([
  'Blocked', 'blocked', 'Failed', 'failed', 'AwaitingReview', 'awaiting_review',
]);

function isBlocked(status: string | undefined): boolean {
  return !!status && BLOCKED_STATUSES.has(status);
}

function edgeId(source: string, target: string, type: GraphEdgeType): string {
  return `e:${type}:${source}:${target}`;
}

function matchesSearch(node: CompanyGraphNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.type.toLowerCase().includes(q)) return true;
  for (const v of Object.values(node.metadata)) {
    if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main projection
// ---------------------------------------------------------------------------

export async function buildCompanyGraph(
  state: ControlApiState,
  options: GraphFilterOptions = {},
): Promise<CompanyGraph> {
  const {
    nodeTypes,
    projectId,
    opportunityId,
    agentId,
    customerId,
    status: statusFilter,
    search,
    activeOnly = false,
    blockedOnly = false,
    limit = 200,
    depth,
  } = options;

  const isNeighborhoodExpansion =
    typeof depth === 'number' &&
    depth >= 1 &&
    Boolean(projectId || opportunityId || agentId || customerId);

  const effectiveProjectId = isNeighborhoodExpansion ? undefined : projectId;
  const effectiveOpportunityId = isNeighborhoodExpansion ? undefined : opportunityId;
  const effectiveAgentId = isNeighborhoodExpansion ? undefined : agentId;
  const effectiveCustomerId = isNeighborhoodExpansion ? undefined : customerId;

  const nodes: CompanyGraphNode[] = [];
  const edges: CompanyGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  function addNode(node: CompanyGraphNode): void {
    if (nodeIds.has(node.id)) return; // Deduplicate
    if (nodeTypes && !nodeTypes.includes(node.type)) return;
    if (activeOnly && !isActive(node.status)) return;
    if (blockedOnly && !isBlocked(node.status)) return;
    if (statusFilter && node.status !== statusFilter) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(edge: CompanyGraphEdge): void {
    if (edgeIds.has(edge.id)) return; // Deduplicate
    edgeIds.add(edge.id);
    edges.push(edge);
  }

  // -------------------------------------------------------------------------
  // 1. Niches
  // -------------------------------------------------------------------------
  const niches = (await state.opportunityReader?.listNiches()) ?? [];
  for (const niche of niches) {
    addNode({
      id: `niche:${niche.id}`,
      type: 'Niche',
      label: niche.name,
      status: niche.status,
      metadata: {
        nicheId: niche.id,
        description: niche.description,
        geographies: niche.geographies,
        priority: niche.priority,
        outreachMode: niche.outreachMode,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 2. Opportunities
  // -------------------------------------------------------------------------
  const allOpportunities = (await state.opportunityReader?.listOpportunities()) ?? [];
  const filteredOpportunities = effectiveOpportunityId
    ? allOpportunities.filter((o) => o.id === effectiveOpportunityId)
    : allOpportunities;

  for (const opp of filteredOpportunities) {
    addNode({
      id: `opp:${opp.id}`,
      type: 'Opportunity',
      label: opp.title,
      status: opp.status,
      metadata: {
        opportunityId: opp.id,
        type: opp.type,
        geography: opp.geography,
        market: opp.market,
        score: opp.score?.overall,
        recommendation: opp.score?.recommendation,
        estimatedValueMin: opp.estimatedValueMin,
        estimatedValueMax: opp.estimatedValueMax,
        currency: opp.currency,
        timeToRevenueDays: opp.timeToRevenueDays,
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
      },
    });

    // Niche → Opportunity
    if (opp.nicheId) {
      const eid = edgeId(`niche:${opp.nicheId}`, `opp:${opp.id}`, 'niche_opportunity');
      addEdge({ id: eid, source: `niche:${opp.nicheId}`, target: `opp:${opp.id}`, type: 'niche_opportunity', metadata: {} });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Prospects (BusinessProspect) + Contacts
  // -------------------------------------------------------------------------
  const nicheIds = niches.map((n) => n.id);
  const prospectMap = new Map<string, string>(); // businessId → node id

  for (const nicheId of nicheIds) {
    const latestRun = await state.opportunityReader?.getLatestRun(nicheId);
    if (!latestRun) continue;

    const candidates = (await state.opportunityReader?.listDiscoveryCandidates(latestRun.runId)) ?? [];
    const seen = new Set<string>();
    for (const cand of candidates) {
      // BusinessId is derived from externalId+name+website+geography (same as server.ts identityIdFor)
      const business = await state.opportunityReader?.getBusiness(cand.externalId ?? cand.name);
      const bid = business?.id ?? cand.externalId ?? `cand:${cand.name}:${nicheId}`;
      if (seen.has(bid)) continue;
      seen.add(bid);

      const prospectNodeId = `prospect:${bid}`;
      prospectMap.set(bid, prospectNodeId);

      addNode({
        id: prospectNodeId,
        type: 'Prospect',
        label: business?.name ?? cand.name,
        status: 'discovered',
        metadata: {
          businessId: bid,
          name: business?.name ?? cand.name,
          website: business?.website ?? cand.websiteUrl,
          geography: cand.geography,
          industry: cand.industry ?? business?.industry,
          nicheId,
          discoveredAt: cand.discoveredAt,
        },
      });

      // Opportunity → Prospect
      const oppForProspect = filteredOpportunities.find((o) => o.businessId === bid);
      if (oppForProspect) {
        addEdge({
          id: edgeId(`opp:${oppForProspect.id}`, prospectNodeId, 'opportunity_prospect'),
          source: `opp:${oppForProspect.id}`,
          target: prospectNodeId,
          type: 'opportunity_prospect',
          metadata: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Deals, Contacts, Outreach, Proposals
  // -------------------------------------------------------------------------
  const deals = (await state.commercialPipeline?.listDeals()) ?? [];

  for (const deal of deals) {
    const dealNodeId = `deal:${deal.id}`;

    addNode({
      id: dealNodeId,
      type: 'Deal',
      label: deal.title,
      status: deal.stage,
      metadata: {
        dealId: deal.id,
        opportunityId: deal.opportunityId,
        stage: deal.stage,
        estimatedValue: deal.estimatedValue,
        currency: deal.currency,
        primaryProspectId: deal.primaryProspectId,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
    });

    // Opportunity → Deal
    if (deal.opportunityId) {
      addEdge({
        id: edgeId(`opp:${deal.opportunityId}`, dealNodeId, 'opportunity_deal'),
        source: `opp:${deal.opportunityId}`,
        target: dealNodeId,
        type: 'opportunity_deal',
        metadata: {},
      });
    }

    // Prospect → Deal (via outreach edge)
    if (deal.primaryProspectId) {
      const prospectNodeId = `prospect:${deal.primaryProspectId}`;
      addEdge({
        id: edgeId(prospectNodeId, dealNodeId, 'outreach_deal'),
        source: prospectNodeId,
        target: dealNodeId,
        type: 'outreach_deal',
        metadata: {},
      });
    }

    // Contacts
    const contacts = (await state.commercialPipeline?.listContacts(deal.primaryProspectId)) ?? [];
    for (const contact of contacts) {
      const contactNodeId = `contact:${contact.id}`;
      addNode({
        id: contactNodeId,
        type: 'Contact',
        label: contact.name,
        status: contact.verificationStatus,
        metadata: {
          contactId: contact.id,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          verificationStatus: contact.verificationStatus,
          isPrimary: contact.isPrimary,
          prospectId: contact.prospectId,
        },
      });
      const prospectNodeId = `prospect:${contact.prospectId}`;
      addEdge({
        id: edgeId(prospectNodeId, contactNodeId, 'prospect_contact'),
        source: prospectNodeId,
        target: contactNodeId,
        type: 'prospect_contact',
        metadata: {},
      });
    }

    // Proposals
    const proposals = (await state.commercialPipeline?.listProposals(deal.id)) ?? [];
    for (const proposal of proposals) {
      const proposalNodeId = `proposal:${proposal.id}`;
      addNode({
        id: proposalNodeId,
        type: 'Proposal',
        label: proposal.title,
        status: proposal.status,
        metadata: {
          proposalId: proposal.id,
          scope: proposal.scope,
          pricingModel: proposal.pricingModel,
          totalAmount: proposal.totalAmount,
          currency: proposal.currency,
          status: proposal.status,
          validUntil: proposal.validUntil,
        },
      });
      addEdge({
        id: edgeId(dealNodeId, proposalNodeId, 'deal_proposal'),
        source: dealNodeId,
        target: proposalNodeId,
        type: 'deal_proposal',
        metadata: {},
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Projects (Work Management)
  // -------------------------------------------------------------------------
  const projectFilter = effectiveProjectId ? { projectId: effectiveProjectId } : undefined;
  const projects = (await state.projectStore?.list(projectFilter ? { status: undefined } : undefined)) ?? [];
  const filteredProjects = effectiveProjectId ? projects.filter((p) => p.projectId === effectiveProjectId) : projects;

  for (const project of filteredProjects) {
    const projectNodeId = `project:${project.projectId}`;
    addNode({
      id: projectNodeId,
      type: 'Project',
      label: project.name,
      status: project.status,
      metadata: {
        projectId: project.projectId,
        status: project.status,
        owner: project.owner,
        sourceOpportunityId: project.sourceOpportunityId,
        registryProjectId: project.registryProjectId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });

    // Opportunity → Project
    if (project.sourceOpportunityId) {
      addEdge({
        id: edgeId(`opp:${project.sourceOpportunityId}`, projectNodeId, 'opportunity_project'),
        source: `opp:${project.sourceOpportunityId}`,
        target: projectNodeId,
        type: 'opportunity_project',
        metadata: {},
      });
      // Also Deal → Project (if a deal exists for this opportunity)
      const relatedDeal = deals.find((d) => d.opportunityId === project.sourceOpportunityId);
      if (relatedDeal) {
        addEdge({
          id: edgeId(`deal:${relatedDeal.id}`, projectNodeId, 'deal_project'),
          source: `deal:${relatedDeal.id}`,
          target: projectNodeId,
          type: 'deal_project',
          metadata: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Requirements
  // -------------------------------------------------------------------------
  if (state.requirementStore) {
    const requirements = (await state.requirementStore.list(effectiveProjectId ? { projectId: effectiveProjectId } : {})) ?? [];
    for (const req of requirements) {
      const reqNodeId = `req:${req.requirementId}`;
      addNode({
        id: reqNodeId,
        type: 'Requirement',
        label: req.title,
        status: req.status,
        metadata: {
          requirementId: req.requirementId,
          projectId: req.projectId,
          problem: req.problem,
          desiredOutcome: req.desiredOutcome,
          status: req.status,
          opportunityId: req.opportunityId,
          source: req.source,
          createdAt: req.createdAt,
        },
      });
      if (req.projectId) {
        addEdge({
          id: edgeId(`project:${req.projectId}`, reqNodeId, 'project_requirement'),
          source: `project:${req.projectId}`,
          target: reqNodeId,
          type: 'project_requirement',
          metadata: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. Agents
  // -------------------------------------------------------------------------
  const allAgents = (await state.agentRegistry?.list()) ?? [];
  const filteredAgents = effectiveAgentId ? allAgents.filter((a) => a.agentId === effectiveAgentId) : allAgents;

  // Build project → agent edges via tasks
  const agentProjectMap = new Map<string, string>(); // agentId → projectId
  if (state.taskStore) {
    const tasks = await state.taskStore.list(effectiveProjectId ? { projectId: effectiveProjectId } : undefined);
    for (const task of tasks) {
      if (task.assignedAgentId && task.projectId) {
        agentProjectMap.set(task.assignedAgentId, task.projectId);
      }
    }
  }

  for (const agent of filteredAgents) {
    const agentNodeId = `agent:${agent.agentId}`;
    addNode({
      id: agentNodeId,
      type: 'Agent',
      label: agent.name ?? agent.specialistId,
      status: agent.status,
      metadata: {
        agentId: agent.agentId,
        specialistId: agent.specialistId,
        department: agent.department,
        status: agent.status,
        currentWorkPackageId: agent.currentWorkPackageId,
        lastSeenAt: agent.lastSeenAt,
      },
    });

    // Project → Agent (via task assignment)
    const agentProjId = agentProjectMap.get(agent.agentId);
    if (agentProjId) {
      addEdge({
        id: edgeId(`project:${agentProjId}`, agentNodeId, 'project_agent'),
        source: `project:${agentProjId}`,
        target: agentNodeId,
        type: 'project_agent',
        metadata: {},
      });
    }
  }

  // -------------------------------------------------------------------------
  // 8. Work Packages
  // -------------------------------------------------------------------------
  const workPackages = effectiveProjectId
    ? state.workPackages.filter((wp) => wp.projectId === effectiveProjectId)
    : effectiveAgentId
      ? state.workPackages.filter((wp) => filteredAgents.some((a) => a.currentWorkPackageId === wp.workPackageId))
      : state.workPackages;

  for (const wp of workPackages) {
    const wpNodeId = `wp:${wp.workPackageId}`;
    addNode({
      id: wpNodeId,
      type: 'WorkPackage',
      label: `${wp.specialistId} — ${wp.stage}`,
      status: wp.status,
      metadata: {
        workPackageId: wp.workPackageId,
        execId: wp.execId,
        specialistId: wp.specialistId,
        stage: wp.stage,
        status: wp.status,
        projectId: wp.projectId,
        updatedAt: wp.updatedAt,
        errorMessage: wp.errorMessage,
      },
    });

    // Agent → WorkPackage
    const assignedAgent = filteredAgents.find((a) => a.currentWorkPackageId === wp.workPackageId);
    if (assignedAgent) {
      addEdge({
        id: edgeId(`agent:${assignedAgent.agentId}`, wpNodeId, 'agent_workpackage'),
        source: `agent:${assignedAgent.agentId}`,
        target: wpNodeId,
        type: 'agent_workpackage',
        metadata: {},
      });
    }

    // Project → WorkPackage
    if (wp.projectId) {
      const projNodeId = `project:${wp.projectId}`;
      if (nodeIds.has(projNodeId)) {
        addEdge({
          id: edgeId(projNodeId, wpNodeId, 'project_workpackage'),
          source: projNodeId,
          target: wpNodeId,
          type: 'project_workpackage',
          metadata: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 8b. Quality Gates (Awaiting CEO Review)
  // -------------------------------------------------------------------------
  const pendingGates = (await state.controlPlane?.listPending()) ?? [];
  const filteredGates = effectiveProjectId
    ? pendingGates.filter((g) => {
        const wp = state.workPackages.find((w) => w.workPackageId === g.workPackageId);
        return wp?.projectId === effectiveProjectId;
      })
    : pendingGates;

  for (const gate of filteredGates) {
    const gateNodeId = `gate:${gate.gateId}`;
    addNode({
      id: gateNodeId,
      type: 'Gate',
      label: `Gate: ${gate.gateId}`,
      status: 'AwaitingReview',
      metadata: {
        waitId: gate.waitId,
        gateId: gate.gateId,
        workPackageId: gate.workPackageId,
        rationale: gate.rationale,
        stageFrom: gate.stageFrom,
        stageTo: gate.stageTo,
        requestedAt: gate.requestedAt,
      },
    });

    // WorkPackage → Gate
    const wpNodeId = `wp:${gate.workPackageId}`;
    if (nodeIds.has(wpNodeId)) {
      addEdge({
        id: edgeId(wpNodeId, gateNodeId, 'workpackage_gate'),
        source: wpNodeId,
        target: gateNodeId,
        type: 'workpackage_gate',
        metadata: {},
      });
    }

    // Gate → Artifact
    if (gate.artifactId) {
      const artNodeId = `artifact:${gate.artifactId}`;
      const artifact = await state.artifactStore?.get(gate.artifactId);
      if (artifact) {
        addNode({
          id: artNodeId,
          type: 'Artifact',
          label: artifact.artifactType,
          status: artifact.acceptanceStatus,
          metadata: {
            artifactId: artifact.artifactId,
            artifactType: artifact.artifactType,
            version: artifact.version,
            producedBy: artifact.producedBy,
            acceptanceStatus: artifact.acceptanceStatus,
            createdAt: artifact.createdAt,
          },
        });
      }
      addEdge({
        id: edgeId(gateNodeId, artNodeId, 'gate_artifact'),
        source: gateNodeId,
        target: artNodeId,
        type: 'gate_artifact',
        metadata: {},
      });
    }
  }

  // -------------------------------------------------------------------------
  // 9. Agent Runs
  // -------------------------------------------------------------------------
  const agentRunStore = state.agentRunReadModel;
  if (agentRunStore) {
    const allRuns = await agentRunStore.list();
    const filteredRuns = effectiveAgentId
      ? allRuns.filter((r) => r.agentId === effectiveAgentId)
      : effectiveProjectId
        ? allRuns.filter((r) => workPackages.some((wp) => wp.workPackageId === r.workPackageId))
        : allRuns;

    for (const run of filteredRuns) {
      const runNodeId = `run:${run.workPackageId}`;
      addNode({
        id: runNodeId,
        type: 'AgentRun',
        label: `Run: ${run.specialistId ?? run.agentId ?? run.workPackageId}`,
        status: run.status,
        metadata: {
          workPackageId: run.workPackageId,
          agentId: run.agentId,
          specialistId: run.specialistId,
          status: run.status,
          currentTool: run.currentTool,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          artifactId: run.artifactId,
          summary: run.summary,
          errorMessage: run.errorMessage,
        },
      });

      // WorkPackage → AgentRun
      const wpNodeId = `wp:${run.workPackageId}`;
      if (nodeIds.has(wpNodeId)) {
        addEdge({
          id: edgeId(wpNodeId, runNodeId, 'workpackage_agentrun'),
          source: wpNodeId,
          target: runNodeId,
          type: 'workpackage_agentrun',
          metadata: {},
        });
      }

      // AgentRun → Artifact & WorkPackage → Artifact
      if (run.artifactId) {
        const artifact = await state.artifactStore?.get(run.artifactId);
        if (artifact) {
          const artNodeId = `artifact:${artifact.artifactId}`;
          addNode({
            id: artNodeId,
            type: 'Artifact',
            label: artifact.artifactType,
            status: artifact.acceptanceStatus,
            metadata: {
              artifactId: artifact.artifactId,
              artifactType: artifact.artifactType,
              version: artifact.version,
              producedBy: artifact.producedBy,
              acceptanceStatus: artifact.acceptanceStatus,
              createdAt: artifact.createdAt,
            },
          });
          addEdge({
            id: edgeId(runNodeId, artNodeId, 'agentrun_artifact'),
            source: runNodeId,
            target: artNodeId,
            type: 'agentrun_artifact',
            metadata: {},
          });

          if (nodeIds.has(wpNodeId)) {
            addEdge({
              id: edgeId(wpNodeId, artNodeId, 'workpackage_artifact'),
              source: wpNodeId,
              target: artNodeId,
              type: 'workpackage_artifact',
              metadata: {},
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 10. Artifacts (standalone — not already added via AgentRun)
  // -------------------------------------------------------------------------
  if (state.artifactStore) {
    const allArtifacts = await state.artifactStore.list();
    for (const artifact of allArtifacts) {
      const artNodeId = `artifact:${artifact.artifactId}`;
      if (!nodeIds.has(artNodeId)) {
        addNode({
          id: artNodeId,
          type: 'Artifact',
          label: artifact.artifactType,
          status: artifact.acceptanceStatus,
          metadata: {
            artifactId: artifact.artifactId,
            artifactType: artifact.artifactType,
            version: artifact.version,
            producedBy: artifact.producedBy,
            acceptanceStatus: artifact.acceptanceStatus,
            createdAt: artifact.createdAt,
          },
        });
      }

      // Link Artifact to matching WorkPackage if known
      const targetWp = workPackages.find(
        (wp) =>
          wp.workPackageId === artifact.producedBy ||
          wp.workPackageId === artifact.producedFor ||
          (artifact as { metadata?: { workPackageId?: string } }).metadata?.workPackageId === wp.workPackageId
      );
      if (targetWp) {
        const wpNodeId = `wp:${targetWp.workPackageId}`;
        if (nodeIds.has(wpNodeId)) {
          addEdge({
            id: edgeId(wpNodeId, artNodeId, 'workpackage_artifact'),
            source: wpNodeId,
            target: artNodeId,
            type: 'workpackage_artifact',
            metadata: {},
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 11. Customers + Learnings
  // -------------------------------------------------------------------------
  const allCustomers = (await state.customerSuccess?.listCustomers()) ?? [];
  const customers = effectiveCustomerId ? allCustomers.filter((c) => c.id === effectiveCustomerId) : allCustomers;
  for (const customer of customers) {
    const customerNodeId = `customer:${customer.id}`;
    addNode({
      id: customerNodeId,
      type: 'Customer',
      label: customer.companyName,
      status: customer.status,
      metadata: {
        customerId: customer.id,
        companyName: customer.companyName,
        status: customer.status,
        mrr: customer.mrr,
        lifetimeValue: customer.lifetimeValue,
        healthScore: customer.healthScore,
        prospectId: customer.prospectId,
        dealId: customer.dealId,
      },
    });

    // Project → Customer
    if (customer.dealId) {
      const deal = deals.find((d) => d.id === customer.dealId);
      const relatedProject = filteredProjects.find((p) => p.sourceOpportunityId === deal?.opportunityId);
      if (relatedProject) {
        addEdge({
          id: edgeId(`project:${relatedProject.projectId}`, customerNodeId, 'project_customer'),
          source: `project:${relatedProject.projectId}`,
          target: customerNodeId,
          type: 'project_customer',
          metadata: {},
        });
      }
    }

    // Prospect → Customer
    if (customer.prospectId) {
      const prospectNodeId = `prospect:${customer.prospectId}`;
      if (nodeIds.has(prospectNodeId)) {
        addEdge({
          id: edgeId(prospectNodeId, customerNodeId, 'opportunity_customer'),
          source: prospectNodeId,
          target: customerNodeId,
          type: 'opportunity_customer',
          metadata: {},
        });
      }
    }
  }

  // Learnings
  const learnings = (await state.customerSuccess?.listLearnings()) ?? [];
  for (const learning of learnings) {
    const learningNodeId = `learning:${learning.id}`;
    addNode({
      id: learningNodeId,
      type: 'Learning',
      label: learning.title,
      status: learning.category,
      metadata: {
        learningId: learning.id,
        category: learning.category,
        keyInsight: learning.keyInsight,
        recommendedActions: learning.recommendedActions,
        sourceType: learning.sourceType,
        projectId: learning.projectId,
        customerId: learning.customerId,
        opportunityId: learning.opportunityId,
        createdAt: learning.createdAt,
      },
    });

    // Project → Learning
    if (learning.projectId) {
      const projectNodeId = `project:${learning.projectId}`;
      if (nodeIds.has(projectNodeId)) {
        addEdge({
          id: edgeId(projectNodeId, learningNodeId, 'project_learning'),
          source: projectNodeId,
          target: learningNodeId,
          type: 'project_learning',
          metadata: {},
        });
      }
    }

    // Customer → Learning
    if (learning.customerId) {
      const customerNodeId = `customer:${learning.customerId}`;
      if (nodeIds.has(customerNodeId)) {
        addEdge({
          id: edgeId(customerNodeId, learningNodeId, 'customer_learning'),
          source: customerNodeId,
          target: learningNodeId,
          type: 'customer_learning',
          metadata: {},
        });
      }
    }

    // Learning → Opportunity (closed calibration loop)
    const effectiveOpportunityId =
      learning.opportunityId ??
      (learning.projectId
        ? filteredProjects.find((p) => p.projectId === learning.projectId)?.sourceOpportunityId
        : undefined);

    if (effectiveOpportunityId) {
      const oppNodeId = `opp:${effectiveOpportunityId}`;
      if (nodeIds.has(oppNodeId)) {
        addEdge({
          id: edgeId(learningNodeId, oppNodeId, 'learning_opportunity'),
          source: learningNodeId,
          target: oppNodeId,
          type: 'learning_opportunity',
          metadata: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 12. Deployments + Incidents (in-memory DeploymentEngine)
  // -------------------------------------------------------------------------
  if (state.deploymentEngine) {
    const engine = state.deploymentEngine as unknown as {
      deploymentsById?: Map<string, { deploymentId: string; projectId: string; targetVersion: string; status: string; environment: string; executedAt?: string }>;
      incidentsById?: Map<string, { incidentId: string; projectId: string; reason: string; severity?: string; occurredAt: string }>;
    };

    if (engine.deploymentsById) {
      for (const dep of engine.deploymentsById.values()) {
        const depNodeId = `deployment:${dep.deploymentId}`;
        addNode({
          id: depNodeId,
          type: 'Deployment',
          label: `Deploy ${dep.targetVersion} → ${dep.environment}`,
          status: dep.status,
          metadata: {
            deploymentId: dep.deploymentId,
            projectId: dep.projectId,
            targetVersion: dep.targetVersion,
            environment: dep.environment,
            status: dep.status,
            executedAt: dep.executedAt,
          },
        });
        if (dep.projectId) {
          addEdge({
            id: edgeId(`project:${dep.projectId}`, depNodeId, 'project_deployment'),
            source: `project:${dep.projectId}`,
            target: depNodeId,
            type: 'project_deployment',
            metadata: {},
          });
        }
      }
    }

    if (engine.incidentsById) {
      for (const inc of engine.incidentsById.values()) {
        const incNodeId = `incident:${inc.incidentId}`;
        addNode({
          id: incNodeId,
          type: 'Incident',
          label: inc.reason,
          status: 'open',
          metadata: {
            incidentId: inc.incidentId,
            projectId: inc.projectId,
            reason: inc.reason,
            severity: inc.severity,
            occurredAt: inc.occurredAt,
          },
        });
        // Find related deployment
        if (engine.deploymentsById) {
          for (const dep of engine.deploymentsById.values()) {
            if (dep.projectId === inc.projectId) {
              const depNodeId = `deployment:${dep.deploymentId}`;
              addEdge({
                id: edgeId(depNodeId, incNodeId, 'deployment_incident'),
                source: depNodeId,
                target: incNodeId,
                type: 'deployment_incident',
                metadata: {},
              });
              break;
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Filtering & Neighborhood Expansion
  // -------------------------------------------------------------------------
  const totalNodesBeforeLimit = nodes.length;
  let finalNodes = nodes;
  let finalEdges = edges;
  const filtered =
    !!(nodeTypes ?? projectId ?? opportunityId ?? agentId ?? customerId ?? statusFilter ?? search ?? depth) ||
    activeOnly ||
    blockedOnly;

  // Apply depth-based neighborhood expansion (if focal filter + depth >= 1)
  if (isNeighborhoodExpansion) {
    let focalIds = new Set<string>();
    if (projectId) focalIds.add(`project:${projectId}`);
    if (opportunityId) focalIds.add(`opp:${opportunityId}`);
    if (agentId) focalIds.add(`agent:${agentId}`);
    if (customerId) focalIds.add(`customer:${customerId}`);

    for (let d = 0; d < depth!; d++) {
      const nextHop = new Set(focalIds);
      for (const edge of edges) {
        if (focalIds.has(edge.source)) nextHop.add(edge.target);
        if (focalIds.has(edge.target)) nextHop.add(edge.source);
      }
      focalIds = nextHop;
    }

    finalNodes = nodes.filter((n) => focalIds.has(n.id));
    const finalNodeIds = new Set(finalNodes.map((n) => n.id));
    finalEdges = edges.filter((e) => finalNodeIds.has(e.source) && finalNodeIds.has(e.target));
  }

  // -------------------------------------------------------------------------
  // Apply search filter
  // -------------------------------------------------------------------------
  if (search && search.trim().length > 0) {
    const searchQuery = search.trim();
    const matchingIds = new Set(finalNodes.filter((n) => matchesSearch(n, searchQuery)).map((n) => n.id));
    // Also include direct neighbors of matching nodes
    for (const edge of finalEdges) {
      if (matchingIds.has(edge.source)) matchingIds.add(edge.target);
      if (matchingIds.has(edge.target)) matchingIds.add(edge.source);
    }
    finalNodes = finalNodes.filter((n) => matchingIds.has(n.id));
    const finalNodeIds = new Set(finalNodes.map((n) => n.id));
    finalEdges = finalEdges.filter((e) => finalNodeIds.has(e.source) && finalNodeIds.has(e.target));
  }

  // -------------------------------------------------------------------------
  // Apply limit (after search narrowing)
  // -------------------------------------------------------------------------
  if (finalNodes.length > limit) {
    finalNodes = finalNodes.slice(0, limit);
    const limitedIds = new Set(finalNodes.map((n) => n.id));
    finalEdges = finalEdges.filter((e) => limitedIds.has(e.source) && limitedIds.has(e.target));
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    generatedAt: new Date().toISOString(),
    filtered,
    totalNodesBeforeLimit,
  };
}
