import {
  parseContract,
  SCHEMA_VERSION,
  WorkPackageContractSchema,
  type WorkGraphNodeContract,
  type WorkPackageContract,
} from '@umer/contracts';
import { OrchestrationError } from './errors.js';
import type { Orchestrator } from './orchestrator.js';
import type { PersistentWorkGraph } from './work-graph-store.js';

/**
 * Real execution context a Work Package cannot legally exist without. There
 * is no default/placeholder for any of these — see class doc below.
 */
export type PlanningExecutionContext = {
  execId: string;
  contextHandle: string;
  correlationId: string;
};

export type ResolvedSpecialist = {
  specialistId: string;
  specialistSpecVersion: string;
  specialistSpecHash: string;
};

export type ResolvedTaskDetail = { taskId: string; title: string; description: string };

export type ResolvedTaskContext = {
  taskIds: string[];
  capabilityIds?: string[];
  toolAllowlist?: string[];
  /** Real, resolved filesystem root for a Specialist whose tools need real file access — see WorkPackageContract's targetPath. Omit when none was resolved; a node whose Specialist requires one should have its resolveTaskContext return undefined instead of a made-up path. */
  targetPath?: string;
  /** The real Task(s)' own title/description, when the caller has them — becomes the Work Package's metadata.annotations.instruction (see planProject below) instead of the LLM agent loop falling back to a bare "Tasks: <id>" message with no real content. Omit when unavailable; never fabricated. */
  taskDetails?: ResolvedTaskDetail[];
};

export type ReadyWorkPackagePlannerOptions = {
  orchestrator: Orchestrator;
  persistentGraph: PersistentWorkGraph;
  /** Active-specialist lookup for a node's type/capabilities — e.g. backed by @umer/specialist-sdk's registry. Returning undefined fails that node closed (skipped, not fabricated). */
  resolveSpecialist: (node: WorkGraphNodeContract) => ResolvedSpecialist | undefined;
  /** Real Task ids (and optional capability/tool scope) this node's Work Package should carry. Returning undefined/empty fails that node closed. */
  resolveTaskContext: (node: WorkGraphNodeContract) => ResolvedTaskContext | undefined;
  /** Defaults to true: queue AND dispatch through the Orchestrator. Set false to only queue (e.g. for a review-before-dispatch flow). */
  dispatch?: boolean;
};

export type PlanSkip = { nodeId: string; nodeType: string; reason: string };

export type PlanResult = {
  created: WorkPackageContract[];
  skipped: PlanSkip[];
};

/**
 * Turns a Project's Ready Work Graph nodes into real, dispatched Work
 * Packages. This is the only place a Work Graph node becomes a Work Package —
 * see implementation vision's "Work Graph → Ready Work Package Planner →
 * Work Package → Orchestrator" pipeline.
 *
 * Fails CLOSED, never fabricates: a missing execId/contextHandle/
 * correlationId aborts the whole planning pass (there is no such thing as
 * planning "for no execution"); a ready node whose task ids or specialist
 * can't be resolved is reported in `skipped` with a reason, never given a
 * placeholder id just to produce a Work Package.
 */
export class ReadyWorkPackagePlanner {
  constructor(private readonly options: ReadyWorkPackagePlannerOptions) {}

  async planProject(projectId: string, execution: PlanningExecutionContext): Promise<PlanResult> {
    if (!execution?.execId) {
      throw new OrchestrationError('MISSING_EXECUTION_CONTEXT', 'Planning requires a real execId');
    }
    if (!execution.contextHandle) {
      throw new OrchestrationError('MISSING_EXECUTION_CONTEXT', 'Planning requires a real contextHandle');
    }
    if (!execution.correlationId) {
      throw new OrchestrationError('MISSING_EXECUTION_CONTEXT', 'Planning requires a real correlationId');
    }

    const graph = await this.options.persistentGraph.load(projectId);
    const ready = graph.listReadyNodes(projectId);

    const created: WorkPackageContract[] = [];
    const skipped: PlanSkip[] = [];

    for (const node of ready) {
      const taskContext = this.options.resolveTaskContext(node);
      if (!taskContext || taskContext.taskIds.length === 0) {
        skipped.push({ nodeId: node.nodeId, nodeType: node.type, reason: 'no real Task ids resolved for this node' });
        continue;
      }

      const specialist = this.options.resolveSpecialist(node);
      if (!specialist) {
        skipped.push({
          nodeId: node.nodeId,
          nodeType: node.type,
          reason: `no active Specialist resolved for node type ${node.type}`,
        });
        continue;
      }

      const now = new Date().toISOString();
      const workPackageId = `wp-${node.nodeId}`;
      const instruction =
        taskContext.taskDetails && taskContext.taskDetails.length > 0
          ? taskContext.taskDetails.map((t) => `Task: ${t.title}\n${t.description}`).join('\n\n')
          : undefined;
      const workPackage = parseContract(WorkPackageContractSchema, {
        id: `hdr-${workPackageId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        metadata: { labels: {}, annotations: instruction ? { instruction } : {} },
        kind: 'work_package',
        workPackageId,
        execId: execution.execId,
        stage: node.type,
        status: 'Draft',
        specialistId: specialist.specialistId,
        specialistSpecVersion: specialist.specialistSpecVersion,
        specialistSpecHash: specialist.specialistSpecHash,
        taskIds: taskContext.taskIds,
        capabilityIds: taskContext.capabilityIds ?? [],
        contextHandle: execution.contextHandle,
        toolAllowlist: taskContext.toolAllowlist ?? [],
        resourceEnvelope: { parallelism: 1 },
        attempt: 1,
        correlationId: execution.correlationId,
        ...(taskContext.targetPath ? { targetPath: taskContext.targetPath } : {}),
      });

      const queued = await this.options.orchestrator.queue(workPackage, execution.correlationId);
      await this.options.persistentGraph.attachWorkPackage(graph, projectId, node.nodeId, queued.workPackageId);

      const finalWorkPackage =
        this.options.dispatch !== false
          ? await this.options.orchestrator.dispatch(queued.workPackageId, execution.correlationId)
          : queued;

      created.push(finalWorkPackage);
    }

    return { created, skipped };
  }
}
