import type { ResolvedProject } from './types.js';

export type UxPriority = 'P0' | 'P1' | 'P2';

export type UxCategory =
  | 'navigation'
  | 'hierarchy'
  | 'content'
  | 'interaction'
  | 'accessibility'
  | 'responsive'
  | 'empty-error-states'
  | 'brand-consistency';

export type UxAuditItem = {
  id: string;
  category: UxCategory;
  title: string;
  priority: UxPriority;
  check: string;
  howToVerify: string;
};

export type UxAuditReport = {
  specialistId: 'ux.design';
  runId: string;
  projectId: string;
  projectName: string;
  absolutePath: string;
  goal: string;
  summary: string;
  items: UxAuditItem[];
  quickWins: string[];
  nextActions: string[];
  /** Always empty in v1 — UX findings are report-only (no product UI mutation). */
  proposedDiff: '';
};

export function uxRunId(projectId: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `ux-${projectId}-${stamp}`;
}

function item(
  id: string,
  category: UxCategory,
  title: string,
  priority: UxPriority,
  check: string,
  howToVerify: string,
): UxAuditItem {
  return { id, category, title, priority, check, howToVerify };
}

function baseChecklist(project: ResolvedProject): UxAuditItem[] {
  return [
    item(
      'nav-primary',
      'navigation',
      'Primary navigation discoverable',
      'P0',
      'Main destinations are reachable from a stable primary nav without dead ends or orphan pages',
      `Walk top-level routes under ${project.absolutePath}; confirm labels match destinations`,
    ),
    item(
      'nav-current',
      'navigation',
      'Current location indicated',
      'P1',
      'Active section/page is visually indicated so users know where they are',
      'Navigate 3+ sections; confirm active/current styles on each',
    ),
    item(
      'hier-page-title',
      'hierarchy',
      'Clear page-level hierarchy',
      'P0',
      'Each primary screen has one dominant heading and supporting content does not compete for attention',
      'Scan H1/title vs body; note competing hero-sized blocks',
    ),
    item(
      'hier-scan',
      'hierarchy',
      'Scannable sections',
      'P1',
      'Long pages break into labeled sections with consistent spacing rhythm',
      'Scroll primary landing page; list section titles and spacing inconsistencies',
    ),
    item(
      'content-clarity',
      'content',
      'Primary message clarity',
      'P0',
      'Within one viewport the user understands what the product/site is and what to do next',
      'Ask a cold reader: what is this and what is the next action?',
    ),
    item(
      'content-cta',
      'content',
      'Primary CTA prominence',
      'P0',
      'The main call-to-action is visually primary and not buried among peer buttons',
      'Count competing CTAs above the fold; ensure one is clearly primary',
    ),
    item(
      'ix-affordance',
      'interaction',
      'Interactive affordances',
      'P1',
      'Links/buttons look clickable; non-interactive text does not look like controls',
      'Hover/focus primary controls; note misleading underline/button styles',
    ),
    item(
      'ix-feedback',
      'interaction',
      'Action feedback',
      'P1',
      'Form submit, filters, and nav transitions give immediate loading or success/error feedback',
      'Submit a form or toggle a control; confirm pending + result states',
    ),
    item(
      'a11y-keyboard',
      'accessibility',
      'Keyboard reachability',
      'P0',
      'Primary interactive controls are reachable and operable via keyboard with visible focus',
      'Tab through primary journey; confirm focus ring and activation with Enter/Space',
    ),
    item(
      'a11y-names',
      'accessibility',
      'Accessible names & contrast',
      'P1',
      'Icons/buttons have accessible names; text/background contrast is readable for body and CTAs',
      'Inspect icon-only controls and spot-check contrast on hero/CTA text',
    ),
    item(
      'resp-mobile',
      'responsive',
      'Mobile usability',
      'P0',
      'Key screens usable at ~375px without horizontal scroll, clipped CTAs, or unreachable controls',
      'Resize to mobile width; exercise nav, CTA, and forms',
    ),
    item(
      'resp-desktop',
      'responsive',
      'Desktop layout sanity',
      'P2',
      'Wide layouts do not stretch text unreadably; max content width stays comfortable',
      'View at ~1280–1440px; check line length and alignment',
    ),
    item(
      'empty-states',
      'empty-error-states',
      'Empty states explained',
      'P1',
      'Empty lists/search results explain why and offer a next step',
      'Trigger empty list/search; capture copy and CTA',
    ),
    item(
      'error-states',
      'empty-error-states',
      'Error states recoverable',
      'P0',
      'Validation and load failures show recoverable messages — not blank screens or silent failure',
      'Force invalid submit / failed fetch; confirm message + recovery path',
    ),
    item(
      'brand-tokens',
      'brand-consistency',
      'Brand consistency on primary surfaces',
      'P1',
      'Typography, color, and spacing match established brand patterns rather than one-off styles',
      'Compare primary pages against brand baseline or sibling marketing pages',
    ),
    item(
      'ux-evidence',
      'brand-consistency',
      'Evidence package for gate',
      'P0',
      'UX findings sealed under .umer/ux/<runId>/ after gate Pass (report-only)',
      'Approve gate-ux-* so apply writes FINDINGS.md, APPLY_REPORT.md, and last-apply.json',
    ),
  ];
}

