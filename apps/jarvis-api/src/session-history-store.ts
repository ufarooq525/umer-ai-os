/**
 * Durable JARVIS conversation history — replaces the anonymous in-memory
 * session Map so a restart (or a second replica) doesn't silently lose a
 * live conversation.
 */
export type ConversationTurn = { role: 'user' | 'assistant'; content: string };

export type SessionHistoryStore = {
  get(sessionId: string): Promise<ConversationTurn[]>;
  append(sessionId: string, turns: readonly ConversationTurn[]): Promise<void>;
};

export class InMemorySessionHistoryStore implements SessionHistoryStore {
  private readonly sessions = new Map<string, ConversationTurn[]>();

  constructor(private readonly maxHistory: number) {}

  async get(sessionId: string): Promise<ConversationTurn[]> {
    return this.sessions.get(sessionId) ?? [];
  }

  async append(sessionId: string, turns: readonly ConversationTurn[]): Promise<void> {
    const existing = this.sessions.get(sessionId) ?? [];
    this.sessions.set(sessionId, [...existing, ...turns].slice(-this.maxHistory));
  }
}

export type SessionHistorySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

type TurnRow = { role: string; content: string };

export class MySqlSessionHistoryStore implements SessionHistoryStore {
  constructor(private readonly db: SessionHistorySqlExecutor, private readonly maxHistory: number) {}

  async get(sessionId: string): Promise<ConversationTurn[]> {
    const rows = await this.db.execute<TurnRow[]>(
      'SELECT role, content FROM jarvis_session_turns WHERE session_id = ? ORDER BY turn_id DESC LIMIT ?',
      [sessionId, this.maxHistory],
    );
    return rows.reverse().map((row) => ({ role: row.role as ConversationTurn['role'], content: row.content }));
  }

  async append(sessionId: string, turns: readonly ConversationTurn[]): Promise<void> {
    for (const turn of turns) {
      await this.db.execute('INSERT INTO jarvis_session_turns (session_id, role, content, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))', [sessionId, turn.role, turn.content]);
    }
    // Bound table growth to the same window the API actually reads — mirrors
    // the .slice(-maxHistory) the in-memory store used to do.
    await this.db.execute(
      `DELETE FROM jarvis_session_turns
       WHERE session_id = ?
         AND turn_id NOT IN (
           SELECT turn_id FROM (
             SELECT turn_id FROM jarvis_session_turns WHERE session_id = ? ORDER BY turn_id DESC LIMIT ?
           ) recent
         )`,
      [sessionId, sessionId, this.maxHistory],
    );
  }
}
