import type { RuntimeEventName } from '@umer/contracts';
import {
  createEventEnvelope,
  SUBJECTS,
  type MessageFabricClient,
} from '@umer/message-fabric';

/** Publishes intermediate Agent Runtime execution events (llm.*, tool.*, decision). */
export type AgentEventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
};

export function createNoopAgentEventPublisher(): AgentEventPublisher {
  return {
    async publish() {
      // no-op for tests / when observability wiring is absent
    },
  };
}

export function createMessageFabricAgentEventPublisher(
  fabric: MessageFabricClient,
  producer: string,
): AgentEventPublisher {
  return {
    async publish(name, correlationId, payload) {
      await fabric.publishEvent(
        `${SUBJECTS.EVT_RUNTIME}.${name}`,
        createEventEnvelope({ name, producer, correlationId, payload }),
      );
    },
  };
}
