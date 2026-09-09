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

export interface CommercialStore {
  // Contacts
  saveContact(contact: Contact): Promise<void>;
  getContact(id: string): Promise<Contact | undefined>;
  listContacts(prospectId?: string): Promise<Contact[]>;
  updateContactStatus(
    id: string,
    status: ContactVerificationStatus,
    provenance?: ContactProvenance,
  ): Promise<Contact>;

  // Prospect links
  saveProspectLink(link: OpportunityProspectLink): Promise<void>;
  listProspectLinks(opportunityId: string): Promise<OpportunityProspectLink[]>;

  // Deals
  saveDeal(deal: DealContract): Promise<void>;
  getDeal(dealId: string): Promise<DealContract | undefined>;
  listDeals(filter?: { stage?: SalesStage; opportunityId?: string }): Promise<DealContract[]>;
  addDealStageTransition(
    dealId: string,
    transition: DealStageTransition,
    updatedDeal: DealContract,
  ): Promise<DealContract>;

  // Outreach & Responses
  saveOutreachEvent(event: OutreachEvent): Promise<void>;
  listOutreachEvents(dealId: string): Promise<OutreachEvent[]>;
  saveOutreachResponse(response: OutreachResponse): Promise<void>;
  listOutreachResponses(dealId: string): Promise<OutreachResponse[]>;

  // Proposals
  saveProposal(proposal: ProposalContract): Promise<void>;
  getProposal(proposalId: string): Promise<ProposalContract | undefined>;
  listProposals(dealId: string): Promise<ProposalContract[]>;
  updateProposalStatus(
    proposalId: string,
    status: ProposalStatus,
    ceoApprovalId?: string,
  ): Promise<ProposalContract>;

  // Revenue Attributions
  saveRevenueAttribution(attribution: RevenueAttribution): Promise<void>;
  listRevenueAttributions(dealId?: string): Promise<RevenueAttribution[]>;
}

export class InMemoryCommercialStore implements CommercialStore {
  private readonly contacts = new Map<string, Contact>();
  private readonly prospectLinks = new Map<string, OpportunityProspectLink>();
  private readonly deals = new Map<string, DealContract>();
  private readonly outreachEvents = new Map<string, OutreachEvent>();
  private readonly outreachResponses = new Map<string, OutreachResponse>();
  private readonly proposals = new Map<string, ProposalContract>();
  private readonly attributions = new Map<string, RevenueAttribution>();

  async saveContact(contact: Contact): Promise<void> {
    this.contacts.set(contact.id, structuredClone(contact));
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

  async updateContactStatus(
    id: string,
    status: ContactVerificationStatus,
    provenance?: ContactProvenance,
  ): Promise<Contact> {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);
    const updated: Contact = {
      ...contact,
      verificationStatus: status,
      provenance: provenance ?? contact.provenance,
      updatedAt: new Date().toISOString(),
    };
    this.contacts.set(id, updated);
    return structuredClone(updated);
  }

  async saveProspectLink(link: OpportunityProspectLink): Promise<void> {
    this.prospectLinks.set(link.id, structuredClone(link));
  }

  async listProspectLinks(opportunityId: string): Promise<OpportunityProspectLink[]> {
    return structuredClone(
      [...this.prospectLinks.values()].filter((l) => l.opportunityId === opportunityId),
    );
  }

  async saveDeal(deal: DealContract): Promise<void> {
    this.deals.set(deal.id, structuredClone(deal));
  }

  async getDeal(dealId: string): Promise<DealContract | undefined> {
    const deal = this.deals.get(dealId);
    return deal ? structuredClone(deal) : undefined;
  }

  async listDeals(filter?: { stage?: SalesStage; opportunityId?: string }): Promise<DealContract[]> {
    let list = [...this.deals.values()];
    if (filter?.stage) {
      list = list.filter((d) => d.stage === filter.stage);
    }
    if (filter?.opportunityId) {
      list = list.filter((d) => d.opportunityId === filter.opportunityId);
    }
    return structuredClone(list);
  }

  async addDealStageTransition(
    dealId: string,
    _transition: DealStageTransition,
    updatedDeal: DealContract,
  ): Promise<DealContract> {
    this.deals.set(dealId, structuredClone(updatedDeal));
    return structuredClone(updatedDeal);
  }

  async saveOutreachEvent(event: OutreachEvent): Promise<void> {
    this.outreachEvents.set(event.id, structuredClone(event));
  }

  async listOutreachEvents(dealId: string): Promise<OutreachEvent[]> {
    return structuredClone(
      [...this.outreachEvents.values()].filter((e) => e.dealId === dealId),
    );
  }

  async saveOutreachResponse(response: OutreachResponse): Promise<void> {
    this.outreachResponses.set(response.id, structuredClone(response));
  }

  async listOutreachResponses(dealId: string): Promise<OutreachResponse[]> {
    return structuredClone(
      [...this.outreachResponses.values()].filter((r) => r.dealId === dealId),
    );
  }

  async saveProposal(proposal: ProposalContract): Promise<void> {
    this.proposals.set(proposal.id, structuredClone(proposal));
  }

  async getProposal(proposalId: string): Promise<ProposalContract | undefined> {
    const proposal = this.proposals.get(proposalId);
    return proposal ? structuredClone(proposal) : undefined;
  }

  async listProposals(dealId: string): Promise<ProposalContract[]> {
    return structuredClone(
      [...this.proposals.values()].filter((p) => p.dealId === dealId),
    );
  }

  async updateProposalStatus(
    proposalId: string,
    status: ProposalStatus,
    ceoApprovalId?: string,
  ): Promise<ProposalContract> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const updated: ProposalContract = {
      ...proposal,
      status,
      ceoApprovalId: ceoApprovalId ?? proposal.ceoApprovalId,
      updatedAt: new Date().toISOString(),
    };
    this.proposals.set(proposalId, updated);
    return structuredClone(updated);
  }

  async saveRevenueAttribution(attribution: RevenueAttribution): Promise<void> {
    this.attributions.set(attribution.id, structuredClone(attribution));
  }

  async listRevenueAttributions(dealId?: string): Promise<RevenueAttribution[]> {
    let list = [...this.attributions.values()];
    if (dealId) {
      list = list.filter((a) => a.dealId === dealId);
    }
    return structuredClone(list);
  }
}
