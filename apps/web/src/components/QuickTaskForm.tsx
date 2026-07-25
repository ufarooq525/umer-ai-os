'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Badge, Button, Card, colors, radii } from '@umer/ui';
import {
  routeIntakeGoal,
  submitIntake,
  type IntakeRecord,
  type IntakeRouting,
  type ProjectRecord,
} from '@/lib/control-api';

/** Slimmer than Projects intake — dashboard convenience only. */
const QUICK_TYPES = ['feature', 'bug', 'seo', 'security', 'perf', 'ux', 'qa'] as const;
type QuickType = (typeof QUICK_TYPES)[number];

const ROUTE_DEBOUNCE_MS = 450;

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
  if (type === 'ux') return { gateId: `gate-ux-${projectId}`, autoApplied: false };
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

function isQuickType(value: string): value is QuickType {
  return (QUICK_TYPES as readonly string[]).includes(value);
}

/**
 * Lightweight dashboard entry point over the existing `/v1/intake` flow.
 *
 * PM (control-api) reads the wording and suggests a desk while you type. The suggestion
 * never overrides the dropdown — you stay the router of last resort.
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
  const [routing, setRouting] = useState<IntakeRouting | null>(null);
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

  const trimmedGoal = goal.trim();

  // Ask PM which desk this wording belongs to, then apply it only if the operator
  // has not taken over the dropdown themselves.
  useEffect(() => {
    if (trimmedGoal.length < 8) {
      setRouting(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void routeIntakeGoal({ goal: trimmedGoal })
        .then((result) => {
          if (cancelled) return;
          setRouting(result.routing);
          if (!typeTouched && isQuickType(result.routing.suggestedType)) {
            setType(result.routing.suggestedType);
          }
        })
        .catch(() => {
          if (!cancelled) setRouting(null);
        });
    }, ROUTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedGoal, typeTouched]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!projectId || trimmedGoal.length < 8) {
      setError('Pick a project and describe the task (at least 8 characters).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const record = await submitIntake({
        projectId,
        type,
        goal: trimmedGoal,
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
      setRouting(null);
      setTypeTouched(false);
      setType('feature');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const suggestionMatches = routing?.suggestedType === type;

  return (
    <Card title="Quick Task">
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'grid', gap: 12 }}>
        <label style={labelStyle}>
          Task
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe it in your own words — e.g. the dashboard layout feels cramped on mobile"
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
                if (isQuickType(e.target.value)) setType(e.target.value);
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

        {routing ? (
          <div
            role="status"
            style={{
              display: 'grid',
              gap: 6,
              padding: '10px 12px',
              border: `1px solid ${suggestionMatches ? colors.border : colors.borderStrong}`,
              borderRadius: radii.md,
              background: suggestionMatches ? 'transparent' : colors.accentSoft,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={suggestionMatches ? 'success' : 'warning'}>
                PM suggests {routing.suggestedType}
              </Badge>
              <span style={{ color: colors.muted }}>
                confidence {routing.confidence} · {routing.specialists.join(' → ')}
              </span>
              {!suggestionMatches && isQuickType(routing.suggestedType) ? (
                <button
                  type="button"
                  onClick={() => {
                    setTypeTouched(true);
                    if (isQuickType(routing.suggestedType)) setType(routing.suggestedType);
                  }}
                  style={linkButtonStyle}
                >
                  Use {routing.suggestedType}
                </button>
              ) : null}
            </div>
            <p style={{ margin: 0, color: colors.text }}>{routing.reason}</p>
            {routing.followUp ? (
              <p style={{ margin: 0, color: colors.muted }}>{routing.followUp}</p>
            ) : null}
            {!suggestionMatches ? (
              <p style={{ margin: 0, color: colors.muted }}>
                You have <code>{type}</code> selected — that is what will be submitted.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p style={{ color: colors.danger, margin: 0, fontSize: 14 }}>{error}</p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button type="submit" disabled={busy || options.length === 0}>
            {busy ? 'Submitting…' : 'Submit task'}
          </Button>
          <span style={{ fontSize: 13, color: colors.muted }}>
            Audit desks (<code>ux</code>, <code>seo</code>, <code>security</code>, <code>perf</code>
            , <code>qa</code>) report findings. Only <code>feature</code> and <code>bug</code> change
            code, and only after you approve the gate.
          </span>
        </div>
      </form>

      {confirm ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1px solid ${colors.border}`,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="success">Submitted</Badge>
            <Badge>{confirm.type}</Badge>
            <strong style={{ fontSize: 14 }}>{confirm.projectName}</strong>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: colors.text }}>{confirm.summary}</p>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
            Intake <code>{confirm.intakeId}</code>
            {confirm.autoApplied ? ' · applied automatically' : null}
          </p>
          {confirm.gateId ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              Review on{' '}
              <a href="/gates" style={{ color: colors.accent }}>
                Gates
              </a>{' '}
              (<code>{confirm.gateId}</code>).
            </p>
          ) : confirm.autoApplied ? (
            <p style={{ margin: 0, fontSize: 14, color: colors.muted }}>
              No gate — change was auto-applied. Check{' '}
              <a href="/audit" style={{ color: colors.accent }}>
                Audit
              </a>{' '}
              for the seal record.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }}>
              Open{' '}
              <a href="/gates" style={{ color: colors.accent }}>
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
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontFamily: 'inherit',
};

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: colors.accent,
  font: 'inherit',
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
};
