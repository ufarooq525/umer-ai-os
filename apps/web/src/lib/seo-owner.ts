/**
 * SEO owner board — translates specialist checks into approve/ignore language.
 * Does not invent rankings, clicks, or traffic. Search Console stays unknown
 * until a real connector exists.
 */

import type { GateWaitRecord, ProjectRecord } from './control-api';

/** Sites the owner asked to run as SEO products first. Others still appear after these. */
export const SEO_OWNER_PRIORITY_IDS = ['cursive-generator', 'flow-tool-works', 'umer-portfolio'] as const;

export type SeoRiskClass = 'safe_mechanical' | 'needs_your_words' | 'needs_search_console';

export type SeoOwnerSiteStatus = 'needs_approval' | 'url_unknown' | 'idle';

export type SeoOwnerSite = {
  projectId: string;
  name: string;
  publicUrl: string | null;
  sentence: string;
  status: SeoOwnerSiteStatus;
  pendingGateWaitId: string | null;
  traffic: { status: 'unknown'; label: string };
};

export type SeoOwnerBoard = {
  sites: SeoOwnerSite[];
  pendingApprovals: number;
  trafficKnown: false;
};

const SAFE_FIX_IDS = new Set([
  'tech-robots',
  'tech-sitemap',
  'tech-canonical',
  'onpage-meta',
  'onpage-og',
  'sd-jsonld',
  'onpage-img-alt',
]);

const NEEDS_WORDS_IDS = new Set([
  'onpage-title',
  'onpage-h1',
  'content-intent',
  'cursive-share',
  'cursive-landing',
  'flow-landing',
  'flow-docs',
  'off-internal',
]);

export const SEO_PLAIN_LANGUAGE: Record<string, { owner: string; risk: SeoRiskClass }> = {
  'tech-robots': {
    owner: 'Search engines may be blocked from the public pages.',
    risk: 'safe_mechanical',
  },
  'tech-sitemap': {
    owner: 'There is no map of pages for search engines to follow.',
    risk: 'safe_mechanical',
  },
  'tech-https': {
    owner: 'The site may be reachable as two addresses (www and non-www) or without HTTPS.',
    risk: 'needs_your_words',
  },
  'tech-canonical': {
    owner: 'Search engines may treat www and non-www as two different sites.',
    risk: 'safe_mechanical',
  },
  'onpage-title': {
    owner: 'Page titles need your words — the AI will not invent marketing copy.',
    risk: 'needs_your_words',
  },
  'onpage-meta': {
    owner: 'The short preview text under the title in Google is missing.',
    risk: 'safe_mechanical',
  },
  'onpage-h1': {
    owner: 'The main heading should say what the page is, in your words.',
    risk: 'needs_your_words',
  },
  'onpage-og': {
    owner: 'Links shared on WhatsApp or social may have no preview image or title.',
    risk: 'safe_mechanical',
  },
  'onpage-img-alt': {
    owner: 'Some images have no description, which hurts accessibility and image search.',
    risk: 'safe_mechanical',
  },
  'content-intent': {
    owner: 'The landing page does not clearly say what you sell and for whom.',
    risk: 'needs_your_words',
  },
  'perf-lcp': {
    owner: 'The page may feel slow to load — this needs a measurement, not a guess.',
    risk: 'needs_search_console',
  },
  'perf-cls': {
    owner: 'The page may jump around while loading.',
    risk: 'needs_search_console',
  },
  'sd-jsonld': {
    owner: 'Google has no structured “this is a website/tool” card for the site.',
    risk: 'safe_mechanical',
  },
  'off-internal': {
    owner: 'Important pages may be hard to find from the menu.',
    risk: 'needs_your_words',
  },
  'cursive-share': {
    owner: 'Shared cursive results may not show a preview when someone opens the link.',
    risk: 'needs_your_words',
  },
  'cursive-landing': {
    owner: 'The landing page needs clearer copy about who the generator is for.',
    risk: 'needs_your_words',
  },
  'flow-landing': {
    owner: 'Public marketing pages for the product may be missing or not indexable.',
    risk: 'needs_your_words',
  },
  'flow-docs': {
    owner: 'Help / how-it-works pages may not be written for the problems people search.',
    risk: 'needs_your_words',
  },
};

export function explainSeoItem(itemId: string, fallbackTitle?: string): { owner: string; risk: SeoRiskClass } {
  return (
    SEO_PLAIN_LANGUAGE[itemId] ?? {
      owner: fallbackTitle ?? itemId,
      risk: classifySeoItem(itemId),
    }
  );
}

export function classifySeoItem(itemId: string): SeoRiskClass {
  if (SAFE_FIX_IDS.has(itemId)) return 'safe_mechanical';
  if (NEEDS_WORDS_IDS.has(itemId)) return 'needs_your_words';
  return 'needs_search_console';
}

export function isSeoGate(gateId: string): boolean {
  return gateId.startsWith('gate-seo-');
}

export function seoProjectIdFromGate(gateId: string): string | null {
  if (!isSeoGate(gateId)) return null;
  return gateId.slice('gate-seo-'.length) || null;
}

export function isSeoOwnerProject(project: Pick<ProjectRecord, 'category' | 'tags' | 'defaultSpecialists'>): boolean {
  return (
    project.category === 'seo-project' ||
    project.tags.includes('seo') ||
    project.defaultSpecialists.includes('seo.audit')
  );
}

function siteSentence(input: { name: string; publicUrl: string | null; pending: boolean }): string {
  if (input.pending) {
    return `${input.name}: safe technical SEO fixes are waiting for your Pass. Approving writes them into the project.`;
  }
  if (!input.publicUrl) {
    return `${input.name}: public URL is unknown, so the OS cannot check the live site. Add seoBaseUrl in the project catalog.`;
  }
  return `${input.name}: no SEO approval is waiting. Start an audit from Codebases if you want a fresh check. Traffic is unknown.`;
}

function siteStatus(pending: boolean, publicUrl: string | null): SeoOwnerSiteStatus {
  if (pending) return 'needs_approval';
  if (!publicUrl) return 'url_unknown';
  return 'idle';
}

export function deriveSeoOwnerBoard(input: {
  projects: ProjectRecord[];
  gates: GateWaitRecord[];
}): SeoOwnerBoard {
  const seoProjects = input.projects.filter(isSeoOwnerProject);
  seoProjects.sort((a, b) => {
    const ai = SEO_OWNER_PRIORITY_IDS.indexOf(a.projectId as (typeof SEO_OWNER_PRIORITY_IDS)[number]);
    const bi = SEO_OWNER_PRIORITY_IDS.indexOf(b.projectId as (typeof SEO_OWNER_PRIORITY_IDS)[number]);
    const ar = ai === -1 ? 100 : ai;
    const br = bi === -1 ? 100 : bi;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });

  const sites: SeoOwnerSite[] = seoProjects.map((project) => {
    const gate = input.gates.find((g) => seoProjectIdFromGate(g.gateId) === project.projectId);
    const publicUrl = project.seoBaseUrl?.trim() || null;
    const pending = Boolean(gate);
    return {
      projectId: project.projectId,
      name: project.name,
      publicUrl,
      sentence: siteSentence({ name: project.name, publicUrl, pending }),
      status: siteStatus(pending, publicUrl),
      pendingGateWaitId: gate?.waitId ?? null,
      traffic: { status: 'unknown', label: 'Search Console not connected' },
    };
  });

  return {
    sites,
    pendingApprovals: sites.filter((s) => s.status === 'needs_approval').length,
    trafficKnown: false,
  };
}
