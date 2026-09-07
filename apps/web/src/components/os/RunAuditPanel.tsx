'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, colors } from '@umer/ui';
import { requestAudit } from '@/lib/control-api';

const AUDIT_TYPES: Array<{ type: 'UX' | 'QA' | 'Security'; label: string; note: string }> = [
  { type: 'UX', label: 'UX', note: 'ux.design reviews the live product for usability issues.' },
  { type: 'QA', label: 'QA', note: 'qa.verify runs the real test/build tooling and reports findings.' },
  { type: 'Security', label: 'Security', note: 'security.review audits the codebase for real vulnerabilities.' },
];

/**
 * The only way to trigger a UX/QA/Security audit today was a hand-written
 * seeding script run outside the dashboard — this is the self-service
 * replacement: seeds a standalone Work Graph node (POST
 * /v1/work-graph/:projectId/audit), which comes out Ready immediately.
 * Turning it into a dispatched Work Package still requires a follow-up
 * "Plan" step (not built here) — this panel is honest about that rather than
 * implying one click runs the audit end-to-end.
 */
export function RunAuditPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<string | null>(null);

  async function runAudit(type: 'UX' | 'QA' | 'Security') {
    setBusy(true);
    setError(null);
    setSeeded(null);
    try {
      const result = await requestAudit(projectId, { type, requestedBy: 'human.ceo' });
      setSeeded(`${result.node.title} queued as ${result.node.status} (${result.node.nodeId}).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Run Audit">
      <p style={{ margin: '0 0 12px', color: colors.muted, fontSize: 13 }}>
        Seeds a standalone audit node onto this project's Work Graph — no Requirements/Product/Architecture
        decomposition needed first. Still requires Planning (below the graph) to actually dispatch it.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {AUDIT_TYPES.map((a) => (
          <Button key={a.type} disabled={busy} onClick={() => void runAudit(a.type)}>
            Run {a.label} Audit
          </Button>
        ))}
      </div>
      {error ? <p style={{ color: colors.danger, margin: '0 0 8px', fontSize: 13 }}>{error}</p> : null}
      {seeded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone="success">Seeded</Badge>
          <span style={{ fontSize: 13, color: colors.text }}>{seeded}</span>
        </div>
      ) : null}
    </Card>
  );
}
