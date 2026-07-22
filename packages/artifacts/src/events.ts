import type { RuntimeEventName } from '@umer/contracts';

export type ArtifactEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopArtifactEventPublisher(): ArtifactEventPublisher {
  return {
    async publish() {
      // no-op for in-process tests
    },
  };
}
