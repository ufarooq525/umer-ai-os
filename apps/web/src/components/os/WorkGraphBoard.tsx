'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { colors, fonts, radii, spacing } from '@umer/ui';
import type { WorkGraphEdge, WorkGraphNode } from '@/lib/control-api';
import { StatusBadge } from './StatusBadge';
import { workGraphNodeTone } from './status';
import { formatRelativeTime } from './format';

export type WorkGraphBoardProps = {
  nodes: WorkGraphNode[];
  edges: WorkGraphEdge[];
};

/** Canonical pipeline order (@umer/contracts' WorkGraphNodeTypeSchema) — Architecture/UX and QA/Security render as parallel pairs. */
const COLUMNS: ReadonlyArray<WorkGraphNode['type'][]> = [
  ['Requirements'],
  ['Product'],
  ['Architecture', 'UX'],
  ['Implementation'],
  ['QA', 'Security'],
  ['Release'],
  ['Operations'],
];

/**
 * Real, persisted Work Graph for one Project (@umer/orchestration) — no
 * fabricated nodes, no invented progress. An empty graph means exactly that:
 * this project has not been decomposed yet, which is a valid, honestly
 * displayed state, not an error.
 */
export function WorkGraphBoard({ nodes, edges }: WorkGraphBoardProps) {
  const reduce = useReducedMotion();

  if (nodes.length === 0) {
    return (
      <div
        style={{
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px dashed ${colors.border}`,
          color: colors.muted,
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        No Work Graph recorded yet for this project.
      </div>
    );
  }

  const byType = new Map<WorkGraphNode['type'], WorkGraphNode[]>();
  for (const node of nodes) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }
  const knownTypes = new Set(COLUMNS.flat());
  const extraTypes = [...byType.keys()].filter((t) => !knownTypes.has(t));
  const columns = extraTypes.length > 0 ? [...COLUMNS, extraTypes] : COLUMNS;

  const blockedByNodeId = new Map<string, string[]>();
  for (const edge of edges) {
    const dependentId = edge.type === 'blocks' ? edge.toNodeId : edge.fromNodeId;
    const predecessorId = edge.type === 'blocks' ? edge.fromNodeId : edge.toNodeId;
    const list = blockedByNodeId.get(dependentId) ?? [];
    list.push(predecessorId);
    blockedByNodeId.set(dependentId, list);
  }
  const titleById = new Map(nodes.map((n) => [n.nodeId, n.title]));

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
      {columns.map((types, columnIndex) => {
        const columnNodes = types.flatMap((type) => byType.get(type) ?? []);
        if (columnNodes.length === 0) return null;
        return (
          <div key={types.join('+')} style={{ display: 'grid', gap: 8, minWidth: 190, flexShrink: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: colors.muted,
              }}
            >
              {types.join(' / ')}
            </div>
            {columnNodes.map((node) => (
              <WorkGraphNodeCard
                key={node.nodeId}
                node={node}
                blockedOnTitles={
                  node.status === 'Blocked'
                    ? (blockedByNodeId.get(node.nodeId) ?? [])
                        .map((id) => titleById.get(id))
                        .filter((t): t is string => Boolean(t))
                    : []
                }
                reduce={Boolean(reduce)}
                delayIndex={columnIndex}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function WorkGraphNodeCard({
  node,
  blockedOnTitles,
  reduce,
  delayIndex,
}: {
  node: WorkGraphNode;
  blockedOnTitles: string[];
  reduce: boolean;
  delayIndex: number;
}) {
  const tone = workGraphNodeTone(node.status);
  const card = (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 4 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: reduce ? 0 : delayIndex * 0.03 }}
      style={{
        padding: spacing.sm,
        borderRadius: radii.md,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>{node.title}</strong>
        <StatusBadge tone={tone} label={node.status} />
      </div>
      {node.workPackageId ? (
        <div style={{ marginTop: 6, fontSize: 11, fontFamily: fonts.mono, color: colors.accent }}>
          {node.workPackageId}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: colors.muted }}>No Work Package yet</div>
      )}
      {blockedOnTitles.length > 0 ? (
        <div style={{ marginTop: 6, fontSize: 11, color: colors.muted }}>
          Waiting on: {blockedOnTitles.join(', ')}
        </div>
      ) : null}
      <div style={{ marginTop: 6, fontSize: 10, color: colors.muted, fontFamily: fonts.mono }}>
        updated {formatRelativeTime(node.updatedAt)}
      </div>
    </motion.div>
  );

  if (!node.workPackageId) {
    return card;
  }
  return (
    <Link
      href={`/agent-runs/${node.workPackageId}`}
      style={{ textDecoration: 'none', color: colors.text, display: 'block' }}
    >
      {card}
    </Link>
  );
}
