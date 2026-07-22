import { createHash } from 'node:crypto';
import type { AuditContract } from '@umer/contracts';

export const GENESIS_HASH = '0'.repeat(64);

export function computeAuditEntryHash(previousHash: string, record: AuditContract): string {
  const payload = JSON.stringify({
    previousHash,
    auditId: record.auditId,
    action: record.action,
    actor: record.actor,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    outcome: record.outcome,
    occurredAt: record.occurredAt,
    detail: record.detail,
  });
  return createHash('sha256').update(payload).digest('hex');
}
