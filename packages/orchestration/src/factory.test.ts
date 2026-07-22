import { describe, expect, it, vi } from 'vitest';
import { SUBJECTS } from '@umer/message-fabric';
import { createWorkPackageDispatcher } from './dispatcher.js';
import { createEventPublisher } from './events.js';
import { createOrchestrator } from './factory.js';
import { OrchestrationError } from './errors.js';
import { createTestWorkPackage } from './test-utils.js';

describe('dispatcher', () => {
  it('publishes agent dispatch command', async () => {
    const publishCommand = vi.fn(async () => undefined);
    const fabric = { publishCommand } as never;
    const dispatcher = createWorkPackageDispatcher(fabric, 'orchestration');
    const wp = createTestWorkPackage({ status: 'Queued' });
    await dispatcher.dispatch(wp, 'corr-dispatch');
    expect(publishCommand).toHaveBeenCalledWith(
      SUBJECTS.CMD_AGENT_DISPATCH,
      expect.objectContaining({ name: 'workpackage.dispatch' }),
    );
  });

  it('wraps publish failures', async () => {
    const fabric = {
      publishCommand: vi.fn(async () => {
        throw new Error('nats down');
      }),
    } as never;
    const dispatcher = createWorkPackageDispatcher(fabric, 'orchestration');
    await expect(
      dispatcher.dispatch(createTestWorkPackage({ status: 'Queued' }), 'corr-fail'),
    ).rejects.toThrow(OrchestrationError);
  });
});

describe('events', () => {
  it('publishes runtime events', async () => {
    const publishEvent = vi.fn(async () => undefined);
    const fabric = { publishEvent } as never;
    const publisher = createEventPublisher(fabric, 'orchestration');
    await publisher.publish('workpackage.queued', 'corr-evt', { workPackageId: 'wp-1' });
    expect(publishEvent).toHaveBeenCalledWith(
      `${SUBJECTS.EVT_RUNTIME}.workpackage.queued`,
      expect.objectContaining({ name: 'workpackage.queued' }),
    );
  });
});

describe('factory', () => {
  it('creates orchestrator with in-memory store', async () => {
    const fabric = {
      publishCommand: vi.fn(async () => undefined),
      publishEvent: vi.fn(async () => undefined),
    } as never;
    const orchestrator = createOrchestrator({ fabric, producer: 'orchestration' });
    const queued = await orchestrator.queue(createTestWorkPackage(), 'corr-factory');
    expect(queued.status).toBe('Queued');
  });
});
