/**
 * /company/graph — Company Intelligence Graph
 *
 * CEO-facing read-model visualization of the entire company:
 * opportunities, prospects, deals, projects, agents, artifacts,
 * customers, learnings, deployments, and every relationship between them.
 *
 * Data is a pure projection from authoritative domain stores —
 * no synthetic nodes, no fabricated data.
 *
 * The graph is rendered client-side on an HTML5 Canvas using a
 * force-directed layout simulation.  Initial graph data is fetched
 * server-side for fast first paint; the client component handles
 * live polling and interactive filtering.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getCompanyGraph, type CompanyGraphData } from '@/lib/control-api';
import { CompanyGraphClient } from './client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Company Intelligence Graph — Umer AI OS',
  description: 'Interactive graph visualization of the entire company: opportunities, projects, agents, deals, customers, and every real relationship between them.',
};

async function fetchInitialGraph(): Promise<CompanyGraphData> {
  try {
    return await getCompanyGraph({ limit: 200 });
  } catch {
    // Return empty graph on API failure — the client will retry
    return {
      nodes: [],
      edges: [],
      generatedAt: new Date().toISOString(),
      filtered: false,
      totalNodesBeforeLimit: 0,
    };
  }
}

export default async function CompanyGraphPage() {
  const initialGraph = await fetchInitialGraph();
  const nodeCount = initialGraph.nodes.length;
  const edgeCount = initialGraph.edges.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 0, minHeight: 0 }}>
      {/* Page header */}
      <header style={{
        padding: '16px clamp(16px, 2.5vw, 28px)',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        background: 'radial-gradient(500px 180px at 100% 0%, rgba(118,91,255,.1), transparent 70%), rgba(255,255,255,.018)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/company" style={{ color: colors.muted, fontSize: 11, textDecoration: 'none' }}>
              Company
            </Link>
            <span style={{ color: colors.muted, fontSize: 11 }}>›</span>
            <span style={{ color: colors.text, fontSize: 11, fontWeight: 600 }}>Intelligence Graph</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Company Intelligence Graph
          </h1>
          <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 12, maxWidth: 560 }}>
            Every real relationship in the company — from market opportunity to customer revenue — projected from live state.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Stat label="Nodes" value={nodeCount} />
            <Stat label="Edges" value={edgeCount} />
          </div>
          <Link
            href="/command-center"
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(255,255,255,.05)', color: colors.muted,
              fontSize: 11, textDecoration: 'none',
            }}
          >
            ← Command Center
          </Link>
        </div>
      </header>

      {/* Graph canvas area — fills remaining height */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Suspense fallback={<GraphSkeleton />}>
          <CompanyGraphClient initialGraph={initialGraph} liveMode />
        </Suspense>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: colors.accent }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: colors.muted }}>{label}</div>
    </div>
  );
}

function GraphSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32, opacity: 0.15, animation: 'pulse 1.4s ease infinite' }}>⬡</div>
      <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Loading graph…</p>
    </div>
  );
}
