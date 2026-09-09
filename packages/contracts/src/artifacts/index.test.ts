import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../version.js';
import { parseContract } from '../common/serialize.js';
import { ContractError } from '../common/errors.js';
import { ArtifactContractSchema } from './index.js';

const base = {
  id: 'art-1',
  schemaVersion: SCHEMA_VERSION,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  metadata: { labels: {}, annotations: {} },
  kind: 'artifact' as const,
  artifactId: 'art-1',
  version: 'v1',
  producedBy: 'requirements.formalize',
  producedFor: 'EXEC-1',
  acceptanceStatus: 'submitted' as const,
  acceptanceCriteriaMet: [],
  contentRef: 'memory://art-1',
};

describe('ArtifactTypeSchema', () => {
  it('accepts RequirementsBrief, ProductBrief, ArchitectureDesign, and SecurityReport', () => {
    expect(parseContract(ArtifactContractSchema, { ...base, artifactType: 'RequirementsBrief' }).artifactType).toBe(
      'RequirementsBrief',
    );
    expect(parseContract(ArtifactContractSchema, { ...base, artifactType: 'ProductBrief' }).artifactType).toBe(
      'ProductBrief',
    );
    expect(parseContract(ArtifactContractSchema, { ...base, artifactType: 'ArchitectureDesign' }).artifactType).toBe(
      'ArchitectureDesign',
    );
    expect(parseContract(ArtifactContractSchema, { ...base, artifactType: 'SecurityReport' }).artifactType).toBe(
      'SecurityReport',
    );
    expect(parseContract(ArtifactContractSchema, { ...base, artifactType: 'OperationalReport' }).artifactType).toBe(
      'OperationalReport',
    );
  });

  it('still rejects an unknown artifact type', () => {
    expect(() => parseContract(ArtifactContractSchema, { ...base, artifactType: 'NotAType' })).toThrow(ContractError);
  });
});
