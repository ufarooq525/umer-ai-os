import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getWorkPackages, getAgentRuns } from '@/lib/control-api';
import { DeliverySubNav } from '@/components/os/DeliverySubNav';
import { ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DeliveryEngineeringPage() {
  const [packages, runs] = await Promise.all([
    getWorkPackages().catch(() => []),
    getAgentRuns().catch(() => []),
  ]);


  const engSpecialists = ['eng.app-delivery', 'qa.verify', 'security.audit', 'release.package', 'arch.design'];
  const engPackages = packages.filter((p) => engSpecialists.some((s) => p.specialistId.includes(s)));
  const runningRuns = runs.filter((r) => r.status === 'running');
  const failedRuns = runs.filter((r) => r.status === 'failed');

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <DeliverySubNav />

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
          Engineering Execution Plane
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.muted }}>
          Autonomous code generation, test verification, security auditing, and release engineering status.
        </p>
      </div>

      {/* Engineering Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Active Compilations
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.text, marginTop: 4 }}>
            {runningRuns.length}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Agents executing code tools</div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Engineering Work Packages
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.accent, marginTop: 4 }}>
            {engPackages.length}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Dispatched technical tasks</div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Failed Executions
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: failedRuns.length > 0 ? colors.danger : colors.success, marginTop: 4 }}>
            {failedRuns.length}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Build or test regressions</div>
        </div>
      </div>

      {/* Live Technical Runs */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 650, margin: 0, color: colors.text }}>
            Recent Technical Executions
          </h3>
          <Link href="/agent-runs" style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}>
            View full agent logs →
          </Link>
        </div>

        {runs.length === 0 ? (
          <div
            style={{
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
              padding: '36px 24px',
              textAlign: 'center',
              color: colors.muted,
              fontSize: 13,
            }}
          >
            No technical agent runs recorded in the runtime database yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {runs.slice(0, 10).map((run) => {
              const isRunning = run.status === 'running';
              const isFailed = run.status === 'failed';
              const statusColor = isRunning ? colors.accent : isFailed ? colors.danger : colors.success;

              return (
                <div
                  key={run.correlationId || run.workPackageId}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor,
                        boxShadow: isRunning ? `0 0 8px ${statusColor}` : 'none',
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 650, color: colors.text }}>
                          {run.specialistId ?? 'general-specialist'}
                        </span>
                        <span
                          style={{
                            fontFamily: fonts.mono,
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: colors.muted,
                          }}
                        >
                          {run.workPackageId}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        Status: <span style={{ color: statusColor, fontWeight: 600 }}>{run.status}</span>
                        {run.currentTool && ` · Tool: ${run.currentTool}`}
                        {run.errorMessage && ` · Error: ${run.errorMessage}`}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/agent-runs?execId=${encodeURIComponent(run.execId ?? run.workPackageId)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.accent,
                      textDecoration: 'none',
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: colors.accentSoft,
                    }}
                  >
                    <span>Trace</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
