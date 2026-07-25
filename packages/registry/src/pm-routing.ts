/**
 * PM intake desk — reads a plain-language goal and names the team that should own it.
 *
 * Deterministic on purpose: the same sentence always routes to the same desk, so the
 * suggestion can be shown before submit, unit-tested, and audited. It is a *suggestion*;
 * the operator's explicit type always wins at the control boundary.
 */

import type { IntakeInstruction } from './types.js';

export type IntakeTaskType = IntakeInstruction['type'];

export type RoutingConfidence = 'high' | 'medium' | 'low';

/** Desks that may change product code. Everything else reports findings only. */
const CODE_WRITING_TYPES = new Set<IntakeTaskType>(['feature', 'bug']);

export const TYPE_SPECIALISTS: Record<IntakeTaskType, string[]> = {
  feature: ['pm.intake', 'eng.app-delivery', 'qa.verify'],
  bug: ['pm.intake', 'eng.app-delivery', 'qa.verify'],
  seo: ['pm.intake', 'seo.audit', 'perf.optimize'],
  security: ['pm.intake', 'security.review', 'qa.verify'],
  ux: ['pm.intake', 'ux.design', 'eng.app-delivery'],
  qa: ['pm.intake', 'qa.verify'],
  perf: ['pm.intake', 'perf.optimize', 'eng.app-delivery'],
  brainstorm: ['pm.intake', 'ux.design'],
};

const TYPE_DESKS: Record<IntakeTaskType, string> = {
  feature: 'engineering (eng.app-delivery)',
  bug: 'engineering (eng.app-delivery)',
  seo: 'growth (seo.audit)',
  security: 'security (security.review)',
  ux: 'design (ux.design)',
  qa: 'quality (qa.verify)',
  perf: 'performance (perf.optimize)',
  brainstorm: 'product thinking (pm.intake)',
};

/**
 * Phrase signals per desk. A trailing `*` matches a stem (e.g. `vulnerab*`).
 * Weight 3 = decisive vocabulary, 2 = typical, 1 = weak hint.
 */
type Signal = { phrase: string; weight: number };

