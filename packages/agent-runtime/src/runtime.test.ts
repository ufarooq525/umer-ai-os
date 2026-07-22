import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import { InMemoryRegistryAdapter, loadSpecFromString } from '@umer/specialist-sdk';
import { createMemoryStack } from '@umer/memory-access';
import { assertMandateBinding } from './bind.js';
import { AgentRuntimeError } from './errors.js';
import { createAgentRuntime } from './factory.js';
import { runEngineeringApplicationDelivery } from './handlers/engineering.js';

async function loadEngineeringSpec(): Promise<string> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  return readFile(join(root, 'specialists', 'engineering', 'application-delivery.md'), 'utf8');
}

describe('agent-runtime', () => {
  it('runs engineering handler and produces artifact', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'work_package',
      workPackageId: 'wp-1',
      execId: 'EXEC-001',
      stage: 'Development',
      status: 'Dispatched',
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: ['cap.app.delivery'],
      contextHandle: 'ctx-1',
      toolAllowlist: ['git.diff'],
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });
    const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);
    expect(result.artifact.artifactType).toBe('Code');
    expect(result.summary).toContain('wp-1');
  });

  it('validates mandate binding', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'work_package',
      workPackageId: 'wp-1',
      execId: 'EXEC-001',
      stage: 'Development',
      status: 'Dispatched',
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: ['cap.app.delivery'],
      contextHandle: 'ctx-1',
      toolAllowlist: ['git.diff'],
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });
    loaded.binding.specHash = 'mismatch';
    expect(() => assertMandateBinding(workPackage, loaded.binding)).toThrow(AgentRuntimeError);
  });

  it('executes work package with registered mandate', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'work_package',
      workPackageId: 'wp-1',
      execId: 'EXEC-001',
      stage: 'Development',
      status: 'Dispatched',
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: ['cap.app.delivery'],
      contextHandle: 'ctx-1',
      toolAllowlist: ['git.diff'],
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });
    const registry = new InMemoryRegistryAdapter();
    await registry.register(loaded.binding);
    const runtime = createAgentRuntime({
      resolveMandate: async (id) =>
        id === loaded.binding.specialistId
          ? { mandate: loaded.mandate, binding: loaded.binding }
          : undefined,
    });
    const result = await runtime.execute({ workPackage }, 'corr-1');
    expect(result.artifact.artifactId).toContain('wp-1');
  });

  it('retrieves organizational memory before engineering delivery', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const { service: memoryAccess } = createMemoryStack();
    await memoryAccess.create({
      principal: { principalId: 'seed', grantedScopes: ['read_write'] },
      memory: {
        kind: 'memory',
        memoryId: 'mem-runtime-lesson',
        memoryKind: 'Lesson',
        scope: 'read',
        title: 'Development delivery checklist',
        contentRef: 'intel://lessons/dev-checklist',
        tags: ['engineering'],
        retentionClass: 'durable',
        metadata: { labels: {}, annotations: {} },
      },
      content: 'Lessons learned for Development application delivery handoff acknowledgment.',
    });

    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'work_package',
      workPackageId: 'wp-mem-1',
      execId: 'EXEC-001',
      stage: 'Development',
      status: 'Dispatched',
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: ['cap.app.delivery'],
      contextHandle: 'ctx-1',
      toolAllowlist: ['git.diff'],
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });

    const runtime = createAgentRuntime({
      resolveMandate: async () => ({ mandate: loaded.mandate, binding: loaded.binding }),
      memoryAccess,
      memoryPrincipal: {
        principalId: loaded.mandate.contract.specialistId,
        grantedScopes: ['read'],
      },
    });
    const result = await runtime.execute({ workPackage }, 'corr-mem');
    expect(result.summary).toContain('lesson');
    expect(result.artifact.metadata.annotations?.memoryCitations).toContain('mem-runtime-lesson');
  });
});
