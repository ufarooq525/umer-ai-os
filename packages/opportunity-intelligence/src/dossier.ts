import type { BusinessProspect, EvidenceRecord, NicheDefinition, Opportunity, Problem } from '@umer/contracts';

export type OpportunityDossier = {
  opportunity: Opportunity;
  business?: BusinessProspect;
  niche?: NicheDefinition;
  problems: Problem[];
  evidence: EvidenceRecord[];
  markdown: string;
};

export function buildOpportunityDossier(input: {
  opportunity: Opportunity;
  business?: BusinessProspect;
  niche?: NicheDefinition;
  problems: Problem[];
  evidence: EvidenceRecord[];
}): OpportunityDossier {
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const linkedEvidence = input.opportunity.evidenceRefs
    .map((ref) => evidenceById.get(ref))
    .filter((item): item is EvidenceRecord => item !== undefined);
  const linkedProblems = input.problems.filter((problem) => input.opportunity.problemIds.includes(problem.id));

  const lines = [
    `# Opportunity: ${input.opportunity.title}`,
    '',
    `- **Type:** ${input.opportunity.type}`,
    `- **Market:** ${input.opportunity.market}`,
    `- **Geography:** ${input.opportunity.geography}`,
    `- **Score:** ${input.opportunity.score.overall}/100`,
    `- **Recommendation:** ${input.opportunity.score.recommendation}`,
    `- **Status:** ${input.opportunity.status}`,
    '',
    '## Business',
    input.business ? `- ${input.business.name}${input.business.website ? ` — ${input.business.website}` : ''}` : '- Not linked to a specific business',
    '',
    '## Problems',
    ...linkedProblems.map((problem) => `- ${problem.statement} (severity ${problem.severity}, frequency ${problem.frequency}, financial impact ${problem.financialImpact})`),
    '',
    '## Evidence',
    ...linkedEvidence.map((item) => `- **${item.title}** — ${item.observation} (${item.strength})\n  - Source: ${item.sourceUrl}`),
    '',
    '## Commercial Score',
    `- Problem severity: ${input.opportunity.score.problemSeverity}`,
    `- Demand evidence: ${input.opportunity.score.demandEvidence}`,
    `- Ability to pay: ${input.opportunity.score.abilityToPay}`,
    `- Reachability: ${input.opportunity.score.reachability}`,
    `- Solution fit: ${input.opportunity.score.solutionFit}`,
    `- Competitive gap: ${input.opportunity.score.competitiveGap}`,
    `- Delivery feasibility: ${input.opportunity.score.deliveryFeasibility}`,
    `- Evidence confidence: ${input.opportunity.score.evidenceConfidence}`,
    '',
    '## Decision',
    `The current system recommendation is **${input.opportunity.score.recommendation}**. This dossier is evidence-backed and should be reviewed before any commercial action.`,
  ];

  return { ...input, evidence: linkedEvidence, problems: linkedProblems, markdown: lines.join('\n') };
}
