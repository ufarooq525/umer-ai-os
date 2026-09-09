import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../version.js';
import { parseContract } from '../common/serialize.js';
import {
  DeploymentContractSchema,
  ProductionStatusSchema,
  IncidentContractSchema,
} from './index.js';

describe('Operations contracts', () => {
  const now = '2026-09-09T00:00:00.000Z';

  it('validates a DeploymentContract', () => {
    const deployment = parseContract(DeploymentContractSchema, {
      id: 'dep-1',
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'deployment',
      deploymentId: 'dep-1',
      projectId: 'proj-1',
      releasePackageId: 'art-rel-1',
      environment: 'production',
      status: 'deployed',
      targetVersion: '1.0.0',
      strategy: 'helm',
      manifestRef: 'infra/k8s/charts/umer-ai-os',
      healthStatus: 'healthy',
      rollbackPlan: {
        strategy: 'helm rollback',
        targetVersion: '0.9.0',
        steps: ['helm rollback umer 1'],
        verificationCriteria: ['GET /health returns 200 on all pods'],
      },
      deployedAt: now,
      verifiedAt: now,
      evidenceRefs: ['evidence/helm-status.json'],
      logs: ['Deployment successful'],
    });

    expect(deployment.deploymentId).toBe('dep-1');
    expect(deployment.environment).toBe('production');
    expect(deployment.healthStatus).toBe('healthy');
  });

  it('validates a ProductionStatus', () => {
    const prod = parseContract(ProductionStatusSchema, {
      id: 'prod-1',
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'production_status',
      projectId: 'proj-1',
      environment: 'production',
      status: 'healthy',
      currentDeploymentId: 'dep-1',
      currentVersion: '1.0.0',
      lastHealthCheckAt: now,
      activeIncidents: 0,
      healthProbeResults: [
        { service: 'control-api', probe: 'GET /health', status: 'pass', responseTimeMs: 12 },
        { service: 'web', probe: 'TCP :3000', status: 'pass', responseTimeMs: 5 },
      ],
    });

    expect(prod.status).toBe('healthy');
    expect(prod.currentVersion).toBe('1.0.0');
    expect(prod.healthProbeResults).toHaveLength(2);
  });

  it('validates an IncidentContract', () => {
    const incident = parseContract(IncidentContractSchema, {
      id: 'inc-1',
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'incident',
      incidentId: 'inc-1',
      projectId: 'proj-1',
      deploymentId: 'dep-1',
      severity: 'P1',
      status: 'open',
      title: 'Health check probe failure after deployment',
      summary: 'Web service probe timed out after 30s',
      triggeredAt: now,
      rollbackTriggered: true,
      mitigationSteps: ['Trigger automated rollback to 0.9.0'],
    });

    expect(incident.severity).toBe('P1');
    expect(incident.rollbackTriggered).toBe(true);
  });
});
