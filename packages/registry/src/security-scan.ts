import { spawn } from 'node:child_process';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import type { SecurityFinding, SecuritySeverity } from './security-audit.js';

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

function finding(
  partial: Omit<SecurityFinding, 'id'> & { id?: string },
): SecurityFinding {
  return {
    id: partial.id ?? `sec-${partial.category}-${partial.severity}`,
    category: partial.category,
    severity: partial.severity,
    title: partial.title,
    detail: partial.detail,
    evidence: partial.evidence,
    path: partial.path,
    remediation: partial.remediation,
  };
}

function npmSeverity(sev: string): SecuritySeverity {
  const s = sev.toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate' || s === 'medium') return 'medium';
  return 'low';
}

/** Allowlisted dependency audit invocations only. */
export function isAllowedSecurityAuditCommand(command: string): boolean {
  const c = command.trim().toLowerCase();
  if (!c || c.length > 120) return false;
  if (/[;&|`$<>]/.test(command)) return false;
  return (
    /^npm\s+audit(\s+--json)?(\s+--omit=dev)?$/i.test(c) ||
    /^composer\s+audit(\s+--format=json)?$/i.test(c)
  );
}

/**
 * Run npm audit / composer audit when lockfiles/manifests exist.
 * Skip with UMER_SECURITY_SKIP_AUDIT=1 (unit tests).
 */
export async function scanDependencyVulnerabilities(root: string): Promise<{
  findings: SecurityFinding[];
  ran: string[];
  skipped: string[];
}> {
  const findings: SecurityFinding[] = [];
  const ran: string[] = [];
  const skipped: string[] = [];

  if (process.env.UMER_SECURITY_SKIP_AUDIT === '1') {
    skipped.push('UMER_SECURITY_SKIP_AUDIT=1');
    return { findings, ran, skipped };
  }

  const timeoutMs = Number(process.env.UMER_SECURITY_AUDIT_TIMEOUT_MS) || 120_000;

  if (await exists(join(root, 'package.json'))) {
    const cmd = 'npm audit --json';
    if (!isAllowedSecurityAuditCommand(cmd)) {
      skipped.push('npm audit failed allowlist');
    } else {
      ran.push(cmd);
      const result = await runCommand(cmd, root, timeoutMs);
      try {
        const json = JSON.parse(result.stdout || '{}') as {
          vulnerabilities?: Record<
            string,
            { severity?: string; via?: unknown[]; range?: string; fixAvailable?: unknown }
          >;
          metadata?: { vulnerabilities?: Record<string, number> };
        };
        const vulns = json.vulnerabilities ?? {};
        let idx = 0;
        for (const [name, meta] of Object.entries(vulns)) {
          const severity = npmSeverity(meta.severity ?? 'low');
          // Cap noise — only surface medium+ from npm, and critical/high always.
          if (severity === 'low') continue;
          idx += 1;
          findings.push(
            finding({
              id: `dep-npm-${idx}-${name.replace(/[^a-z0-9._-]/gi, '_')}`,
              category: 'dependency',
              severity,
              title: `npm vulnerability in ${name}`,
              detail: `Package \`${name}\` reports severity=${meta.severity ?? 'unknown'} range=${meta.range ?? 'n/a'}.`,
              evidence: `npm audit --json · ${name} · severity=${meta.severity}`,
              path: 'package.json',
              remediation: 'Run `npm audit fix` (or upgrade the package) and re-audit before release.',
            }),
          );
        }
        if (idx === 0 && result.code !== 0 && !result.stdout.trim()) {
          findings.push(
            finding({
              id: 'dep-npm-audit-failed',
              category: 'dependency',
              severity: 'medium',
              title: 'npm audit did not return parseable results',
              detail: 'npm audit exited non-zero without a usable JSON vulnerability map.',
              evidence: (result.stderr || result.stdout || 'empty').slice(0, 500),
              path: 'package.json',
              remediation: 'Run `npm audit` locally and fix install/lockfile issues.',
            }),
          );
        }
      } catch {
        if (result.code !== 0) {
          findings.push(
            finding({
              id: 'dep-npm-audit-unparsed',
              category: 'dependency',
              severity: 'low',
              title: 'npm audit output could not be parsed',
              detail: 'Manifest present but audit JSON parse failed.',
              evidence: (result.stderr || result.stdout || '').slice(0, 400),
              path: 'package.json',
              remediation: 'Re-run `npm audit --json` manually and inspect lockfile health.',
            }),
          );
        }
      }
    }
  } else {
    skipped.push('no package.json');
  }

  if (await exists(join(root, 'composer.json'))) {
    const cmd = 'composer audit --format=json';
    if (!isAllowedSecurityAuditCommand(cmd)) {
      skipped.push('composer audit failed allowlist');
    } else {
      ran.push(cmd);
      const result = await runCommand(cmd, root, timeoutMs);
      try {
        const json = JSON.parse(result.stdout || '{}') as {
          advisories?: Record<
            string,
            Array<{ title?: string; severity?: string; cve?: string | string[]; link?: string }>
          > | Array<{ packageName?: string; title?: string; severity?: string }>;
          abandoned?: unknown;
        };
        let idx = 0;
        const advisories = json.advisories;
        if (advisories && typeof advisories === 'object' && !Array.isArray(advisories)) {
          for (const [pkg, list] of Object.entries(advisories)) {
            for (const adv of list) {
              const severity = npmSeverity(adv.severity ?? 'medium');
              if (severity === 'low') continue;
              idx += 1;
              findings.push(
                finding({
                  id: `dep-composer-${idx}-${pkg.replace(/[^a-z0-9._-]/gi, '_')}`,
                  category: 'dependency',
                  severity,
                  title: `Composer advisory for ${pkg}`,
                  detail: adv.title ?? `Advisory on ${pkg}`,
                  evidence: `composer audit · ${pkg} · ${
                    Array.isArray(adv.cve)
                      ? adv.cve.join(',')
                      : adv.cve ?? adv.severity ?? 'advisory'
                  }`,
                  path: 'composer.json',
                  remediation: 'Upgrade the package per the advisory and re-run `composer audit`.',
                }),
              );
            }
          }
        }
      } catch {
        // composer audit may print text when no issues — ignore empty/parse miss when exit 0
        if (result.code !== 0 && result.stdout.trim()) {
          findings.push(
            finding({
              id: 'dep-composer-audit-unparsed',
              category: 'dependency',
              severity: 'low',
              title: 'composer audit output could not be parsed',
              detail: 'composer.json present but audit JSON parse failed.',
              evidence: (result.stderr || result.stdout || '').slice(0, 400),
              path: 'composer.json',
              remediation: 'Re-run `composer audit --format=json` manually.',
            }),
          );
        }
      }
    }
  } else {
    skipped.push('no composer.json');
  }

  return { findings, ran, skipped };
}

