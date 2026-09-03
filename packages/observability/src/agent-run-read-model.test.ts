import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type EventEnvelope, type RuntimeEventName } from '@umer/contracts';
import {
  InMemoryAgentRunReadModelStore,
  projectRuntimeEvent,
  type AgentRunSnapshot,
} from './agent-run-read-model.js';

let seq = 0;
function evt(name: RuntimeEventName, payload: Record<string, unknown>, occurredAt?: string): EventEnvelope {
  seq += 1;
  return {
    eventId: `evt-${seq}`,
    schemaVersion: SCHEMA_VERSION,
    name,
    occurredAt: occurredAt ?? new Date(1_800_000_000_000 + seq * 100).toISOString(),
    correlationId: 'corr-live-happy',
    producer: 'agent-worker',
    payload,
  };
}

function fold(events: EventEnvelope[]): AgentRunSnapshot | undefined {
  let snapshot: AgentRunSnapshot | undefined;
  for (const event of events) {
    const next = projectRuntimeEvent(snapshot, event);
    if (next) snapshot = next;
  }
  return snapshot;
}

const base = { workPackageId: 'wp-live-1', execId: 'EXEC-900', specialistId: 'growth.opportunity-research' };

describe('projectRuntimeEvent — reconstructing a real captured agent-worker run', () => {
  // This is the actual evt.runtime.* sequence observed against real LM Studio
  // (qwen/qwen3-8b) + real search_web in the live verification run: one model
  // turn requesting 3 tool calls, all executed, then a second model turn that
  // produced a final answer with no further tool calls.
  const REAL_HAPPY_PATH_SEQUENCE: EventEnvelope[] = [
    evt('agent.run.started', { ...base }),
    evt('agent.llm.requested', { ...base, iteration: 1 }),
    evt('agent.llm.completed', { ...base, iteration: 1, finishReason: 'tool_calls', toolCallCount: 3 }),
    evt('agent.tool.requested', {
      ...base,
      iteration: 1,
      toolCallId: 'call_1',
      tool: 'search_web',
      input: { query: 'current trends in healthcare SaaS 2023' },
    }),
    evt('agent.decision', { ...base, action: 'tool_call', tool: 'search_web', reason: 'Specialist requested tool "search_web" to continue Work Package wp-live-1' }),
    evt('agent.tool.started', { ...base, toolCallId: 'call_1', tool: 'search_web' }),
    evt('agent.tool.completed', { ...base, toolCallId: 'call_1', tool: 'search_web', status: 'completed', durationMs: 451 }),
    evt('agent.tool.requested', { ...base, iteration: 1, toolCallId: 'call_2', tool: 'search_web', input: { query: 'high-growth healthcare SaaS verticals' } }),
    evt('agent.tool.started', { ...base, toolCallId: 'call_2', tool: 'search_web' }),
    evt('agent.tool.completed', { ...base, toolCallId: 'call_2', tool: 'search_web', status: 'completed', durationMs: 182 }),
    evt('agent.tool.requested', { ...base, iteration: 1, toolCallId: 'call_3', tool: 'search_web', input: { query: 'profitable healthcare tech solutions case studies' } }),
    evt('agent.tool.started', { ...base, toolCallId: 'call_3', tool: 'search_web' }),
    evt('agent.tool.completed', { ...base, toolCallId: 'call_3', tool: 'search_web', status: 'completed', durationMs: 184 }),
    evt('agent.llm.requested', { ...base, iteration: 2 }),
    evt('agent.llm.completed', { ...base, iteration: 2, finishReason: 'stop', toolCallCount: 0 }),
    evt('agent.decision', { ...base, action: 'final_answer', reason: 'Specialist produced a final response with no further tool calls' }),
    evt('agent.run.completed', {
      workPackageId: 'wp-live-1',
      runId: 'wp-live-1:corr-live-happy',
      summary: 'The search_web tool did not return any results...',
      artifactId: 'art-wp-live-1-1',
    }),
  ];

  it('reconstructs every field the CEO checklist needs from real events alone', () => {
    const snapshot = fold(REAL_HAPPY_PATH_SEQUENCE);
    expect(snapshot).toBeDefined();
    const s = snapshot!;

    // agent / specialist
    expect(s.specialistId).toBe('growth.opportunity-research');
    // work package
    expect(s.workPackageId).toBe('wp-live-1');
    // "project/opportunity" — best available correlation today is execId (see doc caveat)
    expect(s.execId).toBe('EXEC-900');
    // status
    expect(s.status).toBe('completed');
    // current action — idle once finished
    expect(s.currentAction).toBe('idle');
    expect(s.currentTool).toBeUndefined();
    // previous actions
    expect(s.actionLog.length).toBeGreaterThanOrEqual(10);
    expect(s.actionLog[0]?.summary).toContain('Run started');
    // tool call history including input
    expect(s.toolCalls).toHaveLength(3);
    expect(s.toolCalls[0]).toMatchObject({
      toolCallId: 'call_1',
      tool: 'search_web',
      status: 'completed',
      durationMs: 451,
      input: { query: 'current trends in healthcare SaaS 2023' },
    });
    // decisions (safe operational reason, not chain-of-thought)
    expect(s.decisions.map((d) => d.action)).toEqual(['tool_call', 'final_answer']);
    expect(s.decisions[0]?.reason).not.toMatch(/okay|let me|i need to/i);
    // failures — none in the happy path
    expect(s.failures).toHaveLength(0);
    // output/artifact
    expect(s.artifactId).toBe('art-wp-live-1-1');
    expect(s.runId).toBe('wp-live-1:corr-live-happy');
    expect(s.summary).toContain('search_web');
  });

  it('tracks currentTool/currentToolInput live while a tool is mid-flight', () => {
    const midFlight = REAL_HAPPY_PATH_SEQUENCE.slice(0, 4); // up to first agent.tool.requested
    const snapshot = fold(midFlight)!;
    expect(snapshot.currentAction).toBe('executing_tool');
    expect(snapshot.currentTool).toBe('search_web');
    expect(snapshot.currentToolInput).toEqual({ query: 'current trends in healthcare SaaS 2023' });
  });

  it('reconstructs a failed run — real captured tool-failure + run-failure shape', () => {
    const events: EventEnvelope[] = [
      evt('agent.run.started', { ...base }),
      evt('agent.llm.requested', { ...base, iteration: 1 }),
      evt('agent.llm.completed', { ...base, iteration: 1, finishReason: 'tool_calls', toolCallCount: 1 }),
      evt('agent.tool.requested', { ...base, iteration: 1, toolCallId: 'call_1', tool: 'search_web', input: { query: 'x' } }),
      evt('agent.tool.started', { ...base, toolCallId: 'call_1', tool: 'search_web' }),
      evt('agent.tool.failed', { ...base, toolCallId: 'call_1', tool: 'search_web', status: 'failed', durationMs: 18, error: 'fetch failed' }),
      evt('agent.run.failed', { workPackageId: 'wp-live-1', errorMessage: 'fetch failed', code: 'HANDLER_FAILED' }),
    ];

    const s = fold(events)!;
    expect(s.status).toBe('failed');
    expect(s.toolCalls[0]).toMatchObject({ status: 'failed', error: 'fetch failed' });
    expect(s.failures).toEqual([
      { source: 'tool', message: 'fetch failed', at: expect.any(String) },
      { source: 'run', message: 'fetch failed', at: expect.any(String) },
    ]);
    expect(s.currentAction).toBe('idle');
  });

  it('ignores events from other domains (trust/artifact/gate) without keying on them', () => {
    const irrelevant = evt('trust.allow', { principalId: 'x' });
    expect(projectRuntimeEvent(undefined, irrelevant)).toBeUndefined();
  });

  it('ignores an agent event with no workPackageId to key on', () => {
    const orphan = evt('agent.decision', { action: 'final_answer' });
    expect(projectRuntimeEvent(undefined, orphan)).toBeUndefined();
  });
});

