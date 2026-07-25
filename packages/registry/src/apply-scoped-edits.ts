import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertEditsStillFresh, type EngResolvedEdit } from './eng-diff.js';
import {
  assertNoSymlinkInProjectPath,
  isSafeProjectRelativePath,
} from './eng-scope.js';
import { ProjectRegistryError, type ProjectRegistryErrorCode } from './errors.js';

export type ScopedEditFileAction = {
  path: string;
  action: 'created' | 'updated';
  note: string;
};

export type ScopedEditApplyResult = {
  changedFiles: string[];
  files: ScopedEditFileAction[];
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Proven scoped-apply path shared by eng.app-delivery and seo.audit.
 *
 * - Rejects path traversal and symlink escapes
 * - Requires disk still matches the resolved edit base (freshness)
 * - Writes `edit.after` only — never parses a free-form patch
 *
 * Specialist-specific evidence sealing stays in the caller.
 */
export async function applyScopedEdits(input: {
  root: string;
  edits: EngResolvedEdit[];
  /** Error code when blocked (defaults to ENG_APPLY_BLOCKED for eng callers). */
  blockCode?: ProjectRegistryErrorCode;
}): Promise<ScopedEditApplyResult> {
  const blockCode = input.blockCode ?? 'ENG_APPLY_BLOCKED';
  const root = input.root;

  if (!(await exists(root))) {
    throw new ProjectRegistryError(blockCode, `Project path does not exist: ${root}`);
  }
  if (input.edits.length === 0) {
    throw new ProjectRegistryError(blockCode, 'Work package has no resolved edits');
  }

  for (const edit of input.edits) {
    if (!isSafeProjectRelativePath(root, edit.path)) {
      throw new ProjectRegistryError(
        blockCode,
        `Path traversal rejected at apply: ${edit.path}`,
      );
    }
    await assertNoSymlinkInProjectPath(root, edit.path);
  }

  const stale = await assertEditsStillFresh({ root, edits: input.edits });
  if (stale.length > 0) {
    throw new ProjectRegistryError(blockCode, stale.join('; '));
  }

  const files: ScopedEditFileAction[] = [];
  const changedFiles: string[] = [];

  for (const edit of input.edits) {
    const full = join(root, edit.path);
    await mkdir(dirname(full), { recursive: true });
    await assertNoSymlinkInProjectPath(root, edit.path);
    await writeFile(full, edit.after, 'utf8');
    changedFiles.push(edit.path);
    files.push({
      path: edit.path,
      action: edit.action === 'create' ? 'created' : 'updated',
      note: edit.note,
    });
  }

  return { changedFiles, files };
}
