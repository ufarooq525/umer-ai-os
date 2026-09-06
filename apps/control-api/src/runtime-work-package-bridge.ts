import type { EventEnvelope } from '@umer/contracts';
import { createLogger } from '@umer/observability';
import {
  createMessageFabric,
  InMemoryIdempotencyStore,
  STREAMS,
  SUBJECTS,
  type SubscriptionHandle,
} from '@umer/message-fabric';
import type { ControlApiState, WorkGraphPlanResult, WorkPackageSummary } from './state.js';
import { projectArtifactSealedEvent } from './artifact-bridge.js';

const log = createLogger('control-api');

/**
 * Real Work Packages dispatched through the actual runtime (Orchestrator +
 * AgentWorker, see packages/orchestration and packages/agent-runtime) never
 * touched `state.workPackages` or `state.controlPlane` before this bridge —
 * those were populated only by the separate audit-pipeline "intake" flows in
 * @umer/registry and by seedDemoState's fabricated bootstrap record. This
 * module closes that gap using ONLY existing events (no new event bus, no new
 * contract): it projects `evt.runtime.agent.run.>` into `state.workPackages`
 * (so `/v1/work-packages` reflects genuinely-dispatched work) and, on
 * completion, opens a real Gate review via `state.controlPlane.requestGateReview`
 * (gateId `gate-wp-<workPackageId>`) so the CEO can actually see and act on
 * it — see server.ts's gate-resolve route, which publishes the matching
 * `workpackage.accept`/`workpackage.reject` command back to `cmd.orchestration`
 * when a `gate-wp-*` gate resolves.
 */

/** workPackageId -> execId, captured from agent.run.started — the only event that reliably carries it. */
export type ExecIdCache = Map<string, string>;

function upsertWorkPackage(
  state: ControlApiState,
  execIdByWorkPackage: ExecIdCache,
  patch: Partial<WorkPackageSummary> & { workPackageId: string },
): void {
  const existing = state.workPackages.find((wp) => wp.workPackageId === patch.workPackageId);
  const updatedAt = new Date().toISOString();
  if (existing) {
    Object.assign(existing, patch, { updatedAt });
    return;
  }
  state.workPackages.unshift({
    execId: execIdByWorkPackage.get(patch.workPackageId) ?? patch.workPackageId,
    status: 'Running',
    specialistId: 'unknown',
    stage: 'Execution',
    ...patch,
    updatedAt,
  });
}

/**
 * Pure projection of one `evt.runtime.agent.run.*` event onto control-api's
 * Work Package summary list + Gate review store. No Message Fabric
 * dependency — takes the event directly, so it's testable without NATS (see
 * runtime-work-package-bridge.test.ts), mirroring how
 * packages/agent-runtime/src/read-model.ts separates projection from
 * transport.
 */
export async function projectRuntimeWorkPackageEvent(
  state: ControlApiState,
  execIdByWorkPackage: ExecIdCache,
  event: EventEnvelope,
): Promise<void> {
  const workPackageId = String(event.payload.workPackageId ?? '');
  if (!workPackageId) return;

  switch (event.name) {
    case 'agent.run.started': {
      const execId = event.payload.execId ? String(event.payload.execId) : undefined;
      const specialistId = event.payload.specialistId
        ? String(event.payload.specialistId)
        : undefined;
      if (execId) {
        execIdByWorkPackage.set(workPackageId, execId);
      }
      upsertWorkPackage(state, execIdByWorkPackage, {
        workPackageId,
        execId: execId ?? execIdByWorkPackage.get(workPackageId) ?? workPackageId,
        status: 'Running',
        specialistId: specialistId ?? 'unknown',
      });
      return;
    }
    case 'agent.run.completed': {
      const execId = execIdByWorkPackage.get(workPackageId) ?? workPackageId;
      const artifactId = event.payload.artifactId ? String(event.payload.artifactId) : undefined;
      upsertWorkPackage(state, execIdByWorkPackage, {
        workPackageId,
        execId,
        status: 'AwaitingReview',
        ...(artifactId ? { artifactId } : {}),
      });
      try {
        await state.controlPlane.requestGateReview(
          {
            gateId: `gate-wp-${workPackageId}`,
            execId,
            workPackageId,
            artifactId,
            stageFrom: 'Execution',
            stageTo: 'Review',
            requiredApprovers: ['human.approver'],
            humanRequired: true,
          },
          event.correlationId,
        );
      } catch (err) {
        log.warn(
          { workPackageId, err: err instanceof Error ? err.message : String(err) },
          'could not open gate review for completed work package (already open?)',
        );
      }
      return;
    }
    case 'agent.run.failed': {
      const errorMessage = event.payload.errorMessage
        ? String(event.payload.errorMessage)
        : 'agent run failed';
      upsertWorkPackage(state, execIdByWorkPackage, {
        workPackageId,
        execId: execIdByWorkPackage.get(workPackageId) ?? workPackageId,
        status: 'Failed',
        errorMessage,
      });
      return;
    }
    default:
      return;
  }
}

