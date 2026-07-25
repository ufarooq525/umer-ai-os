import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: '"Sora", "Segoe UI", system-ui, sans-serif',
          background: '#12141a',
          color: '#f2f0eb',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
