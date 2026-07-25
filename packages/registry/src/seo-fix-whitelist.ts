/**
 * v1 whitelist of technical SEO fixes that may be proposed as a code change-set.
 *
 * Rules for inclusion:
 * - Mechanical / structural only (tags, directives, timestamps).
 * - Must not invent marketing copy or rewrite existing human-authored text.
 * - Anything needing keyword/content judgment stays report-only.
 *
 * Gate policy (v1, same spirit as eng client-task): even whitelisted fixes require
 * an explicit human Pass — no auto-apply. Wiring that policy into apply/gate is a
 * separate step; this module only defines *what may appear in a proposedDiff*.
 */

export const SEO_SAFE_FIX_IDS = [
  /** Append `Sitemap:` to robots.txt when the directive is missing. */
  'tech-robots',
  /** Bump existing <lastmod> dates, or create a minimal sitemap.xml when absent. */
  'tech-sitemap',
  /** Insert <link rel="canonical"> when the attribute is entirely missing. */
  'tech-canonical',
  /**
   * Insert <meta name="description"> only when absent.
   * Content is copied mechanically from the existing <title> (truncated) — never
   * rewrites an existing description.
   */
  'onpage-meta',
  /**
   * Insert missing og:title / og:description / og:image when the tags are absent.
   * Values are mirrored from title / meta description; og:image uses a stable
   * placeholder path under the site origin when no image meta exists.
   */
  'onpage-og',
  /** Insert a minimal WebSite JSON-LD block when application/ld+json is absent. */
  'sd-jsonld',
  /**
   * For <img> tags with no alt attribute at all, set alt from the file stem
   * (e.g. hero.png → "hero"). Does not rewrite existing alt text.
   */
  'onpage-img-alt',
] as const;

export type SeoSafeFixId = (typeof SEO_SAFE_FIX_IDS)[number];

const SAFE_FIX_SET = new Set<string>(SEO_SAFE_FIX_IDS);

/** Checklist items that must stay report-only (content / judgment / hosting). */
export const SEO_REPORT_ONLY_IDS = [
  'tech-https',
  'onpage-title',
  'onpage-h1',
  'content-intent',
  'perf-lcp',
  'perf-cls',
  'off-internal',
  'cursive-share',
  'cursive-landing',
  'flow-landing',
  'flow-docs',
  'seo-priority',
] as const;

export function isSeoSafeFixId(id: string): id is SeoSafeFixId {
  return SAFE_FIX_SET.has(id);
}

export function listSeoSafeFixIds(): SeoSafeFixId[] {
  return [...SEO_SAFE_FIX_IDS];
}
