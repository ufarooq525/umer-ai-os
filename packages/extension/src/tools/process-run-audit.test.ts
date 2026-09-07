import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProcessRunAuditTool, type AuditDefinition } from './process-run-audit.js';
import type { ToolExecutionContext } from '../types.js';

function ctx(targetPath?: string, signal?: AbortSignal): ToolExecutionContext {
  return { specialistId: 'security.review', workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call-1', targetPath, signal };
}

// A fake "npm audit" definition that actually spawns the real Node binary
// running this test suite (guaranteed present, cross-platform, no shell) —
// this exercises the real execFile plumbing (cwd, signal, output capture)
// end to end without depending on a real npm/composer install being
// available wherever these tests run.
function scriptAudit(script: string, manifestFile = 'package.json'): AuditDefinition {
  return { bin: process.execPath, args: ['-e', script], manifestFile };
}

describe('createProcessRunAuditTool', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'umer-audit-root-'));
  });

  afterEach(async () => {
    // maxRetries/retryDelay: on Windows, a just-killed subprocess can hold its
    // cwd handle open for a few milliseconds after the kill signal fires,
    // making an immediate recursive rmdir fail with EBUSY.
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('fails closed when no targetPath is configured', async () => {
    const tool = createProcessRunAuditTool();
    await expect(tool.handler({ audit: 'npm' }, ctx(undefined))).rejects.toThrow(/no real target path/);
  });

  it('rejects malformed input with no "audit" field', async () => {
    const tool = createProcessRunAuditTool();
    await expect(tool.handler({}, ctx(root))).rejects.toThrow(/"audit" to be exactly "npm" or "composer"/);
  });

  it('rejects an "audit" value outside the fixed enum', async () => {
    const tool = createProcessRunAuditTool();
    await expect(tool.handler({ audit: 'rm -rf /' }, ctx(root))).rejects.toThrow(
      /"audit" to be exactly "npm" or "composer"/,
    );
  });

  it('reports "not applicable" without spawning anything when the manifest file is missing', async () => {
    const tool = createProcessRunAuditTool({
      audits: { npm: scriptAudit('throw new Error("should never run")') },
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(result.applicable).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('Not applicable');
  });

  it('runs the real fixed command and captures a clean exit-0 result', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { npm: scriptAudit('process.stdout.write(JSON.stringify({ ok: true }))') },
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(result.applicable).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true });
    expect(result.stdoutTruncated).toBe(false);
  });

  it('still captures stdout when the audit CLI exits non-zero (e.g. vulnerabilities found)', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: {
        npm: scriptAudit('process.stdout.write(JSON.stringify({ vulnerabilities: 1 })); process.exit(1);'),
      },
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(result.applicable).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({ vulnerabilities: 1 });
  });

  it('reports a clear error when the audit binary does not exist, instead of a raw ENOENT', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: {
        npm: { bin: 'umer-this-binary-definitely-does-not-exist-xyz', args: [], manifestFile: 'package.json' },
      },
    });
    await expect(tool.handler({ audit: 'npm' }, ctx(root))).rejects.toThrow(/is not installed or not on PATH/);
  });

  it('truncates stdout beyond the configured byte limit', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { npm: scriptAudit('process.stdout.write("x".repeat(1000))') },
      maxOutputBytes: 50,
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(result.stdout).toHaveLength(50);
    expect(result.stdoutTruncated).toBe(true);
  });

  it('runs the real cwd locked to targetPath', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { npm: scriptAudit('process.stdout.write(process.cwd())') },
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(await realpath(result.stdout)).toBe(await realpath(root));
  });

  it('kills the real subprocess and fails the call when the abort signal fires', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { npm: scriptAudit('setTimeout(() => {}, 5000)') },
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await expect(tool.handler({ audit: 'npm' }, ctx(root, controller.signal))).rejects.toThrow();
  });

  it('derives the composer audit independently of the npm one', async () => {
    await writeFile(join(root, 'composer.json'), '{}', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { composer: scriptAudit('process.stdout.write(JSON.stringify({ php: true }))', 'composer.json') },
    });
    const result = await tool.handler({ audit: 'composer' }, ctx(root));
    expect(result.applicable).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual({ php: true });
  });

  it('runs a real .cmd shim on Windows — execFile alone throws spawn EINVAL for .cmd files without shell:true', async () => {
    // Confirmed live: DEFAULT_AUDITS resolves npm's real bin to "npm.cmd" on
    // win32, and CreateProcess cannot execute a .cmd/.bat file directly
    // without going through cmd.exe. Windows-only regression -- this
    // failure mode doesn't exist on POSIX, where npm's real binary isn't a
    // shell script.
    if (process.platform !== 'win32') {
      return;
    }
    await writeFile(join(root, 'package.json'), '{}', 'utf8');
    const cmdPath = join(root, 'fake-npm.cmd');
    await writeFile(cmdPath, '@echo off\r\necho {"ok":true}\r\n', 'utf8');
    const tool = createProcessRunAuditTool({
      audits: { npm: { bin: cmdPath, args: [], manifestFile: 'package.json' } },
    });
    const result = await tool.handler({ audit: 'npm' }, ctx(root));
    expect(result.applicable).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain('{"ok":true}');
  });
});
