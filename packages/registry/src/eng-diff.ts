import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSafeProjectRelativePath } from './eng-scope.js';

/**
 * Explicit change-set entry (intake / specialist contract).
 *
 * There is no LLM code generator in this deterministic registry — callers must supply
 * the intended replacement content. `proposedDiff` is rendered for human review;
 * apply uses this structured contract (never a free-form patch parser).
 *
 * - `expectedContent: null` → create (file must not exist)
 * - `expectedContent: string` → modify (file must match content, and `expectedHash` when set)
 */
export type EngChangeSetEntry = {
  path: string;
  expectedContent: string | null;
  /** sha256 hex of expectedContent (or of empty string when creating). Optional but preferred. */
  expectedHash?: string;
  /** Replacement / new file contents. */
  content: string;
  note?: string;
};

export type EngResolvedEdit = {
  path: string;
  action: 'create' | 'modify';
  /** Null for new files. */
  before: string | null;
  after: string;
  expectedHash?: string;
  note: string;
};

export type EngEditResolution = {
  edits: EngResolvedEdit[];
  problems: string[];
};

const CONTEXT_LINES = 3;

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split(/\r?\n/);
}

/**
 * Read current files and resolve each change-set entry against disk.
 * Problems are returned rather than thrown so the runner can flag the package.
 */
export async function resolveEngChangeSet(input: {
  root: string;
  changes: EngChangeSetEntry[];
}): Promise<EngEditResolution> {
  const edits: EngResolvedEdit[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const change of input.changes) {
    const path = change.path.trim().replace(/\\/g, '/');
    if (!isSafeProjectRelativePath(input.root, path)) {
      problems.push(`Unsafe change path rejected: ${change.path}`);
      continue;
    }
    if (seen.has(path)) {
      problems.push(`Duplicate change path: ${path}`);
      continue;
    }
    seen.add(path);

    if (typeof change.content !== 'string') {
      problems.push(`Change for ${path} is missing replacement content`);
      continue;
    }

    let before: string | null = null;
    try {
      before = await readFile(join(input.root, path), 'utf8');
    } catch {
      before = null;
    }

    if (change.expectedContent === null) {
      if (before !== null) {
        problems.push(`Create change for ${path} but the file already exists`);
        continue;
      }
      if (change.expectedHash && change.expectedHash !== contentHash('')) {
        problems.push(`Create change for ${path} has unexpected expectedHash`);
        continue;
      }
      edits.push({
        path,
        action: 'create',
        before: null,
        after: change.content,
        expectedHash: change.expectedHash,
        note: change.note?.trim() || 'New file',
      });
      continue;
    }

    if (typeof change.expectedContent !== 'string') {
      problems.push(`Modify change for ${path} needs expectedContent string or null for create`);
      continue;
    }

    if (before === null) {
      problems.push(`Modify change for ${path} but the file does not exist`);
      continue;
    }

    if (before !== change.expectedContent) {
      problems.push(
        `Stale base content for ${path} — expectedContent does not match the file on disk`,
      );
      continue;
    }

    const actualHash = contentHash(before);
    if (change.expectedHash && change.expectedHash !== actualHash) {
      problems.push(
        `Stale base hash for ${path} — expectedHash ${change.expectedHash.slice(0, 12)}… does not match`,
      );
      continue;
    }

    if (change.content === before) {
      problems.push(`Modify change for ${path} is a no-op`);
      continue;
    }

    edits.push({
      path,
      action: 'modify',
      before,
      after: change.content,
      expectedHash: change.expectedHash ?? actualHash,
      note: change.note?.trim() || 'Full-file replacement',
    });
  }

  return { edits, problems };
}

type ChangedRegion = {
  beforeLines: string[];
  afterLines: string[];
  prefix: number;
  suffix: number;
};

function changedRegion(before: string | null, after: string): ChangedRegion {
  const beforeLines = splitLines(before ?? '');
  const afterLines = splitLines(after);

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return { beforeLines, afterLines, prefix, suffix };
}

/** Human-readable unified diff for review — not used as an apply input. */
function fileDiff(edit: EngResolvedEdit): string {
  const { beforeLines, afterLines, prefix, suffix } = changedRegion(edit.before, edit.after);

  const contextStart = Math.max(0, prefix - CONTEXT_LINES);
  const beforeEnd = Math.min(beforeLines.length, beforeLines.length - suffix + CONTEXT_LINES);

  const leadingContext = beforeLines.slice(contextStart, prefix);
  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);
  const trailingContext = beforeLines.slice(beforeLines.length - suffix, beforeEnd);

  const oldCount = leadingContext.length + removed.length + trailingContext.length;
  const newCount = leadingContext.length + added.length + trailingContext.length;
  const oldStart = oldCount === 0 ? 0 : contextStart + 1;
  const newStart = newCount === 0 ? 0 : contextStart + 1;

  const oldPath = edit.action === 'create' ? '/dev/null' : `a/${edit.path}`;
  const lines = [
    `diff --git a/${edit.path} b/${edit.path}`,
    ...(edit.action === 'create' ? ['new file mode 100644'] : []),
    `--- ${oldPath}`,
    `+++ b/${edit.path}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    ...leadingContext.map((l) => ` ${l}`),
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
    ...trailingContext.map((l) => ` ${l}`),
  ];

  return lines.join('\n');
}

export function buildProposedDiff(edits: EngResolvedEdit[]): string {
  if (edits.length === 0) return '';
  return `${edits.map(fileDiff).join('\n')}\n`;
}

export function summarizeEditStats(edits: EngResolvedEdit[]): {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
} {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const edit of edits) {
    const { beforeLines, afterLines, prefix, suffix } = changedRegion(edit.before, edit.after);
    linesRemoved += beforeLines.length - suffix - prefix;
    linesAdded += afterLines.length - suffix - prefix;
  }
  return { filesChanged: edits.length, linesAdded, linesRemoved };
}

/**
 * Re-validate that the live project still matches the resolved base before applying.
 */
export async function assertEditsStillFresh(input: {
  root: string;
  edits: EngResolvedEdit[];
}): Promise<string[]> {
  const problems: string[] = [];
  for (const edit of input.edits) {
    if (!isSafeProjectRelativePath(input.root, edit.path)) {
      problems.push(`Unsafe path at apply time: ${edit.path}`);
      continue;
    }
    let current: string | null = null;
    try {
      current = await readFile(join(input.root, edit.path), 'utf8');
    } catch {
      current = null;
    }
    if (edit.action === 'create') {
      if (current !== null) {
        problems.push(`Create blocked — ${edit.path} now exists`);
      }
      continue;
    }
    if (current === null) {
      problems.push(`Modify blocked — ${edit.path} is missing`);
      continue;
    }
    if (current !== edit.before) {
      problems.push(`Stale base for ${edit.path} — file changed since the work package was built`);
      continue;
    }
    if (edit.expectedHash && contentHash(current) !== edit.expectedHash) {
      problems.push(`Stale hash for ${edit.path}`);
    }
  }
  return problems;
}
