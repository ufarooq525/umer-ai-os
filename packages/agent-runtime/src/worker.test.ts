import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type CommandEnvelope, type EventEnvelope } from '@umer/contracts';
import type { MessageFabricClient } from '@umer/message-fabric';
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
});
