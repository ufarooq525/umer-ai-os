import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoiceOutput, isSpeechSynthesisSupported, pickPreferredVoice } from './voice-output.js';

type FakeUtterance = {
  text: string;
  rate?: number;
  voice?: SpeechSynthesisVoice;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function installFakeSpeechSynthesis() {
  const spoken: FakeUtterance[] = [];
  const fakeSynth = {
    speaking: false,
    getVoices: () => [] as SpeechSynthesisVoice[],
    speak: vi.fn((utterance: FakeUtterance) => {
      spoken.push(utterance);
      fakeSynth.speaking = true;
      utterance.onstart?.();
    }),
    cancel: vi.fn(() => {
      fakeSynth.speaking = false;
    }),
    pause: vi.fn(),
    resume: vi.fn(),
  };
  class FakeSpeechSynthesisUtterance implements FakeUtterance {
    text: string;
    rate = 1;
    voice: SpeechSynthesisVoice | undefined;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  (globalThis as Record<string, unknown>).speechSynthesis = fakeSynth;
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
  return { fakeSynth, spoken };
}

function removeFakeSpeechSynthesis() {
  delete (globalThis as Record<string, unknown>).speechSynthesis;
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
}

describe('voice-output (browser TTS abstraction)', () => {
  afterEach(() => {
    removeFakeSpeechSynthesis();
    vi.restoreAllMocks();
  });

  it('reports unsupported and never throws when the browser has no speechSynthesis', () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
    const output = createVoiceOutput();
    expect(output.isSupported()).toBe(false);
    expect(() => output.speak('hello')).not.toThrow();
    expect(output.isSpeaking()).toBe(false);
  });

  it('speaks text through SpeechSynthesisUtterance when supported', () => {
    const { fakeSynth, spoken } = installFakeSpeechSynthesis();
    const output = createVoiceOutput();
    expect(output.isSupported()).toBe(true);
    output.speak('hello there');
    expect(fakeSynth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0]?.text).toBe('hello there');
    expect(output.isSpeaking()).toBe(true);
  });

  it('does not speak empty or whitespace-only text', () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const output = createVoiceOutput();
    output.speak('   ');
    expect(fakeSynth.speak).not.toHaveBeenCalled();
  });

  it('calls onEnd exactly once when the utterance finishes, and stops reporting as speaking', () => {
    const { spoken } = installFakeSpeechSynthesis();
    const output = createVoiceOutput();
    const onEnd = vi.fn();
    output.speak('done soon', onEnd);
    spoken[0]?.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(output.isSpeaking()).toBe(false);
  });

  it('stop() cancels playback immediately (Stop Speaking)', () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const output = createVoiceOutput();
    output.speak('a long response');
    output.stop();
    expect(fakeSynth.cancel).toHaveBeenCalled();
    expect(output.isSpeaking()).toBe(false);
  });

  it('cancels any previous utterance before speaking a new one, so responses never overlap', () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const output = createVoiceOutput();
    output.speak('first');
    output.speak('second');
    expect(fakeSynth.cancel).toHaveBeenCalled();
    expect(fakeSynth.speak).toHaveBeenCalledTimes(2);
  });
});

describe('pickPreferredVoice', () => {
  const voice = (lang: string, isDefault = false): SpeechSynthesisVoice =>
    ({ lang, default: isDefault, name: lang, localService: true, voiceURI: lang }) as SpeechSynthesisVoice;

  it('returns undefined when there are no voices, so the caller can fall back to the browser default', () => {
    expect(pickPreferredVoice([])).toBeUndefined();
  });

  it('prefers en-US when available', () => {
    const voices = [voice('fr-FR'), voice('en-US'), voice('en-GB')];
    expect(pickPreferredVoice(voices)?.lang).toBe('en-US');
  });

  it('falls back to any English voice when en-US is not present', () => {
    const voices = [voice('fr-FR'), voice('en-GB')];
    expect(pickPreferredVoice(voices)?.lang).toBe('en-GB');
  });

  it('falls back to the default voice, then the first voice, when no English voice exists', () => {
    expect(pickPreferredVoice([voice('fr-FR'), voice('de-DE', true)])?.lang).toBe('de-DE');
    expect(pickPreferredVoice([voice('fr-FR'), voice('de-DE')])?.lang).toBe('fr-FR');
  });
});
