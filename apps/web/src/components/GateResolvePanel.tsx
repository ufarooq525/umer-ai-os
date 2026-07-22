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

  async function decide(decision: 'Pass' | 'Fail') {
    if (!rationale.trim()) {
      setError('Rationale is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resolveGate(gate.waitId, {
        decision,
        approver: 'human.approver',
        rationale: rationale.trim(),
      });
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
