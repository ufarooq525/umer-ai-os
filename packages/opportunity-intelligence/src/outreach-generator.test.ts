import { describe, expect, it } from 'vitest';
import type { BusinessProspect, EvidenceRecord, NicheDefinition, Opportunity, Problem } from '@umer/contracts';
import { DefaultOutreachGenerator } from './outreach-generator.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';

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
});
