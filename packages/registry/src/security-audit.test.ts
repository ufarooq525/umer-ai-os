import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runSecurityAudit } from './security-audit.js';
import { applySecurityToProject } from './security-apply.js';
import { scanExposedSecrets, scanAuthPermissionGaps, isAllowedSecurityAuditCommand } from './security-scan.js';
import { decideSecurityGate, hasElevatedSecurityFindings } from './security-gate-policy.js';
import type { ResolvedProject } from './types.js';
import type { SecurityFinding } from './security-audit.js';

function fakeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    projectId: 'demo',
    name: 'Demo',
    slug: 'demo',
    path: 'demo',
    status: 'active',
    category: 'client-task',
    stack: ['fullstack'],
    defaultSpecialists: ['security.review'],
    constraints: [],
    tags: [],
    absolutePath: '/tmp/demo',
    autoApplyEng: false,
    ...overrides,
  };
}

async function seedDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'umer-sec-'));
}

afterEach(() => {
  delete process.env.UMER_SECURITY_SKIP_AUDIT;
});

describe('isAllowedSecurityAuditCommand', () => {
  it('allowlists npm/composer audit only', () => {
    expect(isAllowedSecurityAuditCommand('npm audit --json')).toBe(true);
    expect(isAllowedSecurityAuditCommand('composer audit --format=json')).toBe(true);
    expect(isAllowedSecurityAuditCommand('npm audit --json; rm -rf /')).toBe(false);
    expect(isAllowedSecurityAuditCommand('curl evil.com')).toBe(false);
  });
});

describe('decideSecurityGate', () => {
  const critical: SecurityFinding = {
    id: 'c1',
    category: 'secret',
    severity: 'critical',
    title: 'leak',
    detail: 'd',
    evidence: 'e',
    remediation: 'r',
  };
  const medium: SecurityFinding = {
    id: 'm1',
    category: 'auth',
    severity: 'medium',
    title: 'gap',
    detail: 'd',
    evidence: 'e',
    remediation: 'r',
  };

  it('forces human gate on critical/high for every category including digital-product', () => {
    for (const category of ['client-task', 'digital-product', 'seo-project'] as const) {
      const d = decideSecurityGate({ category, findings: [critical] });
      expect(d.humanRequired).toBe(true);
      expect(d.autoApply).toBe(false);
      expect(d.forcedBySeverity).toBe(true);
    }
    expect(hasElevatedSecurityFindings([critical])).toBe(true);
  });

  it('never auto-applies medium/low even on digital-product', () => {
    const d = decideSecurityGate({ category: 'digital-product', findings: [medium] });
    expect(d.humanRequired).toBe(true);
    expect(d.autoApply).toBe(false);
    expect(d.forcedBySeverity).toBe(false);
  });
});

describe('scanExposedSecrets', () => {
  it('flags committed .env and hardcoded key patterns', async () => {
    const dir = await seedDir();
    try {
      await writeFile(join(dir, '.env'), 'APP_KEY=base64:secret\n', 'utf8');
      await writeFile(
        join(dir, 'config.js'),
        "const api_key = 'sk_live_abcdefghijklmnopqrstuvwxyz';\n",
        'utf8',
      );
      const findings = await scanExposedSecrets(dir);
      expect(findings.some((f) => f.id.includes('secret-env'))).toBe(true);
      expect(findings.some((f) => f.category === 'secret' && f.severity === 'critical')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('scanAuthPermissionGaps', () => {
  it('flags unprotected routes when siblings use auth', async () => {
    const dir = await seedDir();
    try {
      await mkdir(join(dir, 'routes'), { recursive: true });
      await writeFile(
        join(dir, 'routes', 'api.php'),
        [
          '<?php',
          "Route::get('/login', [AuthController::class, 'login']);",
          "Route::get('/me', [UserController::class, 'me'])->middleware('auth');",
          "Route::get('/admin/users', [AdminController::class, 'users']);",
          '',
        ].join('\n'),
        'utf8',
      );
      const findings = await scanAuthPermissionGaps(dir);
      expect(findings.length).toBe(1);
      expect(findings[0]?.category).toBe('auth');
      expect(findings[0]?.evidence).toContain('/admin/users');
      expect(findings[0]?.evidence).not.toContain('/login');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('runSecurityAudit + applySecurityToProject', () => {
  it('produces report-only package and seals .umer/security/<runId>/', async () => {
    process.env.UMER_SECURITY_SKIP_AUDIT = '1';
    const dir = await seedDir();
    try {
      await writeFile(join(dir, '.env'), 'SECRET=1\n', 'utf8');
      await writeFile(join(dir, 'package.json'), '{"name":"demo"}\n', 'utf8');

      const project = fakeProject({
        absolutePath: dir,
        category: 'digital-product',
        autoApplyEng: true,
      });
      const report = await runSecurityAudit({
        project,
        goal: 'static security review before release',
        runId: 'sec-demo-test1',
      });

      expect(report.specialistId).toBe('security.review');
      expect(report.proposedDiff).toBe('');
      expect(report.forcesGate).toBe(true);
      expect(report.gateDecision.autoApply).toBe(false);
      expect(report.gateDecision.forcedBySeverity).toBe(true);
      expect(report.findings.some((f) => f.category === 'secret')).toBe(true);
      expect(report.findings.every((f) => f.severity && f.evidence && f.remediation)).toBe(true);

      const applied = await applySecurityToProject({
        project,
        report,
        rationale: 'reviewed critical env presence',
      });
      expect(applied.evidenceDir).toBe('.umer/security/sec-demo-test1');
      const findingsMd = await readFile(join(dir, '.umer', 'security', 'sec-demo-test1', 'FINDINGS.md'), 'utf8');
      expect(findingsMd).toContain('security.review');
      const findingsJson = JSON.parse(
        await readFile(join(dir, '.umer', 'security', 'sec-demo-test1', 'evidence', 'findings.json'), 'utf8'),
      ) as { forcesGate: boolean; findings: unknown[] };
      expect(findingsJson.forcesGate).toBe(true);
      expect(findingsJson.findings.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
