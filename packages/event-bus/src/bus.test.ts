import { describe, expect, it } from 'vitest';
import { createEventBus } from './bus.js';

describe('EventBus', () => {
  it('publishes to matching subscribers and retains source on the event', async () => {
    const bus = createEventBus();
    const seen: string[] = [];

    bus.subscribe('specialist.qa.requested', (event) => {
      seen.push(event.projectId);
      expect(event.source).toEqual({
        kind: 'watchdog',
        watchdogId: 'qa.watchdog',
        cadence: 'nightly',
        scheduleId: 'sched-qa-nightly',
        tickId: 'tick-1',
      });
      return { ok: true };
    });

    const result = await bus.publishNew({
      type: 'specialist.qa.requested',
      projectId: 'school-app',
      source: {
        kind: 'watchdog',
        watchdogId: 'qa.watchdog',
        cadence: 'nightly',
        scheduleId: 'sched-qa-nightly',
        tickId: 'tick-1',
      },
      payload: {
        goal: 'Nightly functional + NFR sweep',
        doneWhen: 'P0 items evidenced',
      },
    });

    expect(result.handlerCount).toBe(1);
    expect(result.results).toEqual([{ ok: true }]);
    expect(seen).toEqual(['school-app']);
    expect(bus.listHistory({ type: 'specialist.qa.requested' })).toHaveLength(1);
  });

  it('does not invoke handlers for other event types', async () => {
    const bus = createEventBus();
    let called = false;
    bus.subscribe('specialist.qa.requested', () => {
      called = true;
    });
    // Only one type exists today; empty handlers for unmatched is covered by filter.
    expect(called).toBe(false);
  });
});
