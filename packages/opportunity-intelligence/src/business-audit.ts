import type { EvidenceRecord, Problem } from '@umer/contracts';
import { createHash } from 'node:crypto';
import type { DiscoveryCandidate, BusinessAudit, ProblemDetector } from './pipeline.js';

const SIGNALS = {
  website: ['website', 'web site', 'homepage', 'portal'],
  conversion: ['contact form', 'request quote', 'cta', 'call to action', 'whatsapp', 'booking', 'inquire', 'get quote'],
  booking: ['booking', 'reservation', 'appointment', 'availability', 'schedule', 'book now', 'reserve'],
  payments: ['payment', 'checkout', 'online payment', 'visa', 'mastercard', 'mada', 'apple pay', 'hyperpay', 'stripe', 'paytabs'],
  automation: ['automation', 'automated', 'crm', 'workflow', 'follow-up', 'reminder', 'portal', 'dashboard', 'self-service'],
  integrations: ['api', 'integration', 'integrated', 'erp', 'crm', 'webhook'],
  trust: ['review', 'testimonial', 'rating', 'certificate', 'accreditation', 'license', 'ministry', 'hajj'],
  multilingual: ['bilingual', 'arabic and english', 'multilingual', 'english'],
} as const;

function text(evidence: EvidenceRecord[]): string {
  return evidence.map((item) => `${item.title} ${item.observation} ${item.excerpt ?? ''}`).join(' ').toLowerCase();
}

function scoreDimension(content: string, terms: readonly string[]): number {
  const hits = terms.reduce((count, term) => count + (content.includes(term) ? 1 : 0), 0);
  return Math.min(100, hits * 25);
}

export function auditBusiness(candidate: DiscoveryCandidate, evidence: EvidenceRecord[]): BusinessAudit {
  const content = text(evidence);
  const digitalPresence = {
    website: candidate.websiteUrl ? 100 : 0,
    conversion: scoreDimension(content, SIGNALS.conversion),
    booking: scoreDimension(content, SIGNALS.booking),
    payments: scoreDimension(content, SIGNALS.payments),
    automation: scoreDimension(content, SIGNALS.automation),
    integrations: scoreDimension(content, SIGNALS.integrations),
    trust: scoreDimension(content, SIGNALS.trust),
  };

  const operationalSignals = evidence
    .filter((item) => item.strength === 'strong' || item.strength === 'verified')
    .map((item) => item.observation)
    .slice(0, 20);

  return { businessId: candidate.externalId ?? candidate.name, digitalPresence, operationalSignals, evidenceRefs: evidence.map((item) => item.id) };
}

function problemId(businessId: string, statement: string): string {
  return createHash('sha256').update(`${businessId}|${statement}`).digest('hex');
}

function problem(
  businessId: string,
  statement: string,
  severity: number,
  frequency: number,
  financialImpact: number,
  evidence: EvidenceRecord[],
): Problem {
  const confidence = evidence.some((item) => item.strength === 'verified')
    ? 90
    : evidence.some((item) => item.strength === 'strong')
      ? 75
      : evidence.some((item) => item.strength === 'moderate')
        ? 55
        : 30;
  return {
    id: problemId(businessId, statement),
    statement,
    severity,
    frequency,
    financialImpact,
    evidenceConfidence: confidence,
    evidenceRefs: evidence.map((item) => item.id),
  };
}

export class EvidenceBasedProblemDetector implements ProblemDetector {
  async detect(candidate: DiscoveryCandidate, evidence: EvidenceRecord[]): Promise<Problem[]> {
    if (evidence.length === 0) return [];
    const audit = auditBusiness(candidate, evidence);
    const results: Problem[] = [];
    const targetId = candidate.externalId ?? candidate.name;

    // 1. Missing website / broken digital storefront
    if (!candidate.websiteUrl) {
      results.push(problem(targetId, 'The business operates without a public digital storefront, causing complete loss of direct online demand.', 85, 80, 85, evidence));
      return results;
    }

    // 2. Conversion path weakness
    if (audit.digitalPresence.conversion < 50) {
      results.push(problem(targetId, 'The digital presence lacks automated lead capture and clear conversion paths, causing prospective customer drop-off.', 65, 60, 65, evidence));
    }

    // 3. Missing online booking engine
    if (audit.digitalPresence.booking < 50) {
      results.push(problem(targetId, 'The business website has no self-service booking engine, forcing all reservations through manual inquiries.', 70, 75, 75, evidence));
    }

    // 4. Missing digital payment checkout
    if (audit.digitalPresence.payments < 50) {
      results.push(problem(targetId, 'Public evidence does not show online checkout (Mada/Visa/Apple Pay); payments require manual transfers or physical collection.', 65, 70, 70, evidence));
    }

    // 5. Missing customer & CRM workflow automation
    if (audit.digitalPresence.automation < 50) {
      results.push(problem(targetId, 'Customer inquiries and booking follow-ups lack automated CRM workflows, leading to operational delays and lost revenue.', 55, 60, 60, evidence));
    }

    return results;
  }
}
