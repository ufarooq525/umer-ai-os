import type { RuntimeEventName } from '@umer/contracts';

export type ControlPlaneEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopControlPlaneEventPublisher(): ControlPlaneEventPublisher {
  return {
    async publish() {
      // no-op for in-process tests
    },
  };
}
