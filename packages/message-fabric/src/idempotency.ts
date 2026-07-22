export type IdempotencyStore = {
  has(key: string): Promise<boolean>;
  mark(key: string, ttlMs?: number): Promise<void>;
};

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Map<string, number>();

  async has(key: string): Promise<boolean> {
    this.evictExpired();
    const expires = this.keys.get(key);
    if (!expires) {
      return false;
    }
    if (Date.now() > expires) {
      this.keys.delete(key);
      return false;
    }
    return true;
  }

  async mark(key: string, ttlMs = 86_400_000): Promise<void> {
    this.keys.set(key, Date.now() + ttlMs);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, expires] of this.keys) {
      if (now > expires) {
        this.keys.delete(key);
      }
    }
  }

  clear(): void {
    this.keys.clear();
  }
}
