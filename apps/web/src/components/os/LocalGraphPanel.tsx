import { colors, fonts, radii } from '@umer/ui';
import { getCompanyGraph, type CompanyGraphNode, type CompanyGraphParams, type GraphNodeType } from '@/lib/control-api';

/**
 * Local Graph — a scoped neighborhood view for one entity.
 *
 * This is the "Knowledge" and "Local Graph" concept from the redesign brief:
 * a human-readable projection over live company state, not a parallel
 * database. It reuses the same /v1/company/graph endpoint that powers the
 * full Company Intelligence Graph, scoped to a single entity, so it can
 * never drift from authoritative state.
 */

const NODE_COLORS: Record<GraphNodeType, string> = {
  Niche: '#22d3ee',
  Opportunity: '#4ade80',
  Prospect: '#60a5fa',
  Contact: '#93c5fd',
  Outreach: '#7dd3fc',
  Deal: '#34d399',
  Proposal: '#facc15',
  Project: '#fb923c',
  Requirement: '#fdba74',
  Agent: '#a78bfa',
  WorkPackage: '#fbbf24',
  Gate: '#f59e0b',
  AgentRun: '#818cf8',
  Artifact: '#94a3b8',
  Customer: '#f472b6',
  Learning: '#e879f9',
  Deployment: '#6ee7b7',
  Incident: '#f87171',
};

function nodeHref(node: CompanyGraphNode): string | null {
  const meta = node.metadata as Record<string, unknown>;
  switch (node.type) {
    case 'Opportunity':
      return meta.opportunityId ? `/company/opportunities?open=${meta.opportunityId}` : null;
    case 'Project':
      return meta.projectId ? `/company/projects/${meta.projectId}` : null;
    case 'Agent':
      return meta.agentId ? `/company/agents/${meta.agentId}` : null;
    case 'Prospect':
      return meta.nicheId ? `/company/prospects?niche=${meta.nicheId}` : null;
    case 'Gate':
      return meta.waitId ? `/gates#${meta.waitId}` : '/gates';
    case 'WorkPackage':
      return meta.status === 'AwaitingReview' ? '/gates' : meta.workPackageId ? `/agent-runs/${meta.workPackageId}` : null;
    case 'Requirement':
      return meta.projectId ? `/company/projects/${meta.projectId}` : null;
    case 'Artifact':
      return '/artifacts';
    case 'AgentRun':
      return meta.workPackageId ? `/agent-runs/${meta.workPackageId}` : null;
    default:
      return null;
  }
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

type Props = {
  title?: string;
  focusLabel: string;
  focusType: GraphNodeType;
  scope: CompanyGraphParams;
  limit?: number;
};

export async function LocalGraphPanel({ title = 'Connected Knowledge', focusLabel, focusType, scope, limit = 30 }: Props) {
  let graph;
  try {
    graph = await getCompanyGraph({ ...scope, limit });
  } catch {
    graph = null;
  }

  const neighbors = (graph?.nodes ?? []).filter((n) => !(n.type === focusType && n.label === focusLabel));
  const shown = neighbors.slice(0, 12);
  const overflow = neighbors.length - shown.length;
  const graphSearchHref = `/company/graph?q=${encodeURIComponent(focusLabel)}`;

  const cx = 260;
  const cy = 165;
  const r = 122;
  const n = shown.length;

  return (
    <section
      style={{
        padding: '20px 22px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.text }}>
          {title}
        </h3>
        <a href={graphSearchHref} style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
          Open in full graph →
        </a>
      </div>

      {shown.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: colors.muted }}>
          No linked entities found yet for this {focusType.toLowerCase()}.
        </p>
      ) : (
        <>
          <svg viewBox="0 0 520 330" style={{ width: '100%', height: 'auto', maxHeight: 320 }} role="img" aria-label={`Local knowledge graph around ${focusLabel}`}>
            {shown.map((node, i) => {
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              return (
                <line
                  key={`line-${node.id}`}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth={1}
                />
              );
            })}

            <circle cx={cx} cy={cy} r={32} fill={`${NODE_COLORS[focusType]}22`} stroke={NODE_COLORS[focusType]} strokeWidth={1.5} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ffffff">
              {truncate(focusLabel, 13)}
            </text>

            {shown.map((node, i) => {
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              const color = NODE_COLORS[node.type] ?? '#94a3b8';
              const href = nodeHref(node);
              const inner = (
                <g style={{ cursor: href ? 'pointer' : 'default' }}>
                  <circle cx={x} cy={y} r={16} fill={`${color}22`} stroke={color} strokeWidth={1.3} />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={color}>
                    {node.type.slice(0, 3).toUpperCase()}
                  </text>
                  <text x={x} y={y + 29} textAnchor="middle" fontSize={9} fill={colors.muted}>
                    {truncate(node.label, 14)}
                  </text>
                </g>
              );
              return href ? (
                <a key={node.id} href={href}>
                  {inner}
                </a>
              ) : (
                <g key={node.id}>{inner}</g>
              );
            })}
          </svg>

          {overflow > 0 && (
            <p style={{ margin: 0, fontSize: 11.5, color: colors.muted, textAlign: 'center' }}>
              +{overflow} more connected entities &mdash;{' '}
              <a href={graphSearchHref} style={{ color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
                view in full graph
              </a>
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 12 }}>
            {Array.from(new Set(shown.map((n) => n.type))).map((type) => (
              <span
                key={type}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10.5,
                  fontFamily: fonts.mono,
                  color: colors.muted,
                  padding: '3px 8px',
                  borderRadius: radii.sm,
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: NODE_COLORS[type] }} />
                {type}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
