import type { ArtifactEngine } from '@umer/artifacts';
import type { AuditService } from '@umer/audit';
import type { ArtifactContract, CommandEnvelope } from '@umer/contracts';
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

export type AgentDisplayInfo = {
  name?: string;
  department?: string;
  capabilityIds?: string[];
};

export type AgentWorkerOptions = {
  runtime: AgentRuntime;
  fabric: MessageFabricClient;
  producer: string;
  durablePrefix?: string;
  artifactEngine?: ArtifactEngine;
  auditService?: AuditService;
  /**
   * Optional synchronous lookup for Agent Registry display fields (name,
   * department, capabilityIds) by specialistId — apps/agent-worker/src/main.ts
   * already has every registered Specialist mandate loaded at boot, so it can
   * supply this cheaply. Without it, the Agent Registry still works fully
   * (status, current work, timestamps) — these three fields just stay unset.
   */
  resolveAgentDisplay?: (specialistId: string) => AgentDisplayInfo | undefined;
};

export class AgentWorker {
  private readonly runtime: AgentRuntime;
  private readonly fabric: MessageFabricClient;
  private readonly producer: string;
  private readonly durablePrefix: string;
  private readonly artifactEngine?: ArtifactEngine;
  private readonly auditService?: AuditService;
  private readonly resolveAgentDisplay?: (specialistId: string) => AgentDisplayInfo | undefined;
  private subscription: SubscriptionHandle | undefined;

  constructor(options: AgentWorkerOptions) {
    this.runtime = options.runtime;
    this.fabric = options.fabric;
    this.producer = options.producer;
    this.durablePrefix = options.durablePrefix ?? 'agent';
    this.artifactEngine = options.artifactEngine;
    this.auditService = options.auditService;
    this.resolveAgentDisplay = options.resolveAgentDisplay;
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

  /**
   * Agent (worker) identity for events — one Agent per specialist mandate
   * this process can execute (see implementation/COMPANY_OPERATING_MODEL.md).
   * Deterministic and stable across restarts: no separate registration step.
   */
  private agentIdFor(specialistId: string | undefined): string | undefined {
    return specialistId ? `${this.producer}:${specialistId}` : undefined;
  }

  private async handleDispatch(command: CommandEnvelope): Promise<void> {
    const rawWorkPackage = (
      command.payload as {
        workPackage?: {
          workPackageId?: string;
          execId?: string;
          specialistId?: string;
          taskIds?: string[];
        };
      }
    ).workPackage;
    const workPackageId = String(rawWorkPackage?.workPackageId ?? '');
    const dispatchAgentId = this.agentIdFor(rawWorkPackage?.specialistId);
    const display = rawWorkPackage?.specialistId
      ? this.resolveAgentDisplay?.(rawWorkPackage.specialistId)
      : undefined;

    // Best-effort correlation fields straight off the raw dispatch payload —
    // read before contract validation so the very first agent.run.started
    // event a CEO read model sees already knows which agent/specialist/exec
    // this is, instead of only finding out once agent.llm.requested fires.
    await this.publishAgentEvent('agent.run.started', command.correlationId, {
      workPackageId,
      ...(rawWorkPackage?.execId ? { execId: rawWorkPackage.execId } : {}),
      ...(rawWorkPackage?.specialistId ? { specialistId: rawWorkPackage.specialistId } : {}),
      ...(dispatchAgentId ? { agentId: dispatchAgentId } : {}),
      ...(rawWorkPackage?.taskIds?.length ? { taskIds: rawWorkPackage.taskIds } : {}),
      ...(display?.name ? { name: display.name } : {}),
      ...(display?.department ? { department: display.department } : {}),
      ...(display?.capabilityIds?.length ? { capabilityIds: display.capabilityIds } : {}),
    });

    try {
      const result = await this.runtime.execute(command.payload, command.correlationId);
      let sealedArtifact: ArtifactContract | undefined;
      if (this.artifactEngine) {
        sealedArtifact = await this.artifactEngine.seal(result.artifact, command.correlationId);
        await this.auditService?.append(
          {
            action: 'artifact.sealed',
            actor: result.specialistId,
            resourceType: 'artifact',
            resourceId: sealedArtifact.artifactId,
            outcome: 'success',
            correlationId: command.correlationId,
            detail: { artifactType: sealedArtifact.artifactType },
          },
          command.correlationId,
        );
      }
      const completedAgentId = this.agentIdFor(result.specialistId);
      await this.publishAgentEvent('agent.run.completed', command.correlationId, {
        workPackageId: result.workPackageId,
        runId: result.runId,
        summary: result.summary,
        artifactId: result.artifact.artifactId,
        ...(completedAgentId ? { agentId: completedAgentId } : {}),
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
            // Full sealed contract, only when a real ArtifactEngine actually
            // sealed one — lets subscribers (control-api's artifact-bridge.ts)
            // reconstruct the real artifact without a second cross-process
            // store to query. Before this, control-api's own ArtifactStore was
            // never populated by anything in production: it lived in a
            // separate process from agent-worker's ArtifactEngine, and this
            // event only ever carried IDs.
            ...(sealedArtifact ? { artifact: sealedArtifact } : {}),
          },
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.publishAgentEvent('agent.run.failed', command.correlationId, {
        workPackageId,
        errorMessage: message,
        code: err instanceof AgentRuntimeError ? err.code : 'HANDLER_FAILED',
        ...(dispatchAgentId ? { agentId: dispatchAgentId } : {}),
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
