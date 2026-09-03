import type { RuntimeEventName } from '@umer/contracts';

/** Same shape as @umer/agent-runtime's AgentEventPublisher / this package's ControlPlaneEventPublisher. */
export type CommandEventPublisher = {
  publish(name: RuntimeEventName, correlationId: string, payload: Record<string, unknown>): Promise<void>;
};

export function createNoopCommandEventPublisher(): CommandEventPublisher {
  return {
    async publish() {
      // no-op for tests / when observability wiring is absent
    },
  };
}
