import { access, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  buildProposedDiff,
  contentHash,
  resolveEngChangeSet,
  summarizeEditStats,
  type EngChangeSetEntry,
  type EngResolvedEdit,
} from './eng-diff.js';
import { isSeoSafeFixId, type SeoSafeFixId } from './seo-fix-whitelist.js';
import type { ResolvedProject } from './types.js';

export type SeoFixProposal = {
  /** Structured change-set (apply input later — never a free-form patch parser). */
  changeSet: EngChangeSetEntry[];
  edits: EngResolvedEdit[];
  proposedDiff: string;
  /** Whitelist item ids that produced at least one edit. */
  fixableItemIds: SeoSafeFixId[];
  /** Why a whitelisted item was skipped (file missing, already ok, ambiguous). */
  skipped: Array<{ itemId: SeoSafeFixId; reason: string }>;
  editStats: { filesChanged: number; linesAdded: number; linesRemoved: number };
  /** Repo-relative paths that were considered as HTML shells. */
  scannedHtml: string[];
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function siteOrigin(project: ResolvedProject): string {
  const raw = project.seoBaseUrl?.trim() || project.seoLocalUrl?.trim() || '';
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function insertBeforeHeadClose(html: string, snippet: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${snippet}\n</head>`);
  }
  return `${html.trimEnd()}\n${snippet}\n`;
}

function hasMetaDescription(html: string): boolean {
  return /<meta[^>]+name=["']description["']/i.test(html);
}

function hasCanonical(html: string): boolean {
  return /rel=["']canonical["']/i.test(html);
}

function hasOg(html: string, key: string): boolean {
  return new RegExp(`property=["']${key}["']`, 'i').test(html);
}

function hasJsonLd(html: string): boolean {
  return /application\/ld\+json/i.test(html);
}

function pageTitle(html: string): string {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
}

function metaDescriptionContent(html: string): string {
  const a =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html)?.[1];
  return a?.trim() ?? '';
}

/** Mechanical description seed — existing title only, truncated. Never invents keywords. */
function descriptionFromTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 155) return cleaned;
  return `${cleaned.slice(0, 152).trimEnd()}...`;
}

function fileStemAlt(src: string): string {
  const name = basename(src.split('?')[0] ?? src);
  const stem = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return stem || 'image';
}

/**
 * Add alt from filename stem only when the attribute is entirely missing.
 * Leaves existing alt= (including empty) untouched.
 */
function patchMissingImgAlt(html: string): { html: string; count: number } {
  let count = 0;
  const next = html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\balt\s*=/i.test(attrs)) return full;
    const src = /\bsrc=["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    const alt = fileStemAlt(src);
    count += 1;
    const trimmed = attrs.trim();
    return `<img ${trimmed}${trimmed ? ' ' : ''}alt="${alt}">`;
  });
  return { html: next, count };
}

async function findHtmlShells(root: string): Promise<string[]> {
  const candidates = ['index.html', 'public/index.html', 'dist/index.html'];
  const found: string[] = [];
  for (const rel of candidates) {
    if (await exists(join(root, rel))) found.push(rel);
  }
  return found;
}

type Pending = {
  path: string;
  before: string | null;
  after: string;
  notes: string[];
  itemIds: SeoSafeFixId[];
  create: boolean;
};

function upsertPending(
  map: Map<string, Pending>,
  path: string,
  before: string,
  mutate: (current: string) => { after: string; note: string; itemId: SeoSafeFixId } | null,
): void {
  const existing = map.get(path);
  if (existing?.create) return;
  const current = existing?.after ?? before;
  const result = mutate(current);
  if (!result) return;
  if (existing) {
    existing.after = result.after;
    existing.notes.push(result.note);
    if (!existing.itemIds.includes(result.itemId)) existing.itemIds.push(result.itemId);
  } else {
    map.set(path, {
      path,
      before,
      after: result.after,
      notes: [result.note],
      itemIds: [result.itemId],
      create: false,
    });
  }
}

/**
 * Scan the Laragon project for whitelisted mechanical SEO gaps and build a
 * change-set + unified proposedDiff (eng.app-delivery shape).
 *
 * Does not write to disk and does not invent marketing copy.
 */
