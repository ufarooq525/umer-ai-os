import { describe, expect, it } from 'vitest';
import { SpokenTracker } from './dedupe.js';

describe('SpokenTracker', () => {
  it('allows speaking a message id the first time', () => {
    const tracker = new SpokenTracker();
    expect(tracker.shouldSpeak('corr-1')).toBe(true);
  });

  it('refuses to speak the same message id twice, e.g. across a React re-render', () => {
    const tracker = new SpokenTracker();
    expect(tracker.shouldSpeak('corr-1')).toBe(true);
    tracker.markSpoken('corr-1');
    expect(tracker.shouldSpeak('corr-1')).toBe(false);
    expect(tracker.shouldSpeak('corr-1')).toBe(false);
  });

  it('treats different message ids independently', () => {
    const tracker = new SpokenTracker();
    tracker.markSpoken('corr-1');
    expect(tracker.shouldSpeak('corr-2')).toBe(true);
  });

  it('forgets everything after reset, e.g. a new chat session', () => {
    const tracker = new SpokenTracker();
    tracker.markSpoken('corr-1');
    tracker.reset();
    expect(tracker.shouldSpeak('corr-1')).toBe(true);
  });
});
