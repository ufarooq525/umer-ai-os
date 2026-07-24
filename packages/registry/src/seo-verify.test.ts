import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { extractPageSeoSignals, evaluateSeoChecks, enrichWithRobotsSitemap } from './seo-verify.js';
import type { SeoAuditItem } from './seo-audit.js';

const sampleHtml = `<!doctype html><html><head>
<title>Demo Tool Landing Page Title</title>
<meta name="description" content="This is a sufficiently long meta description for SEO automated verification checks." />
<link rel="canonical" href="https://example.com/" />
<meta property="og:title" content="Demo Tool" />
<meta property="og:description" content="Share description for social previews and crawlers." />
<meta property="og:image" content="https://example.com/og.png" />
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><h1>Demo Tool</h1><p>${'Copy '.repeat(80)}</p>
<a href="/tools">Tools</a><a href="/about">About</a><a href="/guides">Guides</a>
</body></html>`;

describe('seo verify', () => {
  it('extracts on-page signals', () => {
    const signals = extractPageSeoSignals(sampleHtml, 'https://example.com/');
    expect(signals.title.length).toBeGreaterThan(10);
    expect(signals.h1Count).toBe(1);
    expect(signals.hasJsonLd).toBe(true);
    expect(signals.ogImage).toContain('og.png');
  });

  it('evaluates checklist against signals', () => {
    const items: SeoAuditItem[] = [
      {
        id: 'onpage-title',
        category: 'on-page',
        title: 'title',
        priority: 'P0',
        check: 't',
        howToVerify: 'v',
      },
      {
        id: 'onpage-og',
        category: 'on-page',
        title: 'og',
        priority: 'P1',
        check: 't',
        howToVerify: 'v',
      },
      {
        id: 'perf-lcp',
        category: 'performance',
        title: 'lcp',
        priority: 'P0',
        check: 't',
        howToVerify: 'v',
      },
    ];
    const signals = extractPageSeoSignals(sampleHtml, 'https://example.com/');
    const checks = evaluateSeoChecks(items, signals, {
      lighthouse: { lcpOk: true, clsOk: true, note: 'mock lighthouse ok' },
    });
    expect(checks.find((c) => c.itemId === 'onpage-title')?.status).toBe('pass');
    expect(checks.find((c) => c.itemId === 'onpage-og')?.status).toBe('pass');
    expect(checks.find((c) => c.itemId === 'perf-lcp')?.status).toBe('pass');
  });

  it('probes robots and sitemap from a local server', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nAllow: /\n');
        return;
      }
      if (req.url === '/sitemap.xml') {
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end('<urlset></urlset>');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(sampleHtml);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    const base = `http://127.0.0.1:${addr.port}/`;
    const signals = await enrichWithRobotsSitemap(extractPageSeoSignals(sampleHtml, base));
    expect(signals.robotsTxtOk).toBe(true);
    expect(signals.sitemapOk).toBe(true);
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });
});
