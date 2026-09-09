import { describe, it, expect } from 'vitest';
import {
  CustomerAccountSchema,
  DeliveryOutcomeSchema,
  SupportCaseSchema,
  CustomerFeedbackSchema,
  ProjectFinancialSummarySchema,
  LearningRecordSchema,
  OpportunityCalibrationSchema,
} from './index.js';
import {
  CustomerIdSchema,
  DealIdSchema,
  ContactIdSchema,
  ProjectIdSchema,
  DeliveryOutcomeIdSchema,
  CaseIdSchema,
  FeedbackIdSchema,
  FinancialSummaryIdSchema,
  LearningIdSchema,
} from '../index.js';

describe('@umer/contracts/customer-success', () => {
  const now = '2026-09-09T12:00:00.000Z';

  it('validates CustomerAccountSchema correctly', () => {
    const raw = {
      id: CustomerIdSchema.parse('cust-alpha-1'),
      prospectId: 'prosp-1',
      dealId: DealIdSchema.parse('deal-1'),
      companyName: 'Acme Corp',
      status: 'active',
      healthScore: 92,
      healthTier: 'healthy',
      primaryContactId: ContactIdSchema.parse('ct-1'),
      activeProjectIds: [ProjectIdSchema.parse('proj-1')],
      mrr: 2500,
      lifetimeValue: 30000,
      createdAt: now,
      updatedAt: now,
    };

    const parsed = CustomerAccountSchema.parse(raw);
    expect(parsed.id).toBe('cust-alpha-1');
    expect(parsed.healthScore).toBe(92);
    expect(parsed.status).toBe('active');
  });

  it('validates DeliveryOutcomeSchema correctly', () => {
    const raw = {
      id: DeliveryOutcomeIdSchema.parse('out-1'),
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      status: 'successful',
      deliveredAt: now,
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: {
        signedBy: 'Jane Doe, VP Product',
        signedAt: now,
        clientSatisfactionScore: 5,
      },
      kpiResults: [
        { metric: 'API Latency', target: 200, actual: 120, achieved: true },
        { metric: 'Test Coverage', target: 80, actual: 95, achieved: true },
      ],
      notes: 'Delivered ahead of schedule with zero defect leakage.',
      createdAt: now,
      updatedAt: now,
    };

    const parsed = DeliveryOutcomeSchema.parse(raw);
    expect(parsed.status).toBe('successful');
    expect(parsed.clientSignoff.clientSatisfactionScore).toBe(5);
    expect(parsed.kpiResults).toHaveLength(2);
  });

  it('validates SupportCaseSchema and SLA calculations', () => {
    const raw = {
      id: CaseIdSchema.parse('case-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      projectId: ProjectIdSchema.parse('proj-1'),
      title: 'Webhook delivery intermittent timeout',
      description: 'Customer reports 504 gateway timeouts on customer webhook deliveries.',
      severity: 'high',
      status: 'resolved',
      slaHours: 24,
      firstResponseAt: '2026-09-09T12:30:00.000Z',
      resolvedAt: '2026-09-09T16:00:00.000Z',
      resolutionSummary: 'Scaled webhook worker replica count from 2 to 6 and updated keep-alive.',
      slaBreached: false,
      reportedBy: 'Ops Lead, Acme',
      assignedSpecialist: 'operations.site-reliability',
      createdAt: now,
      updatedAt: '2026-09-09T16:00:00.000Z',
    };

    const parsed = SupportCaseSchema.parse(raw);
    expect(parsed.severity).toBe('high');
    expect(parsed.slaBreached).toBe(false);
    expect(parsed.status).toBe('resolved');
  });

  it('validates CustomerFeedbackSchema correctly', () => {
    const raw = {
      id: FeedbackIdSchema.parse('fb-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      projectId: ProjectIdSchema.parse('proj-1'),
      npsScore: 10,
      csatScore: 5,
      sentiment: 'positive',
      category: 'delivery_quality',
      feedbackText: 'The autonomous engineering delivery exceeded our expectations on speed and reliability.',
      actionableQuotes: ['Clean diffs and zero regressions.'],
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const parsed = CustomerFeedbackSchema.parse(raw);
    expect(parsed.npsScore).toBe(10);
    expect(parsed.sentiment).toBe('positive');
  });

  it('validates ProjectFinancialSummarySchema and margins', () => {
    const raw = {
      id: FinancialSummaryIdSchema.parse('fin-1'),
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      contractRevenue: 30000,
      recognizedRevenue: 30000,
      invoicedAmount: 30000,
      collectedAmount: 30000,
      costs: {
        computeCost: 150,
        tokenCost: 350,
        laborHours: 20,
        laborCost: 3000,
        toolingCost: 200,
        totalCost: 3700,
      },
      grossMargin: 26300,
      marginPercent: 87.67,
      profitabilityStatus: 'highly_profitable',
      calculatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const parsed = ProjectFinancialSummarySchema.parse(raw);
    expect(parsed.grossMargin).toBe(26300);
    expect(parsed.profitabilityStatus).toBe('highly_profitable');
  });

  it('validates LearningRecordSchema and impact on future estimates', () => {
    const raw = {
      id: LearningIdSchema.parse('learn-1'),
      sourceType: 'profitability_analysis',
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: CustomerIdSchema.parse('cust-1'),
      title: 'Staging isolation reduced integration QA cycle by 40%',
      category: 'delivery_workflow',
      keyInsight: 'Pre-verifying unified diffs in staging prevents regression loopbacks.',
      recommendedActions: ['Adopt staging verification for all greenfield work.'],
      impactOnFutureEstimates: {
        suggestedPriceMultiplier: 0.95,
        riskFactorAdjustment: -0.15,
      },
      createdAt: now,
      updatedAt: now,
    };

    const parsed = LearningRecordSchema.parse(raw);
    expect(parsed.category).toBe('delivery_workflow');
    expect(parsed.impactOnFutureEstimates?.riskFactorAdjustment).toBe(-0.15);
  });

  it('validates OpportunityCalibrationSchema with aggregated outcome data', () => {
    const raw = {
      completedDeliveriesCount: 12,
      successRatePercent: 91.6,
      averageMarginPercent: 84.5,
      recommendedPriceMultiplier: 1.05,
      overallCustomerHealthScore: 88,
      activeLearningsCount: 1,
      activeLearnings: [
        {
          id: LearningIdSchema.parse('learn-2'),
          sourceType: 'delivery_outcome',
          title: 'High-throughput Redis caching is critical for inventory sync',
          category: 'technical_pattern',
          keyInsight: 'Standard MySQL lock contention can be avoided using redis lease locks.',
          recommendedActions: ['Include Redis architecture pattern in inventory sync opportunities.'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      calibratedAt: now,
    };

    const parsed = OpportunityCalibrationSchema.parse(raw);
    expect(parsed.completedDeliveriesCount).toBe(12);
    expect(parsed.averageMarginPercent).toBe(84.5);
    expect(parsed.activeLearnings).toHaveLength(1);
  });
});
