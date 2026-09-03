'use client';

import { useEffect, useRef, useState } from 'react';

export type PollingState<T> = {
  data: T;
  error: string | null;
  isRefreshing: boolean;
};

/**
 * Polls `fetcher` every `intervalMs`, starting from server-rendered
 * `initialData` so the first paint never flashes a loading state. Matches
 * the repo's existing polling convention (WorkerSupervisor.tsx's
 * useEffect + setInterval), just shared so every "live" panel doesn't
 * reimplement it.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, initialData: T): PollingState<T> {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      setIsRefreshing(true);
      try {
        const next = await fetcherRef.current();
        if (alive) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to refresh');
      } finally {
        if (alive) setIsRefreshing(false);
      }
    };
    const timer = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return { data, error, isRefreshing };
}
