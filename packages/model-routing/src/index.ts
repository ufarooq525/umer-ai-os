/**
 * @umer/model-routing — Model Routing Engine.
 * Agent Runtime depends only on `LLMProvider`; concrete providers (LM Studio,
 * other OpenAI-compatible endpoints) are swappable without touching Specialist
 * specs or Agent Runtime (MONOREPO_BLUEPRINT.md §0.5, §4).
 */
export { packageName } from './types.js';
export type {
  ChatFinishReason,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatRole,
  LLMProvider,
  ToolCallRequest,
  ToolChoice,
  ToolDefinitionForModel,
  ToolParameterSchema,
} from './types.js';
export { ModelRoutingError, type ModelRoutingErrorCode } from './errors.js';
export {
  OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
} from './providers/openai-compatible.js';
export { createLLMProviderFromEnv, type CreateLLMProviderOptions } from './factory.js';
