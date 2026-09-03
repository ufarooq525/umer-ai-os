import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export type SearchWebInput = {
  query: string;
};

export type SearchWebResultItem = {
  title: string;
  snippet: string;
  url?: string;
};

export type SearchWebOutput = {
  query: string;
  results: SearchWebResultItem[];
};

export type SearchWebToolOptions = {
  /** Scoped, fixed endpoint — the model never gets to choose an arbitrary URL. */
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResults?: number;
};

function isSearchWebInput(value: unknown): value is SearchWebInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { query?: unknown }).query === 'string' &&
    (value as { query: string }).query.trim().length > 0
  );
}

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
};

function flattenRelatedTopics(
  topics: DuckDuckGoResponse['RelatedTopics'],
): Array<{ Text?: string; FirstURL?: string }> {
  const flat: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const entry of topics ?? []) {
    if ('Topics' in entry && Array.isArray(entry.Topics)) {
      flat.push(...entry.Topics);
    } else if ('Text' in entry) {
      flat.push(entry);
    }
  }
  return flat;
}

/**
 * search_web — a narrow, scoped web-search adapter. Not general HTTP access:
 * the model supplies a query string only; the tool always calls the same
 * fixed public endpoint (DuckDuckGo's keyless Instant Answer API).
 */
export function createSearchWebTool(options: SearchWebToolOptions = {}): ToolDefinition<SearchWebOutput> {
  const endpoint = options.endpoint ?? 'https://api.duckduckgo.com/';
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxResults = options.maxResults ?? 5;

  return {
    name: 'search_web',
    description:
      'Search the public web for a short factual query and return brief result snippets. ' +
      'Use it to gather external market/technical information you do not already know.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    timeoutMs: options.timeoutMs ?? 15_000,
    async handler(input: unknown, ctx: ToolExecutionContext): Promise<SearchWebOutput> {
      if (!isSearchWebInput(input)) {
        throw new Error('search_web requires a non-empty string "query" argument');
      }

      const url = new URL(endpoint);
      url.searchParams.set('q', input.query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('no_html', '1');
      url.searchParams.set('skip_disambig', '1');

      const response = await fetchImpl(url, { signal: ctx.signal });
      if (!response.ok) {
        throw new Error(`search_web upstream returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as DuckDuckGoResponse;
      const results: SearchWebResultItem[] = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading ?? input.query,
          snippet: data.AbstractText,
          url: data.AbstractURL,
        });
      }

      for (const topic of flattenRelatedTopics(data.RelatedTopics)) {
        if (results.length >= maxResults) {
          break;
        }
        if (topic.Text) {
          results.push({ title: topic.Text.split(' - ')[0] ?? topic.Text, snippet: topic.Text, url: topic.FirstURL });
        }
      }

      return { query: input.query, results: results.slice(0, maxResults) };
    },
  };
}
