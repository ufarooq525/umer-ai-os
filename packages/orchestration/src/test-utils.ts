import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import type { WorkPackageContract } from '@umer/contracts';

const BASE_TIME = '2026-07-22T00:00:00.000Z';

export function createTestWorkPackage(
  overrides: Partial<WorkPackageContract> = {},
): WorkPackageContract {
  return parseContract(WorkPackageContractSchema, {
    id: 'hdr-wp-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    metadata: { labels: {}, annotations: {} },
    kind: 'work_package',
    workPackageId: 'wp-1',
    execId: 'EXEC-001',
    stage: 'Development',
    status: 'Draft',
    specialistId: 'eng.spec.1',
    specialistSpecVersion: '1.0.0',
    specialistSpecHash: 'abc123',
    taskIds: ['task-1'],
    capabilityIds: [],
    contextHandle: 'ctx-1',
    toolAllowlist: [],
    resourceEnvelope: { parallelism: 1 },
    attempt: 1,
    correlationId: 'corr-wp-1',
    ...overrides,
  });
}

export function createMockClock(startMs = Date.parse(BASE_TIME)): {
  now: () => number;
  nowIso: () => string;
  advance: (ms: number) => void;
} {
  let current = startMs;
  return {
    now: () => current,
    nowIso: () => new Date(current).toISOString(),
    advance(ms: number) {
      current += ms;
    },
  };
}
