import { randomUUID } from 'node:crypto';
import {
  type CustomerAccount,
  CustomerAccountSchema,
  type CustomerId,
  CustomerIdSchema,
  type CustomerAccountStatus,
  type CustomerHealthTier,
  type DeliveryOutcome,
  DeliveryOutcomeSchema,
  type DeliveryOutcomeId,
  DeliveryOutcomeIdSchema,
  type DeliveryOutcomeStatus,
  type ClientSignoff,
  type DeliveryKpiResult,
  type SupportCase,
  SupportCaseSchema,
  type CaseId,
  CaseIdSchema,
  type SupportCaseSeverity,
  type CustomerFeedback,
  CustomerFeedbackSchema,
  type FeedbackId,
  FeedbackIdSchema,
  type FeedbackSentiment,
  type FeedbackCategory,
  type ProjectFinancialSummary,
  ProjectFinancialSummarySchema,
  type FinancialSummaryId,
  FinancialSummaryIdSchema,
  type FinancialCosts,
  type ProfitabilityStatus,
  type LearningRecord,
  LearningRecordSchema,
  type LearningId,
  LearningIdSchema,
  type LearningSourceType,
  type LearningCategory,
  type OpportunityCalibration,
  OpportunityCalibrationSchema,
  type ProjectId,
  type ContactId,
  type DealId,
} from '@umer/contracts';

export interface CustomerSuccessDeps {
  projects?: {
    get(id: ProjectId): Promise<{ id: string; name?: string } | undefined>;
    list(): Promise<Array<{ id: string; name?: string }>>;
  };
  opportunities?: {
    get(id: string): Promise<{ id: string; title: string } | null | undefined>;
  };
}

export interface CreateCustomerInput {
  id?: CustomerId;
  prospectId: string;
  dealId?: DealId;
  companyName: string;
  primaryContactId?: ContactId;
  activeProjectIds?: ProjectId[];
  mrr?: number;
  lifetimeValue?: number;
}

export interface RecordDeliveryOutcomeInput {
  id?: DeliveryOutcomeId;
  projectId: ProjectId;
  customerId: CustomerId;
  status: DeliveryOutcomeStatus;
  deliveredAt?: string;
  scopeDeliveredPercent: number;
  acceptanceCriteriaMet: boolean;
  clientSignoff: ClientSignoff;
  kpiResults?: DeliveryKpiResult[];
  notes?: string;
}

export interface CreateSupportCaseInput {
  id?: CaseId;
  customerId: CustomerId;
  projectId?: ProjectId;
  title: string;
  description: string;
  severity: SupportCaseSeverity;
  reportedBy: string;
  assignedSpecialist?: string;
  slaHours?: number;
}

export interface ResolveSupportCaseInput {
  resolutionSummary: string;
  resolvedAt?: string;
}

export interface RecordCustomerFeedbackInput {
  id?: FeedbackId;
  customerId: CustomerId;
  projectId: ProjectId;
  npsScore: number;
  csatScore: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  feedbackText: string;
  actionableQuotes?: string[];
}

export interface CalculateFinancialSummaryInput {
  id?: FinancialSummaryId;
  projectId: ProjectId;
  customerId: CustomerId;
  contractRevenue: number;
  recognizedRevenue?: number;
  invoicedAmount?: number;
  collectedAmount?: number;
  costs: Partial<FinancialCosts>;
}

export interface ExtractLearningInput {
  id?: LearningId;
  sourceType: LearningSourceType;
  projectId?: ProjectId;
  customerId?: CustomerId;
  opportunityId?: string;
  title: string;
  category: LearningCategory;
  keyInsight: string;
  recommendedActions: string[];
  impactOnFutureEstimates?: {
    suggestedPriceMultiplier?: number;
    riskFactorAdjustment?: number;
  };
}

export class CustomerSuccessEngine {
  private readonly customers = new Map<string, CustomerAccount>();
  private readonly deliveryOutcomes = new Map<string, DeliveryOutcome>();
  private readonly supportCases = new Map<string, SupportCase>();
  private readonly feedbackList = new Map<string, CustomerFeedback>();
  private readonly financialSummaries = new Map<string, ProjectFinancialSummary>();
  private readonly learnings = new Map<string, LearningRecord>();

  constructor(public readonly deps: CustomerSuccessDeps = {}) {}

  // ---------------------------------------------------------------------------
  // Customer Accounts
  // ---------------------------------------------------------------------------

