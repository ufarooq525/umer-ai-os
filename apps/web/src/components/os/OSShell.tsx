'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { colors, fonts } from '@umer/ui';
import { GridBackground } from './GridBackground';
import { PageEnter } from './PageEnter';
import { Sidebar } from './Sidebar';
import { GlobalHeader } from './GlobalHeader';
import { CommandPalette } from './CommandPalette';
import { JarvisChat } from './JarvisChat';

export function OSShell({ children }: { children: ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div style={{ color: colors.text, fontFamily: fonts.sans }}>
      <style>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { background: #090b10; overflow-x: hidden; margin: 0; padding: 0; }
        button, a { -webkit-tap-highlight-color: transparent; }
        .os-layout { min-height: 100vh; display: flex; background: radial-gradient(1000px 550px at 10% -10%, rgba(232, 160, 84, 0.09), transparent 60%), radial-gradient(800px 500px at 95% 5%, rgba(98, 89, 255, 0.06), transparent 65%), linear-gradient(180deg, #0f121a 0%, #090b10 100%); }
        .os-main-container { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; z-index: 1; }
        .os-main { flex: 1; min-width: 0; padding: 24px clamp(16px, 2.5vw, 36px) 64px; }
        .os-content { width: 100%; max-width: 1480px; margin: 0 auto; min-width: 0; }
        /* Grid/flex children default to a min-content minimum, which lets a nested
           auto-fit/minmax grid or an unwrapped row force its ancestor grid track
           wider than the page (a "grid blowout"). Since body has overflow-x:hidden,
           that overflow doesn't scroll — it silently clips content past the edge.
           Resetting the automatic minimum to 0 for every descendant makes width
           come from the actual available space instead. */
        .os-content, .os-content * { min-width: 0; overflow-wrap: break-word; }
        @media (max-width: 900px) {
          .os-main { padding: 18px 12px 48px; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
      <div className="os-layout">
        <GridBackground />
        <Sidebar />
        <JarvisChat />
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

        <div className="os-main-container">
          <GlobalHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
          <main className="os-main">
            <div className="os-content">
              <PageEnter>{children}</PageEnter>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
