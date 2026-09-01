import type { EvidenceRecord, Problem } from '@umer/contracts';
import { createHash } from 'node:crypto';
import type { DiscoveryCandidate, BusinessAudit, ProblemDetector } from './pipeline.js';

const SIGNALS = {
  website: ['website', 'web site', 'homepage'],
  conversion: ['contact form', 'request quote', 'cta', 'call to action', 'whatsapp', 'booking'],
  booking: ['booking', 'reservation', 'appointment', 'availability'],
  payments: ['payment', 'checkout', 'online payment', 'visa', 'mastercard'],
  automation: ['automation', 'automated', 'crm', 'workflow', 'follow-up', 'reminder'],
  integrations: ['api', 'integration', 'integrated', 'erp', 'crm'],
  trust: ['review', 'testimonial', 'rating', 'certificate', 'accreditation'],
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

    if (audit.digitalPresence.conversion < 50) {
      results.push(problem(candidate.externalId ?? candidate.name, 'The business shows weak or unclear digital conversion paths.', 65, 60, 65, evidence));
    }
    if (candidate.websiteUrl && audit.digitalPresence.booking < 50) {
      results.push(problem(candidate.externalId ?? candidate.name, 'The business website shows no clear booking or reservation workflow.', 60, 55, 60, evidence));
    }
    if (audit.digitalPresence.payments < 50) {
      results.push(problem(candidate.externalId ?? candidate.name, 'Public evidence does not show a clear online payment workflow.', 55, 50, 60, evidence));
    }
    if (audit.digitalPresence.automation < 50) {
      results.push(problem(candidate.externalId ?? candidate.name, 'Public evidence does not show meaningful customer or operational automation.', 50, 55, 55, evidence));
    }

    return results;
  }
}