const SIGNALS: Record<IntakeTaskType, Signal[]> = {
  bug: [
    { phrase: 'bug', weight: 3 },
    { phrase: 'broken', weight: 3 },
    { phrase: 'not working', weight: 3 },
    { phrase: "doesn't work", weight: 3 },
    { phrase: 'does not work', weight: 3 },
    { phrase: 'crash*', weight: 3 },
    { phrase: 'regression', weight: 3 },
    { phrase: 'throws', weight: 2 },
    { phrase: 'error', weight: 2 },
    { phrase: 'exception', weight: 2 },
    { phrase: 'fails', weight: 2 },
    { phrase: 'failing', weight: 2 },
    { phrase: '500', weight: 2 },
    { phrase: '404', weight: 2 },
    { phrase: 'wrong', weight: 1 },
    { phrase: 'fix', weight: 1 },
  ],
  seo: [
    { phrase: 'seo', weight: 3 },
    { phrase: 'sitemap', weight: 3 },
    { phrase: 'robots.txt', weight: 3 },
    { phrase: 'canonical', weight: 3 },
    { phrase: 'serp', weight: 3 },
    { phrase: 'meta description', weight: 3 },
    { phrase: 'meta title', weight: 3 },
    { phrase: 'ranking*', weight: 3 },
    { phrase: 'keyword*', weight: 2 },
    { phrase: 'google search', weight: 2 },
    { phrase: 'schema markup', weight: 2 },
    { phrase: 'indexing', weight: 2 },
    { phrase: 'organic traffic', weight: 2 },
    { phrase: 'backlink*', weight: 2 },
  ],
  security: [
    { phrase: 'security', weight: 3 },
    { phrase: 'vulnerab*', weight: 3 },
    { phrase: 'sql injection', weight: 3 },
    { phrase: 'xss', weight: 3 },
    { phrase: 'csrf', weight: 3 },
    { phrase: 'idor', weight: 3 },
    { phrase: 'penetration test', weight: 3 },
    { phrase: 'auth bypass', weight: 3 },
    { phrase: 'leaked', weight: 2 },
    { phrase: 'secret*', weight: 2 },
    { phrase: 'credential*', weight: 2 },
    { phrase: 'permission*', weight: 2 },
    { phrase: 'unauthorized', weight: 2 },
    { phrase: 'cve', weight: 2 },
  ],
  perf: [
    { phrase: 'performance', weight: 3 },
    { phrase: 'lighthouse', weight: 3 },
    { phrase: 'core web vitals', weight: 3 },
    { phrase: 'lcp', weight: 3 },
    { phrase: 'cls', weight: 3 },
    { phrase: 'inp', weight: 3 },
    { phrase: 'ttfb', weight: 3 },
    { phrase: 'slow', weight: 2 },
    { phrase: 'speed', weight: 2 },
    { phrase: 'load time', weight: 2 },
    { phrase: 'bundle size', weight: 2 },
    { phrase: 'faster', weight: 2 },
    { phrase: 'optimi*', weight: 1 },
    { phrase: 'lag*', weight: 1 },
  ],
  ux: [
    { phrase: 'ui', weight: 3 },
    { phrase: 'ux', weight: 3 },
    { phrase: 'design', weight: 3 },
    { phrase: 'redesign', weight: 3 },
    { phrase: 'look and feel', weight: 3 },
    { phrase: 'usability', weight: 3 },
    { phrase: 'user experience', weight: 3 },
    { phrase: 'layout', weight: 2 },
    { phrase: 'typography', weight: 2 },
    { phrase: 'spacing', weight: 2 },
    { phrase: 'navigation', weight: 2 },
    { phrase: 'visual', weight: 2 },
    { phrase: 'theme', weight: 2 },
    { phrase: 'colour*', weight: 2 },
    { phrase: 'color*', weight: 2 },
    { phrase: 'responsive', weight: 2 },
    { phrase: 'mobile view', weight: 2 },
    { phrase: 'looks', weight: 2 },
    { phrase: 'ugly', weight: 2 },
    { phrase: 'weird', weight: 1 },
    { phrase: 'traditional', weight: 1 },
    { phrase: 'modern', weight: 1 },
    { phrase: 'accessib*', weight: 2 },
  ],
  qa: [
    { phrase: 'qa', weight: 3 },
    { phrase: 'test coverage', weight: 3 },
    { phrase: 'regression suite', weight: 3 },
    { phrase: 'e2e', weight: 3 },
    { phrase: 'playwright', weight: 3 },
    { phrase: 'phpunit', weight: 3 },
    { phrase: 'unit test*', weight: 3 },
    { phrase: 'write tests', weight: 3 },
    { phrase: 'add tests', weight: 3 },
    { phrase: 'test plan', weight: 2 },
    { phrase: 'verify', weight: 2 },
    { phrase: 'audit the tests', weight: 2 },
  ],
  feature: [
    { phrase: 'add', weight: 2 },
    { phrase: 'build', weight: 2 },
    { phrase: 'implement', weight: 2 },
    { phrase: 'create', weight: 2 },
    { phrase: 'support for', weight: 2 },
    { phrase: 'new page', weight: 2 },
    { phrase: 'new endpoint', weight: 2 },
    { phrase: 'integrat*', weight: 2 },
    { phrase: 'allow users', weight: 2 },
    { phrase: 'enable', weight: 1 },
    { phrase: 'refactor', weight: 1 },
    { phrase: 'rename', weight: 1 },
  ],
  brainstorm: [
    { phrase: 'brainstorm', weight: 3 },
    { phrase: 'ideas', weight: 3 },
    { phrase: 'should we', weight: 3 },
    { phrase: 'what if', weight: 2 },
    { phrase: 'options', weight: 2 },
    { phrase: 'strategy', weight: 2 },
    { phrase: 'explore', weight: 2 },
    { phrase: 'roadmap', weight: 2 },
    { phrase: 'think about', weight: 2 },
  ],
};

function phraseMatcher(phrase: string): RegExp {
  const stem = phrase.endsWith('*');
  const core = stem ? phrase.slice(0, -1) : phrase;
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = /^[a-z0-9]/i.test(core) ? '\\b' : '';
  const tail = !stem && /[a-z0-9]$/i.test(core) ? '\\b' : '';
  return new RegExp(`${lead}${escaped}${tail}`, 'i');
}

const MATCHERS: Array<{ type: IntakeTaskType; phrase: string; weight: number; re: RegExp }> =
  Object.entries(SIGNALS).flatMap(([type, signals]) =>
    signals.map((signal) => ({
      type: type as IntakeTaskType,
      phrase: signal.phrase.replace(/\*$/, ''),
      weight: signal.weight,
      re: phraseMatcher(signal.phrase),
    })),
  );

export type RoutingCandidate = {
  type: IntakeTaskType;
  score: number;
  /** Phrases from the goal that pointed at this desk. */
  matched: string[];
};

export type IntakeRouting = {
  /** Desk PM would pick for this text. */
  suggestedType: IntakeTaskType;
  confidence: RoutingConfidence;
  /** Plain-English handoff sentence for the operator. */
  reason: string;
  specialists: string[];
  /** True when the suggested desk can change product code. */
  writesCode: boolean;
  /** Set for report-only desks — how the findings actually get shipped. */
  followUp?: string;
  candidates: RoutingCandidate[];
  alternatives: Array<{ type: IntakeTaskType; reason: string }>;
  signals: string[];
};

function scoreGoal(text: string): RoutingCandidate[] {
  const totals = new Map<IntakeTaskType, RoutingCandidate>();
  for (const matcher of MATCHERS) {
    if (!matcher.re.test(text)) continue;
    const current = totals.get(matcher.type) ?? { type: matcher.type, score: 0, matched: [] };
    current.score += matcher.weight;
    if (!current.matched.includes(matcher.phrase)) current.matched.push(matcher.phrase);
    totals.set(matcher.type, current);
  }
  return [...totals.values()].sort(
    (a, b) => b.score - a.score || a.type.localeCompare(b.type),
  );
}