/**
 * Pure projection of one `evt.runtime.workgraph.planned` event (published by
 * @umer/orchestration's OrchestrationWorker after a `workgraph.plan` command
 * runs ReadyWorkPackagePlanner) into `state.workGraphPlanResults`. No Message
 * Fabric dependency, same reasoning as projectRuntimeWorkPackageEvent above.
 */
export function projectWorkGraphPlannedEvent(state: ControlApiState, event: EventEnvelope): void {
  const projectId = String(event.payload.projectId ?? '');
  if (!projectId) return;
  if (!state.workGraphPlanResults) {
    state.workGraphPlanResults = new Map();
  }
  state.workGraphPlanResults.set(projectId, {
    created: Array.isArray(event.payload.created) ? (event.payload.created as string[]) : [],
    skipped: Array.isArray(event.payload.skipped)
      ? (event.payload.skipped as WorkGraphPlanResult['skipped'])
      : [],
    occurredAt: event.occurredAt,
  });
}

/**
 * Connects to the Message Fabric and wires two projections onto the same
 * client: projectRuntimeWorkPackageEvent (`evt.runtime.agent.run.>`) and
 * projectWorkGraphPlannedEvent (`evt.runtime.workgraph.planned`) — and
 * stashes the fabric client on `state.fabric` so server.ts's gate-resolve
 * and work-graph plan routes can publish commands back to `cmd.orchestration`.
 *
 * Boot-only (main.ts), never called from createControlApiState — same
 * fail-open reasoning as startAgentRunReadModelSubscription: if the Message
 * Fabric is unreachable, control-api still starts; genuinely-dispatched Work
 * Packages/plan results just won't surface until this recovers.
 */
export async function connectRuntimeWorkPackageBridge(
  state: ControlApiState,
): Promise<SubscriptionHandle | undefined> {
  const execIdByWorkPackage: ExecIdCache = new Map();
  const idempotency = new InMemoryIdempotencyStore();

  try {
    const fabric = await createMessageFabric({ producer: 'control-api' });
    state.fabric = fabric;
    const workPackageSub = await fabric.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: 'control-api-runtime-work-package-bridge',
        filterSubject: `${SUBJECTS.EVT_RUNTIME}.agent.run.>`,
      },
      async (event, ctx) => {
        if (await idempotency.has(event.eventId)) {
          ctx.ack();
          return;
        }
        await projectRuntimeWorkPackageEvent(state, execIdByWorkPackage, event);
        await idempotency.mark(event.eventId);
        ctx.ack();
      },
    );
    const planSub = await fabric.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: 'control-api-workgraph-plan-results',
        filterSubject: `${SUBJECTS.EVT_RUNTIME}.workgraph.planned`,
      },
      async (event, ctx) => {
        projectWorkGraphPlannedEvent(state, event);
        ctx.ack();
      },
    );
    const artifactSub = await fabric.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: 'control-api-artifact-bridge',
        filterSubject: `${SUBJECTS.EVT_RUNTIME}.artifact.sealed`,
      },
      async (event, ctx) => {
        await projectArtifactSealedEvent(state, event);
        ctx.ack();
      },
    );
    log.info(
      'runtime work package bridge subscribed to evt.runtime.agent.run.>, evt.runtime.workgraph.planned, and evt.runtime.artifact.sealed',
    );
    return {
      stop: async () => {
        await Promise.all([workPackageSub.stop(), planSub.stop(), artifactSub.stop()]);
      },
    };
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'runtime work package bridge unavailable (Message Fabric unreachable) — genuinely-dispatched work packages/plan results will not surface until this recovers',
    );
    return undefined;
  }
}