export async function proposeSeoSafeFixes(input: {
  project: ResolvedProject;
  /** Limit which whitelist ids to attempt (default: all). */
  only?: SeoSafeFixId[];
}): Promise<SeoFixProposal> {
  const root = input.project.absolutePath;
  const allow = new Set(
    (input.only ?? []).length > 0
      ? input.only!
      : ([
          'tech-robots',
          'tech-sitemap',
          'tech-canonical',
          'onpage-meta',
          'onpage-og',
          'sd-jsonld',
          'onpage-img-alt',
        ] as SeoSafeFixId[]),
  );

  const skipped: SeoFixProposal['skipped'] = [];
  const pending = new Map<string, Pending>();
  const origin = siteOrigin(input.project);
  const htmlFiles = await findHtmlShells(root);

  // --- tech-robots ---
  if (allow.has('tech-robots')) {
    const rel = 'public/robots.txt';
    const full = join(root, rel);
    if (!(await exists(full))) {
      skipped.push({ itemId: 'tech-robots', reason: 'public/robots.txt not found' });
    } else {
      const before = await readFile(full, 'utf8');
      if (/^\s*sitemap\s*:/im.test(before)) {
        skipped.push({ itemId: 'tech-robots', reason: 'Sitemap directive already present' });
      } else if (!origin) {
        skipped.push({
          itemId: 'tech-robots',
          reason: 'No seoBaseUrl/seoLocalUrl — cannot invent Sitemap URL',
        });
      } else {
        const after = `${before.trimEnd()}\n\nSitemap: ${origin}/sitemap.xml\n`;
        upsertPending(pending, rel, before, () => ({
          after,
          note: `Append Sitemap: ${origin}/sitemap.xml`,
          itemId: 'tech-robots',
        }));
      }
    }
  }

  // --- tech-sitemap ---
  if (allow.has('tech-sitemap')) {
    const rel = 'public/sitemap.xml';
    const full = join(root, rel);
    if (await exists(full)) {
      const before = await readFile(full, 'utf8');
      const today = new Date().toISOString().slice(0, 10);
      const after = before.replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${today}</lastmod>`);
      if (after === before) {
        skipped.push({
          itemId: 'tech-sitemap',
          reason: 'sitemap.xml has no <lastmod> nodes to bump (left unchanged)',
        });
      } else {
        upsertPending(pending, rel, before, () => ({
          after,
          note: `Bump <lastmod> to ${today}`,
          itemId: 'tech-sitemap',
        }));
      }
    } else if (origin) {
      const content = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        `    <loc>${origin}/</loc>`,
        `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`,
        '  </url>',
        '</urlset>',
        '',
      ].join('\n');
      pending.set(rel, {
        path: rel,
        before: null,
        after: content,
        notes: [`Create minimal sitemap.xml for ${origin}/`],
        itemIds: ['tech-sitemap'],
        create: true,
      });
    } else {
      skipped.push({
        itemId: 'tech-sitemap',
        reason: 'public/sitemap.xml missing and no seoBaseUrl to seed a new one',
      });
    }
  }

  // --- HTML shell fixes ---
  if (htmlFiles.length === 0) {
    for (const id of [
      'tech-canonical',
      'onpage-meta',
      'onpage-og',
      'sd-jsonld',
      'onpage-img-alt',
    ] as SeoSafeFixId[]) {
      if (allow.has(id)) {
        skipped.push({
          itemId: id,
          reason: 'No local HTML shell (index.html / public/index.html) to patch',
        });
      }
    }
  }

  for (const rel of htmlFiles) {
    const before = await readFile(join(root, rel), 'utf8');
    const title = pageTitle(before);
    const existingDesc = metaDescriptionContent(before);

    if (allow.has('tech-canonical')) {
      if (hasCanonical(before)) {
        skipped.push({ itemId: 'tech-canonical', reason: `${rel} already has rel=canonical` });
      } else {
        const href = origin ? `${origin}/` : '/';
        upsertPending(pending, rel, before, (current) => {
          if (hasCanonical(current)) return null;
          return {
            after: insertBeforeHeadClose(
              current,
              `<link rel="canonical" href="${href}" />`,
            ),
            note: `Add canonical ${href}`,
            itemId: 'tech-canonical',
          };
        });
      }
    }

    if (allow.has('onpage-meta')) {
      if (hasMetaDescription(before)) {
        skipped.push({
          itemId: 'onpage-meta',
          reason: `${rel} already has meta description (never rewrite existing copy)`,
        });
      } else if (!title) {
        skipped.push({
          itemId: 'onpage-meta',
          reason: `${rel} has no <title> to seed a mechanical description`,
        });
      } else {
        const desc = descriptionFromTitle(title);
        upsertPending(pending, rel, before, (current) => {
          if (hasMetaDescription(current)) return null;
          return {
            after: insertBeforeHeadClose(
              current,
              `<meta name="description" content="${desc.replace(/"/g, '&quot;')}" />`,
            ),
            note: 'Add meta description seeded from existing <title>',
            itemId: 'onpage-meta',
          };
        });
      }
    }

    if (allow.has('onpage-og')) {
      const missing: string[] = [];
      if (!hasOg(before, 'og:title')) missing.push('og:title');
      if (!hasOg(before, 'og:description')) missing.push('og:description');
      if (!hasOg(before, 'og:image')) missing.push('og:image');
      if (missing.length === 0) {
        skipped.push({ itemId: 'onpage-og', reason: `${rel} already has OG title/description/image` });
      } else if (!title && !existingDesc) {
        skipped.push({
          itemId: 'onpage-og',
          reason: `${rel} missing OG tags but no title/description to mirror`,
        });
      } else {
        upsertPending(pending, rel, before, (current) => {
          let next = current;
          const added: string[] = [];
          if (!hasOg(next, 'og:title') && title) {
            next = insertBeforeHeadClose(
              next,
              `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`,
            );
            added.push('og:title');
          }
          const desc = existingDesc || (title ? descriptionFromTitle(title) : '');
          if (!hasOg(next, 'og:description') && desc) {
            next = insertBeforeHeadClose(
              next,
              `<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />`,
            );
            added.push('og:description');
          }
          if (!hasOg(next, 'og:image')) {
            const img = origin ? `${origin}/og-image.png` : '/og-image.png';
            next = insertBeforeHeadClose(
              next,
              `<meta property="og:image" content="${img}" />`,
            );
            added.push('og:image');
          }
          if (added.length === 0) return null;
          return {
            after: next,
            note: `Add missing OG tags: ${added.join(', ')}`,
            itemId: 'onpage-og',
          };
        });
      }
    }

    if (allow.has('sd-jsonld')) {
      if (hasJsonLd(before)) {
        skipped.push({ itemId: 'sd-jsonld', reason: `${rel} already has JSON-LD` });
      } else {
        const name = title || input.project.name;
        const url = origin ? `${origin}/` : '/';
        const json = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name,
          url,
        });
        upsertPending(pending, rel, before, (current) => {
          if (hasJsonLd(current)) return null;
          return {
            after: insertBeforeHeadClose(
              current,
              `<script type="application/ld+json">${json}</script>`,
            ),
            note: 'Add minimal WebSite JSON-LD',
            itemId: 'sd-jsonld',
          };
        });
      }
    }

    if (allow.has('onpage-img-alt')) {
      const { count } = patchMissingImgAlt(before);
      if (count === 0) {
        skipped.push({
          itemId: 'onpage-img-alt',
          reason: `${rel} has no <img> tags missing alt`,
        });
      } else {
        upsertPending(pending, rel, before, (current) => {
          const { html: next, count: n } = patchMissingImgAlt(current);
          if (n === 0) return null;
          return {
            after: next,
            note: `Set alt from filename stem on ${n} <img> tag(s)`,
            itemId: 'onpage-img-alt',
          };
        });
      }
    }
  }

  const changeSet: EngChangeSetEntry[] = [];
  for (const p of pending.values()) {
    if (p.create) {
      changeSet.push({
        path: p.path,
        expectedContent: null,
        expectedHash: contentHash(''),
        content: p.after,
        note: p.notes.join('; '),
      });
    } else if (p.before !== null && p.after !== p.before) {
      changeSet.push({
        path: p.path,
        expectedContent: p.before,
        expectedHash: contentHash(p.before),
        content: p.after,
        note: p.notes.join('; '),
      });
    }
  }

  const resolution = await resolveEngChangeSet({ root, changes: changeSet });
  const proposedDiff =
    resolution.edits.length > 0 ? buildProposedDiff(resolution.edits) : '';
  const fixableItemIds = [
    ...new Set(
      [...pending.values()].flatMap((p) => p.itemIds).filter((id) => isSeoSafeFixId(id)),
    ),
  ] as SeoSafeFixId[];

  return {
    changeSet: resolution.problems.length === 0 ? changeSet : [],
    edits: resolution.edits,
    proposedDiff,
    fixableItemIds: resolution.problems.length === 0 ? fixableItemIds : [],
    skipped,
    editStats: summarizeEditStats(resolution.edits),
    scannedHtml: htmlFiles,
  };
}

/**
 * Evidence paths under the existing `.umer/seo/` tree (no new top-level specialist dir).
 * Gate/apply should seal these on Pass — exported now so the layout is fixed before wiring.
 */
export const SEO_FIX_EVIDENCE_PATHS = {
  proposedDiff: '.umer/seo/PROPOSED_DIFF.patch',
  changeSet: '.umer/seo/evidence/fix-change-set.json',
  proposalMeta: '.umer/seo/evidence/fix-proposal.json',
  fixNotes: '.umer/seo/FIX_NOTES.md',
} as const;
