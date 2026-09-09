import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeploymentEngine } from './deployment-engine.js';

describe('DeploymentEngine', () => {
  it('returns truthful offline status when no deployment has taken place', () => {
    const engine = new DeploymentEngine();
    const status = engine.getProductionStatus('proj-unassigned', 'production');
    expect(status.status).toBe('offline');
    expect(status.currentVersion).toBeUndefined();
    expect(status.activeIncidents).toBe(0);
    expect(status.healthProbeResults).toHaveLength(0);
  });

  it('refuses to claim deployment health when no real probe runner is configured', async () => {
    const engine = new DeploymentEngine();
    const deployment = await engine.prepareRelease({
      projectId: 'proj-no-probe',
      releasePackageId: 'art-rel-no-probe',
      targetVersion: '1.0.0',
      environment: 'production',
      strategy: 'helm',
      rollbackPlan: {
        strategy: 'helm rollback',
        targetVersion: '0.9.0',
        steps: ['helm rollback umer 1'],
        verificationCriteria: ['GET /health returns 200'],
      },
    });
    await engine.approveDeployment(deployment.deploymentId, 'human.ceo');
    await expect(engine.executeDeployment({ deploymentId: deployment.deploymentId })).rejects.toThrow(/real health probe runner/);
    expect(engine.getDeployment(deployment.deploymentId)?.status).toBe('approved');
  });

  it('runs full successful release preparation, approval, deployment, and health verification', async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), 'umer-dep-evidence-'));
    const engine = new DeploymentEngine({
      evidenceRoot: evidenceDir,
      probeRunner: async (probe) => ({
        status: 'pass',
        responseTimeMs: 15,
        message: `${probe.service} is reachable and responding OK`,
      }),
    });

    const rollbackPlan = {
      strategy: 'helm rollback',
      targetVersion: '0.9.0',
      steps: ['helm rollback umer 1', 'verify pods running'],
      verificationCriteria: ['GET /health returns 200 on all endpoints'],
    };

    const deployment = await engine.prepareRelease({
      projectId: 'proj-demo',
      releasePackageId: 'art-rel-1',
      targetVersion: '1.0.0',
      environment: 'production',
      strategy: 'helm',
      manifestRef: 'infra/k8s/charts/umer-ai-os',
      rollbackPlan,
    });
    expect(deployment.status).toBe('pending_approval');
    expect(deployment.targetVersion).toBe('1.0.0');

    await expect(engine.executeDeployment({ deploymentId: deployment.deploymentId })).rejects.toThrow(/must be approved/);

    const approved = await engine.approveDeployment(deployment.deploymentId, 'human.ceo');
    expect(approved.status).toBe('approved');

    const outcome = await engine.executeDeployment({ deploymentId: deployment.deploymentId, executedBy: 'operator-ci' });
    expect(outcome.deployment.status).toBe('deployed');
    expect(outcome.deployment.healthStatus).toBe('healthy');
    expect(outcome.deployment.deployedAt).toBeDefined();
    expect(outcome.deployment.verifiedAt).toBeDefined();
    expect(outcome.healthResults).toHaveLength(4);
    expect(outcome.healthResults.every((h) => h.status === 'pass')).toBe(true);

    const prodStatus = engine.getProductionStatus('proj-demo', 'production');
    expect(prodStatus.status).toBe('healthy');
    expect(prodStatus.currentVersion).toBe('1.0.0');
    expect(prodStatus.currentDeploymentId).toBe(deployment.deploymentId);

    expect(outcome.deployment.evidenceRefs.length).toBeGreaterThan(0);
    const evidenceContent = await readFile(outcome.deployment.evidenceRefs[0]!, 'utf8');
    const parsedEvidence = JSON.parse(evidenceContent) as { deploymentId: string; healthResults: unknown[] };
    expect(parsedEvidence.deploymentId).toBe(deployment.deploymentId);
    expect(parsedEvidence.healthResults).toHaveLength(4);
  });

  it('fails deployment, logs incident, and executes automatic rollback when health check fails', async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), 'umer-dep-rollback-'));
    const engine = new DeploymentEngine({
      evidenceRoot: evidenceDir,
      probeRunner: async (probe) => {
        if (probe.service === 'web') return { status: 'fail', message: 'Connection refused on port 3000' };
        return { status: 'pass', responseTimeMs: 10 };
      },
      rollbackRunner: async () => ({ status: 'success', message: 'Rollback command executed by test adapter' }),
    });

    const deployment = await engine.prepareRelease({
      projectId: 'proj-fail',
      releasePackageId: 'art-rel-2',
      targetVersion: '1.1.0',
      environment: 'production',
      strategy: 'helm',
      rollbackPlan: {
        strategy: 'helm rollback',
        targetVersion: '0.9.0',
        steps: ['helm rollback umer 1'],
        verificationCriteria: ['GET /health returns 200 on all endpoints'],
      },
    });
    await engine.approveDeployment(deployment.deploymentId, 'human.ceo');

    const outcome = await engine.executeDeployment({
      deploymentId: deployment.deploymentId,
      autoRollbackOnFailure: true,
      executedBy: 'watchdog',
    });

    expect(outcome.deployment.status).toBe('rolled_back');
    expect(outcome.deployment.healthStatus).toBe('degraded');
    expect(outcome.deployment.rolledBackAt).toBeDefined();

    const incidents = engine.listIncidents('proj-fail');
    expect(incidents.length).toBeGreaterThanOrEqual(1);
    const incident = incidents[incidents.length - 1]!;
    expect(incident.severity).toBe('P1');
    expect(incident.rollbackTriggered).toBe(true);

    const prodStatus = engine.getProductionStatus('proj-fail', 'production');
    expect(prodStatus.status).toBe('degraded');
    expect(prodStatus.currentVersion).toBe('0.9.0');
  });

  it('supports explicit rollback only when an executable rollback adapter is configured', async () => {
    const engine = new DeploymentEngine({
      probeRunner: async () => ({ status: 'pass', responseTimeMs: 10 }),
      rollbackRunner: async ({ steps }) => ({ status: steps.length > 0 ? 'success' : 'failed' }),
    });
    const rollbackPlan = {
      strategy: 'docker-compose revert',
      targetVersion: '1.0.0',
      steps: ['docker-compose -f infra/docker/docker-compose.yml up -d --build'],
      verificationCriteria: ['all containers running'],
    };

    const deployment = await engine.prepareRelease({
      projectId: 'proj-manual-rb',
      releasePackageId: 'art-rel-3',
      targetVersion: '1.0.1',
      environment: 'staging',
      strategy: 'docker_compose',
      rollbackPlan,
    });
    await engine.approveDeployment(deployment.deploymentId, 'human.ceo');
    await engine.executeDeployment({ deploymentId: deployment.deploymentId });

    const rollbackOutcome = await engine.executeRollback({
      deploymentId: deployment.deploymentId,
      reason: 'Memory leak detected in background workers',
      triggeredBy: 'sre-lead',
    });

    expect(rollbackOutcome.deployment.status).toBe('rolled_back');
    expect(rollbackOutcome.incident.severity).toBe('P1');
    expect(rollbackOutcome.incident.summary).toContain('Memory leak');
    expect(engine.listIncidents('proj-manual-rb')).toHaveLength(1);

    const resolved = await engine.resolveIncident(engine.listIncidents('proj-manual-rb')[0]!.incidentId, 'Hotfix applied and verified');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
  });
});
