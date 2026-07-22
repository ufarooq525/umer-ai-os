import { randomUUID } from 'node:crypto';
import {
  parseContract,
  SCHEMA_VERSION,
  AuditContractSchema,
  type AuditContract,
} from '@umer/contracts';
import type { CreateAuditInput } from './types.js';

export function buildAuditRecord(input: CreateAuditInput, occurredAt: string): AuditContract {
  const auditId = randomUUID();
  return parseContract(AuditContractSchema, {
    id: auditId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    metadata: { labels: {}, annotations: {} },
    kind: 'audit',
    auditId,
    action: input.action,
    actor: input.actor,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    severity: input.severity ?? 'info',
    correlationId: input.correlationId,
    outcome: input.outcome,
    detail: input.detail ?? {},
    occurredAt,
  });
}
