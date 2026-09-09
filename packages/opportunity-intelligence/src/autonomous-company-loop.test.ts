import { describe, it, expect } from 'vitest';
import { AutonomousCompanyLoop } from './autonomous-company-loop.js';
import { CommercialPipelineEngine } from './commercial-pipeline.js';
import { CustomerSuccessEngine } from './customer-success.js';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { CompanyOverviewSchema, type Opportunity } from '@umer/contracts';

describe('AutonomousCompanyLoop', () => {
  const sampleOpportunity: Opportunity = {
    id: 'opp-apex-101',
    type: 'service',
    title: 'Apex Banking Cloud Modernization',
    geography: 'Global',
    market: 'Fintech',
    problemIds: ['prob-1'],
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
    estimatedValueMin: 50000,
    estimatedValueMax: 70000,
    currency: 'USD',
    timeToRevenueDays: 30,
    evidenceRefs: ['ev-apex-1'],
    status: 'qualified',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('executes the complete 12-stage autonomous company loop with genuine evidence and customer signoff', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

    const commercial = new CommercialPipelineEngine();
    const cs = new CustomerSuccessEngine();

    const createdProjects: Array<{ id: string; projectId: string; name: string; status: string }> = [];
    const workNodes: Array<{ id: string; type: string; title: string; status: string }> = [];
    const deployments: Array<{ id: string; deploymentId: string; status: string; projectId: string }> = [];

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
      specialists: {
        executeProductDefinition: async (input) => ({
          artifactId: `art-prod-${input.projectId}`,
          scope: 'Enterprise fintech autonomous delivery specification',
          functionalCriteriaCount: 5,
          nonFunctionalSLAs: ['99.99% uptime', '<100ms p95 latency'],
          verified: true,
        }),
        executeArchitectureUx: async (input) => ({
          architectureArtifactId: `art-arch-${input.projectId}`,
          uxArtifactId: `art-ux-${input.projectId}`,
          architectureReviewPassed: true,
          uxComponentDesignTokensValidated: true,
          dataModelApproved: true,
          verified: true,
        }),
        executeEngineeringDelivery: async (input) => ({
          artifactId: `art-code-${input.projectId}`,
          packagesCompiled: 3,
          testSuitesPassed: true,
          gitCommitSealed: true,
          diffSummary: 'Banking services built and tested in isolated staging',
          verified: true,
        }),
        executeQaSecurityGates: async (input) => ({
          qaArtifactId: `art-qa-${input.projectId}`,
          securityArtifactId: `art-sec-${input.projectId}`,
          testPlanCompleted: true,
          criticalVulnerabilitiesFound: 0,
          regressionSuiteGreen: true,
          complianceStatus: 'cleared',
          verified: true,
        }),
      },
    });

    const cycle = await loop.runCycle({
      title: 'Q3 Enterprise Fintech Cycle',
      opportunityId: sampleOpportunity.id,
      companyName: 'Apex Banking Solutions',
      contactName: 'Sarah Jenkins',
      contactEmail: 'sjenkins@apexbanking.example',
      contactProvenance: {
        sourceUrl: 'https://apexbanking.example/leadership',
        observedAt: new Date().toISOString(),
        method: 'website_scrape',
        businessIdentity: 'Apex Banking',
        contactIdentity: 'Sarah Jenkins',
      },
      outreachDetails: {
        channel: 'email',
        subject: 'Modernizing Apex Core Banking',
        body: 'Noticed legacy bottlenecks in transaction routing...',
        senderAgentId: 'commercial.sales-representative',
      },
      outreachResponseDetails: {
        sentiment: 'positive',
        content: 'We are very interested. Please send an authorized proposal.',
      },
      qualificationDetails: {
        budgetConfirmed: true,
        budgetAmount: 60000,
        authorityConfirmed: true,
        needValidated: true,
        urgency: 'immediate',
        qualificationScore: 92,
      },
      ceoApprovalId: 'ceo-dec-auth-99',
      customerAcceptance: {
        signedBy: 'Sarah Jenkins',
        agreementRef: 'AGREEMENT-APEX-2026-001',
        clientSatisfactionScore: 5,
      },
      deliverySignoff: {
        signedBy: 'Sarah Jenkins',
        signedAt: new Date().toISOString(),
        clientSatisfactionScore: 5,
      },
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
    expect(discoveryStage?.details.opportunityId).toBe(sampleOpportunity.id);
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

  it('runs partial cycles to a target stage with explicit opportunity', async () => {
    const loop = new AutonomousCompanyLoop();
    const cycle = await loop.runCycle({
      title: 'Discovery Only Cycle',
      targetStage: 'opportunity_scoring',
      opportunity: sampleOpportunity,
    });

    expect(cycle.status).toBe('active');
    expect(cycle.currentStage).toBe('opportunity_scoring');
    expect(cycle.stages.find((s) => s.stage === 'market_discovery')?.status).toBe('completed');
    expect(cycle.stages.find((s) => s.stage === 'opportunity_scoring')?.status).toBe('completed');
    expect(cycle.stages.find((s) => s.stage === 'commercial_sales')?.status).toBe('pending');
  });

  it('truthfully halts when no verified opportunity is available in persistence or input', async () => {
    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: new InMemoryOpportunityPersistence(),
    });

    const cycle = await loop.runCycle({
      title: 'No Opportunity Cycle',
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('market_discovery');
    const discoveryStage = cycle.stages.find((s) => s.stage === 'market_discovery');
    expect(discoveryStage?.status).toBe('pending');
    expect(discoveryStage?.details.blocked).toBe(true);
    expect(discoveryStage?.details.reason).toContain('No verified opportunity available');
  });

  it('truthfully halts when no verified prospect is available ("No verified prospect available; commercial loop did not advance")', async () => {
    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: new InMemoryOpportunityPersistence(),
    });

    const cycle = await loop.runCycle({
      title: 'No Prospect Cycle',
      opportunity: sampleOpportunity,
      // No companyName or prospectId provided
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('commercial_sales');
    const salesStage = cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.status).toBe('pending');
    expect(salesStage?.details.blocked).toBe(true);
    expect(salesStage?.details.reason).toBe('No verified prospect available; commercial loop did not advance.');
  });

  it('truthfully halts when contact verification provenance evidence is missing', async () => {
    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: new InMemoryOpportunityPersistence(),
    });

    const cycle = await loop.runCycle({
      title: 'Unverified Contact Cycle',
      opportunity: sampleOpportunity,
      companyName: 'Acme Unknown LLC',
      contactName: 'Bob Smith',
      contactEmail: 'bob@example.com',
      // No contactProvenance with real sourceUrl provided
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('commercial_sales');
    const salesStage = cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.status).toBe('pending');
    expect(salesStage?.details.blocked).toBe(true);
    expect(salesStage?.details.reason).toContain('Contact verification evidence missing');
  });

  it('truthfully halts when proposal requires CEO approval and none is provided', async () => {
    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: new InMemoryOpportunityPersistence(),
    });

    const cycle = await loop.runCycle({
      title: 'Awaiting CEO Approval Cycle',
      opportunity: sampleOpportunity,
      companyName: 'Enterprise Corp',
      contactName: 'Alice Green',
      contactEmail: 'alice@enterprise.example',
      contactProvenance: {
        sourceUrl: 'https://enterprise.example/alice',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: {
        channel: 'email',
        subject: 'Enterprise Engagement',
        body: 'Introductory note',
        senderAgentId: 'commercial.sales-representative',
      },
      outreachResponseDetails: {
        sentiment: 'positive',
        content: 'Send proposal please',
      },
      qualificationDetails: {
        budgetConfirmed: true,
        budgetAmount: 50000,
        authorityConfirmed: true,
        needValidated: true,
        qualificationScore: 85,
      },
      // proposal > $25k requires CEO approval, but no ceoApprovalId provided!
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('commercial_sales');
    const salesStage = cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.status).toBe('pending');
    expect(salesStage?.details.blocked).toBe(true);
    expect(salesStage?.details.reason).toContain('Proposal requires explicit CEO approval');
  });

  it('truthfully pauses at proposal stage when customer acceptance has not been signed', async () => {
    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: new InMemoryOpportunityPersistence(),
    });

    const cycle = await loop.runCycle({
      title: 'Awaiting Customer Acceptance Cycle',
      opportunity: sampleOpportunity,
      companyName: 'Enterprise Corp',
      contactName: 'Alice Green',
      contactEmail: 'alice@enterprise.example',
      contactProvenance: {
        sourceUrl: 'https://enterprise.example/alice',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: {
        channel: 'email',
        subject: 'Enterprise Engagement',
        body: 'Introductory note',
        senderAgentId: 'commercial.sales-representative',
      },
      outreachResponseDetails: {
        sentiment: 'positive',
        content: 'Send proposal please',
      },
      qualificationDetails: {
        budgetConfirmed: true,
        budgetAmount: 50000,
        authorityConfirmed: true,
        needValidated: true,
        qualificationScore: 85,
      },
      ceoApprovalId: 'ceo-approval-legit-1',
      // No customerAcceptance provided
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('commercial_sales');
    const salesStage = cycle.stages.find((s) => s.stage === 'commercial_sales');
    expect(salesStage?.status).toBe('completed');
    expect(salesStage?.details.stage).toBe('proposal');
    expect(salesStage?.details.message).toContain('awaiting formal customer acceptance');
    // Ensure subsequent delivery stages remain pending
    expect(cycle.stages.find((s) => s.stage === 'requirements_intake')?.status).toBe('pending');
  });

  it('generates a complete CompanyOverview directly answering the 10 CEO questions from real state', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

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
      specialists: {
        executeProductDefinition: async (input) => ({
          artifactId: `art-prod-${input.projectId}`,
          scope: 'Global logistics routing specification',
          functionalCriteriaCount: 4,
          nonFunctionalSLAs: ['99.9% uptime'],
          verified: true,
        }),
        executeArchitectureUx: async (input) => ({
          architectureArtifactId: `art-arch-${input.projectId}`,
          uxArtifactId: `art-ux-${input.projectId}`,
          architectureReviewPassed: true,
          uxComponentDesignTokensValidated: true,
          dataModelApproved: true,
          verified: true,
        }),
        executeEngineeringDelivery: async (input) => ({
          artifactId: `art-code-${input.projectId}`,
          packagesCompiled: 1,
          testSuitesPassed: true,
          gitCommitSealed: true,
          diffSummary: 'Staged and tested cleanly',
          verified: true,
        }),
        executeQaSecurityGates: async (input) => ({
          qaArtifactId: `art-qa-${input.projectId}`,
          securityArtifactId: `art-sec-${input.projectId}`,
          testPlanCompleted: true,
          criticalVulnerabilitiesFound: 0,
          regressionSuiteGreen: true,
          complianceStatus: 'cleared',
          verified: true,
        }),
      },
    });

    // Run one full cycle first with genuine inputs
    await loop.runCycle({
      opportunityId: sampleOpportunity.id,
      companyName: 'Global Logistics Corp',
      contactName: 'Elena Rostova',
      contactEmail: 'elena@globallogistics.example',
      contactProvenance: {
        sourceUrl: 'https://globallogistics.example/team',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: {
        channel: 'email',
        subject: 'Logistics Modernization',
        body: 'Detailed proposal for route automation',
        senderAgentId: 'commercial.sales-representative',
      },
      outreachResponseDetails: {
        sentiment: 'positive',
        content: 'Ready to proceed with contract',
      },
      qualificationDetails: {
        budgetConfirmed: true,
        budgetAmount: 50000,
        authorityConfirmed: true,
        needValidated: true,
        qualificationScore: 90,
      },
      ceoApprovalId: 'ceo-dec-auth-100',
      customerAcceptance: {
        signedBy: 'Elena Rostova',
        agreementRef: 'AGREEMENT-GLC-2026-001',
        clientSatisfactionScore: 5,
      },
      deliverySignoff: {
        signedBy: 'Elena Rostova',
        signedAt: new Date().toISOString(),
        clientSatisfactionScore: 5,
      },
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

  it('truthfully pauses when product specialist execution or verified ProductBrief is missing', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
    });

    const cycle = await loop.runCycle({
      opportunityId: sampleOpportunity.id,
      companyName: 'Nova FinTech',
      contactName: 'David Kim',
      contactEmail: 'david@novafintech.example',
      contactProvenance: {
        sourceUrl: 'https://novafintech.example/about',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: {
        channel: 'email',
        subject: 'Partnership',
        body: 'Autonomous solution delivery',
        senderAgentId: 'commercial.sales-representative',
      },
      outreachResponseDetails: {
        sentiment: 'positive',
        content: 'Send a proposal',
      },
      qualificationDetails: {
        budgetConfirmed: true,
        authorityConfirmed: true,
        needValidated: true,
        qualificationScore: 85,
      },
      ceoApprovalId: 'ceo-dec-auth-nova',
      customerAcceptance: {
        signedBy: 'David Kim',
        agreementRef: 'AGREEMENT-NOVA-001',
      },
      // Intentionally omitting productDefinition and specialists port
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('product_definition');
    const stage = cycle.stages.find((s) => s.stage === 'product_definition');
    expect(stage?.status).toBe('pending');
    expect(stage?.details?.blocked).toBe(true);
    expect(stage?.details?.reason).toContain('Product Specialist execution runner or verified ProductBrief required');
  });

  it('truthfully pauses when architecture review or UX validation fails review criteria', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
      specialists: {
        executeProductDefinition: async (input) => ({
          artifactId: `art-prod-${input.projectId}`,
          scope: 'Sample scope',
          functionalCriteriaCount: 3,
          nonFunctionalSLAs: ['99.9% uptime'],
          verified: true,
        }),
        executeArchitectureUx: async (input) => ({
          architectureArtifactId: `art-arch-${input.projectId}`,
          uxArtifactId: `art-ux-${input.projectId}`,
          architectureReviewPassed: false, // Review rejected
          uxComponentDesignTokensValidated: true,
          dataModelApproved: true,
          verified: true,
        }),
      },
    });

    const cycle = await loop.runCycle({
      opportunityId: sampleOpportunity.id,
      companyName: 'Nova FinTech',
      contactName: 'David Kim',
      contactEmail: 'david@novafintech.example',
      contactProvenance: {
        sourceUrl: 'https://novafintech.example/about',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: { channel: 'email', subject: 'P', body: 'B', senderAgentId: 's' },
      outreachResponseDetails: { sentiment: 'positive', content: 'C' },
      qualificationDetails: { budgetConfirmed: true, authorityConfirmed: true, needValidated: true, qualificationScore: 85 },
      ceoApprovalId: 'ceo-dec-auth-nova',
      customerAcceptance: { signedBy: 'David Kim', agreementRef: 'AGR-1' },
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('architecture_ux');
    const stage = cycle.stages.find((s) => s.stage === 'architecture_ux');
    expect(stage?.status).toBe('pending');
    expect(stage?.details?.blocked).toBe(true);
    expect(stage?.details?.reason).toContain('Architecture review or UX design validation failed review criteria');
  });

  it('truthfully halts when engineering staging tests fail', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
      specialists: {
        executeProductDefinition: async (input) => ({
          artifactId: `art-prod-${input.projectId}`,
          scope: 'Sample scope',
          functionalCriteriaCount: 3,
          nonFunctionalSLAs: ['99.9% uptime'],
          verified: true,
        }),
        executeArchitectureUx: async (input) => ({
          architectureArtifactId: `art-arch-${input.projectId}`,
          uxArtifactId: `art-ux-${input.projectId}`,
          architectureReviewPassed: true,
          uxComponentDesignTokensValidated: true,
          dataModelApproved: true,
          verified: true,
        }),
        executeEngineeringDelivery: async (input) => ({
          artifactId: `art-code-${input.projectId}`,
          packagesCompiled: 1,
          testSuitesPassed: false, // Staging tests failed!
          gitCommitSealed: false,
          verified: true,
        }),
      },
    });

    const cycle = await loop.runCycle({
      opportunityId: sampleOpportunity.id,
      companyName: 'Nova FinTech',
      contactName: 'David Kim',
      contactEmail: 'david@novafintech.example',
      contactProvenance: {
        sourceUrl: 'https://novafintech.example/about',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: { channel: 'email', subject: 'P', body: 'B', senderAgentId: 's' },
      outreachResponseDetails: { sentiment: 'positive', content: 'C' },
      qualificationDetails: { budgetConfirmed: true, authorityConfirmed: true, needValidated: true, qualificationScore: 85 },
      ceoApprovalId: 'ceo-dec-auth-nova',
      customerAcceptance: { signedBy: 'David Kim', agreementRef: 'AGR-1' },
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('engineering_delivery');
    const stage = cycle.stages.find((s) => s.stage === 'engineering_delivery');
    expect(stage?.status).toBe('pending');
    expect(stage?.details?.blocked).toBe(true);
    expect(stage?.details?.reason).toContain('Engineering staging test suite failed');
  });

  it('truthfully blocks release when QA or Security gates find critical vulnerabilities', async () => {
    const oppStore = new InMemoryOpportunityPersistence();
    await oppStore.saveOpportunity(sampleOpportunity);

    const loop = new AutonomousCompanyLoop({
      opportunityPersistence: oppStore,
      specialists: {
        executeProductDefinition: async (input) => ({
          artifactId: `art-prod-${input.projectId}`,
          scope: 'Sample scope',
          functionalCriteriaCount: 3,
          nonFunctionalSLAs: ['99.9% uptime'],
          verified: true,
        }),
        executeArchitectureUx: async (input) => ({
          architectureArtifactId: `art-arch-${input.projectId}`,
          uxArtifactId: `art-ux-${input.projectId}`,
          architectureReviewPassed: true,
          uxComponentDesignTokensValidated: true,
          dataModelApproved: true,
          verified: true,
        }),
        executeEngineeringDelivery: async (input) => ({
          artifactId: `art-code-${input.projectId}`,
          packagesCompiled: 1,
          testSuitesPassed: true,
          gitCommitSealed: true,
          verified: true,
        }),
        executeQaSecurityGates: async (input) => ({
          qaArtifactId: `art-qa-${input.projectId}`,
          securityArtifactId: `art-sec-${input.projectId}`,
          testPlanCompleted: true,
          criticalVulnerabilitiesFound: 2, // 2 Critical CVEs discovered!
          regressionSuiteGreen: true,
          complianceStatus: 'blocked',
          verified: true,
        }),
      },
    });

    const cycle = await loop.runCycle({
      opportunityId: sampleOpportunity.id,
      companyName: 'Nova FinTech',
      contactName: 'David Kim',
      contactEmail: 'david@novafintech.example',
      contactProvenance: {
        sourceUrl: 'https://novafintech.example/about',
        observedAt: new Date().toISOString(),
      },
      outreachDetails: { channel: 'email', subject: 'P', body: 'B', senderAgentId: 's' },
      outreachResponseDetails: { sentiment: 'positive', content: 'C' },
      qualificationDetails: { budgetConfirmed: true, authorityConfirmed: true, needValidated: true, qualificationScore: 85 },
      ceoApprovalId: 'ceo-dec-auth-nova',
      customerAcceptance: { signedBy: 'David Kim', agreementRef: 'AGR-1' },
    });

    expect(cycle.status).toBe('paused');
    expect(cycle.currentStage).toBe('qa_security_gates');
    const stage = cycle.stages.find((s) => s.stage === 'qa_security_gates');
    expect(stage?.status).toBe('pending');
    expect(stage?.details?.blocked).toBe(true);
    expect(stage?.details?.criticalVulnerabilitiesFound).toBe(2);
    expect(stage?.details?.reason).toContain('Critical security vulnerabilities (2) or regression failure blocked release gates');
  });
});
