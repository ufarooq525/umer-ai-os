import type { RegistryAdapter, RuntimeBinding } from './types.js';
import { SpecialistSdkError } from './errors.js';

export class InMemoryRegistryAdapter implements RegistryAdapter {
  private readonly bindings = new Map<string, RuntimeBinding>();

  async register(binding: RuntimeBinding): Promise<void> {
    this.bindings.set(binding.specialistId, structuredClone(binding));
  }

  get(specialistId: string): RuntimeBinding | undefined {
    return this.bindings.get(specialistId);
  }

  list(): RuntimeBinding[] {
    return [...this.bindings.values()];
  }

  clear(): void {
    this.bindings.clear();
  }
}

export async function registerBinding(
  adapter: RegistryAdapter,
  binding: RuntimeBinding,
): Promise<void> {
  try {
    await adapter.register(binding);
  } catch (err) {
    throw new SpecialistSdkError(
      'REGISTER_FAILED',
      `Failed to register specialist ${binding.specialistId}`,
      err,
    );
  }
}
