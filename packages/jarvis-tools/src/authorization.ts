import type { JarvisPrincipal, JarvisTool, JarvisToolContext } from '@umer/jarvis-core';
import type { TrustRuntime, PermissionDecision } from '@umer/trust';

export type AuthorizedJarvisToolsOptions = {
  trust: TrustRuntime;
  principal: JarvisPrincipal;
};

export function authorizeJarvisTool(
  trust: TrustRuntime,
  principal: JarvisPrincipal | undefined,
  toolName: string,
  context: JarvisToolContext,
): Promise<PermissionDecision> {
  if (!principal) {
    return Promise.resolve({
      decisionId: 'none',
      allowed: false,
      reason: 'No authenticated principal is bound to the JARVIS session',
      principalId: 'anonymous',
      action: 'read',
      resourceType: 'jarvis',
      decidedAt: new Date().toISOString(),
    });
  }
  const action = toolName === 'delegate_work' ? 'execute' : 'read';
  return trust.authorize({
    principal,
    action,
    resourceType: action === 'execute' ? 'command' : 'jarvis',
  }, context.correlationId);
}

export function createAuthorizedJarvisTools(
  tools: readonly JarvisTool[],
  options: AuthorizedJarvisToolsOptions,
): JarvisTool[] {
  return tools.map((tool) => ({
    ...tool,
    async execute(input: unknown, context: JarvisToolContext): Promise<unknown> {
      const decision = await authorizeJarvisTool(options.trust, context.principal ?? options.principal, tool.name, context);
      if (!decision.allowed) {
        throw new Error(`JARVIS authorization denied for ${tool.name}: ${decision.reason ?? 'No matching allow grant'}`);
      }
      return tool.execute(input, context);
    },
  }));
}
