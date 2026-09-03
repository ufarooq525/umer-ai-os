import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type EventEnvelope, type RuntimeEventName } from '@umer/contracts';
import { InMemoryAgentRegistryStore, projectAgentEvent } from './agent-registry.js';

let seq = 0;
function evt(name: RuntimeEventName, payload: Record<string, unknown>): EventEnvelope {
  seq += 1;
  return {
    eventId: `evt-agent-${seq}`,
    schemaVersion: SCHEMA_VERSION,
    name,
    occurredAt: new Date(1_800_000_000_000 + seq * 100).toISOString(),
    correlationId: 'corr-agent-1',
    producer: 'agent-worker',
    payload,
  };
}

describe('projectAgentEvent', () => {
  it('creates an Agent snapshot from agent.run.started', () => {
    const snapshot = projectAgentEvent(undefined, evt('agent.run.started', {
      agentId: 'agent-worker:growth.opportunity-research',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-1',
      taskIds: ['task-1'],
    }));
    expect(snapshot).toMatchObject({
      agentId: 'agent-worker:growth.opportunity-research',
      specialistId: 'growth.opportunity-research',
      status: 'active',
      currentWorkPackageId: 'wp-1',
      currentTaskIds: ['task-1'],
    });
  });

  it('picks up department/name/capabilityIds when a later event carries them', () => {
    const started = projectAgentEvent(undefined, evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-1',
    }));
    // Simulate a redispatch of the same agent where the payload now includes display fields.
    const enriched = projectAgentEvent(started, evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-2',
      name: 'Growth Opportunity Research Worker',
      department: 'Growth',
      capabilityIds: ['cap.growth.discovery'],
    }));
    expect(enriched).toMatchObject({
      name: 'Growth Opportunity Research Worker',
      department: 'Growth',
      capabilityIds: ['cap.growth.discovery'],
      currentWorkPackageId: 'wp-2',
    });
  });

  it('returns to idle and clears current-work fields on agent.run.completed', () => {
    const active = projectAgentEvent(undefined, evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-1',
      taskIds: ['task-1'],
    }))!;
    const idle = projectAgentEvent(active, evt('agent.run.completed', { agentId: 'agent-1', workPackageId: 'wp-1' }));
    expect(idle).toMatchObject({ status: 'idle', currentWorkPackageId: undefined, currentTaskIds: undefined });
    // Identity fields survive the transition back to idle.
    expect(idle?.specialistId).toBe('growth.opportunity-research');
  });

  it('returns to idle on agent.run.failed', () => {
    const active = projectAgentEvent(undefined, evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'eng.app-delivery',
      workPackageId: 'wp-1',
    }))!;
    const idle = projectAgentEvent(active, evt('agent.run.failed', { agentId: 'agent-1', workPackageId: 'wp-1' }));
    expect(idle?.status).toBe('idle');
  });

  it('ignores agent.llm.*/agent.tool.*/agent.decision events (not tracked by this registry)', () => {
    const active = projectAgentEvent(undefined, evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-1',
    }))!;
    expect(projectAgentEvent(active, evt('agent.llm.requested', { agentId: 'agent-1', iteration: 1 }))).toBeUndefined();
    expect(projectAgentEvent(active, evt('agent.tool.requested', { agentId: 'agent-1', tool: 'search_web' }))).toBeUndefined();
    expect(projectAgentEvent(active, evt('agent.decision', { agentId: 'agent-1', action: 'tool_call' }))).toBeUndefined();
  });

  it('ignores events from other domains and events with no resolvable agentId', () => {
    expect(projectAgentEvent(undefined, evt('trust.allow', { principalId: 'x' }))).toBeUndefined();
    expect(projectAgentEvent(undefined, evt('agent.run.started', { specialistId: 'growth.opportunity-research' }))).toBeUndefined();
  });
});

describe('InMemoryAgentRegistryStore', () => {
  it('project() upserts by agentId and get() returns it', async () => {
    const store = new InMemoryAgentRegistryStore();
    const snapshot = await store.project(evt('agent.run.started', {
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      workPackageId: 'wp-1',
    }));
    expect(snapshot?.agentId).toBe('agent-1');
    expect(await store.get('agent-1')).toEqual(snapshot);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('two distinct agents projected via interleaved events never overwrite each other', async () => {
    const store = new InMemoryAgentRegistryStore();
    await store.project(evt('agent.run.started', { agentId: 'agent-A', specialistId: 'growth.opportunity-research', department: 'Growth', workPackageId: 'wp-A' }));
    await store.project(evt('agent.run.started', { agentId: 'agent-B', specialistId: 'eng.app-delivery', department: 'Engineering', workPackageId: 'wp-B' }));
    await store.project(evt('agent.run.completed', { agentId: 'agent-A', workPackageId: 'wp-A' }));

    const a = await store.get('agent-A');
    const b = await store.get('agent-B');
    expect(a?.status).toBe('idle');
    expect(b?.status).toBe('active');
    expect(b?.currentWorkPackageId).toBe('wp-B');
    expect(await store.list()).toHaveLength(2);
  });

  it('list() filters by status, department, and specialistId', async () => {
    const store = new InMemoryAgentRegistryStore();
    await store.project(evt('agent.run.started', { agentId: 'agent-A', specialistId: 'growth.opportunity-research', department: 'Growth', workPackageId: 'wp-A' }));
    await store.project(evt('agent.run.started', { agentId: 'agent-B', specialistId: 'eng.app-delivery', department: 'Engineering', workPackageId: 'wp-B' }));
    await store.project(evt('agent.run.completed', { agentId: 'agent-B', workPackageId: 'wp-B' }));

    expect(await store.list({ status: 'active' })).toHaveLength(1);
    expect(await store.list({ status: 'idle' })).toHaveLength(1);
    expect(await store.list({ department: 'Growth' })).toHaveLength(1);
    expect(await store.list({ specialistId: 'eng.app-delivery' })).toHaveLength(1);
    expect(await store.list({ status: 'active', department: 'Engineering' })).toHaveLength(0);
  });

  it('project() is a no-op (returns undefined, does not create a record) for untracked events', async () => {
    const store = new InMemoryAgentRegistryStore();
    const result = await store.project(evt('agent.tool.requested', { agentId: 'agent-1', tool: 'search_web' }));
    expect(result).toBeUndefined();
    expect(await store.list()).toHaveLength(0);
  });

  it('project() is race-free under concurrently-awaited calls for the same agent', async () => {
    const store = new InMemoryAgentRegistryStore();
    const startEvents: EventEnvelope[] = Array.from({ length: 10 }, (_, i) =>
      evt('agent.run.started', { agentId: 'agent-1', specialistId: 'growth.opportunity-research', workPackageId: `wp-${i}` }),
    );
    await Promise.all(startEvents.map((e) => store.project(e)));
    const snapshot = await store.get('agent-1');
    expect(snapshot).toBeDefined();
    expect(snapshot?.status).toBe('active');
  });
});
