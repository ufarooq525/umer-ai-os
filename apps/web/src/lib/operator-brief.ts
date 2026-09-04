import type { ContactChannel } from './commercial-intelligence';
import type { EvidenceRecord, OpportunityRecord, OutreachDraftRecord, ProblemRecord } from './control-api';

export type OperatorStance = 'call' | 'decide' | 'wait' | 'pass';

export type OperatorBrief = {
  stance: OperatorStance;
  verdict: string;
  seen: string[];
  missing: string[];
  doNext: string;
  doNot: string[];
  researchedAt: string | null;
};

const INVENTED_LIFT = /\d+\s*[–-]\s*\d+\s*%|\d+\s*%/;

export function draftHasInventedLift(body: string): boolean {
  return INVENTED_LIFT.test(body);
}

export function deriveOperatorBrief(input: {
  opportunity: OpportunityRecord;
  businessName?: string | null;
  lastResearchedAt?: string | null;
  contactChannels: ContactChannel[];
  problems: Pick<ProblemRecord, 'statement'>[];
  evidence: Pick<EvidenceRecord, 'title' | 'type' | 'strength'>[];
  outreachDrafts?: Pick<OutreachDraftRecord, 'body'>[];
}): OperatorBrief {
  const name = input.businessName?.trim() || 'This operator';
  const website = input.contactChannels.find((c) => c.type === 'website')?.value;
  const phone = input.contactChannels.find((c) => c.type === 'phone')?.value;
  const email = input.contactChannels.find((c) => c.type === 'email')?.value;
  const maps = input.contactChannels.find((c) => c.type === 'maps')?.value;
  const address = input.contactChannels.find((c) => c.type === 'address')?.value;
  const problem = input.problems[0]?.statement;
  const rec = input.opportunity.score?.recommendation;
  const drafts = input.outreachDrafts ?? [];
  const dirtyDrafts = drafts.filter((d) => draftHasInventedLift(d.body));

  const seen: string[] = [];
  const missing: string[] = [];
  const doNot: string[] = [
    'Do not invent a booking or traffic percentage.',
    'Do not treat a URL in a Google Maps photo as an official website.',
  ];

  if (maps || address) seen.push('Google listing you can open and walk the photos yourself.');
  if (phone) seen.push(`Phone on the listing: ${phone}.`);
  if (website) seen.push(`Official website on the listing: ${website}.`);
  else missing.push('No official website on the Google listing.');
  if (email) seen.push(`Email on file: ${email}.`);
  else missing.push('No email on file — WhatsApp or a walk-in is the real door.');
  if (problem) seen.push(`Recorded gap: ${problem}`);
  if (input.evidence.length > 0) {
    seen.push(`${input.evidence.length} evidence item${input.evidence.length === 1 ? '' : 's'} on file.`);
  } else {
    missing.push('No evidence records yet — do not pitch.');
  }

  const noWebsiteEvidence = input.evidence.some(
    (e) => /without public website|no-website|missing website/i.test(`${e.title} ${e.type}`),
  );
  if (!website && noWebsiteEvidence) {
    seen.push('Research already recorded that the listing has no registered site.');
  }

  if (dirtyDrafts.length > 0) {
    doNot.push('Do not send the old auto-drafts — they invent conversion lift. Use the one-page proposal.');
  }

  const decidable = ['discovered', 'researching', 'validated', 'outreach_ready', 'in_sales'].includes(input.opportunity.status);

  let stance: OperatorStance = 'wait';
  if (rec === 'reject' || input.opportunity.status === 'rejected') stance = 'pass';
  else if (decidable) stance = 'decide';
  else if ((rec === 'outreach_ready' || input.opportunity.status === 'outreach_ready') && (phone || email)) stance = 'call';

  let verdict: string;
  if (stance === 'pass') {
    verdict = `${name} is on file but the score says walk away. Do not spend a call inventing a job.`;
  } else if (!website && phone) {
    verdict = `${name} is a real listing with a phone and no official site. That is a storefront job only if they want one — confirm on a short call, then quote.`;
  } else if (website && problem) {
    verdict = `${name} has a public site and a recorded gap. Treat it as a scoped fix, not a transformation pitch.`;
  } else {
    verdict = `${name}: use what is on the record. If a fact is missing, it is missing.`;
  }

  const doNext =
    stance === 'decide'
      ? 'Select or reject in Decisions first. After that, call from the listing number with the honest letter — not a percentage.'
      : stance === 'call'
        ? 'Call or WhatsApp the listing number. Open Maps, confirm it is the same shop, then send the one-page proposal.'
        : stance === 'pass'
          ? 'Leave it. Pick a higher-score opportunity.'
          : 'Collect the missing facts before you speak to them.';

  return {
    stance,
    verdict,
    seen,
    missing,
    doNext,
    doNot,
    researchedAt: input.lastResearchedAt ?? null,
  };
}
