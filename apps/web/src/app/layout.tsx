import { AppShell } from '@/components/AppShell';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Georgia, serif', margin: 0 }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
