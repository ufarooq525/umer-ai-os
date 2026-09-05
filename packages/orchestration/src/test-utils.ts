import {
  parseContract,
  SCHEMA_VERSION,
  WorkGraphEdgeContractSchema,
  WorkGraphNodeContractSchema,
  WorkPackageContractSchema,
} from '@umer/contracts';
import type { WorkGraphEdgeContract, WorkGraphNodeContract, WorkPackageContract } from '@umer/contracts';

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

export function createTestWorkGraphNode(
  overrides: Partial<WorkGraphNodeContract> = {},
): WorkGraphNodeContract {
  const nodeId = (overrides.nodeId as string | undefined) ?? 'node-1';
  return parseContract(WorkGraphNodeContractSchema, {
    id: `hdr-${nodeId}`,
    schemaVersion: SCHEMA_VERSION,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    metadata: { labels: {}, annotations: {} },
    kind: 'work_graph_node',
    nodeId,
    projectId: 'proj-1',
    type: 'Requirements',
    status: 'Planned',
    title: 'Requirements',
    ...overrides,
  });
}

export function createTestWorkGraphEdge(
  overrides: Partial<WorkGraphEdgeContract> = {},
): WorkGraphEdgeContract {
  const edgeId = (overrides.edgeId as string | undefined) ?? 'edge-1';
  return parseContract(WorkGraphEdgeContractSchema, {
    id: `hdr-${edgeId}`,
    schemaVersion: SCHEMA_VERSION,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    metadata: { labels: {}, annotations: {} },
    kind: 'work_graph_edge',
    edgeId,
    projectId: 'proj-1',
    fromNodeId: 'node-1',
    toNodeId: 'node-2',
    type: 'blocks',
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
