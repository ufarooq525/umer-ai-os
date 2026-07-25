import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { collectQaRepoSignals, evaluateQaChecks } from './qa-verify.js';
import { runQaAudit } from './qa-audit.js';
import type { ResolvedProject } from './types.js';

function fakeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    projectId: 'demo',
    name: 'Demo',
    slug: 'demo',
    path: 'demo',
    status: 'active',
    category: 'client-task',
    stack: ['fullstack'],
    defaultSpecialists: ['qa.verify'],
    constraints: [],
    tags: [],
    absolutePath: '/tmp/demo',
    autoApplyEng: false,
    ...overrides,
  };
}

describe('qa verify signals', () => {
  it('detects phpunit + feature modules for school-like layout', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-qa-'));
    try {
      await mkdir(join(dir, 'tests', 'Feature', 'Fees'), { recursive: true });
      await mkdir(join(dir, 'tests', 'Feature', 'Security'), { recursive: true });
      await writeFile(join(dir, 'phpunit.xml'), '<phpunit/>', 'utf8');
      await writeFile(
        join(dir, 'tests', 'Feature', 'Security', 'StudentIdorTest.php'),
        '<?php',
        'utf8',
      );
      await mkdir(join(dir, 'frontend-spa'), { recursive: true });

      const signals = await collectQaRepoSignals(dir);
      expect(signals.hasPhpUnit).toBe(true);
      expect(signals.hasFeatureTests).toBe(true);
      expect(signals.hasFrontendSpa).toBe(true);
      expect(signals.schoolSecurityTests).toBe(true);
      expect(signals.schoolModuleTests).toContain('Fees');

      const audit = runQaAudit({
        project: fakeProject({ projectId: 'school-app', name: 'School App', absolutePath: dir }),
        goal: 'Full functional + NFR verification for school-app',
      });
      const checks = evaluateQaChecks(audit.items, signals);
      expect(checks.find((c) => c.itemId === 'reg-automated-suite')?.status).toBe('pass');
      expect(checks.find((c) => c.itemId === 'school-fees')?.status).toBe('pass');
      expect(checks.find((c) => c.itemId === 'school-idor')?.status).toBe('pass');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails automated suite when no test signals exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-qa-empty-'));
    try {
      const signals = await collectQaRepoSignals(dir);
      const audit = runQaAudit({
        project: fakeProject({ absolutePath: dir }),
        goal: 'Empty project QA scan',
      });
      const checks = evaluateQaChecks(audit.items, signals);
      expect(checks.find((c) => c.itemId === 'reg-automated-suite')?.status).toBe('fail');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
