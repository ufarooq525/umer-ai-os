/**
 * JarvisVoiceOutput is the seam between JARVIS and whatever speaks its
 * responses. V1 implements it with the browser-native Web Speech API only
 * (no external dependency). A future production provider (OpenAI, Azure,
 * ElevenLabs, local TTS) can implement the same interface without touching
 * any caller.
 */
export interface JarvisVoiceOutput {
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
  isSupported(): boolean;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Prefers an English voice; never hard-codes a specific voice name. */
export function pickPreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const enUS = voices.find((voice) => voice.lang?.toLowerCase() === 'en-us');
  if (enUS) return enUS;
  const anyEnglish = voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
  if (anyEnglish) return anyEnglish;
  return voices.find((voice) => voice.default) ?? voices[0];
}

class UnsupportedVoiceOutput implements JarvisVoiceOutput {
  speak(): void {}
  stop(): void {}
  pause(): void {}
  resume(): void {}
  isSpeaking(): boolean {
    return false;
  }
  isSupported(): boolean {
    return false;
  }
}

class BrowserVoiceOutput implements JarvisVoiceOutput {
  private speaking = false;

  constructor(private readonly rate: number) {}

  speak(text: string, onEnd?: () => void): void {
    const content = text.trim();
    if (!content) return;
    // Cancel any in-flight utterance first so responses are never queued on
    // top of each other -- only the most recent response is ever audible.
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = this.rate;
    const voice = pickPreferredVoice(speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      this.speaking = true;
    };
    const finish = () => {
      this.speaking = false;
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  }

  stop(): void {
    speechSynthesis.cancel();
    this.speaking = false;
  }

  pause(): void {
    speechSynthesis.pause();
  }

  resume(): void {
    speechSynthesis.resume();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isSupported(): boolean {
    return true;
  }
}

export function createVoiceOutput(rate = 1): JarvisVoiceOutput {
  return isSpeechSynthesisSupported() ? new BrowserVoiceOutput(rate) : new UnsupportedVoiceOutput();
}
