'use client';

import type { ReactNode } from 'react';
import { OSShell } from './os/OSShell';

export function AppShell({ children }: { children: ReactNode }) {
  return <OSShell>{children}</OSShell>;
}
