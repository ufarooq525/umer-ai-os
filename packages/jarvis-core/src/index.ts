import type {
  ChatMessage,
  LLMProvider,
  ToolCallRequest,
  ToolDefinitionForModel,
} from '@umer/model-routing';

export const packageName = '@umer/jarvis-core' as const;

export type JarvisToolContext = {
  sessionId: string;
  correlationId: string;
  signal?: AbortSignal;
};

export type JarvisTool = ToolDefinitionForModel & {
  execute: (input: unknown, context: JarvisToolContext) => Promise<unknown>;
};

export type JarvisTurn = {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: Array<{ name: string; arguments: unknown; result?: unknown; error?: string }>;
  correlationId: string;
};

export type JarvisOptions = {
  provider: LLMProvider;
  tools?: readonly JarvisTool[];
  maxIterations?: number;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

const DEFAULT_SYSTEM_PROMPT = [
  'You are JARVIS, the human-facing intelligence layer for Umer AI OS.',
  'Act like a capable executive assistant: concise, calm, proactive, and precise.',
  'Use tools when authoritative system state or external information is required.',
  'Never invent tool results, agent activity, project state, or completed actions.',
  'Never claim an action was executed unless a tool actually returned success.',
  'For destructive, external, financial, or irreversible actions, ask for approval unless an explicitly approved tool says otherwise.',
  'When delegating work, explain what will happen and report the resulting run or blocker.',
].join('\n');

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeToolResult(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ error: 'Tool returned a non-serializable result.' });
  }
}

export class JarvisCore {
  private readonly provider: LLMProvider;
  private readonly tools: Map<string, JarvisTool>;
  private readonly maxIterations: number;
  private readonly systemPrompt: string;
  private readonly temperature?: number;
  private readonly maxTokens?: number;

  constructor(options: JarvisOptions) {
    if (!Number.isInteger(options.maxIterations ?? 8) || (options.maxIterations ?? 8) < 1) {
      throw new Error('JARVIS maxIterations must be a positive integer');
    }
    this.provider = options.provider;
    this.tools = new Map((options.tools ?? []).map((tool) => [tool.name, tool]));
    this.maxIterations = options.maxIterations ?? 8;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
  }

  async respond(
    sessionId: string,
    userMessage: string,
    options: { history?: readonly ChatMessage[]; correlationId?: string; signal?: AbortSignal } = {},
  ): Promise<JarvisTurn> {
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...(options.history ?? []),
      { role: 'user', content: userMessage },
    ];
    const calls: JarvisTurn['toolCalls'] = [];

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const response = await this.provider.chat({
        messages,
        tools: this.tools.size > 0 ? [...this.tools.values()].map(({ execute: _execute, ...definition }) => definition) : undefined,
        toolChoice: this.tools.size > 0 ? 'auto' : undefined,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        signal: options.signal,
      });

      if (response.finishReason === 'length' || response.finishReason === 'content_filter') {
        throw new Error(`JARVIS provider ended with ${response.finishReason}; no final answer was produced`);
      }

      const toolRequests = response.message.toolCalls ?? [];
      messages.push({
        role: 'assistant',
        content: response.message.content,
        toolCalls: response.message.toolCalls,
      });

      if (toolRequests.length === 0 || response.finishReason !== 'tool_calls') {
        return {
          sessionId,
          userMessage,
          assistantMessage: response.message.content,
          toolCalls: calls,
          correlationId,
        };
      }

      for (const request of toolRequests) {
        await this.executeToolRequest(request, sessionId, correlationId, options.signal, calls, messages);
      }

      if (iteration === this.maxIterations) {
        throw new Error(`JARVIS exceeded ${this.maxIterations} reasoning iterations without a final answer`);
      }
    }

    throw new Error('JARVIS reasoning loop ended unexpectedly');
  }

  private async executeToolRequest(
    request: ToolCallRequest,
    sessionId: string,
    correlationId: string,
    signal: AbortSignal | undefined,
    calls: JarvisTurn['toolCalls'],
    messages: ChatMessage[],
  ): Promise<void> {
    const tool = this.tools.get(request.name);
    const input = safeParse(request.argumentsJson);
    const call = { name: request.name, arguments: input };

    if (!tool) {
      const error = `Tool "${request.name}" is not registered; execution was denied.`;
      calls.push({ ...call, error });
      messages.push({ role: 'tool', toolCallId: request.id, name: request.name, content: serializeToolResult({ error }) });
      return;
    }

    try {
      const result = await tool.execute(input, { sessionId, correlationId, signal });
      calls.push({ ...call, result });
      messages.push({ role: 'tool', toolCallId: request.id, name: request.name, content: serializeToolResult(result) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      calls.push({ ...call, error: message });
      messages.push({ role: 'tool', toolCallId: request.id, name: request.name, content: serializeToolResult({ error: message }) });
    }
  }
}

export { DEFAULT_SYSTEM_PROMPT };
