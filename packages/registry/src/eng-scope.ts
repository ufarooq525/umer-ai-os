import { access, lstat, readdir, stat } from 'node:fs/promises';
import { join, normalize, relative, resolve, sep } from 'node:path';
import { ProjectRegistryError } from './errors.js';

export type EngScopeStatus = 'in-scope' | 'needs-manual-scoping';

export type EngScopeFileKind = 'target' | 'module-member';

export type EngScopeFile = {
  /** Repo-relative, forward-slash path. */
  path: string;
  kind: EngScopeFileKind;
  exists: boolean;
};

export type EngScope = {
  status: EngScopeStatus;
  /** Module the change was scoped to, when the caller named one. */
  module?: string;
  /** Directory the module resolved to, repo-relative. */
  moduleDir?: string;
  files: EngScopeFile[];
  fileCount: number;
  maxFiles: number;
  reasons: string[];
};

/** v1 handles single-file / single-module work only. */
export const ENG_MAX_FILES_DEFAULT = 3;

const CODE_EXTENSIONS = [
  '.php',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.blade.php',
  '.css',
  '.scss',
  '.json',
  '.md',
];

/** Where a named module might live across the Laragon stacks we support. */
const MODULE_ROOTS = [
  'app/Modules',
  'Modules',
  'app/Http/Controllers',
  'app/Services',
  'app/Models',
  'src',
  'resources/js',
  'frontend-spa/src',
  'packages',
];

const MODULE_SCAN_DEPTH = 2;

export function engMaxFiles(): number {
  const raw = process.env.UMER_ENG_MAX_FILES;
  const n = raw ? Number(raw) : ENG_MAX_FILES_DEFAULT;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : ENG_MAX_FILES_DEFAULT;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function toRel(path: string): string {
  return path.split(sep).join('/').replace(/^\.\//, '');
}

/** Reject absolute paths and traversal so scoping can never point outside the project. */
export function isSafeProjectRelativePath(root: string, candidate: string): boolean {
  const cleaned = candidate.trim().replace(/\\/g, '/');
  if (!cleaned || cleaned.length > 400) return false;
  if (/^[a-z]:\//i.test(cleaned) || cleaned.startsWith('/')) return false;
  const full = resolve(root, normalize(cleaned));
  const rel = relative(resolve(root), full);
  return rel.length > 0 && !rel.startsWith('..');
}

function isCodeFile(name: string): boolean {
  return CODE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

async function listCodeFiles(dir: string, root: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  let names: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    names = entries.map((entry) => ({
      name: String(entry.name),
      isDirectory: () => entry.isDirectory(),
      isFile: () => entry.isFile(),
    }));
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of names) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/^(node_modules|vendor|\.git|dist|build|storage|\.umer)$/i.test(entry.name)) continue;
      found.push(...(await listCodeFiles(full, root, depth - 1)));
    } else if (entry.isFile() && isCodeFile(entry.name)) {
      found.push(toRel(relative(root, full)));
    }
  }
  return found;
}