function quoted(phrases: string[]): string {
  return phrases
    .slice(0, 3)
    .map((p) => `"${p}"`)
    .join(', ');
}

function reasonFor(type: IntakeTaskType, matched: string[]): string {
  const desk = TYPE_DESKS[type];
  const because = matched.length > 0 ? `You mentioned ${quoted(matched)}, so this` : 'This';
  switch (type) {
    case 'bug':
      return `${because} reads as something already built that is misbehaving — PM hands it to ${desk} as a bug fix.`;
    case 'feature':
      return `${because} reads as new behaviour to build — PM hands it to ${desk} as a feature.`;
    case 'seo':
      return `${because} is search visibility work — PM hands it to ${desk}.`;
    case 'security':
      return `${because} is a security concern — PM hands it to ${desk}.`;
    case 'perf':
      return `${because} is about speed — PM hands it to ${desk}.`;
    case 'ux':
      return `${because} is about how the product looks and feels — PM hands it to ${desk}.`;
    case 'qa':
      return `${because} is about proving the product works — PM hands it to ${desk}.`;
    case 'brainstorm':
      return `${because} is still an open question rather than a defined change — PM keeps it at ${desk} first.`;
    default:
      return `PM hands this to ${desk}.`;
  }
}

const FOLLOW_UPS: Partial<Record<IntakeTaskType, string>> = {
  seo: 'SEO produces a findings package; code fixes ship as a follow-up feature or bug task.',
  security: 'Security is report-only; each remediation ships as its own feature or bug task.',
  perf: 'Performance is report-only; the actual optimisation ships as a feature or bug task.',
  ux: 'UX produces findings only; the visual change ships as a follow-up feature or bug task.',
  qa: 'QA proves behaviour and seals evidence; product fixes ship as a feature or bug task.',
  brainstorm: 'Once you pick a direction, raise it again as a feature task.',
};

function confidenceOf(candidates: RoutingCandidate[]): RoutingConfidence {
  const top = candidates[0];
  if (!top) return 'low';
  const runnerUp = candidates[1]?.score ?? 0;
  if (top.score >= 3 && top.score - runnerUp >= 2) return 'high';
  if (top.score >= 2 && top.score > runnerUp) return 'medium';
  return 'low';
}

/**
 * Route a plain-language goal to a desk.
 *
 * Nothing here mutates state or reaches the network — call it on keystroke if you like.
 */
export function routeIntakeGoal(input: {
  goal: string;
  doneWhen?: string;
  constraints?: string[];
}): IntakeRouting {
  const text = [input.goal, input.doneWhen ?? '', ...(input.constraints ?? [])]
    .join(' \n ')
    .toLowerCase();

  const candidates = scoreGoal(text);
  const top = candidates[0];

  // Nothing recognisable: a question stays a brainstorm, anything else is assumed new work.
  const fallbackType: IntakeTaskType = /\?|should |could |maybe/.test(text)
    ? 'brainstorm'
    : 'feature';
  const suggestedType = top?.type ?? fallbackType;
  const matched = top?.matched ?? [];
  const confidence = top ? confidenceOf(candidates) : 'low';

  const reason = top
    ? reasonFor(suggestedType, matched)
    : `Nothing in the wording points at a specific desk, so PM assumes ${TYPE_DESKS[fallbackType]}. Pick the type yourself if that is wrong.`;

  return {
    suggestedType,
    confidence,
    reason,
    specialists: TYPE_SPECIALISTS[suggestedType],
    writesCode: CODE_WRITING_TYPES.has(suggestedType),
    followUp: FOLLOW_UPS[suggestedType],
    candidates,
    alternatives: candidates.slice(1, 3).map((candidate) => ({
      type: candidate.type,
      reason: reasonFor(candidate.type, candidate.matched),
    })),
    signals: matched,
  };
}

export type IntakeRoutingDecision = IntakeRouting & {
  /** Type the operator actually submitted. */
  requestedType: IntakeTaskType;
  /** False when PM would have chosen a different desk than the operator did. */
  agreed: boolean;
  /** Shown on the work package so a mismatch is visible at review time. */
  note: string;
};

/**
 * Record PM's read of the goal next to the operator's explicit choice.
 * The requested type is never overridden — this is an audit trail, not a router.
 */
export function decideIntakeRouting(input: {
  requestedType: IntakeTaskType;
  goal: string;
  doneWhen?: string;
  constraints?: string[];
}): IntakeRoutingDecision {
  const routing = routeIntakeGoal(input);
  const agreed = routing.suggestedType === input.requestedType;
  return {
    ...routing,
    requestedType: input.requestedType,
    agreed,
    note: agreed
      ? `PM agrees this belongs to ${TYPE_DESKS[input.requestedType]}.`
      : `Submitted as ${input.requestedType} (${TYPE_DESKS[input.requestedType]}), but the wording reads like ${routing.suggestedType}. ${routing.reason}`,
  };
}
