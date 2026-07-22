import type { MemoryKind, MemoryScope } from '@umer/contracts';

export const packageName = '@umer/memory-access' as const;

export type MemoryAccessPrincipal = {
  principalId: string;
  grantedScopes: MemoryScope[];
  tenantId?: string;
};

export type RetrievalRequest = {
  query: string;
  embedding?: number[];
  memoryKinds?: MemoryKind[];
  limit?: number;
  tenantId?: string;
};

export type RetrievalCitation = {
  memoryId: string;
  memoryKind: MemoryKind;
  title: string;
  contentRef: string;
  score: number;
};

export type RetrievalBundle = {
  requestId: string;
  query: string;
  citations: RetrievalCitation[];
  retrievedAt: string;
};

export type WritebackReceipt = {
  receiptId: string;
  memoryId: string;
  status: 'queued' | 'acked' | 'denied';
  reason?: string;
};
