import { describe, expect, it } from 'vitest';
import { MySqlCustomerSuccessStore } from './customer-success-store-mysql.js';
import type { MySqlExecutor } from './persistence.js';
import { CustomerSuccessEngine } from './customer-success.js';
import {
  CustomerIdSchema,
  ProjectIdSchema,
  type CustomerAccount,
  type DeliveryOutcome,
  type SupportCase,
  type CustomerFeedback,
  type ProjectFinancialSummary,
  type LearningRecord,
} from '@umer/contracts';

/**
 * Creates a lightweight SQL executor simulating the 6 tables of migration 017_customer_success
 */
function createSimulatedMySqlExecutor(): MySqlExecutor & {
  tables: Record<string, Map<string, Record<string, unknown>>>;
} {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {
    customer_accounts: new Map(),
    customer_delivery_outcomes: new Map(),
    customer_support_cases: new Map(),
    customer_feedback: new Map(),
    customer_financial_summaries: new Map(),
    customer_learnings: new Map(),
  };

  const executor: MySqlExecutor = {
    async execute<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T> {
      const normalized = sql.trim().replace(/\s+/g, ' ');

      // --- customer_accounts ---
      if (normalized.startsWith('INSERT INTO customer_accounts')) {
        const [
          id,
          prospect_id,
          deal_id,
          company_name,
          status,
          health_score,
          health_tier,
          primary_contact_id,
          active_project_ids_json,
          mrr,
          lifetime_value,
          created_at,
          updated_at,
        ] = params;
        tables.customer_accounts.set(id as string, {
          id,
          prospect_id,
          deal_id,
          company_name,
          status,
          health_score,
          health_tier,
          primary_contact_id,
          active_project_ids_json,
          mrr,
          lifetime_value,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_accounts WHERE id = ?')) {
        const id = params[0] as string;
        const row = tables.customer_accounts.get(id);
        return (row ? [row] : []) as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_accounts ORDER BY updated_at DESC')) {
        return Array.from(tables.customer_accounts.values()) as T;
      }

      // --- customer_delivery_outcomes ---
      if (normalized.startsWith('INSERT INTO customer_delivery_outcomes')) {
        const [
          id,
          project_id,
          customer_id,
          status,
          delivered_at,
          scope_delivered_percent,
          acceptance_criteria_met,
          client_signoff_json,
          kpi_results_json,
          notes,
          created_at,
          updated_at,
        ] = params;
        tables.customer_delivery_outcomes.set(id as string, {
          id,
          project_id,
          customer_id,
          status,
          delivered_at,
          scope_delivered_percent,
          acceptance_criteria_met,
          client_signoff_json,
          kpi_results_json,
          notes,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_delivery_outcomes WHERE project_id = ?')) {
        const projectId = params[0] as string;
        const rows = Array.from(tables.customer_delivery_outcomes.values()).filter(
          (r) => r.project_id === projectId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_delivery_outcomes ORDER BY delivered_at DESC')) {
        return Array.from(tables.customer_delivery_outcomes.values()) as T;
      }

      // --- customer_support_cases ---
      if (normalized.startsWith('INSERT INTO customer_support_cases')) {
        const [
          id,
          customer_id,
          project_id,
          title,
          description,
          severity,
          status,
          sla_hours,
          sla_breached,
          reported_by,
          assigned_specialist,
          resolution_summary,
          resolved_at,
          created_at,
          updated_at,
        ] = params;
        tables.customer_support_cases.set(id as string, {
          id,
          customer_id,
          project_id,
          title,
          description,
          severity,
          status,
          sla_hours,
          sla_breached,
          reported_by,
          assigned_specialist,
          resolution_summary,
          resolved_at,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_support_cases WHERE id = ?')) {
        const id = params[0] as string;
        const row = tables.customer_support_cases.get(id);
        return (row ? [row] : []) as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_support_cases WHERE customer_id = ?')) {
        const customerId = params[0] as string;
        const rows = Array.from(tables.customer_support_cases.values()).filter(
          (r) => r.customer_id === customerId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_support_cases ORDER BY created_at DESC')) {
        return Array.from(tables.customer_support_cases.values()) as T;
      }

      // --- customer_feedback ---
      if (normalized.startsWith('INSERT INTO customer_feedback')) {
        const [
          id,
          customer_id,
          project_id,
          nps_score,
          csat_score,
          sentiment,
          category,
          feedback_text,
          actionable_quotes_json,
          submitted_at,
          created_at,
          updated_at,
        ] = params;
        tables.customer_feedback.set(id as string, {
          id,
          customer_id,
          project_id,
          nps_score,
          csat_score,
          sentiment,
          category,
          feedback_text,
          actionable_quotes_json,
          submitted_at,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_feedback WHERE customer_id = ?')) {
        const customerId = params[0] as string;
        const rows = Array.from(tables.customer_feedback.values()).filter(
          (r) => r.customer_id === customerId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_feedback ORDER BY submitted_at DESC')) {
        return Array.from(tables.customer_feedback.values()) as T;
      }

      // --- customer_financial_summaries ---
      if (normalized.startsWith('INSERT INTO customer_financial_summaries')) {
        const [
          id,
          project_id,
          customer_id,
          contract_revenue,
          recognized_revenue,
          invoiced_amount,
          collected_amount,
          costs_json,
          gross_margin,
          margin_percentage,
          profitability_status,
          calculated_at,
          created_at,
          updated_at,
        ] = params;
        tables.customer_financial_summaries.set(id as string, {
          id,
          project_id,
          customer_id,
          contract_revenue,
          recognized_revenue,
          invoiced_amount,
          collected_amount,
          costs_json,
          gross_margin,
          margin_percentage,
          profitability_status,
          calculated_at,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_financial_summaries WHERE project_id = ?')) {
        const projectId = params[0] as string;
        const rows = Array.from(tables.customer_financial_summaries.values()).filter(
          (r) => r.project_id === projectId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_financial_summaries WHERE customer_id = ?')) {
        const customerId = params[0] as string;
        const rows = Array.from(tables.customer_financial_summaries.values()).filter(
          (r) => r.customer_id === customerId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_financial_summaries ORDER BY calculated_at DESC')) {
        return Array.from(tables.customer_financial_summaries.values()) as T;
      }

      // --- customer_learnings ---
      if (normalized.startsWith('INSERT INTO customer_learnings')) {
        const [
          id,
          source_type,
          project_id,
          customer_id,
          opportunity_id,
          title,
          category,
          key_insight,
          recommended_actions_json,
          impact_estimates_json,
          status,
          extracted_at,
          created_at,
          updated_at,
        ] = params;
        tables.customer_learnings.set(id as string, {
          id,
          source_type,
          project_id,
          customer_id,
          opportunity_id,
          title,
          category,
          key_insight,
          recommended_actions_json,
          impact_estimates_json,
          status,
          extracted_at,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM customer_learnings')) {
        let items = Array.from(tables.customer_learnings.values());
        if (normalized.includes('category = ?')) {
          const cat = params[0] as string;
          items = items.filter((i) => i.category === cat);
        }
        return items as T;
      }

      throw new Error(`Unhandled SQL query in simulated executor: ${sql}`);
    },
    tables,
  };

  return executor;
}

describe('MySqlCustomerSuccessStore', () => {
  it('persists customer accounts with reload durability', async () => {
    const db = createSimulatedMySqlExecutor();
    const store1 = new MySqlCustomerSuccessStore({ db });

    const custId = CustomerIdSchema.parse('cust-alpha-1');
    const customer: CustomerAccount = {
      id: custId,
      prospectId: 'prosp-alpha',
      companyName: 'Apex Health Systems',
      status: 'onboarding',
      healthScore: 95,
      healthTier: 'healthy',
      activeProjectIds: ['proj-1', 'proj-2'],
      mrr: 12500,
      lifetimeValue: 150000,
      createdAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T10:00:00.000Z',
    };

    await store1.saveCustomer(customer);

    // Reload from a fresh store instance pointing to same db
    const store2 = new MySqlCustomerSuccessStore({ db });
    const loaded = await store2.getCustomer(custId);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe('cust-alpha-1');
    expect(loaded?.companyName).toBe('Apex Health Systems');
    expect(loaded?.healthScore).toBe(95);
    expect(loaded?.activeProjectIds).toEqual(['proj-1', 'proj-2']);
    expect(loaded?.mrr).toBe(12500);

    const list = await store2.listCustomers();
    expect(list).toHaveLength(1);
    expect(list[0].companyName).toBe('Apex Health Systems');
  });

  it('persists delivery outcomes and preserves verification evidence', async () => {
    const db = createSimulatedMySqlExecutor();
    const store = new MySqlCustomerSuccessStore({ db });

    const outcome: DeliveryOutcome = {
      id: 'out-1',
      projectId: ProjectIdSchema.parse('proj-deliv-1'),
      customerId: CustomerIdSchema.parse('cust-deliv-1'),
      status: 'successful',
      deliveredAt: '2026-09-09T12:00:00.000Z',
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: {
        signedBy: 'Dr. Sarah Connor',
        signedAt: '2026-09-09T12:30:00.000Z',
        clientSatisfactionScore: 5,
      },
      kpiResults: [{ metric: 'Latency', target: 200, actual: 120, achieved: true }],
      notes: 'Deployment verified healthy on production cluster',
      createdAt: '2026-09-09T12:00:00.000Z',
      updatedAt: '2026-09-09T12:30:00.000Z',
    };

    await store.saveDeliveryOutcome(outcome);

    const storeReloaded = new MySqlCustomerSuccessStore({ db });
    const loaded = await storeReloaded.getDeliveryOutcome(ProjectIdSchema.parse('proj-deliv-1'));

    expect(loaded).toBeDefined();
    expect(loaded?.status).toBe('successful');
    expect(loaded?.acceptanceCriteriaMet).toBe(true);
    expect(loaded?.clientSignoff.signedBy).toBe('Dr. Sarah Connor');
    expect(loaded?.kpiResults).toHaveLength(1);
  });

  it('persists support cases, resolutions, and SLA tracking', async () => {
    const db = createSimulatedMySqlExecutor();
    const store = new MySqlCustomerSuccessStore({ db });

    const supportCase: SupportCase = {
      id: 'case-alpha-1',
      customerId: CustomerIdSchema.parse('cust-supp-1'),
      projectId: ProjectIdSchema.parse('proj-supp-1'),
      title: 'Memory leak in worker pool',
      description: 'Workers consuming 95% RAM',
      severity: 'critical',
      status: 'resolved',
      slaHours: 4,
      slaBreached: false,
      reportedBy: 'Site Reliability Watchdog',
      assignedSpecialist: 'operations.site-reliability',
      resolutionSummary: 'Garbage collection cycle adjusted',
      resolvedAt: '2026-09-09T14:00:00.000Z',
      createdAt: '2026-09-09T11:00:00.000Z',
      updatedAt: '2026-09-09T14:00:00.000Z',
    };

    await store.saveSupportCase(supportCase);

    const storeReloaded = new MySqlCustomerSuccessStore({ db });
    const loaded = await storeReloaded.getSupportCase('case-alpha-1');

    expect(loaded).toBeDefined();
    expect(loaded?.severity).toBe('critical');
    expect(loaded?.status).toBe('resolved');
    expect(loaded?.slaBreached).toBe(false);
    expect(loaded?.resolutionSummary).toBe('Garbage collection cycle adjusted');

    const list = await storeReloaded.listSupportCases(CustomerIdSchema.parse('cust-supp-1'));
    expect(list).toHaveLength(1);
  });

  it('persists feedback, financials, and organizational learnings', async () => {
    const db = createSimulatedMySqlExecutor();
    const store = new MySqlCustomerSuccessStore({ db });

    const feedback: CustomerFeedback = {
      id: 'fb-1',
      customerId: CustomerIdSchema.parse('cust-fb-1'),
      projectId: ProjectIdSchema.parse('proj-fb-1'),
      npsScore: 10,
      csatScore: 5,
      sentiment: 'positive',
      category: 'delivery_quality',
      feedbackText: 'Autonomous deployment executed without a single hitch.',
      actionableQuotes: ['Zero downtime during microservice cutover.'],
      submittedAt: '2026-09-09T15:00:00.000Z',
      createdAt: '2026-09-09T15:00:00.000Z',
      updatedAt: '2026-09-09T15:00:00.000Z',
    };
    await store.saveCustomerFeedback(feedback);

    const financial: ProjectFinancialSummary = {
      id: 'fin-1',
      projectId: ProjectIdSchema.parse('proj-fb-1'),
      customerId: CustomerIdSchema.parse('cust-fb-1'),
      contractRevenue: 45000,
      recognizedRevenue: 45000,
      invoicedAmount: 45000,
      collectedAmount: 45000,
      costs: { computeCost: 500, tokenCost: 800, laborCost: 4000, toolingCost: 200, totalCost: 5500 },
      grossMargin: 39500,
      marginPercent: 87.78,
      profitabilityStatus: 'highly_profitable',
      calculatedAt: '2026-09-09T16:00:00.000Z',
      createdAt: '2026-09-09T16:00:00.000Z',
      updatedAt: '2026-09-09T16:00:00.000Z',
    };
    await store.saveFinancialSummary(financial);

    const learning: LearningRecord = {
      id: 'learn-1',
      sourceType: 'delivery_outcome',
      projectId: ProjectIdSchema.parse('proj-fb-1'),
      customerId: CustomerIdSchema.parse('cust-fb-1'),
      title: 'Optimal Resource Sizing',
      category: 'technical_pattern',
      keyInsight: 'Node cluster sizing reduced token latency by 45%',
      recommendedActions: ['Adopt standard 4-node deployment profile for health tech'],
      createdAt: '2026-09-09T16:30:00.000Z',
      updatedAt: '2026-09-09T16:30:00.000Z',
    };
    await store.saveLearning(learning);

    // Verify reload
    const storeReloaded = new MySqlCustomerSuccessStore({ db });
    const loadedFeedback = await storeReloaded.listCustomerFeedback(CustomerIdSchema.parse('cust-fb-1'));
    expect(loadedFeedback).toHaveLength(1);
    expect(loadedFeedback[0].actionableQuotes).toEqual(['Zero downtime during microservice cutover.']);

    const loadedFinancial = await storeReloaded.getFinancialSummary(ProjectIdSchema.parse('proj-fb-1'));
    expect(loadedFinancial?.profitabilityStatus).toBe('highly_profitable');
    expect(loadedFinancial?.marginPercent).toBe(87.78);

    const loadedLearnings = await storeReloaded.listLearnings({ category: 'technical_pattern' });
    expect(loadedLearnings).toHaveLength(1);
    expect(loadedLearnings[0].keyInsight).toContain('Node cluster sizing');
  });

  it('integrates CustomerSuccessEngine seamlessly with MySqlCustomerSuccessStore', async () => {
    const db = createSimulatedMySqlExecutor();
    const store = new MySqlCustomerSuccessStore({ db });
    const engine = new CustomerSuccessEngine({}, store);

    const custId = CustomerIdSchema.parse('cust-e2e-1');
    await engine.createCustomer({
      id: custId,
      prospectId: 'prosp-e2e',
      companyName: 'Unified AI Labs',
    });

    await engine.recordDeliveryOutcome({
      projectId: ProjectIdSchema.parse('proj-e2e-1'),
      customerId: custId,
      status: 'successful',
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: {
        signedBy: 'VP Products',
        signedAt: '2026-09-09T16:00:00.000Z',
        clientSatisfactionScore: 5,
      },
    });

    const refreshed = await engine.getCustomer(custId);
    expect(refreshed?.status).toBe('active');
    expect(refreshed?.activeProjectIds).toContain('proj-e2e-1');

    // Instantiate new engine on fresh store instance pointing to same db
    const engineReloaded = new CustomerSuccessEngine({}, new MySqlCustomerSuccessStore({ db }));
    const calibration = await engineReloaded.getOpportunityCalibration();

    expect(calibration.completedDeliveriesCount).toBe(1);
    expect(calibration.successRatePercent).toBe(100);
    expect(calibration.activeLearningsCount).toBeGreaterThan(0);
  });
});
