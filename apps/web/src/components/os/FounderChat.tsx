'use client';

import { useEffect, useRef, useState } from 'react';
import { colors, fonts, radii } from '@umer/ui';

type Turn = { role: 'user' | 'assistant'; content: string };

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

export function FounderChat() {
  const narrow = useNarrow();
  const viewportHeight = useViewportHeight();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, open, busy]);

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

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/founder-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error ?? 'No answer');
      setTurns([...next, { role: 'assistant', content: payload.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setBusy(false);
    }
  }

  function speak() {
    const Speech =
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ??
      (window as Window & { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!Speech) {
      setError('This browser cannot take voice. Type the thought instead.');
      return;
    }
    const rec = new Speech();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError('Voice capture failed. Type instead.');
    };
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const said = event.results[0]?.[0]?.transcript ?? '';
      if (said) void send(said);
    };
    rec.start();
  }

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
        width: 'min(420px, calc(100vw - 32px))',
        height: 'min(560px, calc(100vh - 96px))',
        borderRadius: radii.lg,
        zIndex: 50,
      };

  return (
    <>
      {!open || !narrow ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close founder chat' : 'Open founder chat'}
          style={{
            position: 'fixed',
            right: 'max(16px, env(safe-area-inset-right))',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 55,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.accent,
            color: colors.accentText,
            borderRadius: 999,
            padding: narrow ? '12px 16px' : '10px 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {open ? 'Close think' : 'Think with me'}
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Founder chat"
          style={{
            ...sheetStyle,
            display: 'flex',
            flexDirection: 'column',
            border: narrow ? 'none' : `1px solid ${colors.borderStrong}`,
            background: colors.surface,
            color: colors.text,
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
              <strong style={{ fontSize: 15 }}>Dump the thought</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                Voice or type. Answers from your local model — it cannot open records yet.
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
                Example: “that Umrah shop’s website on the Maps photo is dead — should we still pitch a storefront?”
              </p>
            ) : null}
            {turns.map((turn, i) => (
              <div
                key={`${turn.role}-${i}`}
                style={{
                  justifySelf: turn.role === 'user' ? 'end' : 'start',
                  maxWidth: '92%',
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
            ))}
            {busy ? <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>Thinking…</div> : null}
            {error ? <div style={{ fontSize: 13, color: colors.danger, lineHeight: 1.45 }}>{error}</div> : null}
            <div ref={endRef} />
          </div>

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
              rows={narrow ? 2 : 2}
              enterKeyHint="send"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="What’s in your head?"
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
              }}
            />
            <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
              <button
                type="button"
                onClick={speak}
                aria-label="Speak"
                style={{
                  border: `1px solid ${colors.border}`,
                  background: listening ? colors.accentSoft : 'transparent',
                  color: colors.text,
                  borderRadius: radii.sm,
                  padding: '0 14px',
                  minHeight: 44,
                  minWidth: 52,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {listening ? 'Listening' : 'Mic'}
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                style={{
                  border: 'none',
                  background: colors.accent,
                  color: colors.accentText,
                  borderRadius: radii.sm,
                  padding: '0 16px',
                  minHeight: 44,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: busy || !input.trim() ? 'default' : 'pointer',
                  opacity: busy || !input.trim() ? 0.5 : 1,
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

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
