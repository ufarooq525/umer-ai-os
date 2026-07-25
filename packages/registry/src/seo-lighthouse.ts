import { spawn } from 'node:child_process';
import { access, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export type LighthouseEvidence = {
  ran: boolean;
  lcpOk: boolean | null;
  clsOk: boolean | null;
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  fidMs: number | null;
  tbtMs: number | null;
  note: string;
  reportPath?: string;
  /** Parsed Lighthouse JSON; perf keeps this in-memory until gate Pass seals evidence. */
  report?: Record<string, unknown>;
};

function emptyEvidence(note: string): LighthouseEvidence {
  return {
    ran: false,
    lcpOk: null,
    clsOk: null,
    performanceScore: null,
    lcpMs: null,
    cls: null,
    inpMs: null,
    fidMs: null,
    tbtMs: null,
    note,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer an explicit binary (UMER_LIGHTHOUSE_BIN), then fall back to pinned npx.
 * Avoids re-downloading lighthouse on every run when a local install is available.
 */
async function resolveLighthouseInvocation(): Promise<{ command: string; prefixArgs: string[] }> {
  const fromEnv = process.env.UMER_LIGHTHOUSE_BIN?.trim();
  if (fromEnv && (await pathExists(fromEnv))) {
    return { command: fromEnv, prefixArgs: [] };
  }
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    prefixArgs: ['--yes', 'lighthouse@12.2.1'],
  };
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      // Windows .cmd/.bat wrappers need a shell; bare executables do not.
      shell:
        process.platform === 'win32' &&
        (/\.(cmd|bat)$/i.test(command) || command.toLowerCase().includes('npx')),
      windowsHide: true,
      env: {
        ...process.env,
        // Let callers point Lighthouse at a known Chrome/Edge install.
        ...(process.env.CHROME_PATH ? { CHROME_PATH: process.env.CHROME_PATH } : {}),
      },
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

/**
 * Optional Lighthouse run. Skips cleanly when Chrome/npx lighthouse is unavailable.
 */
export async function runLighthouseEvidence(input: {
  url: string;
  evidenceDir: string;
  enabled?: boolean;
  /** SEO is the compatibility default; perf has separate skip/local controls. */
  mode?: 'seo' | 'perf';
}): Promise<LighthouseEvidence> {
  const mode = input.mode ?? 'seo';
  const skipByEnv =
    mode === 'perf'
      ? process.env.UMER_PERF_SKIP_LIGHTHOUSE === '1'
      : process.env.UMER_SEO_SKIP_LIGHTHOUSE === '1';
  if (!input.url || input.enabled === false || skipByEnv) {
    return emptyEvidence(
      `Lighthouse skipped (disabled, empty URL, or UMER_${mode.toUpperCase()}_SKIP_LIGHTHOUSE=1)`,
    );
  }

  const isLocal = input.url.includes('127.0.0.1') || input.url.includes('localhost');
  const localEnabled =
    mode === 'perf'
      ? process.env.UMER_PERF_LIGHTHOUSE_LOCAL === '1'
      : process.env.UMER_SEO_LIGHTHOUSE_LOCAL === '1';
  if (isLocal && !localEnabled) {
    return emptyEvidence(
      `Lighthouse skipped for local URL (set UMER_${mode.toUpperCase()}_LIGHTHOUSE_LOCAL=1 to force)`,
    );
  }

  await mkdir(input.evidenceDir, { recursive: true });
  const outFile = join(input.evidenceDir, `lighthouse-${randomUUID()}.json`);
  const tmpOut = join(tmpdir(), `umer-lh-${Date.now()}.report.json`);
  const invocation = await resolveLighthouseInvocation();
  const timeoutMs =
    Number(process.env.UMER_LIGHTHOUSE_TIMEOUT_MS) || (mode === 'perf' ? 180_000 : 90_000);

  const result = await runCommand(
    invocation.command,
    [
      ...invocation.prefixArgs,
      input.url,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${tmpOut}`,
      '--chrome-flags=--headless --no-sandbox --disable-gpu',
      '--quiet',
      '--form-factor=mobile',
    ],
    timeoutMs,
  );

  if (result.code !== 0) {
    await rm(tmpOut, { force: true }).catch(() => undefined);
    return emptyEvidence(
      `Lighthouse unavailable/failed: ${(result.stderr || result.stdout).slice(0, 240)}`,
    );
  }

  try {
    const raw = await readFile(tmpOut, 'utf8');
    await writeFile(outFile, raw, 'utf8');
    await rm(tmpOut, { force: true }).catch(() => undefined);
    const report = JSON.parse(raw) as Record<string, unknown> & {
      categories?: { performance?: { score?: number } };
      audits?: Record<string, { numericValue?: number }>;
    };
    const perf = report.categories?.performance?.score ?? null;
    const lcpMs = report.audits?.['largest-contentful-paint']?.numericValue ?? null;
    const cls = report.audits?.['cumulative-layout-shift']?.numericValue ?? null;
    const inpMs = report.audits?.['interaction-to-next-paint']?.numericValue ?? null;
    // Lighthouse lab reports commonly expose max-potential-fid rather than field FID.
    const fidMs = report.audits?.['max-potential-fid']?.numericValue ?? null;
    const tbtMs = report.audits?.['total-blocking-time']?.numericValue ?? null;
    const lcpOk = lcpMs === null ? null : lcpMs <= 2500;
    const clsOk = cls === null ? null : cls <= 0.1;
    return {
      ran: true,
      lcpOk,
      clsOk,
      performanceScore: perf,
      lcpMs,
      cls,
      inpMs,
      fidMs,
      tbtMs,
      note: `Lighthouse performance=${perf ?? 'n/a'} LCP(ms)=${lcpMs ?? 'n/a'} CLS=${cls ?? 'n/a'} INP(ms)=${inpMs ?? 'n/a'} max-potential-FID(ms)=${fidMs ?? 'n/a'}`,
      reportPath: outFile,
      report,
    };
  } catch (err) {
    await rm(tmpOut, { force: true }).catch(() => undefined);
    return emptyEvidence(
      `Lighthouse parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
