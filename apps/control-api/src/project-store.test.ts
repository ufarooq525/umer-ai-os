import { describe, expect, it, vi } from 'vitest';
import { InMemoryProjectStore } from './project-store.js';

describe('InMemoryProjectStore', () => {
  it('creates a Project defaulting to Forming status and emits project.created', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryProjectStore({ events });

    const project = await store.create({ name: 'Healthcare SaaS Build' }, 'corr-1');

    expect(project.status).toBe('Forming');
    expect(project.name).toBe('Healthcare SaaS Build');
    expect(events.publish).toHaveBeenCalledWith(
      'project.created',
      'corr-1',
      expect.objectContaining({ projectId: project.projectId, name: 'Healthcare SaaS Build' }),
    );
  });

  it('links a Project to its source Opportunity', async () => {
    const store = new InMemoryProjectStore();
    const project = await store.create({ name: 'X', sourceOpportunityId: 'opp-1' }, 'corr-1');
    expect(project.sourceOpportunityId).toBe('opp-1');
    expect(await store.get(project.projectId)).toEqual(project);
  });

  it('updates status and emits project.status.changed with the previous status', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryProjectStore({ events });
    const project = await store.create({ name: 'X' }, 'corr-1');

    const updated = await store.updateStatus(project.projectId, 'Active', 'corr-2');

    expect(updated?.status).toBe('Active');
    expect(events.publish).toHaveBeenCalledWith(
      'project.status.changed',
      'corr-2',
      expect.objectContaining({ projectId: project.projectId, status: 'Active', previousStatus: 'Forming' }),
    );
  });

  it('updateStatus on an unknown project returns undefined without emitting', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryProjectStore({ events });
    expect(await store.updateStatus('does-not-exist', 'Active', 'corr-1')).toBeUndefined();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('list() filters by status and owner independently', async () => {
    const store = new InMemoryProjectStore();
    const a = await store.create({ name: 'A', owner: 'Growth Lead' }, 'corr-1');
    const b = await store.create({ name: 'B', owner: 'Engineering Lead' }, 'corr-1');
    await store.updateStatus(a.projectId, 'Active', 'corr-1');

    expect(await store.list({ status: 'Active' })).toHaveLength(1);
    expect(await store.list({ owner: 'Engineering Lead' })).toEqual([b]);
    expect(await store.list()).toHaveLength(2);
  });
});
