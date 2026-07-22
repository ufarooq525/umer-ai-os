import type { MemoryContract } from '@umer/contracts';

export type MemoryStore = {
  save(memory: MemoryContract): Promise<void>;
  get(memoryId: string): Promise<MemoryContract | undefined>;
  list(): Promise<MemoryContract[]>;
  delete(memoryId: string): Promise<boolean>;
};

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryContract>();

  async save(memory: MemoryContract): Promise<void> {
    this.records.set(memory.memoryId, structuredClone(memory));
  }

  async get(memoryId: string): Promise<MemoryContract | undefined> {
    return this.records.get(memoryId);
  }

  async list(): Promise<MemoryContract[]> {
    return [...this.records.values()];
  }

  async delete(memoryId: string): Promise<boolean> {
    return this.records.delete(memoryId);
  }

  clear(): void {
    this.records.clear();
  }
}
