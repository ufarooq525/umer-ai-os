'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, colors, radii } from '@umer/ui';
import {
  executeCommand,
  type AgentRecord,
  type CeoActor,
  type CeoActorKind,
  type CeoCommandName,
  type OpportunityRecord,
  type WorkProjectRecord,
  type WorkTaskRecord,
} from '@/lib/control-api';

/**
 * CEO Command & Decision Plane console. Every button here is a thin wrapper
 * around POST /v1/commands (@umer/control-plane's CeoCommandService) — no
 * business logic lives in this file, only the HTTP call and the read-model
 * refresh afterward. The button conditions below (which action shows on
 * which row) mirror the handler's transition guards for a good default UX,
 * but the backend is still the source of truth: a stale row that's since
 * changed just surfaces the resulting error inline instead of silently
 * succeeding.
 */

const SELECTABLE_FROM = new Set(['discovered', 'researching', 'validated', 'outreach_ready', 'in_sales']);
const REJECTABLE_FROM = new Set([
  'discovered',
  'researching',
  'validated',
  'outreach_ready',
  'in_sales',
  'selected_for_execution',
]);
const PAUSABLE_PROJECT_FROM = new Set(['Forming', 'Active', 'Stabilizing']);
const TERMINAL_PROJECT = new Set(['Archived', 'Abandoned']);

type Props = {
  opportunities: OpportunityRecord[];
  projects: WorkProjectRecord[];
  tasks: WorkTaskRecord[];
  agents: AgentRecord[];
};

export function CeoDecisionPlane({ opportunities, projects, tasks, agents }: Props) {
  const router = useRouter();
  const [principalId, setPrincipalId] = useState('human.ceo');
  const [kind, setKind] = useState<CeoActorKind>('human');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);

  const actor: CeoActor = { principalId: principalId.trim() || 'human.ceo', kind };

  async function run(
    key: string,
    name: CeoCommandName,
    payload: Record<string, unknown>,
    target?: { entityType: 'opportunity' | 'project' | 'task' | 'agent'; entityId: string },
  ): Promise<boolean> {
    setBusyKey(key);
    setErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      const result = await executeCommand({ name, actor, payload, target });
      setLastResult(`${name} → ${result.status} (${result.commandId})`);
      router.refresh();
      return true;
    } catch (err) {
      setErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : String(err) }));
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Acting as">
        <p style={{ margin: '0 0 12px', color: colors.muted, fontSize: 12 }}>
          Every command below is sent as this actor and authorized by @umer/trust — only the
          configured CEO principal (default <code>human.ceo</code>) is granted command authority.
          There is no login yet; this is trusted client input for this milestone.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            Principal id
            <input
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              style={{ ...fieldStyle, width: 220 }}
              autoComplete="off"
            />
          </label>
          <label style={labelStyle}>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as CeoActorKind)} style={fieldStyle}>
              <option value="human">human</option>
              <option value="specialist_run">specialist_run</option>
              <option value="system">system</option>
            </select>
          </label>
        </div>
        {lastResult ? (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.success }}>{lastResult}</p>
        ) : null}
      </Card>

      <OpportunitiesPanel opportunities={opportunities} busyKey={busyKey} errors={errors} run={run} />
      <ProjectsPanel projects={projects} busyKey={busyKey} errors={errors} run={run} />
      <TasksPanel tasks={tasks} projects={projects} busyKey={busyKey} errors={errors} run={run} />
      <AgentsPanel agents={agents} busyKey={busyKey} errors={errors} run={run} />
    </div>
  );
}

type RunFn = (
  key: string,
  name: CeoCommandName,
  payload: Record<string, unknown>,
  target?: { entityType: 'opportunity' | 'project' | 'task' | 'agent'; entityId: string },
) => Promise<boolean>;

type PanelBaseProps = {
  busyKey: string | null;
  errors: Record<string, string>;
  run: RunFn;
};

function RowError({ message }: { message?: string }) {
  if (!message) return null;
  return <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.danger }}>{message}</p>;
}

