import { describe, expect, it } from 'vitest';
import {
  canTransition,
  assertTransition,
  isTerminalStatus,
  isActiveStatus,
} from './state-machine.js';
import { OrchestrationError } from './errors.js';

describe('state machine', () => {
  it('allows legal transitions', () => {
    expect(canTransition('Draft', 'Queued')).toBe(true);
    expect(canTransition('Queued', 'Dispatched')).toBe(true);
    expect(canTransition('Running', 'AwaitingReview')).toBe(true);
    expect(canTransition('Failed', 'Queued')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('Accepted', 'Queued')).toBe(false);
    expect(canTransition('Draft', 'Running')).toBe(false);
  });

  it('assertTransition throws OrchestrationError', () => {
    expect(() => assertTransition('Accepted', 'Queued')).toThrow(OrchestrationError);
  });

  it('classifies terminal and active statuses', () => {
    expect(isTerminalStatus('Accepted')).toBe(true);
    expect(isTerminalStatus('Cancelled')).toBe(true);
    expect(isActiveStatus('Running')).toBe(true);
    expect(isActiveStatus('Failed')).toBe(false);
  });
});
