export type WebsiteProbe = {
  url: string;
  reachable: boolean;
  status: number | null;
  finalUrl: string | null;
  error?: string;
};

export function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function probeWebsite(url: string, timeoutMs = 4000): Promise<WebsiteProbe> {
  const target = normalizeHttpUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'umer-ai-os-website-probe' },
    });
    return {
      url: target,
      reachable: response.ok,
      status: response.status,
      finalUrl: response.url || target,
    };
  } catch (err) {
    return {
      url: target,
      reachable: false,
      status: null,
      finalUrl: null,
      error: err instanceof Error ? err.message : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
