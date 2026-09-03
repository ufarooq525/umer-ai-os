import { describe, expect, it, vi } from 'vitest';
import { createSearchWebTool } from './search-web.js';

const ctx = { specialistId: 's', workPackageId: 'wp-1', correlationId: 'corr-1', toolCallId: 'call_1' };

describe('createSearchWebTool', () => {
  it('calls the fixed scoped endpoint with the query and maps results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Heading: 'Healthcare SaaS',
          AbstractText: 'Healthcare SaaS is a growing market.',
          AbstractURL: 'https://example.com/healthcare-saas',
          RelatedTopics: [{ Text: 'Telehealth platforms - remote care software', FirstURL: 'https://example.com/telehealth' }],
        }),
        { status: 200 },
      ),
    );
    const tool = createSearchWebTool({ fetchImpl });

    const output = await tool.handler({ query: 'profitable SaaS opportunities in healthcare' }, ctx);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchImpl.mock.calls[0] as [URL];
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://api.duckduckgo.com/');
    expect(calledUrl.searchParams.get('q')).toBe('profitable SaaS opportunities in healthcare');
    expect(output.query).toBe('profitable SaaS opportunities in healthcare');
    expect(output.results[0]).toMatchObject({
      title: 'Healthcare SaaS',
      snippet: 'Healthcare SaaS is a growing market.',
      url: 'https://example.com/healthcare-saas',
    });
    expect(output.results.length).toBeGreaterThan(1);
  });

  it('rejects input missing a query', async () => {
    const tool = createSearchWebTool({ fetchImpl: vi.fn() });
    await expect(tool.handler({}, ctx)).rejects.toThrow(/query/);
  });

  it('throws on a non-2xx upstream response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const tool = createSearchWebTool({ fetchImpl });
    await expect(tool.handler({ query: 'x' }, ctx)).rejects.toThrow(/503/);
  });

  it('caps results at maxResults', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          RelatedTopics: Array.from({ length: 10 }, (_, i) => ({ Text: `Topic ${i}`, FirstURL: `https://example.com/${i}` })),
        }),
        { status: 200 },
      ),
    );
    const tool = createSearchWebTool({ fetchImpl, maxResults: 3 });
    const output = await tool.handler({ query: 'x' }, ctx);
    expect(output.results).toHaveLength(3);
  });
});
