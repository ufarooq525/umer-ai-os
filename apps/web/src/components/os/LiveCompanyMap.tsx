import Link from 'next/link';
import { Card, colors, fonts, radii, spacing } from '@umer/ui';
import type {
  AgentRecord,
  AgentRunRecord,
  ArtifactRecord,
  OpportunityRecord,
  WorkProjectRecord,
  WorkTaskRecord,
} from '@/lib/control-api';
import { StatusBadge } from './StatusBadge';
import { agentTone, projectTone, taskTone } from './status';

export type LiveCompanyMapProps = {
  opportunities: OpportunityRecord[];
  projects: WorkProjectRecord[];
  tasks: WorkTaskRecord[];
  agents: AgentRecord[];
  agentRuns: AgentRunRecord[];
  /** Optional — resolves an artifact node's opaque id to real content when the Artifact Runtime store has it. */
  artifacts?: ArtifactRecord[];
};

type MapNode = { key: string; label: string; sublabel?: string; href: string; tone?: ReturnType<typeof agentTone>; active: boolean };

function Node({ node }: { node: MapNode }) {
  return (
    <Link
      href={node.href}
      style={{
        display: 'block',
        minWidth: 140,
        maxWidth: 200,
        padding: '8px 10px',
        borderRadius: radii.md,
        border: `1px solid ${node.active ? colors.accent : colors.border}`,
        background: colors.surfaceRaised,
        textDecoration: 'none',
        color: colors.text,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {node.label}
      </div>
      {node.sublabel ? (
        <div style={{ fontSize: 10, color: colors.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.sublabel}
        </div>
      ) : null}
      {node.tone ? (
        <div style={{ marginTop: 4 }}>
          <StatusBadge tone={node.tone} />
        </div>
      ) : null}
    </Link>
  );
}

function Edge({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 28,
        height: 2,
        flexShrink: 0,
        background: active ? colors.accent : colors.border,
        alignSelf: 'center',
        borderRadius: 99,
        opacity: active ? 0.7 : 1,
      }}
    />
  );
}

function NodeColumn({ nodes, edgeActive }: { nodes: MapNode[]; edgeActive: boolean }) {
  if (nodes.length === 0) {
    return (
      <>
        <Edge active={false} />
        <div style={{ fontSize: 11, color: colors.muted, alignSelf: 'center', flexShrink: 0 }}>—</div>
      </>
    );
  }
  return (
    <>
      <Edge active={edgeActive} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {nodes.map((node) => (
          <Node key={node.key} node={node} />
        ))}
      </div>
    </>
  );
}

export function LiveCompanyMap({ opportunities, projects, tasks, agents, agentRuns, artifacts = [] }: LiveCompanyMapProps) {
  const activeProjects = projects.filter((p) => p.status === 'Active' || p.status === 'Forming' || p.status === 'Stabilizing');

  if (activeProjects.length === 0) {
    return (
      <Card title="Live Company Map">
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
          No active projects yet. Once a project starts in{' '}
          <Link href="/decisions" style={{ color: colors.accent }}>
            Decisions
          </Link>
          , its opportunity → agents → tasks chain will appear here in real time.
        </p>
      </Card>
    );
  }

  const runByWorkPackageId = new Map(agentRuns.map((r) => [r.workPackageId, r]));
  const artifactById = new Map(artifacts.map((a) => [a.artifactId, a]));

  return (
    <Card title="Live Company Map">
      <div style={{ display: 'grid', gap: spacing.lg }}>
        {activeProjects.map((project) => {
          const opportunity = project.sourceOpportunityId
            ? opportunities.find((o) => o.id === project.sourceOpportunityId)
            : undefined;
          const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
          const projectAgentIds = new Set(projectTasks.map((t) => t.assignedAgentId).filter(Boolean) as string[]);
          const projectAgents = agents.filter((a) => projectAgentIds.has(a.agentId) || a.currentProjectId === project.projectId);
          const anyAgentWorking = projectAgents.some((a) => a.status === 'active' && a.controlState === 'active');

          const oppNodes: MapNode[] = opportunity
            ? [
                {
                  key: opportunity.id,
                  label: opportunity.title,
                  sublabel: opportunity.score ? `Score ${opportunity.score.overall}/100` : undefined,
                  href: `/company/opportunities?open=${opportunity.id}`,
                  active: false,
                },
              ]
            : [];

          const projectNodes: MapNode[] = [
            {
              key: project.projectId,
              label: project.name,
              sublabel: project.status,
              href: `/company/projects/${project.projectId}`,
              tone: projectTone(project.status),
              active: project.status === 'Active',
            },
          ];

          const agentNodes: MapNode[] = projectAgents.map((agent) => {
            const run = agent.currentWorkPackageId ? runByWorkPackageId.get(agent.currentWorkPackageId) : undefined;
            return {
              key: agent.agentId,
              label: agent.name ?? agent.agentId,
              sublabel: run?.currentTool ? `using ${run.currentTool}` : agent.department,
              href: `/company/agents/${agent.agentId}`,
              tone: agentTone(agent.status, agent.controlState),
              active: agent.status === 'active' && agent.controlState === 'active',
            };
          });

          const visibleTasks = projectTasks.slice(0, 4);
          const taskNodes: MapNode[] = visibleTasks.map((task) => ({
            key: task.taskId,
            label: task.title,
            sublabel: task.status,
            href: `/company/tasks`,
            tone: taskTone(task.status),
            active: task.status === 'InProgress',
          }));
          if (projectTasks.length > visibleTasks.length) {
            taskNodes.push({
              key: `${project.projectId}-more`,
              label: `+${projectTasks.length - visibleTasks.length} more`,
              href: `/company/projects/${project.projectId}`,
              active: false,
            });
          }

          const projectAgentRuns = projectAgents
            .map((a) => (a.currentWorkPackageId ? runByWorkPackageId.get(a.currentWorkPackageId) : undefined))
            .filter((r): r is NonNullable<typeof r> => Boolean(r));

          const toolNodes: MapNode[] = projectAgentRuns
            .filter((run) => run.status === 'running' && run.currentTool)
            .map((run) => ({
              key: `tool:${run.workPackageId}`,
              label: run.currentTool!,
              sublabel: 'tool call',
              href: `/company/agents/${run.agentId}`,
              active: true,
            }));

          const artifactNodes: MapNode[] = projectAgentRuns
            .filter((run) => Boolean(run.artifactId))
            .map((run) => {
              const artifact = artifactById.get(run.artifactId!);
              return {
                key: `artifact:${run.workPackageId}`,
                label: artifact ? artifact.artifactType : run.artifactId!,
                sublabel: artifact ? artifact.acceptanceStatus : (run.summary ?? 'artifact produced'),
                href: `/company/agents/${run.agentId}`,
                active: false,
              };
            });

          return (
            <div key={project.projectId} style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minWidth: 'max-content' }}>
                {oppNodes.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {oppNodes.map((n) => (
                        <Node key={n.key} node={n} />
                      ))}
                    </div>
                    <Edge active={false} />
                  </>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {projectNodes.map((n) => (
                    <Node key={n.key} node={n} />
                  ))}
                </div>
                <NodeColumn nodes={agentNodes} edgeActive={anyAgentWorking} />
                <NodeColumn nodes={taskNodes} edgeActive={anyAgentWorking} />
                {toolNodes.length > 0 ? <NodeColumn nodes={toolNodes} edgeActive /> : null}
                {artifactNodes.length > 0 ? <NodeColumn nodes={artifactNodes} edgeActive={false} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: `${spacing.md}px 0 0`, fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>
        {activeProjects.length} active {activeProjects.length === 1 ? 'project' : 'projects'} shown
      </p>
    </Card>
  );
}
