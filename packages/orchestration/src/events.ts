import type { RuntimeEventName } from '@umer/contracts';
import { createEventEnvelope } from '@umer/message-fabric';
import type { MessageFabricClient } from '@umer/message-fabric';
import { SUBJECTS } from '@umer/message-fabric';

export type EventPublisher = {
  publish(
    name: RuntimeEventName,
    correlationId: string,
    payload: Record<string, unknown>,
    causationId?: string,
  ): Promise<void>;
};

export function createEventPublisher(
  fabric: MessageFabricClient,
  producer: string,
): EventPublisher {
  return {
    async publish(name, correlationId, payload, causationId) {
      const event = createEventEnvelope({
        name,
        producer,
        correlationId,
        payload,
        causationId,
      });
      await fabric.publishEvent(`${SUBJECTS.EVT_RUNTIME}.${name}`, event);
    },
  };
}
