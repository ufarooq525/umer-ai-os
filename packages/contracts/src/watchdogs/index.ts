import { z } from 'zod';
import {
  FindingIdSchema,
  ProjectIdSchema,
  WatchRunIdSchema,
  WatchScheduleIdSchema,
  ArtifactIdSchema,
} from '../common/ids.js';

export const WatchdogIdSchema = z.enum([
  'security.watchdog',
  'deps.watchdog',
  'qa.watchdog',
  'arch.watchdog',
  'perf.watchdog',
  'seo.watchdog',
]);

export const WatchdogCadenceSchema = z.enum([
  'every_commit',
  'hourly',
  'nightly',
  'weekly',
  'on_deploy',
  'on_signal',
  'manual',
]);

export const FindingSeverityTierSchema = z.enum(['info', 'warning', 'high', 'critical']);

export const FindingConfidenceSchema = z.enum(['certain', 'probable', 'heuristic']);

export const FindingStatusSchema = z.enum(['open', 'acked', 'mitigating', 'cleared', 'wontfix']);

export const EscalationStageSchema = z.enum(['S0', 'S1', 'S2', 'S3', 'S4']);

export const FindingSeveritySchema = z.object({
  tier: FindingSeverityTierSchema,
  riskScore: z.number().min(1).max(25).default(1),
  confidence: FindingConfidenceSchema.default('probable'),
  sticky: z.boolean().default(true),
});

export const WatchdogFindingSchema = z.object({
  findingId: FindingIdSchema,
  fingerprint: z.string().min(1),
  watchdogId: WatchdogIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().min(1),
  severity: FindingSeveritySchema,
  status: FindingStatusSchema.default('open'),
  escalationStage: EscalationStageSchema.default('S0'),
  firstSeenAt: z.string().datetime({ offset: true }),
  lastSeenAt: z.string().datetime({ offset: true }),
  remediation: z.string().default(''),
  evidenceArtifactIds: z.array(ArtifactIdSchema).default([]),
  impactModules: z.array(z.string()).default([]),
  path: z.string().optional(),
  target: z.string().optional(),
  evidence: z.string().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
  ackedBy: z.string().optional(),
  ackedAt: z.string().datetime({ offset: true }).optional(),
  clearedBy: z.string().optional(),
  clearedAt: z.string().datetime({ offset: true }).optional(),
  clearanceReason: z.string().optional(),
});

export const WatchRunOutcomeSchema = z.enum(['healthy', 'findings_detected', 'failed']);

export const WatchRunSchema = z.object({
  runId: WatchRunIdSchema,
  watchdogId: WatchdogIdSchema,
  scheduleId: WatchScheduleIdSchema.optional(),
  cadence: WatchdogCadenceSchema,
  projectId: ProjectIdSchema,
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  outcome: WatchRunOutcomeSchema,
  findings: z.array(WatchdogFindingSchema).default([]),
  findingCount: z.number().int().nonnegative().default(0),
  summary: z.string().default(''),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const WatchdogScheduleSchema = z.object({
  id: WatchScheduleIdSchema,
  watchdogId: WatchdogIdSchema,
  projectId: ProjectIdSchema,
  cadence: WatchdogCadenceSchema,
  intervalMs: z.number().int().positive().optional(),
  cron: z.string().optional(),
  paused: z.boolean().default(false),
  lastRunAt: z.string().datetime({ offset: true }).optional(),
  nextRunAt: z.string().datetime({ offset: true }).optional(),
  options: z.record(z.string(), z.unknown()).default({}),
});

export type WatchdogId = z.infer<typeof WatchdogIdSchema>;
export type WatchdogCadence = z.infer<typeof WatchdogCadenceSchema>;
export type FindingSeverityTier = z.infer<typeof FindingSeverityTierSchema>;
export type FindingConfidence = z.infer<typeof FindingConfidenceSchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type EscalationStage = z.infer<typeof EscalationStageSchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type WatchdogFinding = z.infer<typeof WatchdogFindingSchema>;
export type WatchRunOutcome = z.infer<typeof WatchRunOutcomeSchema>;
export type WatchRun = z.infer<typeof WatchRunSchema>;
export type WatchdogSchedule = z.infer<typeof WatchdogScheduleSchema>;
