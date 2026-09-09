import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { loadSpecFromFile } from '@umer/specialist-sdk';
import {
  createOrchestrator,
  createOrchestrationWorker,
  InMemoryWorkGraphStore,
  InMemoryWorkPackageStore,
  MySqlWorkGraphStore,
  MySqlWorkPackageStore,
  PersistentWorkGraph,
  WorkGraphProjector,
  type WorkGraphPlanningOptions,
  type WorkGraphStore,
  type WorkPackageStore,
} from '@umer/orchestration';

const serviceName = 'orchestration-worker';
const log = createLogger(serviceName);
const env = loadEnv();

// Real, currently-dispatchable Specialist metadata for the planning path
// (ReadyWorkPackagePlanner needs a real specVersion/specHash, not a made-up
// one) — read from the SAME spec files apps/agent-worker loads from, so both
// processes agree on what's actually current. 'Implementation', 'UX', 'QA',
// 'Security', 'Requirements', and 'Product' map to a real Specialist today:
// eng.app-delivery, ux.design, qa.verify, security.review,
// requirements.formalize, and product.definition are the ones
// apps/agent-worker actually registers for dispatch (see its main.ts) —
// every other node type correctly has no mapping, so ReadyWorkPackagePlanner
// skips it (reported, not fabricated) rather than building a Work Package
// no running worker could execute.
//
// eng.app-delivery, qa.verify, and security.review are additionally gated on a
// real `targetPath`: all three need one to use their filesystem_read /
// process_run_audit tools or execute repository delivery, so resolveTaskContext (below, in
// the workgraph.plan handler) only supplies a task context for an Implementation/QA/
// Security node when the plan command actually carried one — never a
// placeholder path. requirements.formalize, product.definition, and architecture.design
// work purely from the real persisted Requirement's own text (see
// control-api's plan route); ux.design works from text and attaches targetPath if provided.
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const engAppDelivery = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'engineering', 'application-delivery.md'),
);
const uxDesign = await loadSpecFromFile(join(repoRoot, 'specialists', 'design', 'ux-design.md'));
const qaVerify = await loadSpecFromFile(join(repoRoot, 'specialists', 'qa', 'qa-verify.md'));
const securityReview = await loadSpecFromFile(join(repoRoot, 'specialists', 'security', 'security-review.md'));
const requirementsFormalize = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'program', 'requirements-formalize.md'),
);
const productDefinition = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'program', 'product-definition.md'),
);
const architectureDesign = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'architecture', 'solution-design.md'),
);
const releaseManagement = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'release', 'release-management.md'),
);
const siteReliability = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'operations', 'site-reliability.md'),
);
const NODE_TYPE_SPECIALISTS = {
  Implementation: engAppDelivery,
  UX: uxDesign,
  QA: qaVerify,
  Security: securityReview,
  Requirements: requirementsFormalize,
  Product: productDefinition,
  Architecture: architectureDesign,
  Release: releaseManagement,
  Operations: siteReliability,
} as const;
const TARGET_PATH_REQUIRED_NODE_TYPES = new Set<keyof typeof NODE_TYPE_SPECIALISTS>([
  'Implementation',
  'QA',
  'Security',
  'Release',
  'Operations',
]);

const workGraphPlanningResolver: WorkGraphPlanningOptions['resolveSpecialist'] = (node) => {
  const spec = (NODE_TYPE_SPECIALISTS as Record<string, typeof engAppDelivery | undefined>)[node.type];
  return spec
    ? {
        specialistId: spec.binding.specialistId,
        specialistSpecVersion: spec.binding.specVersion,
        specialistSpecHash: spec.binding.specHash,
      }
    : undefined;
};

/**
 * Real policy for what counts as "enough context to plan" per node type —
 * this is where "Implementation, QA, and Security need a real targetPath"
 * is decided; @umer/orchestration itself stays generic (see
 * WorkGraphPlanningOptions's doc comment). Never invents a targetPath: if
 * the plan command didn't carry one (because the triggering project has no
 * registryProjectId, or it didn't resolve to a real on-disk codebase — see
 * control-api's plan route), an Implementation/QA/Security node is skipped with a
 * reason, not dispatched to run ungrounded. For other nodes (like UX),
 * targetPath is attached if provided so filesystem tools are available.
 */
