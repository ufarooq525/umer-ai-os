import { describe, expect, it } from 'vitest';
import type { SpecialistContract } from '@umer/contracts';
import {
  SpecialistRegistry,
  SpecialistRegistryError,
  createSpecialistRegistry,
} from './specialist-registry.js';

const specialist = (overrides: Partial<SpecialistContract> = {}): SpecialistContract =>
  ({
    contractVersion: '1.0.0',
    schemaVersion: '1.0.0',
    kind: 'specialist',
    specialistId: 'specialist.backend',
    name: 'Backend Developer',
    department: 'Engineering',
    mission: 'Implement backend work packages',
    mandateDomain: 'Delivery',
    authorityClass: 'Produce',
    interactionMode: 'SoloProducer',
    status: 'Active',
    capabilityIds: ['backend.implementation'],
    skillBindings: ['typescript'],
    toolAllowlist: ['repo.read', 'repo.write'],
    nonGoals: ['approve production releases'],
    specVersion: '1.0.0',
    specHash: 'sha256:test',
    humanAccountabilityAnchor: 'Engineering owner',
    ...overrides,
  }) as SpecialistContract;

describe('SpecialistRegistry', () => {
  it('registers and resolves active specialists by capability', () => {
    const registry = createSpecialistRegistry([
      specialist(),
      specialist({
        specialistId: 'specialist.frontend',
        name: 'Frontend Developer',
        capabilityIds: ['frontend.implementation'],
      }),
    ]);

    expect(registry.size()).toBe(2);
    expect(registry.resolve({ capabilityId: 'backend.implementation' })).toHaveLength(1);
    expect(registry.resolve({ capabilityId: 'backend.implementation' })[0]?.specialistId).toBe(
      'specialist.backend',
    );
  });

  it('does not resolve suspended specialists by default', () => {
    const registry = new SpecialistRegistry([
      specialist({ status: 'Suspended' }),
      specialist({
        specialistId: 'specialist.active-backend',
        name: 'Active Backend Developer',
      }),
    ]);

    expect(registry.resolve({ capabilityId: 'backend.implementation' })).toHaveLength(1);
    expect(registry.list({ includeSuspended: true })).toHaveLength(2);
  });

  it('fails closed when requiring an inactive specialist', () => {
    const registry = new SpecialistRegistry([specialist({ status: 'Retired' })]);

    expect(() => registry.requireActive('specialist.backend')).toThrowError(
      SpecialistRegistryError,
    );
    expect(() => registry.requireActive('specialist.backend')).toThrow(
      'Specialist specialist.backend is Retired',
    );
  });

  it('rejects duplicate registrations', () => {
    const registry = new SpecialistRegistry([specialist()]);

    expect(() => registry.register(specialist())).toThrow('Specialist already registered');
  });
});
