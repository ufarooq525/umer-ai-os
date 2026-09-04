'use client';

import type { ReactNode } from 'react';
import { colors, fonts } from '@umer/ui';
import { GridBackground } from './GridBackground';
import { PageEnter } from './PageEnter';
import { Sidebar } from './Sidebar';
import { FounderChat } from './FounderChat';

export function OSShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: `
          radial-gradient(1200px 500px at 10% -10%, ${colors.accentSoft}, transparent 55%),
          linear-gradient(180deg, #161922 0%, ${colors.bg} 40%, #0e1015 100%)
        `,
        color: colors.text,
        fontFamily: fonts.sans,
      }}
    >
      <GridBackground />
      <Sidebar />
      <FounderChat />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minWidth: 0,
          padding: '32px clamp(16px, 3vw, 40px) 64px',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <PageEnter>{children}</PageEnter>
        </div>
      </main>
    </div>
  );
}
