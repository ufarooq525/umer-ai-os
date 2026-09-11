/**
 * Code producer port — the seam where "a goal" becomes "an explicit change-set".
 *
 * The registry stays deterministic: it validates, stages, diffs, and applies change-sets,
 * but never invents code. Anything that *writes* code (an LLM adapter, a scripted
 * generator, a human paste) implements {@link CodeProducer} and is injected into
 * `runEngDelivery`. Whatever a producer returns is treated as untrusted input and must
 * survive {@link validateProducedChangeSet} plus the normal change-set resolution.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash, type EngChangeSetEntry } from './eng-diff.js';
import { isSafeProjectRelativePath } from './eng-scope.js';
import type { ProjectCategory } from './types.js';

export type CodeProductionRequest = {
  projectId: string;
  projectName: string;
  /** Absolute project root. Producers must stay inside it. */
  absolutePath: string;
  category: ProjectCategory;
  type: 'feature' | 'bug';
  goal: string;
  doneWhen?: string;
  /** Files the scope resolver already accepted, repo-relative. May be empty. */
  scopeFiles: Array<{ path: string; exists: boolean }>;
  targetModule?: string;
  /** Hard ceiling on unique files the producer may touch. */
  maxFiles: number;
  /** Sandboxed read of a repo-relative file. Null when missing or unsafe. */
  readProjectFile: (relativePath: string) => Promise<string | null>;
  /** Operational learnings or knowledge context to guide generation. */
  knowledgeContext?: string[];
};

export type CodeProductionOutcome =
  | {
      status: 'produced';
      changes: EngChangeSetEntry[];
      notes?: string[];
    }
  | {
      status: 'declined';
      /** Operator-facing explanation of why no code was written. */
      reason: string;
      notes?: string[];
    };

export type CodeProducer = {
  id: string;
  /** One line shown on the work package and in the review UI. */
  describe(): string;
  produce(request: CodeProductionRequest): Promise<CodeProductionOutcome>;
};

/** What a scoped file looks like right now — enough to pin a base without shipping its bytes. */
export type EngChangeSetDraft = {
  path: string;
  action: 'create' | 'modify';
  /** sha256 of current contents (hash of the empty string for a create). */
  expectedHash: string;
  currentBytes: number;
};

/** Recorded on the work package so review shows who wrote the change-set. */
export type EngProductionRecord = {
  producerId: string;
  producerDescription: string;
  /** `skipped` = intake supplied its own change-set, so no producer ran. */
  status: 'produced' | 'declined' | 'skipped';
  reason?: string;
  notes: string[];
  changeCount: number;
  /** Guard failures. Non-empty means the produced change-set was rejected. */
  problems: string[];
  /** Base state of the scoped files, for whoever fills the change-set next. */
  draft: EngChangeSetDraft[];
};

/**
 * Bound reader handed to producers so they cannot escape the project root.
 */
export function createProjectFileReader(root: string) {
  return async (relativePath: string): Promise<string | null> => {
    if (!isSafeProjectRelativePath(root, relativePath)) return null;
    try {
      return await readFile(join(root, relativePath.replace(/\\/g, '/')), 'utf8');
    } catch {
      return null;
    }
  };
}

const EMPTY_HASH = contentHash('');

/**
 * Describe the current state of the scoped files so a producer (or a human) knows
 * exactly which base to pin. Never includes file contents.
 */
export async function buildChangeSetDraft(input: {
  root: string;
  scopeFiles: Array<{ path: string; exists: boolean }>;
  maxFiles: number;
}): Promise<EngChangeSetDraft[]> {
  const draft: EngChangeSetDraft[] = [];
  for (const file of input.scopeFiles.slice(0, input.maxFiles)) {
    if (!isSafeProjectRelativePath(input.root, file.path)) continue;
    let current: string | null = null;
    try {
      current = await readFile(join(input.root, file.path), 'utf8');
    } catch {
      current = null;
    }
    draft.push(
      current === null
        ? { path: file.path, action: 'create', expectedHash: EMPTY_HASH, currentBytes: 0 }
        : {
            path: file.path,
            action: 'modify',
            expectedHash: contentHash(current),
            currentBytes: Buffer.byteLength(current, 'utf8'),
          },
    );
  }
  return draft;
}

