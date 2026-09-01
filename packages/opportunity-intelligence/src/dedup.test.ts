import { describe, expect, it } from 'vitest';
import { deduplicateCandidates } from './dedup.js';

const candidate = (overrides: Record<string, unknown> = {}) => ({
  name: 'ABC Transport',
  geography: 'Saudi Arabia',
  websiteUrl: 'https://abc.example.com/',
  sourceRefs: ['search:1'],
  ...overrides,
});

describe('deduplicateCandidates', () => {
  it('deduplicates by website when no external id exists', () => {
    const result = deduplicateCandidates([
      candidate(),
      candidate({ name: 'ABC Transport KSA', sourceRefs: ['directory:2'] }),
    ]);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('uses external ids when available', () => {
    const result = deduplicateCandidates([
      candidate({ externalId: 'ABC-1', websiteUrl: 'https://one.example.com' }),
      candidate({ externalId: ' abc-1 ', websiteUrl: 'https://two.example.com' }),
    ]);

    expect(result.unique).toHaveLength(1);
  });

  it('keeps different businesses with distinct normalized keys', () => {
    const result = deduplicateCandidates([
      candidate({ name: 'ABC Transport', websiteUrl: undefined }),
      candidate({ name: 'XYZ Transport', websiteUrl: undefined }),
    ]);

    expect(result.unique).toHaveLength(2);
  });
});
