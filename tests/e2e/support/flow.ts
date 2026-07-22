import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCommandEnvelope } from '@umer/message-fabric';
import { createArtifactStack, type ArtifactEngine } from '@umer/artifacts';
import { createAgentWorker, createAgentRuntime } from '@umer/agent-runtime';
import {
  createOrchestrator,
  createOrchestrationWorker,
  ORCHESTRATION_COMMANDS,
} from '@umer/orchestration';
import {
  InMemoryRegistryAdapter,
  loadSpecFromString,
  type SpecialistMandate,
} from '@umer/specialist-sdk';
import { createMemoryStack, type MemoryAccessService } from '@umer/memory-access';
import { createTrustStack, type TrustRuntime } from '@umer/trust';
import { createAuditStack, type AuditService } from '@umer/audit';
import {
  createDemoRequest,
  createDemoWorkPackage,
  loadEngineeringSpecialistSpec,
  seedEngineeringLesson,
  seedEngineeringTrustGrant,
} from '../fixtures.js';
import { InMemoryMessageFabric, SUBJECTS } from './in-memory-fabric.js';

export type E2EFlowResult = {
  request: ReturnType<typeof createDemoRequest>;
  workPackageId: string;
  correlationId: string;
  finalStatus: string | undefined;
  artifactId?: string;
  artifactEngine: ArtifactEngine;
  artifactStore: ReturnType<typeof createArtifactStack>['store'];
  memoryAccess: MemoryAccessService;
  trustRuntime: TrustRuntime;
  auditService: AuditService;
};

export async function runWorkPackageE2EFlow(repoRoot = process.cwd()): Promise<E2EFlowResult> {
  const fabric = new InMemoryMessageFabric() as never;
  const correlationId = 'corr-e2e-flow';
  const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
  const registry = new InMemoryRegistryAdapter();

  const specMarkdown = await loadEngineeringSpecialistSpec(repoRoot);
  const loaded = loadSpecFromString(specMarkdown);
  await registry.register(loaded.binding);

  const mandate: SpecialistMandate = loaded.mandate;
  const resolveMandate = async (specialistId: string) => {
    if (specialistId !== mandate.contract.specialistId) {
      return undefined;
    }
    return { mandate, binding: loaded.binding };
  };

  const { service: memoryAccess } = createMemoryStack();
  const { runtime: trustRuntime } = createTrustStack();
  const { service: auditService } = createAuditStack();
  await seedEngineeringLesson(memoryAccess);
  await seedEngineeringTrustGrant(trustRuntime, mandate.contract.specialistId);

  const memoryPrincipal = {
    principalId: mandate.contract.specialistId,
    grantedScopes: ['read', 'write'] as ('read' | 'write')[],
  };

  const orchestrator = createOrchestrator({ fabric, producer: 'e2e-orchestration' });
  const orchestrationWorker = createOrchestrationWorker({ orchestrator, fabric });
  const agentWorker = createAgentWorker({
    runtime: createAgentRuntime({
      resolveMandate,
      memoryAccess,
      memoryPrincipal,
      trustRuntime,
      auditService,
    }),
    fabric,
    producer: 'e2e-agent',
    artifactEngine,
    auditService,
  });

  await orchestrationWorker.start();
  await agentWorker.start();

  const request = createDemoRequest();
  const workPackage = createDemoWorkPackage({
    specialistSpecHash: loaded.mandate.specHash,
    correlationId,
  });

  await fabric.publishCommand(
    SUBJECTS.CMD_ORCHESTRATION,
    createCommandEnvelope({
      name: ORCHESTRATION_COMMANDS.QUEUE,
      producer: 'e2e-control-api',
      correlationId,
      payload: { workPackage },
    }),
  );

  await fabric.publishCommand(
    SUBJECTS.CMD_ORCHESTRATION,
    createCommandEnvelope({
      name: ORCHESTRATION_COMMANDS.DISPATCH,
      producer: 'e2e-control-api',
      correlationId,
      payload: { workPackageId: workPackage.workPackageId },
    }),
  );

  const final = await orchestrator.get(workPackage.workPackageId);
  const artifactId = `art-${workPackage.workPackageId}-${workPackage.attempt}`;

  await orchestrationWorker.stop();
  await agentWorker.stop();

  return {
    request,
    workPackageId: workPackage.workPackageId,
    correlationId,
    finalStatus: final?.status,
    artifactId,
    artifactStore,
    artifactEngine,
    memoryAccess,
    trustRuntime,
    auditService,
  };
}

export function resolveRepoRoot(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return join(here, '..', '..', '..');
}
