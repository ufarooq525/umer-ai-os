import type { SeoAuditItem } from './seo-audit.js';

export type SeoCheckStatus = 'pass' | 'fail' | 'skipped' | 'patched';

export type SeoCheckResult = {
  itemId: string;
  status: SeoCheckStatus;
  evidence: string;
};

export type PageSeoSignals = {
  finalUrl: string;
  title: string;
  metaDescription: string;
  canonical: string;
  h1Count: number;
  h1Text: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  hasJsonLd: boolean;
  internalLinkCount: number;
  bodyTextLength: number;
  isHttps: boolean;
  robotsTxtOk: boolean | null;
  sitemapOk: boolean | null;
};

function metaContent(html: string, key: string): string {
  const prop = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const propAlt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["']`,
    'i',
  );
  return prop.exec(html)?.[1]?.trim() || propAlt.exec(html)?.[1]?.trim() || '';
}

export function extractPageSeoSignals(html: string, finalUrl: string): PageSeoSignals {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Text = h1Matches[0]?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
  const canonical =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1]?.trim() ||
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(html)?.[1]?.trim() ||
    '';
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const origin = (() => {
    try {
      return new URL(finalUrl).origin;
    } catch {
      return '';
    }
  })();
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]!);
  const internalLinkCount = hrefs.filter((h) => h.startsWith('/') || (origin && h.startsWith(origin))).length;

  return {
    finalUrl,
    title,
    metaDescription: metaContent(html, 'description'),
    canonical,
    h1Count: h1Matches.length,
    h1Text,
    ogTitle: metaContent(html, 'og:title'),
    ogDescription: metaContent(html, 'og:description'),
    ogImage: metaContent(html, 'og:image'),
    hasJsonLd: /application\/ld\+json/i.test(html),
    internalLinkCount,
    bodyTextLength: text.length,
    isHttps: finalUrl.startsWith('https://'),
    robotsTxtOk: null,
    sitemapOk: null,
  };
}

async function probeOk(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'UmerAI-OS-SEO-Verify/1.0' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function enrichWithRobotsSitemap(
  signals: PageSeoSignals,
  fetchImpl: typeof fetch = fetch,
): Promise<PageSeoSignals> {
  try {
    const base = new URL(signals.finalUrl);
    const robots = await probeOk(new URL('/robots.txt', base).toString(), fetchImpl);
    const sitemap = await probeOk(new URL('/sitemap.xml', base).toString(), fetchImpl);
    return { ...signals, robotsTxtOk: robots, sitemapOk: sitemap };
  } catch {
    return signals;
  }
}

export function evaluateSeoChecks(
  items: SeoAuditItem[],
  signals: PageSeoSignals | null,
  extras?: { lighthouse?: { lcpOk: boolean | null; clsOk: boolean | null; note: string } },
): SeoCheckResult[] {
  if (!signals) {
    return items.map((item) => ({
      itemId: item.id,
      status: 'skipped' as const,
      evidence: 'No reachable SEO URL (set UMER_SEO_BASE_URL or start local app)',
    }));
  }

  return items.map((item) => {
    switch (item.id) {
      case 'tech-robots':
        return {
          itemId: item.id,
          status: signals.robotsTxtOk ? 'pass' : signals.robotsTxtOk === false ? 'fail' : 'skipped',
          evidence:
            signals.robotsTxtOk === null
              ? 'robots.txt not probed'
              : `robots.txt reachable=${signals.robotsTxtOk}`,
        };
      case 'tech-sitemap':
        return {
          itemId: item.id,
          status: signals.sitemapOk ? 'pass' : signals.sitemapOk === false ? 'fail' : 'skipped',
          evidence:
            signals.sitemapOk === null
              ? 'sitemap.xml not probed'
              : `sitemap.xml reachable=${signals.sitemapOk}`,
        };
      case 'tech-https':
        return {
          itemId: item.id,
          status: signals.isHttps || signals.finalUrl.includes('127.0.0.1') || signals.finalUrl.includes('localhost')
            ? 'pass'
            : 'fail',
          evidence: `finalUrl=${signals.finalUrl}`,
        };
      case 'tech-canonical':
        return {
          itemId: item.id,
          status: signals.canonical ? 'pass' : 'fail',
          evidence: signals.canonical
            ? `canonical=${signals.canonical}`
            : 'No rel=canonical on probed page',
        };
      case 'onpage-title':
        return {
          itemId: item.id,
          status: signals.title.length >= 10 && signals.title.length <= 70 ? 'pass' : 'fail',
          evidence: `title="${signals.title}" length=${signals.title.length}`,
        };
      case 'onpage-meta':
        return {
          itemId: item.id,
          status: signals.metaDescription.length >= 50 ? 'pass' : 'fail',
          evidence: `description length=${signals.metaDescription.length}`,
        };
      case 'onpage-h1':
        return {
          itemId: item.id,
          status: signals.h1Count >= 1 ? 'pass' : 'fail',
          evidence: `h1Count=${signals.h1Count} text="${signals.h1Text.slice(0, 80)}"`,
        };
      case 'onpage-og':
        return {
          itemId: item.id,
          status:
            signals.ogTitle && signals.ogDescription && signals.ogImage ? 'pass' : 'fail',
          evidence: `og:title=${Boolean(signals.ogTitle)} og:description=${Boolean(signals.ogDescription)} og:image=${Boolean(signals.ogImage)}`,
        };
      case 'content-intent':
      case 'cursive-landing':
      case 'flow-landing':
      case 'flow-docs':
        return {
          itemId: item.id,
          status: signals.bodyTextLength >= 200 && signals.h1Count >= 1 ? 'pass' : 'fail',
          evidence: `bodyTextLength=${signals.bodyTextLength} h1Count=${signals.h1Count}`,
        };
      case 'sd-jsonld':
        return {
          itemId: item.id,
          status: signals.hasJsonLd ? 'pass' : 'fail',
          evidence: `hasJsonLd=${signals.hasJsonLd}`,
        };
      case 'off-internal':
        return {
          itemId: item.id,
          status: signals.internalLinkCount >= 3 ? 'pass' : 'fail',
          evidence: `internalLinkCount=${signals.internalLinkCount}`,
        };
      case 'perf-lcp':
        if (!extras?.lighthouse || extras.lighthouse.lcpOk === null) {
          return {
            itemId: item.id,
            status: 'skipped',
            evidence: extras?.lighthouse?.note ?? 'Lighthouse not run',
          };
        }
        return {
          itemId: item.id,
          status: extras.lighthouse.lcpOk ? 'pass' : 'fail',
          evidence: extras.lighthouse.note,
        };
      case 'perf-cls':
        if (!extras?.lighthouse || extras.lighthouse.clsOk === null) {
          return {
            itemId: item.id,
            status: 'skipped',
            evidence: extras?.lighthouse?.note ?? 'Lighthouse not run',
          };
        }
        return {
          itemId: item.id,
          status: extras.lighthouse.clsOk ? 'pass' : 'fail',
          evidence: extras.lighthouse.note,
        };
      case 'cursive-share':
        return {
          itemId: item.id,
          status: signals.ogImage ? 'pass' : 'fail',
          evidence: 'Share/OG image present on probed URL (proxy for share pages)',
        };
      case 'seo-priority':
        return { itemId: item.id, status: 'pass', evidence: 'SEO apply pipeline executed' };
      default:
        return {
          itemId: item.id,
          status: 'skipped',
          evidence: 'No automated rule for this item yet',
        };
    }
  });
}
