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
  CustomerAccountStatus,
  CustomerHealthTier,
  DeliveryOutcomeStatus,
  SupportCaseSeverity,
  SupportCaseStatus,
  FeedbackSentiment,
  FeedbackCategory,
  ProfitabilityStatus,
  LearningSourceType,
  LearningCategory,
} from '@umer/contracts';
import {
  CustomerAccountSchema,
  DeliveryOutcomeSchema,
  SupportCaseSchema,
  CustomerFeedbackSchema,
  ProjectFinancialSummarySchema,
  LearningRecordSchema,
} from '@umer/contracts';
import type { CustomerSuccessStore } from './customer-success-store.js';
import type { MySqlExecutor } from './persistence.js';

export type MySqlCustomerSuccessStoreOptions = {
  db: MySqlExecutor;
};

function toMySqlDateTime(isoString?: string | Date | null): string | null {
  if (!isoString) return null;
  const date = isoString instanceof Date ? isoString : new Date(isoString);
  if (isNaN(date.getTime())) {
    if (typeof isoString === 'string') {
      return isoString.replace('T', ' ').replace('Z', '');
    }
    return null;
  }
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function toIsoDateTime(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) return dateVal.toISOString();
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) return dateVal;
    return `${dateVal.replace(' ', 'T')}Z`;
  }
  return String(dateVal);
}

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

