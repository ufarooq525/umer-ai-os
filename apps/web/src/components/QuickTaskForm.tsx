'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Badge, Button, Card } from '@umer/ui';
import {
  submitIntake,
  type IntakeRecord,
  type ProjectRecord,
} from '@/lib/control-api';

/** Slimmer than Projects intake — dashboard convenience only. */
const QUICK_TYPES = ['feature', 'bug', 'seo', 'security', 'perf'] as const;
type QuickType = (typeof QUICK_TYPES)[number];

type Props = {
  projects: ProjectRecord[];
};

/** Mirror control-api gate ids from the intake record (no extra round-trip). */
export function gateIdFromIntake(record: IntakeRecord): {
  gateId?: string;
  autoApplied: boolean;
} {
  if (record.status === 'approved') {
    return { autoApplied: true };
  }
  const { type, projectId, engDelivery } = record.plan;
  if (type === 'seo') return { gateId: `gate-seo-${projectId}`, autoApplied: false };
  if (type === 'security') return { gateId: `gate-security-${projectId}`, autoApplied: false };
  if (type === 'perf') return { gateId: `gate-perf-${projectId}`, autoApplied: false };
  if (type === 'qa') return { gateId: `gate-qa-${projectId}`, autoApplied: false };
  if ((type === 'feature' || type === 'bug') && engDelivery) {
    return { gateId: `gate-eng-${projectId}`, autoApplied: false };
  }
  return { gateId: `gate-intake-${projectId}`, autoApplied: false };
}

function pickDefaultProject(projects: ProjectRecord[]): string {
  const active = projects.filter((p) => p.status === 'active');
  const pool = active.length > 0 ? active : projects;
  return (
    pool.find((p) => p.category === 'client-task')?.projectId ??
    pool.find((p) => p.category === 'digital-product')?.projectId ??
    pool[0]?.projectId ??
    ''
  );
}

function inferTypeHint(goal: string): QuickType | null {
  const g = goal.toLowerCase();
  if (/\b(seo|ranking|sitemap|meta title|lighthouse)\b/.test(g)) return 'seo';
  if (/\b(bug|fix|regression|broken|crash|error)\b/.test(g)) return 'bug';
  if (/\b(security|idor|authz|xss|csrf)\b/.test(g)) return 'security';
  if (/\b(perf|slow|latency|performance)\b/.test(g)) return 'perf';
  return null;
}

/**
 * Lightweight dashboard entry point over the existing `/v1/intake` flow.
 */
export function QuickTaskForm({ projects }: Props) {
  const router = useRouter();
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects],
  );
  const options = activeProjects.length > 0 ? activeProjects : projects;

  const [projectId, setProjectId] = useState(() => pickDefaultProject(projects));
  const [type, setType] = useState<QuickType>('feature');
  const [typeTouched, setTypeTouched] = useState(false);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    intakeId: string;
    summary: string;
    gateId?: string;
    autoApplied?: boolean;
    projectName: string;
    type: QuickType;
  } | null>(null);

  function onGoalChange(value: string) {
    setGoal(value);
    if (!typeTouched) {
      const hinted = inferTypeHint(value);
      if (hinted) setType(hinted);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!projectId || trimmed.length < 8) {
      setError('Pick a project and describe the task (at least 8 characters).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const record = await submitIntake({
        projectId,
        type,
        goal: trimmed,
      });
      const { gateId, autoApplied } = gateIdFromIntake(record);
      const project = options.find((p) => p.projectId === projectId);
      setConfirm({
        intakeId: record.intakeId,
        summary: record.plan.summary,
        gateId,
        autoApplied,
        projectName: project?.name ?? record.plan.projectName,
        type,
      });
      setGoal('');
      setTypeTouched(false);
      setType('feature');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Quick Task">
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'grid', gap: 12 }}>
        <label style={labelStyle}>
          Task
          <input
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="e.g. Fix fee validation rejecting zero amounts"
            style={fieldStyle}
            disabled={busy}
            autoComplete="off"
          />
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 12,
          }}
        >
          <label style={labelStyle}>
            Project
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={fieldStyle}
              disabled={busy || options.length === 0}
            >
              {options.length === 0 ? (
                <option value="">No projects in catalog</option>
              ) : (
                options.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.name} · {p.category}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={labelStyle}>
            Type
            <select
              value={type}
              onChange={(e) => {
                setTypeTouched(true);
                setType(e.target.value as QuickType);
              }}
              style={fieldStyle}
              disabled={busy}
            >
              {QUICK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p style={{ color: '#ff5c5c', margin: 0, fontSize: 14 }}>{error}</p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button type="submit" disabled={busy || options.length === 0}>
            {busy ? 'Submitting…' : 'Submit task'}
          </Button>
          <span style={{ fontSize: 13, opacity: 0.65 }}>
            Uses the same intake path as Projects — stays on this page after submit.
          </span>
        </div>
      </form>

      {confirm ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid #2d3a4d',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="success">Submitted</Badge>
            <Badge>{confirm.type}</Badge>
            <strong style={{ fontSize: 14 }}>{confirm.projectName}</strong>
          </div>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{confirm.summary}</p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
            Intake <code>{confirm.intakeId}</code>
            {confirm.autoApplied ? ' · applied automatically' : null}
          </p>
          {confirm.gateId ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              Review on{' '}
              <a href="/gates" style={{ color: '#7eb6ff' }}>
                Gates
              </a>{' '}
              (<code>{confirm.gateId}</code>).
            </p>
          ) : confirm.autoApplied ? (
            <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
              No gate — change was auto-applied. Check{' '}
              <a href="/audit" style={{ color: '#7eb6ff' }}>
                Audit
              </a>{' '}
              for the seal record.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }}>
              Open{' '}
              <a href="/gates" style={{ color: '#7eb6ff' }}>
                Gates
              </a>{' '}
              to approve when ready.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 14,
};

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 6,
  border: '1px solid #2d3a4d',
  background: '#0f1419',
  color: '#e8eef4',
  fontFamily: 'inherit',
};
