'use client';

/**
 * Client entry point for the Company Intelligence Graph page.
 *
 * Owns the live-mode polling and passes a refresh callback to the
 * CompanyIntelligenceGraph component.  Keeping this as a separate 'use client'
 * module means the parent page (page.tsx) stays a React Server Component
 * that server-side-renders the initial graph on first load.
 */

import { useCallback } from 'react';
import { getCompanyGraph, type CompanyGraphData } from '@/lib/control-api';
import { CompanyIntelligenceGraph } from '@/components/os/CompanyIntelligenceGraph';

type Props = {
  initialGraph: CompanyGraphData;
  liveMode?: boolean;
  initialSearch?: string;
};

export function CompanyGraphClient({ initialGraph, liveMode = false, initialSearch }: Props) {
  const refresh = useCallback(async (): Promise<CompanyGraphData> => {
    return getCompanyGraph({ limit: 200 });
  }, []);

  return (
    <CompanyIntelligenceGraph
      initialGraph={initialGraph}
      onRefresh={refresh}
      liveMode={liveMode}
      initialSearch={initialSearch}
    />
  );
}
