import { randomUUID } from 'node:crypto';
import type {
  CommercialQualificationInput,
  Contact,
  ContactVerificationStatus,
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
  private readonly contacts = new Map<string, Contact>();
  private readonly prospectLinks = new Map<string, OpportunityProspectLink>();
  private readonly deals = new Map<string, DealContract>();
  private readonly outreachEvents = new Map<string, OutreachEvent>();
  private readonly outreachResponses = new Map<string, OutreachResponse>();
  private readonly proposals = new Map<string, ProposalContract>();
  private readonly attributions = new Map<string, RevenueAttribution>();

  private readonly opportunitiesPort?: CommercialOpportunityPort;
  private readonly projectsPort: CommercialProjectPort;

  constructor(deps: CommercialPipelineDependencies = {}) {
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
    this.contacts.set(id, structuredClone(contact));
    return structuredClone(contact);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    return contact ? structuredClone(contact) : undefined;
  }

  async listContacts(prospectId?: string): Promise<Contact[]> {
    const list = [...this.contacts.values()];
    if (prospectId) {
      return structuredClone(list.filter((c) => c.prospectId === prospectId));
    }
    return structuredClone(list);
  }

  async verifyContact(
    contactId: string,
    status: ContactVerificationStatus,
  ): Promise<Contact> {
    const contact = this.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    const updated: Contact = {
      ...contact,
      verificationStatus: status,
      updatedAt: new Date().toISOString(),
    };
    this.contacts.set(contactId, updated);
    return structuredClone(updated);
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
    this.prospectLinks.set(id, structuredClone(link));
    return structuredClone(link);
  }

  async listProspectsForOpportunity(
    opportunityId: string,
  ): Promise<OpportunityProspectLink[]> {
    return structuredClone(
      [...this.prospectLinks.values()].filter(
        (link) => link.opportunityId === opportunityId,
      ),
    );
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
    this.deals.set(id, structuredClone(deal));
    return structuredClone(deal);
  }

  async getDeal(dealId: string): Promise<DealContract | undefined> {
    const deal = this.deals.get(dealId);
    return deal ? structuredClone(deal) : undefined;
  }

  async listDeals(filter?: {
    stage?: SalesStage;
    opportunityId?: string;
  }): Promise<DealContract[]> {
    let list = [...this.deals.values()];
    if (filter?.stage) {
      list = list.filter((d) => d.stage === filter.stage);
    }
    if (filter?.opportunityId) {
      list = list.filter((d) => d.opportunityId === filter.opportunityId);
    }
    return structuredClone(list);
  }

  async transitionDealStage(
    dealId: string,
    toStage: SalesStage,
    actor: string,
    reason?: string,
  ): Promise<DealContract> {
    const deal = this.deals.get(dealId);
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
    this.deals.set(dealId, updated);
    return structuredClone(updated);
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
    const deal = this.deals.get(input.dealId);
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
    this.outreachEvents.set(id, structuredClone(event));

    // Progress deal to contacted if currently a lead
    if (deal.stage === 'lead') {
      await this.transitionDealStage(
        deal.id,
        'contacted',
        input.senderAgentId ?? 'commercial.sales-representative',
        `Outreach dispatched via ${input.channel}`,
      );
    }

    return structuredClone(event);
  }

  async listOutreachEvents(dealId?: string): Promise<OutreachEvent[]> {
    const list = [...this.outreachEvents.values()];
    if (dealId) {
      return structuredClone(list.filter((e) => e.dealId === dealId));
    }
    return structuredClone(list);
  }

  async recordOutreachResponse(input: {
    outreachEventId: string;
    dealId: string;
    contactId: string;
    sentiment: OutreachSentiment;
    content: string;
  }): Promise<OutreachResponse> {
    const deal = this.deals.get(input.dealId);
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
    this.outreachResponses.set(id, structuredClone(response));

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

    return structuredClone(response);
  }

  async listOutreachResponses(dealId?: string): Promise<OutreachResponse[]> {
    const list = [...this.outreachResponses.values()];
    if (dealId) {
      return structuredClone(list.filter((r) => r.dealId === dealId));
    }
    return structuredClone(list);
  }

  // --- Commercial BANT Qualification ---

  async qualifyDeal(
    dealId: string,
    qualificationInput: Omit<CommercialQualificationInput, 'dealId' | 'evaluatedAt'>,
    actor: string,
  ): Promise<DealContract> {
    const deal = this.deals.get(dealId);
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
    this.deals.set(dealId, updatedDeal);

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

    return structuredClone(updatedDeal);
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
    const deal = this.deals.get(input.dealId);
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

    this.proposals.set(id, structuredClone(proposal));
    return structuredClone(proposal);
  }

  async getProposal(proposalId: string): Promise<ProposalContract | undefined> {
    const proposal = this.proposals.get(proposalId);
    return proposal ? structuredClone(proposal) : undefined;
  }

  async listProposals(dealId?: string): Promise<ProposalContract[]> {
    const list = [...this.proposals.values()];
    if (dealId) {
      return structuredClone(list.filter((p) => p.dealId === dealId));
    }
    return structuredClone(list);
  }

  async approveProposal(
    proposalId: string,
    actor: string,
    ceoApprovalId?: string,
  ): Promise<ProposalContract> {
    const proposal = this.proposals.get(proposalId);
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

    const updated: ProposalContract = {
      ...proposal,
      status: 'approved',
      ceoApprovalId: ceoApprovalId ?? `ceo-approval-${randomUUID()}`,
      updatedAt: new Date().toISOString(),
    };
    this.proposals.set(proposalId, updated);
    return structuredClone(updated);
  }

  async sendProposal(
    proposalId: string,
    actor: string,
  ): Promise<ProposalContract> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (proposal.status !== 'draft' && proposal.status !== 'approved') {
      throw new Error(
        `Cannot send proposal in status '${proposal.status}'. Must be in draft or approved status.`,
      );
    }

    const now = new Date().toISOString();
    const updated: ProposalContract = {
      ...proposal,
      status: 'sent',
      updatedAt: now,
    };
    this.proposals.set(proposalId, updated);

    const deal = this.deals.get(proposal.dealId);
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

    return structuredClone(updated);
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
    const deal = this.deals.get(dealId);
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
      const updatedProp: ProposalContract = {
        ...activeProposal,
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      };
      this.proposals.set(activeProposal.id, updatedProp);
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

    this.attributions.set(attributionId, structuredClone(attribution));

    return {
      deal: updatedDeal,
      project,
      attribution: structuredClone(attribution),
    };
  }

  async closeDealLost(
    dealId: string,
    actor: string,
    reason?: string,
  ): Promise<DealContract> {
    const deal = this.deals.get(dealId);
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

  async listRevenueAttributions(): Promise<RevenueAttribution[]> {
    return structuredClone([...this.attributions.values()]);
  }

  async getRevenueSummary(): Promise<{
    totalWon: number;
    totalPipeline: number;
    currency: string;
  }> {
    let totalWon = 0;
    for (const attr of this.attributions.values()) {
      if (attr.status === 'won' || attr.status === 'billed' || attr.status === 'collected') {
        totalWon += attr.recognizedAmount;
      }
    }

    let totalPipeline = 0;
    for (const deal of this.deals.values()) {
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
