import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedProject } from './types.js';
import type { QaRepoSignals } from './qa-verify.js';
import type { QaApplyFileChange } from './qa-result-types.js';
import type { QaCheckResult } from './qa-verify.js';

export type QaRunKind = 'phpunit' | 'playwright';

export type QaCommandRun = {
  kind: QaRunKind;
  command: string;
  cwd: string;
  ran: boolean;
  skipped: boolean;
  skipReason?: string;
  exitCode: number | null;
  durationMs: number;
  stdoutPath?: string;
  stderrPath?: string;
  summary: string;
};

export type QaRunBundle = {
  skippedAll: boolean;
  skipReason?: string;
  runs: QaCommandRun[];
  files: QaApplyFileChange[];
};

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr: `${stderr}\ntimeout after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(err) });
    });
  });
}

/** Allowlist — reject anything that is not a known test runner invocation. */
export function isAllowedQaCommand(command: string): boolean {
  const c = command.trim().toLowerCase().replace(/\\/g, '/');
  if (!c || c.length > 240) return false;
  if (/[;&|`$<>]/.test(command) && !/^cd frontend-spa\s+&&\s+/i.test(command.trim())) {
    return false;
  }
  const patterns = [
    /^(\.\/)?vendor\/bin\/phpunit(\.bat)?(\s|$)/i,
    /^php\s+vendor\/bin\/phpunit(\s|$)/i,
    /^(\.\/)?vendor\/bin\/pest(\.bat)?(\s|$)/i,
    /^composer\s+(test|phpunit|test:unit)(\s|$)/i,
    /^npx\s+playwright\s+test(\s|$)/i,
    /^cd\s+frontend-spa\s+&&\s+npx\s+playwright\s+test(\s|$)/i,
    /^cd\s+frontend-spa\s+&&\s+npm\s+run\s+test:e2e(\s|$)/i,
    /^npm\s+run\s+test:e2e(\s|$)/i,
  ];
  return patterns.some((p) => p.test(c));
}

