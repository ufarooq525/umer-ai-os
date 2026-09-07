import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../version.js';
import { parseContract } from '../common/serialize.js';
import { ContractError } from '../common/errors.js';
import { RequirementContractSchema } from './index.js';

const header = {
  id: 'req-1',
  schemaVersion: SCHEMA_VERSION,
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
  metadata: { labels: {}, annotations: {} },
};

const base = {
  ...header,
  kind: 'requirement' as const,
  requirementId: 'req-1',
  status: 'Draft' as const,
  title: 'Add checkout retries',
  problem: 'Checkout fails silently on transient gateway errors.',
  desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
  acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
  source: { kind: 'Request' as const, label: 'control-api feature intake' },
};

describe('RequirementContractSchema', () => {
  it('parses a minimal valid requirement, defaulting optional arrays', () => {
    const requirement = parseContract(RequirementContractSchema, base);
    expect(requirement.status).toBe('Draft');
    expect(requirement.constraints).toEqual([]);
    expect(requirement.assumptions).toEqual([]);
    expect(requirement.openQuestions).toEqual([]);
    expect(requirement.decision).toBeUndefined();
  });

  it('preserves full provenance and lineage fields', () => {
    const requirement = parseContract(RequirementContractSchema, {
      ...base,
      requestId: 'req-intake-1',
      projectId: 'proj-1',
      opportunityId: 'opp-1',
      customerId: 'cust-1',
      constraints: ['Must not change the public checkout API'],
      assumptions: ['Gateway errors are transient in >90% of cases'],
      openQuestions: ['Should retries be capped per session?'],
    });
    expect(requirement.requestId).toBe('req-intake-1');
    expect(requirement.projectId).toBe('proj-1');
    expect(requirement.opportunityId).toBe('opp-1');
    expect(requirement.customerId).toBe('cust-1');
    expect(requirement.constraints).toEqual(['Must not change the public checkout API']);
  });

  it('rejects an unknown status', () => {
    expect(() =>
      parseContract(RequirementContractSchema, { ...base, status: 'InProgress' }),
    ).toThrow(ContractError);
  });

  it('rejects a requirement with no acceptance criteria', () => {
    expect(() =>
      parseContract(RequirementContractSchema, { ...base, acceptanceCriteria: [] }),
    ).toThrow(ContractError);
  });

  it('rejects an unknown source kind', () => {
    expect(() =>
      parseContract(RequirementContractSchema, {
        ...base,
        source: { kind: 'Vibes', label: 'nope' },
      }),
    ).toThrow(ContractError);
  });

  it('accepts an Accepted requirement carrying a matching decision', () => {
    const requirement = parseContract(RequirementContractSchema, {
      ...base,
      status: 'Accepted',
      decision: {
        decision: 'Approved',
        decidedBy: 'human.ceo',
        decidedAt: '2026-09-06T01:00:00.000Z',
      },
    });
    expect(requirement.decision?.decision).toBe('Approved');
  });
});
