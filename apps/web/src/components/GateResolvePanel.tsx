'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card } from '@umer/ui';
import { resolveGate, type GateWaitRecord } from '@/lib/control-api';

export function GateResolvePanel({ gate }: { gate: GateWaitRecord }) {
  const router = useRouter();
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applySummary, setApplySummary] = useState<string | null>(null);
  const [applyFiles, setApplyFiles] = useState<string[]>([]);

  async function decide(decision: 'Pass' | 'Fail') {
    if (!rationale.trim()) {
      setError('Rationale is required');
      return;
    }
    setBusy(true);
    setError(null);
    setApplySummary(null);
    setApplyFiles([]);
    try {
      const result = await resolveGate(gate.waitId, {
        decision,
        approver: 'human.approver',
        rationale: rationale.trim(),
      });
      if (result.applyResult?.summary) {
        setApplySummary(result.applyResult.summary);
        const fileLines = result.applyResult.files
          .filter((f) => f.action === 'created' || f.action === 'updated')
          .map((f) => `${f.action}: ${f.path}`);
        const checkLines = (result.applyResult.checks ?? [])
          .slice(0, 8)
          .map((c) => `${c.status}: ${c.itemId}`);
        const runLines = (result.applyResult.runs ?? []).map(
          (r) =>
            `${r.skipped ? 'skip' : r.exitCode === 0 ? 'pass' : 'fail'}: ${r.kind}`,
        );
        setApplyFiles([...fileLines, ...runLines, ...checkLines]);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`${gate.gateId} — ${gate.workPackageId}`}>
      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div>
          <Badge tone="warning">Awaiting review</Badge>
        </div>
        <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>
          Stage {gate.stageFrom} → {gate.stageTo} · Exec {gate.execId}
          {gate.artifactId ? ` · Artifact ${gate.artifactId}` : ''}
        </p>
        {gate.gateId.startsWith('gate-seo-') ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            Approve will apply an SEO package into the Laragon project (
            <code>.umer/seo/</code>
            ).
          </p>
        ) : null}
        {gate.gateId.startsWith('gate-security-') ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            Approve will seal a security findings package into the Laragon project (
            <code>.umer/security/&lt;runId&gt;/</code>
            ) — report-only, no auto-fix of product code.
          </p>
        ) : null}
        {gate.gateId.startsWith('gate-perf-') ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            Approve will seal a performance findings package into the Laragon project (
            <code>.umer/perf/&lt;runId&gt;/</code>
            ) — lab Lighthouse evidence only, no auto-fix.
          </p>
        ) : null}
        {gate.gateId.startsWith('gate-qa-') ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            Approve will apply a QA evidence package into the Laragon project (
            <code>.umer/qa/</code>
            ) — scan, TEST_PLAN, and suite runs (PHPUnit / Playwright when available).
          </p>
        ) : null}
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Approval rationale"
          rows={3}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 6,
            border: '1px solid #2d3a4d',
            background: '#0f1419',
            color: '#e8eef4',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        {error ? <p style={{ color: '#ff5c5c', margin: 0, fontSize: 14 }}>{error}</p> : null}
        {applySummary ? (
          <div style={{ fontSize: 14 }}>
            <p style={{ color: '#3ecf8e', margin: '0 0 8px' }}>{applySummary}</p>
            {applyFiles.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {applyFiles.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button disabled={busy} onClick={() => void decide('Pass')}>
          Approve
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void decide('Fail')}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
