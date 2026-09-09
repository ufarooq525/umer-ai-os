import { describe, expect, it } from 'vitest';
import {
  CommercialQualificationSchema,
  ContactSchema,
  DealContractSchema,
  OpportunityProspectLinkSchema,
  OutreachEventSchema,
  OutreachResponseSchema,
  ProposalContractSchema,
  RevenueAttributionSchema,
} from './index.js';

describe('Commercial contracts', () => {
  const now = '2026-09-09T00:00:00.000Z';

  it('validates a Contact with provenance', () => {
    const contact = ContactSchema.parse({
      id: 'cont-1',
      prospectId: 'prosp-1',
      name: 'John Doe',
      role: 'Head of Operations',
      email: 'john@example.com',
      phone: '+1234567890',
      isPrimary: true,
      verificationStatus: 'verified',
      provenance: {
        sourceUrl: 'https://example.com/team',
        observedAt: now,
        method: 'website_scrape',
        rawText: 'John Doe - Head of Operations',
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(contact.id).toBe('cont-1');
    expect(contact.verificationStatus).toBe('verified');
    expect(contact.provenance.method).toBe('website_scrape');
  });

  it('validates an OpportunityProspectLink', () => {
    const link = OpportunityProspectLinkSchema.parse({
      id: 'link-1',
      opportunityId: 'opp-1',
      prospectId: 'prosp-1',
      role: 'primary',
      linkedAt: now,
    });

    expect(link.opportunityId).toBe('opp-1');
    expect(link.role).toBe('primary');
  });

  it('validates OutreachEvent and OutreachResponse', () => {
    const outreach = OutreachEventSchema.parse({
      id: 'out-1',
      dealId: 'deal-1',
      contactId: 'cont-1',
      channel: 'email',
      subject: 'Streamlining operations at Example Corp',
      body: 'Hi John, noticed you might need workflow automation...',
      sentAt: now,
      senderAgentId: 'agent-sales-1',
    });

    expect(outreach.channel).toBe('email');

    const response = OutreachResponseSchema.parse({
      id: 'resp-1',
      outreachEventId: 'out-1',
      dealId: 'deal-1',
      contactId: 'cont-1',
      sentiment: 'positive',
      content: 'Sounds interesting, can you send over a proposal?',
      receivedAt: now,
    });

    expect(response.sentiment).toBe('positive');
  });

  it('validates CommercialQualification with BANT structure', () => {
    const qual = CommercialQualificationSchema.parse({
      dealId: 'deal-1',
      evaluatedAt: now,
      budget: {
        confirmed: true,
        amount: 30000,
        currency: 'USD',
        notes: 'Annual budget allocated for operations overhaul',
      },
      authority: {
        decisionMakerIdentified: true,
        decisionMakerContactId: 'cont-1',
        notes: 'Has sole sign-off up to $50k',
      },
      need: {
        problemValidated: true,
        urgency: 'this_quarter',
        notes: 'Legacy manual pipeline failing weekly',
      },
      timeline: {
        expectedCloseDate: '2026-09-30T00:00:00.000Z',
        implementationDeadline: '2026-11-01T00:00:00.000Z',
      },
      score: 85,
      qualified: true,
    });

    expect(qual.qualified).toBe(true);
    expect(qual.score).toBe(85);
  });

  it('validates DealContract with stage history', () => {
    const deal = DealContractSchema.parse({
      id: 'deal-1',
      opportunityId: 'opp-1',
      primaryProspectId: 'prosp-1',
      title: 'Workflow Automation Overhaul',
      stage: 'qualified',
      estimatedValue: 30000,
      currency: 'USD',
      probability: 0.6,
      stageHistory: [
        {
          fromStage: null,
          toStage: 'lead',
          timestamp: now,
          actor: 'commercial.sales-representative',
          reason: 'Initial discovery ingestion',
        },
        {
          fromStage: 'lead',
          toStage: 'contacted',
          timestamp: now,
          actor: 'commercial.sales-representative',
          reason: 'Initial outreach sent',
        },
        {
          fromStage: 'contacted',
          toStage: 'qualified',
          timestamp: now,
          actor: 'commercial.sales-representative',
          reason: 'BANT evaluation passed with score 85',
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(deal.stage).toBe('qualified');
    expect(deal.stageHistory).toHaveLength(3);
  });

  it('validates ProposalContract with CEO approval requirements', () => {
    const proposal = ProposalContractSchema.parse({
      id: 'prop-1',
      dealId: 'deal-1',
      opportunityId: 'opp-1',
      title: 'Complete Workflow Automation Solution',
      scope: 'End-to-end orchestration and reporting dashboard',
      deliverables: ['Custom connector', 'Reporting dashboard', 'Admin portal'],
      pricingModel: 'milestone',
      totalAmount: 35000,
      currency: 'USD',
      discountPercent: 10,
      requiresCeoApproval: true,
      status: 'pending_approval',
      validUntil: '2026-10-31T00:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    });

    expect(proposal.requiresCeoApproval).toBe(true);
    expect(proposal.status).toBe('pending_approval');
  });

  it('validates RevenueAttribution', () => {
    const attr = RevenueAttributionSchema.parse({
      id: 'attr-1',
      dealId: 'deal-1',
      opportunityId: 'opp-1',
      projectId: 'proj-1',
      recognizedAmount: 35000,
      currency: 'USD',
      attributionDate: now,
      salesAgentId: 'agent-sales-1',
      status: 'won',
    });

    expect(attr.recognizedAmount).toBe(35000);
    expect(attr.status).toBe('won');
  });
});
