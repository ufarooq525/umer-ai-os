import type { CommandResult } from './types.js';

/**
 * Command-result idempotency. Distinct from @umer/message-fabric's
 * `IdempotencyStore`: that one is a boolean has/mark used by the durable
 * command-bus consumer to skip re-processing (it never needs to hand back
 * what happened last time — the caller isn't waiting on a response). A CEO
 * command is issued over HTTP and the spec requires a duplicate delivery to
 * return "the same logical command result" (not just silently no-op), so
 * this store keeps the result too. Same in-memory/TTL shape otherwise.
 */
export type CommandIdempotencyStore = {
  get(key: string): Promise<CommandResult | undefined>;
  save(key: string, result: CommandResult, ttlMs?: number): Promise<void>;
};

export class InMemoryCommandIdempotencyStore implements CommandIdempotencyStore {
  private readonly entries = new Map<string, { result: CommandResult; expiresAt: number }>();

  async get(key: string): Promise<CommandResult | undefined> {
    this.evictExpired();
    return this.entries.get(key)?.result;
  }

  async save(key: string, result: CommandResult, ttlMs = 86_400_000): Promise<void> {
    this.entries.set(key, { result, expiresAt: Date.now() + ttlMs });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
