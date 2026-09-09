import { describe, it, expect } from 'vitest';
import { CustomerSuccessEngine } from './customer-success.js';
import {
  CustomerIdSchema,
  ProjectIdSchema,
  DealIdSchema,
  ContactIdSchema,
  CaseIdSchema,
} from '@umer/contracts';

describe('CustomerSuccessEngine', () => {
  const customerId = CustomerIdSchema.parse('cust-test-1');
  const projectId = ProjectIdSchema.parse('proj-alpha');
  const dealId = DealIdSchema.parse('deal-alpha');
  const contactId = ContactIdSchema.parse('ct-alpha');

  it('manages customer accounts lifecycle and health scores', async () => {
    const engine = new CustomerSuccessEngine();

    const customer = await engine.createCustomer({
      id: customerId,
      prospectId: 'prosp-100',
      dealId,
      companyName: 'Acme Robotics',
      primaryContactId: contactId,
    });

    expect(customer.id).toBe('cust-test-1');
    expect(customer.status).toBe('onboarding');
    expect(customer.healthScore).toBe(100);
    expect(customer.healthTier).toBe('healthy');

    // Penalize health
    const updated = await engine.updateCustomerHealth(customerId, -30, 'Delayed milestone');
    expect(updated.healthScore).toBe(70);
    expect(updated.healthTier).toBe('neutral');

    // Severe drop to critical
    const critical = await engine.updateCustomerHealth(customerId, -30, 'Executive escalation');
    expect(critical.healthScore).toBe(40);
    expect(critical.healthTier).toBe('critical');
    expect(critical.status).toBe('at_risk');

    // Generates learning on critical drop
    const learnings = await engine.listLearnings('customer_risk');
    expect(learnings.length).toBeGreaterThan(0);
    expect(learnings[0].title).toContain('Customer Health Deterioration');
  });

  it('records delivery outcomes, updates status to active, and extracts workflow learnings', async () => {
    const engine = new CustomerSuccessEngine();
    await engine.createCustomer({
      id: customerId,
      prospectId: 'prosp-100',
      companyName: 'Acme Robotics',
    });

    const outcome = await engine.recordDeliveryOutcome({
      projectId,
      customerId,
      status: 'successful',
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: {
        signedBy: 'Chief Architect',
        signedAt: '2026-09-09T15:00:00.000Z',
        clientSatisfactionScore: 5,
      },
      kpiResults: [
        { metric: 'Uptime', target: 99.9, actual: 99.95, achieved: true },
      ],
    });

    expect(outcome.status).toBe('successful');
    expect(outcome.scopeDeliveredPercent).toBe(100);

    // Customer status flipped to active
    const customer = await engine.getCustomer(customerId);
    expect(customer?.status).toBe('active');
    expect(customer?.activeProjectIds).toContain(projectId);

    // Delivery learning synthesized
    const workflowLearnings = await engine.listLearnings('delivery_workflow');
    expect(workflowLearnings).toHaveLength(1);
    expect(workflowLearnings[0].keyInsight).toContain('Delivered 100% of scope');
  });

  it('handles support case creation, SLA calculation, and SLA breach resolution', async () => {
    const engine = new CustomerSuccessEngine();
    await engine.createCustomer({
      id: customerId,
      prospectId: 'prosp-100',
      companyName: 'Acme Robotics',
    });

    // High severity ticket (12h SLA)
    const caseId = CaseIdSchema.parse('case-high-1');
    const supportCase = await engine.createSupportCase({
      id: caseId,
      customerId,
      projectId,
      title: 'Database connection spike',
      description: 'Connection pool exhausted under peak load',
      severity: 'high',
      reportedBy: 'DevOps Lead',
    });

    expect(supportCase.slaHours).toBe(12);
    expect(supportCase.status).toBe('open');

    // Customer health was temporarily docked -8
    expect((await engine.getCustomer(customerId))?.healthScore).toBe(92);

    // Resolve after 20 hours (SLA breach: 20h > 12h)
    const resolved = await engine.resolveSupportCase(caseId, {
      resolutionSummary: 'Added connection pool tuning and pgbouncer proxy',
      resolvedAt: new Date(Date.parse(supportCase.createdAt) + 20 * 3600 * 1000).toISOString(),
    });

    expect(resolved.status).toBe('resolved');
    expect(resolved.slaBreached).toBe(true);

    // Breached case creates postmortem learning
    const postmortems = await engine.listLearnings('customer_risk');
    const breachLearning = postmortems.find((l) => l.title.includes('Support Postmortem'));
    expect(breachLearning).toBeDefined();
    expect(breachLearning?.keyInsight).toContain('20.0h vs 12h SLA');
  });

  it('records client feedback and adjusts health according to NPS and sentiment', async () => {
    const engine = new CustomerSuccessEngine();
    await engine.createCustomer({
      id: customerId,
      prospectId: 'prosp-100',
      companyName: 'Acme Robotics',
    });

    // Negative feedback from a detractor
    const fb = await engine.recordFeedback({
      customerId,
      projectId,
      npsScore: 5,
      csatScore: 2,
      sentiment: 'negative',
      category: 'velocity',
      feedbackText: 'Delivery was two weeks later than initial estimate.',
    });

    expect(fb.npsScore).toBe(5);
    const customer = await engine.getCustomer(customerId);
    expect(customer?.healthScore).toBe(80); // 100 - 20

    // Positive feedback from a promoter
    await engine.recordFeedback({
      customerId,
      projectId,
      npsScore: 10,
      csatScore: 5,
      sentiment: 'positive',
      category: 'delivery_quality',
      feedbackText: 'Architecture and security reports were flawless.',
      actionableQuotes: ['Security report cleared our SOC2 audit without findings.'],
    });

    expect((await engine.getCustomer(customerId))?.healthScore).toBe(90); // 80 + 10
  });

  it('calculates project financials, margins, profitability status, and pricing calibration', async () => {
    const engine = new CustomerSuccessEngine();
    await engine.createCustomer({
      id: customerId,
      prospectId: 'prosp-100',
      companyName: 'Acme Robotics',
    });

    const summary = await engine.calculateFinancialSummary({
      projectId,
      customerId,
      contractRevenue: 25000,
      costs: {
        computeCost: 200,
        tokenCost: 450,
        laborHours: 15,
        laborCost: 2250,
        toolingCost: 100,
      },
    });

    expect(summary.costs.totalCost).toBe(3000);
    expect(summary.grossMargin).toBe(22000);
    expect(summary.marginPercent).toBe(88);
    expect(summary.profitabilityStatus).toBe('highly_profitable');

    // Customer LTV updated
    expect((await engine.getCustomer(customerId))?.lifetimeValue).toBe(25000);

    // Learning recorded
    const pricingLearnings = await engine.listLearnings('pricing_calibration');
    expect(pricingLearnings.length).toBeGreaterThan(0);
  });

  it('derives opportunity calibration dataset feeding future sales decisions', async () => {
    const engine = new CustomerSuccessEngine();
    const cust1 = CustomerIdSchema.parse('cust-1');
    const cust2 = CustomerIdSchema.parse('cust-2');

    await engine.createCustomer({ id: cust1, prospectId: 'p-1', companyName: 'Company One' });
    await engine.createCustomer({ id: cust2, prospectId: 'p-2', companyName: 'Company Two' });

    // 2 delivery outcomes: 1 successful, 1 partially successful
    await engine.recordDeliveryOutcome({
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: cust1,
      status: 'successful',
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: { signedBy: 'VP Eng', signedAt: '2026-09-09T00:00:00.000Z', clientSatisfactionScore: 5 },
    });
    await engine.recordDeliveryOutcome({
      projectId: ProjectIdSchema.parse('proj-2'),
      customerId: cust2,
      status: 'partially_successful',
      scopeDeliveredPercent: 80,
      acceptanceCriteriaMet: false,
      clientSignoff: { signedBy: 'Director', signedAt: '2026-09-09T00:00:00.000Z', clientSatisfactionScore: 3 },
    });

    // Financials
    await engine.calculateFinancialSummary({
      projectId: ProjectIdSchema.parse('proj-1'),
      customerId: cust1,
      contractRevenue: 20000,
      costs: { laborCost: 3000, tokenCost: 500 }, // $3500 cost -> $16500 margin (82.5%)
    });
    await engine.calculateFinancialSummary({
      projectId: ProjectIdSchema.parse('proj-2'),
      customerId: cust2,
      contractRevenue: 10000,
      costs: { laborCost: 7500, tokenCost: 1000 }, // $8500 cost -> $1500 margin (15% underperforming)
    });

    const calibration = await engine.getOpportunityCalibration();

    expect(calibration.completedDeliveriesCount).toBe(2);
    expect(calibration.successRatePercent).toBe(50); // 1 of 2 successful
    expect(calibration.averageMarginPercent).toBe(48.8); // (82.5 + 15) / 2
    expect(calibration.recommendedPriceMultiplier).toBe(1.1); // < 50% margin adjusts price up
    expect(calibration.overallCustomerHealthScore).toBeGreaterThan(0);
    expect(calibration.activeLearningsCount).toBeGreaterThan(0);
    expect(calibration.activeLearnings.length).toBeGreaterThan(0);
  });
});
