import type { CommandEnvelope, EventEnvelope } from '@umer/contracts';
import { parseContract, WorkPackageContractSchema } from '@umer/contracts';
import type { MessageFabricClient, SubscriptionHandle } from '@umer/message-fabric';
import { STREAMS, SUBJECTS } from '@umer/message-fabric';
import { ORCHESTRATION_COMMANDS } from './constants.js';
import { OrchestrationError } from './errors.js';
import type { Orchestrator } from './orchestrator.js';

export type OrchestrationWorkerOptions = {
  orchestrator: Orchestrator;
  fabric: MessageFabricClient;
  durablePrefix?: string;
};

export class OrchestrationWorker {
  private readonly orchestrator: Orchestrator;
  private readonly fabric: MessageFabricClient;
  private readonly durablePrefix: string;
  private subscriptions: SubscriptionHandle[] = [];

  constructor(options: OrchestrationWorkerOptions) {
    this.orchestrator = options.orchestrator;
    this.fabric = options.fabric;
    this.durablePrefix = options.durablePrefix ?? 'orchestration';
  }

  async start(): Promise<void> {
    const commandSub = await this.fabric.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: `${this.durablePrefix}-commands`,
        filterSubject: SUBJECTS.CMD_ORCHESTRATION,
      },
      async (command, ctx) => {
        await this.handleCommand(command);
        ctx.ack();
      },
    );

    const eventSub = await this.fabric.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: `${this.durablePrefix}-events`,
        filterSubject: `${SUBJECTS.EVT_RUNTIME}.agent.run.>`,
      },
      async (event, ctx) => {
        await this.handleAgentEvent(event);
        ctx.ack();
      },
    );

    this.subscriptions = [commandSub, eventSub];
  }

  async stop(): Promise<void> {
    await Promise.all(this.subscriptions.map((sub) => sub.stop()));
    this.subscriptions = [];
  }

  private async handleCommand(command: CommandEnvelope): Promise<void> {
    const { name, correlationId, payload } = command;

    switch (name) {
      case ORCHESTRATION_COMMANDS.QUEUE: {
        const workPackage = parseContract(
          WorkPackageContractSchema,
          payload.workPackage,
          'Invalid workpackage.queue payload',
        );
        await this.orchestrator.queue(workPackage, correlationId);
        return;
      }
      case ORCHESTRATION_COMMANDS.DISPATCH: {
        const workPackageId = String(payload.workPackageId ?? '');
        await this.orchestrator.dispatch(workPackageId, correlationId);
        return;
      }
      case ORCHESTRATION_COMMANDS.CANCEL: {
        const workPackageId = String(payload.workPackageId ?? '');
        const reason = String(payload.reason ?? 'cancelled');
        await this.orchestrator.cancel(workPackageId, correlationId, reason);
        return;
      }
      case ORCHESTRATION_COMMANDS.ACCEPT: {
        const workPackageId = String(payload.workPackageId ?? '');
        await this.orchestrator.accept(workPackageId, correlationId);
        return;
      }
      case ORCHESTRATION_COMMANDS.REJECT: {
        const workPackageId = String(payload.workPackageId ?? '');
        const reason = payload.reason ? String(payload.reason) : undefined;
        await this.orchestrator.reject(workPackageId, correlationId, reason);
        return;
      }
      case ORCHESTRATION_COMMANDS.RETRY: {
        const workPackageId = String(payload.workPackageId ?? '');
        await this.orchestrator.retry(workPackageId, correlationId);
        return;
      }
      default:
        throw new OrchestrationError('INVALID_COMMAND', `Unknown orchestration command: ${name}`);
    }
  }

  private async handleAgentEvent(event: EventEnvelope): Promise<void> {
    const workPackageId = String(event.payload.workPackageId ?? '');
    if (!workPackageId) {
      return;
    }

    switch (event.name) {
      case 'agent.run.started':
        await this.orchestrator.markRunning(workPackageId, event.correlationId);
        return;
      case 'agent.run.completed':
        await this.orchestrator.markAwaitingReview(workPackageId, event.correlationId);
        return;
      case 'agent.run.failed': {
        const errorMessage = String(event.payload.errorMessage ?? 'agent run failed');
        await this.orchestrator.handleAgentFailure(workPackageId, event.correlationId, errorMessage);
        return;
      }
      default:
        return;
    }
  }
}

export function createOrchestrationWorker(options: OrchestrationWorkerOptions): OrchestrationWorker {
  return new OrchestrationWorker(options);
}
