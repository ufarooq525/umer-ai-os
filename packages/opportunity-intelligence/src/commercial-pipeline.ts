import { randomUUID } from 'node:crypto';
import type {
  CommercialQualificationInput,
  Contact,
  ContactVerificationStatus,
  ContactProvenance,
  DealContract,
  DealStageTransition,
  Opportunity,
  OpportunityProspectLink,
  OpportunityProspectRole,
  OutreachChannel,
  OutreachEvent,
  OutreachResponse,
  OutreachSentiment,
  ProjectContract,
  ProjectStatus,
  ProposalContract,
  ProposalPricingModel,
  RevenueAttribution,
  SalesStage,
} from '@umer/contracts';
import {
  CommercialQualificationSchema,
  ContactSchema,
  DealContractSchema,
  OpportunityProspectLinkSchema,
  OutreachEventSchema,
  OutreachResponseSchema,
  ProjectContractSchema,
  ProposalContractSchema,
  RevenueAttributionSchema,
  SCHEMA_VERSION,
  parseContract,
} from '@umer/contracts';
import {
  type CommercialStore,
  InMemoryCommercialStore,
} from './commercial-store.js';

export type CommercialProjectPort = {
  create(
    input: {
      name: string;
      status?: ProjectStatus;
      owner?: string;
      sourceOpportunityId?: string;
      registryProjectId?: string;
    },
    correlationId: string,
  ): Promise<ProjectContract>;
  get?(projectId: string): Promise<ProjectContract | undefined>;
};

export type CommercialOpportunityPort = {
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  saveOpportunity(opportunity: Opportunity): Promise<void>;
};

export type CommercialPipelineDependencies = {
  opportunities?: CommercialOpportunityPort;
  projects?: CommercialProjectPort;
  store?: CommercialStore;
};

const defaultProjectsPort: CommercialProjectPort = {
  async create(input, correlationId) {
    const projectId = `proj-${randomUUID()}`;
    const now = new Date().toISOString();
    return parseContract(ProjectContractSchema, {
      id: projectId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: { correlationId } },
      kind: 'project',
      projectId,
      name: input.name,
      status: input.status ?? 'Active',
      owner: input.owner,
      sourceOpportunityId: input.sourceOpportunityId,
      registryProjectId: input.registryProjectId,
    });
  },
};

export class CommercialPipelineEngine {
  private readonly store: CommercialStore;
  private readonly opportunitiesPort?: CommercialOpportunityPort;
  private readonly projectsPort: CommercialProjectPort;

  constructor(deps: CommercialPipelineDependencies = {}) {
    this.store = deps.store ?? new InMemoryCommercialStore();
    this.opportunitiesPort = deps.opportunities;
    this.projectsPort = deps.projects ?? defaultProjectsPort;
  }

  // --- Contacts & Provenance ---

