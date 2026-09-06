import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type CommandEnvelope, type EventEnvelope } from '@umer/contracts';
import type { MessageFabricClient } from '@umer/message-fabric';
import { createArtifactStack } from '@umer/artifacts';
import { AgentWorker } from './worker.js';
import type { AgentRuntime } from './runtime.js';
import { WORK_PACKAGE_DISPATCH_COMMAND } from './constants.js';

function makeCommand(payload: Record<string, unknown>): CommandEnvelope {
  return {
    commandId: 'cmd-1',
    schemaVersion: SCHEMA_VERSION,
    name: WORK_PACKAGE_DISPATCH_COMMAND,
    issuedAt: new Date().toISOString(),
    correlationId: 'corr-worker-1',
    producer: 'control-api',
    payload,
  };
}

function fakeFabric() {
  const published: EventEnvelope[] = [];
  let capturedHandler: ((command: CommandEnvelope, ctx: { ack: () => void }) => Promise<void>) | undefined;
  const fabric = {
    publishEvent: vi.fn(async (_subject: string, event: EventEnvelope) => {
      published.push(event);
    }),
    subscribeCommands: vi.fn(async (_options: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { stop: vi.fn().mockResolvedValue(undefined) };
    }),
  };
  return {
    fabric: fabric as unknown as MessageFabricClient,
    published,
    getHandler: () => capturedHandler,
  };
}

