import { describe, expect, it } from 'vitest';
import { createProcessRecommendTool } from './process-recommend.js';
import type { ToolExecutionContext } from '../types.js';

const ctx: ToolExecutionContext = { specialistId: 'qa.verify', workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call-1' };

describe('createProcessRecommendTool', () => {
  it('classifies a known read-only verification command as allowlisted', async () => {
    const tool = createProcessRecommendTool();
    const result = await tool.handler(
      { command: 'npx playwright test', rationale: 'Covers the smoke journeys for this project.' },
      ctx,
    );
    expect(result).toEqual({
      command: 'npx playwright test',
      rationale: 'Covers the smoke journeys for this project.',
      allowlisted: true,
      note: expect.stringContaining('did not execute it'),
    });
  });

  it('classifies an unrecognized command as not allowlisted, still without executing it', async () => {
    const tool = createProcessRecommendTool();
    const result = await tool.handler(
      { command: 'rm -rf /', rationale: 'This is not actually a verification command.' },
      ctx,
    );
    expect(result.allowlisted).toBe(false);
    expect(result.note).toContain('flag for human review');
  });

  it('matches an allowlisted prefix followed by extra arguments', async () => {
    const tool = createProcessRecommendTool();
    const result = await tool.handler(
      { command: './vendor/bin/phpunit --testsuite=Feature', rationale: 'Runs the Feature test suite.' },
      ctx,
    );
    expect(result.allowlisted).toBe(true);
  });

  it('does not treat a prefix-only substring match as allowlisted (must match on a word boundary)', async () => {
    const tool = createProcessRecommendTool();
    const result = await tool.handler(
      { command: 'npm testing-something-else', rationale: 'Looks similar but is not the real command.' },
      ctx,
    );
    expect(result.allowlisted).toBe(false);
  });

  it('rejects malformed input missing "command"', async () => {
    const tool = createProcessRecommendTool();
    await expect(tool.handler({ rationale: 'no command supplied' }, ctx)).rejects.toThrow(
      /requires a non-empty string "command" and "rationale"/,
    );
  });

  it('rejects malformed input missing "rationale"', async () => {
    const tool = createProcessRecommendTool();
    await expect(tool.handler({ command: 'npm test' }, ctx)).rejects.toThrow(
      /requires a non-empty string "command" and "rationale"/,
    );
  });

  it('trims whitespace from both command and rationale', async () => {
    const tool = createProcessRecommendTool();
    const result = await tool.handler({ command: '  npm test  ', rationale: '  Runs unit tests.  ' }, ctx);
    expect(result.command).toBe('npm test');
    expect(result.rationale).toBe('Runs unit tests.');
  });
});
