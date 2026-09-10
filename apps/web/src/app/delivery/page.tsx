import { colors, fonts } from '@umer/ui';
import { getWorkPackages, getArtifacts, getWorkProjects } from '@/lib/control-api';
import { DeliverySubNav } from '@/components/os/DeliverySubNav';
import { DeliveryStageView } from '@/components/os/DeliveryStageView';
import { Layers, CheckCircle2, Box, Cpu } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const [packages, artifacts, projects] = await Promise.all([
    getWorkPackages().catch(() => []),
    getArtifacts().catch(() => []),
    getWorkProjects().catch(() => []),
  ]);

  const activePackages = packages.filter((p) => p.status === 'running' || p.status === 'in_progress').length;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1600, margin: '0 auto' }}>
      <DeliverySubNav />

      {/* Top Delivery Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Pipelines
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.text, marginTop: 4 }}>
              {projects.length}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Tracked delivery projects</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Box size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Running Work Packages
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.accent, marginTop: 4 }}>
              {activePackages}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Specialists currently dispatching</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accent }}>
            <Cpu size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Sealed Deliverables
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.success, marginTop: 4 }}>
              {artifacts.length}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Formal artifacts produced</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.success }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Lifecycle Stages
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: '#a78bfa', marginTop: 4 }}>
              9
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Reqs → Ops quality chain</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(167, 139, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* 9-Stage Lifecycle View */}
      <DeliveryStageView workPackages={packages} artifacts={artifacts} projects={projects} />
    </div>
  );
}
