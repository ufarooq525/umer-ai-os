import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createProjectRegistry } from './registry.js';
import { planIntake } from './intake.js';
import { applySeoToProject } from './seo-apply.js';
import { applyQaToProject } from './qa-apply.js';
import { ProjectRegistryError } from './errors.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const catalogPath = join(repoRoot, 'projects', 'catalog.json');

describe('project registry', () => {
  it('loads all eight Laragon projects', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const projects = registry.list();
    expect(projects).toHaveLength(8);
  });

  it('resolves absolute path under projects root', async () => {
    const registry = await createProjectRegistry({
      catalogPath,
      env: { UMER_PROJECTS_ROOT: 'D:/apps' },
    });
    const nitro = registry.get('nitrotickets-new');
    expect(nitro.absolutePath.replace(/\\/g, '/')).toBe('D:/apps/nitrotickets-new');
  });

  it('plans PM intake for a known project', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const plan = planIntake(registry, {
      projectId: 'erpapi_v2',
      type: 'security',
      goal: 'Review auth middleware for IDOR on employee endpoints',
      doneWhen: 'Findings list with severity and remediation owners',
    });
    expect(plan.projectName).toBe('ERP API v2');
    expect(plan.recommendedSpecialists).toContain('security.review');
  });

  it('runs seo.audit checklist for cursive-generator', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const plan = planIntake(registry, {
      projectId: 'cursive-generator',
      type: 'seo',
      goal: 'Improve landing and share-page discoverability',
      doneWhen: 'P0 SEO items cleared and Lighthouse mobile reviewed',
    });
    expect(plan.seoAudit?.specialistId).toBe('seo.audit');
    expect(plan.seoAudit?.items.some((i) => i.id === 'cursive-share')).toBe(true);
  });

  it('runs seo.audit checklist for flow-tool-works', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const plan = planIntake(registry, {
      projectId: 'flow-tool-works',
      type: 'seo',
      goal: 'Make product landing pages indexable and keyword-clear',
    });
    expect(plan.seoAudit?.items.some((i) => i.id === 'flow-landing')).toBe(true);
  });

  it('runs qa.verify checklist for school-app', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const plan = planIntake(registry, {
      projectId: 'school-app',
      type: 'qa',
      goal: 'Full functional and non-functional UI verification for school-app',
      doneWhen: 'P0 QA items evidenced and .umer/qa sealed',
    });
    expect(plan.qaAudit?.specialistId).toBe('qa.verify');
    expect(plan.recommendedSpecialists).toContain('qa.verify');
    expect(plan.qaAudit?.items.some((i) => i.id === 'school-fees')).toBe(true);
    expect(plan.qaAudit?.items.some((i) => i.id === 'school-idor')).toBe(true);
    expect(plan.qaAudit?.items.some((i) => i.id === 'school-spa-ui')).toBe(true);
  });

  it('applies SEO package into a project folder on Pass', async () => {
    process.env.UMER_SEO_SKIP_LIGHTHOUSE = '1';
    const dir = await mkdtemp(join(tmpdir(), 'umer-seo-'));
    try {
      await mkdir(join(dir, 'public'), { recursive: true });
      await writeFile(
        join(dir, 'public', 'robots.txt'),
        'User-agent: *\nAllow: /\n',
        'utf8',
      );
      await writeFile(
        join(dir, 'public', 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc><lastmod>2020-01-01</lastmod></url>\n</urlset>\n`,
        'utf8',
      );
      await writeFile(
        join(dir, 'index.html'),
        `<!doctype html><html><head><title>Flow Tools Home Page</title><meta name="description" content="Free online developer tools for formatting, compression, and SEO workflows every day." /></head><body><h1>Tools</h1><a href="/tools">t</a><a href="/about">a</a><a href="/guides">g</a></body></html>`,
        'utf8',
      );

      const registry = await createProjectRegistry({ catalogPath });
      const base = registry.get('flow-tool-works');
      const project = {
        ...base,
        absolutePath: dir,
        seoBaseUrl: undefined,
        seoLocalUrl: undefined,
      };
      // Force no remote probe in unit test — file patches still run
      process.env.UMER_SEO_BASE_URL_FLOW_TOOL_WORKS = '';
      const plan = planIntake(registry, {
        projectId: 'flow-tool-works',
        type: 'seo',
        goal: 'Apply SEO package for testing',
      });
      const result = await applySeoToProject({
        project,
        audit: plan.seoAudit!,
        rationale: 'test apply',
      });
      expect(result.files.some((f) => f.path.includes('APPLY_REPORT.md'))).toBe(true);
      expect(result.checks?.length).toBeGreaterThan(0);
      const report = await readFile(join(dir, '.umer', 'seo', 'APPLY_REPORT.md'), 'utf8');
      expect(report).toContain('Automated checks');
      const sitemap = await readFile(join(dir, 'public', 'sitemap.xml'), 'utf8');
      expect(sitemap).not.toContain('2020-01-01');
      const robots = await readFile(join(dir, 'public', 'robots.txt'), 'utf8');
      expect(robots.toLowerCase()).toContain('sitemap:');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('applies QA package into a school-like project folder on Pass', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await mkdtemp(join(tmpdir(), 'umer-qa-apply-'));
    try {
      await mkdir(join(dir, 'tests', 'Feature', 'Attendance'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'Fees'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'Examination'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'StudentInfo'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'Api'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'Security'), { recursive: true });
      await writeFile(join(dir, 'phpunit.xml'), '<phpunit/>', 'utf8');
      await writeFile(
        join(dir, 'tests', 'Feature', 'Security', 'StudentIdorTest.php'),
        '<?php',
        'utf8',
      );
      await mkdir(join(dir, 'frontend-spa'), { recursive: true });

      const registry = await createProjectRegistry({ catalogPath });
      const base = registry.get('school-app');
      const project = { ...base, absolutePath: dir };
      const plan = planIntake(registry, {
        projectId: 'school-app',
        type: 'qa',
        goal: 'Apply QA package for testing',
      });
      const result = await applyQaToProject({
        project,
        audit: plan.qaAudit!,
        rationale: 'test qa apply',
      });
      expect(result.files.some((f) => f.path.includes('APPLY_REPORT.md'))).toBe(true);
      expect(result.files.some((f) => f.path.includes('TEST_PLAN.md'))).toBe(true);
      expect(result.checks?.length).toBeGreaterThan(0);
      expect(result.recommendedCommand).toBeTruthy();
      const report = await readFile(join(dir, '.umer', 'qa', 'APPLY_REPORT.md'), 'utf8');
      expect(report).toContain('Automated checks');
      const planMd = await readFile(join(dir, '.umer', 'qa', 'TEST_PLAN.md'), 'utf8');
      expect(planMd).toContain('school-fees');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects unknown project intake', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    expect(() =>
      planIntake(registry, {
        projectId: 'missing-app',
        type: 'feature',
        goal: 'Add something that does not exist yet',
      }),
    ).toThrow(ProjectRegistryError);
  });
});