const SECRET_PATTERNS: Array<{
  id: string;
  severity: SecuritySeverity;
  title: string;
  re: RegExp;
}> = [
  {
    id: 'aws-key',
    severity: 'critical',
    title: 'Possible AWS access key id',
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: 'stripe-live',
    severity: 'critical',
    title: 'Possible Stripe live secret key',
    re: /\bsk_live_[0-9a-zA-Z]{16,}\b/g,
  },
  {
    id: 'github-pat',
    severity: 'critical',
    title: 'Possible GitHub personal access token',
    re: /\bghp_[0-9a-zA-Z]{36}\b/g,
  },
  {
    id: 'generic-api-key-assign',
    severity: 'high',
    title: 'Hardcoded API key / secret assignment',
    re: /\b(?:api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?token)\s*=\s*['"][^'"]{12,}['"]/gi,
  },
  {
    id: 'password-assign',
    severity: 'high',
    title: 'Hardcoded password assignment',
    re: /\bpassword\s*=\s*['"][^'"]{6,}['"]/gi,
  },
  {
    id: 'private-key-block',
    severity: 'critical',
    title: 'PEM private key material in source',
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
];

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.php',
  '.env',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.blade.php',
]);

const SKIP_DIR = /^(node_modules|vendor|\.git|dist|build|coverage|\.umer|storage|tmp|\.next|public\/build)$/i;

async function walkFiles(dir: string, root: string, depth: number, out: string[]): Promise<void> {
  if (depth < 0 || out.length > 400) return;
  let entries: Array<{
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
  }>;
  try {
    entries = (await readdir(dir, { withFileTypes: true })).map((entry) => ({
      name: String(entry.name),
      isDirectory: () => entry.isDirectory(),
      isFile: () => entry.isFile(),
    }));
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    const full = join(dir, name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(name)) continue;
      await walkFiles(full, root, depth - 1, out);
    } else if (entry.isFile()) {
      const ext = name.endsWith('.blade.php') ? '.blade.php' : extname(name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext) || name === '.env' || name.startsWith('.env.')) {
        out.push(full);
      }
    }
  }
}

/**
 * Detect committed .env files and basic hardcoded credential patterns.
 * Not a full entropy scanner — v1 pattern matching only.
 */
