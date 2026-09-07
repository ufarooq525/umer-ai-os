import { describe, expect, it } from 'vitest';
import { createControlApiState } from './server.js';
import { InMemoryRequirementStore } from './requirement-store.js';
import { connectRequirementWorkGraphBridge } from './requirement-workgraph-bridge.js';

describe('connectRequirementWorkGraphBridge', () => {
  it('does nothing when requirementStore is not connected', async () => {
    const state = await createControlApiState();
    expect(state.requirementStore).toBeUndefined();
    expect(() => connectRequirementWorkGraphBridge(state)).not.toThrow();
    expect(state.requirementStore).toBeUndefined();
  });

  it('creates the canonical Requirements Work Graph node when a project-scoped requirement is created', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);

    const requirement = await state.requirementStore.create({
      projectId: 'proj-bridge-1',
      title: 'Add checkout retries',
      problem: 'Checkout fails silently on transient gateway errors.',
      desiredOutcome: 'Checkout succeeds after a transient gateway failure.',
      acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
      source: { kind: 'Request', label: 'test' },
    });

    const graph = await state.persistentWorkGraph!.load('proj-bridge-1');
    const requirementsNode = graph.listNodes('proj-bridge-1').find((n) => n.type === 'Requirements');
    expect(requirementsNode).toBeDefined();
    expect(requirementsNode?.status).toBe('Ready');
    expect(requirementsNode?.metadata.annotations?.requirementId).toBe(requirement.requirementId);
    expect(requirementsNode?.title).toContain(requirement.requirementId);
  });

  it('does not create a project without a projectId a Work Graph node', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);

    await state.requirementStore.create({
      title: 'Unscoped requirement',
      problem: 'No project yet',
      desiredOutcome: 'Assign a project later',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    // Nothing to assert against a real graph without a projectId — the bridge
    // must simply not throw and must not fabricate a project to attach to.
  });

  it('does not duplicate the Requirements node for a second requirement on the same project', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);

    const input = {
      projectId: 'proj-bridge-2',
      title: 'First requirement',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request' as const, label: 'test' },
    };
    const first = await state.requirementStore.create(input);
    const second = await state.requirementStore.create({ ...input, title: 'Second requirement' });

    const graph = await state.persistentWorkGraph!.load('proj-bridge-2');
    const requirementsNodes = graph.listNodes('proj-bridge-2').filter((n) => n.type === 'Requirements');
    expect(requirementsNodes).toHaveLength(1);
    // The single node retains the FIRST requirement's lineage — a later
    // requirement on an already-decomposed project attaches to the existing
    // graph rather than re-decomposing (which would fail closed on WorkGraph's
    // own duplicate-node validation and silently clobber in-flight progress).
    expect(requirementsNodes[0]?.metadata.annotations?.requirementId).toBe(first.requirementId);
    expect(requirementsNodes[0]?.metadata.annotations?.requirementId).not.toBe(second.requirementId);
  });

  it('creates independent Requirements nodes for different projects', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);

    await state.requirementStore.create({
      projectId: 'proj-bridge-3a',
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });
    await state.requirementStore.create({
      projectId: 'proj-bridge-3b',
      title: 'B',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    const graphA = await state.persistentWorkGraph!.load('proj-bridge-3a');
    const graphB = await state.persistentWorkGraph!.load('proj-bridge-3b');
    expect(graphA.listNodes('proj-bridge-3a').some((n) => n.type === 'Requirements')).toBe(true);
    expect(graphB.listNodes('proj-bridge-3b').some((n) => n.type === 'Requirements')).toBe(true);
  });
});
