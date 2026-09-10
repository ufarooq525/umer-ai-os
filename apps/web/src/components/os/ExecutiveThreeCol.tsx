'use client';

import Link from 'next/link';
import { AlertTriangle, Briefcase, ArrowRight, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { AttentionCase } from '@/lib/company-derive';
import type { CompanyOverview, WorkPackageSummary, WorkProjectRecord } from '@/lib/control-api';

type ExecutiveThreeColProps = {
  attentionCases: AttentionCase[];
  workPackages: WorkPackageSummary[];
  activeProjects: WorkProjectRecord[];
  overview: CompanyOverview | null;
  decisionsRequiredCount: number;
};

export function ExecutiveThreeCol({
  attentionCases,
  workPackages,
  activeProjects,
  overview,
  decisionsRequiredCount,
}: ExecutiveThreeColProps) {
  // Top 4 attention cases
  const topAttention = attentionCases.slice(0, 4);

  // Active work items (from work packages or active projects)
  const activeWork = workPackages
    .filter((w) => w.status === 'Running' || w.status === 'Claimed' || w.status === 'AwaitingReview')
    .slice(0, 4);

  // Next actions: derived from overview.nextActions or pending decisions/gates
  const nextActions = overview?.nextActions?.length
    ? overview.nextActions.slice(0, 4)
    : [
        ...(decisionsRequiredCount > 0
          ? [{ action: 'Review pending CEO opportunity decisions', targetType: 'Decisions', targetId: 'decisions', priority: 'high' as const }]
          : []),
        ...(attentionCases.some((c) => c.severity === 'critical')
          ? [{ action: 'Unblock critical failing specialist agent runs', targetType: 'Attention', targetId: 'attention', priority: 'high' as const }]
          : []),
        { action: 'Inspect high-value qualified opportunities', targetType: 'Opportunities', targetId: 'opportunities', priority: 'medium' as const },
        { action: 'Verify nightly automated quality gates & security scans', targetType: 'Gates', targetId: 'gates', priority: 'low' as const },
      ].slice(0, 4);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      {/* 1. LEFT: CEO ATTENTION */}
      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} style={{ color: colors.warning }} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              CEO Attention
            </h3>
          </div>
          <Link
            href="/attention"
            style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View all ({attentionCases.length}) <ChevronRight size={12} />
          </Link>
        </div>

        <div style={{ padding: '14px 16px', display: 'grid', gap: 10, flex: 1 }}>
          {topAttention.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
              <CheckCircle2 size={24} style={{ color: colors.success, margin: '0 auto 8px', opacity: 0.8 }} />
              <div>Zero critical attention signals. Operations are within autonomous thresholds.</div>
            </div>
          ) : (
            topAttention.map((c) => (
              <Link
                key={c.id}
                href="/attention"
                style={{
                  display: 'block',
                  padding: '12px 14px',
                  borderRadius: radii.sm,
                  background: c.severity === 'critical' ? 'rgba(240, 113, 120, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: c.severity === 'critical' ? '1px solid rgba(240, 113, 120, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  textDecoration: 'none',
                  color: colors.text,
                  transition: 'background 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 650, color: c.severity === 'critical' ? colors.danger : colors.text }}>
                    {c.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontFamily: fonts.mono,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: c.severity === 'critical' ? 'rgba(240, 113, 120, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: c.severity === 'critical' ? colors.danger : colors.warning,
                      flexShrink: 0,
                    }}
                  >
                    {c.severity}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4, lineHeight: 1.4 }}>
                  {c.whatHappened}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* 2. MIDDLE: ACTIVE WORK */}
      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(93, 206, 160, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={15} style={{ color: colors.success }} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Active Work
            </h3>
          </div>
          <Link
            href="/company/projects"
            style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Projects ({activeProjects.length}) <ChevronRight size={12} />
          </Link>
        </div>

        <div style={{ padding: '14px 16px', display: 'grid', gap: 10, flex: 1 }}>
          {activeWork.length === 0 && activeProjects.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
              No active packages running. Ready for new project execution.
            </div>
          ) : (
            (activeWork.length > 0
              ? activeWork.map((w) => (
                  <div
                    key={w.workPackageId}
                    style={{
                      padding: '12px 14px',
                      borderRadius: radii.sm,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                        {w.stage || 'Delivery Stage'}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontFamily: fonts.mono,
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: 'rgba(93, 206, 160, 0.15)',
                          color: colors.success,
                        }}
                      >
                        {w.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4, fontFamily: fonts.mono }}>
                      Specialist: {w.specialistId} {w.projectId ? `· Project: ${w.projectId}` : ''}
                    </div>
                  </div>
                ))
              : activeProjects.slice(0, 4).map((p) => (
                  <Link
                    key={p.projectId}
                    href={`/company/projects/${p.projectId}`}
                    style={{
                      display: 'block',
                      padding: '12px 14px',
                      borderRadius: radii.sm,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      textDecoration: 'none',
                      color: colors.text,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 650 }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.accent }}>{p.status}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
                      Active engineering and delivery cycle
                    </div>
                  </Link>
                ))
            )
          )}
        </div>
      </div>

      {/* 3. RIGHT: NEXT ACTIONS */}
      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(232, 160, 84, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} style={{ color: colors.accent }} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Next Actions
            </h3>
          </div>
          <span style={{ fontSize: 11.5, color: colors.muted }}>Executive priority</span>
        </div>

        <div style={{ padding: '14px 16px', display: 'grid', gap: 10, flex: 1 }}>
          {nextActions.map((na, idx) => {
            let targetHref = '/command-center';
            if (na.targetType === 'Decisions' || na.targetId === 'decisions') targetHref = '/decisions';
            else if (na.targetType === 'Attention' || na.targetId === 'attention') targetHref = '/attention';
            else if (na.targetType === 'Opportunities' || na.targetId === 'opportunities') targetHref = '/company/opportunities';
            else if (na.targetType === 'Gates' || na.targetId === 'gates') targetHref = '/gates';

            return (
              <Link
                key={idx}
                href={targetHref}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: radii.sm,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  textDecoration: 'none',
                  color: colors.text,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
                    {na.action}
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: fonts.mono, color: colors.accent, marginTop: 3 }}>
                    PRIORITY: {na.priority.toUpperCase()} · TARGET: {na.targetType}
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: colors.accent, flexShrink: 0 }} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
