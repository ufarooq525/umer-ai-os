'use client';

/**
 * CompanyIntelligenceGraph — Canvas-based force-directed graph renderer
 *
 * Reads the Company Intelligence Graph from the control-api and renders it
 * as an interactive HTML5 Canvas visualization.  Never renders individual
 * React DOM nodes per graph node — all rendering is done on a single Canvas
 * for performance with hundreds of nodes.
 *
 * Features:
 * - Force-directed layout (repulsion + spring + centering)
 * - Zoom (wheel), pan (drag), node drag
 * - Node click → detail side panel
 * - Search (highlight matching nodes)
 * - CEO Focus modes (COMPANY / INTELLIGENCE / OPERATIONS / REVENUE)
 * - Reset View, Fit Graph
 * - Live polling (30s)
 * - Loading / empty / error states
 */

import {
  useRef, useEffect, useState, useCallback, useTransition,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { CompanyGraphData, CompanyGraphNode, GraphNodeType } from '@/lib/control-api';
import { colors, fonts } from '@umer/ui';

// ---------------------------------------------------------------------------
// Node visual language
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<GraphNodeType, string> = {
  Niche:       '#22d3ee',   // cyan
  Opportunity: '#4ade80',   // green
  Prospect:    '#60a5fa',   // blue
  Contact:     '#93c5fd',   // light blue
  Outreach:    '#7dd3fc',   // sky
  Deal:        '#34d399',   // teal
  Proposal:    '#facc15',   // yellow
  Project:     '#fb923c',   // orange
  Requirement: '#fdba74',   // peach
  Agent:       '#a78bfa',   // purple
  WorkPackage: '#fbbf24',   // amber
  Gate:        '#f59e0b',   // warning amber
  AgentRun:    '#818cf8',   // indigo
  Artifact:    '#94a3b8',   // gray
  Customer:    '#f472b6',   // pink
  Learning:    '#e879f9',   // violet
  Deployment:  '#6ee7b7',   // mint
  Incident:    '#f87171',   // red
};

function nodeColor(type: GraphNodeType): string {
  return NODE_COLORS[type] ?? '#94a3b8';
}

function nodeRadius(node: CompanyGraphNode): number {
  const base = 8;
  const meta = node.metadata as Record<string, unknown>;
  // Opportunity → scale by estimated value
  if (node.type === 'Opportunity' && typeof meta.estimatedValueMax === 'number') {
    return Math.min(base + Math.sqrt(meta.estimatedValueMax / 1000), 24);
  }
  if (node.type === 'Gate') {
    return 11;
  }
  return base;
}

// ---------------------------------------------------------------------------
// CEO Focus Mode filters
// ---------------------------------------------------------------------------

type FocusMode = 'COMPANY' | 'INTELLIGENCE' | 'OPERATIONS' | 'REVENUE';

const FOCUS_MODE_TYPES: Record<FocusMode, GraphNodeType[] | null> = {
  COMPANY:      null,  // show everything
  INTELLIGENCE: ['Niche', 'Opportunity', 'Prospect', 'Contact', 'Outreach'],
  OPERATIONS:   ['Agent', 'Project', 'WorkPackage', 'Gate', 'AgentRun', 'Artifact', 'Requirement', 'Deployment', 'Incident'],
  REVENUE:      ['Opportunity', 'Prospect', 'Deal', 'Proposal', 'Project', 'Customer', 'Learning'],
};

// ---------------------------------------------------------------------------
// Force simulation types
// ---------------------------------------------------------------------------

type SimNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: string;
  metadata: Record<string, unknown>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  radius: number;
};

type SimEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

// ---------------------------------------------------------------------------
// Force simulation
// ---------------------------------------------------------------------------

const REPULSION  = 2400;
const SPRING_K   = 0.04;
const REST_LEN   = 120;
const CENTER_K   = 0.008;
const DAMPING    = 0.82;
const MIN_ENERGY = 0.01;

