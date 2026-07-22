import type { ArtifactEngine } from '@umer/artifacts';
import type { AuditService } from '@umer/audit';
import type { CommandEnvelope } from '@umer/contracts';
import {
  createEventEnvelope,
  STREAMS,
  SUBJECTS,
  type MessageFabricClient,
  type SubscriptionHandle,
} from '@umer/message-fabric';
import { WORK_PACKAGE_DISPATCH_COMMAND } from './constants.js';
import type { AgentRuntime } from './runtime.js';
import { AgentRuntimeError } from './errors.js';

export type AgentWorkerOptions = {
  runtime: AgentRuntime;
  fabric: MessageFabricClient;
  producer: string;
  durablePrefix?: string;
  artifactEngine?: ArtifactEngine;
  auditService?: AuditService;
};

export class AgentWorker {
  private readonly runtime: AgentRuntime;
  private readonly fabric: MessageFabricClient;
  private readonly producer: string;
  private readonly durablePrefix: string;
  private readonly artifactEngine?: ArtifactEngine;
  private readonly auditService?: AuditService;
  private subscription: SubscriptionHandle | undefined;

  constructor(options: AgentWorkerOptions) {
    this.runtime = options.runtime;
    this.fabric = options.fabric;
    this.producer = options.producer;
    this.durablePrefix = options.durablePrefix ?? 'agent';
    this.artifactEngine = options.artifactEngine;
    this.auditService = options.auditService;
  }

  async start(): Promise<void> {
    this.subscription = await this.fabric.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: `${this.durablePrefix}-dispatch`,
        filterSubject: SUBJECTS.CMD_AGENT_DISPATCH,
      },
      async (command, ctx) => {
        if (command.name !== WORK_PACKAGE_DISPATCH_COMMAND) {
          ctx.ack();
          return;
        }
        await this.handleDispatch(command);
        ctx.ack();
      },
    );
  }

  async stop(): Promise<void> {
    await this.subscription?.stop();
    this.subscription = undefined;
  }

  private async handleDispatch(command: CommandEnvelope): Promise<void> {
    const workPackageId = String(
      (command.payload as { workPackage?: { workPackageId?: string } }).workPackage?.workPackageId ??
        '',
    );

    await this.publishAgentEvent('agent.run.started', command.correlationId, {
      workPackageId,
    });

    try {
      const result = await this.runtime.execute(command.payload, command.correlationId);
      if (this.artifactEngine) {
        const sealed = await this.artifactEngine.seal(result.artifact, command.correlationId);
        await this.auditService?.append(
          {
            action: 'artifact.sealed',
            actor: result.specialistId,
            resourceType: 'artifact',
            resourceId: sealed.artifactId,
            outcome: 'success',
            correlationId: command.correlationId,
            detail: { artifactType: sealed.artifactType },
          },
          command.correlationId,
        );
      }
      await this.publishAgentEvent('agent.run.completed', command.correlationId, {
        workPackageId: result.workPackageId,
        runId: result.runId,
        summary: result.summary,
        artifactId: result.artifact.artifactId,
      });
      await this.fabric.publishEvent(
        `${SUBJECTS.EVT_RUNTIME}.artifact.sealed`,
        createEventEnvelope({
          name: 'artifact.sealed',
          producer: this.producer,
          correlationId: command.correlationId,
          payload: {
            workPackageId: result.workPackageId,
            artifactId: result.artifact.artifactId,
            artifactType: result.artifact.artifactType,
          },
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.publishAgentEvent('agent.run.failed', command.correlationId, {
        workPackageId,
        errorMessage: message,
        code: err instanceof AgentRuntimeError ? err.code : 'HANDLER_FAILED',
      });
      throw err;
    }
  }

  private async publishAgentEvent(
    name: 'agent.run.started' | 'agent.run.completed' | 'agent.run.failed',
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.fabric.publishEvent(
      `${SUBJECTS.EVT_RUNTIME}.${name}`,
      createEventEnvelope({
        name,
        producer: this.producer,
        correlationId,
        payload,
      }),
    );
  }
}

export function createAgentWorker(options: AgentWorkerOptions): AgentWorker {
  return new AgentWorker(options);
}
