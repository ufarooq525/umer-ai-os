import { colors, radii } from '@umer/ui';
import {
  getWatchdogFindings,
  getWatchdogRuns,
  getWatchdogSchedules,
  getProjects,
} from '@/lib/control-api';
import { WatchdogsConsole } from './WatchdogsConsole';

export const dynamic = 'force-dynamic';

export default async function WatchdogsPage() {
  const [findings, runs, schedules, projects] = await Promise.all([
    getWatchdogFindings(),
    getWatchdogRuns({ limit: 50 }),
    getWatchdogSchedules(),
    getProjects(),
  ]);

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: radii.sm,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            RFC-007 Autonomous Subsystem
          </span>
          <span style={{ color: colors.muted, fontSize: 13 }}>• Observation &amp; Regression Guard</span>
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
          Autonomous Watchdogs Console
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 780, lineHeight: 1.6 }}>
          Continuous background observation for Security vulnerabilities, Dependency drift, QA regressions, and Architecture compliance across all registered projects. Watchdogs detect, grade, and fingerprint findings without silent auto-remediation.
        </p>
      </header>

      <WatchdogsConsole
        initialFindings={findings}
        initialRuns={runs}
        initialSchedules={schedules}
        projects={projects.projects ?? []}
      />
    </div>
  );
}
