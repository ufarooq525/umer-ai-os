import type { AuditContract } from '@umer/contracts';
import { buildAuditRecord } from './builder.js';
import type { AuditEventPublisher } from './events.js';
import { createNoopAuditEventPublisher } from './events.js';
import { computeAuditEntryHash, GENESIS_HASH } from './hash.js';
import {
  buildChainEntry,
  headHash,
  InMemoryAuditStore,
  type AuditStore,
  type StoredAuditEntry,
} from './store.js';
import type { CreateAuditInput, IntegrityVerification } from './types.js';

export type Clock = {
  nowIso(): string;
};

export const systemClock: Clock = {
  nowIso() {
    return new Date().toISOString();
  },
};

export type AuditServiceOptions = {
  store?: AuditStore;
  events?: AuditEventPublisher;
  clock?: Clock;
};

export class AuditService {
  private readonly store: AuditStore;
  private readonly events: AuditEventPublisher;
  private readonly clock: Clock;

  constructor(options: AuditServiceOptions = {}) {
    this.store = options.store ?? new InMemoryAuditStore();
    this.events = options.events ?? createNoopAuditEventPublisher();
    this.clock = options.clock ?? systemClock;
  }

  async append(input: CreateAuditInput, correlationId: string): Promise<AuditContract> {
    const occurredAt = this.clock.nowIso();
    const record = buildAuditRecord(input, occurredAt);
    const entries =
      this.store instanceof InMemoryAuditStore ? this.store.getEntries() : await this.loadEntries();
    const previousHash = headHash(entries);
    const chain = buildChainEntry(previousHash, record);
    await this.store.append(record, chain);
    await this.events.publish('audit.appended', correlationId, {
      auditId: record.auditId,
      action: record.action,
      actor: record.actor,
      recordHash: chain.recordHash,
    });
    return record;
  }

  async verifyIntegrity(correlationId = 'integrity-check'): Promise<IntegrityVerification> {
    const entries = await this.loadEntries();
    let previousHash = GENESIS_HASH;
    for (const entry of entries) {
      const expected = computeAuditEntryHash(previousHash, entry.record);
      if (expected !== entry.recordHash || entry.previousHash !== previousHash) {
        await this.events.publish('audit.integrity.failed', correlationId, {
          auditId: entry.record.auditId,
          expected,
          actual: entry.recordHash,
        });
        return {
          valid: false,
          headHash: entry.recordHash,
          recordCount: entries.length,
        };
      }
      previousHash = entry.recordHash;
    }
    const verification: IntegrityVerification = {
      valid: true,
      headHash: previousHash,
      recordCount: entries.length,
    };
    await this.events.publish('audit.integrity.verified', correlationId, {
      headHash: verification.headHash,
      recordCount: verification.recordCount,
    });
    return verification;
  }

  async query(filter?: {
    correlationId?: string;
    actor?: string;
    action?: string;
  }): Promise<AuditContract[]> {
    const records = await this.store.list();
    return records.filter((record) => {
      if (filter?.correlationId && record.correlationId !== filter.correlationId) {
        return false;
      }
      if (filter?.actor && record.actor !== filter.actor) {
        return false;
      }
      if (filter?.action && record.action !== filter.action) {
        return false;
      }
      return true;
    });
  }

  private async loadEntries(): Promise<StoredAuditEntry[]> {
    if (this.store instanceof InMemoryAuditStore) {
      return this.store.getEntries();
    }
    const records = await this.store.list();
    const chain = await this.store.getChain();
    return records.map((record, index) => ({
      record,
      previousHash: chain[index]?.previousHash ?? GENESIS_HASH,
      recordHash: chain[index]?.recordHash ?? GENESIS_HASH,
    }));
  }
}
