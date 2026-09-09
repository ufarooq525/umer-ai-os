import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  ArtifactIdSchema,
  DeploymentIdSchema,
  IncidentIdSchema,
  ProjectIdSchema,
} from '../common/ids.js';

export const DeploymentStatusSchema = z.enum([
  'pending_approval',
  'approved',
  'deploying',
  'deployed',
  'failed',
  'rolled_back',
]);

export const DeploymentStrategySchema = z.enum([
  'docker_compose',
  'helm',
  'direct',
]);

export const HealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
  'unknown',
]);

export const EnvironmentSchema = z.enum([
  'local',
  'staging',
  'production',
]);

export const RollbackPlanSchema = z
  .object({
    strategy: z.string().min(1),
    targetVersion: z.string().min(1),
    steps: z.array(z.string().min(1)).default([]),
    verificationCriteria: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const DeploymentContractSchema = withContractHeader({
  kind: z.literal('deployment'),
  deploymentId: DeploymentIdSchema,
  projectId: ProjectIdSchema,
  releasePackageId: ArtifactIdSchema,
  environment: EnvironmentSchema,
  status: DeploymentStatusSchema,
  targetVersion: z.string().min(1),
  strategy: DeploymentStrategySchema,
  manifestRef: z.string().min(1),
  healthStatus: HealthStatusSchema.default('unknown'),
  rollbackPlan: RollbackPlanSchema,
  deployedAt: z.string().optional(),
  verifiedAt: z.string().optional(),
  rolledBackAt: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([]),
  logs: z.array(z.string()).default([]),
});

export const HealthProbeResultSchema = z
  .object({
    service: z.string().min(1),
    probe: z.string().min(1),
    status: z.enum(['pass', 'fail', 'warn']),
    responseTimeMs: z.number().optional(),
    message: z.string().optional(),
  })
  .strict();

export const ProductionStatusSchema = withContractHeader({
  kind: z.literal('production_status'),
  projectId: ProjectIdSchema,
  environment: EnvironmentSchema,
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']),
  currentDeploymentId: DeploymentIdSchema.optional(),
  currentVersion: z.string().optional(),
  lastHealthCheckAt: z.string().optional(),
  activeIncidents: z.number().int().nonnegative().default(0),
  healthProbeResults: z.array(HealthProbeResultSchema).default([]),
});

export const IncidentSeveritySchema = z.enum(['P1', 'P2', 'P3', 'P4']);

export const IncidentStatusSchema = z.enum([
  'open',
  'investigating',
  'mitigated',
  'resolved',
]);

export const IncidentContractSchema = withContractHeader({
  kind: z.literal('incident'),
  incidentId: IncidentIdSchema,
  projectId: ProjectIdSchema,
  deploymentId: DeploymentIdSchema.optional(),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  triggeredAt: z.string().min(1),
  resolvedAt: z.string().optional(),
  rollbackTriggered: z.boolean().default(false),
  mitigationSteps: z.array(z.string()).default([]),
});

export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentStrategy = z.infer<typeof DeploymentStrategySchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type RollbackPlan = z.infer<typeof RollbackPlanSchema>;
export type DeploymentContract = z.infer<typeof DeploymentContractSchema>;
export type HealthProbeResult = z.infer<typeof HealthProbeResultSchema>;
export type ProductionStatus = z.infer<typeof ProductionStatusSchema>;
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;
export type IncidentContract = z.infer<typeof IncidentContractSchema>;