  async createContact(
    input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contact> {
    const id = `cont-${randomUUID()}`;
    const now = new Date().toISOString();
    const contact = ContactSchema.parse({
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.saveContact(contact);
    return contact;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.store.getContact(id);
  }

  async listContacts(prospectId?: string): Promise<Contact[]> {
    return this.store.listContacts(prospectId);
  }

  async verifyContact(
    contactId: string,
    status: ContactVerificationStatus,
    provenanceEvidence?: ContactProvenance,
  ): Promise<Contact> {
    const contact = await this.store.getContact(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    if (status === 'verified') {
      const prov = provenanceEvidence ?? contact.provenance;
      if (!prov || !prov.sourceUrl || !prov.observedAt) {
        throw new Error(
          `Contact ${contactId} cannot be marked verified without valid evidence-backed provenance (sourceUrl and observedAt required)`,
        );
      }
    }
    return this.store.updateContactStatus(contactId, status, provenanceEvidence);
  }

  // --- Multi-Prospect Links ---

  async linkProspect(
    opportunityId: string,
    prospectId: string,
    role: OpportunityProspectRole = 'primary',
  ): Promise<OpportunityProspectLink> {
    const id = `link-${randomUUID()}`;
    const now = new Date().toISOString();
    const link = OpportunityProspectLinkSchema.parse({
      id,
      opportunityId,
      prospectId,
      role,
      linkedAt: now,
    });
    await this.store.saveProspectLink(link);
    return link;
  }

  async listProspectsForOpportunity(
    opportunityId: string,
  ): Promise<OpportunityProspectLink[]> {
    return this.store.listProspectLinks(opportunityId);
  }

  // --- Deals Lifecycle & Stages ---

  async createDeal(input: {
    opportunityId: string;
    primaryProspectId: string;
    title: string;
    estimatedValue?: number;
    currency?: string;
    actor: string;
  }): Promise<DealContract> {
    const id = `deal-${randomUUID()}`;
    const now = new Date().toISOString();
    const initialTransition: DealStageTransition = {
      fromStage: null,
      toStage: 'lead',
      timestamp: now,
      actor: input.actor,
      reason: 'Deal initialized from opportunity candidate',
    };
    const deal = DealContractSchema.parse({
      id,
      opportunityId: input.opportunityId,
      primaryProspectId: input.primaryProspectId,
      title: input.title,
      stage: 'lead',
      estimatedValue: input.estimatedValue,
      currency: input.currency ?? 'USD',
      probability: 0.2,
      stageHistory: [initialTransition],
      createdAt: now,
      updatedAt: now,
    });
    await this.store.saveDeal(deal);
    return deal;
  }

  async getDeal(dealId: string): Promise<DealContract | undefined> {
    return this.store.getDeal(dealId);
  }

  async listDeals(filter?: {
    stage?: SalesStage;
    opportunityId?: string;
  }): Promise<DealContract[]> {
    return this.store.listDeals(filter);
  }

  async transitionDealStage(
    dealId: string,
    toStage: SalesStage,
    actor: string,
    reason?: string,
  ): Promise<DealContract> {
    const deal = await this.store.getDeal(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }
    const fromStage = deal.stage;
    const now = new Date().toISOString();
    const transition: DealStageTransition = {
      fromStage,
      toStage,
      timestamp: now,
      actor,
      reason,
    };
    const updated: DealContract = {
      ...deal,
      stage: toStage,
      stageHistory: [...deal.stageHistory, transition],
      updatedAt: now,
    };
    return this.store.addDealStageTransition(dealId, transition, updated);
  }

  // --- Outreach & Inbound Response Analysis ---

  async recordOutreachEvent(input: {
    dealId: string;
    contactId: string;
    channel: OutreachChannel;
    subject?: string;
    body: string;
    senderAgentId?: string;
  }): Promise<OutreachEvent> {
    const deal = await this.store.getDeal(input.dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${input.dealId}`);
    }
    const id = `out-${randomUUID()}`;
    const now = new Date().toISOString();
    const event = OutreachEventSchema.parse({
      id,
      dealId: input.dealId,
      contactId: input.contactId,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      sentAt: now,
      senderAgentId: input.senderAgentId,
    });
    await this.store.saveOutreachEvent(event);

    // Progress deal to contacted if currently a lead
    if (deal.stage === 'lead') {
      await this.transitionDealStage(
        deal.id,
        'contacted',
        input.senderAgentId ?? 'commercial.sales-representative',
        `Outreach dispatched via ${input.channel}`,
      );
    }

    return event;
  }

  async listOutreachEvents(dealId?: string): Promise<OutreachEvent[]> {
    return this.store.listOutreachEvents(dealId ?? '');
  }

  async recordOutreachResponse(input: {
    outreachEventId: string;
    dealId: string;
    contactId: string;
    sentiment: OutreachSentiment;
    content: string;
  }): Promise<OutreachResponse> {
    const deal = await this.store.getDeal(input.dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${input.dealId}`);
    }
    const id = `resp-${randomUUID()}`;
    const now = new Date().toISOString();
    const response = OutreachResponseSchema.parse({
      id,
      outreachEventId: input.outreachEventId,
      dealId: input.dealId,
      contactId: input.contactId,
      sentiment: input.sentiment,
      content: input.content,
      receivedAt: now,
    });
    await this.store.saveOutreachResponse(response);

    // Advance to engaged if prospect replied favorably or neutrally
    if (
      (input.sentiment === 'positive' || input.sentiment === 'neutral') &&
      deal.stage === 'contacted'
    ) {
      await this.transitionDealStage(
        deal.id,
        'engaged',
        'commercial.sales-representative',
        `Prospect responded with ${input.sentiment} sentiment`,
      );
    }

    return response;
  }

  async listOutreachResponses(dealId?: string): Promise<OutreachResponse[]> {
    return this.store.listOutreachResponses(dealId ?? '');
  }

  // --- Commercial BANT Qualification ---

  async qualifyDeal(
    dealId: string,
    qualificationInput: Omit<CommercialQualificationInput, 'dealId' | 'evaluatedAt'>,
    actor: string,
  ): Promise<DealContract> {
    const deal = await this.store.getDeal(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }
    const evaluatedAt = new Date().toISOString();
    const qualification = CommercialQualificationSchema.parse({
      dealId,
      evaluatedAt,
      ...qualificationInput,
    });

    let updatedDeal: DealContract = {
      ...deal,
      qualification,
      updatedAt: evaluatedAt,
    };
    await this.store.saveDeal(updatedDeal);

    if (
      qualification.qualified &&
      (deal.stage === 'lead' || deal.stage === 'contacted' || deal.stage === 'engaged')
    ) {
      updatedDeal = await this.transitionDealStage(
        dealId,
        'qualified',
        actor,
        `BANT qualification criteria passed with score ${qualification.score}`,
      );
    }

    return updatedDeal;
  }

  // --- Proposal & CEO Decision Gate ---

  async createProposal(input: {
    dealId: string;
    title: string;
    scope: string;
    deliverables: string[];
    pricingModel: ProposalPricingModel;
    totalAmount: number;
    currency?: string;
    discountPercent?: number;
    validUntil: string;
  }): Promise<ProposalContract> {
    const deal = await this.store.getDeal(input.dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${input.dealId}`);
    }
    const id = `prop-${randomUUID()}`;
    const now = new Date().toISOString();
    const discount = input.discountPercent ?? 0;
    const requiresCeoApproval = input.totalAmount > 25000 || discount > 15;
    const status = requiresCeoApproval ? 'pending_approval' : 'draft';

    const proposal = ProposalContractSchema.parse({
      id,
      dealId: input.dealId,
      opportunityId: deal.opportunityId,
      title: input.title,
      scope: input.scope,
      deliverables: input.deliverables,
      pricingModel: input.pricingModel,
      totalAmount: input.totalAmount,
      currency: input.currency ?? 'USD',
      discountPercent: discount,
      requiresCeoApproval,
      status,
      validUntil: input.validUntil,
      createdAt: now,
      updatedAt: now,
    });

    await this.store.saveProposal(proposal);
    return proposal;
  }

  async getProposal(proposalId: string): Promise<ProposalContract | undefined> {
    return this.store.getProposal(proposalId);
  }

  async listProposals(dealId?: string): Promise<ProposalContract[]> {
    return this.store.listProposals(dealId ?? '');
  }

  async approveProposal(
    proposalId: string,
    actor: string,
    ceoApprovalId?: string,
  ): Promise<ProposalContract> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (proposal.requiresCeoApproval) {
      const isCeoActor =
        actor === 'ceo' ||
        actor === 'executive.ceo' ||
        actor === 'Chief Executive Officer';
      if (!isCeoActor && !ceoApprovalId) {
        throw new Error(
          `Proposal ${proposalId} requires CEO approval (deal amount $${proposal.totalAmount} or discount ${proposal.discountPercent}% exceeds thresholds). Actor '${actor}' cannot approve without CEO authorization.`,
        );
      }
    }

    const approvalId = ceoApprovalId ?? (proposal.requiresCeoApproval ? `ceo-approval-${actor}` : undefined);
    return this.store.updateProposalStatus(proposalId, 'approved', approvalId);
  }

  async sendProposal(
    proposalId: string,
    actor: string,
  ): Promise<ProposalContract> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (proposal.status !== 'draft' && proposal.status !== 'approved') {
      throw new Error(
        `Cannot send proposal in status '${proposal.status}'. Must be in draft or approved status.`,
      );
    }

    const updated = await this.store.updateProposalStatus(proposalId, 'sent');

    const deal = await this.store.getDeal(proposal.dealId);
    if (
      deal &&
      (deal.stage === 'qualified' ||
        deal.stage === 'engaged' ||
        deal.stage === 'contacted' ||
        deal.stage === 'lead')
    ) {
      await this.transitionDealStage(
        deal.id,
        'proposal',
        actor,
        `Proposal '${proposal.title}' dispatched to client`,
      );
    }

    return updated;
  }

  // --- Closing Won / Lost, Project Creation & Revenue Attribution ---

  async closeDealWon(
    dealId: string,
    actor: string,
    reason?: string,
  ): Promise<{
    deal: DealContract;
    project: ProjectContract;
    attribution: RevenueAttribution;
  }> {
    const deal = await this.store.getDeal(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Transition deal to won
    const updatedDeal = await this.transitionDealStage(
      dealId,
      'won',
      actor,
      reason ?? 'Customer accepted proposal and signed agreement',
    );

    // Find and update proposal to accepted if one exists
    const dealProposals = await this.listProposals(dealId);
    const activeProposal =
      dealProposals.find((p) => p.status === 'sent' || p.status === 'approved') ??
      dealProposals[0];

    if (activeProposal) {
      await this.store.updateProposalStatus(activeProposal.id, 'accepted');
    }

    // Update Opportunity in OpportunityIntelligence persistence if available
    if (this.opportunitiesPort) {
      const opp = await this.opportunitiesPort.getOpportunity(deal.opportunityId);
      if (opp) {
        // Step through won -> selected_for_execution -> project_created
        opp.status = 'won';
        await this.opportunitiesPort.saveOpportunity(opp);
        opp.status = 'selected_for_execution';
        await this.opportunitiesPort.saveOpportunity(opp);
        opp.status = 'project_created';
        opp.updatedAt = new Date().toISOString();
        await this.opportunitiesPort.saveOpportunity(opp);
      }
    }

    // Create execution delivery project via ProjectStore / ProjectPort
    const project = await this.projectsPort.create(
      {
        name: deal.title,
        status: 'Active',
        sourceOpportunityId: deal.opportunityId,
        owner: actor,
      },
      dealId,
    );

    // Create revenue attribution record
    const amount =
      activeProposal?.totalAmount ?? deal.estimatedValue ?? 10000;
    const now = new Date().toISOString();
    const attributionId = `attr-${randomUUID()}`;
    const attribution = RevenueAttributionSchema.parse({
      id: attributionId,
      dealId,
      opportunityId: deal.opportunityId,
      projectId: project.projectId,
      recognizedAmount: amount,
      currency: deal.currency,
      attributionDate: now,
      salesAgentId: actor,
      status: 'won',
    });

    await this.store.saveRevenueAttribution(attribution);

    return {
      deal: updatedDeal,
      project,
      attribution,
    };
  }

  async closeDealLost(
    dealId: string,
    actor: string,
    reason?: string,
  ): Promise<DealContract> {
    const deal = await this.store.getDeal(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    const updatedDeal = await this.transitionDealStage(
      dealId,
      'lost',
      actor,
      reason ?? 'Opportunity closed as lost',
    );

    if (this.opportunitiesPort) {
      const opp = await this.opportunitiesPort.getOpportunity(deal.opportunityId);
      if (opp) {
        opp.status = 'lost';
        opp.updatedAt = new Date().toISOString();
        await this.opportunitiesPort.saveOpportunity(opp);
      }
    }

    return updatedDeal;
  }

  async listRevenueAttributions(dealId?: string): Promise<RevenueAttribution[]> {
    return this.store.listRevenueAttributions(dealId);
  }

  async getRevenueSummary(): Promise<{
    totalWon: number;
    totalPipeline: number;
    currency: string;
  }> {
    const attributions = await this.store.listRevenueAttributions();
    let totalWon = 0;
    for (const attr of attributions) {
      if (attr.status === 'won' || attr.status === 'billed' || attr.status === 'collected') {
        totalWon += attr.recognizedAmount;
      }
    }

    const deals = await this.store.listDeals();
    let totalPipeline = 0;
    for (const deal of deals) {
      if (deal.stage !== 'lost' && deal.stage !== 'won') {
        totalPipeline += (deal.estimatedValue ?? 0) * (deal.probability ?? 0.2);
      }
    }

    return {
      totalWon,
      totalPipeline,
      currency: 'USD',
    };
  }
}
