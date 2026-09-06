import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilesystemReadTool } from './filesystem-read.js';
import type { ToolExecutionContext } from '../types.js';

function ctx(targetPath?: string): ToolExecutionContext {
  return { specialistId: 'ux.design', workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call-1', targetPath };
}

describe('createFilesystemReadTool', () => {
  let root: string;
  let outsideDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'umer-fs-read-root-'));
    outsideDir = await mkdtemp(join(tmpdir(), 'umer-fs-read-outside-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'app.tsx'), 'export const App = () => null;\n', 'utf8');
    await writeFile(join(outsideDir, 'secret.txt'), 'do not read me', 'utf8');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it('reads a real file within the project root', async () => {
    const tool = createFilesystemReadTool();
    const result = await tool.handler({ path: 'src/app.tsx' }, ctx(root));
    expect(result).toMatchObject({ path: 'src/app.tsx', truncated: false });
    expect(result.content).toContain('export const App');
  });

  it('fails closed when no targetPath is configured, before even looking at the path argument', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: 'src/app.tsx' }, ctx(undefined))).rejects.toThrow(/no real target path/);
  });

  it('rejects a relative path that escapes the root via ../', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: '../secret.txt' }, ctx(root))).rejects.toThrow(/outside the project root/);
  });

  it('rejects an absolute path outright', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: join(outsideDir, 'secret.txt') }, ctx(root))).rejects.toThrow(
      /relative to the project root/,
    );
  });

  it('rejects a symlink inside the root that points outside it', async () => {
    // Creating a symlink needs elevated privileges / Developer Mode on
    // Windows — skip gracefully in an environment that doesn't grant it
    // rather than fail on an environment limitation unrelated to the tool's
    // own logic (the same realpath()-based containment check below also
    // covers the non-symlink escape tests, which do run everywhere).
    try {
      await symlink(join(outsideDir, 'secret.txt'), join(root, 'escape-link.txt'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') {
        return;
      }
      throw err;
    }
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: 'escape-link.txt' }, ctx(root))).rejects.toThrow(/outside the project root/);
  });

  it('rejects a path that does not exist', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: 'src/missing.tsx' }, ctx(root))).rejects.toThrow(/does not exist/);
  });

  it('rejects a directory (not a regular file)', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({ path: 'src' }, ctx(root))).rejects.toThrow(/not a regular file/);
  });

  it('rejects a malformed input with no path', async () => {
    const tool = createFilesystemReadTool();
    await expect(tool.handler({}, ctx(root))).rejects.toThrow(/requires a non-empty string "path"/);
  });
});
