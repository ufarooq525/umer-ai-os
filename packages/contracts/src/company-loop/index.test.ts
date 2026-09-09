import { describe, it, expect } from 'vitest';
import {
  CompanyLoopStageSchema,
  CompanyLoopCycleSchema,
  CompanyOverviewSchema,
  type CompanyLoopCycle,
  type CompanyOverview,
} from './index.js';
import {
  LoopCycleIdSchema,
  ProjectIdSchema,
  DealIdSchema,
  CustomerIdSchema,
} from '../common/ids.js';

describe('CompanyLoop contracts', () => {
  it('validates canonical stages', () => {
    expect(CompanyLoopStageSchema.parse('market_discovery')).toBe('market_discovery');
    expect(CompanyLoopStageSchema.parse('learning_calibration')).toBe('learning_calibration');
    expect(() => CompanyLoopStageSchema.parse('invalid_stage')).toThrow();
  });

  it('validates CompanyLoopCycleSchema', () => {
    const cycle: CompanyLoopCycle = {
      id: LoopCycleIdSchema.parse('cycle-123'),
      title: 'Automated Company Loop Cycle #1',
      status: 'active',
      currentStage: 'commercial_sales',
      opportunityId: 'opp-1',
      dealId: DealIdSchema.parse('deal-1'),
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      stages: [
        {
          stage: 'market_discovery',
          status: 'completed',
          startedAt: '2026-09-09T10:00:00.000Z',
          completedAt: '2026-09-09T10:05:00.000Z',
          details: { foundOpportunities: 2 },
        },
        {
          stage: 'commercial_sales',
          status: 'in_progress',
          startedAt: '2026-09-09T10:05:00.000Z',
          details: { proposalCreated: true },
        },
      ],
      startedAt: '2026-09-09T10:00:00.000Z',
    };

    const parsed = CompanyLoopCycleSchema.parse(cycle);
    expect(parsed.id).toBe('cycle-123');
    expect(parsed.stages).toHaveLength(2);
  });

  it('validates CompanyOverviewSchema with the 10 CEO questions answers', () => {
    const overview: CompanyOverview = {
      whatCompanyIsDoing: {
        activeProjectsCount: 2,
        runningTasksCount: 4,
        openDealsCount: 1,
        productionStatus: 'healthy',
        activeLoopCyclesCount: 1,
        summary: '2 projects active, 1 loop cycle in progress.',
      },
      opportunitiesPursued: [
        {
          id: 'opp-1',
          title: 'Fintech Automation Suite',
          status: 'approved',
          overallScore: 85,
          estimatedValue: 50000,
          recommendation: 'pursue',
        },
      ],
      prospectsThatMatter: [
        {
          prospectId: 'prospect-1',
          dealId: 'deal-1',
          companyName: 'Acme Financial',
          stage: 'proposal',
          estimatedValue: 50000,
        },
      ],
      agentsWorking: [
        {
          agentId: 'agent-dev-1',
          name: 'Lead Developer',
          department: 'engineering',
          specialistId: 'spec-ts-dev',
          status: 'busy',
          currentProjectId: 'proj-1',
        },
      ],
      projectsByAgent: {
        'agent-dev-1': {
          agentId: 'agent-dev-1',
          projectId: 'proj-1',
        },
      },
      evidenceSummary: {
        totalSealedArtifacts: 12,
        testPlanResultsCount: 5,
        securityReportsCount: 2,
        signedDeliveryOutcomesCount: 1,
      },
      blockedItems: [
        {
          type: 'gate',
          id: 'gate-prod-1',
          reason: 'Awaiting human signoff',
          blockedSince: '2026-09-09T12:00:00.000Z',
        },
      ],
      decisionsNeeded: [
        {
          type: 'deployment_approval',
          id: 'dec-1',
          title: 'Deploy to Production Cluster',
          urgency: 'high',
          requiredApprovers: ['CEO', 'SecuritySpecialist'],
        },
      ],
      nextActions: [
        {
          action: 'Approve deployment gate',
          targetType: 'gate',
          targetId: 'gate-prod-1',
          priority: 'high',
        },
      ],
      revenueAndOutcomes: {
        totalWonRevenue: 50000,
        recognizedRevenue: 25000,
        pipelineValue: 120000,
        averageMarginPercent: 42.5,
        averageCustomerHealthScore: 92,
        activeCustomersCount: 3,
        completedDeliveriesCount: 2,
        recommendedPriceMultiplier: 1.05,
      },
      generatedAt: '2026-09-09T12:00:00.000Z',
    };

    const parsed = CompanyOverviewSchema.parse(overview);
    expect(parsed.whatCompanyIsDoing.activeProjectsCount).toBe(2);
    expect(parsed.revenueAndOutcomes.totalWonRevenue).toBe(50000);
  });
});
