import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  parseContract,
  SCHEMA_VERSION,
  DeploymentContractSchema,
  ProductionStatusSchema,
  IncidentContractSchema,
  type DeploymentContract,
  type ProductionStatus,
  type IncidentContract,
  type Environment,
  type DeploymentStrategy,
  type RollbackPlan,
  type HealthProbeResult,
  type IncidentSeverity,
} from '@umer/contracts';

export type HealthProbeCheck = (probe: {
  service: string;
  probe: string;
  targetUrlOrPort?: string;
}) => Promise<{ status: 'pass' | 'fail' | 'warn'; responseTimeMs?: number; message?: string }>;

export type RollbackRunner = (input: {
  projectId: string;
  environment: Environment;
  strategy: DeploymentStrategy;
  targetVersion: string;
  steps: string[];
}) => Promise<{ status: 'success' | 'failed'; message?: string }>;

export type DeploymentEngineOptions = {
  evidenceRoot?: string;
  probeRunner?: HealthProbeCheck;
  rollbackRunner?: RollbackRunner;
};

export class DeploymentEngine {
  private readonly deploymentsById = new Map<string, DeploymentContract>();
  private readonly productionStatusByProjectEnv = new Map<string, ProductionStatus>();
  private readonly incidentsById = new Map<string, IncidentContract>();
  private readonly evidenceRoot?: string;
  private readonly probeRunner?: HealthProbeCheck;
  private readonly rollbackRunner?: RollbackRunner;

  constructor(options: DeploymentEngineOptions = {}) {
    this.evidenceRoot = options.evidenceRoot;
    this.probeRunner = options.probeRunner;
    this.rollbackRunner = options.rollbackRunner;
  }

  private projectEnvKey(projectId: string, environment: Environment): string {
    return `${projectId}:${environment}`;
  }

  async prepareRelease(input: {
    projectId: string;
    releasePackageId: string;
    targetVersion: string;
    environment?: Environment;
    strategy?: DeploymentStrategy;
    manifestRef?: string;
    rollbackPlan: RollbackPlan;
  }): Promise<DeploymentContract> {
    const deploymentId = `dep-${randomUUID()}`;
    const now = new Date().toISOString();
    const environment = input.environment ?? 'production';
    const strategy = input.strategy ?? 'helm';
    const manifestRef = input.manifestRef ??
      (strategy === 'helm' ? 'infra/k8s/charts/umer-ai-os' : 'infra/docker/docker-compose.yml');

    const deployment = parseContract(DeploymentContractSchema, {
      id: deploymentId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'deployment',
      deploymentId,
      projectId: input.projectId,
      releasePackageId: input.releasePackageId,
      environment,
      status: 'pending_approval',
      targetVersion: input.targetVersion,
      strategy,
      manifestRef,
      healthStatus: 'unknown',
      rollbackPlan: input.rollbackPlan,
      evidenceRefs: [],
      logs: [`Release prepared for ${input.projectId} version ${input.targetVersion} [${environment}]`],
    });
    this.deploymentsById.set(deploymentId, deployment);
    return deployment;
  }

  async approveDeployment(deploymentId: string, approver: string): Promise<DeploymentContract> {
    const deployment = this.deploymentsById.get(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);
    if (deployment.status !== 'pending_approval') {
      throw new Error(`Deployment ${deploymentId} is in status ${deployment.status}, cannot approve`);
    }
    const now = new Date().toISOString();
    const updated = parseContract(DeploymentContractSchema, {
      ...deployment,
      updatedAt: now,
      status: 'approved',
      logs: [...deployment.logs, `Approved for deployment by ${approver} at ${now}`],
    });
    this.deploymentsById.set(deploymentId, updated);
    return updated;
  }

