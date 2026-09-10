import { describe, expect, it } from 'vitest';
import { voiceReducer, type VoiceState } from './state-machine.js';

describe('voiceReducer', () => {
  it('walks the full idle -> listening -> processing -> speaking -> idle path', () => {
    let state: VoiceState = 'idle';
    state = voiceReducer(state, { type: 'START_LISTENING' });
    expect(state).toBe('listening');

    state = voiceReducer(state, { type: 'START_PROCESSING' });
    expect(state).toBe('processing');

    state = voiceReducer(state, { type: 'RESPONSE_READY', willSpeak: true });
    expect(state).toBe('speaking');

    state = voiceReducer(state, { type: 'SPEECH_DONE' });
    expect(state).toBe('idle');
  });

  it('goes straight from processing to idle when there is nothing to speak', () => {
    let state: VoiceState = 'processing';
    state = voiceReducer(state, { type: 'RESPONSE_READY', willSpeak: false });
    expect(state).toBe('idle');
  });

  it('lets a typed message skip listening entirely (idle -> processing)', () => {
    const state = voiceReducer('idle', { type: 'START_PROCESSING' });
    expect(state).toBe('processing');
  });

  it('returns to idle when the user clicks Stop Speaking mid-response', () => {
    const state = voiceReducer('speaking', { type: 'STOP_SPEAKING' });
    expect(state).toBe('idle');
  });

  it('does not cancel the conversation when speech is stopped -- only the audio state changes', () => {
    // STOP_SPEAKING only ever transitions the 'speaking' state; it has no
    // effect on 'processing', proving it cannot reach back and cancel an
    // in-flight JARVIS request.
    const state = voiceReducer('processing', { type: 'STOP_SPEAKING' });
    expect(state).toBe('processing');
  });

  it('moves any state to error on ERROR and back to idle on RESET', () => {
    for (const from of ['listening', 'processing', 'speaking'] as VoiceState[]) {
      expect(voiceReducer(from, { type: 'ERROR' })).toBe('error');
    }
    expect(voiceReducer('error', { type: 'RESET' })).toBe('idle');
  });

  it('lets the user start a fresh voice turn directly from the error state', () => {
    expect(voiceReducer('error', { type: 'START_LISTENING' })).toBe('listening');
  });

  it('ignores an event that has no transition for the current state', () => {
    expect(voiceReducer('idle', { type: 'SPEECH_DONE' })).toBe('idle');
  });

  it('ignores a stray RESPONSE_READY that does not follow processing', () => {
    expect(voiceReducer('idle', { type: 'RESPONSE_READY', willSpeak: true })).toBe('idle');
  });
});
