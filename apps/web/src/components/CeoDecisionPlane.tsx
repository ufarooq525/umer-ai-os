'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Card, colors, radii } from '@umer/ui';
import {
  executeCommand,
  getNicheProspects,
  type AgentRecord,
  type CeoActor,
  type CeoActorKind,
  type CeoCommandName,
  type NicheProspectSummary,
  type OpportunityRecord,
  type WorkProjectRecord,
  type WorkTaskRecord,
} from '@/lib/control-api';
import { deriveCompanyPulse } from '@/lib/company-derive';
import { deriveDecisionQueue, deriveDecisionTier, DECISION_CONSEQUENCE, type DecisionTier } from '@/lib/decision-center';
import { OpportunityJourney, recommendationLabel } from '@/components/os/OpportunityJourney';

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
  const pulse = useMemo(() => deriveCompanyPulse(agents, projects, tasks, opportunities), [agents, projects, tasks, opportunities]);

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
      <DecisionCenterSummary pulse={pulse} />

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

      <DecisionCenterPanel opportunities={opportunities} busyKey={busyKey} errors={errors} run={run} />
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

function DecisionCenterSummary({ pulse }: { pulse: ReturnType<typeof deriveCompanyPulse> }) {
  return (
    <Card>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.muted,
          marginBottom: 8,
        }}
      >
        CEO Decision Center
      </div>
      <p style={{ margin: 0, fontSize: 15, color: colors.text, lineHeight: 1.6 }}>
        <strong>{pulse.decisionsRequired}</strong> decision{pulse.decisionsRequired === 1 ? '' : 's'} require your
        attention · <strong>{pulse.opportunities.promising}</strong> opportunit
        {pulse.opportunities.promising === 1 ? 'y' : 'ies'} being evaluated · <strong>{pulse.projects.active}</strong>{' '}
        active project{pulse.projects.active === 1 ? '' : 's'} · <strong>{pulse.agents.working}</strong> agent
        {pulse.agents.working === 1 ? '' : 's'} working
      </p>
    </Card>
  );
}

const TIER_META: Record<DecisionTier, { icon: string; label: string; color: string }> = {
  important: { icon: '🟠', label: 'IMPORTANT', color: colors.warning },
  review: { icon: '🟡', label: 'REVIEW', color: colors.warning },
};

function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: colors.accent,
        marginBottom: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DecisionRow({
  opportunity,
  active,
  onSelect,
}: {
  opportunity: OpportunityRecord;
  active: boolean;
  onSelect: () => void;
}) {
  const tier = deriveDecisionTier(opportunity.score!.overall);
  const meta = TIER_META[tier];
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: radii.md,
        border: `1px solid ${active ? colors.borderStrong : colors.border}`,
        background: active ? colors.surfaceRaised : 'transparent',
        color: colors.text,
        cursor: 'pointer',
        font: 'inherit',
        width: '100%',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.06em' }}>
          {meta.icon} {meta.label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {opportunity.title}
        </div>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: colors.accent, flexShrink: 0 }}>
        {opportunity.score!.overall}
      </div>
    </button>
  );
}

