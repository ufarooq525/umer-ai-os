import type { RuntimeEventName } from '@umer/contracts';

export type AuditEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopAuditEventPublisher(): AuditEventPublisher {
  return {
    async publish() {
      // no-op for in-process tests
    },
  };
}
