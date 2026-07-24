import { describe, expect, it } from 'vitest';
import { isAllowedQaCommand, mergeQaRunIntoChecks } from './qa-run.js';
import type { QaCheckResult } from './qa-verify.js';
import type { QaRunBundle } from './qa-run.js';

describe('qa-run allowlist', () => {
  it('allows phpunit / playwright invocations', () => {
    expect(isAllowedQaCommand('./vendor/bin/phpunit')).toBe(true);
    expect(isAllowedQaCommand('php vendor/bin/phpunit')).toBe(true);
    expect(isAllowedQaCommand('composer test')).toBe(true);
    expect(isAllowedQaCommand('npx playwright test')).toBe(true);
    expect(isAllowedQaCommand('cd frontend-spa && npx playwright test')).toBe(true);
  });

  it('rejects unsafe commands', () => {
    expect(isAllowedQaCommand('rm -rf /')).toBe(false);
    expect(isAllowedQaCommand('phpunit && curl evil.test')).toBe(false);
    expect(isAllowedQaCommand('npx playwright test; reboot')).toBe(false);
  });
});

describe('mergeQaRunIntoChecks', () => {
  it('marks functional items pass when phpunit exits 0', () => {
    const checks: QaCheckResult[] = [
      { itemId: 'reg-automated-suite', status: 'pass', evidence: 'suite present' },
      { itemId: 'func-critical-paths', status: 'pass', evidence: 'feature tests' },
      { itemId: 'school-spa-ui', status: 'pass', evidence: 'spa present' },
    ];
    const bundle: QaRunBundle = {
      skippedAll: false,
      runs: [
        {
          kind: 'phpunit',
          command: './vendor/bin/phpunit',
          cwd: '/tmp',
          ran: true,
          skipped: false,
          exitCode: 0,
          durationMs: 12,
          summary: 'phpunit passed (exit 0, 12ms)',
        },
      ],
      files: [],
    };
    const merged = mergeQaRunIntoChecks(checks, bundle);
    expect(merged.find((c) => c.itemId === 'func-critical-paths')?.evidence).toContain('phpunit passed');
    expect(merged.find((c) => c.itemId === 'school-spa-ui')?.evidence).not.toContain('phpunit passed');
  });

  it('marks UI items fail when playwright exits non-zero', () => {
    const checks: QaCheckResult[] = [
      { itemId: 'ui-primary-screens', status: 'skipped', evidence: 'manual' },
      { itemId: 'school-spa-ui', status: 'pass', evidence: 'spa' },
    ];
    const bundle: QaRunBundle = {
      skippedAll: false,
      runs: [
        {
          kind: 'playwright',
          command: 'npx playwright test',
          cwd: '/tmp/spa',
          ran: true,
          skipped: false,
          exitCode: 1,
          durationMs: 40,
          summary: 'playwright failed (exit 1, 40ms)',
          stdoutPath: '.umer/qa/evidence/playwright-stdout.txt',
        },
      ],
      files: [],
    };
    const merged = mergeQaRunIntoChecks(checks, bundle);
    expect(merged.find((c) => c.itemId === 'ui-primary-screens')?.status).toBe('fail');
    expect(merged.find((c) => c.itemId === 'school-spa-ui')?.status).toBe('fail');
  });
});
