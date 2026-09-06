import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import { loadSpecFromString } from '@umer/specialist-sdk';
import { runEngineeringApplicationDelivery } from './engineering.js';

async function loadEngineeringSpec(): Promise<string> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');
  return readFile(join(root, 'specialists', 'engineering', 'application-delivery.md'), 'utf8');
}

function makeWorkPackage(specHash: string, overrides: { taskIds?: string[] } = {}) {
  return parseContract(WorkPackageContractSchema, {
    id: 'wp-hdr',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
    metadata: { labels: {}, annotations: {} },
    kind: 'work_package',
    workPackageId: 'wp-1',
    execId: 'EXEC-001',
    stage: 'Development',
    status: 'Dispatched',
    specialistId: 'eng.app-delivery',
    specialistSpecVersion: '1.0.0',
    specialistSpecHash: specHash,
    taskIds: overrides.taskIds ?? ['task-1'],
    capabilityIds: ['cap.app.delivery'],
    contextHandle: 'ctx-1',
    toolAllowlist: ['git.diff'],
    resourceEnvelope: { parallelism: 1 },
    attempt: 1,
  });
}

// WorkPackageContractSchema carries no change-set/target-files field, so this
// handler can never actually scope, diff, or apply a real change — these
// tests guard against it ever again claiming otherwise (see the doc comment
// on runEngineeringApplicationDelivery for the incident this replaced).
describe('runEngineeringApplicationDelivery', () => {
  it('never claims a criterion is VERIFIED when no change-set was supplied', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = makeWorkPackage(loaded.mandate.specHash);

    const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

    expect(result.artifact.acceptanceStatus).not.toBe('submitted');
    expect(result.artifact.acceptanceStatus).not.toBe('accepted');
    for (const criterion of result.artifact.acceptanceCriteriaMet) {
      expect(criterion.status).not.toBe('VERIFIED');
    }
  });

  it('reports draft/N_A honestly, one criterion per real task id, and no invented evidenceRef', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = makeWorkPackage(loaded.mandate.specHash, { taskIds: ['task-1', 'task-2'] });

    const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

    expect(result.artifact.acceptanceStatus).toBe('draft');
    expect(result.artifact.acceptanceCriteriaMet).toEqual([
      { criterion: 'Task task-1 delivery evidence', status: 'N_A' },
      { criterion: 'Task task-2 delivery evidence', status: 'N_A' },
    ]);
  });

  it('says in its summary that manual scoping is needed, not that delivery completed', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = makeWorkPackage(loaded.mandate.specHash);

    const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

    expect(result.summary).toContain('needs manual scoping');
    expect(result.summary).not.toContain('completed');
  });

  it('still produces a valid, sealable Code artifact', async () => {
    const loaded = loadSpecFromString(await loadEngineeringSpec());
    const workPackage = makeWorkPackage(loaded.mandate.specHash);

    const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

    expect(result.artifact.artifactType).toBe('Code');
    expect(result.artifact.sourceTaskId).toBe('task-1');
    expect(result.artifact.producedFor).toBe(workPackage.execId);
  });
});
