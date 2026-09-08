import {
  parseContract,
  SCHEMA_VERSION,
  WorkGraphEdgeContractSchema,
  WorkGraphNodeContractSchema,
  type WorkGraphEdgeContract,
  type WorkGraphNodeContract,
  type WorkGraphNodeType,
} from '@umer/contracts';
import type { WorkGraph } from './work-graph.js';
import type { PersistentWorkGraph } from './work-graph-store.js';

export type RequirementDecompositionInput = {
  projectId: string;
  /** Prefixed onto each generated node/edge id so two decompositions never collide within the same project's graph. */
  slug?: string;
  /** Canonical Requirement id to preserve lineage on the Requirements node. */
  requirementId?: string;
};

export type RequirementDecomposition = {
  nodes: WorkGraphNodeContract[];
  edges: WorkGraphEdgeContract[];
};

const NODE_SPECS: ReadonlyArray<{ type: WorkGraphNodeType; title: string }> = [
  { type: 'Requirements', title: 'Requirements' },
  { type: 'Product', title: 'Product Definition' },
  { type: 'Architecture', title: 'Architecture' },
  { type: 'UX', title: 'UX Design' },
  { type: 'Implementation', title: 'Implementation' },
  { type: 'QA', title: 'QA' },
  { type: 'Security', title: 'Security Review' },
  { type: 'Release', title: 'Release' },
  { type: 'Operations', title: 'Operations' },
];

/**
 * Requirements → Product → Architecture/UX → Implementation → QA/Security →
 * Release → Operations, per the product vision's pipeline. Architecture and
 * UX can proceed in parallel once Product is Accepted; Implementation
 * requires both finished; QA and Security likewise run in parallel once
 * Implementation is Accepted, and both gate Release.
 *
 * Pure builder — returns real, schema-valid contracts but does not persist
 * them (see applyRequirementDecomposition below for that). Requirements
 * itself starts Planned, not pre-Accepted: formalizing the raw request into
 * a real Requirements artifact is itself real work for a specialist to do,
 * not a status to fabricate just because a request already exists.
 */
export function decomposeRequirementIntoWorkGraph(
  input: RequirementDecompositionInput,
): RequirementDecomposition {
  const now = new Date().toISOString();
  const slug = input.slug ?? input.projectId;
  const nodeId = (type: WorkGraphNodeType) => `${slug}-${type.toLowerCase()}`;

  const nodes = NODE_SPECS.map((spec) =>
    parseContract(WorkGraphNodeContractSchema, {
      id: `hdr-${nodeId(spec.type)}`,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: {
        labels: {},
        // Product also carries the Requirement's lineage (not just
        // Requirements) so product.definition's Work Package instruction can
        // be built from the same real, persisted Requirement content —
        // see requirements.formalize/product.definition in
        // apps/orchestration-worker's NODE_TYPE_SPECIALISTS.
        annotations: (spec.type === 'Requirements' || spec.type === 'Product') && input.requirementId
          ? { requirementId: input.requirementId }
          : {},
      },
      kind: 'work_graph_node',
      nodeId: nodeId(spec.type),
      projectId: input.projectId,
      type: spec.type,
      status: 'Planned',
      title: spec.type === 'Requirements' && input.requirementId
        ? `Requirements: ${input.requirementId}`
        : spec.title,
    }),
  );

  const edgeSpecs: ReadonlyArray<{ from: WorkGraphNodeType; to: WorkGraphNodeType; type: 'blocks' | 'requires' }> = [
    { from: 'Requirements', to: 'Product', type: 'blocks' },
    { from: 'Product', to: 'Architecture', type: 'blocks' },
    { from: 'Product', to: 'UX', type: 'blocks' },
    { from: 'Implementation', to: 'Architecture', type: 'requires' },
    { from: 'Implementation', to: 'UX', type: 'requires' },
    { from: 'Implementation', to: 'QA', type: 'blocks' },
    { from: 'Implementation', to: 'Security', type: 'blocks' },
    { from: 'QA', to: 'Release', type: 'blocks' },
    { from: 'Security', to: 'Release', type: 'blocks' },
    { from: 'Release', to: 'Operations', type: 'blocks' },
  ];

  const edges = edgeSpecs.map((spec, index) => {
    const edgeId = `${slug}-edge-${index + 1}`;
    return parseContract(WorkGraphEdgeContractSchema, {
      id: `hdr-${edgeId}`,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'work_graph_edge',
      edgeId,
      projectId: input.projectId,
      fromNodeId: nodeId(spec.from),
      toNodeId: nodeId(spec.to),
      type: spec.type,
    });
  });

  return { nodes, edges };
}

/**
 * Persists a decomposition through a PersistentWorkGraph and returns the
 * resulting graph with readiness already computed (Requirements — the only
 * node with no predecessor — comes out Ready; everything else Blocked).
 *
 * Loads the project's EXISTING graph first (rather than starting from an
 * empty one) specifically so a second decomposition with the same `slug`
 * fails closed on WorkGraph's own DUPLICATE_NODE validation instead of
 * silently overwriting already-in-flight nodes back to Planned/Ready and
 * destroying real progress (attached Work Packages, Accepted statuses).
 */
export async function applyRequirementDecomposition(
  persistentGraph: PersistentWorkGraph,
  input: RequirementDecompositionInput,
): Promise<WorkGraph> {
  const { nodes, edges } = decomposeRequirementIntoWorkGraph(input);
  const graph = await persistentGraph.load(input.projectId);
  for (const node of nodes) {
    await persistentGraph.addNode(graph, node);
  }
  for (const edge of edges) {
    await persistentGraph.addEdge(graph, edge);
  }
  return graph;
}
