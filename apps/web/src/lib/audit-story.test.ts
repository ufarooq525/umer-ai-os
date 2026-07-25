import { describe, expect, it } from 'vitest';
import {
  describeAuditRecord,
  isDemoAuditRecord,
  partitionAuditRecords,
} from './audit-story.js';

describe('audit story', () => {
  it('explains a perf gate flow for umer-portfolio in plain language', () => {
    const requested = describeAuditRecord({
      action: 'control.approval.requested',
      actor: 'perf.optimize',
      resourceType: 'project',
      resourceId: 'umer-portfolio',
      outcome: 'success',
      occurredAt: '2026-07-25T19:09:25.865Z',
      correlationId: 'corr-intake-1',
    });
    expect(requested.title).toBe('Waiting for your approval at a gate');
    expect(requested.projectLabel).toBe('umer-portfolio');
    expect(requested.what).toContain('umer-portfolio');
    expect(requested.isDemo).toBe(false);

    const decided = describeAuditRecord({
      action: 'gate.decide',
      actor: 'human.approver',
      resourceType: 'approval',
      resourceId: 'gate-perf-umer-portfolio',
      outcome: 'success',
      occurredAt: '2026-07-25T19:09:58.434Z',
    });
    expect(decided.what).toContain('approved');
    expect(decided.projectLabel).toBe('umer-portfolio');
  });

  it('labels ux.design as UX Design', () => {
    const story = describeAuditRecord({
      action: 'control.approval.requested',
      actor: 'ux.design',
      resourceType: 'project',
      resourceId: 'umer-portfolio',
      outcome: 'success',
      occurredAt: '2026-07-26T00:00:00.000Z',
      correlationId: 'corr-intake-ux-1',
    });
    expect(story.who).toBe('UX Design');
    expect(story.what).toContain('umer-portfolio');
  });

  it('flags demo seed rows so they do not look like user work', () => {
    const seed = {
      action: 'agent.run.completed',
      actor: 'eng.app-delivery',
      resourceType: 'work_package',
      resourceId: 'wp-e2e-1',
      outcome: 'success',
      correlationId: 'corr-e2e-flow',
      occurredAt: '2026-07-25T19:06:48.150Z',
    };
    expect(isDemoAuditRecord(seed)).toBe(true);
    const { real, demo } = partitionAuditRecords([
      seed,
      {
        action: 'artifact.sealed',
        actor: 'perf.optimize',
        resourceType: 'project',
        resourceId: 'umer-portfolio',
        outcome: 'success',
        occurredAt: '2026-07-25T19:09:58.448Z',
      },
    ]);
    expect(demo).toHaveLength(1);
    expect(real).toHaveLength(1);
    expect(real[0]?.resourceId).toBe('umer-portfolio');
  });
});