async function findModuleDir(root: string, module: string): Promise<string | undefined> {
  const cleaned = module.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!cleaned || !isSafeProjectRelativePath(root, cleaned)) return undefined;

  // Treat the module as a path first (callers often already know the folder).
  const direct = join(root, cleaned);
  if (await exists(direct)) {
    try {
      if ((await stat(direct)).isDirectory()) return toRel(cleaned);
    } catch {
      /* fall through to root search */
    }
  }

  for (const base of MODULE_ROOTS) {
    const candidate = join(root, base, cleaned);
    if (await exists(candidate)) {
      try {
        if ((await stat(candidate)).isDirectory()) return `${base}/${cleaned}`;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

/**
 * Resolve the blast radius of a delivery request.
 *
 * Explicit `targetFiles` win; a `targetModule` is expanded by scanning known module roots.
 * Anything wider than {@link engMaxFiles} is handed back for manual scoping instead of
 * being attempted — v1 has no multi-file orchestration.
 */
export async function resolveEngScope(input: {
  root: string;
  targetFiles?: string[];
  targetModule?: string;
}): Promise<EngScope> {
  const maxFiles = engMaxFiles();
  const reasons: string[] = [];
  const files: EngScopeFile[] = [];
  const seen = new Set<string>();

  for (const raw of input.targetFiles ?? []) {
    const cleaned = raw.trim().replace(/\\/g, '/');
    if (!cleaned) continue;
    if (!isSafeProjectRelativePath(input.root, cleaned)) {
      reasons.push(`Rejected unsafe target path: ${raw}`);
      continue;
    }
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    files.push({
      path: cleaned,
      kind: 'target',
      exists: await exists(join(input.root, cleaned)),
    });
  }

  let moduleDir: string | undefined;
  if (input.targetModule?.trim()) {
    moduleDir = await findModuleDir(input.root, input.targetModule);
    if (!moduleDir) {
      reasons.push(
        `Module "${input.targetModule}" not found under ${MODULE_ROOTS.join(', ')} — name the files explicitly`,
      );
    } else if (files.length === 0) {
      const members = await listCodeFiles(
        join(input.root, moduleDir),
        input.root,
        MODULE_SCAN_DEPTH,
      );
      for (const member of members) {
        if (seen.has(member)) continue;
        seen.add(member);
        files.push({ path: member, kind: 'module-member', exists: true });
      }
      if (members.length === 0) {
        reasons.push(`Module directory ${moduleDir} contains no recognizable source files`);
      }
    }
  }

  if (files.length === 0 && reasons.length === 0) {
    reasons.push('No target files or module supplied — cannot scope a code change');
  }

  if (files.length > maxFiles) {
    reasons.push(
      `Change touches ${files.length} files (limit ${maxFiles}) — split into smaller work packages or scope manually`,
    );
  }

  // Fail closed: any safety/scoping reason means the package is not in-scope.
  const status: EngScopeStatus =
    reasons.length === 0 && files.length > 0 && files.length <= maxFiles
      ? 'in-scope'
      : 'needs-manual-scoping';

  return {
    status,
    module: input.targetModule?.trim() || undefined,
    moduleDir,
    files,
    fileCount: files.length,
    maxFiles,
    reasons,
  };
}

const ENG_RUN_ID_RE = /^[A-Za-z0-9._-]+$/;
const ENG_RUN_ID_MAX = 120;

/** Reject path-traversal / unsafe runId values used under `.umer/eng/<runId>/`. */
export function assertSafeEngRunId(runId: string): string {
  const cleaned = runId.trim();
  if (!cleaned || cleaned.length > ENG_RUN_ID_MAX || !ENG_RUN_ID_RE.test(cleaned)) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      `Unsafe eng runId rejected (allowed [A-Za-z0-9._-], max ${ENG_RUN_ID_MAX}): ${runId}`,
    );
  }
  return cleaned;
}

/**
 * Walk every existing path component (including the target) and reject symlinks so an
 * in-root link cannot redirect reads/writes outside the project.
 */
export async function assertNoSymlinkInProjectPath(
  root: string,
  relativePath: string,
): Promise<void> {
  if (!isSafeProjectRelativePath(root, relativePath)) {
    throw new ProjectRegistryError('ENG_APPLY_BLOCKED', `Unsafe project path rejected: ${relativePath}`);
  }
  const rootResolved = resolve(root);
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  let current = rootResolved;
  for (const part of parts) {
    current = join(current, part);
    try {
      const st = await lstat(current);
      if (st.isSymbolicLink()) {
        throw new ProjectRegistryError(
          'ENG_APPLY_BLOCKED',
          `Symlink rejected under project path: ${toRel(relative(rootResolved, current))}`,
        );
      }
    } catch (err) {
      if (err instanceof ProjectRegistryError) throw err;
      // Component does not exist yet (create) — remaining parts cannot be links.
      break;
    }
  }
}
