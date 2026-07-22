import type { RuntimeHealth } from '@umer/contracts';

export const packageName = '@umer/kernel' as const;

/** Kernel-internal component classification — not a business work object. */
export type KernelComponentKind = 'service' | 'worker';

/** Lifecycle state of a registered kernel component. */
export type ComponentLifecycle =
  | 'registered'
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'failed';

/** Overall kernel lifecycle. */
export type KernelLifecycle = 'created' | 'booting' | 'running' | 'shutting_down' | 'stopped';

export type KernelComponent = {
  name: string;
  kind: KernelComponentKind;
  /** Names of components that must start before this one. */
  dependencies?: string[];
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  healthCheck?: () => Promise<RuntimeHealth> | RuntimeHealth;
};

export type KernelBootEvent =
  | { type: 'kernel.booting'; serviceName: string }
  | { type: 'kernel.booted'; serviceName: string }
  | { type: 'kernel.shutting_down'; serviceName: string }
  | { type: 'kernel.stopped'; serviceName: string }
  | { type: 'component.starting'; name: string }
  | { type: 'component.started'; name: string }
  | { type: 'component.stopping'; name: string }
  | { type: 'component.stopped'; name: string }
  | { type: 'component.failed'; name: string; error: string };

export type KernelEventListener = (event: KernelBootEvent) => void;
