import type { WorkPackageContract, WorkPackageStatus } from '@umer/contracts';

export type WorkPackageRecord = {
  workPackage: WorkPackageContract;
  queuedAt?: string;
  dispatchedAt?: string;
  startedAt?: string;
  lastError?: string;
};

export type WorkPackageStore = {
  get(workPackageId: string): Promise<WorkPackageRecord | undefined>;
  save(record: WorkPackageRecord): Promise<void>;
  listByStatus(status: WorkPackageStatus): Promise<WorkPackageRecord[]>;
};

export class InMemoryWorkPackageStore implements WorkPackageStore {
  private readonly records = new Map<string, WorkPackageRecord>();

  async get(workPackageId: string): Promise<WorkPackageRecord | undefined> {
    return this.records.get(workPackageId);
  }

  async save(record: WorkPackageRecord): Promise<void> {
    this.records.set(record.workPackage.workPackageId, structuredClone(record));
  }

  async listByStatus(status: WorkPackageStatus): Promise<WorkPackageRecord[]> {
    return [...this.records.values()].filter((record) => record.workPackage.status === status);
  }

  clear(): void {
    this.records.clear();
  }
}
