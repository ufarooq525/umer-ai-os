'use client';

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Badge, Button, Card, colors } from '@umer/ui';
import { submitIntake, type IntakeRecord, type ProjectRecord } from '@/lib/control-api';

const TYPES = ['feature', 'bug', 'seo', 'security', 'ux', 'qa', 'perf', 'brainstorm'] as const;

export function IntakeForm({ projects }: { projects: ProjectRecord[] }) {
  const router = useRouter();
  const school = projects.find((p) => p.projectId === 'school-app');
  const seoProjects = projects.filter(
    (p) => p.tags.includes('seo') || p.defaultSpecialists.includes('seo.audit'),
  );
  const defaultProject =
    school?.projectId ??
    seoProjects.find((p) => p.projectId === 'cursive-generator')?.projectId ??
    projects[0]?.projectId ??
    '';
  const [projectId, setProjectId] = useState(defaultProject);
  const selected = projects.find((p) => p.projectId === projectId);
  const [type, setType] = useState<(typeof TYPES)[number]>('qa');
  const [goal, setGoal] = useState('');
  const [doneWhen, setDoneWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<IntakeRecord | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!projectId || goal.trim().length < 8) {
      setError('Pick a project and write a goal (at least 8 characters).');
      return;
    }
    if (selected?.onDisk === false && type !== 'seo' && type !== 'brainstorm') {
      setError(`${selected.name} is not on disk. Only SEO (live URL) or brainstorm is allowed until the repo exists.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const record = await submitIntake({
        projectId,
        type,
        goal: goal.trim(),
        doneWhen: doneWhen.trim() || undefined,
      });
      setLast(record);
      setGoal('');
      setDoneWhen('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const seo = last?.plan.seoAudit;
  const qa = last?.plan.qaAudit;
  const ux = last?.plan.uxAudit;
  const security = last?.plan.securityAudit;
  const perf = last?.plan.perfAudit;
  const checklist = seo ?? qa ?? ux;
  const checklistTitle = seo
    ? `seo.audit — ${seo.projectName}`
    : qa
      ? `qa.verify — ${qa.projectName}`
      : ux
        ? `ux.design — ${ux.projectName}`
        : '';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="PM intake — give an instruction">
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            Project
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={fieldStyle}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name} ({p.projectId})
                  {p.onDisk === false ? ' · not on disk' : ''}
                  {p.tags.includes('seo') ? ' · SEO' : ''}
                  {p.defaultSpecialists.includes('qa.verify') ? ' · QA' : ''}
                </option>
              ))}
            </select>
          </label>
          {selected?.onDisk === false ? (
            <p style={{ margin: 0, fontSize: 13, color: colors.warning, lineHeight: 1.45 }}>
              {selected.name} is not under Laragon www.
              {selected.seoBaseUrl ? ` Live site: ${selected.seoBaseUrl}. SEO checks can use the public URL.` : ''}{' '}
              Do not run feature/bug apply — there is no local repo to write into.
            </p>
          ) : null}
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
              style={fieldStyle}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            Goal / instruction
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="e.g. Test school-app functional + non-functional UI journeys and seal evidence"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            Done when (optional)
            <input
              value={doneWhen}
              onChange={(e) => setDoneWhen(e.target.value)}
              placeholder="Acceptance criteria in one line"
              style={fieldStyle}
            />
          </label>
          {error ? <p style={{ color: colors.danger, margin: 0, fontSize: 14 }}>{error}</p> : null}
          {last && !checklist && !security && !perf && !ux ? (
            <p style={{ color: colors.success, margin: 0, fontSize: 14 }}>{last.plan.summary}</p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Planning…' : 'Submit to PM intake'}
          </Button>
        </form>
      </Card>

      {security ? (
        <Card title={`security.review — ${security.projectName}`}>
          <p style={{ marginTop: 0, opacity: 0.85 }}>{security.summary}</p>
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            Path: <code>{security.absolutePath}</code>
            {security.forcesGate ? ' · human gate forced (critical/high)' : ''}
          </p>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Findings</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {security.findings.map((f) => (
              <li
                key={f.id}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  paddingBottom: 12,
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge
                    tone={
                      f.severity === 'critical' || f.severity === 'high' ? 'danger' : 'warning'
                    }
                  >
                    {f.severity}
                  </Badge>
                  <Badge>{f.category}</Badge>
                  <strong>{f.title}</strong>
                </div>
                <p style={{ margin: '6px 0 0', opacity: 0.85 }}>{f.detail}</p>
                <p style={{ margin: '4px 0 0', opacity: 0.65, fontSize: 13 }}>
                  Evidence: {f.evidence}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
            Approve on <a href="/gates">Gates</a> to seal evidence under{' '}
            <code>.umer/security/</code> (report-only — no auto-fix).
          </p>
        </Card>
      ) : null}

      {perf ? (
        <Card title={`perf.optimize — ${perf.projectName}`}>
          <p style={{ marginTop: 0, opacity: 0.85 }}>{perf.summary}</p>
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            Target: <code>{perf.targetUrl ?? '(not configured)'}</code>
            {perf.forcesGate ? ' · human gate forced (critical/high)' : ''}
          </p>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 0 }}>
            Lab metrics only — not field Core Web Vitals.
          </p>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Findings</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {perf.findings.map((f) => (
              <li
                key={f.id}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  paddingBottom: 12,
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge
                    tone={
                      f.severity === 'critical' || f.severity === 'high' ? 'danger' : 'warning'
                    }
                  >
                    {f.severity}
                  </Badge>
                  <Badge>{f.metric}</Badge>
                  <strong>{f.title}</strong>
                </div>
                <p style={{ margin: '6px 0 0', opacity: 0.85 }}>{f.detail}</p>
                <p style={{ margin: '4px 0 0', opacity: 0.65, fontSize: 13 }}>
                  Evidence: {f.evidence}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
            Approve on <a href="/gates">Gates</a> to seal evidence under{' '}
            <code>.umer/perf/</code> (report-only — no auto-fix).
          </p>
        </Card>
      ) : null}

      {checklist ? (
        <Card title={checklistTitle}>
          <p style={{ marginTop: 0, opacity: 0.85 }}>{checklist.summary}</p>
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            Path: <code>{checklist.absolutePath}</code>
          </p>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Quick wins</h3>
          <ul style={{ marginTop: 0 }}>
            {checklist.quickWins.map((w) => (
              <li key={w} style={{ marginBottom: 4, fontSize: 14 }}>
                {w}
              </li>
            ))}
          </ul>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Checklist</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {checklist.items.map((item) => (
              <li
                key={item.id}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  paddingBottom: 12,
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge tone={item.priority === 'P0' ? 'danger' : item.priority === 'P1' ? 'warning' : 'default'}>
                    {item.priority}
                  </Badge>
                  <Badge>{item.category}</Badge>
                  <strong>{item.title}</strong>
                </div>
                <p style={{ margin: '6px 0 0', opacity: 0.85 }}>{item.check}</p>
                <p style={{ margin: '4px 0 0', opacity: 0.65, fontSize: 13 }}>
                  Verify: {item.howToVerify}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
            Approve on <a href="/gates">Gates</a> before{' '}
            {ux
              ? 'sealing UX findings under .umer/ux/ (report-only — handoff UI fixes to eng)'
              : qa
                ? 'applying the QA evidence package'
                : 'applying fixes'}{' '}
            in the repo.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontFamily: 'inherit',
};
