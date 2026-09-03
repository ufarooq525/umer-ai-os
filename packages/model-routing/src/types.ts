export const packageName = '@umer/model-routing' as const;

/** OpenAI-compatible chat roles. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCallRequest = {
  /** Provider-assigned id; must be echoed back on the matching tool result message. */
  id: string;
  name: string;
  /** Raw JSON string exactly as emitted by the model — callers parse and validate. */
  argumentsJson: string;
};

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallRequest[] }
  | { role: 'tool'; content: string; toolCallId: string; name: string };

/** JSON Schema object describing a tool's input — passed through to the provider as-is. */
export type ToolParameterSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDefinitionForModel = {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
};

export type ToolChoice = 'auto' | 'none' | 'required';

export type ChatRequest = {
  /** Omit to use the provider's configured default model. */
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDefinitionForModel[];
  toolChoice?: ToolChoice;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type ChatFinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';

export type ChatResponse = {
  message: {
    role: 'assistant';
    /** Empty string when the turn is pure tool-calling with no accompanying text. */
    content: string;
    toolCalls?: ToolCallRequest[];
  };
  finishReason: ChatFinishReason;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

/**
 * Model Routing contract — Agent Runtime depends on this interface only.
 * Concrete providers (LM Studio, hosted OpenAI-compatible, …) live behind it
 * so no vendor id ever appears in a Specialist spec (MONOREPO_BLUEPRINT.md §0.5).
 */
export interface LLMProvider {
  readonly providerId: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
