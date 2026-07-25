import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runUxAudit } from './ux-audit.js';
import { applyUxToProject } from './ux-apply.js';
import type { ResolvedProject } from './types.js';

function fakeProject(root: string, overrides?: Partial<ResolvedProject>): ResolvedProject {
  return {
    projectId: 'demo-ux',
    name: 'Demo UX',
    slug: 'demo-ux',
    path: 'demo-ux',
    status: 'active',
    category: 'digital-product',
    stack: ['frontend'],
    defaultSpecialists: ['ux.design'],
    constraints: [],
    tags: [],
    absolutePath: root,
    autoApplyEng: false,
    ...overrides,
  };
}

describe('runUxAudit + applyUxToProject', () => {
  let roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((r) => rm(r, { recursive: true, force: true })));
    roots = [];
  });

  it('returns prioritized checklist items with empty proposedDiff', () => {
    const report = runUxAudit({
      project: fakeProject('/tmp/demo-ux'),
      goal: 'Audit navigation and hierarchy',
      doneWhen: 'P0 checklist ready for gate',
    });

    expect(report.specialistId).toBe('ux.design');
    expect(report.proposedDiff).toBe('');
    expect(report.runId).toMatch(/^ux-demo-ux-/);
    expect(report.items.length).toBeGreaterThan(10);
    expect(report.items.some((i) => i.priority === 'P0')).toBe(true);
    expect(report.items.some((i) => i.category === 'navigation')).toBe(true);
    expect(report.items.some((i) => i.category === 'accessibility')).toBe(true);
    expect(report.summary).toContain('Demo UX');
    expect(report.nextActions.some((a) => a.includes('eng.app-delivery'))).toBe(true);
  });

  it('adds portfolio extras for umer-portfolio / portfolio tag', () => {
    const report = runUxAudit({
      project: fakeProject('/tmp/portfolio', {
        projectId: 'umer-portfolio',
        name: 'Umer Portfolio',
        category: 'seo-project',
        tags: ['portfolio', 'seo', 'marketing'],
      }),
      goal: 'UI/UX audit + improve',
    });

    expect(report.items.some((i) => i.id === 'portfolio-hero')).toBe(true);
    expect(report.items.some((i) => i.id === 'portfolio-gallery')).toBe(true);
    expect(report.items.some((i) => i.id === 'seo-hero-message')).toBe(true);
  });

  it('seals FINDINGS.md / APPLY_REPORT.md / last-apply.json under .umer/ux/<runId>/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'umer-ux-'));
    roots.push(root);

    const report = runUxAudit({
      project: fakeProject(root),
      goal: 'Seal UX evidence package',
    });

    const result = await applyUxToProject({
      project: fakeProject(root),
      report,
      rationale: 'Approved UX checklist for handoff',
    });

    expect(result.evidenceDir).toBe(`.umer/ux/${report.runId}`);
    expect(result.itemCount).toBe(report.items.length);
    expect(result.files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        `.umer/ux/${report.runId}/FINDINGS.md`,
        `.umer/ux/${report.runId}/APPLY_REPORT.md`,
        `.umer/ux/${report.runId}/last-apply.json`,
      ]),
    );

    const findings = await readFile(join(root, '.umer', 'ux', report.runId, 'FINDINGS.md'), 'utf8');
    expect(findings).toContain('ux.design');
    expect(findings).toContain('Report-only');

    const lastApply = JSON.parse(
      await readFile(join(root, '.umer', 'ux', report.runId, 'last-apply.json'), 'utf8'),
    ) as { specialistId: string; proposedDiff: string; itemCount: number };
    expect(lastApply.specialistId).toBe('ux.design');
    expect(lastApply.proposedDiff).toBe('');
    expect(lastApply.itemCount).toBe(report.items.length);
  });
});
