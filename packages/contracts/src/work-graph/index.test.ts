import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../version.js';
import { parseContract } from '../common/serialize.js';
import { ContractError } from '../common/errors.js';
import { WorkGraphEdgeContractSchema, WorkGraphNodeContractSchema } from './index.js';

const header = {
  id: 'wgn-1',
  schemaVersion: SCHEMA_VERSION,
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
  metadata: { labels: {}, annotations: {} },
};

describe('WorkGraphNodeContractSchema', () => {
  it('parses a valid node', () => {
    const node = parseContract(WorkGraphNodeContractSchema, {
      ...header,
      kind: 'work_graph_node',
      nodeId: 'node-requirements-1',
      projectId: 'proj-1',
      type: 'Requirements',
      status: 'Planned',
      title: 'Requirements',
    });
    expect(node.status).toBe('Planned');
    expect(node.workPackageId).toBeUndefined();
  });

  it('rejects an unknown node type', () => {
    expect(() =>
      parseContract(WorkGraphNodeContractSchema, {
        ...header,
        kind: 'work_graph_node',
        nodeId: 'node-1',
        projectId: 'proj-1',
        type: 'NotAType',
        status: 'Planned',
        title: 'x',
      }),
    ).toThrow(ContractError);
  });
});

describe('WorkGraphEdgeContractSchema', () => {
  it('parses a valid blocks edge', () => {
    const edge = parseContract(WorkGraphEdgeContractSchema, {
      ...header,
      id: 'wge-1',
      kind: 'work_graph_edge',
      edgeId: 'edge-1',
      projectId: 'proj-1',
      fromNodeId: 'node-requirements-1',
      toNodeId: 'node-product-1',
      type: 'blocks',
    });
    expect(edge.type).toBe('blocks');
  });

  it('rejects an unknown edge type', () => {
    expect(() =>
      parseContract(WorkGraphEdgeContractSchema, {
        ...header,
        id: 'wge-2',
        kind: 'work_graph_edge',
        edgeId: 'edge-2',
        projectId: 'proj-1',
        fromNodeId: 'node-a',
        toNodeId: 'node-b',
        type: 'depends_on',
      }),
    ).toThrow(ContractError);
  });
});