  createCustomer(input: CreateCustomerInput): CustomerAccount {
    const now = new Date().toISOString();
    const id = input.id ?? CustomerIdSchema.parse(`cust-${randomUUID().slice(0, 8)}`);

    const record: CustomerAccount = CustomerAccountSchema.parse({
      id,
      prospectId: input.prospectId,
      dealId: input.dealId,
      companyName: input.companyName,
      status: 'onboarding',
      healthScore: 100,
      healthTier: 'healthy',
      primaryContactId: input.primaryContactId,
      activeProjectIds: input.activeProjectIds ?? [],
      mrr: input.mrr ?? 0,
      lifetimeValue: input.lifetimeValue ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    this.customers.set(id, record);
    return record;
  }

  getCustomer(id: CustomerId): CustomerAccount | undefined {
    return this.customers.get(id);
  }

  listCustomers(): CustomerAccount[] {
    return Array.from(this.customers.values());
  }

  updateCustomerHealth(customerId: CustomerId, healthDelta: number, reason?: string): CustomerAccount {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const newScore = Math.max(0, Math.min(100, customer.healthScore + healthDelta));
    let tier: CustomerHealthTier = 'healthy';
    let status: CustomerAccountStatus = customer.status;

    if (newScore < 50) {
      tier = 'critical';
      status = 'at_risk';
    } else if (newScore < 75) {
      tier = 'neutral';
    }

    const updated: CustomerAccount = {
      ...customer,
      healthScore: newScore,
      healthTier: tier,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(customerId, updated);

    if (tier === 'critical' && reason) {
      this.extractLearning({
        sourceType: 'customer_feedback',
        customerId,
        title: `Customer Health Deterioration: ${customer.companyName}`,
        category: 'customer_risk',
        keyInsight: `Health score dropped to ${newScore} (${tier}): ${reason}`,
        recommendedActions: [
          'Initiate executive sponsor outreach',
          'Audit active project deliverables and open support cases',
        ],
        impactOnFutureEstimates: {
          riskFactorAdjustment: 0.25,
        },
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Delivery Outcomes
  // ---------------------------------------------------------------------------

  recordDeliveryOutcome(input: RecordDeliveryOutcomeInput): DeliveryOutcome {
    const now = new Date().toISOString();
    const id = input.id ?? DeliveryOutcomeIdSchema.parse(`out-${randomUUID().slice(0, 8)}`);

    const record: DeliveryOutcome = DeliveryOutcomeSchema.parse({
      id,
      projectId: input.projectId,
      customerId: input.customerId,
      status: input.status,
      deliveredAt: input.deliveredAt ?? now,
      scopeDeliveredPercent: input.scopeDeliveredPercent,
      acceptanceCriteriaMet: input.acceptanceCriteriaMet,
      clientSignoff: input.clientSignoff,
      kpiResults: input.kpiResults ?? [],
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    });

    this.deliveryOutcomes.set(record.id, record);

    // Update customer account
    const customer = this.customers.get(input.customerId);
    if (customer) {
      const activeProjects = new Set(customer.activeProjectIds);
      activeProjects.add(input.projectId);

      let delta = 0;
      if (record.status === 'successful' && record.clientSignoff.clientSatisfactionScore >= 4) {
        delta = 5;
      } else if (record.status === 'partially_successful' || record.clientSignoff.clientSatisfactionScore === 3) {
        delta = -10;
      } else if (record.status === 'failed' || record.clientSignoff.clientSatisfactionScore <= 2) {
        delta = -30;
      }

      this.updateCustomerHealth(input.customerId, delta, `Delivery outcome status: ${record.status}`);
      const refreshed = this.customers.get(input.customerId)!;
      this.customers.set(input.customerId, {
        ...refreshed,
        status: refreshed.healthScore >= 50 ? 'active' : 'at_risk',
        activeProjectIds: Array.from(activeProjects),
      });
    }

    // Automatically synthesize organizational learning from the delivery outcome
    const isSuccess = record.status === 'successful' && record.acceptanceCriteriaMet;
    this.extractLearning({
      sourceType: 'delivery_outcome',
      projectId: input.projectId,
      customerId: input.customerId,
      title: `Delivery Outcome for ${input.projectId}: ${record.status}`,
      category: isSuccess ? 'delivery_workflow' : 'scope_estimation',
      keyInsight: isSuccess
        ? `Delivered ${record.scopeDeliveredPercent}% of scope with full criteria verified and CSAT ${record.clientSignoff.clientSatisfactionScore}/5.`
        : `Delivery fell short on scope (${record.scopeDeliveredPercent}%) or criteria; review specifications.`,
      recommendedActions: isSuccess
        ? ['Standardize architectural and test patterns applied in this delivery.']
        : ['Conduct pre-mortem scoping review and tighten automated gate criteria.'],
      impactOnFutureEstimates: {
        suggestedPriceMultiplier: isSuccess ? 0.98 : 1.15,
        riskFactorAdjustment: isSuccess ? -0.1 : 0.2,
      },
    });

    return record;
  }

  getDeliveryOutcome(projectId: ProjectId): DeliveryOutcome | undefined {
    for (const outcome of this.deliveryOutcomes.values()) {
      if (outcome.projectId === projectId) {
        return outcome;
      }
    }
    return undefined;
  }

  listDeliveryOutcomes(): DeliveryOutcome[] {
    return Array.from(this.deliveryOutcomes.values());
  }

  // ---------------------------------------------------------------------------
  // Support Cases
  // ---------------------------------------------------------------------------

  createSupportCase(input: CreateSupportCaseInput): SupportCase {
    const now = new Date().toISOString();
    const id = input.id ?? CaseIdSchema.parse(`case-${randomUUID().slice(0, 8)}`);

    const slaHoursMap: Record<SupportCaseSeverity, number> = {
      critical: 4,
      high: 12,
      medium: 24,
      low: 48,
    };
    const slaHours = input.slaHours ?? slaHoursMap[input.severity];

    const record: SupportCase = SupportCaseSchema.parse({
      id,
      customerId: input.customerId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'open',
      slaHours,
      reportedBy: input.reportedBy,
      assignedSpecialist: input.assignedSpecialist ?? 'operations.site-reliability',
      createdAt: now,
      updatedAt: now,
    });

    this.supportCases.set(record.id, record);

    // Apply temporary health penalty while case is open
    const penalties: Record<SupportCaseSeverity, number> = {
      critical: -15,
      high: -8,
      medium: -4,
      low: -1,
    };
    this.updateCustomerHealth(input.customerId, penalties[input.severity], `Support case opened: ${input.title}`);

    return record;
  }

  resolveSupportCase(caseId: CaseId, input: ResolveSupportCaseInput): SupportCase {
    const existing = this.supportCases.get(caseId);
    if (!existing) {
      throw new Error(`Support case ${caseId} not found`);
    }

    const resolvedAt = input.resolvedAt ?? new Date().toISOString();
    const createdMs = Date.parse(existing.createdAt);
    const resolvedMs = Date.parse(resolvedAt);
    const elapsedHours = (resolvedMs - createdMs) / (1000 * 60 * 60);
    const slaBreached = elapsedHours > existing.slaHours;

    const updated: SupportCase = {
      ...existing,
      status: 'resolved',
      resolvedAt,
      resolutionSummary: input.resolutionSummary,
      slaBreached,
      updatedAt: new Date().toISOString(),
    };

    this.supportCases.set(caseId, updated);

    // Restore customer health score based on SLA compliance
    const bonusMap: Record<SupportCaseSeverity, number> = {
      critical: 12,
      high: 6,
      medium: 3,
      low: 1,
    };
    const bonus = slaBreached ? Math.floor(bonusMap[existing.severity] / 2) : bonusMap[existing.severity];
    this.updateCustomerHealth(existing.customerId, bonus, `Support case resolved (SLA ${slaBreached ? 'Breached' : 'Met'})`);

    if (slaBreached || existing.severity === 'critical') {
      this.extractLearning({
        sourceType: 'support_postmortem',
        projectId: existing.projectId,
        customerId: existing.customerId,
        title: `Support Postmortem: ${existing.title}`,
        category: 'customer_risk',
        keyInsight: `Case took ${elapsedHours.toFixed(1)}h vs ${existing.slaHours}h SLA. Resolution: ${input.resolutionSummary}`,
        recommendedActions: [
          'Add automated health monitors to detect failure before customer reports it.',
          'Document runbook for expedited incident mitigation.',
        ],
        impactOnFutureEstimates: {
          riskFactorAdjustment: 0.1,
        },
      });
    }

    return updated;
  }

  getSupportCase(caseId: CaseId): SupportCase | undefined {
    return this.supportCases.get(caseId);
  }

  listSupportCases(customerId?: CustomerId): SupportCase[] {
    const cases = Array.from(this.supportCases.values());
    return customerId ? cases.filter((c) => c.customerId === customerId) : cases;
  }

  // ---------------------------------------------------------------------------
  // Customer Feedback
  // ---------------------------------------------------------------------------

  recordFeedback(input: RecordCustomerFeedbackInput): CustomerFeedback {
    const now = new Date().toISOString();
    const id = input.id ?? FeedbackIdSchema.parse(`fb-${randomUUID().slice(0, 8)}`);

    const record: CustomerFeedback = CustomerFeedbackSchema.parse({
      id,
      customerId: input.customerId,
      projectId: input.projectId,
      npsScore: input.npsScore,
      csatScore: input.csatScore,
      sentiment: input.sentiment,
      category: input.category,
      feedbackText: input.feedbackText,
      actionableQuotes: input.actionableQuotes ?? [],
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    this.feedbackList.set(record.id, record);

    // Adjust customer health according to feedback
    if (record.npsScore >= 9) {
      this.updateCustomerHealth(input.customerId, 10, 'NPS Promoter rating');
    } else if (record.npsScore <= 6) {
      this.updateCustomerHealth(input.customerId, -20, 'NPS Detractor rating');
    }

    this.extractLearning({
      sourceType: 'customer_feedback',
      projectId: input.projectId,
      customerId: input.customerId,
      title: `Client Feedback: ${input.category} (${input.sentiment})`,
      category: 'delivery_workflow',
      keyInsight: `NPS ${input.npsScore}/10, CSAT ${input.csatScore}/5: "${input.feedbackText}"`,
      recommendedActions:
        input.sentiment === 'positive'
          ? ['Incorporate client testimonial quotes into commercial proposals.']
          : ['Schedule retrospectives with delivery specialist to resolve negative feedback.'],
      impactOnFutureEstimates: {
        riskFactorAdjustment: input.sentiment === 'positive' ? -0.1 : 0.15,
      },
    });

    return record;
  }

  listFeedback(customerId?: CustomerId): CustomerFeedback[] {
    const list = Array.from(this.feedbackList.values());
    return customerId ? list.filter((f) => f.customerId === customerId) : list;
  }

  // ---------------------------------------------------------------------------
  // Project Financials & Profitability
  // ---------------------------------------------------------------------------

  calculateFinancialSummary(input: CalculateFinancialSummaryInput): ProjectFinancialSummary {
    const now = new Date().toISOString();
    const id = input.id ?? FinancialSummaryIdSchema.parse(`fin-${randomUUID().slice(0, 8)}`);

    const computeCost = input.costs.computeCost ?? 0;
    const tokenCost = input.costs.tokenCost ?? 0;
    const laborHours = input.costs.laborHours ?? 0;
    const laborCost = input.costs.laborCost ?? 0;
    const toolingCost = input.costs.toolingCost ?? 0;
    const totalCost = computeCost + tokenCost + laborCost + toolingCost;

    const grossMargin = input.contractRevenue - totalCost;
    const marginPercent = input.contractRevenue > 0
      ? Number(((grossMargin / input.contractRevenue) * 100).toFixed(2))
      : 0;

    let profitabilityStatus: ProfitabilityStatus = 'profitable';
    if (marginPercent >= 70) {
      profitabilityStatus = 'highly_profitable';
    } else if (marginPercent >= 20) {
      profitabilityStatus = 'profitable';
    } else if (marginPercent >= 0) {
      profitabilityStatus = 'break_even';
    } else {
      profitabilityStatus = 'unprofitable';
    }

    const record: ProjectFinancialSummary = ProjectFinancialSummarySchema.parse({
      id,
      projectId: input.projectId,
      customerId: input.customerId,
      contractRevenue: input.contractRevenue,
      recognizedRevenue: input.recognizedRevenue ?? input.contractRevenue,
      invoicedAmount: input.invoicedAmount ?? input.contractRevenue,
      collectedAmount: input.collectedAmount ?? input.contractRevenue,
      costs: {
        computeCost,
        tokenCost,
        laborHours,
        laborCost,
        toolingCost,
        totalCost,
      },
      grossMargin,
      marginPercent,
      profitabilityStatus,
      calculatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    this.financialSummaries.set(record.projectId, record);

    // Update customer lifetime value
    const customer = this.customers.get(input.customerId);
    if (customer) {
      this.customers.set(input.customerId, {
        ...customer,
        lifetimeValue: customer.lifetimeValue + (input.recognizedRevenue ?? input.contractRevenue),
        updatedAt: now,
      });
    }

    // Extract financial calibration learning
    const isUnderperforming = marginPercent < 20;
    this.extractLearning({
      sourceType: 'profitability_analysis',
      projectId: input.projectId,
      customerId: input.customerId,
      title: `Financial Margin Analysis: ${profitabilityStatus} (${marginPercent}%)`,
      category: 'pricing_calibration',
      keyInsight: `Contract $${input.contractRevenue} with costs $${totalCost} yielded $${grossMargin} gross margin (${marginPercent}%).`,
      recommendedActions: isUnderperforming
        ? [
            'Adjust proposal price estimation multiplier up by 20% on similar scoped projects.',
            'Optimize token consumption by setting tighter max_duration_ms on agent loops.',
          ]
        : ['Current pricing formula achieves desired gross margins.'],
      impactOnFutureEstimates: {
        suggestedPriceMultiplier: isUnderperforming ? 1.2 : 1.0,
        riskFactorAdjustment: isUnderperforming ? 0.15 : -0.05,
      },
    });

    return record;
  }

  getFinancialSummary(projectId: ProjectId): ProjectFinancialSummary | undefined {
    return this.financialSummaries.get(projectId);
  }

  listFinancialSummaries(): ProjectFinancialSummary[] {
    return Array.from(this.financialSummaries.values());
  }

  // ---------------------------------------------------------------------------
  // Learning & Institutional Memory
  // ---------------------------------------------------------------------------

  extractLearning(input: ExtractLearningInput): LearningRecord {
    const now = new Date().toISOString();
    const id = input.id ?? LearningIdSchema.parse(`learn-${randomUUID().slice(0, 8)}`);

    const record: LearningRecord = LearningRecordSchema.parse({
      id,
      sourceType: input.sourceType,
      projectId: input.projectId,
      customerId: input.customerId,
      opportunityId: input.opportunityId,
      title: input.title,
      category: input.category,
      keyInsight: input.keyInsight,
      recommendedActions: input.recommendedActions,
      impactOnFutureEstimates: input.impactOnFutureEstimates,
      createdAt: now,
      updatedAt: now,
    });

    this.learnings.set(record.id, record);
    return record;
  }

  listLearnings(category?: LearningCategory): LearningRecord[] {
    const list = Array.from(this.learnings.values());
    return category ? list.filter((l) => l.category === category) : list;
  }

  // ---------------------------------------------------------------------------
  // Opportunity Calibration (The Closed-Loop Feedback into Sales & Intelligence)
  // ---------------------------------------------------------------------------

  getOpportunityCalibration(): OpportunityCalibration {
    const outcomes = Array.from(this.deliveryOutcomes.values());
    const financials = Array.from(this.financialSummaries.values());
    const customers = Array.from(this.customers.values());
    const learnings = Array.from(this.learnings.values());

    const completedDeliveriesCount = outcomes.length;
    const successfulCount = outcomes.filter((o) => o.status === 'successful').length;
    const successRatePercent = completedDeliveriesCount > 0
      ? Number(((successfulCount / completedDeliveriesCount) * 100).toFixed(1))
      : 100;

    let averageMarginPercent = 70;
    if (financials.length > 0) {
      const sumMargin = financials.reduce((sum, f) => sum + f.marginPercent, 0);
      averageMarginPercent = Number((sumMargin / financials.length).toFixed(1));
    }

    let recommendedPriceMultiplier = 1.0;
    if (averageMarginPercent < 30) {
      recommendedPriceMultiplier = 1.25;
    } else if (averageMarginPercent < 50) {
      recommendedPriceMultiplier = 1.1;
    } else if (averageMarginPercent > 85) {
      recommendedPriceMultiplier = 0.95;
    }

    let overallCustomerHealthScore = 100;
    if (customers.length > 0) {
      const sumHealth = customers.reduce((sum, c) => sum + c.healthScore, 0);
      overallCustomerHealthScore = Math.round(sumHealth / customers.length);
    }

    return OpportunityCalibrationSchema.parse({
      completedDeliveriesCount,
      successRatePercent,
      averageMarginPercent,
      recommendedPriceMultiplier,
      overallCustomerHealthScore,
      activeLearningsCount: learnings.length,
      activeLearnings: learnings.slice(-20),
      calibratedAt: new Date().toISOString(),
    });
  }
}
