import type {
  CustomerAccount,
  CustomerId,
  DeliveryOutcome,
  SupportCase,
  CaseId,
  CustomerFeedback,
  ProjectFinancialSummary,
  LearningRecord,
  ProjectId,
} from '@umer/contracts';

export interface CustomerSuccessStore {
  // Customer Accounts
  saveCustomer(customer: CustomerAccount): Promise<void>;
  getCustomer(id: CustomerId): Promise<CustomerAccount | undefined>;
  listCustomers(): Promise<CustomerAccount[]>;

  // Delivery Outcomes
  saveDeliveryOutcome(outcome: DeliveryOutcome): Promise<void>;
  getDeliveryOutcome(projectId: ProjectId): Promise<DeliveryOutcome | undefined>;
  listDeliveryOutcomes(): Promise<DeliveryOutcome[]>;

  // Support Cases
  saveSupportCase(supportCase: SupportCase): Promise<void>;
  getSupportCase(id: CaseId): Promise<SupportCase | undefined>;
  listSupportCases(customerId?: CustomerId): Promise<SupportCase[]>;

  // Customer Feedback
  saveCustomerFeedback(feedback: CustomerFeedback): Promise<void>;
  listCustomerFeedback(customerId?: CustomerId): Promise<CustomerFeedback[]>;

  // Financial Summaries
  saveFinancialSummary(summary: ProjectFinancialSummary): Promise<void>;
  getFinancialSummary(projectId: ProjectId): Promise<ProjectFinancialSummary | undefined>;
  listFinancialSummaries(customerId?: CustomerId): Promise<ProjectFinancialSummary[]>;

  // Organizational Learnings
  saveLearning(learning: LearningRecord): Promise<void>;
  listLearnings(filter?: { category?: string; sourceType?: string }): Promise<LearningRecord[]>;
}

export class InMemoryCustomerSuccessStore implements CustomerSuccessStore {
  private readonly customers = new Map<string, CustomerAccount>();
  private readonly deliveryOutcomes = new Map<string, DeliveryOutcome>();
  private readonly supportCases = new Map<string, SupportCase>();
  private readonly feedbackList = new Map<string, CustomerFeedback>();
  private readonly financialSummaries = new Map<string, ProjectFinancialSummary>();
  private readonly learnings = new Map<string, LearningRecord>();

  async saveCustomer(customer: CustomerAccount): Promise<void> {
    this.customers.set(customer.id, { ...customer });
  }

  async getCustomer(id: CustomerId): Promise<CustomerAccount | undefined> {
    const cust = this.customers.get(id);
    return cust ? { ...cust } : undefined;
  }

  async listCustomers(): Promise<CustomerAccount[]> {
    return Array.from(this.customers.values()).map((c) => ({ ...c }));
  }

  async saveDeliveryOutcome(outcome: DeliveryOutcome): Promise<void> {
    this.deliveryOutcomes.set(outcome.id, { ...outcome });
  }

  async getDeliveryOutcome(projectId: ProjectId): Promise<DeliveryOutcome | undefined> {
    for (const outcome of this.deliveryOutcomes.values()) {
      if (outcome.projectId === projectId) {
        return { ...outcome };
      }
    }
    return undefined;
  }

  async listDeliveryOutcomes(): Promise<DeliveryOutcome[]> {
    return Array.from(this.deliveryOutcomes.values()).map((o) => ({ ...o }));
  }

  async saveSupportCase(supportCase: SupportCase): Promise<void> {
    this.supportCases.set(supportCase.id, { ...supportCase });
  }

  async getSupportCase(id: CaseId): Promise<SupportCase | undefined> {
    const sc = this.supportCases.get(id);
    return sc ? { ...sc } : undefined;
  }

  async listSupportCases(customerId?: CustomerId): Promise<SupportCase[]> {
    const cases = Array.from(this.supportCases.values()).map((sc) => ({ ...sc }));
    return customerId ? cases.filter((c) => c.customerId === customerId) : cases;
  }

  async saveCustomerFeedback(feedback: CustomerFeedback): Promise<void> {
    this.feedbackList.set(feedback.id, { ...feedback });
  }

  async listCustomerFeedback(customerId?: CustomerId): Promise<CustomerFeedback[]> {
    const feedbacks = Array.from(this.feedbackList.values()).map((fb) => ({ ...fb }));
    return customerId ? feedbacks.filter((fb) => fb.customerId === customerId) : feedbacks;
  }

  async saveFinancialSummary(summary: ProjectFinancialSummary): Promise<void> {
    this.financialSummaries.set(summary.id, { ...summary });
  }

  async getFinancialSummary(projectId: ProjectId): Promise<ProjectFinancialSummary | undefined> {
    for (const summary of this.financialSummaries.values()) {
      if (summary.projectId === projectId) {
        return { ...summary };
      }
    }
    return undefined;
  }

  async listFinancialSummaries(customerId?: CustomerId): Promise<ProjectFinancialSummary[]> {
    const summaries = Array.from(this.financialSummaries.values()).map((s) => ({ ...s }));
    return customerId ? summaries.filter((s) => s.customerId === customerId) : summaries;
  }

  async saveLearning(learning: LearningRecord): Promise<void> {
    this.learnings.set(learning.id, { ...learning });
  }

  async listLearnings(filter?: { category?: string; sourceType?: string }): Promise<LearningRecord[]> {
    let items = Array.from(this.learnings.values()).map((l) => ({ ...l }));
    if (filter?.category) {
      items = items.filter((l) => l.category === filter.category);
    }
    if (filter?.sourceType) {
      items = items.filter((l) => l.sourceType === filter.sourceType);
    }
    return items;
  }
}