type CustomerAccountRow = {
  id: string;
  prospect_id: string;
  deal_id: string | null;
  company_name: string;
  status: CustomerAccountStatus;
  health_score: number;
  health_tier: CustomerHealthTier;
  primary_contact_id: string | null;
  active_project_ids_json: string | string[];
  mrr: number | string;
  lifetime_value: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type DeliveryOutcomeRow = {
  id: string;
  project_id: string;
  customer_id: string;
  status: DeliveryOutcomeStatus;
  delivered_at: string | Date;
  scope_delivered_percent: number | string;
  acceptance_criteria_met: number | boolean;
  client_signoff_json: string | Record<string, unknown>;
  kpi_results_json: string | unknown[];
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SupportCaseRow = {
  id: string;
  customer_id: string;
  project_id: string | null;
  title: string;
  description: string;
  severity: SupportCaseSeverity;
  status: SupportCaseStatus;
  sla_hours: number;
  sla_breached: number | boolean;
  reported_by: string;
  assigned_specialist: string;
  resolution_summary: string | null;
  resolved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type CustomerFeedbackRow = {
  id: string;
  customer_id: string;
  project_id: string;
  nps_score: number;
  csat_score: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  feedback_text: string;
  actionable_quotes_json: string | string[];
  submitted_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type FinancialSummaryRow = {
  id: string;
  project_id: string;
  customer_id: string;
  contract_revenue: number | string;
  recognized_revenue: number | string;
  invoiced_amount: number | string;
  collected_amount: number | string;
  costs_json: string | Record<string, unknown>;
  gross_margin: number | string;
  margin_percentage: number | string;
  profitability_status: ProfitabilityStatus;
  calculated_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type LearningRow = {
  id: string;
  source_type: LearningSourceType;
  project_id: string | null;
  customer_id: string | null;
  opportunity_id: string | null;
  title: string;
  category: LearningCategory;
  key_insight: string;
  recommended_actions_json: string | string[];
  impact_estimates_json: string | Record<string, unknown> | null;
  status: string;
  extracted_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

export class MySqlCustomerSuccessStore implements CustomerSuccessStore {
  private readonly db: MySqlExecutor;

  constructor(options: MySqlCustomerSuccessStoreOptions) {
    this.db = options.db;
  }

  // ---------------------------------------------------------------------------
  // Customer Accounts
  // ---------------------------------------------------------------------------

  async saveCustomer(customer: CustomerAccount): Promise<void> {
    const valid = CustomerAccountSchema.parse(customer);
    const sql = `
      INSERT INTO customer_accounts (
        id, prospect_id, deal_id, company_name, status,
        health_score, health_tier, primary_contact_id,
        active_project_ids_json, mrr, lifetime_value,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        prospect_id = VALUES(prospect_id),
        deal_id = VALUES(deal_id),
        company_name = VALUES(company_name),
        status = VALUES(status),
        health_score = VALUES(health_score),
        health_tier = VALUES(health_tier),
        primary_contact_id = VALUES(primary_contact_id),
        active_project_ids_json = VALUES(active_project_ids_json),
        mrr = VALUES(mrr),
        lifetime_value = VALUES(lifetime_value),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.prospectId,
      valid.dealId ?? null,
      valid.companyName,
      valid.status,
      valid.healthScore,
      valid.healthTier,
      valid.primaryContactId ?? null,
      JSON.stringify(valid.activeProjectIds ?? []),
      valid.mrr ?? 0,
      valid.lifetimeValue ?? 0,
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async getCustomer(id: CustomerId): Promise<CustomerAccount | undefined> {
    const rows = await this.db.execute<CustomerAccountRow[]>(
      'SELECT * FROM customer_accounts WHERE id = ?',
      [id],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapCustomerRow(rows[0]);
  }

  async listCustomers(): Promise<CustomerAccount[]> {
    const rows = await this.db.execute<CustomerAccountRow[]>(
      'SELECT * FROM customer_accounts ORDER BY updated_at DESC',
    );
    return (rows || []).map((r) => this.mapCustomerRow(r));
  }

  private mapCustomerRow(row: CustomerAccountRow): CustomerAccount {
    return CustomerAccountSchema.parse({
      id: row.id,
      prospectId: row.prospect_id,
      dealId: row.deal_id ?? undefined,
      companyName: row.company_name,
      status: row.status,
      healthScore: Number(row.health_score),
      healthTier: row.health_tier,
      primaryContactId: row.primary_contact_id ?? undefined,
      activeProjectIds: safeJsonParse<string[]>(row.active_project_ids_json, []),
      mrr: Number(row.mrr),
      lifetimeValue: Number(row.lifetime_value),
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery Outcomes
  // ---------------------------------------------------------------------------

  async saveDeliveryOutcome(outcome: DeliveryOutcome): Promise<void> {
    const valid = DeliveryOutcomeSchema.parse(outcome);
    const sql = `
      INSERT INTO customer_delivery_outcomes (
        id, project_id, customer_id, status, delivered_at,
        scope_delivered_percent, acceptance_criteria_met,
        client_signoff_json, kpi_results_json, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        delivered_at = VALUES(delivered_at),
        scope_delivered_percent = VALUES(scope_delivered_percent),
        acceptance_criteria_met = VALUES(acceptance_criteria_met),
        client_signoff_json = VALUES(client_signoff_json),
        kpi_results_json = VALUES(kpi_results_json),
        notes = VALUES(notes),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.projectId,
      valid.customerId,
      valid.status,
      toMySqlDateTime(valid.deliveredAt),
      valid.scopeDeliveredPercent,
      valid.acceptanceCriteriaMet ? 1 : 0,
      JSON.stringify(valid.clientSignoff),
      JSON.stringify(valid.kpiResults ?? []),
      valid.notes ?? null,
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async getDeliveryOutcome(projectId: ProjectId): Promise<DeliveryOutcome | undefined> {
    const rows = await this.db.execute<DeliveryOutcomeRow[]>(
      'SELECT * FROM customer_delivery_outcomes WHERE project_id = ? ORDER BY delivered_at DESC LIMIT 1',
      [projectId],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapDeliveryOutcomeRow(rows[0]);
  }

  async listDeliveryOutcomes(): Promise<DeliveryOutcome[]> {
    const rows = await this.db.execute<DeliveryOutcomeRow[]>(
      'SELECT * FROM customer_delivery_outcomes ORDER BY delivered_at DESC',
    );
    return (rows || []).map((r) => this.mapDeliveryOutcomeRow(r));
  }

  private mapDeliveryOutcomeRow(row: DeliveryOutcomeRow): DeliveryOutcome {
    return DeliveryOutcomeSchema.parse({
      id: row.id,
      projectId: row.project_id,
      customerId: row.customer_id,
      status: row.status,
      deliveredAt: toIsoDateTime(row.delivered_at),
      scopeDeliveredPercent: Number(row.scope_delivered_percent),
      acceptanceCriteriaMet: Boolean(row.acceptance_criteria_met),
      clientSignoff: safeJsonParse(row.client_signoff_json, {}),
      kpiResults: safeJsonParse(row.kpi_results_json, []),
      notes: row.notes ?? undefined,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // ---------------------------------------------------------------------------
  // Support Cases
  // ---------------------------------------------------------------------------

  async saveSupportCase(supportCase: SupportCase): Promise<void> {
    const valid = SupportCaseSchema.parse(supportCase);
    const sql = `
      INSERT INTO customer_support_cases (
        id, customer_id, project_id, title, description,
        severity, status, sla_hours, sla_breached,
        reported_by, assigned_specialist, resolution_summary,
        resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        severity = VALUES(severity),
        title = VALUES(title),
        description = VALUES(description),
        sla_hours = VALUES(sla_hours),
        sla_breached = VALUES(sla_breached),
        assigned_specialist = VALUES(assigned_specialist),
        resolution_summary = VALUES(resolution_summary),
        resolved_at = VALUES(resolved_at),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.customerId,
      valid.projectId ?? null,
      valid.title,
      valid.description,
      valid.severity,
      valid.status,
      valid.slaHours,
      valid.slaBreached ? 1 : 0,
      valid.reportedBy,
      valid.assignedSpecialist,
      valid.resolutionSummary ?? null,
      toMySqlDateTime(valid.resolvedAt),
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async getSupportCase(id: CaseId): Promise<SupportCase | undefined> {
    const rows = await this.db.execute<SupportCaseRow[]>(
      'SELECT * FROM customer_support_cases WHERE id = ?',
      [id],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapSupportCaseRow(rows[0]);
  }

  async listSupportCases(customerId?: CustomerId): Promise<SupportCase[]> {
    let sql = 'SELECT * FROM customer_support_cases';
    const params: unknown[] = [];
    if (customerId) {
      sql += ' WHERE customer_id = ?';
      params.push(customerId);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await this.db.execute<SupportCaseRow[]>(sql, params);
    return (rows || []).map((r) => this.mapSupportCaseRow(r));
  }

  private mapSupportCaseRow(row: SupportCaseRow): SupportCase {
    return SupportCaseSchema.parse({
      id: row.id,
      customerId: row.customer_id,
      projectId: row.project_id ?? undefined,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      slaHours: Number(row.sla_hours),
      slaBreached: Boolean(row.sla_breached),
      reportedBy: row.reported_by,
      assignedSpecialist: row.assigned_specialist,
      resolutionSummary: row.resolution_summary ?? undefined,
      resolvedAt: row.resolved_at ? toIsoDateTime(row.resolved_at) : undefined,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // ---------------------------------------------------------------------------
  // Customer Feedback
  // ---------------------------------------------------------------------------

  async saveCustomerFeedback(feedback: CustomerFeedback): Promise<void> {
    const valid = CustomerFeedbackSchema.parse(feedback);
    const sql = `
      INSERT INTO customer_feedback (
        id, customer_id, project_id, nps_score, csat_score,
        sentiment, category, feedback_text, actionable_quotes_json,
        submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nps_score = VALUES(nps_score),
        csat_score = VALUES(csat_score),
        sentiment = VALUES(sentiment),
        category = VALUES(category),
        feedback_text = VALUES(feedback_text),
        actionable_quotes_json = VALUES(actionable_quotes_json),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.customerId,
      valid.projectId,
      valid.npsScore,
      valid.csatScore,
      valid.sentiment,
      valid.category,
      valid.feedbackText,
      JSON.stringify(valid.actionableQuotes ?? []),
      toMySqlDateTime(valid.submittedAt),
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async listCustomerFeedback(customerId?: CustomerId): Promise<CustomerFeedback[]> {
    let sql = 'SELECT * FROM customer_feedback';
    const params: unknown[] = [];
    if (customerId) {
      sql += ' WHERE customer_id = ?';
      params.push(customerId);
    }
    sql += ' ORDER BY submitted_at DESC';
    const rows = await this.db.execute<CustomerFeedbackRow[]>(sql, params);
    return (rows || []).map((r) => this.mapCustomerFeedbackRow(r));
  }

  private mapCustomerFeedbackRow(row: CustomerFeedbackRow): CustomerFeedback {
    return CustomerFeedbackSchema.parse({
      id: row.id,
      customerId: row.customer_id,
      projectId: row.project_id,
      npsScore: Number(row.nps_score),
      csatScore: Number(row.csat_score),
      sentiment: row.sentiment,
      category: row.category,
      feedbackText: row.feedback_text,
      actionableQuotes: safeJsonParse<string[]>(row.actionable_quotes_json, []),
      submittedAt: toIsoDateTime(row.submitted_at),
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // ---------------------------------------------------------------------------
  // Financial Summaries
  // ---------------------------------------------------------------------------

  async saveFinancialSummary(summary: ProjectFinancialSummary): Promise<void> {
    const valid = ProjectFinancialSummarySchema.parse(summary);
    const sql = `
      INSERT INTO customer_financial_summaries (
        id, project_id, customer_id, contract_revenue, recognized_revenue,
        invoiced_amount, collected_amount, costs_json, gross_margin,
        margin_percentage, profitability_status, calculated_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        contract_revenue = VALUES(contract_revenue),
        recognized_revenue = VALUES(recognized_revenue),
        invoiced_amount = VALUES(invoiced_amount),
        collected_amount = VALUES(collected_amount),
        costs_json = VALUES(costs_json),
        gross_margin = VALUES(gross_margin),
        margin_percentage = VALUES(margin_percentage),
        profitability_status = VALUES(profitability_status),
        calculated_at = VALUES(calculated_at),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.projectId,
      valid.customerId,
      valid.contractRevenue,
      valid.recognizedRevenue,
      valid.invoicedAmount,
      valid.collectedAmount,
      JSON.stringify(valid.costs),
      valid.grossMargin,
      valid.marginPercent,
      valid.profitabilityStatus,
      toMySqlDateTime(valid.calculatedAt),
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async getFinancialSummary(projectId: ProjectId): Promise<ProjectFinancialSummary | undefined> {
    const rows = await this.db.execute<FinancialSummaryRow[]>(
      'SELECT * FROM customer_financial_summaries WHERE project_id = ? ORDER BY calculated_at DESC LIMIT 1',
      [projectId],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapFinancialSummaryRow(rows[0]);
  }

  async listFinancialSummaries(customerId?: CustomerId): Promise<ProjectFinancialSummary[]> {
    let sql = 'SELECT * FROM customer_financial_summaries';
    const params: unknown[] = [];
    if (customerId) {
      sql += ' WHERE customer_id = ?';
      params.push(customerId);
    }
    sql += ' ORDER BY calculated_at DESC';
    const rows = await this.db.execute<FinancialSummaryRow[]>(sql, params);
    return (rows || []).map((r) => this.mapFinancialSummaryRow(r));
  }

  private mapFinancialSummaryRow(row: FinancialSummaryRow): ProjectFinancialSummary {
    return ProjectFinancialSummarySchema.parse({
      id: row.id,
      projectId: row.project_id,
      customerId: row.customer_id,
      contractRevenue: Number(row.contract_revenue),
      recognizedRevenue: Number(row.recognized_revenue),
      invoicedAmount: Number(row.invoiced_amount),
      collectedAmount: Number(row.collected_amount),
      costs: safeJsonParse(row.costs_json, {}),
      grossMargin: Number(row.gross_margin),
      marginPercent: Number(row.margin_percentage),
      profitabilityStatus: row.profitability_status,
      calculatedAt: toIsoDateTime(row.calculated_at),
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // ---------------------------------------------------------------------------
  // Organizational Learnings
  // ---------------------------------------------------------------------------

  async saveLearning(learning: LearningRecord): Promise<void> {
    const valid = LearningRecordSchema.parse(learning);
    const sql = `
      INSERT INTO customer_learnings (
        id, source_type, project_id, customer_id, opportunity_id,
        title, category, key_insight, recommended_actions_json,
        impact_estimates_json, status, extracted_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        key_insight = VALUES(key_insight),
        recommended_actions_json = VALUES(recommended_actions_json),
        impact_estimates_json = VALUES(impact_estimates_json),
        status = VALUES(status),
        updated_at = VALUES(updated_at)
    `;
    await this.db.execute(sql, [
      valid.id,
      valid.sourceType,
      valid.projectId ?? null,
      valid.customerId ?? null,
      valid.opportunityId ?? null,
      valid.title,
      valid.category,
      valid.keyInsight,
      JSON.stringify(valid.recommendedActions ?? []),
      valid.impactOnFutureEstimates ? JSON.stringify(valid.impactOnFutureEstimates) : null,
      'active',
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.createdAt),
      toMySqlDateTime(valid.updatedAt),
    ]);
  }

  async listLearnings(filter?: { category?: string; sourceType?: string }): Promise<LearningRecord[]> {
    let sql = 'SELECT * FROM customer_learnings';
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.category) {
      conditions.push('category = ?');
      params.push(filter.category);
    }
    if (filter?.sourceType) {
      conditions.push('source_type = ?');
      params.push(filter.sourceType);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await this.db.execute<LearningRow[]>(sql, params);
    return (rows || []).map((r) => this.mapLearningRow(r));
  }

  private mapLearningRow(row: LearningRow): LearningRecord {
    return LearningRecordSchema.parse({
      id: row.id,
      sourceType: row.source_type,
      projectId: row.project_id ?? undefined,
      customerId: row.customer_id ?? undefined,
      opportunityId: row.opportunity_id ?? undefined,
      title: row.title,
      category: row.category,
      keyInsight: row.key_insight,
      recommendedActions: safeJsonParse<string[]>(row.recommended_actions_json, []),
      impactOnFutureEstimates: row.impact_estimates_json
        ? safeJsonParse(row.impact_estimates_json, undefined)
        : undefined,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }
}
