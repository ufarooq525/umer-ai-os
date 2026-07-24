import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export type LighthouseEvidence = {
  ran: boolean;
  lcpOk: boolean | null;
  clsOk: boolean | null;
  performanceScore: number | null;
  note: string;
  reportPath?: string;
};

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: true,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr: `${stderr}\ntimeout after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
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
}): Promise<LighthouseEvidence> {
  if (!input.url || input.enabled === false || process.env.UMER_SEO_SKIP_LIGHTHOUSE === '1') {
    return {
      ran: false,
      lcpOk: null,
      clsOk: null,
      performanceScore: null,
      note: 'Lighthouse skipped (disabled, empty URL, or UMER_SEO_SKIP_LIGHTHOUSE=1)',
    };
  }

  const isLocal = input.url.includes('127.0.0.1') || input.url.includes('localhost');
  if (isLocal && process.env.UMER_SEO_LIGHTHOUSE_LOCAL !== '1') {
    return {
      ran: false,
      lcpOk: null,
      clsOk: null,
      performanceScore: null,
      note: 'Lighthouse skipped for local URL (set UMER_SEO_LIGHTHOUSE_LOCAL=1 to force)',
    };
  }

  await mkdir(input.evidenceDir, { recursive: true });
  const outFile = join(input.evidenceDir, `lighthouse-${randomUUID()}.json`);
  const tmpOut = join(tmpdir(), `umer-lh-${Date.now()}.report.json`);

  const result = await runCommand(
    'npx',
    [
      '--yes',
      'lighthouse@12.2.1',
      input.url,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${tmpOut}`,
      '--chrome-flags=--headless --no-sandbox --disable-gpu',
      '--quiet',
    ],
    90_000,
  );

  if (result.code !== 0) {
    return {
      ran: false,
      lcpOk: null,
      clsOk: null,
      performanceScore: null,
      note: `Lighthouse unavailable/failed: ${(result.stderr || result.stdout).slice(0, 240)}`,
    };
  }

  try {
    const raw = await readFile(tmpOut, 'utf8');
    await writeFile(outFile, raw, 'utf8');
    const report = JSON.parse(raw) as {
      categories?: { performance?: { score?: number } };
      audits?: Record<string, { numericValue?: number }>;
    };
    const perf = report.categories?.performance?.score ?? null;
    const lcpMs = report.audits?.['largest-contentful-paint']?.numericValue ?? null;
    const cls = report.audits?.['cumulative-layout-shift']?.numericValue ?? null;
    const lcpOk = lcpMs === null ? null : lcpMs <= 2500;
    const clsOk = cls === null ? null : cls <= 0.1;
    return {
      ran: true,
      lcpOk,
      clsOk,
      performanceScore: perf,
      note: `Lighthouse performance=${perf ?? 'n/a'} LCP(ms)=${lcpMs ?? 'n/a'} CLS=${cls ?? 'n/a'}`,
      reportPath: outFile,
    };
  } catch (err) {
    return {
      ran: false,
      lcpOk: null,
      clsOk: null,
      performanceScore: null,
      note: `Lighthouse parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
