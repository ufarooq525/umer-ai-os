'use client';

import { useEffect, useState } from 'react';
import { Card, colors, spacing } from '@umer/ui';
import { deriveWhileYouWereAway, type AuditRecordWithDetail } from '@/lib/company-derive';
import type { AgentRunRecord } from '@/lib/control-api';

const LAST_VISIT_KEY = 'umer.lastVisitAt';

/**
 * Client-only because "since when" is a per-browser notion (no user session
 * exists yet in this milestone) — the timestamp lives in localStorage, and
 * the counts themselves are computed from the real audit trail and agent
 * runs already fetched server-side, never fabricated.
 */
export function WhileYouWereAway({
  auditRecords,
  agentRuns,
}: {
  auditRecords: AuditRecordWithDetail[];
  agentRuns: AgentRunRecord[];
}) {
  const [result, setResult] = useState<ReturnType<typeof deriveWhileYouWereAway> | null>(null);

  useEffect(() => {
    let since: string;
    try {
      since = window.localStorage.getItem(LAST_VISIT_KEY) ?? new Date(0).toISOString();
      window.localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    } catch {
      since = new Date(0).toISOString();
    }
    setResult(deriveWhileYouWereAway(auditRecords, agentRuns, since));
    // Only compute once per mount — this is a "since your last visit" snapshot, not a live counter.
  }, []);

  if (!result) return null;

  const rows = (
    [
      ['Runs completed', result.agentRunsCompleted],
      ['Decisions made', result.decisionsMade],
      ['Opportunities selected', result.opportunitiesSelected],
      ['Projects created', result.projectsCreated],
      ['Agent failures', result.agentFailures],
    ] as Array<[string, number]>
  ).filter(([, v]) => v > 0);

  return (
    <Card title="While you were away">
      {rows.length > 0 ? (
        <div style={{ display: 'grid', gap: 6, marginBottom: spacing.sm }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: colors.muted }}>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>{result.narrative}</p>
    </Card>
  );
}
