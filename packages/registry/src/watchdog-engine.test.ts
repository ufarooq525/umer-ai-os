import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  WatchdogEngine,
  computeWatchdogFingerprint,
} from './watchdog-engine.js';
import type { ResolvedProject } from './types.js';

describe('WatchdogEngine', () => {
  it('computes deterministic fingerprints', () => {
    const fp1 = computeWatchdogFingerprint('security.watchdog', 'proj-1', 'dependency', 'package.json:lodash');
    const fp2 = computeWatchdogFingerprint('security.watchdog', 'proj-1', 'dependency', 'package.json:lodash');
    const fp3 = computeWatchdogFingerprint('security.watchdog', 'proj-1', 'dependency', 'package.json:express');

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1.length).toBe(32);
  });

  it('runs dependency watchdog probe detecting missing lockfile and wildcard dependencies', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wd-deps-test-'));
    try {
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-app',
            dependencies: {
              lodash: '*',
            },
          },
          null,
          2,
        ),
      );

      const engine = new WatchdogEngine();
      const project: ResolvedProject = {
        projectId: 'test-proj',
        name: 'Test Project',
        slug: 'test-proj',
        path: 'test-proj',
        status: 'active',
        category: 'digital-product',
        stack: ['node'],
        defaultSpecialists: ['eng.app-delivery'],
        constraints: [],
        tags: [],
        autoApplyEng: false,
        absolutePath: dir,
        onDisk: true,
      };

      const run = await engine.executeWatchRun({
        project,
        watchdogId: 'deps.watchdog',
        cadence: 'hourly',
      });

      expect(run.watchdogId).toBe('deps.watchdog');
      expect(run.outcome).toBe('findings_detected');
      expect(run.findingCount).toBeGreaterThanOrEqual(2);

      const missingLock = run.findings.find((f) => f.category === 'lockfile_missing');
      expect(missingLock).toBeDefined();
      expect(missingLock?.severity.tier).toBe('warning');

      const wildcard = run.findings.find((f) => f.category === 'wildcard_version');
      expect(wildcard).toBeDefined();
      expect(wildcard?.title).toContain('lodash');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('runs architecture and QA watchdog probes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wd-arch-qa-test-'));
    try {
      const engine = new WatchdogEngine();
      const project: ResolvedProject = {
        projectId: 'arch-qa-proj',
        name: 'Arch QA Project',
        slug: 'arch-qa-proj',
        path: 'arch-qa-proj',
        status: 'active',
        category: 'digital-product',
        stack: ['node'],
        defaultSpecialists: ['eng.app-delivery'],
        constraints: [],
        tags: [],
        autoApplyEng: false,
        absolutePath: dir,
        onDisk: true,
      };

      // QA probe on empty dir
      const qaRun = await engine.executeWatchRun({
        project,
        watchdogId: 'qa.watchdog',
      });
      expect(qaRun.outcome).toBe('findings_detected');
      expect(qaRun.findings[0]?.category).toBe('missing_test_suite');

      // Now create tests/ dir and re-run QA probe
      await mkdir(join(dir, 'tests'));
      const qaRunClean = await engine.executeWatchRun({
        project,
        watchdogId: 'qa.watchdog',
      });
      expect(qaRunClean.outcome).toBe('healthy');
      expect(qaRunClean.findingCount).toBe(0);

      // Arch probe on dir without README or MODULES.yaml
      const archRun = await engine.executeWatchRun({
        project,
        watchdogId: 'arch.watchdog',
      });
      expect(archRun.outcome).toBe('findings_detected');
      expect(archRun.findings[0]?.category).toBe('module_drift');

      // Now create README.md and re-run Arch probe
      await writeFile(join(dir, 'README.md'), '# Arch QA Project');
      const archRunClean = await engine.executeWatchRun({
        project,
        watchdogId: 'arch.watchdog',
      });
      expect(archRunClean.outcome).toBe('healthy');
      expect(archRunClean.findingCount).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
