import { describe, expect, it } from 'vitest';
import {
  buildBusinessIdentity,
  createBusinessId,
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
  resolveIdentity,
} from './identity.js';

describe('business identity', () => {
  it('canonicalizes websites and removes common tracking parameters', () => {
    expect(normalizeWebsite('HTTPS://WWW.Example.com/path/?utm_source=x&fbclid=abc')).toBe('https://example.com/path');
    expect(normalizeWebsite('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('normalizes Arabic, Urdu and Chinese Unicode without destroying letters', () => {
    expect(normalizeBusinessName('  فندق ـ مكة  ')).toBe('فندق مكة');
    expect(normalizeBusinessName('  ہوٹل، لاہور  ')).toBe('ہوٹل لاہور');
    expect(normalizeBusinessName('北京  酒店')).toBe('北京 酒店');
  });

  it('normalizes phone and email conservatively', () => {
    expect(normalizePhone('+92 (300) 123-4567')).toBe('+923001234567');
    expect(normalizePhone('0300 1234567', '92')).toBe('+923001234567');
    expect(normalizeEmail('  Sales@Example.COM ')).toBe('sales@example.com');
  });

  it('creates deterministic SHA-256 business IDs', () => {
    const a = { name: 'Example Hotel', geography: 'Makkah, Saudi Arabia', websiteUrl: 'https://www.example.com/?utm_source=x' };
    const b = { name: 'Example Hotel', geography: 'Makkah, Saudi Arabia', websiteUrl: 'https://example.com/' };
    expect(createBusinessId(a)).toBe(createBusinessId(b));
    expect(createBusinessId(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses strong identity signals before name/geography', () => {
    const a = { name: 'ABC Hotel', geography: 'Makkah', websiteUrl: 'https://abc.example' };
    const b = { name: 'Different Display Name', geography: 'Madinah', websiteUrl: 'https://abc.example/' };
    expect(resolveIdentity(a, b)).toBe('DEFINITE_MATCH');
  });

  it('does not merge same-name businesses across geography automatically', () => {
    const a = { name: 'ABC Hotel', geography: 'Makkah' };
    const b = { name: 'ABC Hotel', geography: 'Madinah' };
    expect(resolveIdentity(a, b)).toBe('POSSIBLE_MATCH');
  });

  it('builds an inspectable identity record', () => {
    const identity = buildBusinessIdentity({ name: 'ABC', geography: 'Jeddah', websiteUrl: 'https://abc.example' });
    expect(identity.id).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.canonicalWebsite).toBe('https://abc.example');
    expect(identity.signals).toContain('canonical_domain');
  });
});
