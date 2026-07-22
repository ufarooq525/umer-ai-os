import type { GateWaitRecord } from './types.js';

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
