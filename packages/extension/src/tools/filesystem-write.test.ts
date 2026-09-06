import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilesystemWriteTool } from './filesystem-write.js';
import type { ToolExecutionContext } from '../types.js';

function ctx(specialistId: string, targetPath?: string): ToolExecutionContext {
  return { specialistId, workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call-1', targetPath };
}

describe('createFilesystemWriteTool', () => {
  let root: string;
  let outsideDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'umer-fs-write-root-'));
    outsideDir = await mkdtemp(join(tmpdir(), 'umer-fs-write-outside-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it('writes a file under its own .umer/<slug>/ evidence subtree, derived from the specialistId', async () => {
    const tool = createFilesystemWriteTool();
    const result = await tool.handler(
      { path: 'run-1/FINDINGS.md', content: '# Findings\n' },
      ctx('ux.design', root),
    );
    expect(result).toEqual({ path: '.umer/ux/run-1/FINDINGS.md', bytesWritten: Buffer.byteLength('# Findings\n') });
    const written = await readFile(join(root, '.umer', 'ux', 'run-1', 'FINDINGS.md'), 'utf8');
    expect(written).toBe('# Findings\n');
  });

  it('derives a different subtree for a different specialist', async () => {
    const tool = createFilesystemWriteTool();
    await tool.handler({ path: 'TEST_PLAN.md', content: 'plan' }, ctx('qa.verify', root));
    const written = await readFile(join(root, '.umer', 'qa', 'TEST_PLAN.md'), 'utf8');
    expect(written).toBe('plan');
  });

  it('creates intermediate directories automatically', async () => {
    const tool = createFilesystemWriteTool();
    await tool.handler({ path: 'a/b/c/deep.md', content: 'deep' }, ctx('ux.design', root));
    const written = await readFile(join(root, '.umer', 'ux', 'a', 'b', 'c', 'deep.md'), 'utf8');
    expect(written).toBe('deep');
  });

  it('fails closed when no targetPath is configured', async () => {
    const tool = createFilesystemWriteTool();
    await expect(
      tool.handler({ path: 'FINDINGS.md', content: 'x' }, ctx('ux.design', undefined)),
    ).rejects.toThrow(/no real target path/);
  });

  it('rejects a relative path that escapes its evidence subtree via ../', async () => {
    const tool = createFilesystemWriteTool();
    await expect(
      tool.handler({ path: '../../secret.txt', content: 'x' }, ctx('ux.design', root)),
    ).rejects.toThrow(/outside your evidence subtree/);
  });

  it('rejects an absolute path outright', async () => {
    const tool = createFilesystemWriteTool();
    await expect(
      tool.handler({ path: join(outsideDir, 'secret.txt'), content: 'x' }, ctx('ux.design', root)),
    ).rejects.toThrow(/relative to your evidence subtree/);
  });

  it('one specialist cannot write into another specialist\'s evidence subtree via traversal', async () => {
    const tool = createFilesystemWriteTool();
    await expect(
      tool.handler({ path: '../qa/steal.md', content: 'x' }, ctx('ux.design', root)),
    ).rejects.toThrow(/outside your evidence subtree/);
  });

  it('rejects content over the size limit', async () => {
    const tool = createFilesystemWriteTool();
    const huge = 'x'.repeat(2_000_001);
    await expect(tool.handler({ path: 'huge.md', content: huge }, ctx('ux.design', root))).rejects.toThrow(
      /exceeds the .*-byte limit/,
    );
  });

  it('rejects writing to a path that is already a directory', async () => {
    await mkdir(join(root, '.umer', 'ux', 'run-1'), { recursive: true });
    const tool = createFilesystemWriteTool();
    await expect(tool.handler({ path: 'run-1', content: 'x' }, ctx('ux.design', root))).rejects.toThrow(
      /is a directory, not a file/,
    );
  });

  it('rejects a symlinked evidence subtree that points outside the project root', async () => {
    await mkdir(join(root, '.umer'), { recursive: true });
    try {
      await symlink(outsideDir, join(root, '.umer', 'ux'), 'dir');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') {
        return;
      }
      throw err;
    }
    const tool = createFilesystemWriteTool();
    await expect(tool.handler({ path: 'FINDINGS.md', content: 'x' }, ctx('ux.design', root))).rejects.toThrow(
      /outside/,
    );
  });

  it('rejects malformed input missing "content"', async () => {
    const tool = createFilesystemWriteTool();
    await expect(tool.handler({ path: 'FINDINGS.md' }, ctx('ux.design', root))).rejects.toThrow(
      /requires a non-empty string "path" and a string "content"/,
    );
  });

  it('rejects malformed input missing "path"', async () => {
    const tool = createFilesystemWriteTool();
    await expect(tool.handler({ content: 'x' }, ctx('ux.design', root))).rejects.toThrow(
      /requires a non-empty string "path" and a string "content"/,
    );
  });

  it('overwrites an existing file at the same path', async () => {
    const tool = createFilesystemWriteTool();
    await tool.handler({ path: 'FINDINGS.md', content: 'first' }, ctx('ux.design', root));
    await tool.handler({ path: 'FINDINGS.md', content: 'second' }, ctx('ux.design', root));
    const written = await readFile(join(root, '.umer', 'ux', 'FINDINGS.md'), 'utf8');
    expect(written).toBe('second');
  });
});
