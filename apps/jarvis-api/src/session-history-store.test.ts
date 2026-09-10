import { describe, expect, it, vi } from 'vitest';
import { InMemorySessionHistoryStore, MySqlSessionHistoryStore, type SessionHistorySqlExecutor } from './session-history-store.js';

describe('InMemorySessionHistoryStore', () => {
  it('returns an empty history for an unknown session', async () => {
    const store = new InMemorySessionHistoryStore(20);
    expect(await store.get('unknown')).toEqual([]);
  });

  it('appends turns and bounds history to maxHistory', async () => {
    const store = new InMemorySessionHistoryStore(4);
    await store.append('s1', [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }]);
    await store.append('s1', [{ role: 'user', content: 'how are you' }, { role: 'assistant', content: 'good' }]);
    await store.append('s1', [{ role: 'user', content: 'bye' }, { role: 'assistant', content: 'goodbye' }]);

    const history = await store.get('s1');
    expect(history).toHaveLength(4);
    expect(history[0]).toEqual({ role: 'user', content: 'how are you' });
    expect(history[3]).toEqual({ role: 'assistant', content: 'goodbye' });
  });

  it('keeps sessions independent', async () => {
    const store = new InMemorySessionHistoryStore(20);
    await store.append('a', [{ role: 'user', content: 'a-message' }]);
    await store.append('b', [{ role: 'user', content: 'b-message' }]);
    expect(await store.get('a')).toEqual([{ role: 'user', content: 'a-message' }]);
    expect(await store.get('b')).toEqual([{ role: 'user', content: 'b-message' }]);
  });
});

describe('MySqlSessionHistoryStore', () => {
  it('reads history ordered oldest-first even though the query fetches newest-first', async () => {
    const execute = vi.fn<SessionHistorySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'first' },
    ] as never);
    const store = new MySqlSessionHistoryStore({ execute: execute as unknown as SessionHistorySqlExecutor['execute'] }, 20);

    const history = await store.get('s1');
    expect(history).toEqual([{ role: 'user', content: 'first' }, { role: 'assistant', content: 'second' }]);
    expect(execute.mock.calls[0]![0]).toContain('ORDER BY turn_id DESC LIMIT ?');
    expect(execute.mock.calls[0]![1]).toEqual(['s1', 20]);
  });

  it('inserts one row per turn, then trims to maxHistory for that session', async () => {
    const execute = vi.fn<SessionHistorySqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlSessionHistoryStore({ execute: execute as unknown as SessionHistorySqlExecutor['execute'] }, 20);

    await store.append('s1', [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }]);

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[0]![0]).toContain('INSERT INTO jarvis_session_turns');
    expect(execute.mock.calls[0]![1]).toEqual(['s1', 'user', 'hi']);
    expect(execute.mock.calls[1]![1]).toEqual(['s1', 'assistant', 'hello']);
    expect(execute.mock.calls[2]![0]).toContain('DELETE FROM jarvis_session_turns');
    expect(execute.mock.calls[2]![1]).toEqual(['s1', 's1', 20]);
  });
});
