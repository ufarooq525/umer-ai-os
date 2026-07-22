export const packageName = '@umer/audit' as const;

export type CreateAuditInput = {
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  outcome: 'success' | 'failure' | 'denied';
  severity?: 'info' | 'notice' | 'warning' | 'critical';
  correlationId?: string;
  detail?: Record<string, unknown>;
};

export type IntegrityVerification = {
  valid: boolean;
  headHash: string;
  recordCount: number;
};

export type ChainedAuditEntry = {
  recordHash: string;
  previousHash: string;
};
