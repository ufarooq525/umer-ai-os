import type { CommandEnvelope, EventEnvelope } from '@umer/contracts';
import type {
  CommandHandler,
  EventHandler,
  MessageAckContext,
  MessageFabricClient,
  SubscribeOptions,
  SubscriptionHandle,
} from '@umer/message-fabric';
import { STREAMS, SUBJECTS } from '@umer/message-fabric';

function subjectMatches(subject: string, filter: string): boolean {
  if (filter.endsWith('.>')) {
    return subject.startsWith(filter.slice(0, -1));
  }
  if (filter.endsWith('>')) {
    const prefix = filter.slice(0, -1);
    return subject.startsWith(prefix);
  }
  return subject === filter;
}

const ackCtx: MessageAckContext = {
  correlationId: 'in-memory',
  deliveryCount: 1,
  ack: () => undefined,
  nak: () => undefined,
  term: () => undefined,
};

type CommandSub = { filter: string; handler: CommandHandler };
type EventSub = { filter: string; handler: EventHandler };

/**
 * Synchronous in-memory Message Fabric for E2E tests.
 */
export class InMemoryMessageFabric implements Pick<
  MessageFabricClient,
  'publishCommand' | 'publishEvent' | 'subscribeCommands' | 'subscribeEvents' | 'ensureInfrastructure'
> {
  readonly nc = {} as MessageFabricClient['nc'];
  readonly js = {} as MessageFabricClient['js'];
  readonly jsm = {} as MessageFabricClient['jsm'];
  readonly producer = 'in-memory-fabric';

  private readonly commandSubs: CommandSub[] = [];
  private readonly eventSubs: EventSub[] = [];

  async ensureInfrastructure(): Promise<void> {
    return undefined;
  }

  async publishCommand(subject: string, command: CommandEnvelope): Promise<void> {
    for (const sub of this.commandSubs) {
      if (subjectMatches(subject, sub.filter)) {
        await sub.handler(command, ackCtx);
      }
    }
  }

  async publishEvent(subject: string, event: EventEnvelope): Promise<void> {
    for (const sub of this.eventSubs) {
      if (subjectMatches(subject, sub.filter)) {
        await sub.handler(event, ackCtx);
      }
    }
  }

  async subscribeCommands(
    options: SubscribeOptions,
    handler: CommandHandler,
  ): Promise<SubscriptionHandle> {
    this.commandSubs.push({ filter: options.filterSubject, handler });
    return { stop: async () => undefined };
  }

  async subscribeEvents(
    options: SubscribeOptions,
    handler: EventHandler,
  ): Promise<SubscriptionHandle> {
    this.eventSubs.push({ filter: options.filterSubject, handler });
    return { stop: async () => undefined };
  }
}

export { STREAMS, SUBJECTS };
