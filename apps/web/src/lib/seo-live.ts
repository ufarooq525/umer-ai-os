export type SeoLiveSignals = {
  url: string;
  reachable: boolean;
  title: string | null;
  description: string | null;
  hasCanonical: boolean;
  https: boolean;
  error?: string;
};

function metaContent(html: string, key: string): string {
  const prop = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const propAlt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["']`, 'i');
  return prop.exec(html)?.[1]?.trim() || propAlt.exec(html)?.[1]?.trim() || '';
}

export function extractLiveSeo(html: string, finalUrl: string): Omit<SeoLiveSignals, 'reachable' | 'error'> {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null;
  const canonical =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ||
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(html)?.[1] ||
    '';
  return {
    url: finalUrl,
    title,
    description: metaContent(html, 'description') || null,
    hasCanonical: Boolean(canonical),
    https: finalUrl.startsWith('https://'),
  };
}

export async function probePublicSeo(url: string, timeoutMs = 2500): Promise<SeoLiveSignals> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'umer-ai-os-seo-probe' },
    });
    const html = await response.text();
    return { ...extractLiveSeo(html, response.url || url), reachable: response.ok };
  } catch (err) {
    return {
      url,
      reachable: false,
      title: null,
      description: null,
      hasCanonical: false,
      https: url.startsWith('https://'),
      error: err instanceof Error ? err.message : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function liveSeoSentence(signals: SeoLiveSignals): string {
  if (!signals.reachable) return 'The public URL did not respond. Search Console is still not connected.';
  const bits = ['Live site is up'];
  if (signals.title) bits.push(`title is “${signals.title}”`);
  else bits.push('title is missing');
  if (!signals.description) bits.push('Google preview text is missing');
  if (!signals.hasCanonical) bits.push('no canonical tag');
  bits.push('clicks and rankings stay unknown until Search Console is connected');
  return `${bits.join('. ')}.`;
}
