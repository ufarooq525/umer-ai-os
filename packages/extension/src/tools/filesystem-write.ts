import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export type FilesystemWriteInput = {
  path: string;
  content: string;
};

export type FilesystemWriteOutput = {
  path: string;
  bytesWritten: number;
};

const MAX_BYTES = 2_000_000;

function isFilesystemWriteInput(value: unknown): value is FilesystemWriteInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { path?: unknown }).path === 'string' &&
    (value as { path: string }).path.trim().length > 0 &&
    typeof (value as { content?: unknown }).content === 'string'
  );
}

/** The first dot-segment of a specialistId (e.g. "ux.design" -> "ux", "qa.verify" -> "qa") — a generic, uniform derivation, not a per-specialist lookup table. */
function evidenceSubtreeSlug(specialistId: string): string {
  const [slug] = specialistId.split('.');
  if (!slug) {
    throw new Error(`filesystem_write: cannot derive an evidence subtree from specialistId "${specialistId}"`);
  }
  return slug;
}

/** Rejects a path outside `root` — covers both `../` traversal and an absolute escape. */
function assertWithinRoot(root: string, candidate: string, originalInput: string): void {
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`filesystem_write: "${originalInput}" resolves outside your evidence subtree`);
  }
}

/**
 * filesystem_write — writes one text file under a Specialist's own sealed
 * `.umer/<slug>/` evidence subtree inside the Work Package's real, resolved
 * `targetPath` (see WorkPackageContract's `targetPath` field). `<slug>` is
 * derived generically from the calling specialistId's first dot-segment
 * (e.g. `ux.design` -> `.umer/ux/`, `qa.verify` -> `.umer/qa/`) — never
 * chosen by the model, never a shared or product-code path. Never falls
 * back to an unrestricted root: no `targetPath` configured means no write,
 * full stop. Rejects `../` traversal, an absolute-path escape, and a
 * symlink (in an intermediate directory or at the file itself) that
 * resolves outside the evidence subtree — checked via `realpath()` after
 * every directory-creating step, since a symlink can only be discovered by
 * actually resolving it.
 */
export function createFilesystemWriteTool(): ToolDefinition<FilesystemWriteOutput> {
  return {
    name: 'filesystem_write',
    description:
      'Write one evidence file under your own sealed .umer/<specialist>/ evidence subtree, by path relative to ' +
      'that subtree (e.g. "run-1/FINDINGS.md"). You cannot write anywhere else — not product code, not another ' +
      "specialist's evidence, not outside the project.",
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to your own .umer/<specialist>/ evidence subtree.' },
        content: { type: 'string', description: 'The full text content to write.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    async handler(input: unknown, ctx: ToolExecutionContext): Promise<FilesystemWriteOutput> {
      if (!ctx.targetPath) {
        throw new Error(
          'filesystem_write has no real target path configured for this Work Package — nothing can be written',
        );
      }
      if (!isFilesystemWriteInput(input)) {
        throw new Error('filesystem_write requires a non-empty string "path" and a string "content"');
      }
      if (isAbsolute(input.path)) {
        throw new Error('filesystem_write requires a path relative to your evidence subtree, not an absolute path');
      }
      const byteLength = Buffer.byteLength(input.content, 'utf8');
      if (byteLength > MAX_BYTES) {
        throw new Error(`filesystem_write: content exceeds the ${MAX_BYTES}-byte limit for a single write`);
      }

      const projectRoot = await realpath(ctx.targetPath);
      const slug = evidenceSubtreeSlug(ctx.specialistId);
      const evidenceRoot = resolve(projectRoot, '.umer', slug);
      assertWithinRoot(projectRoot, evidenceRoot, `.umer/${slug}`);

      const resolved = resolve(evidenceRoot, input.path);
      assertWithinRoot(evidenceRoot, resolved, input.path);

      await mkdir(dirname(resolved), { recursive: true });

      const realParentDir = await realpath(dirname(resolved));
      const realEvidenceRoot = await realpath(evidenceRoot);
      assertWithinRoot(projectRoot, realEvidenceRoot, `.umer/${slug}`);
      assertWithinRoot(realEvidenceRoot, realParentDir, input.path);

      try {
        const realExisting = await realpath(resolved);
        assertWithinRoot(realEvidenceRoot, realExisting, input.path);
        const info = await stat(realExisting);
        if (info.isDirectory()) {
          throw new Error(`filesystem_write: "${input.path}" is a directory, not a file`);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }

      await writeFile(resolved, input.content, 'utf8');
      return {
        path: `.umer/${slug}/${input.path}`.replace(/\\/g, '/'),
        bytesWritten: byteLength,
      };
    },
  };
}