describe('InMemoryAgentRunReadModelStore', () => {
  it('upserts and retrieves by workPackageId, and lists filtered by status', async () => {
    const store = new InMemoryAgentRunReadModelStore();
    const running: AgentRunSnapshot = {
      workPackageId: 'wp-a',
      correlationId: 'corr-a',
      status: 'running',
      currentAction: 'waiting_on_model',
      startedAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      toolCalls: [],
      decisions: [],
      actionLog: [],
      failures: [],
    };
    const completed: AgentRunSnapshot = { ...running, workPackageId: 'wp-b', status: 'completed', currentAction: 'idle' };

    await store.upsert(running);
    await store.upsert(completed);

    expect(await store.get('wp-a')).toEqual(running);
    expect(await store.get('missing')).toBeUndefined();
    expect(await store.list()).toHaveLength(2);
    expect(await store.list({ status: 'completed' })).toEqual([completed]);
  });

  // (A) event -> read-model projection, via the store's single required entry point
  it('(A) project() folds a single event into a brand-new snapshot', async () => {
    const store = new InMemoryAgentRunReadModelStore();
    const snapshot = await store.project(evt('agent.run.started', { ...base }));
    expect(snapshot).toMatchObject({ workPackageId: 'wp-live-1', status: 'running', currentAction: 'waiting_on_model' });
    expect(await store.get('wp-live-1')).toEqual(snapshot);
  });

  it('project() returns undefined and touches nothing for an event this read model does not key on', async () => {
    const store = new InMemoryAgentRunReadModelStore();
    const result = await store.project(evt('trust.allow', { principalId: 'x' }));
    expect(result).toBeUndefined();
    expect(await store.list()).toHaveLength(0);
  });

  // (I) multiple agents/runs do not overwrite each other
  it('(I) two work packages projected via interleaved events never overwrite each other', async () => {
    const store = new InMemoryAgentRunReadModelStore();
    const wpA = { workPackageId: 'wp-A', execId: 'EXEC-1', specialistId: 'growth.opportunity-research' };
    const wpB = { workPackageId: 'wp-B', execId: 'EXEC-2', specialistId: 'eng.app-delivery' };

    // Interleaved on purpose: A, B, A, B, ... simulating two agents running concurrently.
    await store.project(evt('agent.run.started', { ...wpA }));
    await store.project(evt('agent.run.started', { ...wpB }));
    await store.project(
      evt('agent.tool.requested', { ...wpA, toolCallId: 'call_a1', tool: 'search_web', input: { query: 'a' } }),
    );
    await store.project(evt('agent.llm.requested', { ...wpB, iteration: 1 }));
    await store.project(
      evt('agent.tool.completed', { ...wpA, toolCallId: 'call_a1', tool: 'search_web', status: 'completed', durationMs: 10 }),
    );
    await store.project(
      evt('agent.run.completed', { workPackageId: 'wp-B', runId: 'wp-B:corr', artifactId: 'art-B', summary: 'b done' }),
    );

    const snapA = await store.get('wp-A');
    const snapB = await store.get('wp-B');

    expect(snapA?.specialistId).toBe('growth.opportunity-research');
    expect(snapA?.toolCalls).toHaveLength(1);
    expect(snapA?.status).toBe('running'); // wp-A never got a run.completed
    expect(snapA?.artifactId).toBeUndefined();

    expect(snapB?.specialistId).toBe('eng.app-delivery');
    expect(snapB?.toolCalls).toHaveLength(0); // wp-B never had a tool call
    expect(snapB?.status).toBe('completed');
    expect(snapB?.artifactId).toBe('art-B');

    expect(await store.list()).toHaveLength(2);
  });

  it('project() is race-free under concurrently-awaited calls for the same work package (no lost updates)', async () => {
    const store = new InMemoryAgentRunReadModelStore();
    const events = Array.from({ length: 20 }, (_, i) =>
      evt('agent.tool.requested', { ...base, toolCallId: `call_${i}`, tool: 'search_web', input: { i } }),
    );

    // Fire all 20 projections "concurrently" (no sequential await between them) —
    // project()'s synchronous critical section (see implementation comment)
    // means every one still lands, none clobbers another.
    await Promise.all(events.map((event) => store.project(event)));

    const snapshot = await store.get('wp-live-1');
    expect(snapshot?.toolCalls).toHaveLength(20);
    const ids = new Set(snapshot?.toolCalls.map((t) => t.toolCallId));
    expect(ids.size).toBe(20);
  });
});
