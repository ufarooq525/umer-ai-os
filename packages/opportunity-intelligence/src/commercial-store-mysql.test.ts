import { describe, expect, it } from 'vitest';
import { MySqlCommercialStore } from './commercial-store-mysql.js';
import type { MySqlExecutor } from './persistence.js';
import type {
  Contact,
  DealContract,
  DealStageTransition,
  OpportunityProspectLink,
  OutreachEvent,
  OutreachResponse,
  ProposalContract,
  RevenueAttribution,
} from '@umer/contracts';

/**
 * Creates a lightweight in-memory SQL executor that simulates
 * the 8 tables of migration 016_commercial_pipeline for test durability verification.
 */
function createSimulatedMySqlExecutor(): MySqlExecutor & {
  tables: Record<string, Map<string, Record<string, any>>>;
} {
  const tables: Record<string, Map<string, Record<string, any>>> = {
    commercial_contacts: new Map(),
    commercial_opportunity_prospect_links: new Map(),
    commercial_deals: new Map(),
    commercial_deal_stage_history: new Map(),
    commercial_outreach_events: new Map(),
    commercial_outreach_responses: new Map(),
    commercial_proposals: new Map(),
    commercial_revenue_attributions: new Map(),
  };

  const executor: MySqlExecutor = {
    async execute<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T> {
      const normalized = sql.trim().replace(/\s+/g, ' ');

      // --- commercial_contacts ---
      if (normalized.startsWith('INSERT INTO commercial_contacts')) {
        const [
          id,
          prospect_id,
          name,
          email,
          phone,
          role,
          is_primary,
          verification_status,
          provenance_json,
          created_at,
          updated_at,
        ] = params;
        tables.commercial_contacts.set(id as string, {
          id,
          prospect_id,
          name,
          email,
          phone,
          role,
          is_primary,
          verification_status,
          provenance_json,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_contacts WHERE id = ?')) {
        const id = params[0] as string;
        const row = tables.commercial_contacts.get(id);
        return (row ? [row] : []) as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_contacts WHERE prospect_id = ?')) {
        const prospectId = params[0] as string;
        const rows = [...tables.commercial_contacts.values()].filter(
          (r) => r.prospect_id === prospectId,
        );
        return rows as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_contacts')) {
        return [...tables.commercial_contacts.values()] as T;
      }

      if (normalized.startsWith('UPDATE commercial_contacts SET verification_status = ?')) {
        const [status, provenance_json, updated_at, id] = params;
        const existing = tables.commercial_contacts.get(id as string);
        if (existing) {
          existing.verification_status = status;
          if (provenance_json) existing.provenance_json = provenance_json;
          existing.updated_at = updated_at;
        }
        return { affectedRows: existing ? 1 : 0 } as T;
      }

      // --- commercial_opportunity_prospect_links ---
      if (normalized.startsWith('INSERT INTO commercial_opportunity_prospect_links')) {
        const [id, opportunity_id, prospect_id, role, linked_at] = params;
        tables.commercial_opportunity_prospect_links.set(id as string, {
          id,
          opportunity_id,
          prospect_id,
          role,
          linked_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_opportunity_prospect_links WHERE opportunity_id = ?')) {
        const oppId = params[0] as string;
        const rows = [...tables.commercial_opportunity_prospect_links.values()].filter(
          (r) => r.opportunity_id === oppId,
        );
        return rows as T;
      }

      // --- commercial_deals ---
      if (normalized.startsWith('INSERT INTO commercial_deals')) {
        const [
          id,
          opportunity_id,
          primary_prospect_id,
          title,
          stage,
          estimated_value,
          currency,
          probability,
          qualification_json,
          project_json,
          created_at,
          updated_at,
        ] = params;
        tables.commercial_deals.set(id as string, {
          id,
          opportunity_id,
          primary_prospect_id,
          title,
          stage,
          estimated_value,
          currency,
          probability,
          qualification_json,
          project_json,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_deals WHERE id = ?')) {
        const id = params[0] as string;
        const row = tables.commercial_deals.get(id);
        return (row ? [row] : []) as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_deals WHERE 1=1')) {
        let rows = [...tables.commercial_deals.values()];
        if (normalized.includes('stage = ?')) {
          const stage = params[0];
          rows = rows.filter((r) => r.stage === stage);
        }
        if (normalized.includes('opportunity_id = ?')) {
          const oppId = params[params.length - 1];
          rows = rows.filter((r) => r.opportunity_id === oppId);
        }
        return rows as T;
      }

      if (normalized.startsWith('UPDATE commercial_deals SET stage = ?')) {
        const [stage, probability, updated_at, id] = params;
        const deal = tables.commercial_deals.get(id as string);
        if (deal) {
          deal.stage = stage;
          deal.probability = probability;
          deal.updated_at = updated_at;
        }
        return { affectedRows: deal ? 1 : 0 } as T;
      }

      // --- commercial_deal_stage_history ---
      if (normalized.startsWith('INSERT INTO commercial_deal_stage_history')) {
        const [id, deal_id, from_stage, to_stage, actor, reason, occurred_at] = params;
        tables.commercial_deal_stage_history.set(id as string, {
          id,
          deal_id,
          from_stage,
          to_stage,
          actor,
          reason,
          occurred_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_deal_stage_history WHERE deal_id = ?')) {
        const dealId = params[0] as string;
        const rows = [...tables.commercial_deal_stage_history.values()].filter(
          (r) => r.deal_id === dealId,
        );
        return rows as T;
      }

      // --- commercial_outreach_events ---
      if (normalized.startsWith('INSERT INTO commercial_outreach_events')) {
        const [id, deal_id, contact_id, channel, subject, body, sender_agent_id, sent_at] = params;
        tables.commercial_outreach_events.set(id as string, {
          id,
          deal_id,
          contact_id,
          channel,
          subject,
          body,
          sender_agent_id,
          sent_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_outreach_events WHERE deal_id = ?')) {
        const dealId = params[0] as string;
        const rows = [...tables.commercial_outreach_events.values()].filter(
          (r) => r.deal_id === dealId,
        );
        return rows as T;
      }

      // --- commercial_outreach_responses ---
      if (normalized.startsWith('INSERT INTO commercial_outreach_responses')) {
        const [id, outreach_event_id, deal_id, contact_id, sentiment, content, received_at] = params;
        tables.commercial_outreach_responses.set(id as string, {
          id,
          outreach_event_id,
          deal_id,
          contact_id,
          sentiment,
          content,
          received_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_outreach_responses WHERE deal_id = ?')) {
        const dealId = params[0] as string;
        const rows = [...tables.commercial_outreach_responses.values()].filter(
          (r) => r.deal_id === dealId,
        );
        return rows as T;
      }

      // --- commercial_proposals ---
      if (normalized.startsWith('INSERT INTO commercial_proposals')) {
        const [
          id,
          deal_id,
          opportunity_id,
          title,
          scope,
          deliverables_json,
          pricing_model,
          total_amount,
          currency,
          discount_percent,
          requires_ceo_approval,
          ceo_approval_id,
          status,
          valid_until,
          created_at,
          updated_at,
        ] = params;
        tables.commercial_proposals.set(id as string, {
          id,
          deal_id,
          opportunity_id,
          title,
          scope,
          deliverables_json,
          pricing_model,
          total_amount,
          currency,
          discount_percent,
          requires_ceo_approval,
          ceo_approval_id,
          status,
          valid_until,
          created_at,
          updated_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_proposals WHERE id = ?')) {
        const id = params[0] as string;
        const row = tables.commercial_proposals.get(id);
        return (row ? [row] : []) as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_proposals WHERE deal_id = ?')) {
        const dealId = params[0] as string;
        const rows = [...tables.commercial_proposals.values()].filter(
          (r) => r.deal_id === dealId,
        );
        return rows as T;
      }

      if (normalized.startsWith('UPDATE commercial_proposals SET status = ?')) {
        const [status, ceo_approval_id, updated_at, id] = params;
        const prop = tables.commercial_proposals.get(id as string);
        if (prop) {
          prop.status = status;
          if (ceo_approval_id) prop.ceo_approval_id = ceo_approval_id;
          prop.updated_at = updated_at;
        }
        return { affectedRows: prop ? 1 : 0 } as T;
      }

      // --- commercial_revenue_attributions ---
      if (normalized.startsWith('INSERT INTO commercial_revenue_attributions')) {
        const [
          id,
          deal_id,
          project_id,
          customer_id,
          amount,
          currency,
          recognized_at,
          metadata_json,
          created_at,
        ] = params;
        tables.commercial_revenue_attributions.set(id as string, {
          id,
          deal_id,
          project_id,
          customer_id,
          amount,
          currency,
          recognized_at,
          metadata_json,
          created_at,
        });
        return { affectedRows: 1 } as T;
      }

      if (normalized.startsWith('SELECT * FROM commercial_revenue_attributions')) {
        if (normalized.includes('WHERE deal_id = ?')) {
          const dealId = params[0] as string;
          return [...tables.commercial_revenue_attributions.values()].filter(
            (r) => r.deal_id === dealId,
          ) as T;
        }
        return [...tables.commercial_revenue_attributions.values()] as T;
      }

      throw new Error(`Unhandled SQL query in test simulator: ${sql}`);
    },
  };

  return Object.assign(executor, { tables });
}

describe('MySqlCommercialStore (Migration 016 Durable Commercial Pipeline)', () => {
  it('creates deal -> persists -> reloads and verifies identical deal exists', async () => {
    const simDb = createSimulatedMySqlExecutor();
    const store1 = new MySqlCommercialStore({ db: simDb });

    const deal: DealContract = {
      id: 'deal-test-100',
      opportunityId: 'opp-100',
      primaryProspectId: 'prosp-100',
      title: 'Enterprise AI Governance Implementation',
      stage: 'lead',
      estimatedValue: 45000,
      currency: 'USD',
      probability: 0.2,
      stageHistory: [
        {
          fromStage: null,
          toStage: 'lead',
          timestamp: '2026-09-09T10:00:00.000Z',
          actor: 'sales.lead',
          reason: 'Initial deal creation',
        },
      ],
      createdAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T10:00:00.000Z',
    };

    await store1.saveDeal(deal);

    // Simulate process restart: instantiate a brand new MySqlCommercialStore against same DB
    const store2 = new MySqlCommercialStore({ db: simDb });
    const reloaded = await store2.getDeal('deal-test-100');

    expect(reloaded).toBeDefined();
    expect(reloaded?.id).toBe('deal-test-100');
    expect(reloaded?.opportunityId).toBe('opp-100');
    expect(reloaded?.title).toBe('Enterprise AI Governance Implementation');
    expect(reloaded?.stage).toBe('lead');
    expect(reloaded?.estimatedValue).toBe(45000);
    expect(reloaded?.stageHistory).toHaveLength(1);
    expect(reloaded?.stageHistory[0]?.toStage).toBe('lead');
    expect(reloaded?.stageHistory[0]?.actor).toBe('sales.lead');
  });

  it('records stage transition -> persists stage history -> reload retains full history audit log', async () => {
    const simDb = createSimulatedMySqlExecutor();
    const store1 = new MySqlCommercialStore({ db: simDb });

    const deal: DealContract = {
      id: 'deal-test-200',
      opportunityId: 'opp-200',
      primaryProspectId: 'prosp-200',
      title: 'Workflow Automation Integration',
      stage: 'lead',
      estimatedValue: 60000,
      currency: 'USD',
      probability: 0.2,
      stageHistory: [
        {
          fromStage: null,
          toStage: 'lead',
          timestamp: '2026-09-09T10:00:00.000Z',
          actor: 'sales.lead',
          reason: 'Initial intake',
        },
      ],
      createdAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T10:00:00.000Z',
    };
    await store1.saveDeal(deal);

    // Transition 1: lead -> contacted
    const transition1: DealStageTransition = {
      fromStage: 'lead',
      toStage: 'contacted',
      timestamp: '2026-09-09T11:00:00.000Z',
      actor: 'agent.sales',
      reason: 'Outreach email dispatched',
    };
    const dealAfterT1: DealContract = {
      ...deal,
      stage: 'contacted',
      probability: 0.3,
      stageHistory: [...deal.stageHistory, transition1],
      updatedAt: '2026-09-09T11:00:00.000Z',
    };
    await store1.addDealStageTransition('deal-test-200', transition1, dealAfterT1);

    // Transition 2: contacted -> engaged
    const transition2: DealStageTransition = {
      fromStage: 'contacted',
      toStage: 'engaged',
      timestamp: '2026-09-09T12:00:00.000Z',
      actor: 'agent.sales',
      reason: 'Positive inbound response received',
    };
    const dealAfterT2: DealContract = {
      ...dealAfterT1,
      stage: 'engaged',
      probability: 0.5,
      stageHistory: [...dealAfterT1.stageHistory, transition2],
      updatedAt: '2026-09-09T12:00:00.000Z',
    };
    await store1.addDealStageTransition('deal-test-200', transition2, dealAfterT2);

    // Process restart: reload from fresh store
    const store2 = new MySqlCommercialStore({ db: simDb });
    const reloaded = await store2.getDeal('deal-test-200');

    expect(reloaded).toBeDefined();
    expect(reloaded?.stage).toBe('engaged');
    expect(reloaded?.probability).toBe(0.5);
    expect(reloaded?.stageHistory).toHaveLength(3);
    expect(reloaded?.stageHistory[0]?.toStage).toBe('lead');
    expect(reloaded?.stageHistory[1]?.toStage).toBe('contacted');
    expect(reloaded?.stageHistory[1]?.reason).toBe('Outreach email dispatched');
    expect(reloaded?.stageHistory[2]?.toStage).toBe('engaged');
    expect(reloaded?.stageHistory[2]?.reason).toBe('Positive inbound response received');
  });

  it('persists contacts, prospect links, outreach, responses, proposals, and revenue attributions across restarts', async () => {
    const simDb = createSimulatedMySqlExecutor();
    const store = new MySqlCommercialStore({ db: simDb });

    // Contact
    const contact: Contact = {
      id: 'cont-pers-1',
      prospectId: 'prosp-pers-1',
      name: 'Sarah Connor',
      email: 'sconnor@cyber.example',
      phone: '+1-555-0199',
      role: 'VP Technology',
      isPrimary: true,
      verificationStatus: 'unverified',
      provenance: {
        sourceUrl: 'https://directory.example/cyber',
        observedAt: '2026-09-09T08:00:00.000Z',
        method: 'directory',
      },
      createdAt: '2026-09-09T08:00:00.000Z',
      updatedAt: '2026-09-09T08:00:00.000Z',
    };
    await store.saveContact(contact);

    // Update contact verification with evidence
    const verified = await store.updateContactStatus('cont-pers-1', 'verified', {
      sourceUrl: 'https://company.example/verified-leadership',
      observedAt: '2026-09-09T09:00:00.000Z',
      method: 'website_scrape',
    });
    expect(verified.verificationStatus).toBe('verified');

    // Prospect link
    const link: OpportunityProspectLink = {
      id: 'link-pers-1',
      opportunityId: 'opp-pers-1',
      prospectId: 'prosp-pers-1',
      role: 'primary',
      linkedAt: '2026-09-09T08:30:00.000Z',
    };
    await store.saveProspectLink(link);

    // Outreach
    const outreach: OutreachEvent = {
      id: 'out-pers-1',
      dealId: 'deal-pers-1',
      contactId: 'cont-pers-1',
      channel: 'email',
      subject: 'Autonomous AI Delivery Proposal',
      body: 'Hello Sarah, we noticed your infrastructure challenges...',
      sentAt: '2026-09-09T10:00:00.000Z',
      senderAgentId: 'commercial.sales-representative',
    };
    await store.saveOutreachEvent(outreach);

    // Response
    const response: OutreachResponse = {
      id: 'resp-pers-1',
      outreachEventId: 'out-pers-1',
      dealId: 'deal-pers-1',
      contactId: 'cont-pers-1',
      sentiment: 'positive',
      content: 'We are very interested, please send over the full scope.',
      receivedAt: '2026-09-09T11:00:00.000Z',
    };
    await store.saveOutreachResponse(response);

    // Proposal
    const proposal: ProposalContract = {
      id: 'prop-pers-1',
      dealId: 'deal-pers-1',
      opportunityId: 'opp-pers-1',
      title: 'Infrastructure Modernization Package',
      scope: 'End to end migration with Helm and automated testing',
      deliverables: ['Architecture Spec', 'Isolated Staging Delivery', 'Production Rollout'],
      pricingModel: 'fixed',
      totalAmount: 32000,
      currency: 'USD',
      discountPercent: 10,
      requiresCeoApproval: true,
      status: 'pending_approval',
      validUntil: '2026-10-09T00:00:00.000Z',
      createdAt: '2026-09-09T12:00:00.000Z',
      updatedAt: '2026-09-09T12:00:00.000Z',
    };
    await store.saveProposal(proposal);
    await store.updateProposalStatus('prop-pers-1', 'approved', 'ceo-approval-999');

    // Revenue attribution
    const attribution: RevenueAttribution = {
      id: 'attr-pers-1',
      dealId: 'deal-pers-1',
      opportunityId: 'opp-pers-1',
      projectId: 'proj-pers-1',
      recognizedAmount: 32000,
      currency: 'USD',
      attributionDate: '2026-09-09T14:00:00.000Z',
      salesAgentId: 'commercial.sales-representative',
      status: 'won',
    };
    await store.saveRevenueAttribution(attribution);

    // Reload everything from fresh store instance
    const freshStore = new MySqlCommercialStore({ db: simDb });

    const loadedContact = await freshStore.getContact('cont-pers-1');
    expect(loadedContact?.verificationStatus).toBe('verified');
    expect(loadedContact?.provenance.sourceUrl).toBe('https://company.example/verified-leadership');

    const links = await freshStore.listProspectLinks('opp-pers-1');
    expect(links).toHaveLength(1);
    expect(links[0]?.prospectId).toBe('prosp-pers-1');

    const outreaches = await freshStore.listOutreachEvents('deal-pers-1');
    expect(outreaches).toHaveLength(1);
    expect(outreaches[0]?.channel).toBe('email');

    const responses = await freshStore.listOutreachResponses('deal-pers-1');
    expect(responses).toHaveLength(1);
    expect(responses[0]?.sentiment).toBe('positive');

    const loadedProp = await freshStore.getProposal('prop-pers-1');
    expect(loadedProp?.status).toBe('approved');
    expect(loadedProp?.ceoApprovalId).toBe('ceo-approval-999');
    expect(loadedProp?.deliverables).toHaveLength(3);

    const attributions = await freshStore.listRevenueAttributions('deal-pers-1');
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.recognizedAmount).toBe(32000);
  });
});
