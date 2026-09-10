'use client';

import Link from 'next/link';
import { Bot, ArrowRight, Sparkles } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { AgentRecord, CompanyOverview, WorkPackageSummary, WorkProjectRecord, WorkTaskRecord } from '@/lib/control-api';
import { agentCurrentTask, agentProjectName } from './joins';
import { humanizeSpecialistId } from './format';
import { PulseDot } from './PulseDot';

type CompanyNowProps = {
  agents: AgentRecord[];
  projects: WorkProjectRecord[];
  tasks: WorkTaskRecord[];
  workPackages: WorkPackageSummary[];
  decisionsWaiting: number;
  overview: CompanyOverview | null;
};

export function CompanyNowHero({
  agents,
  projects,
  tasks,
  workPackages,
  decisionsWaiting,
  overview,
}: CompanyNowProps) {
  const workingAgents = agents.filter((a) => a.status === 'active' && a.controlState === 'active');
  const runningPackages = workPackages.filter((w) => w.status === 'Running' || w.status === 'Claimed');
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked');

  const agentsCount = overview?.agentsWorking?.length ?? workingAgents.length;
  const packagesCount = overview?.whatCompanyIsDoing?.activeWorkPackagesCount ?? runningPackages.length;
  const decisionsCount = overview?.decisionsNeeded?.length ?? decisionsWaiting;
  const blockedCount = overview?.blockedItems?.length ?? blockedTasks.length;

  return (
    <div
      style={{
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.09)',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%), #11141c',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Top Banner: Title & Executive Numbers */}
      <div
        style={{
          padding: '24px clamp(18px, 3vw, 32px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: fonts.mono,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: colors.accent,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <PulseDot tone={agentsCount > 0 ? 'live' : 'idle'} />
              COMPANY NOW
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>
            <span style={{ fontSize: 11.5, color: colors.muted }}>Real-time autonomous operations</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.3rem, 2.2vw, 1.75rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em', color: '#ffffff' }}>
            What is happening right now
          </h2>
        </div>

        {/* Live operational counters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '10px 18px',
              borderRadius: radii.md,
              background: agentsCount > 0 ? 'rgba(93, 206, 160, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: agentsCount > 0 ? '1px solid rgba(93, 206, 160, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
              textAlign: 'center',
              minWidth: 100,
            }}
          >
            <div style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, color: agentsCount > 0 ? colors.success : colors.muted }}>
              {agentsCount}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginTop: 2 }}>
              Agents Working
            </div>
          </div>

          <div
            style={{
              padding: '10px 18px',
              borderRadius: radii.md,
              background: packagesCount > 0 ? 'rgba(232, 160, 84, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: packagesCount > 0 ? '1px solid rgba(232, 160, 84, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
              textAlign: 'center',
              minWidth: 100,
            }}
          >
            <div style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, color: packagesCount > 0 ? colors.accent : colors.muted }}>
              {packagesCount}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginTop: 2 }}>
              Work Packages
            </div>
          </div>

          <div
            style={{
              padding: '10px 18px',
              borderRadius: radii.md,
              background: decisionsCount > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: decisionsCount > 0 ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
              textAlign: 'center',
              minWidth: 100,
            }}
          >
            <div style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, color: decisionsCount > 0 ? colors.warning : colors.muted }}>
              {decisionsCount}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginTop: 2 }}>
              Decisions Waiting
            </div>
          </div>

          {blockedCount > 0 && (
            <div
              style={{
                padding: '10px 18px',
                borderRadius: radii.md,
                background: 'rgba(240, 113, 120, 0.08)',
                border: '1px solid rgba(240, 113, 120, 0.25)',
                textAlign: 'center',
                minWidth: 100,
              }}
            >
              <div style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, color: colors.danger }}>
                {blockedCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginTop: 2 }}>
                Blocked Tasks
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary operational table / list */}
      <div style={{ padding: '8px clamp(18px, 3vw, 32px) 24px' }}>
        {workingAgents.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'grid',
              gap: 12,
              placeItems: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'grid',
                placeItems: 'center',
                color: colors.muted,
              }}
            >
              <Bot size={22} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 650, color: colors.text, marginBottom: 4 }}>
                NO ACTIVE WORK IN PROGRESS
              </div>
              <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
                There are currently no executing Work Packages. The autonomous company is standing by and waiting for executable work or new opportunity qualification.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Link
                href="/company/opportunities"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(232, 160, 84, 0.35)',
                  background: 'rgba(232, 160, 84, 0.1)',
                  color: colors.accent,
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Sparkles size={14} /> View Opportunities
              </Link>
              <Link
                href="/company/agents"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: colors.text,
                  fontSize: 12.5,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Inspect Workforce
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <th style={{ padding: '12px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
                    Specialist
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
                    Project / Scope
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
                    Current Objective / Task
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, textAlign: 'right' }}>
                    Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {workingAgents.map((agent) => {
                  const task = agentCurrentTask(agent, tasks);
                  const projectName = agentProjectName(agent, tasks, projects);
                  const specialistTitle = humanizeSpecialistId(agent.specialistId) || agent.name || agent.agentId;

                  return (
                    <tr
                      key={agent.agentId}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <td style={{ padding: '14px 10px' }}>
                        <Link
                          href={`/company/agents/${agent.agentId}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            textDecoration: 'none',
                            color: colors.text,
                            fontWeight: 650,
                            fontSize: 13.5,
                          }}
                        >
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: 'rgba(167, 139, 250, 0.15)',
                              color: '#a78bfa',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 11,
                              flexShrink: 0,
                            }}
                          >
                            <Bot size={13} />
                          </span>
                          <span>{specialistTitle}</span>
                        </Link>
                      </td>

                      <td style={{ padding: '14px 10px', fontSize: 13, color: projectName ? colors.text : colors.muted }}>
                        {projectName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                            {projectName}
                          </span>
                        ) : (
                          'Across Portfolio'
                        )}
                      </td>

                      <td style={{ padding: '14px 10px', fontSize: 13, color: task ? colors.text : colors.muted, maxWidth: 360 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {task ? task.title : agent.currentWorkPackageId ? `Work Package ${agent.currentWorkPackageId}` : 'Executing specialist mandate'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 10px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontFamily: fonts.mono,
                            fontWeight: 600,
                            background: 'rgba(93, 206, 160, 0.1)',
                            border: '1px solid rgba(93, 206, 160, 0.25)',
                            color: colors.success,
                          }}
                        >
                          <PulseDot tone="live" /> WORKING
                        </span>
                      </td>

                      <td style={{ padding: '14px 10px', textAlign: 'right', fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
                        <Link
                          href={`/company/agents/${agent.agentId}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: colors.accent,
                            textDecoration: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Open Work <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
