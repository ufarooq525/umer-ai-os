import type { ResolvedProject } from './types.js';

const DEFAULT_SEO_URLS: Record<string, { production: string; local?: string }> = {
  'cursive-generator': {
    production: 'https://www.cursive-font-generator.com',
    local: 'http://127.0.0.1:3000',
  },
  'flow-tool-works': {
    production: 'https://toolworks.app',
    local: 'http://127.0.0.1:5173',
  },
};

export function resolveSeoProbeUrls(project: ResolvedProject): string[] {
  const envKey = `UMER_SEO_BASE_URL_${project.projectId.replace(/-/g, '_').toUpperCase()}`;
  const fromEnv = process.env[envKey] ?? process.env.UMER_SEO_BASE_URL;
  const configured = project.seoBaseUrl;
  const defaults = DEFAULT_SEO_URLS[project.projectId];
  const urls = [
    fromEnv,
    configured,
    defaults?.local,
    defaults?.production,
    project.seoLocalUrl,
  ].filter((u): u is string => Boolean(u && u.length > 0));
  return [...new Set(urls)];
}

export async function pickReachableSeoUrl(
  candidates: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; html: string; finalUrl: string } | null> {
  for (const candidate of candidates) {
    try {
      const response = await fetchImpl(candidate, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
        headers: { 'user-agent': 'UmerAI-OS-SEO-Verify/1.0' },
      });
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        // still try — some servers omit content-type
      }
      const html = await response.text();
      if (html.length < 50) continue;
      return { url: candidate, html, finalUrl: response.url || candidate };
    } catch {
      /* try next */
    }
  }
  return null;
}
