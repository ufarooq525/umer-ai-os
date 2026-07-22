import { describe, expect, it } from 'vitest';
import {
  ContractError,
  createTimestamps,
  deserializeContract,
  emptyMetadata,
  formatUnknownError,
  freezeContract,
  nowIso,
  parseContract,
  safeParseContract,
  serializeContract,
  touchTimestamps,
  SCHEMA_VERSION,
  CONTRACTS_VERSION,
} from '../index.js';
import { z } from 'zod';

describe('version', () => {
  it('exports stable package and schema versions', () => {
    expect(CONTRACTS_VERSION).toBe('1.0.0');
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });
});

describe('timestamps', () => {
  it('creates and touches timestamps', () => {
    const t0 = createTimestamps('2026-07-22T00:00:00.000Z');
    expect(t0.createdAt).toBe('2026-07-22T00:00:00.000Z');
    const t1 = touchTimestamps(t0, '2026-07-22T01:00:00.000Z');
    expect(t1.createdAt).toBe(t0.createdAt);
    expect(t1.updatedAt).toBe('2026-07-22T01:00:00.000Z');
  });

  it('nowIso returns ISO string', () => {
    expect(() => Date.parse(nowIso())).not.toThrow();
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false);
  });
});

describe('metadata', () => {
  it('emptyMetadata returns empty maps', () => {
    expect(emptyMetadata()).toEqual({ labels: {}, annotations: {} });
  });
});

describe('serialize / parse', () => {
  const schema = z.object({ a: z.number() }).strict();

  it('parseContract returns data', () => {
    expect(parseContract(schema, { a: 1 })).toEqual({ a: 1 });
  });

  it('parseContract throws ContractError', () => {
    expect(() => parseContract(schema, { a: 'x' })).toThrow(ContractError);
  });

  it('safeParseContract success and failure', () => {
    const ok = safeParseContract(schema, { a: 2 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.a).toBe(2);

    const bad = safeParseContract(schema, {});
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.code).toBe('VALIDATION_FAILED');
      expect(bad.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('serialize and deserialize round-trip', () => {
    const raw = serializeContract({ a: 3 });
    expect(deserializeContract(schema, raw)).toEqual({ a: 3 });
  });

  it('deserializeContract fails on invalid JSON', () => {
    expect(() => deserializeContract(schema, '{')).toThrow(ContractError);
    try {
      deserializeContract(schema, '{');
    } catch (e) {
      expect(e).toBeInstanceOf(ContractError);
      const err = e as ContractError;
      expect(err.code).toBe('PARSE_FAILED');
      expect(err.toJSON().code).toBe('PARSE_FAILED');
    }
  });

  it('deserializeContract fails on schema mismatch', () => {
    expect(() => deserializeContract(schema, '{"a":"no"}')).toThrow(ContractError);
  });

  it('serializeContract fails on circular structures', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => serializeContract(circular)).toThrow(ContractError);
    try {
      serializeContract(circular);
    } catch (e) {
      const err = e as ContractError;
      expect(err.code).toBe('SERIALIZE_FAILED');
      expect(err.toJSON().cause).toBeTruthy();
    }
  });

  it('freezeContract deep-freezes objects', () => {
    const value = freezeContract({ a: 1, nested: { b: 2 } });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.nested)).toBe(true);
    expect(freezeContract(null as unknown as object)).toBe(null);
    expect(freezeContract(5 as unknown as object)).toBe(5);
  });
});

describe('ContractError', () => {
  it('toJSON omits cause when absent', () => {
    const err = new ContractError({
      code: 'CONTRACT_MISMATCH',
      message: 'mismatch',
      issues: [{ path: 'x', message: 'bad' }],
    });
    expect(err.toJSON()).toEqual({
      code: 'CONTRACT_MISMATCH',
      message: 'mismatch',
      issues: [{ path: 'x', message: 'bad' }],
    });
  });

  it('fromZod maps root path', () => {
    const result = z.string().safeParse(1);
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = ContractError.fromZod(result.error);
      expect(err.issues[0]?.path).toBe('(root)');
    }
  });
});

describe('formatUnknownError', () => {
  it('handles Error and non-Error values', () => {
    expect(formatUnknownError(new Error('boom'))).toBe('boom');
    expect(formatUnknownError('plain')).toBe('plain');
  });
});