export async function scanExposedSecrets(root: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  for (const envName of ['.env', '.env.local', '.env.production', '.env.backup']) {
    const full = join(root, envName);
    if (await exists(full)) {
      const st = await stat(full);
      if (st.isFile() && st.size > 0) {
        findings.push(
          finding({
            id: `secret-env-${envName.replace(/[^a-z0-9]/gi, '_')}`,
            category: 'secret',
            severity: 'critical',
            title: `Committed environment file present: ${envName}`,
            detail:
              `${envName} exists in the project root. Secrets in env files must not be committed — use .env.example for templates only.`,
            evidence: `file exists · size=${st.size}`,
            path: envName,
            remediation: `Remove ${envName} from the repo, rotate any exposed credentials, keep only .env.example.`,
          }),
        );
      }
    }
  }

  const files: string[] = [];
  await walkFiles(root, root, 4, files);

  let findingCount = 0;
  for (const full of files) {
    if (findingCount >= 40) break;
    const rel = relative(root, full).split(sep).join('/');
    if (rel === '.env.example' || rel.endsWith('/.env.example')) continue;
    // Skip scanning the env files we already flagged as committed.
    if (/^\.env(\.|$)/.test(basename(rel))) continue;

    let text: string;
    try {
      text = await readFile(full, 'utf8');
    } catch {
      continue;
    }
    if (text.length > 400_000) continue;

    for (const pattern of SECRET_PATTERNS) {
      pattern.re.lastIndex = 0;
      const match = pattern.re.exec(text);
      if (!match) continue;
      findingCount += 1;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      findings.push(
        finding({
          id: `secret-${pattern.id}-${findingCount}`,
          category: 'secret',
          severity: pattern.severity,
          title: pattern.title,
          detail: `Pattern matched in \`${rel}\` near line ${line}.`,
          evidence: `${rel}:${line} · matched ${pattern.id}`,
          path: rel,
          remediation: 'Remove the secret from source, rotate it, and load from environment instead.',
        }),
      );
      if (findingCount >= 40) break;
    }
  }

  return findings;
}

const AUTH_HINT =
  /middleware\s*\(\s*\[?\s*['"]auth['"]|middleware\s*\(\s*['"]auth['"]|->middleware\s*\(\s*['"]auth|auth(?:enticat|orize)|@auth|Authorize::|can:\s*['"]|permission:/i;

const ROUTE_LINE =
  /Route::(get|post|put|patch|delete|any|match)\s*\(\s*['"]([^'"]+)['"]/gi;

/**
 * Flag routes with no visible auth middleware when siblings in the same file do.
 * Inconsistency check only — not a full permission graph.
 */
export async function scanAuthPermissionGaps(root: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const candidates = [
    'routes/web.php',
    'routes/api.php',
    'routes/admin.php',
    'app/Http/routes.php',
    'src/routes.ts',
    'src/routes/index.ts',
    'server/routes.ts',
  ];

  for (const rel of candidates) {
    const full = join(root, rel);
    if (!(await exists(full))) continue;
    let text: string;
    try {
      text = await readFile(full, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    const fileHasAuth = AUTH_HINT.test(text);
    if (!fileHasAuth) {
      // No auth signals at all in this file — skip inconsistency check (may be public marketing routes).
      continue;
    }

    const unprotected: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      ROUTE_LINE.lastIndex = 0;
      const m = ROUTE_LINE.exec(line);
      if (!m) continue;
      const path = m[2] ?? '';
      // Look at this line + next 2 for middleware chaining.
      const window = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join(' ');
      const hasAuthNearby = AUTH_HINT.test(window);
      // Skip obvious public endpoints.
      if (/^\/?(login|register|password|health|up|sanctum\/csrf-cookie)/i.test(path)) continue;
      if (!hasAuthNearby) {
        unprotected.push(`${path} (line ${i + 1})`);
      }
    }

    if (unprotected.length > 0 && unprotected.length < 40) {
      findings.push(
        finding({
          id: `auth-gap-${rel.replace(/[\\/]/g, '-')}`,
          category: 'auth',
          severity: unprotected.length >= 5 ? 'high' : 'medium',
          title: `Routes without visible auth next to authenticated siblings in ${rel}`,
          detail: `${unprotected.length} route(s) in \`${rel}\` lack nearby auth middleware while other routes in the same file use auth.`,
          evidence: unprotected.slice(0, 8).join('; '),
          path: rel,
          remediation:
            'Confirm each listed route is intentionally public; otherwise add the same auth middleware used by siblings.',
        }),
      );
    }
  }

  return findings;
}

export type SecurityScanBundle = {
  findings: SecurityFinding[];
  dependencyRan: string[];
  dependencySkipped: string[];
};

export async function runSecurityScans(root: string): Promise<SecurityScanBundle> {
  const dep = await scanDependencyVulnerabilities(root);
  const secrets = await scanExposedSecrets(root);
  const auth = await scanAuthPermissionGaps(root);
  return {
    findings: [...dep.findings, ...secrets, ...auth],
    dependencyRan: dep.ran,
    dependencySkipped: dep.skipped,
  };
}
