import { withRetry, withTimeout } from '@umer/resilience';
import { ModelRoutingError } from '../errors.js';
import type {
  ChatFinishReason,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ToolCallRequest,
} from '../types.js';

export type OpenAICompatibleProviderOptions = {
  /** Provider identity for logs/events — e.g. "lmstudio". Never a model vendor id in Specs. */
  providerId: string;
  /** Base URL without trailing /chat/completions, e.g. http://localhost:1234/v1 */
  baseUrl: string;
  /** Default model id used when a ChatRequest omits one. */
  defaultModel: string;
  /** Optional — local LM Studio does not require a key. */
  apiKey?: string;
  requestTimeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
};

type WireToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type WireMessage = {
  role: ChatRole;
  content: string | null;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
  name?: string;
};

type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

type WireChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: WireToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function toWireMessage(message: ChatMessage): WireMessage {
  switch (message.role) {
    case 'system':
    case 'user':
      return { role: message.role, content: message.content };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls?.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.argumentsJson },
        })),
      };
    case 'tool':
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.name,
      };
  }
}

function toFinishReason(raw: string | undefined): ChatFinishReason {
  switch (raw) {
    case 'stop':
    case 'tool_calls':
    case 'length':
    case 'content_filter':
      return raw;
    default:
      return 'stop';
  }
}

/**
 * OpenAI-compatible /chat/completions provider. Works against LM Studio out of the
 * box (base URL http://localhost:1234/v1, no API key) and against any other
 * OpenAI-wire-compatible endpoint by construction.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly providerId: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly apiKey?: string;
  private readonly requestTimeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.providerId = options.providerId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultModel = options.defaultModel;
    this.apiKey = options.apiKey;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: request.model || this.defaultModel,
      messages: request.messages.map(toWireMessage),
      tools: request.tools?.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: request.toolChoice,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };

    const json = await withRetry(
      () =>
        withTimeout(
          (signal) => this.postChatCompletions(body, signal),
          this.requestTimeoutMs,
          `${this.providerId}.chat`,
          request.signal,
        ),
      {
        maxAttempts: this.maxAttempts,
        baseDelayMs: 250,
        maxDelayMs: 2_000,
        isRetryable: (err) => !(err instanceof ModelRoutingError && err.code === 'INVALID_RESPONSE'),
      },
    );

    return this.toChatResponse(json);
  }

  private async postChatCompletions(
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<WireChatCompletionResponse> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw new ModelRoutingError(
        'PROVIDER_ERROR',
        `${this.providerId} request failed: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ModelRoutingError(
        'PROVIDER_ERROR',
        `${this.providerId} returned HTTP ${response.status}: ${text.slice(0, 500)}`,
      );
    }

    try {
      return (await response.json()) as WireChatCompletionResponse;
    } catch (err) {
      throw new ModelRoutingError('INVALID_RESPONSE', `${this.providerId} returned non-JSON body`, err);
    }
  }

  private toChatResponse(json: WireChatCompletionResponse): ChatResponse {
    const choice = json.choices?.[0];
    if (!choice?.message) {
      throw new ModelRoutingError(
        'INVALID_RESPONSE',
        `${this.providerId} response missing choices[0].message`,
      );
    }

    const toolCalls: ToolCallRequest[] | undefined = choice.message.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      argumentsJson: call.function.arguments,
    }));

    return {
      message: {
        role: 'assistant',
        // Only the wire `content` field is ever surfaced — a provider's separate
        // reasoning/chain-of-thought field (if any) is never read here.
        content: choice.message.content ?? '',
        toolCalls,
      },
      finishReason: toFinishReason(choice.finish_reason),
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}
