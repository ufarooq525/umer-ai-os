import { describe, expect, it } from 'vitest';
import {
  FindingIdSchema,
  ProjectIdSchema,
  WatchRunIdSchema,
  WatchScheduleIdSchema,
} from '../common/ids.js';
import {
  WatchdogFindingSchema,
  WatchRunSchema,
  WatchdogScheduleSchema,
  WatchdogIdSchema,
  WatchdogCadenceSchema,
  FindingSeverityTierSchema,
  type WatchdogFinding,
  type WatchRun,
  type WatchdogSchedule,
} from './index.js';

describe('Watchdog Contracts', () => {
  it('validates watchdog IDs and cadences', () => {
    expect(WatchdogIdSchema.parse('security.watchdog')).toBe('security.watchdog');
    expect(WatchdogIdSchema.parse('deps.watchdog')).toBe('deps.watchdog');
    expect(WatchdogIdSchema.parse('qa.watchdog')).toBe('qa.watchdog');
    expect(WatchdogIdSchema.parse('arch.watchdog')).toBe('arch.watchdog');
    expect(WatchdogCadenceSchema.parse('hourly')).toBe('hourly');
    expect(WatchdogCadenceSchema.parse('nightly')).toBe('nightly');
    expect(FindingSeverityTierSchema.parse('critical')).toBe('critical');
  });

  it('validates a valid WatchdogFinding contract', () => {
    const raw: WatchdogFinding = {
      findingId: FindingIdSchema.parse('wdfind-001'),
      fingerprint: 'fp-sec-deps-cve123',
      watchdogId: 'security.watchdog',
      projectId: ProjectIdSchema.parse('proj-ecommerce'),
      title: 'High severity CVE in dependency lodash',
      summary: 'Prototype pollution vulnerability detected in lodash v4.17.15',
      category: 'dependency_vulnerability',
      severity: {
        tier: 'high',
        riskScore: 16,
        confidence: 'certain',
        sticky: true,
      },
      status: 'open',
      escalationStage: 'S0',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      remediation: 'Upgrade lodash to >= 4.17.21',
      evidenceArtifactIds: [],
      impactModules: ['auth', 'user-profile'],
      path: 'package.json',
      evidence: 'lodash@4.17.15 detected via audit scan',
      details: { cve: 'CVE-2019-10744' },
    };

    const parsed = WatchdogFindingSchema.parse(raw);
    expect(parsed.findingId).toBe('wdfind-001');
    expect(parsed.severity.tier).toBe('high');
    expect(parsed.status).toBe('open');
  });

  it('validates a valid WatchRun contract', () => {
    const raw: WatchRun = {
      runId: WatchRunIdSchema.parse('wdrun-001'),
      watchdogId: 'deps.watchdog',
      cadence: 'hourly',
      projectId: ProjectIdSchema.parse('proj-ecommerce'),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      outcome: 'healthy',
      findings: [],
      findingCount: 0,
      summary: 'Dependency watchdog ran clean; all lockfiles synchronized.',
      metadata: { checkedLockfiles: 2 },
    };

    const parsed = WatchRunSchema.parse(raw);
    expect(parsed.runId).toBe('wdrun-001');
    expect(parsed.outcome).toBe('healthy');
  });

  it('validates a valid WatchdogSchedule contract', () => {
    const raw: WatchdogSchedule = {
      id: WatchScheduleIdSchema.parse('wdsched-001'),
      watchdogId: 'qa.watchdog',
      projectId: ProjectIdSchema.parse('proj-ecommerce'),
      cadence: 'nightly',
      intervalMs: 86400000,
      cron: '0 2 * * *',
      paused: false,
      lastRunAt: new Date().toISOString(),
      options: { runFlakyCheck: true },
    };

    const parsed = WatchdogScheduleSchema.parse(raw);
    expect(parsed.id).toBe('wdsched-001');
    expect(parsed.paused).toBe(false);
  });
});
