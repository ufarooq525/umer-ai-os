'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { colors, fonts, radii } from '@umer/ui';
import { voiceReducer, type VoiceState } from '@/lib/jarvis-voice/state-machine';
import { JarvisSpeechRecognizer } from '@/lib/jarvis-voice/speech-recognition';
import { createVoiceOutput, type JarvisVoiceOutput } from '@/lib/jarvis-voice/voice-output';
import { SpokenTracker } from '@/lib/jarvis-voice/dedupe';

type ToolCall = { name: string; arguments?: unknown };
type Turn = { id: string; role: 'user' | 'assistant'; content: string; toolCalls?: ToolCall[] };

const SESSION_KEY = 'umer.jarvis.sessionId';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function useNarrow(maxWidth = 720) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [maxWidth]);
  return narrow;
}

function useViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      setHeight(window.visualViewport?.height ?? window.innerHeight);
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return height;
}

function statusText(state: VoiceState, interimText: string, errorMessage: string | null): string {
  switch (state) {
    case 'listening':
      return interimText ? `Listening… “${interimText}”` : 'Listening…';
    case 'processing':
      return 'JARVIS is thinking…';
    case 'speaking':
      return 'JARVIS is speaking…';
    case 'error':
      return errorMessage ?? 'Something went wrong.';
    default:
      return 'Ask about agents, work, opportunities, or why something failed. It reads the real control plane.';
  }
}