/**
 * Structural guard for producer output, applied before the change-set reaches disk
 * resolution. Returns problems rather than throwing so the work package can report them.
 */
export function validateProducedChangeSet(input: {
  root: string;
  changes: EngChangeSetEntry[];
  maxFiles: number;
  /** When set, produced paths must be inside this declared scope. */
  allowedPaths?: string[];
}): string[] {
  const problems: string[] = [];

  if (input.changes.length === 0) {
    problems.push('producer returned an empty change-set');
    return problems;
  }

  const allowed = input.allowedPaths ? new Set(input.allowedPaths) : undefined;
  const seen = new Set<string>();

  for (const change of input.changes) {
    const path = String(change.path ?? '')
      .trim()
      .replace(/\\/g, '/');
    if (!path) {
      problems.push('produced change is missing a path');
      continue;
    }
    if (!isSafeProjectRelativePath(input.root, path)) {
      problems.push(`produced change targets an unsafe path: ${path}`);
      continue;
    }
    if (seen.has(path)) {
      problems.push(`produced change-set repeats ${path}`);
      continue;
    }
    seen.add(path);
    if (allowed && !allowed.has(path)) {
      problems.push(`produced change targets ${path}, outside the declared scope`);
    }
    if (typeof change.content !== 'string' || change.content.length === 0) {
      problems.push(`produced change for ${path} has no replacement content`);
    }
    if (change.expectedContent !== null && typeof change.expectedContent !== 'string') {
      problems.push(`produced change for ${path} must set expectedContent (string, or null to create)`);
    }
    if (change.expectedHash && !/^[a-f0-9]{64}$/i.test(change.expectedHash)) {
      problems.push(`produced change for ${path} has a malformed expectedHash`);
    }
  }

  if (seen.size > input.maxFiles) {
    problems.push(`produced change-set spans ${seen.size} files (limit ${input.maxFiles})`);
  }

  return problems;
}

/**
 * Default producer: writes nothing, and says exactly what is needed instead.
 *
 * This is the honest no-LLM state of the system — eng can validate, stage, diff, gate,
 * and apply a change-set, but something still has to author it. Swap in another adapter
 * (or pass `proposedChanges` from intake) to close the loop.
 */
export function createManualCodeProducer(): CodeProducer {
  return {
    id: 'manual.human-change-set',
    describe() {
      return 'Manual change-set — no automated code generator is configured for this repo';
    },
    async produce(request) {
      const scoped = request.scopeFiles.map((f) => f.path);
      const notes = [
        scoped.length > 0
          ? `Scope is ready: ${scoped.join(', ')}`
          : 'No target files were named, so nothing is scoped yet',
        `Supply proposedChanges (max ${request.maxFiles} files) with expectedContent + content`,
        'Pin each modify against the draft expectedHash to avoid applying over a stale base',
      ];
      return {
        status: 'declined',
        reason:
          'No code generator is configured — eng.app-delivery will not invent code. Supply an explicit change-set, or configure a code producer.',
        notes,
      };
    },
  };
}

/**
 * Producer around a fixed (or computed) change-set. Deterministic, so it is the adapter
 * used by tests and by scripted/recipe automation that already knows the exact edit.
 */
export function createScriptedCodeProducer(input: {
  id?: string;
  description?: string;
  changes:
    | EngChangeSetEntry[]
    | ((request: CodeProductionRequest) => Promise<EngChangeSetEntry[]> | EngChangeSetEntry[]);
  notes?: string[];
}): CodeProducer {
  return {
    id: input.id ?? 'scripted.change-set',
    describe() {
      return input.description ?? 'Scripted change-set supplied by the caller';
    },
    async produce(request) {
      const changes =
        typeof input.changes === 'function' ? await input.changes(request) : input.changes;
      if (changes.length === 0) {
        return {
          status: 'declined',
          reason: 'Scripted producer had no change for this request',
          notes: input.notes ?? [],
        };
      }
      return { status: 'produced', changes, notes: input.notes ?? [] };
    },
  };
}
