import { describe, expect, it } from 'vitest';
import { ControlPlaneError } from './errors.js';
import { createControlPlaneStack } from './factory.js';

describe('control-plane', () => {
  it('requests gate review and lists pending', async () => {
    const { service } = createControlPlaneStack();
    const wait = await service.requestGateReview(
      {
        gateId: 'gate-dev-qa',
        execId: 'EXEC-001',
        workPackageId: 'wp-e2e-1',
        artifactId: 'art-wp-e2e-1-1',
        stageFrom: 'Development',
        stageTo: 'QA',
      },
      'corr-gate',
    );
    expect(wait.status).toBe('waiting');
    const pending = await service.listPending();
    expect(pending).toHaveLength(1);
  });

  it('resolves gate with pass decision', async () => {
    const { service } = createControlPlaneStack();
    const wait = await service.requestGateReview(
      {
        gateId: 'gate-dev-qa',
        execId: 'EXEC-001',
        workPackageId: 'wp-e2e-1',
        stageFrom: 'Development',
        stageTo: 'QA',
        requiredApprovers: ['human.approver'],
      },
      'corr-pass',
    );
    const result = await service.resolveGate(
      wait.waitId,
      { decision: 'Pass', approver: 'human.approver', rationale: 'Evidence verified' },
      'corr-pass',
    );
    expect(result.record.status).toBe('passed');
    expect(result.approval.result).toBe('Pass');
    expect(await service.listPending()).toHaveLength(0);
  });

  it('rejects unauthorized approver', async () => {
    const { service } = createControlPlaneStack();
    const wait = await service.requestGateReview(
      {
        gateId: 'gate-dev-qa',
        execId: 'EXEC-001',
        workPackageId: 'wp-e2e-1',
        stageFrom: 'Development',
        stageTo: 'QA',
        requiredApprovers: ['human.approver'],
      },
      'corr-deny',
    );
    await expect(
      service.resolveGate(
        wait.waitId,
        { decision: 'Pass', approver: 'unknown', rationale: 'nope' },
        'corr-deny',
      ),
    ).rejects.toThrow(ControlPlaneError);
  });

  it('returns dashboard summary', async () => {
    const { service } = createControlPlaneStack();
    await service.requestGateReview(
      {
        gateId: 'gate-dev-qa',
        execId: 'EXEC-001',
        workPackageId: 'wp-e2e-1',
        stageFrom: 'Development',
        stageTo: 'QA',
      },
      'corr-dash',
    );
    const summary = await service.dashboard();
    expect(summary.pendingGates).toBe(1);
  });
});
