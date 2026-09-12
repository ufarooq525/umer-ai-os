'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import type {
  WatchdogFinding,
  WatchRun,
  WatchdogSchedule,
  ProjectRecord,
} from '@/lib/control-api';
import {
  ackWatchdogFinding,
  clearWatchdogFinding,
  runWatchdogNow,
  patchWatchdogSchedule,
} from '@/lib/control-api';

type Props = {
  initialFindings: WatchdogFinding[];
  initialRuns: WatchRun[];
  initialSchedules: WatchdogSchedule[];
  projects: ProjectRecord[];
};

export function WatchdogsConsole({
  initialFindings,
  initialRuns,
  initialSchedules,
  projects,
}: Props) {
  const [findings, setFindings] = useState<WatchdogFinding[]>(initialFindings);
  const [runs, setRuns] = useState<WatchRun[]>(initialRuns);
  const [schedules, setSchedules] = useState<WatchdogSchedule[]>(initialSchedules);

  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'high' | 'open' | 'cleared'>('open');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.projectId ?? '');
  const [selectedWatchdogId, setSelectedWatchdogId] = useState<string>('security.watchdog');
  const [running, setRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const activeProjects = projects.filter((p) => p.status === 'active');

  const openFindings = findings.filter((f) => f.status !== 'cleared');
  const criticalFindings = openFindings.filter((f) => f.severity.tier === 'critical');
  const highFindings = openFindings.filter((f) => f.severity.tier === 'high');

  const filteredFindings = findings.filter((f) => {
    if (activeTab === 'open') return f.status !== 'cleared';
    if (activeTab === 'critical') return f.status !== 'cleared' && f.severity.tier === 'critical';
    if (activeTab === 'high') return f.status !== 'cleared' && f.severity.tier === 'high';
    if (activeTab === 'cleared') return f.status === 'cleared';
    return true;
  });

  const handleRunNow = async () => {
    if (!selectedProjectId || !selectedWatchdogId) return;
    setRunning(true);
    setActionMessage(null);
    try {
      const run = await runWatchdogNow(selectedProjectId, selectedWatchdogId);
      if (run) {
        setRuns((prev) => [run, ...prev]);
        if (run.findings && run.findings.length > 0) {
          setFindings((prev) => {
            const next = [...prev];
            for (const f of run.findings) {
              const idx = next.findIndex((item) => item.fingerprint === f.fingerprint && item.status !== 'cleared');
              if (idx >= 0) {
                next[idx] = f;
              } else {
                next.unshift(f);
              }
            }
            return next;
          });
        }
        setActionMessage(`Executed ${selectedWatchdogId} on ${selectedProjectId}: ${run.summary}`);
      } else {
        setActionMessage('Watchdog run failed or server returned empty result.');
      }
    } catch (err) {
      setActionMessage(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const handleAck = async (findingId: string) => {
    const updated = await ackWatchdogFinding(findingId);
    if (updated) {
      setFindings((prev) => prev.map((f) => (f.findingId === findingId ? updated : f)));
    }
  };

  const handleClear = async (findingId: string) => {
    const reason = window.prompt('Resolution or exception rationale:', 'Verified safe by operator');
    if (!reason) return;
    const updated = await clearWatchdogFinding(findingId, reason);
    if (updated) {
      setFindings((prev) => prev.map((f) => (f.findingId === findingId ? updated : f)));
    }
  };

  const handleToggleSchedule = async (scheduleId: string, currentPaused: boolean) => {
    const updated = await patchWatchdogSchedule(scheduleId, { paused: !currentPaused });
    if (updated) {
      setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? updated : s)));
    }
  };

  const severityBadge = (tier: string) => {
    switch (tier) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' };
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.35)' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.35)' };
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* 1. System Posture Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            Security Watchdog
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: criticalFindings.length > 0 ? '#ef4444' : '#10b981' }}>
            {criticalFindings.length > 0 ? `${criticalFindings.length} Critical Alert` : 'Shield Active'}
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Dependency CVEs, leaked secrets, and route authorization checks
          </div>
        </Card>

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            Dependency Watchdog
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: colors.accent }}>
            {openFindings.filter((f) => f.watchdogId === 'deps.watchdog').length} Tracked
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Lockfile parity, unpinned wildcards, and supply-chain hygiene
          </div>
        </Card>

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            QA Regression Watchdog
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: colors.text }}>
            {openFindings.filter((f) => f.watchdogId === 'qa.watchdog').length} Debt
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Test suite presence, skipped test debt, and test run failures
          </div>
        </Card>

        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            Architecture Watchdog
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: colors.text }}>
            {openFindings.filter((f) => f.watchdogId === 'arch.watchdog').length} Drift
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Module boundaries, cross-layer cycles, and contract compliance
          </div>
        </Card>
      </div>

      {/* 2. On-Demand Watch Trigger Bar */}
      <Card style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Dispatch On-Demand Observation</div>
            <div style={{ fontSize: 12, color: colors.muted }}>Trigger an instantaneous observation probe without awaiting the scheduled cadence</div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: radii.md,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: colors.text,
                fontFamily: fonts.sans,
                fontSize: 13,
              }}
            >
              {activeProjects.map((p) => (
                <option key={p.projectId} value={p.projectId} style={{ background: '#18181b', color: '#fff' }}>
                  {p.name} ({p.projectId})
                </option>
              ))}
            </select>

            <select
              value={selectedWatchdogId}
              onChange={(e) => setSelectedWatchdogId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: radii.md,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: colors.text,
                fontFamily: fonts.sans,
                fontSize: 13,
              }}
            >
              <option value="security.watchdog" style={{ background: '#18181b', color: '#fff' }}>security.watchdog</option>
              <option value="deps.watchdog" style={{ background: '#18181b', color: '#fff' }}>deps.watchdog</option>
              <option value="qa.watchdog" style={{ background: '#18181b', color: '#fff' }}>qa.watchdog</option>
              <option value="arch.watchdog" style={{ background: '#18181b', color: '#fff' }}>arch.watchdog</option>
            </select>

            <button
              type="button"
              onClick={handleRunNow}
              disabled={running}
              style={{
                padding: '8px 16px',
                borderRadius: radii.md,
                background: running ? 'rgba(255,255,255,0.1)' : colors.accent,
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? 'Observing…' : 'Run Watchdog Now'}
            </button>
          </div>
        </div>

        {actionMessage && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: radii.sm, background: 'rgba(255,255,255,0.04)', color: colors.accent, fontSize: 12 }}>
            {actionMessage}
          </div>
        )}
      </Card>

      {/* 3. Findings Section */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>Watchdog Findings</h2>
            <span style={{ fontSize: 12, color: colors.muted, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 10 }}>
              {openFindings.length} open
            </span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['open', 'critical', 'high', 'all', 'cleared'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: activeTab === tab ? 650 : 500,
                  border: '1px solid',
                  borderColor: activeTab === tab ? colors.accent : 'rgba(255,255,255,0.1)',
                  background: activeTab === tab ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: activeTab === tab ? '#fff' : colors.muted,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
                {tab === 'critical' && criticalFindings.length > 0 ? ` (${criticalFindings.length})` : ''}
                {tab === 'high' && highFindings.length > 0 ? ` (${highFindings.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: colors.muted }}>No findings match the current filter.</div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredFindings.map((f) => {
              const badge = severityBadge(f.severity.tier);
              const isCleared = f.status === 'cleared';
              return (
                <div key={f.findingId} id={f.findingId}>
                  <Card
                    style={{
                      padding: 16,
                      borderLeft: `4px solid ${badge.text}`,
                      opacity: isCleared ? 0.6 : 1,
                    }}
                  >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: radii.sm,
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {f.severity.tier}
                        </span>

                        <span style={{ fontSize: 11, color: colors.muted, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: radii.sm }}>
                          {f.watchdogId}
                        </span>

                        <Link
                          href={`/company/projects/${f.projectId}`}
                          style={{ fontSize: 11, color: colors.accent, textDecoration: 'none' }}
                        >
                          Project: {f.projectId}
                        </Link>

                        <Link
                          href={`/company/graph?q=${encodeURIComponent(f.projectId)}`}
                          style={{ fontSize: 11, color: colors.muted, textDecoration: 'none' }}
                        >
                          (View on Graph)
                        </Link>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 650, color: colors.text }}>
                        {f.title}
                      </div>

                      <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                        {f.summary}
                      </div>

                      {f.path && (
                        <div style={{ fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                          Path: {f.path}
                        </div>
                      )}

                      {f.evidence && (
                        <div style={{ fontSize: 11, fontFamily: fonts.mono, background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: radii.sm, color: colors.muted }}>
                          Evidence: {f.evidence}
                        </div>
                      )}

                      {f.remediation && (
                        <div style={{ fontSize: 12, color: colors.text, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 10px', borderRadius: radii.sm, marginTop: 4 }}>
                          <strong>Remediation:</strong> {f.remediation}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: colors.muted, marginTop: 6 }}>
                        <span>Fingerprint: <code>{f.fingerprint.slice(0, 10)}…</code></span>
                        <span>Last observed: {new Date(f.lastSeenAt).toLocaleString()}</span>
                        {f.status === 'acked' && <span style={{ color: colors.accent }}>Acknowledged by {f.ackedBy ?? 'operator'}</span>}
                        {isCleared && <span style={{ color: '#10b981' }}>Cleared ({f.clearanceReason ?? 'resolved'})</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                      {!isCleared && (
                        <>
                          {f.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => handleAck(f.findingId)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: radii.md,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: colors.text,
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              Acknowledge
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleClear(f.findingId)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: radii.md,
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#10b981',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Clear Finding
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Autonomous Schedules */}
      <Card style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 12px' }}>
          Autonomous Watchdog Schedules ({schedules.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: radii.md,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{s.watchdogId}</div>
                <div style={{ fontSize: 11, color: colors.muted }}>
                  Project: {s.projectId} • {s.cadence} {s.cron ? `(${s.cron})` : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleSchedule(s.id, s.paused)}
                style={{
                  padding: '4px 10px',
                  borderRadius: radii.sm,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: s.paused ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: s.paused ? '#ef4444' : '#10b981',
                  borderColor: s.paused ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                }}
              >
                {s.paused ? 'Paused' : 'Active'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Recent Watch Runs Log */}
      <Card style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 12px' }}>
          Recent Watch Runs ({runs.length})
        </h3>
        {runs.length === 0 ? (
          <div style={{ fontSize: 13, color: colors.muted }}>No runs logged yet. Execute an on-demand watch above to populate.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {runs.slice(0, 15).map((r) => (
              <div
                key={r.runId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: radii.sm,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: r.outcome === 'healthy' ? '#10b981' : '#f59e0b',
                    }}
                  />
                  <span style={{ fontWeight: 600, color: colors.text }}>{r.watchdogId}</span>
                  <span style={{ color: colors.muted }}>on {r.projectId}</span>
                  <span style={{ color: colors.muted, fontSize: 11 }}>({r.cadence})</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: r.findingCount > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                    {r.findingCount} finding(s)
                  </span>
                  <span style={{ color: colors.muted, fontSize: 11 }}>
                    {new Date(r.finishedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
