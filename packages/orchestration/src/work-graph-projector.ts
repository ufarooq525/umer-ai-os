import type { WorkGraphNodeStatus } from '@umer/contracts';
import type { PersistentWorkGraph } from './work-graph-store.js';
import type { WorkGraphStore } from './work-graph-store.js';

/**
 * Projects Work Package lifecycle transitions onto the Work Graph node that
 * originated them, per the product vision's mapping:
 *
 *   markRunning        → InProgress
 *   markAwaitingReview  → Review
 *   accept              → Accepted
 *   reject / fail       → Failed
 *   cancel              → Cancelled
 *   retry               → Ready
 *
 * (queue/dispatch cause no graph transition: a Work Package is only ever
 * queued for a node already Ready, so there's nothing to project.)
 *
 * A Work Package with no originating Work Graph node (e.g. the separate
 * audit-pipeline intake flow, or one created directly rather than through
 * ReadyWorkPackagePlanner) is a no-op here, not an error — most Work
 * Packages in this codebase today don't come from a Work Graph node.
 */
export class WorkGraphProjector {
  constructor(
    private readonly persistentGraph: PersistentWorkGraph,
    private readonly store: WorkGraphStore,
  ) {}

  async onRunning(workPackageId: string): Promise<void> {
    await this.project(workPackageId, 'InProgress');
  }

  async onAwaitingReview(workPackageId: string): Promise<void> {
    await this.project(workPackageId, 'Review');
  }

  async onAccepted(workPackageId: string): Promise<void> {
    await this.project(workPackageId, 'Accepted');
  }

  async onFailed(workPackageId: string): Promise<void> {
    await this.project(workPackageId, 'Failed');
  }

  async onCancelled(workPackageId: string): Promise<void> {
    await this.project(workPackageId, 'Cancelled');
  }

  async onRetried(workPackageId: string): Promise<void> {
    // A retry is projected as two legal hops, not one: the node's own state
    // machine has no direct InProgress -> Ready edge (NODE_TRANSITIONS in
    // work-graph.ts), only InProgress -> Failed -> Ready -- confirmed live,
    // where a real retry (this session's own worker.ts fix that redispatches
    // on retry) threw "Illegal Work Graph node transition: InProgress ->
    // Ready" every time, and — because handleAgentEvent's own event
    // subscription never caught that throw either — caused NATS to
    // redeliver the same evt.runtime.agent.run.failed event repeatedly
    // until it silently landed in the DLQ, never actually retrying at all.
    await this.project(workPackageId, 'Failed');
    await this.project(workPackageId, 'Ready');
  }

  private async project(workPackageId: string, status: WorkGraphNodeStatus): Promise<void> {
    const projectId = await this.store.findProjectIdByWorkPackage(workPackageId);
    if (!projectId) return;

    const graph = await this.persistentGraph.load(projectId);
    const node = graph.findNodeByWorkPackage(workPackageId);
    if (!node) return;

    await this.persistentGraph.setNodeStatus(graph, projectId, node.nodeId, status);
  }
}
