import { describe, expect, it } from 'vitest';
import { normalizeHttpUrl } from './website-probe';

describe('normalizeHttpUrl', () => {
  it('adds https when the scheme is missing', () => {
    expect(normalizeHttpUrl('mawasmm.com')).toBe('https://mawasmm.com');
  });

  it('keeps an explicit http URL', () => {
    expect(normalizeHttpUrl('http://mawasmm.com')).toBe('http://mawasmm.com');
  });
});
