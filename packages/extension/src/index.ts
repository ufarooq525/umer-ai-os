/**
 * @umer/extension — Extension Runtime SDK (host side).
 * Tool Registry + Tool Router: the only path from a model tool_call to real
 * execution. Agent Runtime depends on this interface; it never opens raw
 * network or filesystem access on the model's behalf (MONOREPO_BLUEPRINT.md §18).
 */
export {
  packageName,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolExecutionStatus,
  type ToolHandler,
} from './types.js';
export { ExtensionError, type ExtensionErrorCode } from './errors.js';
export { ToolRegistry, createToolRegistry } from './registry.js';
export { ToolRouter, createToolRouter, type ToolRouterOptions } from './router.js';
export {
  createSearchWebTool,
  type SearchWebInput,
  type SearchWebOutput,
  type SearchWebResultItem,
  type SearchWebToolOptions,
} from './tools/search-web.js';
