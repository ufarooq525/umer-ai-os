import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import {
  CompanyOverviewSchema,
  type CompanyLoopCycle,
  type CompanyOverview,
} from '@umer/contracts';
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
    state = await createControlApiState();
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
        companyName: 'Vertex Global Financial',
        contactName: 'Elena Rostova',
        contactEmail: 'erostova@vertex.example',
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
});
