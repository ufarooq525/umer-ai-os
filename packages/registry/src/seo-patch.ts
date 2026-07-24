import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedProject } from './types.js';
import type { SeoApplyFileChange } from './seo-result-types.js';
import type { SeoCheckResult } from './seo-verify.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe, additive patches only — never rewrite mature seo.ts / large templates.
 */
export async function applySafeSeoPatches(input: {
  project: ResolvedProject;
  checks: SeoCheckResult[];
}): Promise<{ files: SeoApplyFileChange[]; patchedItemIds: string[] }> {
  const files: SeoApplyFileChange[] = [];
  const patchedItemIds: string[] = [];
  const root = input.project.absolutePath;
  const failed = new Set(input.checks.filter((c) => c.status === 'fail').map((c) => c.itemId));

  if (input.project.projectId === 'flow-tool-works') {
    const sitemapPath = join(root, 'public', 'sitemap.xml');
    if (await exists(sitemapPath)) {
      const raw = await readFile(sitemapPath, 'utf8');
      const today = new Date().toISOString().slice(0, 10);
      const updated = raw.replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${today}</lastmod>`);
      if (updated !== raw) {
        await writeFile(sitemapPath, updated, 'utf8');
        files.push({
          path: 'public/sitemap.xml',
          action: 'updated',
          note: `Auto-patch: bumped <lastmod> to ${today}`,
        });
        patchedItemIds.push('tech-sitemap');
      }
    }

    const robotsPath = join(root, 'public', 'robots.txt');
    if (await exists(robotsPath)) {
      let robots = await readFile(robotsPath, 'utf8');
      if (!/sitemap:/i.test(robots)) {
        robots = `${robots.trimEnd()}\n\nSitemap: https://toolworks.app/sitemap.xml\n`;
        await writeFile(robotsPath, robots, 'utf8');
        files.push({
          path: 'public/robots.txt',
          action: 'updated',
          note: 'Auto-patch: added Sitemap directive',
        });
        patchedItemIds.push('tech-robots');
      }
    }

    const indexPath = join(root, 'index.html');
    if (await exists(indexPath) && (failed.has('onpage-og') || failed.has('sd-jsonld'))) {
      let html = await readFile(indexPath, 'utf8');
      let changed = false;
      if (!/property=["']og:image["']/i.test(html)) {
        html = html.replace(
          '</head>',
          '  <meta property="og:image" content="https://toolworks.app/og-image.png" />\n</head>',
        );
        changed = true;
        patchedItemIds.push('onpage-og');
      }
      if (!/application\/ld\+json/i.test(html)) {
        html = html.replace(
          '</head>',
          `  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Tool Works","url":"https://toolworks.app/"}</script>\n</head>`,
        );
        changed = true;
        patchedItemIds.push('sd-jsonld');
      }
      if (changed) {
        await writeFile(indexPath, html, 'utf8');
        files.push({
          path: 'index.html',
          action: 'updated',
          note: 'Auto-patch: ensured OG/JSON-LD fallback tags',
        });
      }
    }
  }

  if (input.project.projectId === 'cursive-generator') {
    const robotsTs = join(root, 'src', 'app', 'robots.ts');
    if (await exists(robotsTs) && failed.has('tech-robots')) {
      const raw = await readFile(robotsTs, 'utf8');
      if (!/sitemap\s*:/i.test(raw)) {
        const next = `import { MetadataRoute } from 'next'\nimport { SITE_URL } from '@/lib/site'\n\nexport default function robots(): MetadataRoute.Robots {\n  return {\n    rules: { userAgent: '*', allow: '/' },\n    sitemap: \`\${SITE_URL}/sitemap.xml\`,\n  }\n}\n`;
        await writeFile(robotsTs, next, 'utf8');
        files.push({
          path: 'src/app/robots.ts',
          action: 'updated',
          note: 'Auto-patch: restored robots.ts with sitemap',
        });
        patchedItemIds.push('tech-robots');
      }
    }

    const patchNote = join(root, '.umer', 'seo', 'PATCH_NOTES.md');
    const note = [
      '# Cursive auto-patches',
      '',
      '- Live meta/OG/JSON-LD already managed by `src/lib/seo.ts` + `layout.tsx`.',
      '- Automatic code rewrites of those modules are disabled to avoid regressions.',
      '- Verify pipeline updates checklist statuses from the live/local URL.',
      '',
    ].join('\n');
    await writeFile(patchNote, note, 'utf8');
    files.push({
      path: '.umer/seo/PATCH_NOTES.md',
      action: 'created',
      note: 'Documents why cursive patches are verify-first (mature SEO codebase)',
    });
  }

  return { files, patchedItemIds: [...new Set(patchedItemIds)] };
}
