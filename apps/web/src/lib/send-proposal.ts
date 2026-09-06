/**
 * One-page sendable proposal from a real opportunity. Never invents conversion
 * lift, traffic, or a price that was not already on the record.
 */

import type { EvidenceRecord, OpportunityRecord, ProblemRecord } from './control-api';
import { founderSignatureText, UMER_CAL_URL, UMER_SITE_URL } from './founder-identity';

export { UMER_CAL_URL, UMER_SITE_URL };

export type SendProposal = {
  opportunityId: string;
  businessName: string;
  subject: string;
  body: string;
  mailto: string;
  priceLine: string;
  evidenceCount: number;
  problemCount: number;
  canSend: boolean;
  blockers: string[];
};

function moneyLine(opportunity: OpportunityRecord): string {
  if (opportunity.estimatedValueMin == null && opportunity.estimatedValueMax == null) {
    return 'Fixed quote after a 15-minute call — no price is on this record yet.';
  }
  const currency = opportunity.currency ?? 'USD';
  const min = opportunity.estimatedValueMin != null ? `${currency} ${opportunity.estimatedValueMin}` : 'TBD';
  const max = opportunity.estimatedValueMax != null ? `${currency} ${opportunity.estimatedValueMax}` : 'TBD';
  return `Working range on file: ${min}–${max}. Final quote after a short call.`;
}

function timelineLine(opportunity: OpportunityRecord): string {
  if (opportunity.timeToRevenueDays == null) return "We can work out timing together on the call.";
  return `Most projects like this are up and running in about ${opportunity.timeToRevenueDays} days.`;
}

export function deriveSendProposal(input: {
  opportunity: OpportunityRecord;
  businessName?: string | null;
  website?: string | null;
  email?: string | null;
  problems?: ProblemRecord[];
  evidence?: EvidenceRecord[];
}): SendProposal {
  const businessName = input.businessName?.trim() || 'your team';
  const problems = (input.problems ?? []).map((p) => p.statement).filter(Boolean);
  const evidence = input.evidence ?? [];
  const blockers: string[] = [];
  if (!input.businessName?.trim()) blockers.push('Business name is missing — the letter uses a generic greeting.');
  if (!input.email) blockers.push('No email on file. Copy the letter and send from your own inbox.');

  const problemBlock =
    problems.length > 0
      ? problems
          .slice(0, 3)
          .map((p) => `- ${p}`)
          .join('\n')
      : `- ${input.opportunity.title}`;

  const evidenceBlock =
    evidence.length > 0
      ? evidence
          .slice(0, 4)
          .map((e) => `- ${e.title}${e.sourceUrl ? ` (${e.sourceUrl})` : ''}`)
          .join('\n')
      : '- No evidence records are attached yet. I will not claim results I have not seen.';

  const subject = `${input.opportunity.title} — a quick idea for you`;
  const body = [
    `Hi ${businessName},`,
    '',
    `My name is Umer. I help local businesses fix the everyday problems that quietly cost them customers — things like a booking process that's harder than it needs to be, or no way for people to find you online. I took a look at how people currently reach you, and wanted to share what I noticed.`,
    '',
    "Here's what stood out:",
    problemBlock,
    '',
    "What I actually checked, not a guess:",
    evidenceBlock,
    '',
    timelineLine(input.opportunity),
    '',
    "I'm not going to promise a specific number of extra bookings or visitors — I haven't earned that yet. If this sounds worth 15 minutes, let's talk it through and figure out the right fix together.",
    UMER_CAL_URL,
    '',
    founderSignatureText(),
  ].join('\n');

  const mailto = input.email
    ? `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    opportunityId: input.opportunity.id,
    businessName,
    subject,
    body,
    mailto,
    priceLine: moneyLine(input.opportunity),
    evidenceCount: evidence.length,
    problemCount: problems.length,
    canSend: Boolean(input.email),
    blockers,
  };
}
