import { describe, expect, it } from 'vitest';
import { ProjectContractSchema, SCHEMA_VERSION, parseContract, type Opportunity } from '@umer/contracts';
import { CommercialPipelineEngine } from './commercial-pipeline.js';

describe('CommercialPipelineEngine', () => {
  const mockOpportunity: Opportunity = {
    id: 'opp-101',
    type: 'service',
    title: 'Enterprise Workflow Modernization',
    geography: 'North America',
    market: 'Logistics',
    problemIds: ['prob-1'],
    score: {
      problemSeverity: 80,
      demandEvidence: 85,
      abilityToPay: 90,
      reachability: 75,
      solutionFit: 85,
      competitiveGap: 70,
      deliveryFeasibility: 80,
      evidenceConfidence: 85,
      overall: 82,
      recommendation: 'outreach_ready',
    },
    estimatedValueMin: 20000,
    estimatedValueMax: 50000,
    currency: 'USD',
    timeToRevenueDays: 45,
    evidenceRefs: ['ev-1'],
    status: 'outreach_ready',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  };

  it('runs complete commercial sales cycle from contact to delivery project creation', async () => {
    let savedOpportunity: Opportunity | undefined = { ...mockOpportunity };
    const savedProjects: unknown[] = [];

    const engine = new CommercialPipelineEngine({
      opportunities: {
        async getOpportunity(id) {
          return id === savedOpportunity?.id ? savedOpportunity : undefined;
        },
        async saveOpportunity(opp) {
          savedOpportunity = opp;
        },
      },
      projects: {
        async create(input, correlationId) {
          const project = parseContract(ProjectContractSchema, {
            id: 'proj-auto-1',
            schemaVersion: SCHEMA_VERSION,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { labels: {}, annotations: { correlationId } },
            kind: 'project',
            projectId: 'proj-auto-1',
            name: input.name,
            status: input.status ?? 'Active',
            owner: input.owner,
            sourceOpportunityId: input.sourceOpportunityId,
          });
          savedProjects.push(project);
          return project;
        },
      },
    });

    // 1. Discover and create contact with provenance
    const contact = await engine.createContact({
      prospectId: 'prosp-acme',
      name: 'Sarah Connor',
      role: 'VP Operations',
      email: 'sarah.connor@acme-logistics.com',
      phone: '+15551234567',
      isPrimary: true,
      verificationStatus: 'unverified',
      provenance: {
        sourceUrl: 'https://acme-logistics.com/leadership',
        observedAt: new Date().toISOString(),
        method: 'website_scrape',
        rawText: 'Sarah Connor, VP of Operations',
      },
    });

    expect(contact.id).toMatch(/^cont-/);
    expect(contact.verificationStatus).toBe('unverified');

    // Verify contact
    const verifiedContact = await engine.verifyContact(contact.id, 'verified');
    expect(verifiedContact.verificationStatus).toBe('verified');

    // 2. Link prospects (multi-prospect linking)
    const linkPrimary = await engine.linkProspect(
      mockOpportunity.id,
      'prosp-acme',
      'primary',
    );
    const linkCompetitor = await engine.linkProspect(
      mockOpportunity.id,
      'prosp-rival',
      'competitor',
    );
    expect(linkPrimary.role).toBe('primary');
    expect(linkCompetitor.role).toBe('competitor');

    const links = await engine.listProspectsForOpportunity(mockOpportunity.id);
    expect(links).toHaveLength(2);

    // 3. Create Deal
    const deal = await engine.createDeal({
      opportunityId: mockOpportunity.id,
      primaryProspectId: 'prosp-acme',
      title: 'Acme Workflow Modernization Deal',
      estimatedValue: 35000,
      actor: 'commercial.sales-representative',
    });
    expect(deal.stage).toBe('lead');
    expect(deal.stageHistory).toHaveLength(1);

    // 4. Outreach event moves stage from 'lead' to 'contacted'
    const outreach = await engine.recordOutreachEvent({
      dealId: deal.id,
      contactId: contact.id,
      channel: 'email',
      subject: 'Modernizing Acme Operations',
      body: 'Hi Sarah, noticed Acme could benefit from automated sync...',
      senderAgentId: 'commercial.sales-representative',
    });
    expect(outreach.id).toMatch(/^out-/);

    const dealAfterOutreach = await engine.getDeal(deal.id);
    expect(dealAfterOutreach?.stage).toBe('contacted');

    // 5. Inbound response moves stage from 'contacted' to 'engaged'
    const response = await engine.recordOutreachResponse({
      outreachEventId: outreach.id,
      dealId: deal.id,
      contactId: contact.id,
      sentiment: 'positive',
      content: 'We are very interested. What would the timeline and budget look like?',
    });
    expect(response.sentiment).toBe('positive');

    const dealAfterResponse = await engine.getDeal(deal.id);
    expect(dealAfterResponse?.stage).toBe('engaged');

    // 6. BANT qualification moves stage to 'qualified'
    const qualifiedDeal = await engine.qualifyDeal(
      deal.id,
      {
        budget: {
          confirmed: true,
          amount: 40000,
          currency: 'USD',
          notes: 'Budget confirmed by VP Operations',
        },
        authority: {
          decisionMakerIdentified: true,
          decisionMakerContactId: contact.id,
          notes: 'Sarah is sole signer',
        },
        need: {
          problemValidated: true,
          urgency: 'immediate',
          notes: 'Manual bottlenecks causing weekly delays',
        },
        timeline: {
          expectedCloseDate: '2026-10-01T00:00:00.000Z',
          implementationDeadline: '2026-11-15T00:00:00.000Z',
        },
        score: 92,
        qualified: true,
      },
      'commercial.sales-representative',
    );
    expect(qualifiedDeal.stage).toBe('qualified');
    expect(qualifiedDeal.qualification?.score).toBe(92);

    // 7. Proposal creation & CEO approval gate
    // Since totalAmount = $35,000 (> $25k threshold), it requires CEO approval!
    const proposal = await engine.createProposal({
      dealId: deal.id,
      title: 'Acme Operations Modernization Proposal',
      scope: 'End-to-end integration and telemetry',
      deliverables: ['Custom connector', 'Analytics dashboard', 'Support SLA'],
      pricingModel: 'milestone',
      totalAmount: 35000,
      currency: 'USD',
      discountPercent: 10,
      validUntil: '2026-10-31T00:00:00.000Z',
    });

    expect(proposal.requiresCeoApproval).toBe(true);
    expect(proposal.status).toBe('pending_approval');

    // Attempting to send proposal before approval should fail
    await expect(
      engine.sendProposal(proposal.id, 'commercial.sales-representative'),
    ).rejects.toThrow(/Cannot send proposal in status 'pending_approval'/);

    // Non-CEO attempting to approve should fail
    await expect(
      engine.approveProposal(proposal.id, 'commercial.sales-representative'),
    ).rejects.toThrow(/requires CEO approval/);

    // CEO approves proposal
    const approvedProposal = await engine.approveProposal(proposal.id, 'ceo');
    expect(approvedProposal.status).toBe('approved');
    expect(approvedProposal.ceoApprovalId).toBeDefined();

    // Now send proposal -> advances deal stage to 'proposal'
    const sentProposal = await engine.sendProposal(
      proposal.id,
      'commercial.sales-representative',
    );
    expect(sentProposal.status).toBe('sent');

    const dealAfterProposal = await engine.getDeal(deal.id);
    expect(dealAfterProposal?.stage).toBe('proposal');

    // 8. Close Deal Won
    const closeResult = await engine.closeDealWon(
      deal.id,
      'commercial.sales-representative',
      'Signed agreement received',
    );

    // Verify Deal is won
    expect(closeResult.deal.stage).toBe('won');

    // Verify Delivery Project was created
    expect(closeResult.project.projectId).toBe('proj-auto-1');
    expect(closeResult.project.name).toBe('Acme Workflow Modernization Deal');
    expect(closeResult.project.sourceOpportunityId).toBe(mockOpportunity.id);
    expect(savedProjects).toHaveLength(1);

    // Verify Opportunity transitioned: won -> selected_for_execution -> project_created
    expect(savedOpportunity?.status).toBe('project_created');

    // Verify Revenue Attribution
    expect(closeResult.attribution.recognizedAmount).toBe(35000);
    expect(closeResult.attribution.projectId).toBe('proj-auto-1');
    expect(closeResult.attribution.status).toBe('won');

    // 9. Revenue summary
    const summary = await engine.getRevenueSummary();
    expect(summary.totalWon).toBe(35000);
  });

  it('handles deal loss properly updating opportunity', async () => {
    let savedOpportunity: Opportunity | undefined = { ...mockOpportunity };

    const engine = new CommercialPipelineEngine({
      opportunities: {
        async getOpportunity() {
          return savedOpportunity;
        },
        async saveOpportunity(opp) {
          savedOpportunity = opp;
        },
      },
    });

    const deal = await engine.createDeal({
      opportunityId: mockOpportunity.id,
      primaryProspectId: 'prosp-1',
      title: 'Deal that fell through',
      actor: 'commercial.sales-representative',
    });

    const lostDeal = await engine.closeDealLost(
      deal.id,
      'commercial.sales-representative',
      'Budget cuts at client',
    );
    expect(lostDeal.stage).toBe('lost');
    expect(savedOpportunity?.status).toBe('lost');
  });
});
