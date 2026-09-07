import {
  parseContract,
  SCHEMA_VERSION,
  WorkGraphNodeContractSchema,
  type WorkGraphNodeContract,
} from '@umer/contracts';
import type { WorkGraph } from './work-graph.js';
import type { PersistentWorkGraph } from './work-graph-store.js';

/**
 * The only Work Graph node types with a real, dispatchable Specialist today
 * (see apps/orchestration-worker/src/main.ts's NODE_TYPE_SPECIALISTS) minus
 * 'Implementation', which requires real prior Architecture/UX output to mean
 * anything and so is deliberately not offered as a standalone audit.
 */
export type StandaloneAuditNodeType = 'UX' | 'QA' | 'Security';

const AUDIT_NODE_TITLES: Record<StandaloneAuditNodeType, string> = {
  UX: 'UX Design Audit',
  QA: 'QA Audit',
  Security: 'Security Audit',
};

export type StandaloneAuditNodeInput = {
  projectId: string;
  type: StandaloneAuditNodeType;
  /** Defaults to a type-appropriate audit title when omitted. */
  title?: string;
};

/**
 * Builds a single, edge-free Work Graph node for an on-demand audit —
 * bypassing the Requirements -> Product -> Architecture chain
 * (requirements-decomposition.ts), which today has no dispatchable
 * Specialist and so never unlocks UX/QA/Security automatically. A node with
 * no predecessor edges comes out Ready as soon as it's persisted (WorkGraph's
 * readiness computation treats "no predecessors" as vacuously satisfied), so
 * this is real, immediately-plannable work via the existing
 * POST /v1/work-graph/:projectId/plan route — not a placeholder.
 *
 * Pure builder — returns a real, schema-valid contract but does not persist
 * it (see applyStandaloneAuditNode below for that).
 */
export function buildStandaloneAuditNode(input: StandaloneAuditNodeInput): WorkGraphNodeContract {
  const now = new Date().toISOString();
  const nodeId = `audit-${input.type.toLowerCase()}-${Date.now()}`;
  return parseContract(WorkGraphNodeContractSchema, {
    id: `hdr-${nodeId}`,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    metadata: { labels: {}, annotations: {} },
    kind: 'work_graph_node',
    nodeId,
    projectId: input.projectId,
    type: input.type,
    status: 'Planned',
    title: input.title ?? AUDIT_NODE_TITLES[input.type],
  });
}

/**
 * Persists a standalone audit node into the project's existing graph (loaded
 * first, same as applyRequirementDecomposition, so this never clobbers
 * already-in-flight nodes) and returns the resulting graph with readiness
 * already computed.
 */
export async function applyStandaloneAuditNode(
  persistentGraph: PersistentWorkGraph,
  input: StandaloneAuditNodeInput,
): Promise<{ graph: WorkGraph; node: WorkGraphNodeContract }> {
  const built = buildStandaloneAuditNode(input);
  const graph = await persistentGraph.load(input.projectId);
  await persistentGraph.addNode(graph, built);
  // addNode's own recomputeReadiness may have already flipped the node's
  // status (Planned -> Ready, since it has no predecessor edges) — return
  // the graph's real current copy, not the pre-add one, so a caller never
  // sees a stale "Planned" for a node that's actually Ready.
  const node = graph.getNode(built.nodeId)!;
  return { graph, node };
}
