import { loadEnv, type Env } from '@umer/config';
import { ModelRoutingError } from './errors.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import type { LLMProvider } from './types.js';

export type CreateLLMProviderOptions = {
  env?: Env;
  fetchImpl?: typeof fetch;
};

/**
 * Builds the configured LLMProvider from typed env (Kernel config concern —
 * MONOREPO_BLUEPRINT.md §17). Fails closed on an unknown LLM_PROVIDER value.
 */
export function createLLMProviderFromEnv(options: CreateLLMProviderOptions = {}): LLMProvider {
  const env = options.env ?? loadEnv();

  switch (env.LLM_PROVIDER) {
    case 'lmstudio':
      return new OpenAICompatibleProvider({
        providerId: 'lmstudio',
        baseUrl: env.LLM_BASE_URL,
        defaultModel: env.LLM_MODEL,
        apiKey: env.LLM_API_KEY,
        requestTimeoutMs: env.LLM_REQUEST_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      });
    case 'openai-compatible':
      return new OpenAICompatibleProvider({
        providerId: 'openai-compatible',
        baseUrl: env.LLM_BASE_URL,
        defaultModel: env.LLM_MODEL,
        apiKey: env.LLM_API_KEY,
        requestTimeoutMs: env.LLM_REQUEST_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      });
    default:
      throw new ModelRoutingError('CONFIG_ERROR', `Unknown LLM_PROVIDER: ${String(env.LLM_PROVIDER)}`);
  }
}
