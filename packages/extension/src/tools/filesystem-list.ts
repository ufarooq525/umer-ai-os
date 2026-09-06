import { readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export type FilesystemListInput = {
  path?: string;
};

export type FilesystemListEntry = {
  name: string;
  type: 'file' | 'directory' | 'other';
};

export type FilesystemListOutput = {
  path: string;
  entries: FilesystemListEntry[];
  truncated: boolean;
};

const MAX_ENTRIES = 200;

function isFilesystemListInput(value: unknown): value is FilesystemListInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const path = (value as { path?: unknown }).path;
  return path === undefined || typeof path === 'string';
}

/** Rejects a path outside `root` — covers both `../` traversal and an absolute escape. */
function assertWithinRoot(root: string, candidate: string, originalInput: string): void {
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`filesystem_list: "${originalInput}" resolves outside the project root`);
  }
}

/**
 * filesystem_list — lists the immediate entries (files/directories) of one
 * directory within a Work Package's real, resolved `targetPath`. Gives a
 * Specialist a way to discover what actually exists in an unfamiliar
 * codebase rather than guessing exact paths for `filesystem_read` blind —
 * confirmed live as a real gap: a model given real read access but no
 * listing tool and no concrete file names had nothing to explore. Same
 * sandboxing as `filesystem_read`: fails closed with no `targetPath`,
 * rejects `../` traversal and an absolute-path escape, and re-checks
 * containment via `realpath()` after resolving symlinks. Not recursive —
 * one level per call, same as a plain `ls`, so a large tree costs one call
 * per directory rather than one enormous response.
 */
export function createFilesystemListTool(): ToolDefinition<FilesystemListOutput> {
  return {
    name: 'filesystem_list',
    description:
      'List the files and subdirectories directly inside one directory of the real project you are reviewing, ' +
      'by path relative to the project root (e.g. "src", or omit "path" for the project root). Not recursive — ' +
      'call again with a subdirectory path to go deeper. Use this to discover what actually exists before ' +
      'calling filesystem_read.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to the project root. Omit to list the project root itself.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    async handler(input: unknown, ctx: ToolExecutionContext): Promise<FilesystemListOutput> {
      if (!ctx.targetPath) {
        throw new Error(
          'filesystem_list has no real target path configured for this Work Package — nothing can be listed',
        );
      }
      if (!isFilesystemListInput(input)) {
        throw new Error('filesystem_list requires "path" to be a string when provided');
      }
      // An empty string is treated the same as omitting "path" (list the
      // project root) rather than rejected — confirmed live against a real
      // model that both omits "path" and sends "" interchangeably to mean
      // the same thing.
      const requestedPath = input.path && input.path.trim().length > 0 ? input.path : '.';
      if (isAbsolute(requestedPath)) {
        throw new Error('filesystem_list requires a path relative to the project root, not an absolute path');
      }

      const root = await realpath(ctx.targetPath);
      const resolved = resolve(root, requestedPath);
      assertWithinRoot(root, resolved, requestedPath);

      let real: string;
      try {
        real = await realpath(resolved);
      } catch {
        throw new Error(`filesystem_list: "${requestedPath}" does not exist`);
      }
      assertWithinRoot(root, real, requestedPath);

      let dirents;
      try {
        dirents = await readdir(real, { withFileTypes: true });
      } catch (err) {
        throw new Error(
          `filesystem_list: "${requestedPath}" is not a directory (${err instanceof Error ? err.message : String(err)})`,
        );
      }

      const sorted = dirents
        .map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? ('directory' as const) : entry.isFile() ? ('file' as const) : ('other' as const),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        path: requestedPath,
        entries: sorted.slice(0, MAX_ENTRIES),
        truncated: sorted.length > MAX_ENTRIES,
      };
    },
  };
}
