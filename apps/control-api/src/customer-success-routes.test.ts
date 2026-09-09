import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
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

describe('Customer Success + Revenue + Learning HTTP Routes', () => {
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

  it('executes full post-delivery Customer Success, Financial, and Learning lifecycle', async () => {
    // 1. Create a customer account
    const createCustRes = await request(server, '/v1/customers', {
      method: 'POST',
      body: JSON.stringify({
        prospectId: 'prosp-cs-1',
        companyName: 'Apex Health Logistics',
        mrr: 5000,
      }),
    });
    expect(createCustRes.status).toBe(201);
    const customer = createCustRes.json as { id: string; companyName: string; healthScore: number; status: string };
    expect(customer.companyName).toBe('Apex Health Logistics');
    expect(customer.healthScore).toBe(100);
    expect(customer.status).toBe('onboarding');

    // List and Get customer
    const listCustRes = await request(server, '/v1/customers');
    expect(listCustRes.status).toBe(200);
    expect((listCustRes.json as { customers: unknown[] }).customers.length).toBeGreaterThan(0);

    const getCustRes = await request(server, `/v1/customers/${customer.id}`);
    expect(getCustRes.status).toBe(200);
    expect((getCustRes.json as { id: string }).id).toBe(customer.id);

    // 2. Record Delivery Outcome
    const projectId = 'proj-apex-deliv-1';
    const outcomeRes = await request(server, `/v1/customers/${customer.id}/delivery-outcome`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        status: 'successful',
        scopeDeliveredPercent: 100,
        acceptanceCriteriaMet: true,
        clientSignoff: {
          signedBy: 'VP Operations',
          signedAt: '2026-09-09T12:00:00.000Z',
          clientSatisfactionScore: 5,
        },
        kpiResults: [
          { metric: 'Cold chain compliance', target: 99.9, actual: 100, achieved: true },
        ],
        notes: 'Delivered under budget with verified staging evidence.',
      }),
    });
    expect(outcomeRes.status).toBe(201);
    const outcome = outcomeRes.json as { id: string; status: string; scopeDeliveredPercent: number };
    expect(outcome.status).toBe('successful');
    expect(outcome.scopeDeliveredPercent).toBe(100);

    // Get delivery outcome by project
    const getOutcomeRes = await request(server, `/v1/projects/${projectId}/delivery-outcome`);
    expect(getOutcomeRes.status).toBe(200);
    expect((getOutcomeRes.json as { id: string }).id).toBe(outcome.id);

    // Verify customer transitioned to active
    const activeCustRes = await request(server, `/v1/customers/${customer.id}`);
    expect((activeCustRes.json as { status: string }).status).toBe('active');

    // 3. Create Support Case
    const caseRes = await request(server, `/v1/customers/${customer.id}/support-cases`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        title: 'Cold storage sensor webhook delayed',
        description: 'Sensor data lagged by 10 minutes during transit',
        severity: 'high',
        reportedBy: 'Site Supervisor',
      }),
    });
    expect(caseRes.status).toBe(201);
    const supportCase = caseRes.json as { id: string; slaHours: number; status: string };
    expect(supportCase.slaHours).toBe(12);
    expect(supportCase.status).toBe('open');

    // List support cases for customer
    const listCasesRes = await request(server, `/v1/customers/${customer.id}/support-cases`);
    expect(listCasesRes.status).toBe(200);
    expect((listCasesRes.json as { supportCases: unknown[] }).supportCases).toHaveLength(1);

    // Resolve Support Case (on time)
    const resolveCaseRes = await request(server, `/v1/support-cases/${supportCase.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        resolutionSummary: 'Updated IoT gateway polling interval from 5m to 30s',
      }),
    });
    expect(resolveCaseRes.status).toBe(200);
    expect((resolveCaseRes.json as { status: string; slaBreached: boolean }).status).toBe('resolved');
    expect((resolveCaseRes.json as { slaBreached: boolean }).slaBreached).toBe(false);

    // 4. Record Customer Feedback
    const fbRes = await request(server, `/v1/customers/${customer.id}/feedback`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        npsScore: 10,
        csatScore: 5,
        sentiment: 'positive',
        category: 'delivery_quality',
        feedbackText: 'Outstanding autonomous delivery pipeline. We are expanding to 3 more clinics.',
        actionableQuotes: ['Cold chain compliance passed audit without a single flag.'],
      }),
    });
    expect(fbRes.status).toBe(201);
    expect((fbRes.json as { npsScore: number }).npsScore).toBe(10);

    const listFbRes = await request(server, `/v1/customers/${customer.id}/feedback`);
    expect(listFbRes.status).toBe(200);
    expect((listFbRes.json as { feedback: unknown[] }).feedback).toHaveLength(1);

    // 5. Calculate Project Financial Summary
    const finRes = await request(server, `/v1/projects/${projectId}/financials`, {
      method: 'POST',
      body: JSON.stringify({
        customerId: customer.id,
        contractRevenue: 35000,
        recognizedRevenue: 35000,
        costs: {
          computeCost: 250,
          tokenCost: 650,
          laborCost: 4000,
          toolingCost: 100,
        },
      }),
    });
    expect(finRes.status).toBe(201);
    const fin = finRes.json as { grossMargin: number; marginPercent: number; profitabilityStatus: string };
    expect(fin.grossMargin).toBe(30000); // 35000 - 5000
    expect(fin.profitabilityStatus).toBe('highly_profitable');

    const getFinRes = await request(server, `/v1/projects/${projectId}/financials`);
    expect(getFinRes.status).toBe(200);
    expect((getFinRes.json as { grossMargin: number }).grossMargin).toBe(30000);

    // 6. Explicit Learning Extraction
    const learnRes = await request(server, '/v1/learnings', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'delivery_outcome',
        projectId,
        customerId: customer.id,
        title: 'IoT MQTT QoS 1 is necessary for zero packet loss in transport',
        category: 'technical_pattern',
        keyInsight: 'Using MQTT QoS 1 guarantees telemetry delivery over flaky cell networks.',
        recommendedActions: ['Mandate QoS 1 in IoT architectural design templates.'],
        impactOnFutureEstimates: {
          suggestedPriceMultiplier: 1.0,
          riskFactorAdjustment: -0.1,
        },
      }),
    });
    expect(learnRes.status).toBe(201);

    const listLearningsRes = await request(server, '/v1/learnings');
    expect(listLearningsRes.status).toBe(200);
    expect((listLearningsRes.json as { learnings: unknown[] }).learnings.length).toBeGreaterThan(0);

    // 7. Empirical Opportunity Calibration
    const calibRes = await request(server, '/v1/opportunity-calibration');
    expect(calibRes.status).toBe(200);
    const calibration = (calibRes.json as { calibration: { completedDeliveriesCount: number; successRatePercent: number; averageMarginPercent: number; activeLearningsCount: number } }).calibration;
    expect(calibration.completedDeliveriesCount).toBe(1);
    expect(calibration.successRatePercent).toBe(100);
    expect(calibration.averageMarginPercent).toBeGreaterThan(70);
    expect(calibration.activeLearningsCount).toBeGreaterThan(0);
  });
});
