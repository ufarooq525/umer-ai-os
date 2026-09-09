import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { CompanyOverviewSchema, CompanyLoopCycleSchema } from '@umer/contracts';
import { DeploymentEngine } from '../../packages/registry/src/deployment-engine.js';
import { createControlApiServer, createControlApiState } from '../../apps/control-api/src/server.js';
import { InMemoryRequirementStore } from '../../apps/control-api/src/requirement-store.js';
import type { ControlApiState } from '../../apps/control-api/src/state.js';

async function request(
  server: Server,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; json: any }> {
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

describe('M10 E2E — Autonomous Company Loop & CEO Command Center', () => {
  let state: ControlApiState;
  let server: Server;

  beforeAll(async () => {
    state = await createControlApiState({
      deploymentEngine: new DeploymentEngine({
        probeRunner: async () => ({ status: 'pass', responseTimeMs: 10 }),
        rollbackRunner: async () => ({ status: 'success' }),
      }),
    });
    state.requirementStore = new InMemoryRequirementStore();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('runs the closed-loop autonomous company cycle and verifies real state across all 12 stages', async () => {
    // 1. Initial CEO Command Center baseline overview
    const baselineRes = await request(server, '/v1/company/overview');
    expect(baselineRes.status).toBe(200);
    const baselineOverview = CompanyOverviewSchema.parse(baselineRes.json.overview);

    expect(baselineOverview.revenueAndOutcomes.totalWonRevenue).toBe(0);
    expect(baselineOverview.revenueAndOutcomes.completedDeliveriesCount).toBe(0);
    expect(baselineOverview.whatCompanyIsDoing.activeLoopCyclesCount).toBe(0);

    // 2. Trigger Autonomous Company Loop Cycle
    // Market → Opportunity → Prospect → Sales → Requirements → Product →
    // Architecture → UX → Engineering → QA → Security → Release →
    // Operations → Customer → Revenue → Learning → Market
    const runRes = await request(server, '/v1/company/loop/run', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Q4 Autonomous Banking Modernization',
        opportunity: {
          id: 'opp-e2e-apex-1',
          type: 'service',
          title: 'Q4 Autonomous Banking Modernization',
          score: {
            problemSeverity: 85,
            demandEvidence: 90,
            abilityToPay: 95,
            reachability: 85,
            solutionFit: 90,
            competitiveGap: 75,
            deliveryFeasibility: 85,
            evidenceConfidence: 90,
            overall: 88,
            recommendation: 'outreach_ready',
          },
          estimatedValueMin: 85000,
          estimatedValueMax: 100000,
          currency: 'USD',
          timeToRevenueDays: 30,
          evidenceRefs: ['ev-e2e-1'],
          status: 'qualified',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        companyName: 'Apex Global Financial Corp',
        contactName: 'Elena Rostova',
        contactEmail: 'elena.rostova@apexglobal.example',
        contactProvenance: {
          sourceUrl: 'https://apexglobal.example/team',
          observedAt: new Date().toISOString(),
          method: 'website_scrape',
        },
        outreachDetails: {
          channel: 'email',
          subject: 'Modernization Engagement',
          body: 'Noticed legacy bottlenecks in clearing services...',
          senderAgentId: 'commercial.sales-representative',
        },
        outreachResponseDetails: {
          sentiment: 'positive',
          content: 'We agree, let us proceed to proposal',
        },
        qualificationDetails: {
          budgetConfirmed: true,
          budgetAmount: 85000,
          authorityConfirmed: true,
          needValidated: true,
          urgency: 'immediate',
          qualificationScore: 90,
        },
        ceoApprovalId: 'ceo-dec-auth-e2e',
        customerAcceptance: {
          signedBy: 'Elena Rostova',
          agreementRef: 'AGREEMENT-E2E-APEX',
          clientSatisfactionScore: 5,
        },
        deliverySignoff: {
          signedBy: 'Elena Rostova',
          signedAt: new Date().toISOString(),
          clientSatisfactionScore: 5,
        },
        budget: 85000,
        actualCost: 34000,
      }),
    });

    expect(runRes.status).toBe(201);
    const cycle = CompanyLoopCycleSchema.parse(runRes.json.cycle);

    expect(cycle.status).toBe('completed');
    expect(cycle.currentStage).toBe('learning_calibration');
    expect(cycle.opportunityId).toBeDefined();
    expect(cycle.dealId).toBeDefined();
    expect(cycle.projectId).toBeDefined();
    expect(cycle.customerId).toBeDefined();
    expect(cycle.requirementId).toBeDefined();

    // Verify all 12 canonical stages completed sequentially
    expect(cycle.stages).toHaveLength(12);
    for (const st of cycle.stages) {
      expect(st.status).toBe('completed');
      expect(st.startedAt).toBeDefined();
      expect(st.completedAt).toBeDefined();
    }

    // 3. Inspect real state in underlying stores
    // Project in ProjectStore
    const project = await state.projectStore!.get(cycle.projectId!);
    expect(project).toBeDefined();
    expect(project?.status).toBe('Active');

    // Requirement in RequirementStore
    const requirement = await state.requirementStore!.get(cycle.requirementId!);
    expect(requirement).toBeDefined();
    expect(requirement?.projectId).toBe(cycle.projectId);
    expect(requirement?.source.kind).toBe('Opportunity');

    // Customer and Delivery in CustomerSuccessEngine
    const customer = state.customerSuccess!.getCustomer(cycle.customerId!);
    expect(customer).toBeDefined();
    expect(customer?.companyName).toBe('Apex Global Financial Corp');
    expect(customer?.status).toBe('active');

    const outcome = state.customerSuccess!.getDeliveryOutcome(cycle.projectId!);
    expect(outcome).toBeDefined();
    expect(outcome?.status).toBe('successful');
    expect(outcome?.clientSignoff.clientSatisfactionScore).toBe(5);

    // Financial Summary
    const financialSummary = state.customerSuccess!.getFinancialSummary(cycle.projectId!);
    expect(financialSummary).toBeDefined();
    expect(financialSummary?.contractRevenue).toBe(85000);
    expect(financialSummary?.profitabilityStatus).toBe('profitable');

    // Organizational Learnings
    const learnings = state.customerSuccess!.listLearnings();
    expect(learnings.length).toBeGreaterThan(0);

    // 4. Closed feedback loop verification:
    // Calibration derived from this delivery outcome updates recommended multipliers
    const calibration = state.customerSuccess!.getOpportunityCalibration();
    expect(calibration.completedDeliveriesCount).toBe(1);
    expect(calibration.successRatePercent).toBe(100);
    expect(calibration.averageMarginPercent).toBeGreaterThan(0);

    // 5. Query updated CEO Overview: answers all 10 CEO questions from live, real state
    const updatedRes = await request(server, '/v1/company/overview');
    expect(updatedRes.status).toBe(200);
    const overview = CompanyOverviewSchema.parse(updatedRes.json.overview);

    // Q1: What is the company doing right now?
    expect(overview.whatCompanyIsDoing.activeProjectsCount).toBeGreaterThanOrEqual(1);
    expect(overview.whatCompanyIsDoing.summary).toContain('projects in delivery');

    // Q2: What opportunities are being pursued?
    expect(overview.opportunitiesPursued.length).toBeGreaterThanOrEqual(1);
    expect(overview.opportunitiesPursued.some((o) => o.id === cycle.opportunityId)).toBe(true);

    // Q3: Which prospects matter?
    expect(overview.prospectsThatMatter.length).toBeGreaterThanOrEqual(1);
    expect(overview.prospectsThatMatter.some((p) => p.companyName.includes('Apex Global Financial Corp'))).toBe(true);

    // Q4 & Q5: Agents and projects
    expect(Array.isArray(overview.agentsWorking)).toBe(true);
    expect(overview.projectsByAgent).toBeDefined();

    // Q6: Evidence summary
    expect(overview.evidenceSummary.signedDeliveryOutcomesCount).toBe(1);

    // Q7: Blocked items
    expect(Array.isArray(overview.blockedItems)).toBe(true);

    // Q8: Decisions needed
    expect(Array.isArray(overview.decisionsNeeded)).toBe(true);

    // Q9: Next actions
    expect(overview.nextActions.length).toBeGreaterThanOrEqual(1);

    // Q10: Revenue and outcomes produced
    expect(overview.revenueAndOutcomes.totalWonRevenue).toBeGreaterThanOrEqual(85000);
    expect(overview.revenueAndOutcomes.recognizedRevenue).toBeGreaterThanOrEqual(85000);
    expect(overview.revenueAndOutcomes.completedDeliveriesCount).toBe(1);
    expect(overview.revenueAndOutcomes.activeCustomersCount).toBe(1);
    expect(overview.revenueAndOutcomes.averageCustomerHealthScore).toBeGreaterThanOrEqual(90);
  });
});
