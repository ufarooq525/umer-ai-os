import type { ResolvedProject } from './types.js';

export type SeoPriority = 'P0' | 'P1' | 'P2';

export type SeoCategory =
  | 'technical'
  | 'on-page'
  | 'content'
  | 'performance'
  | 'structured-data'
  | 'off-page';

export type SeoAuditItem = {
  id: string;
  category: SeoCategory;
  title: string;
  priority: SeoPriority;
  check: string;
  howToVerify: string;
};

export type SeoAuditReport = {
  specialistId: 'seo.audit';
  projectId: string;
  projectName: string;
  absolutePath: string;
  goal: string;
  summary: string;
  items: SeoAuditItem[];
  quickWins: string[];
  nextActions: string[];
};

function item(
  id: string,
  category: SeoCategory,
  title: string,
  priority: SeoPriority,
  check: string,
  howToVerify: string,
): SeoAuditItem {
  return { id, category, title, priority, check, howToVerify };
}

function baseChecklist(project: ResolvedProject): SeoAuditItem[] {
  return [
    item(
      'tech-robots',
      'technical',
      'robots.txt allows public pages',
      'P0',
      'Confirm robots.txt does not block marketing/landing routes',
      `Open ${project.absolutePath} public/robots.txt or equivalent hosting config`,
    ),
    item(
      'tech-sitemap',
      'technical',
      'XML sitemap present and linked',
      'P0',
      'Sitemap lists canonical public URLs and is referenced from robots.txt',
      'Check /sitemap.xml (or framework route) and Search Console submission later',
    ),
    item(
      'tech-https',
      'technical',
      'HTTPS and canonical host',
      'P0',
      'Single preferred host (www vs apex) with HTTPS redirects',
      'Inspect live redirects and hosting SSL',
    ),
    item(
      'onpage-title',
      'on-page',
      'Unique title tags',
      'P0',
      'Each indexable page has a unique, intent-matched <title> (≈50–60 chars)',
      'View page source / Next metadata / Blade <title>',
    ),
    item(
      'onpage-meta',
      'on-page',
      'Meta descriptions',
      'P1',
      'Unique meta descriptions for primary landing pages',
      'Check meta name=description on top templates',
    ),
    item(
      'onpage-h1',
      'on-page',
      'Single clear H1',
      'P0',
      'One primary H1 aligned to page intent',
      'Inspect DOM headings on home + key landing pages',
    ),
    item(
      'onpage-og',
      'on-page',
      'Open Graph / social preview',
      'P1',
      'og:title, og:description, og:image set for shareable pages',
      'Use social debugger or view meta tags',
    ),
    item(
      'content-intent',
      'content',
      'Primary keyword intent clarity',
      'P1',
      'Hero + supporting copy states what the product does and for whom',
      'Read home/landing copy against the intake goal',
    ),
    item(
      'perf-lcp',
      'performance',
      'LCP / hero performance',
      'P0',
      'Hero media optimized; avoid huge unoptimized images blocking LCP',
      'Lighthouse mobile on primary URL; check image weights in repo',
    ),
    item(
      'perf-cls',
      'performance',
      'CLS stability',
      'P1',
      'Reserve space for images/fonts; avoid layout jumps',
      'Lighthouse CLS + visual check on load',
    ),
    item(
      'sd-jsonld',
      'structured-data',
      'Relevant JSON-LD',
      'P1',
      'Add SoftwareApplication / WebSite / Organization schema where appropriate',
      'Rich Results test on home URL after deploy',
    ),
    item(
      'off-internal',
      'off-page',
      'Internal linking',
      'P2',
      'Key pages linked from nav/footer with descriptive anchors',
      'Crawl primary nav and footer links',
    ),
  ];
}

function projectExtras(project: ResolvedProject): SeoAuditItem[] {
  const extras: SeoAuditItem[] = [];
  if (project.projectId === 'cursive-generator') {
    extras.push(
      item(
        'cursive-share',
        'on-page',
        'Generated output share pages',
        'P0',
        'Shared cursive/result URLs have crawlable preview meta (or intentional noindex if private)',
        'Generate a sample, share URL, inspect og:image and indexability',
      ),
      item(
        'cursive-landing',
        'content',
        'Tool landing SEO copy',
        'P1',
        'Landing explains use-cases (invites, logos, education) with scannable sections',
        'Review home/marketing sections in the frontend app',
      ),
    );
  }
  if (project.projectId === 'flow-tool-works') {
    extras.push(
      item(
        'flow-landing',
        'content',
        'Product landing & feature pages',
        'P0',
        'Public marketing pages for core workflows exist and are indexable',
        'Map routes for marketing vs app shell; ensure app routes are noindex if auth-only',
      ),
      item(
        'flow-docs',
        'content',
        'Docs / how-it-works discoverability',
        'P1',
        'Help or how-it-works content targets problem keywords',
        'Inventory docs/help routes and titles',
      ),
    );
  }
  if (project.tags.includes('seo') || project.defaultSpecialists.includes('seo.audit')) {
    extras.push(
      item(
        'seo-priority',
        'technical',
        'SEO is an explicit project priority',
        'P1',
        'Track SEO backlog items in gates until Pass + applied',
        'Use Umer AI OS intake type=seo for this project',
      ),
    );
  }
  return extras;
}

export function runSeoAudit(input: {
  project: ResolvedProject;
  goal: string;
  doneWhen?: string;
}): SeoAuditReport {
  const items = [...baseChecklist(input.project), ...projectExtras(input.project)];
  const p0 = items.filter((i) => i.priority === 'P0');
  const quickWins = [
    'Fix unique titles + H1 on home and primary landing',
    'Add/verify sitemap.xml + robots.txt',
    'Compress hero images and confirm mobile LCP',
    ...p0.slice(0, 2).map((i) => i.title),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return {
    specialistId: 'seo.audit',
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: input.project.absolutePath,
    goal: input.goal,
    summary: `SEO audit for ${input.project.name}: ${input.goal}`,
    items,
    quickWins,
    nextActions: [
      `Work in ${input.project.absolutePath}`,
      'Clear P0 checklist items first',
      input.doneWhen?.trim() || 'Re-run Lighthouse + manual meta review when done',
      'Gate Pass required before treating SEO work as complete',
      'Handoff code changes to eng.app-delivery after Pass',
    ],
  };
}
