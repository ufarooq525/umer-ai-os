import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { Opportunity } from '@umer/contracts';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

async function request(
  server: Server,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options?.headers,
    },
  });
  return { status: response.status, json: await response.json() };
}

describe('Commercial Sales Loop HTTP Routes', () => {
  let state: ControlApiState;
  let server: Server;

  const mockOpportunity: Opportunity = {
    id: 'opp-comm-1',
    type: 'service',
    title: 'Automated Fleet Scheduling System',
    geography: 'GCC',
    market: 'Logistics',
    problemIds: ['prob-100'],
    score: {
      problemSeverity: 85,
      demandEvidence: 90,
      abilityToPay: 85,
      reachability: 80,
      solutionFit: 85,
      competitiveGap: 75,
      deliveryFeasibility: 85,
      evidenceConfidence: 90,
      overall: 85,
      recommendation: 'outreach_ready',
    },
    estimatedValueMin: 25000,
    estimatedValueMax: 50000,
    currency: 'USD',
    timeToRevenueDays: 30,
    evidenceRefs: ['ev-comm-1'],
    status: 'outreach_ready',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  };

  beforeAll(async () => {
    state = await createControlApiState();
    // Seed test opportunity
    await state.opportunityReader?.saveOpportunity(mockOpportunity);
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('runs complete commercial sales cycle via HTTP API', async () => {
    // 1. Create Deal
    const createDealRes = await request(server, '/v1/commercial/deals', {
      method: 'POST',
      body: JSON.stringify({
        opportunityId: mockOpportunity.id,
        primaryProspectId: 'prosp-fleet-corp',
        title: 'Fleet Logistics Automation Deal',
        estimatedValue: 32000,
      }),
    });
    expect(createDealRes.status).toBe(201);
    const deal = createDealRes.json as { id: string; stage: string };
    expect(deal.id).toMatch(/^deal-/);
    expect(deal.stage).toBe('lead');

    // List deals
    const listDealsRes = await request(server, '/v1/commercial/deals');
    expect(listDealsRes.status).toBe(200);
    const listDeals = listDealsRes.json as { deals: Array<{ id: string }> };
    expect(listDeals.deals.length).toBeGreaterThanOrEqual(1);

    // Get deal by ID
    const getDealRes = await request(server, `/v1/commercial/deals/${deal.id}`);
    expect(getDealRes.status).toBe(200);
    const fetchedDeal = getDealRes.json as { id: string };
    expect(fetchedDeal.id).toBe(deal.id);

    // 2. Add Contact with Provenance
    const createContactRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/contacts`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Tariq Al-Mansoor',
          role: 'Fleet Operations Director',
          email: 'tariq@fleetcorp.example',
          phone: '+966509876543',
          isPrimary: true,
          provenance: {
            sourceUrl: 'https://fleetcorp.example/management',
            observedAt: new Date().toISOString(),
            method: 'website_scrape',
            rawText: 'Tariq Al-Mansoor, Director of Fleet Operations',
          },
        }),
      },
    );
    expect(createContactRes.status).toBe(201);
    const contact = createContactRes.json as { id: string; verificationStatus: string };
    expect(contact.id).toMatch(/^cont-/);
    expect(contact.verificationStatus).toBe('unverified');

    // List contacts for deal
    const listContactsRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/contacts`,
    );
    expect(listContactsRes.status).toBe(200);
    const listContacts = listContactsRes.json as { contacts: unknown[] };
    expect(listContacts.contacts).toHaveLength(1);

    // Verify contact
    const verifyContactRes = await request(
      server,
      `/v1/commercial/contacts/${contact.id}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ status: 'verified' }),
      },
    );
    expect(verifyContactRes.status).toBe(200);
    const verifiedContact = verifyContactRes.json as { verificationStatus: string };
    expect(verifiedContact.verificationStatus).toBe('verified');

    // 3. Dispatch Outreach Event -> transitions stage to contacted
    const outreachRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/outreach`,
      {
        method: 'POST',
        body: JSON.stringify({
          contactId: contact.id,
          channel: 'email',
          subject: 'Optimizing Fleet Dispatch and Route Telemetry',
          body: 'Hello Tariq, noticed FleetCorp is expanding fleet operations...',
          senderAgentId: 'commercial.sales-representative',
        }),
      },
    );
    expect(outreachRes.status).toBe(201);
    const outreachEvent = outreachRes.json as { id: string };
    expect(outreachEvent.id).toMatch(/^out-/);

    // Check deal stage transitioned to contacted
    const dealAfterOutreach = (await request(server, `/v1/commercial/deals/${deal.id}`)).json as { stage: string };
    expect(dealAfterOutreach.stage).toBe('contacted');

    // 4. Inbound Response -> transitions stage to engaged
    const responseRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/response`,
      {
        method: 'POST',
        body: JSON.stringify({
          outreachEventId: outreachEvent.id,
          contactId: contact.id,
          sentiment: 'positive',
          content: 'We are evaluating new dispatch software this month. Send us a proposal.',
        }),
      },
    );
    expect(responseRes.status).toBe(201);

    const dealAfterResponse = (await request(server, `/v1/commercial/deals/${deal.id}`)).json as { stage: string };
    expect(dealAfterResponse.stage).toBe('engaged');

    // 5. BANT Qualification -> transitions stage to qualified
    const qualifyRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/qualify`,
      {
        method: 'POST',
        body: JSON.stringify({
          budget: {
            confirmed: true,
            amount: 35000,
            currency: 'USD',
            notes: 'Approved budget for Q3 IT upgrade',
          },
          authority: {
            decisionMakerIdentified: true,
            decisionMakerContactId: contact.id,
            notes: 'Tariq has executive sign-off authority',
          },
          need: {
            problemValidated: true,
            urgency: 'immediate',
            notes: 'Dispatch delays impacting SLA compliance',
          },
          timeline: {
            expectedCloseDate: '2026-09-30T00:00:00.000Z',
            implementationDeadline: '2026-10-31T00:00:00.000Z',
          },
          score: 88,
          qualified: true,
        }),
      },
    );
    expect(qualifyRes.status).toBe(200);
    const qualifiedDeal = qualifyRes.json as { stage: string; qualification: { score: number } };
    expect(qualifiedDeal.stage).toBe('qualified');
    expect(qualifiedDeal.qualification.score).toBe(88);

    // 6. Create Proposal ($32,000 > $25k threshold -> requires CEO approval)
    const createProposalRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Fleet Dispatch Automation Platform Proposal',
          scope: 'Cloud dispatch engine with real-time driver mobile sync',
          deliverables: [
            'Telemetry gateway',
            'Dispatcher dashboard',
            'Driver mobile progressive app',
          ],
          pricingModel: 'milestone',
          totalAmount: 32000,
          currency: 'USD',
          discountPercent: 5,
          validUntil: '2026-10-15T00:00:00.000Z',
        }),
      },
    );
    expect(createProposalRes.status).toBe(201);
    const proposal = createProposalRes.json as { id: string; requiresCeoApproval: boolean; status: string };
    expect(proposal.requiresCeoApproval).toBe(true);
    expect(proposal.status).toBe('pending_approval');

    // Attempting to send proposal before approval must be rejected
    const sendBeforeApproveRes = await request(
      server,
      `/v1/commercial/proposals/${proposal.id}/send`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    expect(sendBeforeApproveRes.status).toBe(400);

    // Non-CEO actor cannot approve
    const nonCeoApproveRes = await request(
      server,
      `/v1/commercial/proposals/${proposal.id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ actor: 'sales.agent' }),
      },
    );
    expect(nonCeoApproveRes.status).toBe(400);

    // CEO approves proposal
    const ceoApproveRes = await request(
      server,
      `/v1/commercial/proposals/${proposal.id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ actor: 'ceo' }),
      },
    );
    expect(ceoApproveRes.status).toBe(200);
    const ceoApproved = ceoApproveRes.json as { status: string; ceoApprovalId?: string };
    expect(ceoApproved.status).toBe('approved');
    expect(ceoApproved.ceoApprovalId).toBeDefined();

    // Now send proposal -> transitions deal stage to proposal
    const sendProposalRes = await request(
      server,
      `/v1/commercial/proposals/${proposal.id}/send`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    expect(sendProposalRes.status).toBe(200);
    const sentProp = sendProposalRes.json as { status: string };
    expect(sentProp.status).toBe('sent');

    const dealAfterSend = (await request(server, `/v1/commercial/deals/${deal.id}`)).json as { stage: string };
    expect(dealAfterSend.stage).toBe('proposal');

    // 7. Win Deal -> transitions deal to won, creates delivery project, transitions opportunity, attributions revenue
    const winDealRes = await request(
      server,
      `/v1/commercial/deals/${deal.id}/win`,
      {
        method: 'POST',
        body: JSON.stringify({
          actor: 'commercial.sales-representative',
          reason: 'Client countersigned contract and paid deposit',
        }),
      },
    );
    expect(winDealRes.status).toBe(200);
    const winResult = winDealRes.json as {
      deal: { stage: string };
      project: { projectId: string; sourceOpportunityId?: string };
      attribution: { recognizedAmount: number; status: string };
    };
    expect(winResult.deal.stage).toBe('won');
    expect(winResult.project.projectId).toMatch(/^proj-/);
    expect(winResult.project.sourceOpportunityId).toBe(mockOpportunity.id);
    expect(winResult.attribution.recognizedAmount).toBe(32000);
    expect(winResult.attribution.status).toBe('won');

    // Verify delivery project exists in project store
    const deliveryProject = await state.projectStore?.get(winResult.project.projectId);
    expect(deliveryProject).toBeDefined();
    expect(deliveryProject?.sourceOpportunityId).toBe(mockOpportunity.id);

    // Verify Opportunity transitioned to project_created
    const updatedOpp = await state.opportunityReader?.getOpportunity(mockOpportunity.id);
    expect(updatedOpp?.status).toBe('project_created');

    // 8. Check Revenue reporting endpoint
    const revenueRes = await request(server, '/v1/commercial/revenue');
    expect(revenueRes.status).toBe(200);
    const revenueData = revenueRes.json as {
      summary: { totalWon: number };
      attributions: Array<{ recognizedAmount: number }>;
    };
    expect(revenueData.summary.totalWon).toBe(32000);
    expect(revenueData.attributions.length).toBeGreaterThanOrEqual(1);
  });
});