export function JarvisChat() {
  const narrow = useNarrow();
  const viewportHeight = useViewportHeight();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voiceState, voiceDispatch] = useReducer(voiceReducer, 'idle' as VoiceState);
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const recognizerRef = useRef<JarvisSpeechRecognizer | null>(null);
  const voiceOutputRef = useRef<JarvisVoiceOutput | null>(null);
  const spokenTrackerRef = useRef(new SpokenTracker());
  const pendingVoiceErrorRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      if (stored) sessionIdRef.current = stored;
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, open, voiceState]);

  useEffect(() => {
    if (!open || !narrow) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, narrow]);

  useEffect(() => {
    if (open) fieldRef.current?.focus();
  }, [open]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content) return;
    setTurns((prev) => [...prev, { id: newId(), role: 'user', content }]);
    setInput('');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, message: content }),
      });
      const payload = (await response.json()) as {
        assistantMessage?: string;
        sessionId?: string;
        toolCalls?: ToolCall[];
        correlationId?: string;
        error?: string;
      };
      if (!response.ok || !payload.assistantMessage) throw new Error(payload.error ?? 'No answer');
      if (payload.sessionId && payload.sessionId !== sessionIdRef.current) {
        sessionIdRef.current = payload.sessionId;
        try {
          window.sessionStorage.setItem(SESSION_KEY, payload.sessionId);
        } catch {}
      }
      const assistantId = payload.correlationId ?? newId();
      const assistantMessage = payload.assistantMessage;
      setTurns((prev) => [...prev, { id: assistantId, role: 'assistant', content: assistantMessage, toolCalls: payload.toolCalls }]);

      const output = voiceOutputRef.current;
      const willSpeak = Boolean(output?.isSupported()) && spokenTrackerRef.current.shouldSpeak(assistantId);
      voiceDispatch({ type: 'RESPONSE_READY', willSpeak });
      if (willSpeak && output) {
        spokenTrackerRef.current.markSpoken(assistantId);
        output.speak(assistantMessage, () => voiceDispatch({ type: 'SPEECH_DONE' }));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'JARVIS failed to respond');
      voiceDispatch({ type: 'ERROR' });
    }
  }, []);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const recognizer = new JarvisSpeechRecognizer({
      onStart: () => voiceDispatch({ type: 'START_LISTENING' }),
      onInterim: (text) => setInterimText(text),
      onStop: (finalTranscript) => {
        setInterimText('');
        const hadError = pendingVoiceErrorRef.current;
        pendingVoiceErrorRef.current = false;
        if (hadError) return; // stay in 'error' so the message is actually seen
        if (!finalTranscript.trim()) {
          voiceDispatch({ type: 'RESET' });
          return;
        }
        voiceDispatch({ type: 'START_PROCESSING' });
        void sendRef.current(finalTranscript);
      },
      onError: (_reason, message) => {
        pendingVoiceErrorRef.current = true;
        setInterimText('');
        setErrorMessage(message);
        voiceDispatch({ type: 'ERROR' });
      },
    });
    recognizerRef.current = recognizer;
    setMicSupported(recognizer.isSupported());

    const output = createVoiceOutput(0.95);
    voiceOutputRef.current = output;
    setTtsSupported(output.isSupported());

    return () => {
      recognizer.abort();
      output.stop();
    };
  }, []);

  function handleMicClick() {
    if (voiceState !== 'idle' && voiceState !== 'error') return;
    setErrorMessage(null);
    recognizerRef.current?.start();
  }

  function handleStopListening() {
    recognizerRef.current?.stop();
  }

  function handleStopSpeaking() {
    voiceOutputRef.current?.stop();
    voiceDispatch({ type: 'STOP_SPEAKING' });
  }

  const inputLocked = voiceState === 'listening' || voiceState === 'processing' || voiceState === 'speaking';

  const sheetStyle = narrow
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        borderRadius: 0,
        zIndex: 60,
      }
    : {
        position: 'fixed' as const,
        right: 20,
        bottom: 68,
        width: 'min(440px, calc(100vw - 32px))',
        height: 'min(600px, calc(100vh - 96px))',
        borderRadius: radii.lg,
        zIndex: 50,
      };

  return (
    <>
      <style>{`
        @keyframes jarvis-pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.35); opacity: .45; } }
        @keyframes jarvis-bar { 0%,100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
        .jarvis-mic-dot { animation: jarvis-pulse 1.1s ease-in-out infinite; }
        .jarvis-bars span { display: inline-block; width: 3px; height: 12px; margin: 0 1px; border-radius: 2px; background: currentColor; animation: jarvis-bar .9s ease-in-out infinite; }
        .jarvis-bars span:nth-child(2) { animation-delay: .15s; }
        .jarvis-bars span:nth-child(3) { animation-delay: .3s; }
      `}</style>

      {!open || !narrow ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close JARVIS' : 'Open JARVIS'}
          style={{
            position: 'fixed',
            right: 'max(16px, env(safe-area-inset-right))',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 55,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.accent,
            color: colors.accentText,
            borderRadius: 999,
            padding: narrow ? '12px 18px' : '10px 18px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            minHeight: 44,
            boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          }}
        >
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: colors.accentText, opacity: 0.7 }} />
          {open ? 'Close JARVIS' : 'Ask JARVIS'}
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="JARVIS"
          style={{
            ...sheetStyle,
            display: 'flex',
            flexDirection: 'column',
            border: narrow ? 'none' : `1px solid ${colors.borderStrong}`,
            background: colors.surface,
            color: colors.text,
            boxShadow: narrow ? 'none' : '0 24px 60px rgba(0,0,0,.35)',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              paddingTop: 'max(12px, env(safe-area-inset-top))',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 15 }}>JARVIS</strong>
                {voiceState === 'listening' ? (
                  <span className="jarvis-mic-dot" aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: colors.danger }} />
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: voiceState === 'error' ? colors.danger : colors.muted,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {voiceState === 'speaking' ? (
                  <span className="jarvis-bars" aria-hidden style={{ color: colors.accent }}>
                    <span />
                    <span />
                    <span />
                  </span>
                ) : null}
                <span>{statusText(voiceState, interimText, errorMessage)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.text,
                borderRadius: radii.sm,
                padding: '8px 12px',
                minHeight: 40,
                cursor: 'pointer',
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: 14,
              display: 'grid',
              gap: 10,
              alignContent: 'start',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {turns.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: colors.muted, lineHeight: 1.55 }}>
                Try: “what needs my attention right now?” or “why is that work package stuck — run root cause analysis.”
              </p>
            ) : null}
            {turns.map((turn) => (
              <div key={turn.id} style={{ justifySelf: turn.role === 'user' ? 'end' : 'start', maxWidth: '92%' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: radii.md,
                    background: turn.role === 'user' ? colors.accentSoft : colors.surfaceRaised,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {turn.content}
                </div>
                {turn.toolCalls && turn.toolCalls.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {turn.toolCalls.map((call, ci) => (
                      <span
                        key={`${call.name}-${ci}`}
                        title={JSON.stringify(call.arguments ?? {})}
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 10,
                          color: colors.muted,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 999,
                          padding: '3px 8px',
                        }}
                      >
                        ⚙ {call.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {voiceState === 'processing' ? (
              <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>JARVIS is thinking…</div>
            ) : null}
            {voiceState === 'error' && errorMessage ? (
              <div style={{ fontSize: 13, color: colors.danger, lineHeight: 1.45 }}>{errorMessage}</div>
            ) : null}
            {!micSupported ? (
              <div style={{ fontSize: 11.5, color: colors.muted, lineHeight: 1.5 }}>
                Voice input isn&apos;t supported by this browser. You can still type to JARVIS.
              </div>
            ) : null}
            {!ttsSupported ? (
              <div style={{ fontSize: 11.5, color: colors.muted, lineHeight: 1.5 }}>
                Voice responses aren&apos;t supported by this browser. JARVIS will continue responding with text.
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {voiceState === 'speaking' ? (
            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleStopSpeaking}
                style={{
                  width: '100%',
                  border: `1px solid ${colors.borderStrong}`,
                  background: colors.surfaceRaised,
                  color: colors.text,
                  borderRadius: radii.sm,
                  padding: '10px 12px',
                  minHeight: 40,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ⏹ Stop Speaking
              </button>
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              padding: 12,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              borderTop: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}
          >
            <textarea
              ref={fieldRef}
              value={input}
              rows={2}
              enterKeyHint="send"
              disabled={inputLocked}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask JARVIS anything…"
              style={{
                flex: '1 1 180px',
                minWidth: 0,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: radii.sm,
                border: `1px solid ${colors.border}`,
                background: colors.surfaceRaised,
                color: colors.text,
                fontSize: 16,
                fontFamily: fonts.sans,
                lineHeight: 1.4,
                resize: 'none',
                opacity: inputLocked ? 0.6 : 1,
              }}
            />
            <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
              {micSupported ? (
                voiceState === 'listening' ? (
                  <button
                    type="button"
                    onClick={handleStopListening}
                    aria-label="Stop recording"
                    style={{
                      border: `1px solid ${colors.danger}`,
                      background: 'rgba(240,113,120,0.12)',
                      color: colors.danger,
                      borderRadius: radii.sm,
                      padding: '0 14px',
                      minHeight: 44,
                      minWidth: 64,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={voiceState === 'processing' || voiceState === 'speaking'}
                    aria-label="Start voice input"
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: 'transparent',
                      color: colors.text,
                      borderRadius: radii.sm,
                      padding: '0 14px',
                      minHeight: 44,
                      minWidth: 52,
                      cursor: voiceState === 'processing' || voiceState === 'speaking' ? 'default' : 'pointer',
                      opacity: voiceState === 'processing' || voiceState === 'speaking' ? 0.5 : 1,
                      fontSize: 13,
                    }}
                  >
                    Mic
                  </button>
                )
              ) : null}
              <button
                type="submit"
                disabled={inputLocked || !input.trim()}
                style={{
                  border: 'none',
                  background: colors.accent,
                  color: colors.accentText,
                  borderRadius: radii.sm,
                  padding: '0 16px',
                  minHeight: 44,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: inputLocked || !input.trim() ? 'default' : 'pointer',
                  opacity: inputLocked || !input.trim() ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
