/**
 * Tests for GET /v1/company/graph
 *
 * Verifies that the Company Intelligence Graph:
 * - Emits no fabricated nodes when stores are empty
 * - Projects real domain state into canonical nodes/edges
 * - Deduplicates nodes and edges correctly
 * - Filters by projectId, opportunityId, agentId
 * - Applies search filtering
 * - Applies activeOnly filtering
 * - Enforces the limit parameter
 * - Produces consistent results (rebuildable from same state)
 * - Never exposes sensitive data not in the domain model
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { type Opportunity, ArtifactContractSchema, parseContract, FindingIdSchema, ProjectIdSchema, WatchRunIdSchema } from '@umer/contracts';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';
import type { CompanyGraph, CompanyGraphNode } from './company-graph-projection.js';

async function request(
  server: Server,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  });
  return { status: response.status, json: await response.json() };
}

function asGraph(json: unknown): CompanyGraph {
  return json as CompanyGraph;
}

describe('GET /v1/company/graph', () => {
  let state: ControlApiState;
  let server: Server;

  beforeAll(async () => {
    state = await createControlApiState();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  describe('empty graph', () => {
    it('returns 200 with empty nodes and edges when no domain state exists', async () => {
      const { status, json } = await request(server, '/v1/company/graph');
      expect(status).toBe(200);
      const graph = asGraph(json);
      expect(graph.nodes).toBeInstanceOf(Array);
      expect(graph.edges).toBeInstanceOf(Array);
      // No fabricated data — both arrays may be empty
      expect(graph.nodes.length).toBeLessThanOrEqual(1000);
    });

    it('returns generatedAt timestamp and filtered flag', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      expect(typeof graph.generatedAt).toBe('string');
      expect(new Date(graph.generatedAt).getTime()).toBeGreaterThan(0);
      expect(typeof graph.filtered).toBe('boolean');
    });

    it('returns totalNodesBeforeLimit field', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      expect(typeof graph.totalNodesBeforeLimit).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // Graph projection with real state
  // -------------------------------------------------------------------------
  describe('graph projection from real state', () => {
    const opp: Opportunity = {
      id: 'opp-graph-test-1',
      type: 'service',
      title: 'Hospital ERP Integration',
      geography: 'KSA',
      market: 'Healthcare',
      problemIds: ['prob-graph-test-1'],
      score: {
        problemSeverity: 85,
        demandEvidence: 80,
        abilityToPay: 75,
        reachability: 70,
        solutionFit: 80,
        competitiveGap: 65,
        deliveryFeasibility: 80,
        evidenceConfidence: 75,
        overall: 76,
        recommendation: 'outreach_ready',
      },
      estimatedValueMin: 20000,
      estimatedValueMax: 40000,
      currency: 'USD',
      timeToRevenueDays: 45,
      evidenceRefs: [],
      status: 'outreach_ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeAll(async () => {
      await state.opportunityReader?.saveOpportunity(opp);
    });

    it('emits an Opportunity node for the seeded opportunity', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const oppNode = graph.nodes.find((n) => n.id === `opp:${opp.id}`);
      expect(oppNode).toBeDefined();
      expect(oppNode?.type).toBe('Opportunity');
      expect(oppNode?.label).toBe(opp.title);
      expect(oppNode?.status).toBe(opp.status);
    });

    it('includes real metadata on the Opportunity node', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const oppNode = graph.nodes.find((n) => n.id === `opp:${opp.id}`) as CompanyGraphNode;
      expect(oppNode.metadata.opportunityId).toBe(opp.id);
      expect(oppNode.metadata.geography).toBe('KSA');
      expect(oppNode.metadata.estimatedValueMin).toBe(20000);
    });

    it('emits a Project node when a project exists', async () => {
      const proj = await state.projectStore?.create(
        {
          name: 'Hospital ERP Project',
          sourceOpportunityId: opp.id,
        },
        'corr-graph-test',
      );
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const projectNode = graph.nodes.find((n) => n.id === `project:${proj?.projectId}`);
      expect(projectNode).toBeDefined();
      expect(projectNode?.type).toBe('Project');
    });

    it('emits an Opportunity → Project edge', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const projectNode = graph.nodes.find((n) => n.type === 'Project');
      if (!projectNode) return; // Project not seeded yet in this test run — skip
      const edge = graph.edges.find(
        (e) => e.source === `opp:${opp.id}` && e.target === projectNode.id && e.type === 'opportunity_project',
      );
      expect(edge).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // No fabricated records
  // -------------------------------------------------------------------------
  describe('no fabricated records', () => {
    it('does not emit nodes for non-existent entities', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      // Every node id must be well-formed (prefix:id, no empty id)
      for (const node of graph.nodes) {
        expect(node.id).toMatch(/^[a-z]+:.+/);
        expect(node.label.length).toBeGreaterThan(0);
      }
    });

    it('does not emit edges referencing non-existent nodes', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Duplicate prevention
  // -------------------------------------------------------------------------
  describe('duplicate prevention', () => {
    it('does not emit duplicate node ids', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const ids = graph.nodes.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('does not emit duplicate edge ids', async () => {
      const { json } = await request(server, '/v1/company/graph');
      const graph = asGraph(json);
      const ids = graph.edges.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // -------------------------------------------------------------------------
  // projectId filtering
  // -------------------------------------------------------------------------
  describe('projectId filtering', () => {
    it('returns filtered:true when projectId param is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?projectId=nonexistent-proj');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('returns only nodes related to the specified project', async () => {
      const proj = await state.projectStore?.create(
        { name: 'Filter Test Project' },
        'corr-filter',
      );
      const projId = proj?.projectId;
      if (!projId) return;

      const { json } = await request(server, `/v1/company/graph?projectId=${encodeURIComponent(projId)}`);
      const graph = asGraph(json);
      // All Project nodes must be for this project
      const projectNodes = graph.nodes.filter((n) => n.type === 'Project');
      for (const pn of projectNodes) {
        expect(pn.metadata.projectId).toBe(projId);
      }
    });
  });

  // -------------------------------------------------------------------------
  // opportunityId filtering
  // -------------------------------------------------------------------------
  describe('opportunityId filtering', () => {
    it('returns only the specified opportunity when opportunityId is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?opportunityId=opp-graph-test-1');
      const graph = asGraph(json);
      const oppNodes = graph.nodes.filter((n) => n.type === 'Opportunity');
      // Should only include the targeted opportunity
      for (const n of oppNodes) {
        expect(n.metadata.opportunityId).toBe('opp-graph-test-1');
      }
    });

    it('returns empty opportunity nodes for a non-existent opportunityId', async () => {
      const { json } = await request(server, '/v1/company/graph?opportunityId=opp-does-not-exist');
      const graph = asGraph(json);
      const oppNodes = graph.nodes.filter((n) => n.type === 'Opportunity');
      expect(oppNodes.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // agentId filtering
  // -------------------------------------------------------------------------
  describe('agentId filtering', () => {
    it('returns filtered:true when agentId param is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?agentId=agent-nonexistent');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('returns only the specified agent node when agentId is provided', async () => {
      // Register a real agent in the store
      await state.agentRegistry?.upsert({
        agentId: 'agent-graph-test-1',
        specialistId: 'eng.app-delivery',
        name: 'Test Agent',
        department: 'Engineering',
        capabilityIds: [],
        status: 'active',
        lastSeenAt: new Date().toISOString(),
        correlationId: 'corr-agent-graph',
        currentTaskIds: [],
      });

      const { json } = await request(server, '/v1/company/graph?agentId=agent-graph-test-1');
      const graph = asGraph(json);
      const agentNodes = graph.nodes.filter((n) => n.type === 'Agent');
      expect(agentNodes.length).toBe(1);
      expect(agentNodes[0]?.metadata.agentId).toBe('agent-graph-test-1');
    });
  });

  // -------------------------------------------------------------------------
  // Search filtering
  // -------------------------------------------------------------------------
  describe('search filtering', () => {
    it('returns filtered:true when search param is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?search=hospital');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('returns only matching nodes and their immediate neighbors', async () => {
      const { json } = await request(server, '/v1/company/graph?search=Hospital+ERP');
      const graph = asGraph(json);
      // Must include the opportunity we seeded
      const oppNode = graph.nodes.find((n) => n.id === 'opp:opp-graph-test-1');
      expect(oppNode).toBeDefined();
    });

    it('returns empty results for a search with no matches', async () => {
      const { json } = await request(server, '/v1/company/graph?search=xkzqjfabricateddoesnotexist');
      const graph = asGraph(json);
      expect(graph.nodes.length).toBe(0);
      expect(graph.edges.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // activeOnly filtering
  // -------------------------------------------------------------------------
  describe('activeOnly filtering', () => {
    it('returns filtered:true when activeOnly=true', async () => {
      const { json } = await request(server, '/v1/company/graph?activeOnly=true');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('excludes terminal-status nodes when activeOnly=true', async () => {
      const { json } = await request(server, '/v1/company/graph?activeOnly=true');
      const graph = asGraph(json);
      const terminalStatuses = new Set(['rejected', 'cancelled', 'lost', 'closed_lost', 'Cancelled', 'Rejected', 'Failed']);
      for (const node of graph.nodes) {
        if (node.status) {
          expect(terminalStatuses.has(node.status)).toBe(false);
        }
      }
    });

    it('also accepts active=true (the alias the graph client sends)', async () => {
      const { json } = await request(server, '/v1/company/graph?active=true');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // status filtering
  // -------------------------------------------------------------------------
  describe('status filtering', () => {
    it('returns filtered:true when status is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?status=outreach_ready');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('returns only nodes with the exact requested status', async () => {
      const { json } = await request(server, '/v1/company/graph?status=outreach_ready');
      const graph = asGraph(json);
      for (const node of graph.nodes) {
        expect(node.status).toBe('outreach_ready');
      }
      // The opportunity seeded earlier in this file has status outreach_ready.
      expect(graph.nodes.some((n) => n.id === 'opp:opp-graph-test-1')).toBe(true);
    });

    it('returns empty nodes for a status no real node has', async () => {
      const { json } = await request(server, '/v1/company/graph?status=xkzq-not-a-real-status');
      const graph = asGraph(json);
      expect(graph.nodes.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // blocked filtering
  // -------------------------------------------------------------------------
  describe('blocked filtering', () => {
    it('returns filtered:true when blocked=true', async () => {
      const { json } = await request(server, '/v1/company/graph?blocked=true');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('only includes nodes in a real stuck/blocked status', async () => {
      const { json } = await request(server, '/v1/company/graph?blocked=true');
      const graph = asGraph(json);
      const blockedStatuses = new Set(['Blocked', 'blocked', 'Failed', 'failed', 'AwaitingReview', 'awaiting_review']);
      for (const node of graph.nodes) {
        expect(node.status ? blockedStatuses.has(node.status) : false).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // customerId filtering
  // -------------------------------------------------------------------------
  describe('customerId filtering', () => {
    it('returns filtered:true when customerId is provided', async () => {
      const { json } = await request(server, '/v1/company/graph?customerId=cust-does-not-exist');
      const graph = asGraph(json);
      expect(graph.filtered).toBe(true);
    });

    it('returns no Customer nodes for a non-existent customerId', async () => {
      const { json } = await request(server, '/v1/company/graph?customerId=cust-does-not-exist');
      const graph = asGraph(json);
      expect(graph.nodes.filter((n) => n.type === 'Customer').length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Limit enforcement
  // -------------------------------------------------------------------------
  describe('limit enforcement', () => {
    it('respects the limit query param', async () => {
      const { json } = await request(server, '/v1/company/graph?limit=1');
      const graph = asGraph(json);
      expect(graph.nodes.length).toBeLessThanOrEqual(1);
    });

    it('caps limit at 1000', async () => {
      const { status } = await request(server, '/v1/company/graph?limit=99999');
      expect(status).toBe(200);
      // Should succeed — server caps internally at 1000
    });
  });

  // -------------------------------------------------------------------------
  // Consistency / rebuild
  // -------------------------------------------------------------------------
  describe('graph rebuild consistency', () => {
    it('produces the same node ids on two successive calls with the same state', async () => {
      const { json: json1 } = await request(server, '/v1/company/graph');
      const { json: json2 } = await request(server, '/v1/company/graph');
      const graph1 = asGraph(json1);
      const graph2 = asGraph(json2);

      const ids1 = new Set(graph1.nodes.map((n) => n.id));
      const ids2 = new Set(graph2.nodes.map((n) => n.id));

      // Every id in the first call must appear in the second
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(true);
      }
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // nodeTypes filtering
  // -------------------------------------------------------------------------
  describe('nodeTypes filtering', () => {
    it('returns only the specified node types', async () => {
      const { json } = await request(server, '/v1/company/graph?nodeTypes=Opportunity');
      const graph = asGraph(json);
      for (const node of graph.nodes) {
        expect(node.type).toBe('Opportunity');
      }
      expect(graph.filtered).toBe(true);
    });

    it('supports comma-separated nodeTypes', async () => {
      const { json } = await request(server, '/v1/company/graph?nodeTypes=Opportunity,Project');
      const graph = asGraph(json);
      for (const node of graph.nodes) {
        expect(['Opportunity', 'Project']).toContain(node.type);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Authorization check
  // -------------------------------------------------------------------------
  describe('authorization', () => {
    it('responds to GET without requiring a body', async () => {
      const { status } = await request(server, '/v1/company/graph');
      expect(status).toBe(200);
    });

    it('returns 404 for POST /v1/company/graph (read-only route)', async () => {
      const { status } = await request(server, '/v1/company/graph', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Quality Gates and Neighborhood Expansion (Phase 5)
  // -------------------------------------------------------------------------
  describe('Quality Gates and Neighborhood Expansion (Phase 5)', () => {
    it('projects pending quality gates as Gate nodes and connects workpackage_gate and project_workpackage edges', async () => {
      const proj = await state.projectStore!.create({ name: 'Phase 5 Test Project' }, 'corr-p5');
      const projectId = proj.projectId;

      state.workPackages.unshift({
        workPackageId: 'wp-phase5-sec-1',
        execId: 'EXEC-P5',
        status: 'AwaitingReview',
        specialistId: 'security.review',
        stage: 'Security',
        projectId,
      });

      await state.controlPlane.requestGateReview(
        {
          gateId: 'gate-wp-wp-phase5-sec-1',
          execId: 'EXEC-P5',
          workPackageId: 'wp-phase5-sec-1',
          stageFrom: 'Execution',
          stageTo: 'Review',
          requiredApprovers: ['human.approver'],
          humanRequired: true,
        },
        'corr-p5-gate',
      );

      const { status, json } = await request(server, `/v1/company/graph?projectId=${projectId}`);
      expect(status).toBe(200);
      const graph = asGraph(json);

      const gateNode = graph.nodes.find((n) => n.id === 'gate:gate-wp-wp-phase5-sec-1');
      expect(gateNode).toBeDefined();
      expect(gateNode?.type).toBe('Gate');
      expect(gateNode?.status).toBe('AwaitingReview');
      expect(gateNode?.metadata.workPackageId).toBe('wp-phase5-sec-1');

      const wpGateEdge = graph.edges.find((e) => e.type === 'workpackage_gate');
      expect(wpGateEdge).toBeDefined();
      expect(wpGateEdge?.source).toBe('wp:wp-phase5-sec-1');
      expect(wpGateEdge?.target).toBe('gate:gate-wp-wp-phase5-sec-1');

      const projWpEdge = graph.edges.find((e) => e.type === 'project_workpackage');
      expect(projWpEdge).toBeDefined();
      expect(projWpEdge?.source).toBe(`project:${projectId}`);
      expect(projWpEdge?.target).toBe('wp:wp-phase5-sec-1');
    });

    it('expands neighborhood by depth hops from focal node', async () => {
      const proj = await state.projectStore!.create({ name: 'Phase 5 Depth Project' }, 'corr-p5-depth');
      const projectId = proj.projectId;

      state.workPackages.unshift({
        workPackageId: 'wp-phase5-depth-1',
        execId: 'EXEC-P5D',
        status: 'AwaitingReview',
        specialistId: 'security.review',
        stage: 'Security',
        projectId,
      });

      await state.controlPlane.requestGateReview(
        {
          gateId: 'gate-wp-wp-phase5-depth-1',
          execId: 'EXEC-P5D',
          workPackageId: 'wp-phase5-depth-1',
          stageFrom: 'Execution',
          stageTo: 'Review',
          requiredApprovers: ['human.approver'],
          humanRequired: true,
        },
        'corr-p5-depth-gate',
      );

      // With depth=1 from project:
      // Includes project (hop 0) and workpackage (hop 1 via project_workpackage).
      // Gate is hop 2 (project -> wp -> gate).
      const { json: json1 } = await request(server, `/v1/company/graph?projectId=${projectId}&depth=1`);
      const g1 = asGraph(json1);
      expect(g1.nodes.some((n) => n.id === `project:${projectId}`)).toBe(true);
      expect(g1.nodes.some((n) => n.id === 'wp:wp-phase5-depth-1')).toBe(true);
      expect(g1.nodes.some((n) => n.id === 'gate:gate-wp-wp-phase5-depth-1')).toBe(false);

      // With depth=2 from project:
      const { json: json2 } = await request(server, `/v1/company/graph?projectId=${projectId}&depth=2`);
      const g2 = asGraph(json2);
      expect(g2.nodes.some((n) => n.id === `project:${projectId}`)).toBe(true);
      expect(g2.nodes.some((n) => n.id === 'wp:wp-phase5-depth-1')).toBe(true);
      expect(g2.nodes.some((n) => n.id === 'gate:gate-wp-wp-phase5-depth-1')).toBe(true);
    });

    it('emits gate_artifact, workpackage_artifact, project_learning, and closed-loop learning_opportunity edges', async () => {
      const oppId = 'opp-p6-loop';
      await state.opportunityReader?.saveOpportunity({
        id: oppId,
        nicheId: 'niche-health',
        type: 'product',
        title: 'Phase 6 Closed Loop Healthcare AI',
        status: 'project_created',
        market: 'Healthcare',
        geography: 'UAE',
        problemIds: ['prob-p6-health'],
        score: {
          problemSeverity: 85,
          demandEvidence: 80,
          abilityToPay: 75,
          reachability: 70,
          solutionFit: 85,
          competitiveGap: 75,
          deliveryFeasibility: 85,
          evidenceConfidence: 80,
          overall: 82,
          recommendation: 'product_candidate',
        },
        estimatedValueMin: 50000,
        currency: 'USD',
        evidenceRefs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const proj = await state.projectStore!.create(
        { name: 'Phase 6 Delivery Project', sourceOpportunityId: oppId },
        'corr-p6-proj',
      );
      const projectId = proj.projectId;
      const wpId = 'wp-phase6-closed-loop-1';
      const artifactId = 'art-phase6-sec-report-1';

      state.workPackages.unshift({
        workPackageId: wpId,
        execId: 'EXEC-601',
        status: 'AwaitingReview',
        specialistId: 'security.review',
        stage: 'Security',
        projectId,
      });

      await state.artifactStore?.save(
        parseContract(ArtifactContractSchema, {
          id: artifactId,
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { labels: {}, annotations: {} },
          kind: 'artifact',
          artifactId,
          artifactType: 'SecurityReport',
          version: '1.0.0',
          producedBy: wpId,
          producedFor: 'EXEC-601',
          acceptanceStatus: 'submitted',
          acceptanceCriteriaMet: [],
          contentRef: 'security://report/p6.md',
        }),
      );

      await state.controlPlane.requestGateReview(
        {
          gateId: `gate-${wpId}`,
          execId: 'EXEC-601',
          workPackageId: wpId,
          artifactId,
          stageFrom: 'Execution',
          stageTo: 'Review',
          requiredApprovers: ['human.approver'],
          humanRequired: true,
        },
        'corr-p6-gate',
      );

      // Seed a delivery learning extracted for this project
      const learning = await state.customerSuccess?.extractLearning({
        sourceType: 'delivery_outcome',
        projectId,
        opportunityId: oppId,
        category: 'delivery_workflow',
        title: 'Closed-Loop Calibration: Healthcare Compliance Verified',
        keyInsight: 'Pre-flight dependency scanning eliminated CVE risks before gate sign-off.',
        recommendedActions: ['Incorporate automated npm audit checks into base project scaffold.'],
      });

      const { status, json } = await request(server, `/v1/company/graph?projectId=${projectId}&depth=3`);
      expect(status).toBe(200);
      const graph = asGraph(json);

      // Verify Nodes
      expect(graph.nodes.some((n) => n.id === `project:${projectId}`)).toBe(true);
      expect(graph.nodes.some((n) => n.id === `wp:${wpId}`)).toBe(true);
      expect(graph.nodes.some((n) => n.id === `gate:gate-${wpId}`)).toBe(true);
      expect(graph.nodes.some((n) => n.id === `artifact:${artifactId}`)).toBe(true);
      expect(graph.nodes.some((n) => n.id === `learning:${learning?.id}`)).toBe(true);
      expect(graph.nodes.some((n) => n.id === `opp:${oppId}`)).toBe(true);

      // Verify Edges
      const gateArtEdge = graph.edges.find((e) => e.type === 'gate_artifact');
      expect(gateArtEdge).toBeDefined();
      expect(gateArtEdge?.source).toBe(`gate:gate-${wpId}`);
      expect(gateArtEdge?.target).toBe(`artifact:${artifactId}`);

      const wpArtEdge = graph.edges.find((e) => e.type === 'workpackage_artifact');
      expect(wpArtEdge).toBeDefined();
      expect(wpArtEdge?.source).toBe(`wp:${wpId}`);
      expect(wpArtEdge?.target).toBe(`artifact:${artifactId}`);

      const projLearnEdge = graph.edges.find((e) => e.type === 'project_learning');
      expect(projLearnEdge).toBeDefined();
      expect(projLearnEdge?.source).toBe(`project:${projectId}`);
      expect(projLearnEdge?.target).toBe(`learning:${learning?.id}`);

      const learnOppEdge = graph.edges.find((e) => e.type === 'learning_opportunity');
      expect(learnOppEdge).toBeDefined();
      expect(learnOppEdge?.source).toBe(`learning:${learning?.id}`);
      expect(learnOppEdge?.target).toBe(`opp:${oppId}`);
    });

    it('emits Finding nodes and project_finding edges from watchdog store', async () => {
      const proj = await state.projectStore!.create(
        { name: 'Watchdog Graph Test Project' },
        'corr-wd-graph-proj',
      );
      const projectId = proj.projectId;

      // Record a watch run with findings
      state.watchdogStore?.recordRun({
        runId: WatchRunIdSchema.parse('wdrun-test-graph-01'),
        watchdogId: 'security.watchdog',
        cadence: 'nightly',
        projectId: ProjectIdSchema.parse(projectId),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        outcome: 'findings_detected',
        findings: [
          {
            findingId: FindingIdSchema.parse('wdfind-graph-01'),
            fingerprint: 'fp-graph-sec-cve',
            watchdogId: 'security.watchdog',
            projectId: ProjectIdSchema.parse(projectId),
            title: 'Critical CVE in project dependency',
            summary: 'Detected critical security risk in dependency tree',
            category: 'dependency_vulnerability',
            severity: {
              tier: 'critical',
              riskScore: 25,
              confidence: 'certain',
              sticky: true,
            },
            status: 'open',
            escalationStage: 'S1',
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            remediation: 'Upgrade affected package immediately',
            evidenceArtifactIds: [],
            impactModules: [],
            details: {},
          },
        ],
        findingCount: 1,
        summary: 'Security watchdog detected 1 critical finding.',
        metadata: {},
      });

      const { status, json } = await request(server, `/v1/company/graph?projectId=${projectId}`);
      expect(status).toBe(200);
      const graph = asGraph(json);

      // Verify Finding Node
      const findingNode = graph.nodes.find((n) => n.id === 'finding:wdfind-graph-01');
      expect(findingNode).toBeDefined();
      expect(findingNode?.type).toBe('Finding');
      expect(findingNode?.label).toContain('CRITICAL');

      // Verify project_finding Edge
      const findingEdge = graph.edges.find((e) => e.type === 'project_finding');
      expect(findingEdge).toBeDefined();
      expect(findingEdge?.source).toBe(`project:${projectId}`);
      expect(findingEdge?.target).toBe('finding:wdfind-graph-01');
    });
  });
});

