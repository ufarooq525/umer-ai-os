import type { RuntimeEventName } from '@umer/contracts';

export type TrustEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopTrustEventPublisher(): TrustEventPublisher {
  return {
    async publish() {
      // no-op for in-process tests
    },
  };
}
