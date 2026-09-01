import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  parseContract,
  SCHEMA_VERSION,
  RequestContractSchema,
  WorkPackageContractSchema,
  type RequestContract,
  type WorkPackageContract,
} from '@umer/contracts';

const BASE_TIME = '2026-07-22T00:00:00.000Z';

export function createDemoRequest(overrides: Partial<RequestContract> = {}): RequestContract {
  return parseContract(RequestContractSchema, {
    id: 'req-hdr-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    metadata: { labels: {}, annotations: {} },
    kind: 'request',
    requestId: 'req-e2e-1',
    slug: 'e2e-demo-request',
    status: 'Routing',
    source: { kind: 'HumanPrincipal', name: 'CEO' },
    rawDescription: 'Demonstrate end-to-end Work Package execution for engineering delivery.',
    type: 'NewObjective',
    scopeClass: 'SingleDepartment',
    projectId: 'proj-e2e-1',
    ...overrides,
  });
}

export function createDemoWorkPackage(
  overrides: Partial<WorkPackageContract> = {},
): WorkPackageContract {
  return parseContract(WorkPackageContractSchema, {
    id: 'wp-hdr-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    metadata: { labels: {}, annotations: {} },
    kind: 'work_package',
    workPackageId: 'wp-e2e-1',
    execId: 'EXEC-001',
    stage: 'Development',
    status: 'Draft',
    specialistId: 'eng.app-delivery',
    specialistSpecVersion: '1.0.0',
    specialistSpecHash: 'pending',
    taskIds: ['task-e2e-1'],
    capabilityIds: ['cap.app.delivery'],
    contextHandle: 'ctx-e2e-1',
    toolAllowlist: ['catalog.read'],
    resourceEnvelope: { parallelism: 1, maxDurationMs: 3_600_000 },
    attempt: 1,
    correlationId: 'corr-e2e-1',
    ...overrides,
  });
}

export async function loadEngineeringSpecialistSpec(rootDir: string): Promise<string> {
  return readFile(
    join(rootDir, 'specialists', 'engineering', 'application-delivery.md'),
    'utf8',
  );
}

export function newCorrelationId(): string {
  return randomUUID();
}

export async function seedEngineeringTrustGrant(
  trustRuntime: import('@umer/trust').TrustRuntime,
  specialistId = 'eng.app-delivery',
): Promise<void> {
  await trustRuntime.registerGrant({
    grantId: 'grant-e2e-execute',
    principalId: specialistId,
    action: 'workpackage:execute',
    resourceType: 'work_package',
    effect: 'allow',
  });
}

export async function seedEngineeringLesson(
  memoryAccess: import('@umer/memory-access').MemoryAccessService,
): Promise<void> {
  await memoryAccess.create({
    principal: {
      principalId: 'intel-seed',
      grantedScopes: ['read_write'],
    },
    memory: {
      kind: 'memory',
      memoryId: 'mem-e2e-lesson-handoff',
      memoryKind: 'Lesson',
      scope: 'read',
      title: 'Application delivery handoff acknowledgment',
      contentRef: 'intel://lessons/handoff-ack',
      tags: ['engineering', 'handoff'],
      retentionClass: 'durable',
      metadata: { labels: {}, annotations: {} },
    },
    content:
      'Lessons learned for Development application delivery: require explicit handoff acknowledgment before closing work packages.',
  });
}
