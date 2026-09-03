import { describe, expect, it, vi } from 'vitest';
import { InMemoryAgentControlStore } from './agent-control-store.js';

describe('InMemoryAgentControlStore', () => {
  it('get() on an unknown agent returns undefined (defaults to active)', async () => {
    const store = new InMemoryAgentControlStore();
    expect(await store.get('agent-1')).toBeUndefined();
  });

  it('pause() sets controlState=paused and emits agent.control.changed', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryAgentControlStore({ events });

    const record = await store.pause('agent-1', 'incident review', 'corr-1');

    expect(record).toEqual(
      expect.objectContaining({ agentId: 'agent-1', controlState: 'paused', reason: 'incident review' }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      'agent.control.changed',
      'corr-1',
      expect.objectContaining({ agentId: 'agent-1', controlState: 'paused', action: 'paused' }),
    );
  });

  it('resume() sets controlState=active and emits agent.control.changed', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryAgentControlStore({ events });
    await store.pause('agent-1', undefined, 'corr-1');

    const record = await store.resume('agent-1', 'corr-2');

    expect(record.controlState).toBe('active');
    expect(events.publish).toHaveBeenCalledWith(
      'agent.control.changed',
      'corr-2',
      expect.objectContaining({ agentId: 'agent-1', controlState: 'active', action: 'resumed' }),
    );
  });

  it('recordCancelWork() preserves current controlState and records the target', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryAgentControlStore({ events });
    await store.pause('agent-1', undefined, 'corr-1');

    const record = await store.recordCancelWork('agent-1', { taskId: 'task-1' }, 'stale', 'corr-2');

    expect(record.controlState).toBe('paused');
    expect(record.lastCancelledTaskId).toBe('task-1');
    expect(events.publish).toHaveBeenCalledWith(
      'agent.control.changed',
      'corr-2',
      expect.objectContaining({ agentId: 'agent-1', action: 'work_cancelled', taskId: 'task-1', reason: 'stale' }),
    );
  });
});
