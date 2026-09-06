import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilesystemListTool } from './filesystem-list.js';
import type { ToolExecutionContext } from '../types.js';

function ctx(targetPath?: string): ToolExecutionContext {
  return { specialistId: 'ux.design', workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call-1', targetPath };
}

describe('createFilesystemListTool', () => {
  let root: string;
  let outsideDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'umer-fs-list-root-'));
    outsideDir = await mkdtemp(join(tmpdir(), 'umer-fs-list-outside-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'app.tsx'), 'export const App = () => null;\n', 'utf8');
    await writeFile(join(root, 'README.md'), '# demo\n', 'utf8');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it('lists the project root when no path is given', async () => {
    const tool = createFilesystemListTool();
    const result = await tool.handler({}, ctx(root));
    expect(result.path).toBe('.');
    expect(result.truncated).toBe(false);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        { name: 'src', type: 'directory' },
        { name: 'README.md', type: 'file' },
      ]),
    );
  });

  it('treats an empty-string path the same as omitting it — confirmed live, a real model sends both interchangeably', async () => {
    const tool = createFilesystemListTool();
    const result = await tool.handler({ path: '' }, ctx(root));
    expect(result.path).toBe('.');
    expect(result.entries).toEqual(
      expect.arrayContaining([
        { name: 'src', type: 'directory' },
        { name: 'README.md', type: 'file' },
      ]),
    );
  });

  it('lists a real subdirectory', async () => {
    const tool = createFilesystemListTool();
    const result = await tool.handler({ path: 'src' }, ctx(root));
    expect(result.entries).toEqual([{ name: 'app.tsx', type: 'file' }]);
  });

  it('returns entries sorted alphabetically', async () => {
    await writeFile(join(root, 'zeta.txt'), '', 'utf8');
    await writeFile(join(root, 'alpha.txt'), '', 'utf8');
    const tool = createFilesystemListTool();
    const result = await tool.handler({}, ctx(root));
    const names = result.entries.map((e) => e.name);
    expect(names.indexOf('alpha.txt')).toBeLessThan(names.indexOf('zeta.txt'));
  });

  it('fails closed when no targetPath is configured', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({}, ctx(undefined))).rejects.toThrow(/no real target path/);
  });

  it('rejects a relative path that escapes the root via ../', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: '../' }, ctx(root))).rejects.toThrow(/outside the project root/);
  });

  it('rejects an absolute path outright', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: outsideDir }, ctx(root))).rejects.toThrow(/relative to the project root/);
  });

  it('rejects a symlink inside the root that points outside it', async () => {
    try {
      await symlink(outsideDir, join(root, 'escape-link'), 'dir');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') {
        return;
      }
      throw err;
    }
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: 'escape-link' }, ctx(root))).rejects.toThrow(/outside the project root/);
  });

  it('rejects a path that does not exist', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: 'does-not-exist' }, ctx(root))).rejects.toThrow(/does not exist/);
  });

  it('rejects a path that is a file, not a directory', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: 'README.md' }, ctx(root))).rejects.toThrow(/is not a directory/);
  });

  it('rejects malformed input with a non-string path', async () => {
    const tool = createFilesystemListTool();
    await expect(tool.handler({ path: 42 }, ctx(root))).rejects.toThrow(/"path" to be a string/);
  });

  it('truncates beyond the entry cap', async () => {
    const bigDir = join(root, 'big');
    await mkdir(bigDir);
    for (let i = 0; i < 205; i += 1) {
      await writeFile(join(bigDir, `file-${String(i).padStart(3, '0')}.txt`), '', 'utf8');
    }
    const tool = createFilesystemListTool();
    const result = await tool.handler({ path: 'big' }, ctx(root));
    expect(result.entries).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });
});
