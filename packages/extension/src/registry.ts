import type { ToolDefinitionForModel } from '@umer/model-routing';
import { ExtensionError } from './errors.js';
import type { ToolDefinition } from './types.js';

/**
 * Extension Runtime SDK (host side) — Registry Fabric callable-unit surface for tools.
 * The model never sees a tool that isn't both registered here AND on the
 * dispatching Specialist's mandate/Work Package allowlist (see ToolRouter).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      throw new ExtensionError('DUPLICATE_TOOL', `Tool "${definition.name}" is already registered`);
    }
    this.tools.set(definition.name, definition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /**
   * Tool definitions for the model — restricted to names present in `allowlist`.
   * Only tools both registered AND allowlisted are ever described to the model.
   */
  listForAllowlist(allowlist: readonly string[]): ToolDefinitionForModel[] {
    const allowed = new Set(allowlist);
    return this.list()
      .filter((tool) => allowed.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
  }
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
