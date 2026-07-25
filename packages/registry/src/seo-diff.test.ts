import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { proposeSeoSafeFixes, SEO_FIX_EVIDENCE_PATHS } from './seo-diff.js';
import { SEO_SAFE_FIX_IDS, SEO_REPORT_ONLY_IDS, isSeoSafeFixId } from './seo-fix-whitelist.js';
import { runSeoAudit, buildSeoAuditReport } from './seo-audit.js';
import { applySeoToProject } from './seo-apply.js';
import type { ResolvedProject } from './types.js';

function fakeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    projectId: 'demo-seo',
    name: 'Demo SEO',
    slug: 'demo-seo',
    path: 'demo-seo',
    status: 'active',
    category: 'seo-project',
    stack: ['static'],
    defaultSpecialists: ['seo.audit'],
    constraints: [],
    tags: ['seo'],
    absolutePath: '/tmp/demo',
    seoBaseUrl: 'https://example.com',
    ...overrides,
  };
}

describe('seo safe-fix whitelist', () => {
  it('keeps content/judgment items report-only', () => {
    for (const id of SEO_REPORT_ONLY_IDS) {
      expect(isSeoSafeFixId(id)).toBe(false);
    }
    expect(SEO_SAFE_FIX_IDS).toContain('tech-robots');
    expect(SEO_SAFE_FIX_IDS).toContain('onpage-meta');
    expect(SEO_SAFE_FIX_IDS).not.toContain('content-intent');
    expect(SEO_SAFE_FIX_IDS).not.toContain('onpage-title');
  });

  it('documents evidence under the existing .umer/seo/ tree', () => {
    expect(SEO_FIX_EVIDENCE_PATHS.proposedDiff).toBe('.umer/seo/PROPOSED_DIFF.patch');
    expect(SEO_FIX_EVIDENCE_PATHS.changeSet.startsWith('.umer/seo/')).toBe(true);
  });
});

