import { withTimeout } from '@umer/resilience';
import type { ToolCallRequest } from '@umer/model-routing';
import type { ToolRegistry } from './registry.js';
import type { ToolExecutionContext, ToolExecutionResult } from './types.js';

export type ToolRouterOptions = {
  registry: ToolRegistry;
  /** Applied when a ToolDefinition doesn't specify its own timeoutMs. */
  defaultTimeoutMs?: number;
};

/**
 * Tool Router — the only path from a model tool_call to real execution.
 * Fail-closed: a tool must be BOTH registered in the ToolRegistry AND present in
 * the caller-supplied allowlist (Specialist mandate ∩ Work Package toolAllowlist)
 * or the call is denied without ever reaching a handler.
 */
export class ToolRouter {
  private readonly registry: ToolRegistry;
  private readonly defaultTimeoutMs: number;

  constructor(options: ToolRouterOptions) {
    this.registry = options.registry;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async execute(
    toolCall: ToolCallRequest,
    allowlist: readonly string[],
    ctx: Omit<ToolExecutionContext, 'toolCallId'>,
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const definition = this.registry.get(toolCall.name);

    if (!definition) {
      return {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        status: 'unknown_tool',
        error: `Tool "${toolCall.name}" is not registered`,
        durationMs: Date.now() - startedAt,
      };
    }

    if (!allowlist.includes(toolCall.name)) {
      return {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        status: 'denied',
        error: `Tool "${toolCall.name}" is not on the specialist/work-package allowlist`,
        durationMs: Date.now() - startedAt,
      };
    }

    let input: unknown;
    try {
      input = toolCall.argumentsJson.trim().length > 0 ? JSON.parse(toolCall.argumentsJson) : {};
    } catch (err) {
      return {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        status: 'failed',
        error: `Malformed tool arguments JSON: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    const fullCtx: ToolExecutionContext = { ...ctx, toolCallId: toolCall.id };

    try {
      const output = await withTimeout(
        (signal) => definition.handler(input, { ...fullCtx, signal }),
        definition.timeoutMs ?? this.defaultTimeoutMs,
        `tool:${toolCall.name}`,
        ctx.signal,
      );
      return {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        status: 'completed',
        output,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      return {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

export function createToolRouter(options: ToolRouterOptions): ToolRouter {
  return new ToolRouter(options);
}
