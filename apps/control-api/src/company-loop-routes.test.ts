import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import {
  CompanyOverviewSchema,
  type CompanyLoopCycle,
  type CompanyOverview,
} from '@umer/contracts';
import { DeploymentEngine } from '@umer/registry';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

async function request(
  server: Server,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options?.headers,
    },
  });
  return { status: response.status, json: await response.json() };
}

describe('Company Loop & CEO Overview HTTP Routes', () => {
  let state: ControlApiState;
  let server: Server;

  beforeAll(async () => {
    state = await createControlApiState({
      deploymentEngine: new DeploymentEngine({
        probeRunner: async () => ({ status: 'pass', responseTimeMs: 10 }),
        rollbackRunner: async () => ({ status: 'success' }),
      }),
    });
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('serves GET /v1/company/overview answering the 10 CEO questions', async () => {
    const res = await request(server, '/v1/company/overview');
    expect(res.status).toBe(200);

    const data = res.json as { overview: unknown };
    expect(data.overview).toBeDefined();

    // Verify schema validation passes for the 10 CEO questions
    const overview = CompanyOverviewSchema.parse(data.overview);
    expect(overview.whatCompanyIsDoing).toBeDefined();
    expect(['healthy', 'offline']).toContain(overview.whatCompanyIsDoing.productionStatus);
    expect(Array.isArray(overview.opportunitiesPursued)).toBe(true);
    expect(Array.isArray(overview.prospectsThatMatter)).toBe(true);
    expect(Array.isArray(overview.agentsWorking)).toBe(true);
    expect(overview.projectsByAgent).toBeDefined();
    expect(overview.evidenceSummary).toBeDefined();
    expect(Array.isArray(overview.blockedItems)).toBe(true);
    expect(Array.isArray(overview.decisionsNeeded)).toBe(true);
    expect(Array.isArray(overview.nextActions)).toBe(true);
    expect(overview.revenueAndOutcomes).toBeDefined();
  });

  it('runs a full autonomous company loop cycle via POST /v1/company/loop/run', async () => {
    const runRes = await request(server, '/v1/company/loop/run', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Enterprise Autonomous Loop Cycle #1',
        opportunity: {
          id: 'opp-vertex-1',
          type: 'service',
          title: 'Vertex Global Financial Suite',
          score: {
            problemSeverity: 80,
            demandEvidence: 85,
            abilityToPay: 90,
            reachability: 80,
            solutionFit: 85,
            competitiveGap: 75,
            deliveryFeasibility: 85,
            evidenceConfidence: 90,
            overall: 85,
            recommendation: 'outreach_ready',
          },
          estimatedValueMin: 75000,
          estimatedValueMax: 90000,
          currency: 'USD',
          timeToRevenueDays: 30,
          evidenceRefs: ['ev-vertex-1'],
          status: 'qualified',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        companyName: 'Vertex Global Financial',
        contactName: 'Elena Rostova',
        contactEmail: 'erostova@vertex.example',
        contactProvenance: {
          sourceUrl: 'https://vertex.example/leadership',
          observedAt: new Date().toISOString(),
          method: 'website_scrape',
        },
        outreachDetails: {
          channel: 'email',
          subject: 'Financial Core Modernization',
          body: 'We noticed workflow opportunities...',
          senderAgentId: 'commercial.sales-representative',
        },
        outreachResponseDetails: {
          sentiment: 'positive',
          content: 'Interested, please provide proposal.',
        },
        qualificationDetails: {
          budgetConfirmed: true,
          budgetAmount: 75000,
          authorityConfirmed: true,
          needValidated: true,
          urgency: 'immediate',
          qualificationScore: 88,
        },
        ceoApprovalId: 'ceo-dec-auth-vertex',
        customerAcceptance: {
          signedBy: 'Elena Rostova',
          agreementRef: 'AGREEMENT-VERTEX-2026',
          clientSatisfactionScore: 5,
        },
        deliverySignoff: {
          signedBy: 'Elena Rostova',
          signedAt: new Date().toISOString(),
          clientSatisfactionScore: 5,
        },
        budget: 75000,
        actualCost: 28000,
      }),
    });

    expect(runRes.status).toBe(201);
    const data = runRes.json as { cycle: CompanyLoopCycle };
    expect(data.cycle).toBeDefined();
    expect(data.cycle.status).toBe('completed');
    expect(data.cycle.currentStage).toBe('learning_calibration');
    expect(data.cycle.dealId).toBeDefined();
    expect(data.cycle.projectId).toBeDefined();
    expect(data.cycle.customerId).toBeDefined();
    expect(data.cycle.stages).toHaveLength(12);

    const cycleId = data.cycle.id;

    // List cycles
    const listRes = await request(server, '/v1/company/loop/cycles');
    expect(listRes.status).toBe(200);
    const listData = listRes.json as { cycles: CompanyLoopCycle[] };
    expect(listData.cycles.length).toBeGreaterThan(0);
    expect(listData.cycles.some((c) => c.id === cycleId)).toBe(true);

    // Get specific cycle
    const getRes = await request(server, `/v1/company/loop/cycles/${cycleId}`);
    expect(getRes.status).toBe(200);
    const getData = getRes.json as { cycle: CompanyLoopCycle };
    expect(getData.cycle.id).toBe(cycleId);
    expect(getData.cycle.title).toBe('Enterprise Autonomous Loop Cycle #1');

    // Overview now reflects the newly won revenue and completed delivery
    const overviewRes = await request(server, '/v1/company/overview');
    expect(overviewRes.status).toBe(200);
    const overviewData = overviewRes.json as { overview: CompanyOverview };
    const overview = CompanyOverviewSchema.parse(overviewData.overview);

    expect(overview.revenueAndOutcomes.completedDeliveriesCount).toBeGreaterThanOrEqual(1);
    expect(overview.revenueAndOutcomes.totalWonRevenue).toBeGreaterThanOrEqual(75000);
    expect(overview.prospectsThatMatter.some((p) => p.companyName.includes('Vertex Global Financial'))).toBe(true);
  });

  it('truthfully halts commercial sales when no verified prospect is available', async () => {
    const runRes = await request(server, '/v1/company/loop/run', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unverified Prospect Cycle',
        opportunity: {
          id: 'opp-unverified-1',
          type: 'service',
          title: 'Unverified Opportunity',
          score: { overall: 85, recommendation: 'pursue' },
          status: 'qualified',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    expect(runRes.status).toBe(201);
    const data = runRes.json as { cycle: CompanyLoopCycle };
    expect(data.cycle.status).toBe('paused');
    expect(data.cycle.currentStage).toBe('commercial_sales');
    const salesStage = data.cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.status).toBe('pending');
    expect(salesStage?.details.reason).toBe('No verified prospect available; commercial loop did not advance.');
  });
});
