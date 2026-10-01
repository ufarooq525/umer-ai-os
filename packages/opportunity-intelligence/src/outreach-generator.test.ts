import { describe, expect, it } from 'vitest';
import type { BusinessProspect, EvidenceRecord, NicheDefinition, Opportunity, Problem } from '@umer/contracts';
import { DefaultOutreachGenerator } from './outreach-generator.js';
import { SAUDI_UMRAH_NICHE, CLINICS_HOSPITALS_NICHE } from './niche-profiles.js';

describe('DefaultOutreachGenerator', () => {
  const generator = new DefaultOutreachGenerator();

  const business: BusinessProspect = {
    id: 'biz-123',
    name: 'Al-Ansar Umrah Transport & Tours',
    website: 'https://alansar-tours.example.com',
    geography: 'Makkah',
    industry: 'Travel Services',
    sourceRefs: ['google-places:ansar-1', 'phone:+966501234567', 'email:booking@alansar-tours.example.com'],
    discoveredAt: new Date().toISOString(),
  };

  const problem: Problem = {
    id: 'prob-1',
    statement: 'Direct digital booking engine is missing; all bookings require manual WhatsApp contact',
    severity: 80,
    frequency: 90,
    financialImpact: 75,
    evidenceConfidence: 95,
    evidenceRefs: ['ev-1'],
  };

  const evidence: EvidenceRecord = {
    id: 'ev-1',
    type: 'website',
    title: 'Live website commercial audit',
    sourceUrl: 'https://alansar-tours.example.com',
    observedAt: new Date().toISOString(),
    observation: 'No online checkout gateway found.',
    strength: 'verified',
    supports: ['manual workflow'],
    contradicts: [],
  };

  const opportunity: Opportunity = {
    id: 'opp-123',
    type: 'service',
    title: 'Automated Instant Umrah Booking & Direct Mada/Card Checkout',
    geography: 'Makkah',
    market: 'Saudi Umrah Services',
    nicheId: SAUDI_UMRAH_NICHE.id,
    businessId: business.id,
    problemIds: [problem.id],
    score: {
      overall: 88,
      marketDemand: 90,
      problemSeverity: 85,
      feasibility: 90,
      unitEconomics: 85,
      reachability: 90,
      strategicFit: 90,
      confidence: 90,
      recommendation: 'outreach_ready',
    },
    estimatedValueMin: 4500,
    estimatedValueMax: 12000,
    currency: 'USD',
    timeToRevenueDays: 14,
    evidenceRefs: [evidence.id],
    status: 'outreach_ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('generates personalized WhatsApp pitch and Email proposal with extracted recipient contacts', async () => {
    const drafts = await generator.generateDrafts({
      opportunity,
      business,
      problems: [problem],
      evidence: [evidence],
      niche: SAUDI_UMRAH_NICHE,
      nicheProfile: SAUDI_UMRAH_NICHE,
    });

    expect(drafts).toHaveLength(2);

    const waDraft = drafts.find((d) => d.channel === 'whatsapp');
    expect(waDraft).toBeDefined();
    expect(waDraft?.recipient).toBe('+966501234567');
    expect(waDraft?.body).toContain('Al-Ansar Umrah Transport & Tours');
    expect(waDraft?.body).toContain('حجوزات المعتمرين');
    expect(waDraft?.evidenceRefs).toContain('ev-1');

    const emailDraft = drafts.find((d) => d.channel === 'email');
    expect(emailDraft).toBeDefined();
    expect(emailDraft?.recipient).toBe('booking@alansar-tours.example.com');
    expect(emailDraft?.subject).toContain('Al-Ansar Umrah Transport & Tours');
    expect(emailDraft?.body).toContain('Automated Instant Umrah Booking');
    expect(emailDraft?.body).not.toMatch(/\d+\s*[–-]\s*\d+\s*%/);
    expect(emailDraft?.body).toContain('founder@umerfarooqtech.com');
  });

  it('generates clinic/hospital outreach with healthcare-specific template', async () => {
    const clinicBusiness: BusinessProspect = {
      id: 'biz-clinic-1',
      name: 'City Medical Center',
      geography: 'Karachi',
      industry: 'medical center',
      sourceRefs: ['google-places:clinic-1', 'email:info@citymedical.example'],
      discoveredAt: new Date().toISOString(),
    };

    const clinicProblem: Problem = {
      id: 'prob-clinic-1',
      statement: 'The business operates without a public digital storefront, causing complete loss of direct online demand.',
      severity: 85,
      frequency: 80,
      financialImpact: 85,
      evidenceConfidence: 90,
      evidenceRefs: ['ev-clinic-1'],
    };

    const clinicEvidence: EvidenceRecord = {
      id: 'ev-clinic-1',
      type: 'directory',
      title: 'Business listing without public website',
      sourceUrl: 'https://www.google.com/maps',
      observedAt: new Date().toISOString(),
      observation: 'City Medical Center has a public listing but operates without a registered website domain.',
      strength: 'verified',
      supports: ['missing website'],
      contradicts: [],
    };

    const clinicOpportunity: Opportunity = {
      id: 'opp-clinic-1',
      type: 'service',
      title: 'Professional Medical Website with Online Booking',
      geography: 'Karachi',
      market: 'Healthcare',
      nicheId: CLINICS_HOSPITALS_NICHE.id,
      businessId: clinicBusiness.id,
      problemIds: [clinicProblem.id],
      score: {
        overall: 82,
        marketDemand: 85,
        problemSeverity: 85,
        feasibility: 80,
        unitEconomics: 75,
        reachability: 85,
        strategicFit: 85,
        confidence: 85,
        recommendation: 'outreach_ready',
      },
      estimatedValueMin: 2000,
      estimatedValueMax: 5000,
      currency: 'USD',
      timeToRevenueDays: 21,
      evidenceRefs: [clinicEvidence.id],
      status: 'outreach_ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const drafts = await generator.generateDrafts({
      opportunity: clinicOpportunity,
      business: clinicBusiness,
      problems: [clinicProblem],
      evidence: [clinicEvidence],
      niche: CLINICS_HOSPITALS_NICHE,
      nicheProfile: CLINICS_HOSPITALS_NICHE,
    });

    expect(drafts).toHaveLength(1);
    const emailDraft = drafts[0];
    expect(emailDraft?.channel).toBe('email');
    expect(emailDraft?.language).toBe('en');
    expect(emailDraft?.recipient).toBe('info@citymedical.example');
    expect(emailDraft?.subject).toContain('City Medical Center');
    expect(emailDraft?.body).toContain('City Medical Center');
    expect(emailDraft?.body).toContain('operates without a public digital storefront');
    expect(emailDraft?.body).toContain('modern websites');
    expect(emailDraft?.body).not.toContain('{{');
  });
});
