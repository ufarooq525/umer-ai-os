import type { GateWaitRecord } from './types.js';
import type { SpecialistControlPort, SpecialistControlRecord } from './commands/ports.js';

export type GateWaitStore = {
  save(record: GateWaitRecord): Promise<void>;
  get(waitId: string): Promise<GateWaitRecord | undefined>;
  list(): Promise<GateWaitRecord[]>;
  listPending(): Promise<GateWaitRecord[]>;
};

export class InMemoryGateWaitStore implements GateWaitStore {
  private readonly records = new Map<string, GateWaitRecord>();

  async save(record: GateWaitRecord): Promise<void> {
    this.records.set(record.waitId, structuredClone(record));
  }

  async get(waitId: string): Promise<GateWaitRecord | undefined> {
    return this.records.get(waitId);
  }

  async list(): Promise<GateWaitRecord[]> {
    return [...this.records.values()];
  }

  async listPending(): Promise<GateWaitRecord[]> {
    return [...this.records.values()].filter((record) => record.status === 'waiting');
  }

  clear(): void {
    this.records.clear();
  }
}

/**
 * Sparse by design, like AgentControlStore: absence of a record means
 * `active` — this store only ever holds a row for a specialist that has
 * been explicitly suspended (or previously suspended, then reactivated).
 * It is never seeded with "every specialist that could exist".
 */
export class InMemorySpecialistControlStore implements SpecialistControlPort {
  private readonly records = new Map<string, SpecialistControlRecord>();

  async get(specialistId: string): Promise<SpecialistControlRecord | undefined> {
    return this.records.get(specialistId);
  }

  async suspend(specialistId: string, reason: string | undefined): Promise<SpecialistControlRecord> {
    const record: SpecialistControlRecord = { specialistId, controlState: 'suspended', reason, updatedAt: new Date().toISOString() };
    this.records.set(specialistId, record);
    return record;
  }

  async activate(specialistId: string): Promise<SpecialistControlRecord> {
    const record: SpecialistControlRecord = { specialistId, controlState: 'active', updatedAt: new Date().toISOString() };
    this.records.set(specialistId, record);
    return record;
  }

  async list(): Promise<SpecialistControlRecord[]> {
    return [...this.records.values()];
  }

  clear(): void {
    this.records.clear();
  }
}
