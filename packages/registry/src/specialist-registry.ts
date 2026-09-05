import type { SpecialistContract, SpecialistLifecycleStatus } from '@umer/contracts';

export class SpecialistRegistryError extends Error {
  constructor(
    public readonly code:
      | 'SPECIALIST_NOT_FOUND'
      | 'SPECIALIST_INACTIVE'
      | 'SPECIALIST_DUPLICATE',
    message: string,
  ) {
    super(message);
    this.name = 'SpecialistRegistryError';
  }
}

export interface SpecialistMatchQuery {
  capabilityId?: string;
  department?: string;
  status?: SpecialistLifecycleStatus;
  includeSuspended?: boolean;
}

/**
 * Runtime-facing specialist registry.
 *
 * The registry stores registered Specialist Contracts and provides deterministic
 * capability/department resolution. It deliberately does not create agents,
 * invent capabilities, or decide business intent; staffing and authority remain
 * governed by the Specialist Contract and Control Plane.
 */
export class SpecialistRegistry {
  private readonly byId = new Map<string, SpecialistContract>();

  constructor(initial: readonly SpecialistContract[] = []) {
    for (const specialist of initial) this.register(specialist);
  }

  register(specialist: SpecialistContract): void {
    if (this.byId.has(specialist.specialistId)) {
      throw new SpecialistRegistryError(
        'SPECIALIST_DUPLICATE',
        `Specialist already registered: ${specialist.specialistId}`,
      );
    }
    this.byId.set(specialist.specialistId, specialist);
  }

  replace(specialist: SpecialistContract): void {
    if (!this.byId.has(specialist.specialistId)) {
      throw new SpecialistRegistryError(
        'SPECIALIST_NOT_FOUND',
        `Unknown specialist: ${specialist.specialistId}`,
      );
    }
    this.byId.set(specialist.specialistId, specialist);
  }

  get(specialistId: string): SpecialistContract {
    const specialist = this.byId.get(specialistId);
    if (!specialist) {
      throw new SpecialistRegistryError(
        'SPECIALIST_NOT_FOUND',
        `Unknown specialist: ${specialistId}`,
      );
    }
    return specialist;
  }

  requireActive(specialistId: string): SpecialistContract {
    const specialist = this.get(specialistId);
    if (specialist.status !== 'Active') {
      throw new SpecialistRegistryError(
        'SPECIALIST_INACTIVE',
        `Specialist ${specialistId} is ${specialist.status}`,
      );
    }
    return specialist;
  }

  list(options?: SpecialistMatchQuery): SpecialistContract[] {
    const includeSuspended = options?.includeSuspended ?? false;
    return [...this.byId.values()].filter((specialist) => {
      if (!includeSuspended && specialist.status === 'Suspended') return false;
      if (options?.status && specialist.status !== options.status) return false;
      if (options?.department && specialist.department !== options.department) return false;
      if (options?.capabilityId && !specialist.capabilityIds.includes(options.capabilityId)) {
        return false;
      }
      return true;
    });
  }

  resolve(options: SpecialistMatchQuery): SpecialistContract[] {
    return this.list({ ...options, status: options.status ?? 'Active' });
  }

  has(specialistId: string): boolean {
    return this.byId.has(specialistId);
  }

  size(): number {
    return this.byId.size;
  }
}

export function createSpecialistRegistry(
  initial: readonly SpecialistContract[] = [],
): SpecialistRegistry {
  return new SpecialistRegistry(initial);
}
