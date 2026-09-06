import type { CommandEnvelope, EventEnvelope, WorkGraphNodeContract } from '@umer/contracts';
import { parseContract, WorkPackageContractSchema } from '@umer/contracts';
import type { MessageFabricClient, SubscriptionHandle } from '@umer/message-fabric';
import { createEventEnvelope, STREAMS, SUBJECTS } from '@umer/message-fabric';
import { ORCHESTRATION_COMMANDS } from './constants.js';
import { OrchestrationError } from './errors.js';
import type { Orchestrator } from './orchestrator.js';
import { ReadyWorkPackagePlanner, type ResolvedSpecialist } from './ready-work-package-planner.js';
import type { PersistentWorkGraph } from './work-graph-store.js';
import type { WorkGraphProjector } from './work-graph-projector.js';

/** Enables handling `workgraph.plan` commands — see PLAN_PROJECT's case in handleCommand. */
export type WorkGraphPlanningOptions = {
  persistentGraph: PersistentWorkGraph;
  /** Returning undefined for a node type this deployment has no real dispatchable Specialist for is correct — ReadyWorkPackagePlanner skips it rather than fabricating one. */
  resolveSpecialist: (node: WorkGraphNodeContract) => ResolvedSpecialist | undefined;
};

export type OrchestrationWorkerOptions = {
  orchestrator: Orchestrator;
  fabric: MessageFabricClient;
  durablePrefix?: string;
  /**
   * Optional: projects Work Package lifecycle transitions onto the
   * originating Work Graph node (see work-graph-projector.ts). Omit for
   * deployments/tests with no Work Graph in play — every call site below is
   * a no-op without it.
   */
  workGraphProjector?: WorkGraphProjector;
  /** Optional: handles `workgraph.plan` commands (see WorkGraphPlanningOptions). Omitted deployments/tests just get INVALID_COMMAND for that command name, same as before this existed. */
  workGraphPlanning?: WorkGraphPlanningOptions;
};

export class OrchestrationWorker {
  private readonly orchestrator: Orchestrator;
  private readonly fabric: MessageFabricClient;
  private readonly durablePrefix: string;
  private readonly workGraphProjector?: WorkGraphProjector;
  private readonly workGraphPlanning?: WorkGraphPlanningOptions;
  private subscriptions: SubscriptionHandle[] = [];

  constructor(options: OrchestrationWorkerOptions) {
    this.orchestrator = options.orchestrator;
    this.fabric = options.fabric;
    this.durablePrefix = options.durablePrefix ?? 'orchestration';
    this.workGraphProjector = options.workGraphProjector;
    this.workGraphPlanning = options.workGraphPlanning;
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
        await this.workGraphProjector?.onCancelled(workPackageId);
        return;
      }
      case ORCHESTRATION_COMMANDS.ACCEPT: {
        const workPackageId = String(payload.workPackageId ?? '');
        await this.orchestrator.accept(workPackageId, correlationId);
        await this.workGraphProjector?.onAccepted(workPackageId);
        return;
      }
      case ORCHESTRATION_COMMANDS.REJECT: {
        const workPackageId = String(payload.workPackageId ?? '');
        const reason = payload.reason ? String(payload.reason) : undefined;
        await this.orchestrator.reject(workPackageId, correlationId, reason);
        await this.workGraphProjector?.onFailed(workPackageId);
        return;
      }
      case ORCHESTRATION_COMMANDS.RETRY: {
        const workPackageId = String(payload.workPackageId ?? '');
        await this.orchestrator.retry(workPackageId, correlationId);
        await this.workGraphProjector?.onRetried(workPackageId);
        return;
      }
      case ORCHESTRATION_COMMANDS.PLAN_PROJECT: {
        if (!this.workGraphPlanning) {
          throw new OrchestrationError(
            'INVALID_COMMAND',
            'workgraph.plan received but this OrchestrationWorker has no workGraphPlanning configured',
          );
        }
        const projectId = String(payload.projectId ?? '');
        const execId = String(payload.execId ?? '');
        const contextHandle = String(payload.contextHandle ?? '');
        const taskIdsByNodeId = (payload.taskIdsByNodeId ?? {}) as Record<string, string[] | undefined>;

        const planner = new ReadyWorkPackagePlanner({
          orchestrator: this.orchestrator,
          persistentGraph: this.workGraphPlanning.persistentGraph,
          resolveSpecialist: this.workGraphPlanning.resolveSpecialist,
          resolveTaskContext: (node) => {
            const taskIds = taskIdsByNodeId[node.nodeId];
            return taskIds && taskIds.length > 0 ? { taskIds } : undefined;
          },
        });

        const result = await planner.planProject(projectId, { execId, contextHandle, correlationId });
        await this.fabric.publishEvent(
          `${SUBJECTS.EVT_RUNTIME}.workgraph.planned`,
          createEventEnvelope({
            name: 'workgraph.planned',
            producer: `${this.durablePrefix}-worker`,
            correlationId,
            payload: {
              projectId,
              created: result.created.map((wp) => wp.workPackageId),
              skipped: result.skipped,
            },
          }),
        );
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
        await this.workGraphProjector?.onRunning(workPackageId);
        return;
      case 'agent.run.completed':
        await this.orchestrator.markAwaitingReview(workPackageId, event.correlationId);
        await this.workGraphProjector?.onAwaitingReview(workPackageId);
        return;
      case 'agent.run.failed': {
        const errorMessage = String(event.payload.errorMessage ?? 'agent run failed');
        const result = await this.orchestrator.handleAgentFailure(workPackageId, event.correlationId, errorMessage);
        // handleAgentFailure retries (status back to Queued) under the max-attempts
        // ceiling, or leaves the Work Package terminally Failed once it's exceeded —
        // the graph node should reflect whichever actually happened.
        if (result.status === 'Queued') {
          await this.workGraphProjector?.onRetried(workPackageId);
        } else {
          await this.workGraphProjector?.onFailed(workPackageId);
        }
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
