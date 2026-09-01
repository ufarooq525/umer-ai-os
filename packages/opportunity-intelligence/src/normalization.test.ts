import { describe, expect, it } from 'vitest';
import { deduplicateCandidates } from './dedup.js';
import { normalizeBusinessName, normalizeWebsite } from './normalization.js';

describe('candidate normalization', () => {
  it('normalizes websites without losing meaningful paths', () => {
    expect(normalizeWebsite('HTTPS://WWW.Example.com/pricing/?ref=google#top')).toBe('https://example.com/pricing');
  });

  it('preserves non-Latin business names', () => {
    expect(normalizeBusinessName(' شركة النقل السعودية ')).toContain('شركة النقل السعودية');
  });

  it('deduplicates by normalized website and merges source references', () => {
    const result = deduplicateCandidates([
      {
        name: 'Saudi Transport',
        geography: 'Saudi Arabia',
        websiteUrl: 'https://www.example.com/',
        sourceRefs: ['search:1'],
      },
      {
        name: 'SAUDI TRANSPORT',
        geography: 'Saudi Arabia',
        websiteUrl: 'https://example.com',
        industry: 'Transport',
        sourceRefs: ['directory:2'],
      },
    ]);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.unique[0]?.sourceRefs).toEqual(['search:1', 'directory:2']);
    expect(result.unique[0]?.industry).toBe('Transport');
  });
});
