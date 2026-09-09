import { describe, it, expect } from 'vitest';
import { AutonomousCompanyLoop } from './autonomous-company-loop.js';
import { CommercialPipelineEngine } from './commercial-pipeline.js';
import { CustomerSuccessEngine } from './customer-success.js';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { CompanyOverviewSchema } from '@umer/contracts';

describe('AutonomousCompanyLoop', () => {
  it('executes the complete 12-stage autonomous company loop from Market Discovery to Learning Calibration', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    const commercial = new CommercialPipelineEngine();
    const cs = new CustomerSuccessEngine();

    const createdProjects: any[] = [];
    const workNodes: any[] = [];
    const deployments: any[] = [];

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
      commercialPipeline: commercial,
      customerSuccess: cs,
      projects: {
        async create(input) {
          const p = { id: `proj-${Date.now()}`, projectId: `proj-${Date.now()}`, name: input.name, status: input.status ?? 'Active' };
          createdProjects.push(p);
          return p;
        },
        async get(id) {
          return createdProjects.find((p) => p.id === id);
        },
        async list() {
          return createdProjects;
        },
      },
      requirements: {
        async create(input) {
          return { id: 'req-test-1', title: input.title };
        },
      },
      workGraph: {
        async addNode(node) {
          workNodes.push(node);
        },
        async listNodes() {
          return workNodes;
        },
      },
      deployments: {
        async prepareRelease(input) {
          const dep = { id: 'dep-1', deploymentId: 'dep-1', status: 'pending_approval', projectId: input.projectId };
          deployments.push(dep);
          return dep;
        },
        async executeDeployment(id) {
          const dep = deployments.find((d) => d.id === id);
          if (dep) dep.status = 'healthy';
          return dep ?? { id, status: 'healthy' };
        },
        async listDeployments() {
          return deployments;
        },
        async getProductionStatus() {
          return { status: 'healthy' };
        },
      },
    });

    const cycle = await loop.runCycle({
      title: 'Q3 Enterprise Fintech Cycle',
      companyName: 'Apex Banking Solutions',
      contactName: 'Sarah Jenkins',
      contactEmail: 'sjenkins@apexbanking.example',
      budget: 60000,
      actualCost: 24000,
    });

    expect(cycle.status).toBe('completed');
    expect(cycle.currentStage).toBe('learning_calibration');
    expect(cycle.dealId).toBeDefined();
    expect(cycle.projectId).toBeDefined();
    expect(cycle.customerId).toBeDefined();
    expect(cycle.requirementId).toBeDefined();

    // Check each of the 12 canonical stages completed in order
    expect(cycle.stages).toHaveLength(12);
    for (const stage of cycle.stages) {
      expect(stage.status).toBe('completed');
      expect(stage.startedAt).toBeDefined();
      expect(stage.completedAt).toBeDefined();
    }

    // Verify Market Discovery calibrated pricing was used
    const discoveryStage = cycle.stages.find((s) => s.stage === 'market_discovery');
    expect(discoveryStage?.details.opportunityId).toBeDefined();
    expect(discoveryStage?.details.calibratedPriceMultiplier).toBeGreaterThan(0);

    // Verify Commercial Sales created deal and proposal
    const salesStage = cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.details.dealId).toBe(cycle.dealId);
    expect(salesStage?.details.proposalId).toBeDefined();

    // Verify Customer Success signed off delivery
    const csStage = cycle.stages.find((s) => s.stage === 'customer_success');
    expect(csStage?.details.customerId).toBe(cycle.customerId);
    expect(csStage?.details.clientSignoff).toBe(true);

    // Verify Revenue Realization
    const revStage = cycle.stages.find((s) => s.stage === 'revenue_realization');
    expect(revStage?.details.contractedRevenue).toBeGreaterThan(0);
    expect(revStage?.details.recognizedRevenue).toBeGreaterThan(0);

    // Verify Learning Calibration closed the loop
    const learnStage = cycle.stages.find((s) => s.stage === 'learning_calibration');
    expect(learnStage?.details.learningId).toBeDefined();
    expect(learnStage?.details.successRatePercent).toBe(100);

    // Verify loop cycle is indexed and retrievable
    expect(loop.getCycle(cycle.id)).toBe(cycle);
    expect(loop.listCycles()).toContain(cycle);
  });

  it('runs partial cycles to a target stage', async () => {
    const loop = new AutonomousCompanyLoop();
    const cycle = await loop.runCycle({
      title: 'Discovery Only Cycle',
      targetStage: 'opportunity_scoring',
    });

    expect(cycle.status).toBe('active');
    expect(cycle.currentStage).toBe('opportunity_scoring');
    expect(cycle.stages.find((s) => s.stage === 'market_discovery')?.status).toBe('completed');
    expect(cycle.stages.find((s) => s.stage === 'opportunity_scoring')?.status).toBe('completed');
    expect(cycle.stages.find((s) => s.stage === 'commercial_sales')?.status).toBe('pending');
  });

  it('generates a complete CompanyOverview directly answering the 10 CEO questions from real state', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    const commercial = new CommercialPipelineEngine();
    const cs = new CustomerSuccessEngine();

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
      commercialPipeline: commercial,
      customerSuccess: cs,
      agents: {
        async list() {
          return [
            {
              agentId: 'agent-dev-1',
              name: 'Senior TypeScript Engineer',
              department: 'engineering',
              specialistId: 'spec.ts-dev',
              status: 'busy',
              currentProjectId: 'proj-omega',
              currentTaskId: 'task-build-core',
            },
          ];
        },
      },
      deployments: {
        async listDeployments() {
          return [
            {
              id: 'dep-99',
              deploymentId: 'dep-99',
              status: 'pending_approval',
              projectId: 'proj-omega',
              targetVersion: '2.0.0',
            },
          ];
        },
        async getProductionStatus() {
          return { status: 'healthy' };
        },
      },
      gates: {
        async listPending() {
          return [
            {
              gateId: 'gate-qa-omega',
              stageFrom: 'QA Verify',
              stageTo: 'Release',
              requiredApprovers: ['human.approver'],
            },
          ];
        },
      },
      artifacts: {
        count: () => 18,
      },
    });

    // Run one full cycle first
    await loop.runCycle({
      companyName: 'Global Logistics Corp',
      budget: 50000,
    });

    const overview = await loop.generateCompanyOverview();

    // Schema validation ensures all fields strictly conform to CompanyOverviewSchema
    const validated = CompanyOverviewSchema.parse(overview);

    // Q1: What is the company doing right now?
    expect(validated.whatCompanyIsDoing.productionStatus).toBe('healthy');
    expect(validated.whatCompanyIsDoing.openDealsCount).toBeDefined();
    expect(validated.whatCompanyIsDoing.summary).toContain('Production status is healthy');

    // Q2: What opportunities are being pursued?
    expect(validated.opportunitiesPursued.length).toBeGreaterThan(0);
    expect(validated.opportunitiesPursued[0].recommendation).toBe('pursue');

    // Q3: Which prospects matter?
    expect(validated.prospectsThatMatter.length).toBeGreaterThan(0);
    expect(validated.prospectsThatMatter[0].companyName).toContain('Global Logistics Corp');

    // Q4: Which Specialists/agents are working?
    expect(validated.agentsWorking).toHaveLength(1);
    expect(validated.agentsWorking[0].department).toBe('engineering');

    // Q5: What project is each one working on?
    expect(validated.projectsByAgent['agent-dev-1']).toBeDefined();
    expect(validated.projectsByAgent['agent-dev-1'].projectId).toBe('proj-omega');

    // Q6: What evidence exists?
    expect(validated.evidenceSummary.totalSealedArtifacts).toBe(18);
    expect(validated.evidenceSummary.signedDeliveryOutcomesCount).toBe(1);

    // Q7: What is blocked?
    expect(Array.isArray(validated.blockedItems)).toBe(true);

    // Q8: What needs my decision?
    expect(validated.decisionsNeeded.length).toBeGreaterThanOrEqual(1);
    expect(validated.decisionsNeeded.some((d) => d.type === 'deployment_approval')).toBe(true);

    // Q9: What happens next?
    expect(validated.nextActions.length).toBeGreaterThanOrEqual(1);
    expect(validated.nextActions.some((a) => a.action.includes('Release Deployment Approval'))).toBe(true);

    // Q10: What money/outcome is this producing?
    expect(validated.revenueAndOutcomes.totalWonRevenue).toBeGreaterThan(0);
    expect(validated.revenueAndOutcomes.recognizedRevenue).toBeGreaterThan(0);
    expect(validated.revenueAndOutcomes.completedDeliveriesCount).toBe(1);
    expect(validated.revenueAndOutcomes.activeCustomersCount).toBe(1);
  });
});