  async executeDeployment(input: {
    deploymentId: string;
    autoRollbackOnFailure?: boolean;
    executedBy?: string;
  }): Promise<{ deployment: DeploymentContract; productionStatus: ProductionStatus; healthResults: HealthProbeResult[] }> {
    const deployment = this.deploymentsById.get(input.deploymentId);
    if (!deployment) throw new Error(`Deployment ${input.deploymentId} not found`);
    if (deployment.status !== 'approved') {
      throw new Error(`Deployment ${input.deploymentId} must be approved before execution (current: ${deployment.status})`);
    }
    if (!this.probeRunner) {
      throw new Error('Deployment execution requires a real health probe runner; refusing to claim production health without verification');
    }

    const startTime = new Date().toISOString();
    const logs = [...deployment.logs, `Execution started by ${input.executedBy ?? 'system'} at ${startTime}`];
    const probesToRun = [
      { service: 'control-api', probe: 'GET /health', targetUrlOrPort: ':4000/health' },
      { service: 'api-gateway', probe: 'GET /health', targetUrlOrPort: ':4080/health' },
      { service: 'workers', probe: 'GET /health', targetUrlOrPort: ':8080/health' },
      { service: 'web', probe: 'TCP :3000', targetUrlOrPort: ':3000' },
    ];
    const healthResults: HealthProbeResult[] = [];
    let allPassed = true;
    for (const probe of probesToRun) {
      const res = await this.probeRunner(probe);
      healthResults.push({ service: probe.service, probe: probe.probe, status: res.status, responseTimeMs: res.responseTimeMs, message: res.message });
      if (res.status !== 'pass') allPassed = false;
    }

    const now = new Date().toISOString();
    const evidenceRefs: string[] = [];
    if (this.evidenceRoot) {
      const dir = join(this.evidenceRoot, deployment.projectId, 'deployments', deployment.deploymentId);
      try {
        await mkdir(dir, { recursive: true });
        const evidencePath = join(dir, 'health-verification.json');
        await writeFile(evidencePath, JSON.stringify({ deploymentId: deployment.deploymentId, healthResults, timestamp: now }, null, 2), 'utf8');
        evidenceRefs.push(evidencePath);
      } catch (error) {
        allPassed = false;
        healthResults.push({ service: 'deployment-evidence', probe: 'write health-verification.json', status: 'fail', message: `Unable to persist deployment evidence: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (allPassed) {
      logs.push(`All ${healthResults.length} health probes passed at ${now}`);
      const updatedDeployment = parseContract(DeploymentContractSchema, {
        ...deployment,
        updatedAt: now,
        status: 'deployed',
        healthStatus: 'healthy',
        deployedAt: now,
        verifiedAt: now,
        evidenceRefs: [...deployment.evidenceRefs, ...evidenceRefs],
        logs,
      });
      this.deploymentsById.set(deployment.deploymentId, updatedDeployment);
      const prodStatus = parseContract(ProductionStatusSchema, {
        id: `prod-${deployment.projectId}-${deployment.environment}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        metadata: { labels: {}, annotations: {} },
        kind: 'production_status',
        projectId: deployment.projectId,
        environment: deployment.environment,
        status: 'healthy',
        currentDeploymentId: deployment.deploymentId,
        currentVersion: deployment.targetVersion,
        lastHealthCheckAt: now,
        activeIncidents: 0,
        healthProbeResults: healthResults,
      });
      this.productionStatusByProjectEnv.set(this.projectEnvKey(deployment.projectId, deployment.environment), prodStatus);
      return { deployment: updatedDeployment, productionStatus: prodStatus, healthResults };
    }

    logs.push(`Health verification failed at ${now}: ${healthResults.filter((h) => h.status !== 'pass').map((h) => h.service).join(', ')}`);
    const failedDeployment = parseContract(DeploymentContractSchema, {
      ...deployment,
      updatedAt: now,
      status: 'failed',
      healthStatus: 'unhealthy',
      verifiedAt: now,
      evidenceRefs: [...deployment.evidenceRefs, ...evidenceRefs],
      logs,
    });
    this.deploymentsById.set(deployment.deploymentId, failedDeployment);

    const incident = await this.recordIncident({
      projectId: deployment.projectId,
      deploymentId: deployment.deploymentId,
      severity: 'P1',
      title: `Deployment health verification failure for ${deployment.projectId} [${deployment.targetVersion}]`,
      summary: `Health verification failed: ${healthResults.filter((h) => h.status !== 'pass').map((h) => h.service).join(', ')}`,
      rollbackTriggered: false,
      mitigationSteps: input.autoRollbackOnFailure ? ['Rollback requested but requires an executable rollback adapter'] : ['Manual investigation required'],
    });

    if (input.autoRollbackOnFailure) {
      if (!this.rollbackRunner) {
        const degradedProd = this.buildDegradedStatus(deployment, now, healthResults);
        return { deployment: failedDeployment, productionStatus: degradedProd, healthResults };
      }
      const rollbackOutcome = await this.executeRollback({ deploymentId: deployment.deploymentId, reason: `Health verification failed: ${incident.summary}`, triggeredBy: 'automated-health-watchdog' });
      return { deployment: rollbackOutcome.deployment, productionStatus: rollbackOutcome.productionStatus, healthResults };
    }

    const degradedProd = this.buildDegradedStatus(deployment, now, healthResults);
    return { deployment: failedDeployment, productionStatus: degradedProd, healthResults };
  }

  private buildDegradedStatus(deployment: DeploymentContract, now: string, healthResults: HealthProbeResult[]): ProductionStatus {
    const status = parseContract(ProductionStatusSchema, {
      id: `prod-${deployment.projectId}-${deployment.environment}`,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'production_status',
      projectId: deployment.projectId,
      environment: deployment.environment,
      status: 'unhealthy',
      currentDeploymentId: deployment.deploymentId,
      currentVersion: deployment.targetVersion,
      lastHealthCheckAt: now,
      activeIncidents: 1,
      healthProbeResults: healthResults,
    });
    this.productionStatusByProjectEnv.set(this.projectEnvKey(deployment.projectId, deployment.environment), status);
    return status;
  }

  async executeRollback(input: { deploymentId: string; reason: string; triggeredBy?: string }): Promise<{ deployment: DeploymentContract; productionStatus: ProductionStatus; incident: IncidentContract }> {
    const deployment = this.deploymentsById.get(input.deploymentId);
    if (!deployment) throw new Error(`Deployment ${input.deploymentId} not found`);
    if (!this.rollbackRunner) throw new Error('Rollback requires a real rollback runner; refusing to claim rollback without execution');
    if (deployment.rollbackPlan.steps.length === 0) throw new Error(`Deployment ${deployment.deploymentId} has no executable rollback steps`);

    const rollback = await this.rollbackRunner({
      projectId: deployment.projectId,
      environment: deployment.environment,
      strategy: deployment.strategy,
      targetVersion: deployment.rollbackPlan.targetVersion,
      steps: deployment.rollbackPlan.steps,
    });
    if (rollback.status !== 'success') {
      throw new Error(`Rollback execution failed: ${rollback.message ?? 'unknown rollback error'}`);
    }

    const now = new Date().toISOString();
    const evidenceRefs: string[] = [];
    if (this.evidenceRoot) {
      const dir = join(this.evidenceRoot, deployment.projectId, 'deployments', deployment.deploymentId);
      await mkdir(dir, { recursive: true });
      const evidencePath = join(dir, 'rollback-evidence.json');
      await writeFile(evidencePath, JSON.stringify({ deploymentId: deployment.deploymentId, targetVersion: deployment.rollbackPlan.targetVersion, reason: input.reason, triggeredBy: input.triggeredBy, timestamp: now, steps: deployment.rollbackPlan.steps, execution: 'success' }, null, 2), 'utf8');
      evidenceRefs.push(evidencePath);
    }

    const rolledBackDeployment = parseContract(DeploymentContractSchema, {
      ...deployment,
      updatedAt: now,
      status: 'rolled_back',
      healthStatus: 'degraded',
      rolledBackAt: now,
      evidenceRefs: [...deployment.evidenceRefs, ...evidenceRefs],
      logs: [...deployment.logs, `Rollback executed by ${input.triggeredBy ?? 'operator'} at ${now}: ${input.reason}`],
    });
    this.deploymentsById.set(deployment.deploymentId, rolledBackDeployment);

    const incident = await this.recordIncident({
      projectId: deployment.projectId,
      deploymentId: deployment.deploymentId,
      severity: 'P1',
      title: `Rollback executed for deployment ${deployment.deploymentId}`,
      summary: input.reason,
      rollbackTriggered: true,
      mitigationSteps: deployment.rollbackPlan.steps,
    });

    const currentProd = this.productionStatusByProjectEnv.get(this.projectEnvKey(deployment.projectId, deployment.environment));
    const updatedProdStatus = parseContract(ProductionStatusSchema, {
      id: `prod-${deployment.projectId}-${deployment.environment}`,
      schemaVersion: SCHEMA_VERSION,
      createdAt: currentProd?.createdAt ?? now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'production_status',
      projectId: deployment.projectId,
      environment: deployment.environment,
      status: 'degraded',
      currentDeploymentId: deployment.deploymentId,
      currentVersion: deployment.rollbackPlan.targetVersion,
      lastHealthCheckAt: now,
      activeIncidents: (currentProd?.activeIncidents ?? 0) + 1,
      healthProbeResults: currentProd?.healthProbeResults ?? [],
    });
    this.productionStatusByProjectEnv.set(this.projectEnvKey(deployment.projectId, deployment.environment), updatedProdStatus);
    return { deployment: rolledBackDeployment, productionStatus: updatedProdStatus, incident };
  }

  async recordIncident(input: { projectId: string; deploymentId?: string; severity: IncidentSeverity; title: string; summary: string; rollbackTriggered?: boolean; mitigationSteps?: string[] }): Promise<IncidentContract> {
    const incidentId = `inc-${randomUUID()}`;
    const now = new Date().toISOString();
    const incident = parseContract(IncidentContractSchema, {
      id: incidentId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'incident',
      incidentId,
      projectId: input.projectId,
      deploymentId: input.deploymentId,
      severity: input.severity,
      status: 'open',
      title: input.title,
      summary: input.summary,
      triggeredAt: now,
      rollbackTriggered: input.rollbackTriggered ?? false,
      mitigationSteps: input.mitigationSteps ?? [],
    });
    this.incidentsById.set(incidentId, incident);
    return incident;
  }

  async resolveIncident(incidentId: string, resolutionNotes: string): Promise<IncidentContract> {
    const incident = this.incidentsById.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);
    const now = new Date().toISOString();
    const updated = parseContract(IncidentContractSchema, { ...incident, updatedAt: now, status: 'resolved', resolvedAt: now, mitigationSteps: [...incident.mitigationSteps, `Resolved: ${resolutionNotes}`] });
    this.incidentsById.set(incidentId, updated);
    return updated;
  }

  getProductionStatus(projectId: string, environment: Environment = 'production'): ProductionStatus {
    const existing = this.productionStatusByProjectEnv.get(this.projectEnvKey(projectId, environment));
    if (existing) return existing;
    const now = new Date().toISOString();
    return parseContract(ProductionStatusSchema, {
      id: `prod-${projectId}-${environment}`,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'production_status',
      projectId,
      environment,
      status: 'offline',
      activeIncidents: 0,
      healthProbeResults: [],
    });
  }

  getDeployment(deploymentId: string): DeploymentContract | undefined { return this.deploymentsById.get(deploymentId); }
  listDeployments(projectId: string, environment?: Environment): DeploymentContract[] {
    return Array.from(this.deploymentsById.values()).filter((d) => d.projectId === projectId && (!environment || d.environment === environment));
  }
  listIncidents(projectId: string): IncidentContract[] { return Array.from(this.incidentsById.values()).filter((i) => i.projectId === projectId); }
}
