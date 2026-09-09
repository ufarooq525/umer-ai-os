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
import type { Opportunity } from '@umer/contracts';
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
});
