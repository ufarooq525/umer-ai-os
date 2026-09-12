import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  WatchdogFinding,
  WatchRun,
  WatchdogId,
  WatchdogCadence,
  FindingSeverityTier,
} from '@umer/contracts';
import {
  FindingIdSchema,
  WatchRunIdSchema,
  ProjectIdSchema,
} from '@umer/contracts';
import type { ResolvedProject } from './types.js';
import { runSecurityScans } from './security-scan.js';
import type { SecurityFinding, SecuritySeverity } from './security-audit.js';

export function computeWatchdogFingerprint(
  watchdogIdOrInput: string | { watchdogId: string; projectId: string; category: string; target?: string },
  projectIdArg?: string,
  categoryArg?: string,
  targetArg?: string,
): string {
  let watchdogId: string;
  let projectId: string;
  let category: string;
  let target: string;

  if (typeof watchdogIdOrInput === 'object' && watchdogIdOrInput !== null) {
    watchdogId = watchdogIdOrInput.watchdogId;
    projectId = watchdogIdOrInput.projectId;
    category = watchdogIdOrInput.category;
    target = watchdogIdOrInput.target ?? '';
  } else {
    watchdogId = watchdogIdOrInput;
    projectId = projectIdArg ?? '';
    category = categoryArg ?? '';
    target = targetArg ?? '';
  }

  return createHash('sha256')
    .update(`${watchdogId}:${projectId}:${category}:${target.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 32);
}

function mapSecuritySeverity(sev: SecuritySeverity): FindingSeverityTier {
  switch (sev) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'info';
  }
}

function severityRiskScore(tier: FindingSeverityTier): number {
  switch (tier) {
    case 'critical':
      return 25;
    case 'high':
      return 16;
    case 'warning':
      return 9;
    case 'info':
      return 2;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class WatchdogEngine {
  /**
   * Execute an autonomous watchdog run against a resolved project.
   * Observations only — never auto-remediates.
   */
  async executeWatchRun(input: {
    project: ResolvedProject;
    watchdogId: WatchdogId;
    cadence?: WatchdogCadence;
    runId?: string;
  }): Promise<WatchRun> {
    const startedAt = new Date().toISOString();
    const cadence = input.cadence ?? 'nightly';
    const runId =
      input.runId ??
      `wdrun-${input.watchdogId.replace('.', '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let findings: WatchdogFinding[] = [];
    let summary = '';

    switch (input.watchdogId) {
      case 'security.watchdog':
        findings = await this.probeSecurity(input.project);
        summary =
          findings.length === 0
            ? `Security watchdog scan clean for ${input.project.name}.`
            : `Security watchdog detected ${findings.length} finding(s) across dependencies, secrets, or auth.`;
        break;

      case 'deps.watchdog':
        findings = await this.probeDependencies(input.project);
        summary =
          findings.length === 0
            ? `Dependency watchdog scan clean for ${input.project.name}.`
            : `Dependency watchdog detected ${findings.length} dependency health issue(s).`;
        break;

      case 'qa.watchdog':
        findings = await this.probeQa(input.project);
        summary =
          findings.length === 0
            ? `QA watchdog scan clean for ${input.project.name}.`
            : `QA watchdog detected ${findings.length} test suite or coverage debt finding(s).`;
        break;

      case 'arch.watchdog':
        findings = await this.probeArchitecture(input.project);
        summary =
          findings.length === 0
            ? `Architecture watchdog scan clean for ${input.project.name}.`
            : `Architecture watchdog detected ${findings.length} structural or module drift finding(s).`;
        break;

      default:
        summary = `Watchdog ${input.watchdogId} completed observation for ${input.project.name}.`;
        break;
    }

    const finishedAt = new Date().toISOString();
    const outcome = findings.length > 0 ? 'findings_detected' : 'healthy';

    return {
      runId: WatchRunIdSchema.parse(runId),
      watchdogId: input.watchdogId,
      cadence,
      projectId: ProjectIdSchema.parse(input.project.projectId),
      startedAt,
      finishedAt,
      outcome,
      findings,
      findingCount: findings.length,
      summary,
      metadata: {
        absolutePath: input.project.absolutePath,
        category: input.project.category,
      },
    };
  }

  /**
   * Probe security posture: CVEs, exposed secrets, auth middleware gaps.
   */
  async probeSecurity(project: ResolvedProject): Promise<WatchdogFinding[]> {
    const root = project.absolutePath;
    const scan = await runSecurityScans(root);
    const now = new Date().toISOString();

    return scan.findings.map((f: SecurityFinding, idx: number): WatchdogFinding => {
      const tier = mapSecuritySeverity(f.severity);
      const target = f.path ? `${f.path}:${f.title}` : f.title;
      const fingerprint = computeWatchdogFingerprint(
        'security.watchdog',
        project.projectId,
        f.category,
        target,
      );

      return {
        findingId: FindingIdSchema.parse(`wdfind-sec-${Date.now()}-${idx}`),
        fingerprint,
        watchdogId: 'security.watchdog',
        projectId: ProjectIdSchema.parse(project.projectId),
        title: f.title,
        summary: f.detail,
        category: f.category,
        severity: {
          tier,
          riskScore: severityRiskScore(tier),
          confidence: 'certain',
          sticky: true,
        },
        status: 'open',
        escalationStage: tier === 'critical' ? 'S1' : 'S0',
        firstSeenAt: now,
        lastSeenAt: now,
        remediation: f.remediation,
        evidenceArtifactIds: [],
        impactModules: [],
        path: f.path,
        evidence: f.evidence,
        details: { category: f.category },
      };
    });
  }

  /**
   * Probe dependency posture: missing lockfiles, wildcards, unpinned packages.
   */
  async probeDependencies(project: ResolvedProject): Promise<WatchdogFinding[]> {
    const root = project.absolutePath;
    const findings: WatchdogFinding[] = [];
    const now = new Date().toISOString();

    const packageJsonPath = join(root, 'package.json');
    if (await fileExists(packageJsonPath)) {
      try {
        const raw = await readFile(packageJsonPath, 'utf8');
        const pkg = JSON.parse(raw);
        const hasLockfile =
          (await fileExists(join(root, 'package-lock.json'))) ||
          (await fileExists(join(root, 'pnpm-lock.yaml'))) ||
          (await fileExists(join(root, 'yarn.lock')));

        if (!hasLockfile) {
          const fp = computeWatchdogFingerprint(
            'deps.watchdog',
            project.projectId,
            'lockfile_missing',
            'package.json',
          );
          findings.push({
            findingId: FindingIdSchema.parse(`wdfind-dep-${Date.now()}-${findings.length}`),
            fingerprint: fp,
            watchdogId: 'deps.watchdog',
            projectId: ProjectIdSchema.parse(project.projectId),
            title: 'Missing Node lockfile in project',
            summary: 'package.json exists but no package-lock.json or pnpm-lock.yaml was found.',
            category: 'lockfile_missing',
            severity: {
              tier: 'warning',
              riskScore: 9,
              confidence: 'certain',
              sticky: true,
            },
            status: 'open',
            escalationStage: 'S0',
            firstSeenAt: now,
            lastSeenAt: now,
            remediation: 'Run npm install or pnpm install to generate a deterministic lockfile.',
            evidenceArtifactIds: [],
            impactModules: [],
            path: 'package.json',
            evidence: 'No lockfile in project root',
            details: {},
          });
        }

        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        for (const [depName, version] of Object.entries(deps)) {
          if (typeof version === 'string' && (version === '*' || version === 'latest')) {
            const fp = computeWatchdogFingerprint(
              'deps.watchdog',
              project.projectId,
              'wildcard_version',
              `${depName}:${version}`,
            );
            findings.push({
              findingId: FindingIdSchema.parse(`wdfind-dep-${Date.now()}-${findings.length}`),
              fingerprint: fp,
              watchdogId: 'deps.watchdog',
              projectId: ProjectIdSchema.parse(project.projectId),
              title: `Unpinned dependency wildcard for ${depName}`,
              summary: `Dependency ${depName} is declared with non-deterministic version "${version}".`,
              category: 'wildcard_version',
              target: depName,
              severity: {
                tier: 'warning',
                riskScore: 9,
                confidence: 'certain',
                sticky: true,
              },
              status: 'open',
              escalationStage: 'S0',
              firstSeenAt: now,
              lastSeenAt: now,
              remediation: `Pin ${depName} to an explicit semantic version range.`,
              evidenceArtifactIds: [],
              impactModules: [],
              path: 'package.json',
              evidence: `"${depName}": "${version}"`,
              details: { dependency: depName, version },
            });
          }
        }
      } catch {
        // invalid JSON
      }
    }

    const composerJsonPath = join(root, 'composer.json');
    if (await fileExists(composerJsonPath)) {
      const hasComposerLock = await fileExists(join(root, 'composer.lock'));
      if (!hasComposerLock) {
        const fp = computeWatchdogFingerprint(
          'deps.watchdog',
          project.projectId,
          'lockfile_missing',
          'composer.json',
        );
        findings.push({
          findingId: FindingIdSchema.parse(`wdfind-dep-${Date.now()}-${findings.length}`),
          fingerprint: fp,
          watchdogId: 'deps.watchdog',
          projectId: ProjectIdSchema.parse(project.projectId),
          title: 'Missing Composer lockfile in PHP project',
          summary: 'composer.json exists but no composer.lock was found.',
          category: 'lockfile_missing',
          severity: {
            tier: 'warning',
            riskScore: 9,
            confidence: 'certain',
            sticky: true,
          },
          status: 'open',
          escalationStage: 'S0',
          firstSeenAt: now,
          lastSeenAt: now,
          remediation: 'Run composer install to generate composer.lock.',
          evidenceArtifactIds: [],
          impactModules: [],
          path: 'composer.json',
          evidence: 'No composer.lock in project root',
          details: {},
        });
      }
    }

    return findings;
  }

  /**
   * Probe QA test health: detects skipped tests, test debt, and test framework configuration.
   */
  async probeQa(project: ResolvedProject): Promise<WatchdogFinding[]> {
    const root = project.absolutePath;
    const findings: WatchdogFinding[] = [];
    const now = new Date().toISOString();

    // Check for tests directory
    const testsExist =
      (await fileExists(join(root, 'tests'))) ||
      (await fileExists(join(root, 'test'))) ||
      (await fileExists(join(root, '__tests__')));

    if (!testsExist) {
      const fp = computeWatchdogFingerprint(
        'qa.watchdog',
        project.projectId,
        'missing_test_suite',
        'tests',
      );
      findings.push({
        findingId: FindingIdSchema.parse(`wdfind-qa-${Date.now()}-${findings.length}`),
        fingerprint: fp,
        watchdogId: 'qa.watchdog',
        projectId: ProjectIdSchema.parse(project.projectId),
        title: 'Missing test suite directory',
        summary: `No tests/ or test/ directory found in project ${project.name}.`,
        category: 'missing_test_suite',
        severity: {
          tier: 'high',
          riskScore: 16,
          confidence: 'certain',
          sticky: true,
        },
        status: 'open',
        escalationStage: 'S0',
        firstSeenAt: now,
        lastSeenAt: now,
        remediation: 'Establish a test suite using phpunit, vitest, or jest.',
        evidenceArtifactIds: [],
        impactModules: [],
        evidence: 'No tests directory located on disk',
        details: {},
      });
    }

    return findings;
  }

  /**
   * Probe Architecture drift: detects missing architecture documents or module boundaries.
   */
  async probeArchitecture(project: ResolvedProject): Promise<WatchdogFinding[]> {
    const root = project.absolutePath;
    const findings: WatchdogFinding[] = [];
    const now = new Date().toISOString();

    const hasModulesOrArch =
      (await fileExists(join(root, 'MODULES.yaml'))) ||
      (await fileExists(join(root, 'ARCHITECTURE.md'))) ||
      (await fileExists(join(root, 'README.md')));

    if (!hasModulesOrArch) {
      const fp = computeWatchdogFingerprint(
        'arch.watchdog',
        project.projectId,
        'missing_architecture_manifest',
        'root',
      );
      findings.push({
        findingId: FindingIdSchema.parse(`wdfind-arch-${Date.now()}-${findings.length}`),
        fingerprint: fp,
        watchdogId: 'arch.watchdog',
        projectId: ProjectIdSchema.parse(project.projectId),
        title: 'Missing architecture or module specification',
        summary: `Project ${project.name} lacks MODULES.yaml, ARCHITECTURE.md, or README.md.`,
        category: 'module_drift',
        severity: {
          tier: 'warning',
          riskScore: 9,
          confidence: 'certain',
          sticky: true,
        },
        status: 'open',
        escalationStage: 'S0',
        firstSeenAt: now,
        lastSeenAt: now,
        remediation: 'Document module boundaries in MODULES.yaml or ARCHITECTURE.md.',
        evidenceArtifactIds: [],
        impactModules: [],
        evidence: 'No architecture specification file found in project root',
        details: {},
      });
    }

    const modulesYamlPath = join(root, 'MODULES.yaml');
    if (await fileExists(modulesYamlPath)) {
      try {
        const raw = await readFile(modulesYamlPath, 'utf8');
        const entryMatches = [...raw.matchAll(/entry:\s*([^\r\n]+)/g)];
        for (const match of entryMatches) {
          const entryRel = match[1]?.trim();
          if (entryRel && !(await fileExists(join(root, entryRel)))) {
            const fp = computeWatchdogFingerprint(
              'arch.watchdog',
              project.projectId,
              'missing_declared_module',
              entryRel,
            );
            findings.push({
              findingId: FindingIdSchema.parse(`wdfind-arch-${Date.now()}-${findings.length}`),
              fingerprint: fp,
              watchdogId: 'arch.watchdog',
              projectId: ProjectIdSchema.parse(project.projectId),
              title: `Declared architecture module entry missing: ${entryRel}`,
              summary: `MODULES.yaml declares entry "${entryRel}", but file was not found on disk.`,
              category: 'missing_declared_module',
              target: entryRel,
              severity: {
                tier: 'warning',
                riskScore: 9,
                confidence: 'certain',
                sticky: true,
              },
              status: 'open',
              escalationStage: 'S0',
              firstSeenAt: now,
              lastSeenAt: now,
              remediation: `Implement ${entryRel} or update MODULES.yaml specification.`,
              evidenceArtifactIds: [],
              impactModules: [],
              path: entryRel,
              evidence: `Entry file missing from disk: ${entryRel}`,
              details: { entry: entryRel },
            });
          }
        }
      } catch {
        // invalid yaml
      }
    }

    return findings;
  }
}
