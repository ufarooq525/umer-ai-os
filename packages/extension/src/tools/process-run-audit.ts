import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

const execFileAsync = promisify(execFile);

export type ProcessRunAuditKind = 'npm' | 'composer';

export type ProcessRunAuditInput = {
  audit: ProcessRunAuditKind;
};

export type ProcessRunAuditOutput = {
  command: string;
  applicable: boolean;
  exitCode: number | null;
  stdout: string;
  stdoutTruncated: boolean;
  stderr: string;
  stderrTruncated: boolean;
};

export type AuditDefinition = {
  bin: string;
  args: string[];
  manifestFile: string;
};

export type ProcessRunAuditToolOptions = {
  audits?: Partial<Record<ProcessRunAuditKind, AuditDefinition>>;
  maxOutputBytes?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_OUTPUT_BYTES = 200_000;
const DEFAULT_TIMEOUT_MS = 120_000;

// Fixed, non-shell-interpreted argv per audit kind -- the model can only pick
// one of these two enum keys; it never supplies a command string or
// arguments of its own. npm/composer ship their CLI entry points as
// .cmd/.bat shims on Windows rather than a raw .exe, which Windows will not
// resolve without an explicit extension (unlike POSIX's PATH lookup) --
// naming the shim explicitly is the standard cross-platform workaround, not
// a shell invocation (execFile never spawns a shell either way).
const DEFAULT_AUDITS: Record<ProcessRunAuditKind, AuditDefinition> = {
  npm: {
    bin: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['audit', '--json'],
    manifestFile: 'package.json',
  },
  composer: {
    bin: process.platform === 'win32' ? 'composer.bat' : 'composer',
    args: ['audit', '--format=json'],
    manifestFile: 'composer.json',
  },
};

function isProcessRunAuditInput(value: unknown): value is ProcessRunAuditInput {
  const audit = (value as { audit?: unknown } | null)?.audit;
  return audit === 'npm' || audit === 'composer';
}

function capture(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  return { text: buf.subarray(0, maxBytes).toString('utf8'), truncated: true };
}

type ExecFileFailure = NodeJS.ErrnoException & {
  stdout?: string;
  stderr?: string;
  code?: number | string | null;
  signal?: string | null;
  killed?: boolean;
};

/**
 * process_run_audit — the only tool in this codebase that can spawn a real
 * subprocess, so its surface is deliberately minimal: the model selects one
 * of two enum keys (`npm` | `composer`), never a command string or
 * arguments — every argv is fixed in code (DEFAULT_AUDITS, above), never
 * shell-interpreted (`execFile`, not `exec`/`spawn(..., {shell:true})`), and
 * the working directory is locked to the Work Package's real `targetPath`.
 * Fails closed with no `targetPath`. A missing manifest file
 * (`package.json` / `composer.json`) is reported as a clean "not
 * applicable" result rather than spawning a command that could only fail.
 * A non-zero exit code from the audit CLI itself is NOT treated as this
 * tool failing — e.g. `npm audit` exits non-zero when it finds
 * vulnerabilities, and that JSON on stdout is the actual finding; only a
 * missing binary or a real timeout/abort is reported as a tool failure.
 */
export function createProcessRunAuditTool(options: ProcessRunAuditToolOptions = {}): ToolDefinition<ProcessRunAuditOutput> {
  const audits: Record<ProcessRunAuditKind, AuditDefinition> = { ...DEFAULT_AUDITS, ...options.audits };
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: 'process_run_audit',
    description:
      'Run a real dependency-vulnerability audit against the project you are reviewing. Pass "npm" for a ' +
      'Node.js project (runs `npm audit --json`) or "composer" for a PHP project (runs `composer audit ' +
      '--format=json`). No other command or arguments can ever be run through this tool.',
    parameters: {
      type: 'object',
      properties: {
        audit: { type: 'string', enum: ['npm', 'composer'], description: 'Which dependency audit to run.' },
      },
      required: ['audit'],
      additionalProperties: false,
    },
    timeoutMs,
    async handler(input: unknown, ctx: ToolExecutionContext): Promise<ProcessRunAuditOutput> {
      if (!ctx.targetPath) {
        throw new Error(
          'process_run_audit has no real target path configured for this Work Package — nothing can be audited',
        );
      }
      if (!isProcessRunAuditInput(input)) {
        throw new Error('process_run_audit requires "audit" to be exactly "npm" or "composer"');
      }

      const audit = audits[input.audit];
      const commandLabel = `${audit.bin} ${audit.args.join(' ')}`;

      try {
        await stat(join(ctx.targetPath, audit.manifestFile));
      } catch {
        return {
          command: commandLabel,
          applicable: false,
          exitCode: null,
          stdout: '',
          stdoutTruncated: false,
          stderr: `Not applicable: no ${audit.manifestFile} found in the project root.`,
          stderrTruncated: false,
        };
      }

      try {
        // Confirmed live: Windows' CreateProcess cannot execute a .cmd/.bat
        // shim directly (npm.cmd, the exact bin DEFAULT_AUDITS resolves to on
        // win32) without going through cmd.exe -- execFile throws
        // `spawn EINVAL` otherwise. Narrowly scoped to .cmd/.bat files only:
        // turning this on for every binary broke real .exe paths containing
        // spaces (e.g. the default Node.js install itself, "C:\Program
        // Files\nodejs\node.exe") because shell:true routes the command
        // through cmd.exe, which does NOT auto-quote the executable --
        // hence the explicit quoting below. Safe here specifically because
        // `bin` and `args` are always fixed, code-defined values
        // (DEFAULT_AUDITS or a caller-supplied override), never derived
        // from the model's input or any other untrusted source -- shell:true
        // only becomes an injection risk when an argument's content could
        // itself be shell syntax, which never happens for this tool's two
        // fixed audit commands.
        const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(audit.bin);
        const { stdout, stderr } = await execFileAsync(needsShell ? `"${audit.bin}"` : audit.bin, audit.args, {
          cwd: ctx.targetPath,
          timeout: timeoutMs,
          signal: ctx.signal,
          maxBuffer: 10 * 1024 * 1024,
          shell: needsShell,
        });
        const out = capture(stdout, maxOutputBytes);
        const err = capture(stderr, maxOutputBytes);
        return {
          command: commandLabel,
          applicable: true,
          exitCode: 0,
          stdout: out.text,
          stdoutTruncated: out.truncated,
          stderr: err.text,
          stderrTruncated: err.truncated,
        };
      } catch (err) {
        const execErr = err as ExecFileFailure;
        if (execErr.code === 'ENOENT') {
          throw new Error(`process_run_audit: "${audit.bin}" is not installed or not on PATH`);
        }
        // A real cancellation or timeout kill (signal delivered / process
        // killed / AbortController fired) is a genuine tool failure, not an
        // audit result — even though Node still attaches empty stdout/stderr
        // strings to this error, unlike a real completed run with no output.
        if (execErr.signal || execErr.killed || execErr.code === 'ABORT_ERR' || execErr.name === 'AbortError') {
          throw err;
        }
        if (typeof execErr.stdout === 'string' || typeof execErr.stderr === 'string') {
          const out = capture(execErr.stdout ?? '', maxOutputBytes);
          const errText = capture(execErr.stderr ?? '', maxOutputBytes);
          return {
            command: commandLabel,
            applicable: true,
            exitCode: typeof execErr.code === 'number' ? execErr.code : null,
            stdout: out.text,
            stdoutTruncated: out.truncated,
            stderr: errText.text,
            stderrTruncated: errText.truncated,
          };
        }
        throw err;
      }
    },
  };
}
