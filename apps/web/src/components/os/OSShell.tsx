'use client';

import type { ReactNode } from 'react';
import { colors, fonts } from '@umer/ui';
import { GridBackground } from './GridBackground';
import { PageEnter } from './PageEnter';
import { Sidebar } from './Sidebar';
import { FounderChat } from './FounderChat';

export function OSShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: colors.text, fontFamily: fonts.sans }}>
      <style>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { background: #0b0d12; overflow-x: hidden; }
        button, a { -webkit-tap-highlight-color: transparent; }
        .os-main { position:relative; z-index:1; flex:1; min-width:0; padding:30px clamp(16px,3vw,42px) 72px; }
        .os-content { width:100%; max-width:1400px; margin:0 auto; }
        @media (max-width:900px) { .os-main { padding:78px 14px 48px; } }
        @media (max-width:600px) { .os-main { padding:70px 12px 40px; } }
        @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; } }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          background: `radial-gradient(900px 500px at 8% -8%, ${colors.accentSoft}, transparent 60%), radial-gradient(700px 500px at 92% 8%, rgba(98,89,255,.07), transparent 62%), linear-gradient(180deg, #12151d 0%, ${colors.bg} 48%, #0b0d12 100%)`,
        }}
      >
        <GridBackground />
        <Sidebar />
        <FounderChat />
        <main className="os-main">
          <div className="os-content">
            <PageEnter>{children}</PageEnter>
          </div>
        </main>
      </div>
    </div>
  );
}