function stepSimulation(nodes: SimNode[], edges: SimEdge[], W: number, H: number): boolean {
  let totalKE = 0;
  const cx = W / 2;
  const cy = H / 2;

  // Repulsion (O(n²) — acceptable up to ~500 nodes)
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy || 1;
      const dist = Math.sqrt(dist2);
      const force = REPULSION / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  // Spring attraction for edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = SPRING_K * (dist - REST_LEN);
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!src.pinned) { src.vx += fx; src.vy += fy; }
    if (!tgt.pinned) { tgt.vx -= fx; tgt.vy -= fy; }
  }

  // Centering + integrate
  for (const n of nodes) {
    if (n.pinned) continue;
    n.vx += (cx - n.x) * CENTER_K;
    n.vy += (cy - n.y) * CENTER_K;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    totalKE += n.vx * n.vx + n.vy * n.vy;
  }

  return totalKE / Math.max(1, nodes.length) > MIN_ENERGY;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CompanyIntelligenceGraphProps = {
  initialGraph: CompanyGraphData;
  onRefresh?: () => Promise<CompanyGraphData>;
  liveMode?: boolean;
  /** Pre-fills the search box — used when an entity detail page links here focused on one real node. */
  initialSearch?: string;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CompanyIntelligenceGraph({
  initialGraph,
  onRefresh,
  liveMode = false,
  initialSearch = '',
}: CompanyIntelligenceGraphProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const simRef      = useRef<{ nodes: SimNode[]; edges: SimEdge[]; running: boolean; raf?: number }>({
    nodes: [], edges: [], running: false,
  });
  const transformRef = useRef({ tx: 0, ty: 0, scale: 1 });
  const dragRef     = useRef<{ type: 'pan' | 'node'; nodeId?: string; startX: number; startY: number; lastTx: number; lastTy: number } | null>(null);

  const [graph, setGraph]           = useState<CompanyGraphData>(initialGraph);
  const [selectedNode, setSelected] = useState<SimNode | null>(null);
  const [focusMode, setFocusMode]   = useState<FocusMode>('COMPANY');
  const [search, setSearch]         = useState(initialSearch);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [, startTransition]         = useTransition();

  // -------------------------------------------------------------------------
  // Build simulation from graph data
  // -------------------------------------------------------------------------
  const buildSim = useCallback((g: CompanyGraphData, mode: FocusMode, searchQ: string) => {
    const allowed = FOCUS_MODE_TYPES[mode];
    const W = canvasRef.current?.width  ?? 900;
    const H = canvasRef.current?.height ?? 600;

    // Filter nodes by focus mode
    let filteredNodes = allowed ? g.nodes.filter((n) => allowed.includes(n.type)) : g.nodes;

    // Apply search: keep matching + direct neighbors
    if (searchQ.trim().length > 0) {
      const q = searchQ.trim().toLowerCase();
      const matchIds = new Set(
        filteredNodes
          .filter((n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
          .map((n) => n.id),
      );
      // Expand to neighbors via edges
      for (const e of g.edges) {
        if (matchIds.has(e.source)) matchIds.add(e.target);
        if (matchIds.has(e.target)) matchIds.add(e.source);
      }
      filteredNodes = filteredNodes.filter((n) => matchIds.has(n.id));
    }

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges   = g.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    );

    // Keep existing positions for nodes that persist
    const existingPositions = new Map(simRef.current.nodes.map((n) => [n.id, { x: n.x, y: n.y, pinned: n.pinned }]));

    const simNodes: SimNode[] = filteredNodes.map((n) => {
      const existing = existingPositions.get(n.id);
      return {
        ...n,
        x: existing?.x ?? (W / 2 + (Math.random() - 0.5) * 200),
        y: existing?.y ?? (H / 2 + (Math.random() - 0.5) * 200),
        vx: 0,
        vy: 0,
        pinned: existing?.pinned ?? false,
        radius: nodeRadius(n),
      };
    });

    const simEdges: SimEdge[] = filteredEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }));

    simRef.current.nodes = simNodes;
    simRef.current.edges = simEdges;
    simRef.current.running = true;
  }, []);

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { tx, ty, scale } = transformRef.current;
    const { nodes, edges } = simRef.current;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    // Draw edges
    ctx.lineWidth = 1 / scale;
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) continue;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();

      // Arrow tip
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      const arrowX = tgt.x - Math.cos(angle) * (tgt.radius + 2);
      const arrowY = tgt.y - Math.sin(angle) * (tgt.radius + 2);
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 8 * Math.cos(angle - 0.3), arrowY - 8 * Math.sin(angle - 0.3));
      ctx.lineTo(arrowX - 8 * Math.cos(angle + 0.3), arrowY - 8 * Math.sin(angle + 0.3));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = selectedNode?.id === node.id;
      const color = nodeColor(node.type);

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      // Attention ring for Gate awaiting CEO review
      if (node.type === 'Gate' && (node.status === 'AwaitingReview' || !node.status)) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(node.x - 2, node.y - 2, 0, node.x, node.y, node.radius);
      grad.addColorStop(0, isSelected ? '#ffffff' : color);
      grad.addColorStop(1, isSelected ? color : `${color}aa`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : `${color}66`;
      ctx.lineWidth = isSelected ? 2 / scale : 1 / scale;
      ctx.stroke();

      // Label when zoomed in enough
      if (scale > 0.5) {
        ctx.fillStyle = scale > 0.8 ? '#f4f1ea' : 'rgba(244,241,234,0.7)';
        ctx.font = `${Math.max(9, 11 / scale)}px "Sora", sans-serif`;
        ctx.textAlign = 'center';
        const label = node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label;
        ctx.fillText(label, node.x, node.y + node.radius + 13 / scale);
      }
    }

    ctx.restore();
  }, [selectedNode]);

  // -------------------------------------------------------------------------
  // Animation loop
  // -------------------------------------------------------------------------
  const loop = useCallback(() => {
    const sim = simRef.current;
    if (!canvasRef.current) return;
    const W = canvasRef.current.width;
    const H = canvasRef.current.height;
    if (sim.running) {
      const stillRunning = stepSimulation(sim.nodes, sim.edges, W, H);
      if (!stillRunning) sim.running = false;
    }
    draw();
    sim.raf = requestAnimationFrame(loop);
  }, [draw]);

  // -------------------------------------------------------------------------
  // Resize observer
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      simRef.current.running = true;
    });
    ro.observe(container);
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Start/restart sim whenever graph, focusMode, or search changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    buildSim(graph, focusMode, search);
  }, [graph, focusMode, search, buildSim]);

  // -------------------------------------------------------------------------
  // Start RAF loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    simRef.current.raf = requestAnimationFrame(loop);
    return () => {
      if (simRef.current.raf) cancelAnimationFrame(simRef.current.raf);
    };
  }, [loop]);

  // -------------------------------------------------------------------------
  // Live polling
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!liveMode || !onRefresh) return;
    const interval = setInterval(async () => {
      try {
        const newGraph = await onRefresh();
        startTransition(() => setGraph(newGraph));
      } catch {
        // Silent — don't disrupt live graph on transient failures
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [liveMode, onRefresh, startTransition]);

  // -------------------------------------------------------------------------
  // Hit-test: find node at canvas-space (mx, my)
  // -------------------------------------------------------------------------
  function hitTest(mx: number, my: number): SimNode | null {
    const { tx, ty, scale } = transformRef.current;
    const wx = (mx - tx) / scale;
    const wy = (my - ty) / scale;
    let closest: SimNode | null = null;
    let closestDist = Infinity;
    for (const n of simRef.current.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < n.radius + 4 && d < closestDist) {
        closestDist = d;
        closest = n;
      }
    }
    return closest;
  }

  // -------------------------------------------------------------------------
  // Mouse events
  // -------------------------------------------------------------------------
  function onMouseDown(e: ReactMouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (hit) {
      dragRef.current = { type: 'node', nodeId: hit.id, startX: mx, startY: my, lastTx: 0, lastTy: 0 };
    } else {
      const { tx, ty } = transformRef.current;
      dragRef.current = { type: 'pan', startX: mx, startY: my, lastTx: tx, lastTy: ty };
    }
  }

  function onMouseMove(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (dragRef.current.type === 'pan') {
      transformRef.current.tx = dragRef.current.lastTx + (mx - dragRef.current.startX);
      transformRef.current.ty = dragRef.current.lastTy + (my - dragRef.current.startY);
    } else if (dragRef.current.type === 'node' && dragRef.current.nodeId) {
      const { tx, ty, scale } = transformRef.current;
      const wx = (mx - tx) / scale;
      const wy = (my - ty) / scale;
      const node = simRef.current.nodes.find((n) => n.id === dragRef.current!.nodeId);
      if (node) { node.x = wx; node.y = wy; node.vx = 0; node.vy = 0; node.pinned = true; }
    }
  }

  function onMouseUp(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = Math.abs(mx - dragRef.current.startX);
    const dy = Math.abs(my - dragRef.current.startY);
    if (dx < 4 && dy < 4 && dragRef.current.type !== 'node') {
      // Click — select node
      const hit = hitTest(mx, my);
      setSelected(hit);
    }
    dragRef.current = null;
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { tx, ty, scale } = transformRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const newScale = Math.min(4, Math.max(0.1, scale * factor));
    // Zoom toward cursor
    transformRef.current = {
      tx: mx - (mx - tx) * (newScale / scale),
      ty: my - (my - ty) * (newScale / scale),
      scale: newScale,
    };
    simRef.current.running = true;
  }

  // -------------------------------------------------------------------------
  // Reset / Fit
  // -------------------------------------------------------------------------
  function resetView() {
    transformRef.current = { tx: 0, ty: 0, scale: 1 };
    simRef.current.running = true;
  }

  function fitGraph() {
    const nodes = simRef.current.nodes;
    if (nodes.length === 0) return;
    const W = canvasRef.current?.width  ?? 900;
    const H = canvasRef.current?.height ?? 600;
    const minX = Math.min(...nodes.map((n) => n.x - n.radius));
    const maxX = Math.max(...nodes.map((n) => n.x + n.radius));
    const minY = Math.min(...nodes.map((n) => n.y - n.radius));
    const maxY = Math.max(...nodes.map((n) => n.y + n.radius));
    const gW = maxX - minX || 1;
    const gH = maxY - minY || 1;
    const scaleX = (W - 80) / gW;
    const scaleY = (H - 80) / gH;
    const newScale = Math.min(scaleX, scaleY, 2);
    transformRef.current = {
      scale: newScale,
      tx: W / 2 - ((minX + maxX) / 2) * newScale,
      ty: H / 2 - ((minY + maxY) / 2) * newScale,
    };
    simRef.current.running = true;
  }

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------
  async function refresh() {
    if (!onRefresh) return;
    setLoading(true);
    setError(null);
    try {
      const newGraph = await onRefresh();
      setGraph(newGraph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh graph');
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const nodeCount  = graph.nodes.length;
  const edgeCount  = graph.edges.length;
  const visNodes   = simRef.current.nodes.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 320px' : '1fr', height: '100%', gap: 0, position: 'relative' }}>
      {/* Left: Canvas area */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.07)',
          background: 'rgba(15,17,23,.92)', backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          {/* Search */}
          <input
            id="graph-search"
            type="search"
            placeholder="Search nodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, padding: '5px 10px', color: colors.text,
              fontFamily: fonts.sans, fontSize: 12, outline: 'none', width: 180,
            }}
          />

          {/* Focus modes */}
          {(['COMPANY', 'INTELLIGENCE', 'OPERATIONS', 'REVENUE'] as FocusMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              id={`graph-mode-${mode.toLowerCase()}`}
              onClick={() => setFocusMode(mode)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid',
                borderColor: focusMode === mode ? colors.accent : 'rgba(255,255,255,.1)',
                background: focusMode === mode ? colors.accentSoft : 'transparent',
                color: focusMode === mode ? colors.accent : colors.muted,
                fontFamily: fonts.sans, fontSize: 10, fontWeight: 700,
                letterSpacing: '.06em', cursor: 'pointer',
              }}
            >
              {mode}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Stats */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>
            {visNodes} nodes · {edgeCount} edges
            {graph.filtered ? ' (filtered)' : ''}
            {nodeCount > visNodes ? ` · ${nodeCount - visNodes} hidden` : ''}
          </span>

          <button type="button" id="graph-fit" onClick={fitGraph} style={toolBtn}>Fit</button>
          <button type="button" id="graph-reset" onClick={resetView} style={toolBtn}>Reset</button>
          {onRefresh && (
            <button type="button" id="graph-refresh" onClick={() => void refresh()} disabled={loading} style={toolBtn}>
              {loading ? '…' : '↺'}
            </button>
          )}
          {liveMode && (
            <span style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.success, letterSpacing: '.08em' }}>
              ● LIVE
            </span>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0d13' }}>
          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 10,
            display: 'flex', flexWrap: 'wrap', gap: '4px 10px', maxWidth: 320,
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(10,13,19,.82)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.07)',
          }}>
            {LEGEND_ITEMS.map(({ type, color }) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.muted }}>{type}</span>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {visNodes === 0 && !loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>⬡</div>
              <p style={{ margin: 0, color: colors.muted, fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
                {search
                  ? `No nodes match "${search}"`
                  : 'No graph data yet. Once the company has opportunities, projects, agents, and deals, the graph will populate from real state.'}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              padding: '8px 14px', borderRadius: 8, background: 'rgba(240,113,120,.15)',
              border: '1px solid rgba(240,113,120,.3)', color: '#f07178', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          />
        </div>
      </div>

      {/* Right: Detail panel */}
      {selectedNode && (
        <NodeDetailPanel node={selectedNode} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node detail panel
// ---------------------------------------------------------------------------

function NodeDetailPanel({ node, onClose }: { node: SimNode; onClose: () => void }) {
  const color = nodeColor(node.type);
  const meta = node.metadata;

  return (
    <div style={{
      borderLeft: '1px solid rgba(255,255,255,.08)',
      background: 'rgba(16,19,28,.96)', backdropFilter: 'blur(16px)',
      overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {node.type}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>
            {node.label}
          </h2>
          {node.status && (
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '2px 8px',
              borderRadius: 999, border: `1px solid ${color}44`,
              background: `${color}18`, color, fontSize: 10, fontWeight: 600,
            }}>
              {node.status}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 28, height: 28, display: 'grid', placeItems: 'center',
            borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent', color: colors.muted, cursor: 'pointer', fontSize: 14, flexShrink: 0,
          }}
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gap: 10 }}>
        {Object.entries(meta)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([key, value]) => (
            <div key={key}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: colors.muted, marginBottom: 3 }}>
                {camelToLabel(key)}
              </div>
              <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.5, wordBreak: 'break-word' }}>
                {renderMetaValue(value)}
              </div>
            </div>
          ))}
      </div>

      {/* Navigation links */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 12, display: 'grid', gap: 6 }}>
        {getNodeLinks(node).map(({ label, href }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'block', padding: '7px 10px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,.09)',
              background: 'rgba(255,255,255,.04)',
              color: colors.accent, fontSize: 12, textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {label} →
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers for detail panel
// ---------------------------------------------------------------------------

function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function renderMetaValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function getNodeLinks(node: SimNode): { label: string; href: string }[] {
  const meta = node.metadata as Record<string, unknown>;
  switch (node.type) {
    case 'Opportunity':
      return [{ label: 'View Opportunity', href: `/company/opportunities?open=${meta.opportunityId}` }];
    case 'Project':
      return [{ label: 'View Project', href: `/company/projects/${meta.projectId}` }];
    case 'Agent':
      return [{ label: 'View Agent', href: `/company/agents/${meta.agentId}` }];
    case 'Prospect':
      return meta.nicheId ? [{ label: 'View Prospect', href: `/company/prospects?niche=${meta.nicheId}` }] : [];
    case 'Gate':
      return [{ label: 'Review Quality Gate', href: `/gates#${meta.waitId ?? ''}` }];
    case 'WorkPackage':
      return meta.status === 'AwaitingReview'
        ? [
            { label: 'Review Quality Gate', href: '/gates' },
            { label: 'View Agent Runs', href: `/agent-runs/${meta.workPackageId ?? ''}` },
          ]
        : [{ label: 'View Agent Runs', href: `/agent-runs/${meta.workPackageId ?? ''}` }];
    case 'Requirement':
      return meta.projectId ? [{ label: 'View Project Requirements', href: `/company/projects/${meta.projectId}` }] : [];
    case 'Artifact':
      return [{ label: 'View Artifacts', href: '/artifacts' }];
    case 'AgentRun':
      return meta.agentId ? [{ label: 'View Agent Run', href: `/agent-runs/${meta.workPackageId}` }] : [];
    case 'Customer':
      return [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

const LEGEND_ITEMS: { type: GraphNodeType; color: string }[] = (
  Object.entries(NODE_COLORS) as [GraphNodeType, string][]
).map(([type, color]) => ({ type, color }));

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const toolBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(255,255,255,.05)', color: colors.muted,
  fontFamily: fonts.sans, fontSize: 11, cursor: 'pointer',
};
