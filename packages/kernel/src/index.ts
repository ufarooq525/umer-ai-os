import type { Env } from '@umer/config';
import type { RuntimeHealth } from '@umer/contracts';
import {
  RuntimeKernel,
  createKernel,
  type RuntimeKernelOptions,
} from './kernel.js';

export { packageName } from './types.js';
export type {
  KernelComponent,
  KernelComponentKind,
  ComponentLifecycle,
  KernelLifecycle,
  KernelBootEvent,
  KernelEventListener,
} from './types.js';
export { DIContainer, createToken, type DIToken } from './di.js';
export { ComponentRegistry, type RegisteredComponent } from './registry.js';
export { RuntimeKernel, createKernel, type RuntimeKernelOptions };

export type RuntimeHandle = {
  env: Env;
  serviceName: string;
  kernel: RuntimeKernel;
  shutdown: () => Promise<void>;
};

export type StartRuntimeOptions = RuntimeKernelOptions;

let activeKernel: RuntimeKernel | undefined;

/**
 * Boot the Runtime Kernel with optional pre-registered components via `kernel` in options
 * or register components on the returned handle before calling boot again — prefer
 * `createKernel` + `register*` + `boot` for explicit control.
 */
export async function startRuntime(options: StartRuntimeOptions): Promise<RuntimeHandle> {
  const kernel = await createKernel(options);
  await kernel.boot();
  activeKernel = kernel;

  return {
    env: kernel.env,
    serviceName: kernel.serviceName,
    kernel,
    shutdown: async () => {
      await kernel.shutdown();
      if (activeKernel === kernel) {
        activeKernel = undefined;
      }
    },
  };
}

/**
 * Returns aggregate kernel health using @umer/contracts RuntimeHealthSchema.
 * Uses the active kernel from startRuntime when available.
 */
export { startHealthServer, type HealthServerHandle, type StartHealthServerOptions } from './health-server.js';

/**
 * Returns aggregate kernel health using @umer/contracts RuntimeHealthSchema.
 * Uses the active kernel from startRuntime when available.
 */
export async function healthCheck(serviceName?: string): Promise<RuntimeHealth> {
  if (activeKernel) {
    return activeKernel.getHealth();
  }

  const { parseContract, RuntimeHealthSchema } = await import('@umer/contracts');
  return parseContract(RuntimeHealthSchema, {
    status: 'ok',
    service: serviceName ?? 'umer-ai-os',
    ts: new Date().toISOString(),
    details: { kernel: 'not_booted' },
  });
}
