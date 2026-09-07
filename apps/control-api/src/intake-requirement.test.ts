import { describe, expect, it } from 'vitest';
import { createControlApiState } from './server.js';
import { InMemoryRequirementStore } from './requirement-store.js';
import { submitIntake } from './state.js';

describe('intake -> canonical Requirement', () => {
  it('a real intake persists a Draft Requirement with full provenance', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();

    await submitIntake(state, {
      projectId: 'school-app',
      type: 'brainstorm',
      goal: 'Explore adding a parent-teacher messaging feature',
      doneWhen: 'A written recommendation with tradeoffs exists',
      constraints: ['Must not require a new backend service'],
      requestId: 'req-inbound-42',
      opportunityId: 'opp-77',
      customerId: 'cust-9',
    });

    const requirements = await state.requirementStore.list({ projectId: 'school-app' });
    expect(requirements).toHaveLength(1);
    const requirement = requirements[0]!;

    expect(requirement.status).toBe('Draft');
    expect(requirement.projectId).toBe('school-app');
    expect(requirement.requestId).toBe('req-inbound-42');
    expect(requirement.opportunityId).toBe('opp-77');
    expect(requirement.customerId).toBe('cust-9');
    expect(requirement.problem).toBe('Explore adding a parent-teacher messaging feature');
    expect(requirement.desiredOutcome).toBe('A written recommendation with tradeoffs exists');
    expect(requirement.constraints).toEqual(['Must not require a new backend service']);
    expect(requirement.acceptanceCriteria.length).toBeGreaterThan(0);
    // opportunityId takes precedence over customerId/requestId for source lineage
    // when more than one is present on the same intake.
    expect(requirement.source).toEqual({ kind: 'Opportunity', id: 'opp-77', label: 'control-api brainstorm intake' });
  });

  it('an intake with no opportunity/customer falls back to Request-sourced lineage', async () => {
    const state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();

    await submitIntake(state, {
      projectId: 'school-app',
      type: 'brainstorm',
      goal: 'Explore a parent feedback form',
      requestId: 'req-inbound-43',
    });

    const requirements = await state.requirementStore.list({ projectId: 'school-app' });
    expect(requirements[0]?.source).toEqual({ kind: 'Request', id: 'req-inbound-43', label: 'control-api brainstorm intake' });
  });

  it('does not persist a requirement when no requirementStore is connected', async () => {
    const state = await createControlApiState();
    expect(state.requirementStore).toBeUndefined();
    // submitIntake must not throw just because requirement persistence is unavailable.
    await expect(
      submitIntake(state, { projectId: 'school-app', type: 'brainstorm', goal: 'Explore something' }),
    ).resolves.toBeDefined();
  });
});
