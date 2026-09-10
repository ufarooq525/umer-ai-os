import Link from 'next/link';
import { LayoutGrid, ArrowRight, Bot, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { colors, fonts } from '@umer/ui';
import { getTasks, getWorkProjects, getAgents, getWorkPackages } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { PagedChildren } from '@/components/os/PagedChildren';
import { projectTone } from '@/components/os/status';
import { CompanySubNav } from '@/components/os/CompanySubNav';
import { formatRelativeTime } from '@/components/os/format';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const [projects, tasks, agents, workPackages] = await Promise.all([
    getWorkProjects(),
    getTasks(),
    getAgents(),
    getWorkPackages(),
  ]);


  const activeProjects = projects.filter((p) => p.status === 'Active');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.035em', color: '#ffffff' }}>
              Company Projects ({projects.length})
            </h1>
            <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
              Active product and delivery initiatives executing across autonomous specialists.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 8,
                background: activeProjects.length > 0 ? 'rgba(93, 206, 160, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: activeProjects.length > 0 ? colors.success : colors.muted,
                border: `1px solid ${activeProjects.length > 0 ? 'rgba(93, 206, 160, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {activeProjects.length} ACTIVE
            </span>
          </div>
        </div>
      </header>

      <CompanySubNav />

      {projects.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gap: 14,
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'grid',
              placeItems: 'center',
              color: colors.muted,
            }}
          >
            <LayoutGrid size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '0 0 6px' }}>
              NO ACTIVE PROJECTS
            </h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 500, lineHeight: 1.6 }}>
              There are currently no active delivery projects executing. Qualify new commercial opportunities to spin up high-conviction delivery initiatives.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Link
              href="/company/opportunities"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                background: colors.accent,
                color: '#1a1208',
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: 'none',
              }}
            >
              <Sparkles size={14} /> View Opportunities
            </Link>
          </div>
        </div>
      ) : (
        <PagedChildren pageSize={9} minItemWidth={340}>
          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
            const doneTasks = projectTasks.filter((t) => t.status === 'Done').length;
            const blockedTasks = projectTasks.filter((t) => t.status === 'Blocked').length;
            const progressPercent = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;

            const projectAgents = agents.filter((a) => a.currentProjectId === project.projectId);
            const projectWps = workPackages.filter((w) => w.projectId === project.projectId);
            const currentStage = projectWps.find((w) => w.status === 'Running' || w.status === 'Claimed')?.stage || (progressPercent === 100 ? 'Completed' : 'Execution');

            return (
              <Link
                key={project.projectId}
                href={`/company/projects/${project.projectId}`}
                style={{
                  display: 'block',
                  padding: '20px 22px',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
                  textDecoration: 'none',
                  color: colors.text,
                  transition: 'all 0.15s ease',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* Top Row: Name and Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      {project.name}
                    </h2>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: fonts.mono }}>
                      Owner: {project.owner ?? 'Engineering Specialist'}
                    </div>
                  </div>
                  <StatusBadge tone={projectTone(project.status)} label={project.status} />
                </div>

                {/* Middle details: Opportunity, Stage, Agents */}
                <div style={{ margin: '14px 0', display: 'grid', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: colors.muted }}>Current Stage</span>
                    <strong style={{ color: colors.text }}>{currentStage}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: colors.muted }}>Active Agents</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a78bfa', fontWeight: 600 }}>
                      <Bot size={13} /> {projectAgents.length > 0 ? `${projectAgents.length} assigned` : 'Standby pool'}
                    </span>
                  </div>

                  {blockedTasks > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: colors.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={12} /> Blockers
                      </span>
                      <strong style={{ color: colors.danger }}>{blockedTasks} blocked</strong>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div style={{ margin: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.muted, marginBottom: 4 }}>
                    <span>Progress ({doneTasks}/{projectTasks.length} tasks)</span>
                    <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: colors.text }}>{progressPercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: progressPercent === 100 ? colors.success : colors.accent,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Footer: Last activity & drill down */}
                <div
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    color: colors.muted,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: fonts.mono }}>
                    <Clock size={11} /> {formatRelativeTime(project.updatedAt)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: colors.accent, fontWeight: 650 }}>
                    Project Command <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </PagedChildren>
      )}
    </div>
  );
}
