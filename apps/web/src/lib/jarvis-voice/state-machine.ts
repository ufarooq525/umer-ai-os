/**
 * Pure voice-conversation state machine for JarvisChat.
 *
 * idle -> listening -> processing -> speaking -> idle
 *
 * Recording and speaking are deliberately independent: nothing here ever
 * transitions a state after a fixed duration. Every transition is caused by
 * an explicit event (user action, network result, or a real browser event).
 */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export type VoiceEvent =
  | { type: 'START_LISTENING' }
  | { type: 'START_PROCESSING' }
  | { type: 'RESPONSE_READY'; willSpeak: boolean }
  | { type: 'SPEECH_DONE' }
  | { type: 'STOP_SPEAKING' }
  | { type: 'ERROR' }
  | { type: 'RESET' };

type TransitionMap = Partial<Record<VoiceEvent['type'], VoiceState>>;

const TRANSITIONS: Record<VoiceState, TransitionMap> = {
  idle: { START_LISTENING: 'listening', START_PROCESSING: 'processing' },
  listening: { START_PROCESSING: 'processing', RESET: 'idle', ERROR: 'error' },
  processing: { ERROR: 'error', RESET: 'idle' },
  speaking: { SPEECH_DONE: 'idle', STOP_SPEAKING: 'idle', ERROR: 'error', RESET: 'idle' },
  error: { RESET: 'idle', START_LISTENING: 'listening', START_PROCESSING: 'processing' },
};

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  if (event.type === 'RESPONSE_READY') {
    if (state !== 'processing') return state;
    return event.willSpeak ? 'speaking' : 'idle';
  }
  return TRANSITIONS[state][event.type] ?? state;
}
