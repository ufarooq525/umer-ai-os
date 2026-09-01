import { describe, expect, it } from 'vitest';
import { createMySqlExecutor } from './index.js';
import { OPPORTUNITY_MIGRATIONS } from './migrations.js';

describe('@umer/db MySQL integration boundary', () => {
  it('unwraps mysql2 execute results for the driver-agnostic executor', async () => {
    const pool = {
      execute: async () => [[{ ok: 1 }], []],
    } as never;

    const executor = createMySqlExecutor(pool);
    await expect(executor.execute<{ ok: number }[]>('SELECT 1')).resolves.toEqual([{ ok: 1 }]);
  });

  it('defines a stable, versioned Opportunity Intelligence migration', () => {
    expect(OPPORTUNITY_MIGRATIONS).toHaveLength(1);
    expect(OPPORTUNITY_MIGRATIONS[0]?.id).toBe('001_opportunity_intelligence');
    expect(OPPORTUNITY_MIGRATIONS[0]?.checksum).toHaveLength(64);
    expect(OPPORTUNITY_MIGRATIONS[0]?.statements).toHaveLength(6);
    expect(OPPORTUNITY_MIGRATIONS[0]?.statements[0]).toContain('CREATE TABLE IF NOT EXISTS opportunity_niches');
    expect(OPPORTUNITY_MIGRATIONS[0]?.statements[5]).toContain('CREATE TABLE IF NOT EXISTS opportunity_niche_runs');
  });
});