function DecisionDetail({ opportunity, busyKey, errors, run }: { opportunity: OpportunityRecord } & PanelBaseProps) {
  const [prospects, setProspects] = useState<{ runId: string | null; prospects: NicheProspectSummary[] } | null>(null);
  const [confirmed, setConfirmed] = useState<'selected' | 'rejected' | null>(null);

  useEffect(() => {
    setProspects(null);
    setConfirmed(null);
    if (!opportunity.nicheId) return;
    let alive = true;
    void getNicheProspects(opportunity.nicheId).then((result) => {
      if (alive) setProspects(result);
    });
    return () => {
      alive = false;
    };
  }, [opportunity.id, opportunity.nicheId]);

  const target = { entityType: 'opportunity' as const, entityId: opportunity.id };
  const selectKey = `select:${opportunity.id}`;
  const rejectKey = `reject:${opportunity.id}`;
  const score = opportunity.score!;
  const highFit = prospects?.prospects.filter((p) => p.bestScore >= HIGH_FIT_THRESHOLD).length;
  const contactable = prospects?.prospects.filter((p) => p.hasContactChannel).length;

  async function handle(key: string, name: Extract<CeoCommandName, 'SelectOpportunity' | 'RejectOpportunity'>) {
    const ok = await run(key, name, { opportunityId: opportunity.id }, target);
    if (ok) setConfirmed(name === 'SelectOpportunity' ? 'selected' : 'rejected');
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{opportunity.title}</h3>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: colors.accent }}>
            {score.overall}
          </span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>
          {opportunity.geography} · {opportunity.market}
        </p>
      </div>

      {confirmed ? (
        <div
          style={{
            padding: 10,
            borderRadius: radii.sm,
            border: `1px solid ${colors.success}`,
            background: `${colors.success}18`,
          }}
        >
          <strong style={{ fontSize: 13, color: colors.success }}>✓ Opportunity {confirmed}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: colors.muted }}>
            {(confirmed === 'selected' ? DECISION_CONSEQUENCE.ifApproved : DECISION_CONSEQUENCE.ifRejected).map(
              (line) => (
                <li key={line}>{line}</li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      <div>
        <SectionLabel>Why this is here</SectionLabel>
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
          {recommendationLabel(score.recommendation)}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <SectionLabel>Evidence</SectionLabel>
          <p style={{ margin: 0, fontSize: 13 }}>{opportunity.evidenceRefs?.length ?? 0} supporting signal(s)</p>
        </div>
        <div>
          <SectionLabel>Prospects</SectionLabel>
          {!opportunity.nicheId ? (
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No research run linked yet.</p>
          ) : prospects === null ? (
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Loading…</p>
          ) : (
            <p style={{ margin: 0, fontSize: 13 }}>
              {prospects.prospects.length} discovered · {highFit} high-fit · {contactable} contactable
            </p>
          )}
        </div>
      </div>

      {opportunity.estimatedValueMin != null ? (
        <div>
          <SectionLabel>Estimated value</SectionLabel>
          <p style={{ margin: 0, fontSize: 13 }}>
            {opportunity.currency ?? 'USD'} {opportunity.estimatedValueMin}–{opportunity.estimatedValueMax}
            {opportunity.timeToRevenueDays != null ? ` · ~${opportunity.timeToRevenueDays}d to revenue` : ''}
          </p>
        </div>
      ) : null}

      <div>
        <SectionLabel>Timeline</SectionLabel>
        <OpportunityJourney status={opportunity.status} />
      </div>

      <div>
        <SectionLabel>If approved</SectionLabel>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: colors.muted }}>
          {DECISION_CONSEQUENCE.ifApproved.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <SectionLabel style={{ marginTop: 8 }}>If rejected</SectionLabel>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: colors.muted }}>
          {DECISION_CONSEQUENCE.ifRejected.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <RowError message={errors[selectKey] || errors[rejectKey]} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/company/opportunities/${opportunity.id}`} style={{ fontSize: 12, color: colors.accent }}>
          View full opportunity →
        </Link>
        <div style={{ flex: 1 }} />
        <Button
          variant="danger"
          disabled={busyKey === rejectKey}
          onClick={() => void handle(rejectKey, 'RejectOpportunity')}
        >
          Reject
        </Button>
        <Button disabled={busyKey === selectKey} onClick={() => void handle(selectKey, 'SelectOpportunity')}>
          Select
        </Button>
      </div>
    </div>
  );
}

const HIGH_FIT_THRESHOLD = 70;

function DecisionCenterPanel({ opportunities, busyKey, errors, run }: PanelBaseProps & { opportunities: OpportunityRecord[] }) {
  const queue = useMemo(() => deriveDecisionQueue(opportunities), [opportunities]);
  const [selected, setSelected] = useState<OpportunityRecord | null>(queue[0] ?? null);
  const effectiveSelected = queue.find((o) => o.id === selected?.id) ?? selected;

  const readyForProject = opportunities.filter((o) => o.status === 'selected_for_execution');

  return (
    <>
      <Card title={`Priority Decisions (${queue.length})`}>
        {queue.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            No opportunities are awaiting a decision right now.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div
              style={{
                flex: '1 1 280px',
                maxWidth: 440,
                minWidth: 0,
                display: 'grid',
                gap: 6,
                maxHeight: '70vh',
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {queue.map((opp) => (
                <DecisionRow key={opp.id} opportunity={opp} active={opp.id === selected?.id} onSelect={() => setSelected(opp)} />
              ))}
            </div>
            <div style={{ flex: '1 1 380px', maxWidth: 560, minWidth: 0, position: 'sticky', top: 20, maxHeight: '80vh', overflowY: 'auto' }}>
              {effectiveSelected ? (
                <DecisionDetail opportunity={effectiveSelected} busyKey={busyKey} errors={errors} run={run} />
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {readyForProject.length > 0 ? (
        <Card title={`Selected — ready to create a project (${readyForProject.length})`}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {readyForProject.map((opp) => {
              const target = { entityType: 'opportunity' as const, entityId: opp.id };
              const projectKey = `create-project:${opp.id}`;
              const rejectKey = `reject:${opp.id}`;
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
                    <RowError message={errors[projectKey] || errors[rejectKey]} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Button
                      variant="danger"
                      disabled={busyKey === rejectKey}
                      onClick={() => void run(rejectKey, 'RejectOpportunity', { opportunityId: opp.id }, target)}
                      style={smallButtonStyle}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={busyKey === projectKey}
                      onClick={() => void run(projectKey, 'CreateProjectFromOpportunity', { opportunityId: opp.id })}
                      style={smallButtonStyle}
                    >
                      Create project
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
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
