import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { runSecurityAudit, type ResolvedProject } from '../../packages/registry/src/index.js';

function runCommand(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += String(d)));
    child.stderr?.on('data', (d) => (stderr += String(d)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: String(err) }));
  });
}

/**
 * Live proof of Security verification — a real, unmocked
 * `npm audit --json` run (packages/registry/src/security-scan.ts's
 * scanDependencyVulnerabilities), not the UMER_SECURITY_SKIP_AUDIT=1 path
 * every existing security-audit.test.ts case uses.
 *
 * The fixture installs a deliberately outdated package
 * (minimist@0.0.8, a known prototype-pollution CVE) so this proves the
 * full detection path for real: real `npm install`, real `npm audit
 * --json`, real JSON parsing into severity-tagged SecurityFinding
 * records — not a fabricated "clean" report. If npm audit is genuinely
 * unavailable in this environment, the assertions below fail loudly
 * rather than silently passing, matching this mission's "return BLOCKED
 * truthfully, never fabricate a clean report" rule.
 *
 * security.review is an LLM-driven specialist like qa.verify (not in
 * agent-runtime's DETERMINISTIC_SPECIALISTS); its live NATS dispatch ->
 * Agent Worker -> Agent Run -> sealed SecurityReport artifact path is the
 * same generic mechanism already proven live for Product
 * (live-runtime-smoke.test.ts) and QA (live-qa-smoke.test.ts) — not
 * duplicated here. This test instead proves the piece those two do not
 * cover: the actual dependency vulnerability SCAN security.review's
 * report is grounded in, exercised through the exact same
 * runSecurityAudit used by apps/control-api/src/state.ts's
 * applySecurityOnGatePass.
 */
describe('Live Security Smoke Test (real npm audit — no skip flag)', () => {
  let fixtureRoot = '';
  const previousSkip = process.env.UMER_SECURITY_SKIP_AUDIT;

  afterEach(async () => {
    if (previousSkip === undefined) delete process.env.UMER_SECURITY_SKIP_AUDIT;
    else process.env.UMER_SECURITY_SKIP_AUDIT = previousSkip;
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = '';
    }
  });

  it(
    'runs a real npm audit against a deliberately vulnerable dependency and surfaces genuine findings',
    async () => {
      delete process.env.UMER_SECURITY_SKIP_AUDIT;

      fixtureRoot = await mkdtemp(join(tmpdir(), 'umer-security-fixture-'));
      await writeFile(
        join(fixtureRoot, 'package.json'),
        JSON.stringify(
          {
            name: 'umer-disposable-security-fixture',
            private: true,
            version: '1.0.0',
            dependencies: {
              // Deliberately outdated — known prototype-pollution advisory
              // (GHSA-vh95-rmgr-6w4m / CVE-2020-7598 family). The point is
              // to prove npm audit runs for real and finds a real advisory,
              // not to exercise a specific CVE.
              minimist: '0.0.8',
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      const install = await runCommand('npm', ['install', '--no-audit', '--no-fund', '--silent'], fixtureRoot);
      if (install.code !== 0) {
        throw new Error(`Fixture setup failed: npm install exited ${install.code}\n${install.stderr}`);
      }

      const project: ResolvedProject = {
        projectId: 'proj-security-smoke',
        name: 'Security Smoke Fixture',
        slug: 'proj-security-smoke',
        path: fixtureRoot,
        absolutePath: fixtureRoot,
        status: 'active',
        category: 'digital-product',
        stack: ['node'],
        defaultSpecialists: ['security.review'],
        constraints: [],
        tags: [],
        autoApplyEng: false,
        onDisk: true,
      };

      const report = await runSecurityAudit({
        project,
        goal: 'Live security smoke: real npm audit against a known-vulnerable dependency',
        runId: 'security-smoke-run',
      });

      // Real evidence: the dependency audit command actually ran (not
      // skipped), and it actually found the real, known advisory.
      expect(report.dependencyCommandsRan, `dependencySkipped was: ${JSON.stringify(report.dependencyCommandsSkipped)}`).toContain('npm audit --json');
      expect(report.dependencyCommandsSkipped).not.toContain('UMER_SECURITY_SKIP_AUDIT=1');

      const depFindings = report.findings.filter((f) => f.category === 'dependency');
      expect(
        depFindings.length,
        `expected at least one real npm-audit finding; full findings: ${JSON.stringify(report.findings, null, 2)}`,
      ).toBeGreaterThan(0);
      const minimistFinding = depFindings.find((f) => f.evidence.toLowerCase().includes('minimist'));
      expect(minimistFinding, `expected a minimist finding among: ${JSON.stringify(depFindings, null, 2)}`).toBeDefined();
      expect(['critical', 'high', 'medium']).toContain(minimistFinding!.severity);
      expect(minimistFinding!.remediation.length).toBeGreaterThan(0);

      // Real severity counting and gate decision, not fabricated.
      expect(report.severityCounts.critical + report.severityCounts.high + report.severityCounts.medium).toBeGreaterThan(0);
      expect(report.summary).toContain('finding');
    },
    120000,
  );
});