function OpportunitiesPanel({
  opportunities,
  busyKey,
  errors,
  run,
}: PanelBaseProps & { opportunities: OpportunityRecord[] }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const statuses = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.status))).sort(),
    [opportunities],
  );
  const filtered = (statusFilter === 'all' ? opportunities : opportunities.filter((o) => o.status === statusFilter)).slice(
    0,
    30,
  );

  return (
    <Card title={`Opportunities (${opportunities.length})`}>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Filter by status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={fieldStyle}>
            <option value="all">all</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No opportunities match.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {filtered.map((opp) => {
            const target = { entityType: 'opportunity' as const, entityId: opp.id };
            const selectKey = `select:${opp.id}`;
            const rejectKey = `reject:${opp.id}`;
            const projectKey = `create-project:${opp.id}`;
            return (
              <li
                key={opp.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  borderBottom: `1px solid ${colors.border}`,
                  padding: '10px 2px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{opp.title}</strong>
                  <div style={{ color: colors.muted, fontSize: 11 }}>
                    {opp.geography} · {opp.market}
                    {opp.estimatedValueMin != null
                      ? ` · ${opp.currency ?? 'USD'} ${opp.estimatedValueMin}-${opp.estimatedValueMax}`
                      : ''}
                  </div>
                  <RowError message={errors[selectKey] || errors[rejectKey] || errors[projectKey]} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge tone={opp.status === 'project_created' ? 'success' : opp.status === 'rejected' ? 'danger' : 'default'}>
                    {opp.status}
                  </Badge>
                  {SELECTABLE_FROM.has(opp.status) ? (
                    <Button
                      disabled={busyKey === selectKey}
                      onClick={() => void run(selectKey, 'SelectOpportunity', { opportunityId: opp.id }, target)}
                      style={smallButtonStyle}
                    >
                      Select
                    </Button>
                  ) : null}
                  {REJECTABLE_FROM.has(opp.status) ? (
                    <Button
                      variant="danger"
                      disabled={busyKey === rejectKey}
                      onClick={() => void run(rejectKey, 'RejectOpportunity', { opportunityId: opp.id }, target)}
                      style={smallButtonStyle}
                    >
                      Reject
                    </Button>
                  ) : null}
                  {opp.status === 'selected_for_execution' ? (
                    <Button
                      disabled={busyKey === projectKey}
                      onClick={() => void run(projectKey, 'CreateProjectFromOpportunity', { opportunityId: opp.id })}
                      style={smallButtonStyle}
                    >
                      Create project
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ProjectsPanel({ projects, busyKey, errors, run }: PanelBaseProps & { projects: WorkProjectRecord[] }) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [reason, setReason] = useState('');
  const createKey = 'create-project';

  return (
    <Card title={`Projects (${projects.length})`}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          style={{ ...fieldStyle, flex: '1 1 200px' }}
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner (optional)"
          style={{ ...fieldStyle, flex: '1 1 140px' }}
        />
        <Button
          disabled={busyKey === createKey || !name.trim()}
          onClick={() =>
            void run(createKey, 'CreateProject', { name: name.trim(), owner: owner.trim() || undefined }).then((ok) => {
              if (ok) {
                setName('');
                setOwner('');
              }
            })
          }
        >
          Create
        </Button>
      </div>
      <RowError message={errors[createKey]} />

      <label style={{ ...labelStyle, marginBottom: 10, display: 'block' }}>
        Reason (used for the next Pause/Cancel below)
        <input value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle} />
      </label>

      {projects.length === 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No projects yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {projects.map((project) => {
            const target = { entityType: 'project' as const, entityId: project.projectId };
            const pauseKey = `pause:${project.projectId}`;
            const resumeKey = `resume:${project.projectId}`;
            const cancelKey = `cancel:${project.projectId}`;
            return (
              <li
                key={project.projectId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  borderBottom: `1px solid ${colors.border}`,
                  padding: '10px 2px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{project.name}</strong>
                  <div style={{ color: colors.muted, fontSize: 11 }}>
                    {project.projectId} · owner {project.owner ?? '—'}
                    {project.sourceOpportunityId ? ` · from opportunity ${project.sourceOpportunityId}` : ''}
                  </div>
                  <RowError message={errors[pauseKey] || errors[resumeKey] || errors[cancelKey]} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge tone={project.status === 'Active' ? 'success' : project.status === 'Paused' ? 'warning' : 'default'}>
                    {project.status}
                  </Badge>
                  {project.status === 'Paused' ? (
                    <Button
                      disabled={busyKey === resumeKey}
                      onClick={() => void run(resumeKey, 'ResumeProject', { projectId: project.projectId }, target)}
                      style={smallButtonStyle}
                    >
                      Resume
                    </Button>
                  ) : PAUSABLE_PROJECT_FROM.has(project.status) ? (
                    <Button
                      disabled={busyKey === pauseKey}
                      onClick={() =>
                        void run(
                          pauseKey,
                          'PauseProject',
                          { projectId: project.projectId, reason: reason.trim() || undefined },
                          target,
                        )
                      }
                      style={smallButtonStyle}
                    >
                      Pause
                    </Button>
                  ) : null}
                  {!TERMINAL_PROJECT.has(project.status) ? (
                    <Button
                      variant="danger"
                      disabled={busyKey === cancelKey}
                      onClick={() =>
                        void run(
                          cancelKey,
                          'CancelProject',
                          { projectId: project.projectId, reason: reason.trim() || undefined },
                          target,
                        )
                      }
                      style={smallButtonStyle}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TasksPanel({
  tasks,
  projects,
  busyKey,
  errors,
  run,
}: PanelBaseProps & { tasks: WorkTaskRecord[]; projects: WorkProjectRecord[] }) {
  const [epicId, setEpicId] = useState('epic-1');
  const [projectId, setProjectId] = useState(projects[0]?.projectId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [agentDraft, setAgentDraft] = useState<Record<string, string>>({});
  const createKey = 'create-task';

  return (
    <Card title={`Tasks (${tasks.length})`}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...fieldStyle, flex: '1 1 180px' }}>
            <option value="">Pick a project…</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
          <input value={epicId} onChange={(e) => setEpicId(e.target.value)} placeholder="Epic id" style={{ ...fieldStyle, flex: '1 1 120px' }} />
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={fieldStyle} />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          style={fieldStyle}
        />
        <input
          value={acceptanceCriteria}
          onChange={(e) => setAcceptanceCriteria(e.target.value)}
          placeholder="Acceptance criteria, comma-separated"
          style={fieldStyle}
        />
        <div>
          <Button
            disabled={busyKey === createKey || !projectId || !title.trim() || !description.trim() || !acceptanceCriteria.trim()}
            onClick={() =>
              void run(createKey, 'CreateTask', {
                epicId: epicId.trim() || 'epic-1',
                projectId,
                title: title.trim(),
                description: description.trim(),
                acceptanceCriteria: acceptanceCriteria
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }).then((ok) => {
                if (ok) {
                  setTitle('');
                  setDescription('');
                  setAcceptanceCriteria('');
                }
              })
            }
          >
            Create task
          </Button>
        </div>
        <RowError message={errors[createKey]} />
      </div>

      {tasks.length === 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No tasks yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {tasks.map((task) => {
            const target = { entityType: 'task' as const, entityId: task.taskId };
            const assignKey = `assign:${task.taskId}`;
            const cancelKey = `cancel-work:${task.taskId}`;
            const draft = agentDraft[task.taskId] ?? '';
            const assignedAgentId = task.assignedAgentId;
            return (
              <li
                key={task.taskId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  borderBottom: `1px solid ${colors.border}`,
                  padding: '10px 2px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{task.title}</strong>
                  <div style={{ color: colors.muted, fontSize: 11 }}>
                    {task.projectId} · agent {task.assignedAgentId ?? '—'}
                  </div>
                  <RowError message={errors[assignKey] || errors[cancelKey]} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge tone={task.status === 'Done' ? 'success' : task.status === 'Cancelled' ? 'danger' : 'default'}>
                    {task.status}
                  </Badge>
                  <input
                    value={draft}
                    onChange={(e) => setAgentDraft((prev) => ({ ...prev, [task.taskId]: e.target.value }))}
                    placeholder="agent id"
                    style={{ ...fieldStyle, width: 110, padding: '5px 8px' }}
                  />
                  <Button
                    disabled={busyKey === assignKey || !draft.trim()}
                    onClick={() =>
                      void run(
                        assignKey,
                        task.assignedAgentId ? 'ReassignTask' : 'AssignTask',
                        { taskId: task.taskId, agentId: draft.trim() },
                        target,
                      )
                    }
                    style={smallButtonStyle}
                  >
                    {task.assignedAgentId ? 'Reassign' : 'Assign'}
                  </Button>
                  {assignedAgentId && task.status !== 'Done' && task.status !== 'Cancelled' ? (
                    <Button
                      variant="danger"
                      disabled={busyKey === cancelKey}
                      onClick={() =>
                        void run(
                          cancelKey,
                          'CancelWork',
                          { agentId: assignedAgentId, taskId: task.taskId },
                          { entityType: 'agent', entityId: assignedAgentId },
                        )
                      }
                      style={smallButtonStyle}
                    >
                      Cancel work
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AgentsPanel({ agents, busyKey, errors, run }: PanelBaseProps & { agents: AgentRecord[] }) {
  const [reason, setReason] = useState('');

  return (
    <Card title={`Agents (${agents.length})`}>
      <label style={{ ...labelStyle, marginBottom: 10, display: 'block' }}>
        Reason (used for the next Pause below)
        <input value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle} />
      </label>

      {agents.length === 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No agents seen yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {agents.map((agent) => {
            const target = { entityType: 'agent' as const, entityId: agent.agentId };
            const pauseKey = `pause-agent:${agent.agentId}`;
            const resumeKey = `resume-agent:${agent.agentId}`;
            return (
              <li
                key={agent.agentId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  borderBottom: `1px solid ${colors.border}`,
                  padding: '10px 2px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{agent.name ?? agent.agentId}</strong>
                  <div style={{ color: colors.muted, fontSize: 11 }}>
                    {agent.specialistId} · {agent.department ?? 'unassigned dept'} · run status {agent.status}
                  </div>
                  <RowError message={errors[pauseKey] || errors[resumeKey]} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge tone={agent.controlState === 'paused' ? 'warning' : 'success'}>{agent.controlState}</Badge>
                  {agent.controlState === 'paused' ? (
                    <Button
                      disabled={busyKey === resumeKey}
                      onClick={() => void run(resumeKey, 'ResumeAgent', { agentId: agent.agentId }, target)}
                      style={smallButtonStyle}
                    >
                      Resume
                    </Button>
                  ) : (
                    <Button
                      disabled={busyKey === pauseKey}
                      onClick={() =>
                        void run(pauseKey, 'PauseAgent', { agentId: agent.agentId, reason: reason.trim() || undefined }, target)
                      }
                      style={smallButtonStyle}
                    >
                      Pause
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: colors.muted,
};

const fieldStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: 13,
};

const smallButtonStyle: CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
};
