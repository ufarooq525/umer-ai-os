import type { AuditContract } from '@umer/contracts';
import { computeAuditEntryHash, GENESIS_HASH } from './hash.js';
import type { ChainedAuditEntry } from './types.js';

export type AuditStore = {
  append(record: AuditContract, chain: ChainedAuditEntry): Promise<void>;
  list(): Promise<AuditContract[]>;
  getChain(): Promise<ChainedAuditEntry[]>;
};

export type StoredAuditEntry = {
  record: AuditContract;
  previousHash: string;
  recordHash: string;
};

export class InMemoryAuditStore implements AuditStore {
  private readonly entries: StoredAuditEntry[] = [];

  async append(record: AuditContract, chain: ChainedAuditEntry): Promise<void> {
    this.entries.push({
      record: structuredClone(record),
      previousHash: chain.previousHash,
      recordHash: chain.recordHash,
    });
  }

  async list(): Promise<AuditContract[]> {
    return this.entries.map((entry) => entry.record);
  }

  async getChain(): Promise<ChainedAuditEntry[]> {
    return this.entries.map((entry) => ({
      previousHash: entry.previousHash,
      recordHash: entry.recordHash,
    }));
  }

  getEntries(): StoredAuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export function buildChainEntry(
  previousHash: string,
  record: AuditContract,
): ChainedAuditEntry & { recordHash: string } {
  const recordHash = computeAuditEntryHash(previousHash, record);
  return { previousHash, recordHash };
}

export function headHash(entries: StoredAuditEntry[]): string {
  if (entries.length === 0) {
    return GENESIS_HASH;
  }
  return entries[entries.length - 1]!.recordHash;
}
