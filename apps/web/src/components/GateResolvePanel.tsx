'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, colors, radii } from '@umer/ui';
import { resolveGate, type GateReview, type GateWaitRecord } from '@/lib/control-api';
import { GateReviewPanel } from '@/components/GateReviewPanel';

/** Fallback copy for gates with no review payload (e.g. the demo seed row). */
const GATE_NOTES: Array<{ prefix: string; note: string }> = [
  {
    prefix: 'gate-seo-',
    note: 'Approve applies an SEO package into the project under .umer/seo/.',
  },
  {
    prefix: 'gate-security-',
    note: 'Approve seals a security findings package under .umer/security/<runId>/ — report only, no auto-fix.',
  },
  {
    prefix: 'gate-perf-',
    note: 'Approve seals lab Lighthouse evidence under .umer/perf/<runId>/ — no auto-fix.',
  },
  {
    prefix: 'gate-qa-',
    note: 'Approve applies a QA evidence package under .umer/qa/ — scan, test plan, and suite runs.',
  },
  {
    prefix: 'gate-ux-',
    note: 'Approve seals a UX findings package under .umer/ux/<runId>/ — no product UI is changed.',
  },
  {
    prefix: 'gate-eng-',
    note: 'Approve writes the reviewed change-set into the project and seals evidence under .umer/eng/<runId>/.',
  },
];

export function GateResolvePanel({
  gate,
  review,
}: {
  gate: GateWaitRecord;
  review?: GateReview | null;
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applySummary, setApplySummary] = useState<string | null>(null);
  const [applyFiles, setApplyFiles] = useState<string[]>([]);

  async function decide(decision: 'Pass' | 'Fail') {
    if (!rationale.trim()) {
      setError('Say why — the decision is recorded in the audit trail.');
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
          (r) => `${r.skipped ? 'skip' : r.exitCode === 0 ? 'pass' : 'fail'}: ${r.kind}`,
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

  const fallbackNote = GATE_NOTES.find((n) => gate.gateId.startsWith(n.prefix))?.note;

  return (
    <div id={gate.waitId}>
      <Card title={`${gate.gateId} — ${gate.workPackageId}`}>
        {review ? (
          <GateReviewPanel review={review} />
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            <Badge tone="warning">Awaiting review</Badge>
            {fallbackNote ? (
              <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{fallbackNote}</p>
            ) : null}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            Stage {gate.stageFrom} → {gate.stageTo} · Exec {gate.execId}
            {gate.artifactId ? ` · Artifact ${gate.artifactId}` : ''}
          </p>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why are you approving or rejecting this?"
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              color: colors.text,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {error ? (
            <p style={{ color: colors.danger, margin: 0, fontSize: 14 }}>{error}</p>
          ) : null}
          {applySummary ? (
            <div style={{ fontSize: 14 }}>
              <p style={{ color: colors.success, margin: '0 0 8px' }}>{applySummary}</p>
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
            {review?.kind === 'code' ? 'Approve & apply' : 'Approve'}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void decide('Fail')}>
            Reject
          </Button>
        </div>
      </Card>
    </div>
  );
}