describe('AgentWorker', () => {
  it('publishes agent.run.started with execId/specialistId read directly off the dispatch payload', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-1',
        runId: 'wp-1:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-1', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();

    const handler = getHandler();
    expect(handler).toBeDefined();
    await handler!(
      makeCommand({
        workPackage: { workPackageId: 'wp-1', execId: 'EXEC-900', specialistId: 'growth.opportunity-research' },
      }),
      { ack: vi.fn() },
    );

    const started = published.find((e) => e.name === 'agent.run.started');
    expect(started?.payload).toEqual({
      workPackageId: 'wp-1',
      execId: 'EXEC-900',
      specialistId: 'growth.opportunity-research',
      agentId: 'agent-worker:growth.opportunity-research',
    });
  });

  it('omits execId/specialistId from agent.run.started when the raw payload does not carry them', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-2',
        runId: 'wp-2:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-2', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();
    await getHandler()!(makeCommand({ workPackage: { workPackageId: 'wp-2' } }), { ack: vi.fn() });

    const started = published.find((e) => e.name === 'agent.run.started');
    expect(started?.payload).toEqual({ workPackageId: 'wp-2' });
  });

  it('publishes the full started -> completed sequence with correlation ids preserved', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-3',
        runId: 'wp-3:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'final summary',
        artifact: { artifactId: 'art-3', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();
    const ack = vi.fn();
    await getHandler()!(
      makeCommand({ workPackage: { workPackageId: 'wp-3', execId: 'EXEC-1', specialistId: 'growth.opportunity-research' } }),
      { ack },
    );

    expect(ack).toHaveBeenCalledTimes(1);
    expect(published.map((e) => e.name)).toEqual(['agent.run.started', 'agent.run.completed', 'artifact.sealed']);
    for (const event of published) {
      expect(event.correlationId).toBe('corr-worker-1');
    }
    const completed = published.find((e) => e.name === 'agent.run.completed');
    expect(completed?.payload).toMatchObject({ workPackageId: 'wp-3', runId: 'wp-3:corr-worker-1', artifactId: 'art-3' });
  });

  it('publishes agent.run.failed and rethrows when execution fails', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();

    await expect(
      getHandler()!(makeCommand({ workPackage: { workPackageId: 'wp-4' } }), { ack: vi.fn() }),
    ).rejects.toThrow('boom');

    const failed = published.find((e) => e.name === 'agent.run.failed');
    expect(failed?.payload).toMatchObject({ workPackageId: 'wp-4', errorMessage: 'boom' });
  });

  it('includes taskIds on agent.run.started when the dispatch payload carries them', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-5',
        runId: 'wp-5:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-5', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();
    await getHandler()!(
      makeCommand({
        workPackage: {
          workPackageId: 'wp-5',
          specialistId: 'growth.opportunity-research',
          taskIds: ['task-1', 'task-2'],
        },
      }),
      { ack: vi.fn() },
    );

    const started = published.find((e) => e.name === 'agent.run.started');
    expect(started?.payload).toMatchObject({ taskIds: ['task-1', 'task-2'] });
  });

  it('includes agentId (derived from producer:specialistId) on agent.run.completed and agent.run.failed', async () => {
    const { fabric: fabricOk, published: publishedOk, getHandler: getHandlerOk } = fakeFabric();
    const runtimeOk = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-6',
        runId: 'wp-6:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-6', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;
    const workerOk = new AgentWorker({ runtime: runtimeOk, fabric: fabricOk, producer: 'agent-worker' });
    await workerOk.start();
    await getHandlerOk()!(
      makeCommand({ workPackage: { workPackageId: 'wp-6', specialistId: 'growth.opportunity-research' } }),
      { ack: vi.fn() },
    );
    expect(publishedOk.find((e) => e.name === 'agent.run.completed')?.payload).toMatchObject({
      agentId: 'agent-worker:growth.opportunity-research',
    });

    const { fabric: fabricFail, published: publishedFail, getHandler: getHandlerFail } = fakeFabric();
    const runtimeFail = { execute: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as AgentRuntime;
    const workerFail = new AgentWorker({ runtime: runtimeFail, fabric: fabricFail, producer: 'agent-worker' });
    await workerFail.start();
    await expect(
      getHandlerFail()!(
        makeCommand({ workPackage: { workPackageId: 'wp-7', specialistId: 'eng.app-delivery' } }),
        { ack: vi.fn() },
      ),
    ).rejects.toThrow('boom');
    expect(publishedFail.find((e) => e.name === 'agent.run.failed')?.payload).toMatchObject({
      agentId: 'agent-worker:eng.app-delivery',
    });
  });

  it('enriches agent.run.started with name/department/capabilityIds via resolveAgentDisplay', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-8',
        runId: 'wp-8:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-8', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const resolveAgentDisplay = vi.fn((specialistId: string) =>
      specialistId === 'growth.opportunity-research'
        ? { name: 'Growth Opportunity Research Worker', department: 'Growth', capabilityIds: ['cap.growth.discovery'] }
        : undefined,
    );
    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker', resolveAgentDisplay });
    await worker.start();
    await getHandler()!(
      makeCommand({ workPackage: { workPackageId: 'wp-8', specialistId: 'growth.opportunity-research' } }),
      { ack: vi.fn() },
    );

    expect(resolveAgentDisplay).toHaveBeenCalledWith('growth.opportunity-research');
    const started = published.find((e) => e.name === 'agent.run.started');
    expect(started?.payload).toMatchObject({
      name: 'Growth Opportunity Research Worker',
      department: 'Growth',
      capabilityIds: ['cap.growth.discovery'],
    });
  });

  it('carries the full sealed artifact on artifact.sealed when a real ArtifactEngine seals one', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const { engine: artifactEngine } = createArtifactStack();
    const draftArtifact = {
      id: 'art-hdr-7',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'artifact' as const,
      artifactId: 'art-7',
      artifactType: 'ResearchFinding' as const,
      version: 'wp-7:1',
      producedBy: 'growth.opportunity-research',
      producedFor: 'EXEC-1',
      acceptanceStatus: 'draft' as const,
      acceptanceCriteriaMet: [],
      contentRef: 'memory://artifacts/art-7',
    };
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-7',
        runId: 'wp-7:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: draftArtifact,
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker', artifactEngine });
    await worker.start();
    await getHandler()!(makeCommand({ workPackage: { workPackageId: 'wp-7' } }), { ack: vi.fn() });

    const sealedEvent = published.find((e) => e.name === 'artifact.sealed');
    expect((sealedEvent?.payload as { artifact?: { acceptanceStatus?: string; artifactId?: string } }).artifact).toMatchObject({
      artifactId: 'art-7',
      acceptanceStatus: 'submitted', // seal() always moves draft -> submitted
    });
  });

  it('omits the artifact field on artifact.sealed when no ArtifactEngine is configured', async () => {
    const { fabric, published, getHandler } = fakeFabric();
    const runtime = {
      execute: vi.fn().mockResolvedValue({
        workPackageId: 'wp-8',
        runId: 'wp-8:corr-worker-1',
        specialistId: 'growth.opportunity-research',
        summary: 'done',
        artifact: { artifactId: 'art-8', artifactType: 'ResearchFinding' },
      }),
    } as unknown as AgentRuntime;

    const worker = new AgentWorker({ runtime, fabric, producer: 'agent-worker' });
    await worker.start();
    await getHandler()!(makeCommand({ workPackage: { workPackageId: 'wp-8' } }), { ack: vi.fn() });

    const sealedEvent = published.find((e) => e.name === 'artifact.sealed');
    expect(sealedEvent?.payload.artifact).toBeUndefined();
  });
});
