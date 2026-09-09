import { randomUUID } from 'node:crypto';
import type {
  Contact,
  ContactVerificationStatus,
  ContactProvenance,
  DealContract,
  DealStageTransition,
  OpportunityProspectLink,
  OutreachEvent,
  OutreachResponse,
  ProposalContract,
  ProposalStatus,
  RevenueAttribution,
  SalesStage,
} from '@umer/contracts';
import {
  ContactSchema,
  DealContractSchema,
  OpportunityProspectLinkSchema,
  OutreachEventSchema,
  OutreachResponseSchema,
  ProposalContractSchema,
  RevenueAttributionSchema,
} from '@umer/contracts';
import type { CommercialStore } from './commercial-store.js';
import type { MySqlExecutor } from './persistence.js';

export type MySqlCommercialStoreOptions = {
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

type ContactRow = {
  id: string;
  prospect_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: number | boolean;
  verification_status: ContactVerificationStatus;
  provenance_json: string | Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ProspectLinkRow = {
  id: string;
  opportunity_id: string;
  prospect_id: string;
  role: string;
  linked_at: string | Date;
};

type DealRow = {
  id: string;
  opportunity_id: string;
  primary_prospect_id: string;
  title: string;
  stage: SalesStage;
  estimated_value: number | string | null;
  currency: string;
  probability: number | string | null;
  qualification_json: string | Record<string, unknown> | null;
  project_json: string | Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type DealStageHistoryRow = {
  id: string;
  deal_id: string;
  from_stage: SalesStage | null;
  to_stage: SalesStage;
  actor: string;
  reason: string | null;
  occurred_at: string | Date;
};

type OutreachEventRow = {
  id: string;
  deal_id: string;
  contact_id: string;
  channel: string;
  subject: string | null;
  body: string;
  sender_agent_id: string | null;
  sent_at: string | Date;
};

type OutreachResponseRow = {
  id: string;
  outreach_event_id: string;
  deal_id: string;
  contact_id: string;
  sentiment: string;
  content: string;
  received_at: string | Date;
};

type ProposalRow = {
  id: string;
  deal_id: string;
  opportunity_id: string;
  title: string;
  scope: string;
  deliverables_json: string | string[];
  pricing_model: string;
  total_amount: number | string;
  currency: string;
  discount_percent: number | string;
  requires_ceo_approval: number | boolean;
  ceo_approval_id: string | null;
  status: ProposalStatus;
  valid_until: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type RevenueAttributionRow = {
  id: string;
  deal_id: string;
  project_id: string | null;
  customer_id: string | null;
  amount: number | string;
  currency: string;
  recognized_at: string | Date | null;
  metadata_json: string | Record<string, unknown> | null;
  created_at: string | Date;
};

export class MySqlCommercialStore implements CommercialStore {
  private readonly db: MySqlExecutor;

  constructor(options: MySqlCommercialStoreOptions) {
    this.db = options.db;
  }

  // --- Contacts ---

  async saveContact(contact: Contact): Promise<void> {
    const validated = ContactSchema.parse(contact);
    const sql = `
      INSERT INTO commercial_contacts (
        id, prospect_id, name, email, phone, role, is_primary,
        verification_status, provenance_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        phone = VALUES(phone),
        role = VALUES(role),
        is_primary = VALUES(is_primary),
        verification_status = VALUES(verification_status),
        provenance_json = VALUES(provenance_json),
        updated_at = VALUES(updated_at)
    `;
    const params = [
      validated.id,
      validated.prospectId,
      validated.name,
      validated.email ?? null,
      validated.phone ?? null,
      validated.role ?? null,
      validated.isPrimary ? 1 : 0,
      validated.verificationStatus,
      JSON.stringify(validated.provenance),
      toMySqlDateTime(validated.createdAt),
      toMySqlDateTime(validated.updatedAt),
    ];
    await this.db.execute(sql, params);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const rows = await this.db.execute<ContactRow[]>(
      'SELECT * FROM commercial_contacts WHERE id = ? LIMIT 1',
      [id],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapContactRow(rows[0]!);
  }

  async listContacts(prospectId?: string): Promise<Contact[]> {
    let sql = 'SELECT * FROM commercial_contacts';
    const params: unknown[] = [];
    if (prospectId) {
      sql += ' WHERE prospect_id = ?';
      params.push(prospectId);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await this.db.execute<ContactRow[]>(sql, params);
    return (rows || []).map((r) => this.mapContactRow(r));
  }

  async updateContactStatus(
    id: string,
    status: ContactVerificationStatus,
    provenance?: ContactProvenance,
  ): Promise<Contact> {
    const now = new Date().toISOString();
    const contact = await this.getContact(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);

    const sql = `
      UPDATE commercial_contacts
      SET verification_status = ?,
          provenance_json = COALESCE(?, provenance_json),
          updated_at = ?
      WHERE id = ?
    `;
    await this.db.execute(sql, [
      status,
      provenance ? JSON.stringify(provenance) : null,
      toMySqlDateTime(now),
      id,
    ]);

    return {
      ...contact,
      verificationStatus: status,
      provenance: provenance ?? contact.provenance,
      updatedAt: now,
    };
  }

  private mapContactRow(row: ContactRow): Contact {
    const provenance = safeJsonParse<ContactProvenance>(row.provenance_json, {
      sourceUrl: 'https://unknown.source',
      observedAt: toIsoDateTime(row.created_at),
      method: 'other',
    });
    return ContactSchema.parse({
      id: row.id,
      prospectId: row.prospect_id,
      name: row.name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      role: row.role ?? undefined,
      isPrimary: Boolean(row.is_primary),
      verificationStatus: row.verification_status,
      provenance,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // --- Prospect Links ---

  async saveProspectLink(link: OpportunityProspectLink): Promise<void> {
    const validated = OpportunityProspectLinkSchema.parse(link);
    const sql = `
      INSERT INTO commercial_opportunity_prospect_links (
        id, opportunity_id, prospect_id, role, linked_at
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        role = VALUES(role)
    `;
    await this.db.execute(sql, [
      validated.id,
      validated.opportunityId,
      validated.prospectId,
      validated.role,
      toMySqlDateTime(validated.linkedAt),
    ]);
  }

  async listProspectLinks(opportunityId: string): Promise<OpportunityProspectLink[]> {
    const rows = await this.db.execute<ProspectLinkRow[]>(
      'SELECT * FROM commercial_opportunity_prospect_links WHERE opportunity_id = ? ORDER BY linked_at ASC',
      [opportunityId],
    );
    return (rows || []).map((r) =>
      OpportunityProspectLinkSchema.parse({
        id: r.id,
        opportunityId: r.opportunity_id,
        prospectId: r.prospect_id,
        role: r.role,
        linkedAt: toIsoDateTime(r.linked_at),
      }),
    );
  }

  // --- Deals ---

  async saveDeal(deal: DealContract): Promise<void> {
    const validated = DealContractSchema.parse(deal);
    const sql = `
      INSERT INTO commercial_deals (
        id, opportunity_id, primary_prospect_id, title, stage,
        estimated_value, currency, probability, qualification_json,
        project_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        stage = VALUES(stage),
        estimated_value = VALUES(estimated_value),
        currency = VALUES(currency),
        probability = VALUES(probability),
        qualification_json = VALUES(qualification_json),
        project_json = VALUES(project_json),
        updated_at = VALUES(updated_at)
    `;
    const params = [
      validated.id,
      validated.opportunityId,
      validated.primaryProspectId,
      validated.title,
      validated.stage,
      validated.estimatedValue ?? null,
      validated.currency ?? 'USD',
      validated.probability ?? 0.2,
      validated.qualification ? JSON.stringify(validated.qualification) : null,
      null, // project_json
      toMySqlDateTime(validated.createdAt),
      toMySqlDateTime(validated.updatedAt),
    ];
    await this.db.execute(sql, params);

    // Save stage history transitions if present
    for (let idx = 0; idx < (validated.stageHistory || []).length; idx++) {
      const tr = validated.stageHistory[idx]!;
      const trId = `sh-${validated.id}-${idx}`;
      const trSql = `
        INSERT INTO commercial_deal_stage_history (
          id, deal_id, from_stage, to_stage, actor, reason, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          reason = VALUES(reason)
      `;
      await this.db.execute(trSql, [
        trId,
        validated.id,
        tr.fromStage,
        tr.toStage,
        tr.actor,
        tr.reason ?? null,
        toMySqlDateTime(tr.timestamp),
      ]);
    }
  }

  async getDeal(dealId: string): Promise<DealContract | undefined> {
    const rows = await this.db.execute<DealRow[]>(
      'SELECT * FROM commercial_deals WHERE id = ? LIMIT 1',
      [dealId],
    );
    if (!rows || rows.length === 0) return undefined;
    const history = await this.loadDealStageHistory(dealId);
    return this.mapDealRow(rows[0]!, history);
  }

  async listDeals(filter?: { stage?: SalesStage; opportunityId?: string }): Promise<DealContract[]> {
    let sql = 'SELECT * FROM commercial_deals WHERE 1=1';
    const params: unknown[] = [];
    if (filter?.stage) {
      sql += ' AND stage = ?';
      params.push(filter.stage);
    }
    if (filter?.opportunityId) {
      sql += ' AND opportunity_id = ?';
      params.push(filter.opportunityId);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await this.db.execute<DealRow[]>(sql, params);
    if (!rows || rows.length === 0) return [];

    const deals: DealContract[] = [];
    for (const r of rows) {
      const history = await this.loadDealStageHistory(r.id);
      deals.push(this.mapDealRow(r, history));
    }
    return deals;
  }

  async addDealStageTransition(
    dealId: string,
    transition: DealStageTransition,
    updatedDeal: DealContract,
  ): Promise<DealContract> {
    const trId = `sh-${dealId}-${Date.now()}-${randomUUID().slice(0, 4)}`;
    const trSql = `
      INSERT INTO commercial_deal_stage_history (
        id, deal_id, from_stage, to_stage, actor, reason, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.execute(trSql, [
      trId,
      dealId,
      transition.fromStage,
      transition.toStage,
      transition.actor,
      transition.reason ?? null,
      toMySqlDateTime(transition.timestamp),
    ]);

    const dealSql = `
      UPDATE commercial_deals
      SET stage = ?,
          probability = ?,
          updated_at = ?
      WHERE id = ?
    `;
    await this.db.execute(dealSql, [
      updatedDeal.stage,
      updatedDeal.probability ?? 0.2,
      toMySqlDateTime(updatedDeal.updatedAt),
      dealId,
    ]);

    return updatedDeal;
  }

  private async loadDealStageHistory(dealId: string): Promise<DealStageTransition[]> {
    const rows = await this.db.execute<DealStageHistoryRow[]>(
      'SELECT * FROM commercial_deal_stage_history WHERE deal_id = ? ORDER BY occurred_at ASC',
      [dealId],
    );
    return (rows || []).map((r) => ({
      fromStage: r.from_stage,
      toStage: r.to_stage,
      timestamp: toIsoDateTime(r.occurred_at),
      actor: r.actor,
      reason: r.reason ?? undefined,
    }));
  }

  private mapDealRow(row: DealRow, history: DealStageTransition[]): DealContract {
    const qualification = safeJsonParse(row.qualification_json, undefined);
    return DealContractSchema.parse({
      id: row.id,
      opportunityId: row.opportunity_id,
      primaryProspectId: row.primary_prospect_id,
      title: row.title,
      stage: row.stage,
      estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : undefined,
      currency: row.currency || 'USD',
      probability: row.probability != null ? Number(row.probability) : 0.2,
      qualification: qualification || undefined,
      stageHistory: history,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // --- Outreach & Responses ---

  async saveOutreachEvent(event: OutreachEvent): Promise<void> {
    const validated = OutreachEventSchema.parse(event);
    const sql = `
      INSERT INTO commercial_outreach_events (
        id, deal_id, contact_id, channel, subject, body, sender_agent_id, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        subject = VALUES(subject),
        body = VALUES(body)
    `;
    await this.db.execute(sql, [
      validated.id,
      validated.dealId,
      validated.contactId,
      validated.channel,
      validated.subject ?? null,
      validated.body,
      validated.senderAgentId ?? null,
      toMySqlDateTime(validated.sentAt),
    ]);
  }

  async listOutreachEvents(dealId: string): Promise<OutreachEvent[]> {
    const rows = await this.db.execute<OutreachEventRow[]>(
      'SELECT * FROM commercial_outreach_events WHERE deal_id = ? ORDER BY sent_at ASC',
      [dealId],
    );
    return (rows || []).map((r) =>
      OutreachEventSchema.parse({
        id: r.id,
        dealId: r.deal_id,
        contactId: r.contact_id,
        channel: r.channel,
        subject: r.subject ?? undefined,
        body: r.body,
        senderAgentId: r.sender_agent_id ?? undefined,
        sentAt: toIsoDateTime(r.sent_at),
      }),
    );
  }

  async saveOutreachResponse(response: OutreachResponse): Promise<void> {
    const validated = OutreachResponseSchema.parse(response);
    const sql = `
      INSERT INTO commercial_outreach_responses (
        id, outreach_event_id, deal_id, contact_id, sentiment, content, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sentiment = VALUES(sentiment),
        content = VALUES(content)
    `;
    await this.db.execute(sql, [
      validated.id,
      validated.outreachEventId,
      validated.dealId,
      validated.contactId,
      validated.sentiment,
      validated.content,
      toMySqlDateTime(validated.receivedAt),
    ]);
  }

  async listOutreachResponses(dealId: string): Promise<OutreachResponse[]> {
    const rows = await this.db.execute<OutreachResponseRow[]>(
      'SELECT * FROM commercial_outreach_responses WHERE deal_id = ? ORDER BY received_at ASC',
      [dealId],
    );
    return (rows || []).map((r) =>
      OutreachResponseSchema.parse({
        id: r.id,
        outreachEventId: r.outreach_event_id,
        dealId: r.deal_id,
        contactId: r.contact_id,
        sentiment: r.sentiment,
        content: r.content,
        receivedAt: toIsoDateTime(r.received_at),
      }),
    );
  }

  // --- Proposals ---

  async saveProposal(proposal: ProposalContract): Promise<void> {
    const validated = ProposalContractSchema.parse(proposal);
    const sql = `
      INSERT INTO commercial_proposals (
        id, deal_id, opportunity_id, title, scope, deliverables_json,
        pricing_model, total_amount, currency, discount_percent,
        requires_ceo_approval, ceo_approval_id, status, valid_until,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        scope = VALUES(scope),
        deliverables_json = VALUES(deliverables_json),
        pricing_model = VALUES(pricing_model),
        total_amount = VALUES(total_amount),
        currency = VALUES(currency),
        discount_percent = VALUES(discount_percent),
        requires_ceo_approval = VALUES(requires_ceo_approval),
        ceo_approval_id = VALUES(ceo_approval_id),
        status = VALUES(status),
        valid_until = VALUES(valid_until),
        updated_at = VALUES(updated_at)
    `;
    const params = [
      validated.id,
      validated.dealId,
      validated.opportunityId,
      validated.title,
      validated.scope,
      JSON.stringify(validated.deliverables),
      validated.pricingModel,
      validated.totalAmount,
      validated.currency ?? 'USD',
      validated.discountPercent ?? 0,
      validated.requiresCeoApproval ? 1 : 0,
      validated.ceoApprovalId ?? null,
      validated.status,
      toMySqlDateTime(validated.validUntil),
      toMySqlDateTime(validated.createdAt),
      toMySqlDateTime(validated.updatedAt),
    ];
    await this.db.execute(sql, params);
  }

  async getProposal(proposalId: string): Promise<ProposalContract | undefined> {
    const rows = await this.db.execute<ProposalRow[]>(
      'SELECT * FROM commercial_proposals WHERE id = ? LIMIT 1',
      [proposalId],
    );
    if (!rows || rows.length === 0) return undefined;
    return this.mapProposalRow(rows[0]!);
  }

  async listProposals(dealId: string): Promise<ProposalContract[]> {
    const rows = await this.db.execute<ProposalRow[]>(
      'SELECT * FROM commercial_proposals WHERE deal_id = ? ORDER BY created_at ASC',
      [dealId],
    );
    return (rows || []).map((r) => this.mapProposalRow(r));
  }

  async updateProposalStatus(
    proposalId: string,
    status: ProposalStatus,
    ceoApprovalId?: string,
  ): Promise<ProposalContract> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const now = new Date().toISOString();

    const sql = `
      UPDATE commercial_proposals
      SET status = ?,
          ceo_approval_id = COALESCE(?, ceo_approval_id),
          updated_at = ?
      WHERE id = ?
    `;
    await this.db.execute(sql, [
      status,
      ceoApprovalId ?? null,
      toMySqlDateTime(now),
      proposalId,
    ]);

    return {
      ...proposal,
      status,
      ceoApprovalId: ceoApprovalId ?? proposal.ceoApprovalId,
      updatedAt: now,
    };
  }

  private mapProposalRow(row: ProposalRow): ProposalContract {
    const deliverables = safeJsonParse<string[]>(row.deliverables_json, []);
    return ProposalContractSchema.parse({
      id: row.id,
      dealId: row.deal_id,
      opportunityId: row.opportunity_id,
      title: row.title,
      scope: row.scope,
      deliverables,
      pricingModel: row.pricing_model,
      totalAmount: Number(row.total_amount),
      currency: row.currency || 'USD',
      discountPercent: Number(row.discount_percent || 0),
      requiresCeoApproval: Boolean(row.requires_ceo_approval),
      ceoApprovalId: row.ceo_approval_id ?? undefined,
      status: row.status,
      validUntil: toIsoDateTime(row.valid_until),
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    });
  }

  // --- Revenue Attributions ---

  async saveRevenueAttribution(attribution: RevenueAttribution): Promise<void> {
    const validated = RevenueAttributionSchema.parse(attribution);
    const metadata = {
      opportunityId: validated.opportunityId,
      salesAgentId: validated.salesAgentId,
      status: validated.status,
    };
    const sql = `
      INSERT INTO commercial_revenue_attributions (
        id, deal_id, project_id, customer_id, amount,
        currency, recognized_at, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        currency = VALUES(currency),
        recognized_at = VALUES(recognized_at),
        metadata_json = VALUES(metadata_json)
    `;
    await this.db.execute(sql, [
      validated.id,
      validated.dealId,
      validated.projectId,
      null, // customer_id
      validated.recognizedAmount,
      validated.currency || 'USD',
      toMySqlDateTime(validated.attributionDate),
      JSON.stringify(metadata),
      toMySqlDateTime(validated.attributionDate),
    ]);
  }

  async listRevenueAttributions(dealId?: string): Promise<RevenueAttribution[]> {
    let sql = 'SELECT * FROM commercial_revenue_attributions';
    const params: unknown[] = [];
    if (dealId) {
      sql += ' WHERE deal_id = ?';
      params.push(dealId);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await this.db.execute<RevenueAttributionRow[]>(sql, params);
    return (rows || []).map((r) => {
      const meta = safeJsonParse<{ opportunityId?: string; salesAgentId?: string; status?: string }>(
        r.metadata_json,
        {},
      );
      return RevenueAttributionSchema.parse({
        id: r.id,
        dealId: r.deal_id,
        opportunityId: meta.opportunityId || 'opp-unknown',
        projectId: r.project_id || 'proj-unknown',
        recognizedAmount: Number(r.amount),
        currency: r.currency || 'USD',
        attributionDate: toIsoDateTime(r.recognized_at || r.created_at),
        salesAgentId: meta.salesAgentId,
        status: meta.status || 'won',
      });
    });
  }
}