function projectExtras(project: ResolvedProject): UxAuditItem[] {
  const extras: UxAuditItem[] = [];

  if (
    project.category === 'seo-project' ||
    project.tags.includes('seo') ||
    project.tags.includes('marketing')
  ) {
    extras.push(
      item(
        'seo-hero-message',
        'content',
        'SEO/marketing hero message',
        'P0',
        'Hero communicates offer + audience in one short block with a single primary CTA',
        'Review above-the-fold copy against keyword intent and CTA clarity',
      ),
      item(
        'seo-trust',
        'brand-consistency',
        'Trust signals near conversion',
        'P1',
        'Proof (samples, testimonials, logos, contact) appears near primary conversion paths',
        'Scroll conversion path; note missing or weakly placed trust cues',
      ),
    );
  }

  if (project.stack.includes('frontend') || project.stack.includes('dashboard')) {
    extras.push(
      item(
        'fe-density',
        'hierarchy',
        'UI density & alignment',
        'P1',
        'Controls and tables align to a consistent grid; dense screens remain scannable',
        'Spot-check primary dashboard/list screens for alignment and crowding',
      ),
      item(
        'fe-loading',
        'empty-error-states',
        'Loading skeletons / progress',
        'P1',
        'Slow views show loading affordance rather than layout jump to empty then content',
        'Throttle network or refresh; observe loading indicators',
      ),
    );
  }

  if (
    project.projectId === 'umer-portfolio' ||
    project.tags.includes('portfolio')
  ) {
    extras.push(
      item(
        'portfolio-hero',
        'hierarchy',
        'Portfolio hero identity',
        'P0',
        'First viewport establishes who you are, what you do, and a clear next action',
        'Cold-read the portfolio landing hero; note missing role/value/CTA',
      ),
      item(
        'portfolio-gallery',
        'content',
        'Project gallery scanability',
        'P0',
        'Featured work is scannable (title, role/outcome, visual) without opening every case study',
        'Scan project cards/list; note missing titles, outcomes, or uneven cards',
      ),
      item(
        'portfolio-contact',
        'interaction',
        'Contact / hire CTA path',
        'P0',
        'Contact or hire path is obvious from home and project pages without hunting',
        'From home and one project page, time-to-find contact CTA',
      ),
      item(
        'portfolio-case-nav',
        'navigation',
        'Case study navigation',
        'P1',
        'Case studies have back-to-work and next/prev or related work paths',
        'Open a case study; confirm exit and related-work navigation',
      ),
    );
  }

  if (project.defaultSpecialists.includes('ux.design')) {
    extras.push(
      item(
        'ux-priority',
        'brand-consistency',
        'UX is an explicit project priority',
        'P2',
        'Track UX backlog via intake type=ux until Pass + evidence sealed',
        'Use Umer AI OS Quick Task / Projects → type ux for this project',
      ),
    );
  }

  return extras;
}

/**
 * ux.design runner (v1 — checklist / report-only).
 *
 * Produces a prioritized UI/UX audit package. Does not mutate product UI;
 * gate Pass seals evidence under `.umer/ux/<runId>/` for eng handoff.
 */
export function runUxAudit(input: {
  project: ResolvedProject;
  goal: string;
  doneWhen?: string;
}): UxAuditReport {
  const items = [...baseChecklist(input.project), ...projectExtras(input.project)];
  const p0 = items.filter((i) => i.priority === 'P0');
  const quickWins = [
    'Walk primary nav and confirm destination labels',
    'Cold-read above-the-fold message + primary CTA',
    'Keyboard-tab the primary journey and check focus',
    'Seal findings under .umer/ux/<runId>/ after gate Pass',
    ...p0.slice(0, 3).map((i) => i.title),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const runId = uxRunId(input.project.projectId);

  return {
    specialistId: 'ux.design',
    runId,
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: input.project.absolutePath,
    goal: input.goal,
    summary: `UX design audit for ${input.project.name}: ${input.goal}`,
    items,
    quickWins,
    nextActions: [
      `Work in ${input.project.absolutePath}`,
      'Clear P0 navigation, hierarchy, accessibility, and error-state items first',
      input.doneWhen?.trim() ||
        'Produce a prioritized UX findings package for gate review',
      'Gate Pass required before treating UX package as sealed',
      'Handoff approved improvements to eng.app-delivery after Pass (no auto UI code apply in v1)',
    ],
    proposedDiff: '',
  };
}
