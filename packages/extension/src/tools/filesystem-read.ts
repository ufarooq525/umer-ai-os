import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export type FilesystemReadInput = {
  path: string;
};

export type FilesystemReadOutput = {
  path: string;
  content: string;
  truncated: boolean;
};

const MAX_BYTES = 200_000;

function isFilesystemReadInput(value: unknown): value is FilesystemReadInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { path?: unknown }).path === 'string' &&
    (value as { path: string }).path.trim().length > 0
  );
}

/** Rejects a path outside `root` — covers both `../` traversal and an absolute escape. */
function assertWithinRoot(root: string, candidate: string, originalInput: string): void {
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`filesystem_read: "${originalInput}" resolves outside the project root`);
  }
}

/**
 * filesystem_read — reads one text file from within a Work Package's real,
 * resolved `targetPath` (see WorkPackageContract's `targetPath` field and
 * ReadyWorkPackagePlanner's fail-closed resolution of it). Never falls back
 * to an unrestricted root: no `targetPath` configured means no read, full
 * stop. Rejects `../` traversal, an absolute-path escape, and a symlink that
 * resolves outside the root — checked both before and after resolving
 * symlinks, since a symlink can only be discovered by actually resolving it.
 */
export function createFilesystemReadTool(): ToolDefinition<FilesystemReadOutput> {
  return {
    name: 'filesystem_read',
    description:
      'Read one text file from the real project you are reviewing, by path relative to the project root ' +
      '(e.g. "src/app.tsx"). Use this to ground every finding in the actual codebase — never guess at file contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project root.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    async handler(input: unknown, ctx: ToolExecutionContext): Promise<FilesystemReadOutput> {
      if (!ctx.targetPath) {
        throw new Error(
          'filesystem_read has no real target path configured for this Work Package — nothing can be read',
        );
      }
      if (!isFilesystemReadInput(input)) {
        throw new Error('filesystem_read requires a non-empty string "path" argument');
      }
      if (isAbsolute(input.path)) {
        throw new Error('filesystem_read requires a path relative to the project root, not an absolute path');
      }

      const root = await realpath(ctx.targetPath);
      const resolved = resolve(root, input.path);
      assertWithinRoot(root, resolved, input.path);

      let real: string;
      try {
        real = await realpath(resolved);
      } catch {
        throw new Error(`filesystem_read: "${input.path}" does not exist`);
      }
      assertWithinRoot(root, real, input.path);

      const info = await stat(real);
      if (!info.isFile()) {
        throw new Error(`filesystem_read: "${input.path}" is not a regular file`);
      }

      const buffer = await readFile(real);
      const truncated = buffer.byteLength > MAX_BYTES;
      return {
        path: input.path,
        content: buffer.subarray(0, MAX_BYTES).toString('utf8'),
        truncated,
      };
    },
  };
}
