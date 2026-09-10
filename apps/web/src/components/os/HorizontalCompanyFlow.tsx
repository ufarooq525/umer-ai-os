'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { CompanyOverview, OpportunityRecord, WorkPackageSummary, WorkProjectRecord, WorkTaskRecord } from '@/lib/control-api';

type StageItem = {
  id: string;
  label: string;
  count: number | string;
  status: 'active' | 'waiting' | 'healthy' | 'standby';
  activeItem: string;
  href: string;
};

export function HorizontalCompanyFlow({
  opportunities,
  projects,
  tasks,
  workPackages,
  overview,
}: {
  opportunities: OpportunityRecord[];
  projects: WorkProjectRecord[];
  tasks: WorkTaskRecord[];
  workPackages: WorkPackageSummary[];
  overview: CompanyOverview | null;
}) {
  const activeWps = workPackages.filter((w) => w.status === 'Running' || w.status === 'Claimed');
  const reqWp = activeWps.find((w) => w.stage?.toLowerCase().includes('requirement'));
  const prodWp = activeWps.find((w) => w.stage?.toLowerCase().includes('product'));
  const qaWp = activeWps.find((w) => w.stage?.toLowerCase().includes('qa'));

  const activeProjectsCount = projects.filter((p) => p.status === 'Active').length;
  const recognizedRev = overview?.revenueAndOutcomes?.recognizedRevenue ?? 0;
  const totalWon = overview?.revenueAndOutcomes?.totalWonRevenue ?? 0;
  const customersCount = overview?.revenueAndOutcomes?.activeCustomersCount ?? 0;

  const STAGES: StageItem[] = [
    {
      id: 'market',
      label: 'Market',
      count: 'Scan',
      status: 'active',
      activeItem: 'City Rankings',
      href: '/markets',
    },
    {
      id: 'opportunity',
      label: 'Opportunity',
      count: opportunities.length,
      status: opportunities.length > 0 ? 'active' : 'standby',
      activeItem: opportunities[0]?.title ? opportunities[0].title.slice(0, 16) : 'Monitoring',
      href: '/company/opportunities',
    },
    {
      id: 'sales',
      label: 'Sales',
      count: overview?.revenueAndOutcomes?.pipelineValue ? `$${Math.round(overview.revenueAndOutcomes.pipelineValue / 1000)}k` : 'CRM',
      status: 'active',
      activeItem: 'Deals & Drafts',
      href: '/sales',
    },
    {
      id: 'requirements',
      label: 'Requirements',
      count: tasks.filter((t) => t.title.toLowerCase().includes('requirement')).length || 'Formal',
      status: reqWp ? 'active' : 'healthy',
      activeItem: reqWp ? reqWp.specialistId : 'Standard Spec',
      href: '/delivery/requirements',
    },
    {
      id: 'product',
      label: 'Product',
      count: prodWp ? 'Active' : 'Ready',
      status: prodWp ? 'active' : 'healthy',
      activeItem: prodWp ? prodWp.specialistId : 'Scope & Brief',
      href: '/delivery',
    },
    {
      id: 'engineering',
      label: 'Engineering',
      count: activeProjectsCount,
      status: activeProjectsCount > 0 ? 'active' : 'standby',
      activeItem: projects[0]?.name ? projects[0].name.slice(0, 14) : 'Codebase',
      href: '/projects',
    },
    {
      id: 'qa',
      label: 'QA',
      count: qaWp ? 'Testing' : 'Verified',
      status: 'healthy',
      activeItem: qaWp ? 'Live Test' : 'Test Suite',
      href: '/gates',
    },
    {
      id: 'release',
      label: 'Release',
      count: 'Packaged',
      status: 'healthy',
      activeItem: 'Automated CI',
      href: '/delivery',
    },
    {
      id: 'customer',
      label: 'Customer',
      count: customersCount > 0 ? customersCount : 'Success',
      status: 'healthy',
      activeItem: 'Health 98%',
      href: '/sales/customers',
    },
    {
      id: 'revenue',
      label: 'Revenue',
      count: recognizedRev > 0 ? `$${recognizedRev.toLocaleString()}` : totalWon > 0 ? `$${totalWon.toLocaleString()}` : '$0',
      status: recognizedRev > 0 ? 'active' : 'healthy',
      activeItem: 'Recognized',
      href: '/finance',
    },
    {
      id: 'learning',
      label: 'Learning',
      count: 'Loop',
      status: 'healthy',
      activeItem: 'Autonomous',
      href: '/autonomy',
    },
  ];

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
        padding: '20px 22px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.accent, fontFamily: fonts.mono }}>
            AUTONOMOUS COMPANY OPERATING FLOW
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.text, marginTop: 2 }}>
            From Market Discovery to Revenue Lineage &amp; Autonomous Learning
          </div>
        </div>
        <span style={{ fontSize: 11, color: colors.muted }}>Click any stage to drill down</span>
      </div>

      {/* Horizontal Flow Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollbarWidth: 'thin',
        }}
      >
        {STAGES.map((stage, idx) => {
          const isLast = idx === STAGES.length - 1;
          const statusBg =
            stage.status === 'active'
              ? 'rgba(232, 160, 84, 0.12)'
              : stage.status === 'waiting'
                ? 'rgba(245, 158, 11, 0.12)'
                : stage.status === 'healthy'
                  ? 'rgba(93, 206, 160, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)';
          const statusColor =
            stage.status === 'active'
              ? colors.accent
              : stage.status === 'waiting'
                ? colors.warning
                : stage.status === 'healthy'
                  ? colors.success
                  : colors.muted;

          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Link
                href={stage.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '10px 12px',
                  borderRadius: radii.sm,
                  background: statusBg,
                  border: `1px solid ${stage.status === 'active' ? 'rgba(232, 160, 84, 0.3)' : 'rgba(255, 255, 255, 0.07)'}`,
                  textDecoration: 'none',
                  color: colors.text,
                  minWidth: 100,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: statusColor }}>
                    {stage.label}
                  </span>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'rgba(0, 0, 0, 0.25)',
                      color: colors.text,
                    }}
                  >
                    {stage.count}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: colors.muted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}
                >
                  {stage.activeItem}
                </div>
              </Link>

              {!isLast && (
                <ChevronRight size={13} style={{ color: 'rgba(255, 255, 255, 0.2)', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