const workGraphTaskContextResolver: WorkGraphPlanningOptions['resolveTaskContext'] = (node, raw) => {
  if (!raw.taskIds || raw.taskIds.length === 0) return undefined;
  const taskDetails = raw.taskDetails ? { taskDetails: raw.taskDetails } : {};
  if (TARGET_PATH_REQUIRED_NODE_TYPES.has(node.type as keyof typeof NODE_TYPE_SPECIALISTS)) {
    return raw.targetPath ? { taskIds: raw.taskIds, targetPath: raw.targetPath, ...taskDetails } : undefined;
  }
  return {
    taskIds: raw.taskIds,
    ...(raw.targetPath ? { targetPath: raw.targetPath } : {}),
    ...taskDetails,
  };
};

const fabric = await createMessageFabric({ producer: serviceName });

// Best-effort MySQL Work Package store — the Orchestrator's own
// authoritative record of every Work Package it has ever queued/dispatched/
// run. Without this, a restart loses every in-flight Work Package: attempt
// counts, timeout tracking, and the "Running" status itself all vanish,
// silently orphaning whatever the AgentWorker was actually doing. Same
// fail-open pattern as the Work Graph store below.
let workPackageStore: WorkPackageStore = new InMemoryWorkPackageStore();
try {
  if (await pingMySql()) {
    workPackageStore = new MySqlWorkPackageStore({ db: createMySqlExecutor() });
    log.info('work package store connected to MySQL');
  } else {
    throw new Error('pingMySql returned false');
  }
} catch (err) {
  log.warn(
    { err: err instanceof Error ? err.message : String(err) },
    'work package store unavailable (MySQL unreachable) — Work Packages will not survive a restart until this recovers',
  );
}
const orchestrator = createOrchestrator({ fabric, producer: serviceName, store: workPackageStore });

// Best-effort MySQL Work Graph store — same fail-open pattern as
// control-api's work-graph-link.ts. Both processes must point at the SAME
// store for the projector below to see graph nodes control-api's
// decompose/plan routes created; the in-memory fallback only works for a
// single-process dev setup where nothing decomposed a graph yet.
let workGraphStore: WorkGraphStore = new InMemoryWorkGraphStore();
try {
  if (await pingMySql()) {
    workGraphStore = new MySqlWorkGraphStore({ db: createMySqlExecutor() });
    log.info('work graph store connected to MySQL');
  } else {
    throw new Error('pingMySql returned false');
  }
} catch (err) {
  log.warn(
    { err: err instanceof Error ? err.message : String(err) },
    'work graph store unavailable (MySQL unreachable) — Work Package lifecycle will not project onto any Work Graph until this recovers',
  );
}
const persistentWorkGraph = new PersistentWorkGraph(workGraphStore);
const workGraphProjector = new WorkGraphProjector(persistentWorkGraph, workGraphStore);

const worker = createOrchestrationWorker({
  orchestrator,
  fabric,
  workGraphProjector,
  workGraphPlanning: {
    persistentGraph: persistentWorkGraph,
    resolveSpecialist: workGraphPlanningResolver,
    resolveTaskContext: workGraphTaskContextResolver,
  },
  onAgentEventError: (event, err) => {
    log.warn(
      { subject: event.name, workPackageId: event.payload?.workPackageId, err: err.message },
      'failed to process an agent.run.* event — acked anyway (see OrchestrationWorker.start() doc comment); if this recurs for the same Work Package, check it manually',
    );
  },
});

const health = await startHealthServer({
  serviceName,
  port: env.HEALTH_PORT,
  getHealth: () => healthCheck(serviceName),
});

await startRuntime({
  serviceName,
  onShutdown: async () => {
    await worker.stop();
    await health.close();
    log.info('orchestration-worker shutdown');
  },
});

await worker.start();
log.info(
  { healthPort: health.port },
  'orchestration-worker consuming cmd.orchestration and agent events',
);

await new Promise(() => undefined);
