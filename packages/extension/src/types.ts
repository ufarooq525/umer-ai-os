import type { ToolDefinitionForModel } from '@umer/model-routing';

export const packageName = '@umer/extension' as const;

export type ToolExecutionContext = {
  specialistId: string;
  workPackageId: string;
  correlationId: string;
  toolCallId: string;
  signal?: AbortSignal;
  /** Real, resolved filesystem root this run is sandboxed to — see WorkPackageContract's targetPath. Undefined when the Work Package has none; filesystem-scoped tools must fail closed rather than fall back to an unrestricted root. */
  targetPath?: string;
};

/**
 * Handlers always receive raw `unknown` input (parsed JSON straight off the wire)
 * and must validate it themselves — this keeps ToolDefinition's input position
 * invariant-free so a ToolRegistry can hold definitions of differing TOutput
 * without unsound variance casts. TOutput stays generic because return position
 * is covariant-safe.
 */
export type ToolHandler<TOutput = unknown> = (
  input: unknown,
  ctx: ToolExecutionContext,
) => Promise<TOutput>;

export type ToolDefinition<TOutput = unknown> = {
  name: string;
  description: string;
  parameters: ToolDefinitionForModel['parameters'];
  handler: ToolHandler<TOutput>;
  /** Wall-clock budget for a single call. Defaults to the router's timeout. */
  timeoutMs?: number;
};

export type ToolExecutionStatus = 'completed' | 'failed' | 'denied' | 'unknown_tool';

export type ToolExecutionResult = {
  toolName: string;
  toolCallId: string;
  status: ToolExecutionStatus;
  output?: unknown;
  error?: string;
  durationMs: number;
};
