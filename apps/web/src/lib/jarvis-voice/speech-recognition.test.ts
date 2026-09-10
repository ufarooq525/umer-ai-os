import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JarvisSpeechRecognizer, isSpeechRecognitionSupported } from './speech-recognition.js';

type FakeResultPart = { transcript: string };
type FakeResult = FakeResultPart[] & { isFinal: boolean };
type FakeResultEvent = { resultIndex: number; results: FakeResult[] };

function finalResult(transcript: string): FakeResult {
  const parts = [{ transcript }] as FakeResult;
  parts.isFinal = true;
  return parts;
}

function interimResult(transcript: string): FakeResult {
  const parts = [{ transcript }] as FakeResult;
  parts.isFinal = false;
  return parts;
}

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: FakeResultEvent) => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start(): void {
    this.onstart?.();
  }

  stop(): void {
    this.onend?.();
  }

  abort(): void {}

  emitFinal(transcript: string): void {
    this.onresult?.({ resultIndex: 0, results: [finalResult(transcript)] });
  }

  emitInterim(transcript: string): void {
    this.onresult?.({ resultIndex: 0, results: [interimResult(transcript)] });
  }

  emitBrowserEnd(): void {
    // Simulates the browser ending the session on its own (e.g. a silence
    // timeout) -- distinct from stop(), which simulates a user-driven stop.
    this.onend?.();
  }
}

function install() {
  FakeSpeechRecognition.instances = [];
  (globalThis as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition;
}

function uninstall() {
  delete (globalThis as Record<string, unknown>).SpeechRecognition;
  delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
}

describe('JarvisSpeechRecognizer', () => {
  beforeEach(() => install());
  afterEach(() => uninstall());

  it('is supported once a SpeechRecognition constructor exists on the page', () => {
    expect(isSpeechRecognitionSupported()).toBe(true);
    uninstall();
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('starts a continuous, interim-enabled session and reports Listening', () => {
    const onStart = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onStart });
    recognizer.start();
    expect(FakeSpeechRecognition.instances).toHaveLength(1);
    const instance = FakeSpeechRecognition.instances[0]!;
    expect(instance.continuous).toBe(true);
    expect(instance.interimResults).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(recognizer.isActive()).toBe(true);
  });

  it('does NOT stop after a final result arrives -- only Stop or a real failure ends it', () => {
    const recognizer = new JarvisSpeechRecognizer({});
    recognizer.start();
    const instance = FakeSpeechRecognition.instances[0]!;
    instance.emitFinal('hello jarvis');
    instance.emitFinal('this keeps going for a while');
    expect(recognizer.isActive()).toBe(true);
  });

  it('delivers the accumulated transcript only when the user clicks Stop', () => {
    const onStop = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onStop });
    recognizer.start();
    const instance = FakeSpeechRecognition.instances[0]!;
    instance.emitFinal('what needs my attention');
    instance.emitFinal('right now');
    recognizer.stop();
    expect(onStop).toHaveBeenCalledWith('what needs my attention right now');
    expect(recognizer.isActive()).toBe(false);
  });

  it('surfaces interim text while listening, without finalizing it', () => {
    const onInterim = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onInterim });
    recognizer.start();
    FakeSpeechRecognition.instances[0]!.emitInterim('what needs');
    expect(onInterim).toHaveBeenCalledWith('what needs');
  });

  it('prevents a second, overlapping recording session', () => {
    const recognizer = new JarvisSpeechRecognizer({});
    recognizer.start();
    recognizer.start();
    expect(FakeSpeechRecognition.instances).toHaveLength(1);
  });

  it('auto-restarts transparently when the browser ends the session on its own before the user clicks Stop', () => {
    const onStop = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onStop });
    recognizer.start();
    FakeSpeechRecognition.instances[0]!.emitBrowserEnd();
    // A second, fresh session should have started automatically -- this is
    // exactly the "recording stopped too quickly" bug: the browser's own
    // silence timeout must never be treated as the user stopping.
    expect(FakeSpeechRecognition.instances).toHaveLength(2);
    expect(recognizer.isActive()).toBe(true);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('preserves the transcript across a silent auto-restart', () => {
    const onStop = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onStop });
    recognizer.start();
    FakeSpeechRecognition.instances[0]!.emitFinal('first half');
    FakeSpeechRecognition.instances[0]!.emitBrowserEnd();
    FakeSpeechRecognition.instances[1]!.emitFinal('second half');
    recognizer.stop();
    expect(onStop).toHaveBeenCalledWith('first half second half');
  });

  it('gives up after repeated silent endings and surfaces a friendly error instead of restarting forever', () => {
    const onError = vi.fn();
    const onStop = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onError, onStop });
    recognizer.start();
    // Each real browser session only ever fires onend once; keep ending the
    // *current* session until the recognizer itself gives up.
    let guard = 0;
    while (recognizer.isActive() && guard < 20) {
      const last = FakeSpeechRecognition.instances[FakeSpeechRecognition.instances.length - 1]!;
      last.emitBrowserEnd();
      guard += 1;
    }
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('unknown', expect.stringContaining('click the microphone'));
    expect(onStop).toHaveBeenCalledTimes(1);
    // capped, not unbounded
    expect(FakeSpeechRecognition.instances.length).toBeLessThan(20);
  });

  it('maps a permission denial to a human-readable message and does not restart', () => {
    const onError = vi.fn();
    const onStop = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onError, onStop });
    recognizer.start();
    const instance = FakeSpeechRecognition.instances[0]!;
    instance.onerror?.({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(
      'not-allowed',
      'Microphone access was denied. Please allow microphone access in your browser settings.',
    );
    instance.emitBrowserEnd();
    expect(FakeSpeechRecognition.instances).toHaveLength(1); // no restart after a permission failure
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('maps a missing microphone to a human-readable message, never a raw DOMException', () => {
    const onError = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onError });
    recognizer.start();
    FakeSpeechRecognition.instances[0]!.onerror?.({ error: 'audio-capture' });
    expect(onError).toHaveBeenCalledWith(
      'no-microphone',
      'No microphone was found. Please connect a microphone and try again.',
    );
  });

  it('ignores benign no-speech errors -- they do not end the conversation on their own', () => {
    const onError = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onError });
    recognizer.start();
    FakeSpeechRecognition.instances[0]!.onerror?.({ error: 'no-speech' });
    expect(onError).not.toHaveBeenCalled();
    expect(recognizer.isActive()).toBe(true);
  });

  it('reports the exact unsupported-browser message and never constructs a recognizer', () => {
    uninstall();
    const onError = vi.fn();
    const recognizer = new JarvisSpeechRecognizer({ onError });
    recognizer.start();
    expect(onError).toHaveBeenCalledWith(
      'unsupported',
      "Voice input isn't supported by this browser. You can still type to JARVIS.",
    );
    expect(recognizer.isActive()).toBe(false);
  });

  it('allows a second recording after the first one has fully stopped', () => {
    const recognizer = new JarvisSpeechRecognizer({});
    recognizer.start();
    recognizer.stop();
    expect(recognizer.isActive()).toBe(false);
    recognizer.start();
    expect(FakeSpeechRecognition.instances).toHaveLength(2);
    expect(recognizer.isActive()).toBe(true);
  });
});
