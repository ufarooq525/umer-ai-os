/**
 * Presentation-layer derivations for the Commercial Intelligence milestone —
 * same discipline as company-derive.ts: pure functions over real data
 * already returned by control-api's /v1/businesses, /v1/niches/:id/prospects
 * and /v1/commercial-intelligence/summary routes. Nothing here invents a
 * contact channel, a score, or an activity entry — every value traces back
 * to a real field (Google Places-sourced phone/address, collected evidence,
 * an actual prepared outreach draft, a real run event message).
 */

import type { AttentionCase } from './company-derive';
import type {
  BusinessProspectRecord,
  CommercialIntelligenceSummary,
  DiscoveryCandidateRecord,
  OpportunityRecord,
  OpportunityRunEventRecord,
  OutreachDraftRecord,
} from './control-api';

// --- Contact Intelligence ----------------------------------------------------

export type ContactChannelType = 'website' | 'phone' | 'whatsapp' | 'email' | 'address' | 'maps';
export type ContactConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type ContactChannel = {
  type: ContactChannelType;
  value: string | null;
  source: string | null;
  confidence: ContactConfidence;
  /** Live HTTP probe can set this later for websites. Maps/phone stay observational. */
  verified: boolean;
  href?: string | null;
};

export function deriveMapsUrl(sourceRefs?: string[], address?: string | null): string | null {
  const refs = sourceRefs ?? [];
  const maps = refs.find((r) => /^https?:\/\/(www\.)?(google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl)/i.test(r));
  if (maps) return maps;
  const place = refs.find((r) => r.startsWith('google-places:'));
  const placeId = place?.slice('google-places:'.length).trim();
  if (placeId) return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  if (address?.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  return null;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function waHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : `https://wa.me/`;
}

function extractPrefixed(sourceRefs: string[] | undefined, prefix: string): string | undefined {
  const ref = sourceRefs?.find((r) => r.startsWith(prefix));
  return ref?.slice(prefix.length);
}

export function deriveContactChannels(
  business: Pick<BusinessProspectRecord, 'website' | 'sourceRefs'>,
  candidate: DiscoveryCandidateRecord | null,
): ContactChannel[] {
  // The real discovery pipeline (Google Places) writes phone/address into
  // sourceRefs as `phone:`/`address:` prefixed strings — the structured
  // DiscoveryCandidateRecord.phone/.address columns exist in the schema but
  // are never actually populated by the live write path, confirmed against
  // real seeded data. Structured field first (in case a future write path
  // populates it), sourceRefs prefix as the real-world fallback.
  const website = business.website ?? candidate?.websiteUrl ?? null;
  const phone = candidate?.phone ?? extractPrefixed(candidate?.sourceRefs, 'phone:') ?? extractPrefixed(business.sourceRefs, 'phone:') ?? null;
  const address = candidate?.address ?? extractPrefixed(candidate?.sourceRefs, 'address:') ?? extractPrefixed(business.sourceRefs, 'address:') ?? null;
  const email = extractPrefixed(candidate?.sourceRefs, 'email:') ?? extractPrefixed(business.sourceRefs, 'email:') ?? null;
  const refs = [...(candidate?.sourceRefs ?? []), ...(business.sourceRefs ?? [])];
  const mapsUrl = deriveMapsUrl(refs, address);

  return [
    {
      type: 'website',
      value: website,
      source: website ? (business.website ? 'Business profile' : 'Google Places') : 'Not on the Google listing — URLs in Maps photos are not checked',
      confidence: website ? 'high' : 'unknown',
      verified: false,
      href: website,
    },
    {
      type: 'phone',
      value: phone,
      source: phone ? 'Google Places' : null,
      confidence: phone ? 'high' : 'unknown',
      verified: false,
      href: phone ? telHref(phone) : null,
    },
    {
      type: 'whatsapp',
      value: phone,
      source: phone ? 'Inferred from phone number — not verified as WhatsApp-capable' : null,
      confidence: phone ? 'low' : 'unknown',
      verified: false,
      href: phone ? waHref(phone) : null,
    },
    {
      type: 'email',
      value: email,
      source: email ? 'Discovered reference' : null,
      confidence: email ? 'medium' : 'unknown',
      verified: false,
      href: email ? `mailto:${email}` : null,
    },
    {
      type: 'address',
      value: address,
      source: address ? 'Google Places' : null,
      confidence: address ? 'high' : 'unknown',
      verified: false,
      href: mapsUrl,
    },
    {
      type: 'maps',
      value: mapsUrl,
      source: mapsUrl ? 'Google Places listing' : null,
      confidence: mapsUrl ? 'high' : 'unknown',
      verified: false,
      href: mapsUrl,
    },
  ];
}

// --- Outreach Readiness -------------------------------------------------------

export type OutreachReadinessStatus = 'ready' | 'incomplete' | 'blocked';

export type OutreachReadiness = {
  status: OutreachReadinessStatus;
  reasons: string[];
  blockers: string[];
};

export function deriveOutreachReadiness(
  business: Pick<BusinessProspectRecord, 'name'>,
  contactChannels: ContactChannel[],
  evidenceCount: number,
  outreachDrafts: OutreachDraftRecord[],
): OutreachReadiness {
  const reasons: string[] = [];
  const blockers: string[] = [];

  const hasContact = contactChannels.some((c) => c.value);
  const hasEvidence = evidenceCount > 0;
  const hasDraft = outreachDrafts.length > 0;
  const identityConfident = business.name.trim().length > 0 && business.name !== 'Unverified Operator';

  if (!identityConfident) blockers.push('Business identity could not be confirmed — name is a placeholder.');
  if (hasContact) reasons.push('At least one contact channel discovered.');
  else blockers.push('No contact channel discovered (no phone, website, or email).');

  if (hasEvidence) reasons.push(`${evidenceCount} supporting evidence item${evidenceCount === 1 ? '' : 's'}.`);
  else blockers.push('No supporting evidence collected yet.');

  if (hasDraft) reasons.push('An outreach message has already been prepared.');
  else blockers.push('No outreach message prepared yet.');

  const status: OutreachReadinessStatus =
    blockers.length === 0 ? 'ready' : hasContact || hasEvidence ? 'incomplete' : 'blocked';

  return { status, reasons, blockers };
}

// --- Prospect Fit --------------------------------------------------------------

export type ProspectFit = {
  score: number | null;
  bestOpportunityId: string | null;
  reasons: string[];
};

export function deriveProspectFit(opportunities: OpportunityRecord[]): ProspectFit {
  const scored = opportunities.filter((o) => o.score);
  if (scored.length === 0) return { score: null, bestOpportunityId: null, reasons: [] };
  const best = scored.reduce((a, b) => (b.score!.overall > a.score!.overall ? b : a));
  const s = best.score!;
  const reasons: string[] = [];
  if (s.demandEvidence >= 70) reasons.push('Strong demand evidence.');
  if (s.abilityToPay >= 70) reasons.push('Likely able to pay for a solution.');
  if (s.solutionFit >= 70) reasons.push('Existing solution approach fits the detected gap well.');
  if (s.competitiveGap >= 60) reasons.push('Limited competitive alternatives identified.');
  if (s.evidenceConfidence < 60) reasons.push('Evidence confidence is still limited.');
  if (reasons.length === 0) reasons.push('No dimension scored strongly enough to call out individually.');
  return { score: s.overall, bestOpportunityId: best.id, reasons };
}

// --- Opportunity Run Activity --------------------------------------------------

export type OpportunityActivityEntry = {
  id: string;
  at: string;
  icon: string;
  headline: string;
  technical: Record<string, unknown>;
};

const STAGE_ICON: Record<string, string> = {
  discovery: '🔎',
  deduplication: '🧹',
  research: '📄',
  audit: '🩺',
  problems: '⚠',
  scoring: '📊',
  outreach: '✉',
  completed: '✓',
};

export function deriveOpportunityActivity(events: OpportunityRunEventRecord[]): OpportunityActivityEntry[] {
  return [...events]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .map((event) => ({
      id: event.id,
      at: event.occurredAt,
      icon: STAGE_ICON[event.stage] ?? '•',
      headline: event.message,
      technical: { stage: event.stage, agentName: event.agentName, level: event.level, runId: event.runId },
    }));
}

// --- Commercial Attention Cases (extends the V2 Attention model) -------------

const CONTACT_GAP_RATIO_THRESHOLD = 0.5;
const MIN_DISCOVERED_FOR_CONTACT_CASE = 3;

export function deriveCommercialAttentionCases(summary: CommercialIntelligenceSummary): AttentionCase[] {
  const cases: AttentionCase[] = [];

  for (const niche of summary.niches) {
    if (niche.discovered < MIN_DISCOVERED_FOR_CONTACT_CASE) continue;
    const gapRatio = niche.contactIncomplete / niche.discovered;
    if (gapRatio < CONTACT_GAP_RATIO_THRESHOLD) continue;
    cases.push({
      id: `contact-intelligence-incomplete:${niche.nicheId}`,
      category: 'contact_intelligence_incomplete',
      severity: gapRatio > 0.75 ? 'high' : 'medium',
      severityReason: `${niche.contactIncomplete} of ${niche.discovered} discovered businesses have no contact channel on file.`,
      title: `Contact intelligence incomplete — ${niche.nicheName}`,
      whatHappened: `${niche.discovered} businesses were discovered in the latest research run for "${niche.nicheName}," but ${niche.contactIncomplete} have no phone, website, or email captured.`,
      source: [{ label: niche.nicheName, type: 'niche', id: niche.nicheId, href: '/company/opportunities' }],
      evidence: [`${niche.contactComplete} of ${niche.discovered} have at least one real contact channel.`],
      currentState: [{ label: 'Run', value: niche.runId ?? 'unknown' }],
      recommendedNextAction: 'Run deeper prospect research to recover contact channels for these businesses.',
      ceoActionNeeded: false,
      occurredAt: new Date().toISOString(),
      technical: { nicheId: niche.nicheId, runId: niche.runId, discovered: niche.discovered, contactIncomplete: niche.contactIncomplete },
    });
  }

  if (summary.outreachDraftsAwaitingReview > 0) {
    cases.push({
      id: 'outreach-ready:global',
      category: 'outreach_ready',
      severity: 'medium',
      severityReason: `${summary.outreachDraftsAwaitingReview} outreach message(s) prepared and awaiting your review.`,
      title: `${summary.outreachDraftsAwaitingReview} outreach draft${summary.outreachDraftsAwaitingReview === 1 ? '' : 's'} ready for review`,
      whatHappened:
        'The research pipeline prepared outreach messages for prospects that cleared the scoring threshold. Nothing has been sent — these are drafts only.',
      source: [],
      evidence: [],
      currentState: [{ label: 'Drafts awaiting review', value: String(summary.outreachDraftsAwaitingReview) }],
      recommendedNextAction: 'Review the prepared outreach drafts on each opportunity page before any contact is made.',
      ceoActionNeeded: true,
      occurredAt: new Date().toISOString(),
      technical: { outreachDraftsAwaitingReview: summary.outreachDraftsAwaitingReview },
    });
  }

  return cases;
}