function timeoutMs(): number {
  const raw = process.env.UMER_QA_RUN_TIMEOUT_MS;
  const n = raw ? Number(raw) : DEFAULT_TIMEOUT_MS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function resolvePhpunitCommand(
  project: ResolvedProject,
  signals: QaRepoSignals,
): { command: string; cwd: string } | null {
  const preferred = project.qaTestCommand?.trim();
  if (preferred && isAllowedQaCommand(preferred)) {
    return { command: preferred, cwd: project.absolutePath };
  }
  for (const cmd of signals.detectedCommands) {
    if (/phpunit|pest|composer\s+test/i.test(cmd) && isAllowedQaCommand(cmd)) {
      return { command: cmd, cwd: project.absolutePath };
    }
  }
  if (signals.hasPhpUnit || signals.hasPest) {
    const cmd = signals.hasPest ? './vendor/bin/pest' : './vendor/bin/phpunit';
    if (isAllowedQaCommand(cmd)) return { command: cmd, cwd: project.absolutePath };
  }
  return null;
}

function resolvePlaywrightCommand(
  project: ResolvedProject,
  signals: QaRepoSignals,
): { command: string; cwd: string } | null {
  if (!signals.hasPlaywright) return null;
  const spaConfig = join(project.absolutePath, 'frontend-spa', 'playwright.config.ts');
  // Prefer SPA-local config when present (checked via signals root layout)
  if (signals.hasFrontendSpa) {
    const cmd = 'npx playwright test';
    return { command: cmd, cwd: join(project.absolutePath, 'frontend-spa') };
  }
  if (isAllowedQaCommand('npx playwright test')) {
    return { command: 'npx playwright test', cwd: project.absolutePath };
  }
  void spaConfig;
  return null;
}

const DEFAULT_EVIDENCE_REL_PREFIX = '.umer/qa/evidence';

async function writeLog(
  evidenceDir: string,
  evidenceRelPrefix: string,
  name: string,
  content: string,
): Promise<string> {
  const rel = `${evidenceRelPrefix}/${name}`;
  await writeFile(join(evidenceDir, name), content.slice(0, 500_000), 'utf8');
  return rel;
}

async function executeOne(input: {
  kind: QaRunKind;
  command: string;
  cwd: string;
  evidenceDir: string;
  evidenceRelPrefix: string;
  envExtra?: Record<string, string>;
}): Promise<{ run: QaCommandRun; files: QaApplyFileChange[] }> {
  const files: QaApplyFileChange[] = [];
  const started = Date.now();

  if (!(await exists(input.cwd))) {
    return {
      run: {
        kind: input.kind,
        command: input.command,
        cwd: input.cwd,
        ran: false,
        skipped: true,
        skipReason: `cwd missing: ${input.cwd}`,
        exitCode: null,
        durationMs: 0,
        summary: `${input.kind} skipped — cwd missing`,
      },
      files,
    };
  }

  if (input.kind === 'phpunit') {
    const vendorPhpunit = join(input.cwd, 'vendor', 'bin', 'phpunit');
    const vendorPest = join(input.cwd, 'vendor', 'bin', 'pest');
    const needsVendor =
      /vendor\/bin\/(phpunit|pest)/i.test(input.command.replace(/\\/g, '/')) ||
      /composer\s+(test|phpunit)/i.test(input.command);
    if (needsVendor && !(await exists(vendorPhpunit)) && !(await exists(vendorPest))) {
      return {
        run: {
          kind: input.kind,
          command: input.command,
          cwd: input.cwd,
          ran: false,
          skipped: true,
          skipReason: 'vendor/bin/phpunit (or pest) not found — run composer install first',
          exitCode: null,
          durationMs: 0,
          summary: 'phpunit skipped — vendor binaries missing',
        },
        files,
      };
    }
  }

  const prevEnv: Array<[string, string | undefined]> = [];
  if (input.envExtra) {
    for (const [k, v] of Object.entries(input.envExtra)) {
      prevEnv.push([k, process.env[k]]);
      process.env[k] = v;
    }
  }

  try {
    const result = await runCommand(input.command, input.cwd, timeoutMs());
    const durationMs = Date.now() - started;
    const stdoutPath = await writeLog(
      input.evidenceDir,
      input.evidenceRelPrefix,
      `${input.kind}-stdout.txt`,
      result.stdout || '(empty stdout)\n',
    );
    const stderrPath = await writeLog(
      input.evidenceDir,
      input.evidenceRelPrefix,
      `${input.kind}-stderr.txt`,
      result.stderr || '(empty stderr)\n',
    );
    files.push(
      {
        path: stdoutPath,
        action: 'created',
        note: `${input.kind} stdout`,
      },
      {
        path: stderrPath,
        action: 'created',
        note: `${input.kind} stderr`,
      },
    );

    const ok = result.code === 0;
    const summary = ok
      ? `${input.kind} passed (exit 0, ${durationMs}ms)`
      : `${input.kind} failed (exit ${result.code ?? 'timeout'}, ${durationMs}ms)`;

    const metaRel = `${input.evidenceRelPrefix}/${input.kind}-run.json`;
    await writeFile(
      join(input.evidenceDir, `${input.kind}-run.json`),
      `${JSON.stringify(
        {
          kind: input.kind,
          command: input.command,
          cwd: input.cwd,
          exitCode: result.code,
          durationMs,
          ok,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    files.push({ path: metaRel, action: 'created', note: `${input.kind} run metadata` });

    return {
      run: {
        kind: input.kind,
        command: input.command,
        cwd: input.cwd,
        ran: true,
        skipped: false,
        exitCode: result.code,
        durationMs,
        stdoutPath,
        stderrPath,
        summary,
      },
      files,
    };
  } finally {
    for (const [k, v] of prevEnv) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * Phase A/B: execute allowlisted PHPUnit and/or Playwright suites, seal logs under evidence/.
 * Skip with UMER_QA_SKIP_RUN=1 (unit tests / dry apply).
 *
 * `evidenceRelPrefix` only labels the reported paths — callers outside qa.verify
 * (eng.app-delivery seals under `.umer/eng/<runId>/evidence`) pass their own prefix.
 */
export async function runQaSuites(input: {
  project: ResolvedProject;
  signals: QaRepoSignals;
  evidenceDir: string;
  evidenceRelPrefix?: string;
}): Promise<QaRunBundle> {
  await mkdir(input.evidenceDir, { recursive: true });
  const evidenceRelPrefix = input.evidenceRelPrefix ?? DEFAULT_EVIDENCE_REL_PREFIX;

  if (process.env.UMER_QA_SKIP_RUN === '1') {
    return {
      skippedAll: true,
      skipReason: 'UMER_QA_SKIP_RUN=1',
      runs: [],
      files: [],
    };
  }

  const files: QaApplyFileChange[] = [];
  const runs: QaCommandRun[] = [];

  const phpunit = resolvePhpunitCommand(input.project, input.signals);
  if (phpunit) {
    if (!isAllowedQaCommand(phpunit.command)) {
      runs.push({
        kind: 'phpunit',
        command: phpunit.command,
        cwd: phpunit.cwd,
        ran: false,
        skipped: true,
        skipReason: 'command failed allowlist',
        exitCode: null,
        durationMs: 0,
        summary: 'phpunit skipped — command not allowlisted',
      });
    } else {
      const executed = await executeOne({
        kind: 'phpunit',
        command: phpunit.command,
        cwd: phpunit.cwd,
        evidenceDir: input.evidenceDir,
        evidenceRelPrefix,
      });
      runs.push(executed.run);
      files.push(...executed.files);
    }
  }

  const skipPw = process.env.UMER_QA_SKIP_PLAYWRIGHT === '1';
  const playwright = resolvePlaywrightCommand(input.project, input.signals);
  if (playwright && !skipPw) {
    if (!isAllowedQaCommand(playwright.command)) {
      runs.push({
        kind: 'playwright',
        command: playwright.command,
        cwd: playwright.cwd,
        ran: false,
        skipped: true,
        skipReason: 'command failed allowlist',
        exitCode: null,
        durationMs: 0,
        summary: 'playwright skipped — command not allowlisted',
      });
    } else {
      const baseURL =
        process.env.PLAYWRIGHT_BASE_URL ||
        input.project.qaLocalUrl ||
        process.env.UMER_QA_BASE_URL ||
        '';
      const executed = await executeOne({
        kind: 'playwright',
        command: playwright.command,
        cwd: playwright.cwd,
        evidenceDir: input.evidenceDir,
        evidenceRelPrefix,
        envExtra: baseURL ? { PLAYWRIGHT_BASE_URL: baseURL } : undefined,
      });
      runs.push(executed.run);
      files.push(...executed.files);
    }
  } else if (playwright && skipPw) {
    runs.push({
      kind: 'playwright',
      command: playwright.command,
      cwd: playwright.cwd,
      ran: false,
      skipped: true,
      skipReason: 'UMER_QA_SKIP_PLAYWRIGHT=1',
      exitCode: null,
      durationMs: 0,
      summary: 'playwright skipped by env',
    });
  }

  if (runs.length === 0) {
    return {
      skippedAll: true,
      skipReason: 'No allowlisted phpunit/playwright command resolved',
      runs,
      files,
    };
  }

  return { skippedAll: false, runs, files };
}

/** Merge suite exit codes into checklist statuses. */
export function mergeQaRunIntoChecks(
  checks: QaCheckResult[],
  bundle: QaRunBundle,
): QaCheckResult[] {
  const php = bundle.runs.find((r) => r.kind === 'phpunit');
  const pw = bundle.runs.find((r) => r.kind === 'playwright');

  return checks.map((c) => {
    if (php?.ran && php.exitCode === 0) {
      if (
        c.itemId === 'reg-automated-suite' ||
        c.itemId === 'func-critical-paths' ||
        c.itemId === 'func-negative' ||
        (c.itemId.startsWith('school-') &&
          c.itemId !== 'school-spa-ui' &&
          c.itemId !== 'school-sensitive-data') ||
        c.itemId === 'sec-authz' ||
        c.itemId === 'school-idor'
      ) {
        return {
          ...c,
          status: 'pass',
          evidence: `${c.evidence} · ${php.summary}`,
        };
      }
    }
    if (php?.ran && php.exitCode !== 0 && php.exitCode !== null) {
      if (c.itemId === 'reg-automated-suite' || c.itemId === 'func-critical-paths') {
        return {
          ...c,
          status: 'fail',
          evidence: `${php.summary} — see ${php.stdoutPath ?? 'phpunit logs'}`,
        };
      }
    }

    if (pw?.ran && pw.exitCode === 0) {
      if (
        c.itemId === 'ui-primary-screens' ||
        c.itemId === 'ui-responsive' ||
        c.itemId === 'school-spa-ui'
      ) {
        return {
          ...c,
          status: 'pass',
          evidence: `${c.evidence} · ${pw.summary}`,
        };
      }
    }
    if (pw?.ran && pw.exitCode !== 0 && pw.exitCode !== null) {
      if (c.itemId === 'ui-primary-screens' || c.itemId === 'school-spa-ui') {
        return {
          ...c,
          status: 'fail',
          evidence: `${pw.summary} — see ${pw.stdoutPath ?? 'playwright logs'}`,
        };
      }
    }

    return c;
  });
}
