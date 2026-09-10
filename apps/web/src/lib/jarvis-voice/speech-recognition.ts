/**
 * Explicit start/stop microphone control built on the browser's native
 * SpeechRecognition API, configured to keep listening until the user
 * clicks Stop -- never on a fixed duration.
 *
 * Chrome and other engines will still end a recognition session on their
 * own after a period of silence (an "actual recording failure" from the
 * browser's point of view, not a timer we impose). When that happens while
 * the user has NOT clicked Stop, this controller transparently restarts
 * the session so listening continues, up to a small safety cap that only
 * guards against a genuinely broken microphone loop.
 */

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const g = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export type RecognizerErrorReason = 'not-allowed' | 'no-microphone' | 'network' | 'unsupported' | 'unknown';

const FRIENDLY_ERRORS: Partial<Record<RecognizerErrorReason, string>> = {
  'not-allowed': 'Microphone access was denied. Please allow microphone access in your browser settings.',
  'no-microphone': 'No microphone was found. Please connect a microphone and try again.',
  network: 'A network error interrupted voice recognition. Please try again.',
  unsupported: "Voice input isn't supported by this browser. You can still type to JARVIS.",
  unknown: 'Voice input stopped unexpectedly. Please click the microphone to try again.',
};

function classifyError(code: string): RecognizerErrorReason {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed';
  if (code === 'audio-capture') return 'no-microphone';
  if (code === 'network') return 'network';
  return 'unknown';
}

export type RecognizerCallbacks = {
  onStart?: () => void;
  onInterim?: (text: string) => void;
  /** Fires once the session has fully ended -- manual stop or a fatal error -- with everything transcribed so far. */
  onStop?: (finalTranscript: string) => void;
  onError?: (reason: RecognizerErrorReason, message: string) => void;
};

const MAX_SILENT_RESTARTS = 6;

export class JarvisSpeechRecognizer {
  private recognition: SpeechRecognitionLike | null = null;
  private active = false;
  private stoppedByUser = false;
  private transcriptParts: string[] = [];
  private restartAttempts = 0;

  constructor(private readonly callbacks: RecognizerCallbacks) {}

  isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return; // never start a second, overlapping session
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      this.callbacks.onError?.('unsupported', FRIENDLY_ERRORS.unsupported!);
      return;
    }
    this.stoppedByUser = false;
    this.transcriptParts = [];
    this.restartAttempts = 0;
    this.beginSession(Ctor);
  }

  /** User-initiated stop: ends the session and delivers the final transcript. */
  stop(): void {
    if (!this.recognition || !this.active) return;
    this.stoppedByUser = true;
    this.recognition.stop();
  }

  /** Hard stop with no result delivery -- component unmount or explicit cancel. */
  abort(): void {
    this.stoppedByUser = true;
    this.recognition?.abort();
    this.recognition = null;
    this.active = false;
  }

  private beginSession(Ctor: SpeechRecognitionConstructor): void {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      this.active = true;
      this.callbacks.onStart?.();
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          const trimmed = text.trim();
          if (trimmed) this.transcriptParts.push(trimmed);
        } else {
          interim += text;
        }
      }
      if (interim) this.callbacks.onInterim?.(interim);
    };

    recognition.onerror = (event) => {
      const code = event.error;
      if (code === 'no-speech') return; // benign in continuous mode; onend decides what happens next
      if (code === 'aborted' && this.stoppedByUser) return; // expected result of our own stop()/abort()
      const reason = classifyError(code);
      if (reason === 'not-allowed' || reason === 'no-microphone') {
        this.stoppedByUser = true; // do not auto-restart on permission/hardware failures
      }
      this.callbacks.onError?.(reason, FRIENDLY_ERRORS[reason] ?? FRIENDLY_ERRORS.unknown!);
    };

    recognition.onend = () => {
      this.active = false;
      if (this.stoppedByUser) {
        this.callbacks.onStop?.(this.transcriptParts.join(' ').trim());
        this.recognition = null;
        return;
      }
      // The browser ended the session on its own (commonly a silence
      // timeout) while the user has not clicked Stop -- restart
      // transparently so recording keeps going until they do.
      if (this.restartAttempts < MAX_SILENT_RESTARTS) {
        this.restartAttempts += 1;
        this.beginSession(Ctor);
        return;
      }
      this.callbacks.onError?.('unknown', FRIENDLY_ERRORS.unknown!);
      this.callbacks.onStop?.(this.transcriptParts.join(' ').trim());
      this.recognition = null;
    };

    this.recognition = recognition;
    recognition.start();
  }
}
