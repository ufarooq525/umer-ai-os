import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { QaAuditItem } from './qa-audit.js';

export type QaCheckStatus = 'pass' | 'fail' | 'skipped' | 'patched';

export type QaCheckResult = {
  itemId: string;
  status: QaCheckStatus;
  evidence: string;
};

export type QaRepoSignals = {
  root: string;
  hasTestsDir: boolean;
  hasPhpUnit: boolean;
  hasPest: boolean;
  hasFeatureTests: boolean;
  hasUnitTests: boolean;
  hasPlaywright: boolean;
  hasCypress: boolean;
  hasVitest: boolean;
  hasFrontendSpa: boolean;
  hasGithubWorkflows: boolean;
  packageTestScript: boolean;
  composerTestScript: boolean;
  detectedCommands: string[];
  schoolSecurityTests: boolean;
  schoolModuleTests: string[];
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function listDirNames(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() || e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function collectQaRepoSignals(root: string): Promise<QaRepoSignals> {
  const testsDir = join(root, 'tests');
  const featureDir = join(testsDir, 'Feature');
  const unitDir = join(testsDir, 'Unit');
  const spaDir = join(root, 'frontend-spa');
  const workflowsDir = join(root, '.github', 'workflows');

  const hasTestsDir = await exists(testsDir);
  const hasPhpUnit =
    (await exists(join(root, 'phpunit.xml'))) || (await exists(join(root, 'phpunit.xml.dist')));
  const hasPest = await exists(join(root, 'Pest.php'));
  const hasFeatureTests = await exists(featureDir);
  const hasUnitTests = await exists(unitDir);
  const hasPlaywright =
    (await exists(join(root, 'playwright.config.ts'))) ||
    (await exists(join(root, 'playwright.config.js'))) ||
    (await exists(join(spaDir, 'playwright.config.ts'))) ||
    (await exists(join(spaDir, 'playwright.config.js')));
  const hasCypress =
    (await exists(join(root, 'cypress.config.ts'))) ||
    (await exists(join(root, 'cypress.config.js')));
  const hasVitest =
    (await exists(join(root, 'vitest.config.ts'))) ||
    (await exists(join(spaDir, 'vitest.config.ts')));
  const hasFrontendSpa = await exists(spaDir);
  const hasGithubWorkflows = await exists(workflowsDir);

  const pkg = await readJsonSafe(join(root, 'package.json'));
  const spaPkg = await readJsonSafe(join(spaDir, 'package.json'));
  const composer = await readJsonSafe(join(root, 'composer.json'));

  const pkgScripts = (pkg?.scripts ?? {}) as Record<string, string>;
  const spaScripts = (spaPkg?.scripts ?? {}) as Record<string, string>;
  const composerScripts = (composer?.scripts ?? {}) as Record<string, string>;
  const spaDevDeps = {
    ...((spaPkg?.dependencies ?? {}) as Record<string, string>),
    ...((spaPkg?.devDependencies ?? {}) as Record<string, string>),
  };
  const playwrightFromPkg = Boolean(spaDevDeps['@playwright/test'] || spaDevDeps.playwright);

  const packageTestScript = Boolean(
    pkgScripts.test ||
      pkgScripts['test:unit'] ||
      spaScripts.test ||
      spaScripts['test:e2e'],
  );
  const composerTestScript = Boolean(
    composerScripts.test || composerScripts['test:unit'] || composerScripts.phpunit,
  );

  const detectedCommands: string[] = [];
  if (composerTestScript) {
    detectedCommands.push(
      composerScripts.test
        ? 'composer test'
        : composerScripts.phpunit
          ? 'composer phpunit'
          : 'composer test:unit',
    );
  } else if (hasPhpUnit || hasPest) {
    detectedCommands.push(hasPest ? './vendor/bin/pest' : './vendor/bin/phpunit');
  }
  if (pkgScripts.test) detectedCommands.push('npm test');
  if (spaScripts['test:e2e']) detectedCommands.push('cd frontend-spa && npm run test:e2e');
  else if (spaScripts.test) detectedCommands.push('cd frontend-spa && npm test');
  if (hasPlaywright || playwrightFromPkg) {
    detectedCommands.push(
      hasFrontendSpa ? 'cd frontend-spa && npx playwright test' : 'npx playwright test',
    );
  }

  const featureNames = hasFeatureTests ? await listDirNames(featureDir) : [];
  const schoolModuleTests = featureNames.filter((n) =>
    /Attendance|Examination|Fees|StudentInfo|Security|Api/i.test(n),
  );
  const schoolSecurityTests =
    (await exists(join(featureDir, 'Security', 'StudentIdorTest.php'))) ||
    (await exists(join(featureDir, 'Security', 'MarksheetPdfIdorTest.php')));

  return {
    root,
    hasTestsDir,
    hasPhpUnit,
    hasPest,
    hasFeatureTests,
    hasUnitTests,
    hasPlaywright: hasPlaywright || playwrightFromPkg,
    hasCypress,
    hasVitest,
    hasFrontendSpa,
    hasGithubWorkflows,
    packageTestScript,
    composerTestScript,
    detectedCommands: [...new Set(detectedCommands)],
    schoolSecurityTests,
    schoolModuleTests,
  };
}

function pass(itemId: string, evidence: string): QaCheckResult {
  return { itemId, status: 'pass', evidence };
}

function fail(itemId: string, evidence: string): QaCheckResult {
  return { itemId, status: 'fail', evidence };
}

function skip(itemId: string, evidence: string): QaCheckResult {
  return { itemId, status: 'skipped', evidence };
}

export function evaluateQaChecks(
  items: QaAuditItem[],
  signals: QaRepoSignals | null,
): QaCheckResult[] {
  if (!signals) {
    return items.map((i) => skip(i.id, 'Project path unavailable — could not collect repo signals'));
  }

  return items.map((item) => {
    switch (item.id) {
      case 'reg-automated-suite':
        return signals.hasTestsDir ||
          signals.hasPhpUnit ||
          signals.hasPest ||
          signals.packageTestScript ||
          signals.hasPlaywright ||
          signals.hasVitest
          ? pass(
              item.id,
              `Suite signals: testsDir=${signals.hasTestsDir}, phpunit=${signals.hasPhpUnit}, pest=${signals.hasPest}, packageTest=${signals.packageTestScript}`,
            )
          : fail(item.id, 'No tests/, phpunit, pest, or package test script detected');

      case 'rel-ci-signal':
        return signals.hasGithubWorkflows ||
          signals.detectedCommands.length > 0 ||
          signals.composerTestScript ||
          signals.packageTestScript
          ? pass(
              item.id,
              signals.detectedCommands.length
                ? `Commands: ${signals.detectedCommands.join(', ')}`
                : 'CI workflows present',
            )
          : fail(item.id, 'No CI workflows or documented test command detected');

      case 'release-evidence':
        return skip(item.id, 'Evidence package written on apply — marked after gate Pass artifacts');

      case 'school-student-info':
        return signals.schoolModuleTests.some((n) => /StudentInfo/i.test(n))
          ? pass(item.id, 'tests/Feature/StudentInfo present')
          : fail(item.id, 'StudentInfo feature tests not found');

      case 'school-attendance':
        return signals.schoolModuleTests.some((n) => /Attendance/i.test(n))
          ? pass(item.id, 'tests/Feature/Attendance present')
          : fail(item.id, 'Attendance feature tests not found');

      case 'school-fees':
        return signals.schoolModuleTests.some((n) => /Fees/i.test(n))
          ? pass(item.id, 'tests/Feature/Fees present')
          : fail(item.id, 'Fees feature tests not found');

      case 'school-examination':
        return signals.schoolModuleTests.some((n) => /Examination/i.test(n))
          ? pass(item.id, 'tests/Feature/Examination present')
          : fail(item.id, 'Examination feature tests not found');

      case 'school-parent-api':
        return signals.schoolModuleTests.some((n) => /Api/i.test(n))
          ? pass(item.id, 'tests/Feature/Api present')
          : fail(item.id, 'Api feature tests not found');

      case 'school-idor':
        return signals.schoolSecurityTests
          ? pass(item.id, 'IDOR security feature tests present')
          : fail(item.id, 'Student/Marksheet IDOR tests not found');

      case 'school-spa-ui':
        return signals.hasFrontendSpa
          ? pass(item.id, 'frontend-spa directory present')
          : fail(item.id, 'frontend-spa not found');

      case 'sec-authz':
        return signals.schoolSecurityTests || signals.hasFeatureTests
          ? pass(
              item.id,
              signals.schoolSecurityTests
                ? 'Dedicated IDOR tests present'
                : 'Feature tests present — confirm authz coverage manually',
            )
          : skip(item.id, 'No automated authz signal — manual IDOR smoke required');

      case 'func-critical-paths':
      case 'func-negative':
        return signals.hasFeatureTests || signals.hasPlaywright || signals.hasCypress
          ? pass(
              item.id,
              signals.hasFeatureTests
                ? 'Feature tests directory present as functional coverage signal'
                : 'E2E tooling present',
            )
          : fail(item.id, 'No feature/e2e suite signal for functional coverage');

      case 'ui-primary-screens':
      case 'ui-responsive':
        return signals.hasFrontendSpa || signals.hasPlaywright || signals.hasCypress
          ? pass(
              item.id,
              signals.hasPlaywright || signals.hasCypress
                ? 'Browser automation config present'
                : 'Frontend app present — UI smoke still manual unless Playwright added',
            )
          : skip(item.id, 'No SPA/e2e signal — UI smoke remains manual');

      case 'a11y-basics':
      case 'perf-smoke':
      case 'rel-error-handling':
      case 'school-sensitive-data':
      case 'api-contract':
      case 'ui-design-system':
      case 'qa-priority':
        return skip(item.id, 'Requires runtime/manual verification beyond repo scan');

      default:
        return skip(item.id, 'No automated evaluator for this item yet');
    }
  });
}
