import { describe, expect, it, vi } from 'vitest';
import type { MySqlExecutor } from '@umer/db';
import {
  InMemoryRequirementStore,
  MySqlRequirementStore,
  RequirementAlreadyDecidedError,
  type CreateRequirementInput,
} from './requirement-store.js';

const baseInput: CreateRequirementInput = {
  title: 'Add checkout retries',
  problem: 'Checkout fails silently on transient gateway errors.',
  desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
  acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
  source: { kind: 'Request', label: 'control-api feature intake' },
};

describe('InMemoryRequirementStore', () => {
  it('creates a Draft requirement with a generated id', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create(baseInput);
    expect(requirement.requirementId).toMatch(/^req-/);
    expect(requirement.status).toBe('Draft');
    expect(requirement.title).toBe(baseInput.title);
  });

  it('preserves provenance fields (requestId, projectId, opportunityId, customerId)', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create({
      ...baseInput,
      requestId: 'req-intake-1',
      projectId: 'proj-1',
      opportunityId: 'opp-1',
      customerId: 'cust-1',
    });
    expect(requirement.requestId).toBe('req-intake-1');
    expect(requirement.projectId).toBe('proj-1');
    expect(requirement.opportunityId).toBe('opp-1');
    expect(requirement.customerId).toBe('cust-1');
  });

  it('get returns the persisted requirement and undefined for an unknown id', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create(baseInput);
    expect(await store.get(requirement.requirementId)).toEqual(requirement);
    expect(await store.get('req-missing')).toBeUndefined();
  });

  it('list filters by projectId, requestId, and status', async () => {
    const store = new InMemoryRequirementStore();
    const a = await store.create({ ...baseInput, projectId: 'proj-1', requestId: 'req-a' });
    await store.create({ ...baseInput, projectId: 'proj-2', requestId: 'req-b' });

    expect((await store.list({ projectId: 'proj-1' })).map((r) => r.requirementId)).toEqual([a.requirementId]);
    expect((await store.list({ requestId: 'req-a' })).map((r) => r.requirementId)).toEqual([a.requirementId]);
    expect(await store.list({ status: 'Accepted' })).toEqual([]);
    expect(await store.list()).toHaveLength(2);
  });

  it('decide(Approved) moves a requirement to Accepted', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create(baseInput);
    const decided = await store.decide(requirement.requirementId, {
      decision: 'Approved',
      decidedBy: 'human.ceo',
      decidedAt: '2026-09-06T01:00:00.000Z',
    });
    expect(decided?.status).toBe('Accepted');
    expect(decided?.decision?.decision).toBe('Approved');
  });

  it('decide(Rejected) moves a requirement to Rejected', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create(baseInput);
    const decided = await store.decide(requirement.requirementId, {
      decision: 'Rejected',
      decidedBy: 'human.ceo',
      reason: 'Out of scope for this quarter',
      decidedAt: '2026-09-06T01:00:00.000Z',
    });
    expect(decided?.status).toBe('Rejected');
  });

  it('a rejected requirement cannot later be approved (decisions are final)', async () => {
    const store = new InMemoryRequirementStore();
    const requirement = await store.create(baseInput);
    await store.decide(requirement.requirementId, {
      decision: 'Rejected',
      decidedBy: 'human.ceo',
      decidedAt: '2026-09-06T01:00:00.000Z',
    });

    await expect(
      store.decide(requirement.requirementId, {
        decision: 'Approved',
        decidedBy: 'human.ceo',
        decidedAt: '2026-09-06T02:00:00.000Z',
      }),
    ).rejects.toThrow(RequirementAlreadyDecidedError);

    // Status must remain Rejected — the failed re-decide must not have mutated it.
    expect((await store.get(requirement.requirementId))?.status).toBe('Rejected');
  });

  it('decide on an unknown requirement id returns undefined', async () => {
    const store = new InMemoryRequirementStore();
    expect(
      await store.decide('req-missing', { decision: 'Approved', decidedBy: 'human.ceo', decidedAt: '2026-09-06T01:00:00.000Z' }),
    ).toBeUndefined();
  });
});

