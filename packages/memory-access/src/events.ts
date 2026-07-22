import type { RuntimeEventName } from '@umer/contracts';

export type MemoryEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopMemoryEventPublisher(): MemoryEventPublisher {
  return {
    async publish() {
      // no-op for in-process tests
    },
  };
}