describe('proposeSeoSafeFixes', () => {
  it('proposes mechanical inserts without rewriting existing meta copy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-fix-'));
    try {
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(
        join(dir, 'public', 'robots.txt'),
        'User-agent: *\nAllow: /\n',
        'utf8',
      );
      await writeFile(
        join(dir, 'index.html'),
        [
          '<!doctype html><html><head>',
          '<title>Flow Tools Home Page</title>',
          '</head><body>',
          '<h1>Tools</h1>',
          '<img src="/assets/hero-banner.png">',
          '<img src="/logo.svg" alt="Logo">',
          '</body></html>',
        ].join('\n'),
        'utf8',
      );

      const proposal = await proposeSeoSafeFixes({
        project: fakeProject({ absolutePath: dir }),
      });

      expect(proposal.fixableItemIds).toEqual(
        expect.arrayContaining([
          'tech-robots',
          'tech-sitemap',
          'tech-canonical',
          'onpage-meta',
          'onpage-og',
          'sd-jsonld',
          'onpage-img-alt',
        ]),
      );
      expect(proposal.proposedDiff).toContain('Sitemap: https://example.com/sitemap.xml');
      expect(proposal.proposedDiff).toContain('rel="canonical"');
      expect(proposal.proposedDiff).toContain('name="description"');
      expect(proposal.proposedDiff).toContain('alt="hero banner"');
      // Existing alt stays on the context line — ensure we did not rewrite it.
      expect(proposal.proposedDiff).not.toMatch(/^-.*alt="Logo"/m);
      expect(proposal.proposedDiff).not.toMatch(/^\+.*alt="Logo"/m);

      // Disk unchanged — proposal only.
      const robots = await readFile(join(dir, 'public', 'robots.txt'), 'utf8');
      expect(robots).not.toContain('Sitemap:');
      const html = await readFile(join(dir, 'index.html'), 'utf8');
      expect(html).not.toContain('name="description"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never rewrites an existing meta description', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-meta-'));
    try {
      await writeFile(
        join(dir, 'index.html'),
        `<!doctype html><html><head>
<title>Home</title>
<meta name="description" content="Human authored description that must not be touched by automation." />
<link rel="canonical" href="https://example.com/" />
<meta property="og:title" content="Home" />
<meta property="og:description" content="Human authored description that must not be touched by automation." />
<meta property="og:image" content="https://example.com/og.png" />
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><h1>Hi</h1></body></html>`,
        'utf8',
      );
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(
        join(dir, 'public', 'robots.txt'),
        'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
        'utf8',
      );
      await writeFile(
        join(dir, 'public', 'sitemap.xml'),
        `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><lastmod>2020-01-01</lastmod></url></urlset>\n`,
        'utf8',
      );

      const proposal = await proposeSeoSafeFixes({
        project: fakeProject({ absolutePath: dir }),
      });

      expect(proposal.fixableItemIds).toEqual(['tech-sitemap']);
      expect(proposal.proposedDiff).toMatch(/^\-.*2020-01-01/m);
      expect(proposal.proposedDiff).toMatch(/^\+.*<lastmod>2026-/m);
      expect(proposal.skipped.some((s) => s.itemId === 'onpage-meta')).toBe(true);
      expect(await readFile(join(dir, 'index.html'), 'utf8')).toContain(
        'Human authored description that must not be touched by automation.',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('runSeoAudit', () => {
  it('attaches a proposedDiff work package alongside the checklist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-audit-'));
    try {
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(join(dir, 'public', 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');
      await writeFile(
        join(dir, 'index.html'),
        '<!doctype html><html><head><title>Demo Site Title Here</title></head><body><h1>Demo</h1></body></html>',
        'utf8',
      );

      const report = await runSeoAudit({
        project: fakeProject({ absolutePath: dir }),
        goal: 'Improve technical SEO on the landing page',
      });

      expect(report.items.some((i) => i.id === 'tech-canonical')).toBe(true);
      expect(report.items.some((i) => i.id === 'onpage-img-alt')).toBe(true);
      expect(report.proposedDiff?.length).toBeGreaterThan(0);
      expect(report.changeSet?.length).toBeGreaterThan(0);
      expect(report.fixableItemIds?.length).toBeGreaterThan(0);
      expect(report.summary).toContain('Proposed mechanical fixes');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps buildSeoAuditReport sync and proposal-free for planIntake', () => {
    const report = buildSeoAuditReport({
      project: fakeProject(),
      goal: 'Checklist only for intake planning',
    });
    expect(report.proposedDiff).toBe('');
    expect(report.changeSet).toEqual([]);
    expect(report.items.some((i) => i.id === 'content-intent')).toBe(true);
  });
});

describe('applySeoToProject change-set path', () => {
  it('applies the work-package change-set via shared scoped-apply and seals .umer/seo/', async () => {
    process.env.UMER_SEO_SKIP_LIGHTHOUSE = '1';
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-apply-cs-'));
    try {
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(
        join(dir, 'public', 'robots.txt'),
        'User-agent: *\nAllow: /\n',
        'utf8',
      );
      await writeFile(
        join(dir, 'index.html'),
        [
          '<!doctype html><html><head>',
          '<title>Flow Tools Home Page</title>',
          '</head><body>',
          '<h1>Tools</h1>',
          '<img src="/assets/hero-banner.png">',
          '</body></html>',
        ].join('\n'),
        'utf8',
      );

      const project = fakeProject({ absolutePath: dir, seoLocalUrl: undefined });
      const audit = await runSeoAudit({
        project,
        goal: 'Apply mechanical SEO fixes from proposedDiff',
      });
      expect(audit.edits?.length).toBeGreaterThan(0);

      // Proposal must not have touched disk yet.
      expect(await readFile(join(dir, 'public', 'robots.txt'), 'utf8')).not.toContain('Sitemap:');

      const result = await applySeoToProject({
        project,
        audit,
        rationale: 'human gate Pass — change-set path',
      });

      expect(result.changeSetApplied).toBe(true);
      expect(result.patchedItemIds?.length).toBeGreaterThan(0);
      expect(await readFile(join(dir, 'public', 'robots.txt'), 'utf8')).toContain(
        'Sitemap: https://example.com/sitemap.xml',
      );
      expect(await readFile(join(dir, 'index.html'), 'utf8')).toContain('rel="canonical"');
      expect(await readFile(join(dir, 'index.html'), 'utf8')).toContain('name="description"');
      expect(await readFile(join(dir, '.umer', 'seo', 'PROPOSED_DIFF.patch'), 'utf8')).toContain(
        'diff --git',
      );
      expect(
        await readFile(join(dir, '.umer', 'seo', 'evidence', 'fix-change-set.json'), 'utf8'),
      ).toContain('public/robots.txt');
      const report = await readFile(join(dir, '.umer', 'seo', 'APPLY_REPORT.md'), 'utf8');
      expect(report).toContain('work-package change-set');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a stale change-set the same way eng scoped-apply does', async () => {
    process.env.UMER_SEO_SKIP_LIGHTHOUSE = '1';
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-stale-'));
    try {
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(join(dir, 'public', 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');
      await writeFile(
        join(dir, 'index.html'),
        '<!doctype html><html><head><title>Demo Site</title></head><body><h1>Hi</h1></body></html>',
        'utf8',
      );

      const project = fakeProject({ absolutePath: dir });
      const audit = await runSeoAudit({
        project,
        goal: 'Stale base must block apply',
      });
      expect(audit.edits?.length).toBeGreaterThan(0);

      await writeFile(
        join(dir, 'index.html'),
        '<!doctype html><html><head><title>Changed</title></head><body></body></html>',
        'utf8',
      );

      await expect(
        applySeoToProject({ project, audit, rationale: 'should fail stale' }),
      ).rejects.toThrow(/Stale|changed since/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