describe('MySqlRequirementStore', () => {
  function fakeExecutor() {
    return vi.fn<MySqlExecutor['execute']>(async () => [] as never);
  }

  it('create issues a single INSERT with the built requirement fields', async () => {
    const execute = fakeExecutor();
    const store = new MySqlRequirementStore({ execute: execute as unknown as MySqlExecutor['execute'] });

    const requirement = await store.create({ ...baseInput, projectId: 'proj-1' });

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO requirements');
    expect(params).toContain(requirement.requirementId);
    expect(params).toContain('proj-1');
  });

  it('get maps a stored row back into a valid RequirementContract', async () => {
    const execute = fakeExecutor();
    execute.mockResolvedValueOnce([
      {
        requirement_id: 'req-1',
        header_id: 'req-1',
        request_id: 'req-intake-1',
        project_id: 'proj-1',
        opportunity_id: null,
        customer_id: null,
        status: 'Draft',
        title: 'Add checkout retries',
        problem: 'Checkout fails silently.',
        desired_outcome: 'Checkout succeeds.',
        constraints_json: '[]',
        acceptance_criteria_json: '["Retries once"]',
        assumptions_json: '[]',
        open_questions_json: '[]',
        source_kind: 'Request',
        source_id: null,
        source_label: 'control-api feature intake',
        decision_json: null,
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);
    const store = new MySqlRequirementStore({ execute: execute as unknown as MySqlExecutor['execute'] });

    const requirement = await store.get('req-1');
    expect(requirement?.requirementId).toBe('req-1');
    expect(requirement?.requestId).toBe('req-intake-1');
    expect(requirement?.acceptanceCriteria).toEqual(['Retries once']);
  });

  it('get returns undefined when no row matches', async () => {
    const execute = fakeExecutor();
    const store = new MySqlRequirementStore({ execute: execute as unknown as MySqlExecutor['execute'] });
    expect(await store.get('req-missing')).toBeUndefined();
  });

  it('decide issues an UPDATE moving status to Accepted', async () => {
    const execute = fakeExecutor();
    execute.mockResolvedValueOnce([
      {
        requirement_id: 'req-1',
        header_id: 'req-1',
        request_id: null,
        project_id: null,
        opportunity_id: null,
        customer_id: null,
        status: 'Draft',
        title: 'Add checkout retries',
        problem: 'p',
        desired_outcome: 'd',
        constraints_json: '[]',
        acceptance_criteria_json: '["x"]',
        assumptions_json: '[]',
        open_questions_json: '[]',
        source_kind: 'Request',
        source_id: null,
        source_label: null,
        decision_json: null,
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);
    const store = new MySqlRequirementStore({ execute: execute as unknown as MySqlExecutor['execute'] });

    const decided = await store.decide('req-1', { decision: 'Approved', decidedBy: 'human.ceo', decidedAt: '2026-09-06T01:00:00.000Z' });

    expect(decided?.status).toBe('Accepted');
    const [sql, params] = execute.mock.calls[1]!;
    expect(sql).toContain('UPDATE requirements SET status');
    expect(params).toContain('Accepted');
  });

  it('refuses to re-decide an already-decided requirement', async () => {
    const execute = fakeExecutor();
    execute.mockResolvedValueOnce([
      {
        requirement_id: 'req-1',
        header_id: 'req-1',
        request_id: null,
        project_id: null,
        opportunity_id: null,
        customer_id: null,
        status: 'Rejected',
        title: 'Add checkout retries',
        problem: 'p',
        desired_outcome: 'd',
        constraints_json: '[]',
        acceptance_criteria_json: '["x"]',
        assumptions_json: '[]',
        open_questions_json: '[]',
        source_kind: 'Request',
        source_id: null,
        source_label: null,
        decision_json: JSON.stringify({ decision: 'Rejected', decidedBy: 'human.ceo', decidedAt: '2026-09-06T01:00:00.000Z' }),
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T01:00:00.000Z',
      },
    ] as never);
    const store = new MySqlRequirementStore({ execute: execute as unknown as MySqlExecutor['execute'] });

    await expect(
      store.decide('req-1', { decision: 'Approved', decidedBy: 'human.ceo', decidedAt: '2026-09-06T02:00:00.000Z' }),
    ).rejects.toThrow(RequirementAlreadyDecidedError);
    // Only the SELECT from get() ran — no UPDATE was issued.
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
