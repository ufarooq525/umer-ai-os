import { loadEnv, type Env } from '@umer/config';
import { createLogger, startTelemetry, shutdownTelemetry } from '@umer/observability';
import type { RuntimeHealth } from '@umer/contracts';
import { DIContainer, createToken, type DIToken } from './di.js';
import { aggregateHealth, buildComponentHealth } from './health.js';
import { ComponentRegistry } from './registry.js';
import type {
  KernelBootEvent,
  KernelComponent,
  KernelEventListener,
  KernelLifecycle,
} from './types.js';

export type RuntimeKernelOptions = {
  serviceName: string;
  onEvent?: KernelEventListener;
  onShutdown?: () => Promise<void> | void;
  registerSignalHandlers?: boolean;
};

export class RuntimeKernel {
  readonly serviceName: string;
  readonly env: Env;
  readonly container = new DIContainer();

  private readonly registry = new ComponentRegistry();
  private readonly log;
  private readonly onEvent?: KernelEventListener;
  private readonly onShutdown?: () => Promise<void> | void;
  private readonly registerSignalHandlers: boolean;

  private lifecycle: KernelLifecycle = 'created';
  private shuttingDown = false;
  private signalHandlersRegistered = false;

  constructor(options: RuntimeKernelOptions) {
    this.serviceName = options.serviceName;
    this.env = loadEnv();
    this.log = createLogger(options.serviceName);
    this.onEvent = options.onEvent;
    this.onShutdown = options.onShutdown;
    this.registerSignalHandlers = options.registerSignalHandlers ?? true;
  }

  get state(): KernelLifecycle {
    return this.lifecycle;
  }

  registerService(component: Omit<KernelComponent, 'kind'> & { kind?: 'service' }): void {
    this.register({ ...component, kind: 'service' });
  }

  registerWorker(component: Omit<KernelComponent, 'kind'> & { kind?: 'worker' }): void {
    this.register({ ...component, kind: 'worker' });
  }

  register(component: KernelComponent): void {
    if (this.lifecycle !== 'created') {
      throw new Error('Cannot register components after kernel has booted');
    }
    this.registry.register(component);
  }

  registerSingleton<T>(token: DIToken<T>, factory: () => T): void {
    this.container.registerSingleton(token, factory);
  }

  resolve<T>(token: DIToken<T>): T {
    return this.container.resolve(token);
  }

  listComponents() {
    return this.registry.list();
  }

  private emit(event: KernelBootEvent): void {
    this.onEvent?.(event);
  }

  async boot(): Promise<void> {
    if (this.lifecycle === 'running') {
      return;
    }
    if (this.lifecycle !== 'created') {
      throw new Error(`Cannot boot kernel in state: ${this.lifecycle}`);
    }

    this.lifecycle = 'booting';
    this.emit({ type: 'kernel.booting', serviceName: this.serviceName });

    startTelemetry({ serviceName: this.serviceName });
    this.log.info({ env: this.env.NODE_ENV }, 'runtime kernel booting');

    const order = this.registry.resolveStartupOrder();
    for (const name of order) {
      const component = this.registry.get(name)!;
      if (!component.start) {
        this.registry.setLifecycle(name, 'started');
        continue;
      }

      this.emit({ type: 'component.starting', name });
      this.registry.setLifecycle(name, 'starting');
      try {
        await component.start();
        this.registry.setLifecycle(name, 'started');
        this.emit({ type: 'component.started', name });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.registry.setLifecycle(name, 'failed', message);
        this.emit({ type: 'component.failed', name, error: message });
        this.log.error({ component: name, err: message }, 'component start failed');
        await this.shutdown({ force: true });
        throw new Error(`Failed to start component "${name}": ${message}`);
      }
    }

    if (this.registerSignalHandlers) {
      this.attachSignalHandlers();
    }

    this.lifecycle = 'running';
    this.emit({ type: 'kernel.booted', serviceName: this.serviceName });
    this.log.info('runtime kernel running');
  }

  async shutdown(options: { force?: boolean } = {}): Promise<void> {
    if (this.shuttingDown && !options.force) {
      return;
    }
    if (this.lifecycle === 'stopped') {
      return;
    }

    this.shuttingDown = true;
    this.lifecycle = 'shutting_down';
    this.emit({ type: 'kernel.shutting_down', serviceName: this.serviceName });
    this.log.info('runtime kernel shutting down');

    const order = this.registry.resolveShutdownOrder();
    for (const name of order) {
      const component = this.registry.get(name)!;
      if (!component.stop) {
        if (component.lifecycle === 'started' || component.lifecycle === 'starting') {
          this.registry.setLifecycle(name, 'stopped');
        }
        continue;
      }

      this.emit({ type: 'component.stopping', name });
      this.registry.setLifecycle(name, 'stopping');
      try {
        await component.stop();
        this.registry.setLifecycle(name, 'stopped');
        this.emit({ type: 'component.stopped', name });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.registry.setLifecycle(name, 'failed', message);
        this.emit({ type: 'component.failed', name, error: message });
        this.log.error({ component: name, err: message }, 'component stop failed');
      }
    }

    try {
      await this.onShutdown?.();
    } finally {
      await shutdownTelemetry();
      this.container.clear();
      this.lifecycle = 'stopped';
      this.emit({ type: 'kernel.stopped', serviceName: this.serviceName });
      this.log.info('runtime kernel stopped');
    }
  }

  async getComponentHealth(): Promise<Record<string, RuntimeHealth>> {
    const result: Record<string, RuntimeHealth> = {};
    for (const component of this.registry.list()) {
      if (component.healthCheck) {
        result[component.name] = buildComponentHealth(
          this.serviceName,
          component,
          await component.healthCheck(),
        );
      } else {
        result[component.name] = buildComponentHealth(this.serviceName, component);
      }
    }
    return result;
  }

  async getHealth(): Promise<RuntimeHealth> {
    const components = await this.getComponentHealth();
    const values = Object.values(components);

    if (this.lifecycle === 'stopped') {
      return aggregateHealth(this.serviceName, [
        ...values,
        {
          status: 'down',
          service: this.serviceName,
          ts: new Date().toISOString(),
          details: { lifecycle: this.lifecycle },
        },
      ]);
    }

    if (this.lifecycle !== 'running') {
      return aggregateHealth(this.serviceName, [
        ...values,
        {
          status: 'degraded',
          service: this.serviceName,
          ts: new Date().toISOString(),
          details: { lifecycle: this.lifecycle },
        },
      ]);
    }

    if (values.length === 0) {
      return aggregateHealth(this.serviceName, [
        {
          status: 'ok',
          service: this.serviceName,
          ts: new Date().toISOString(),
          details: { lifecycle: this.lifecycle, components: 0 },
        },
      ]);
    }

    return aggregateHealth(this.serviceName, values);
  }

  private attachSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      return;
    }
    this.signalHandlersRegistered = true;

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.once(signal, () => {
        void this.shutdown().finally(() => process.exit(0));
      });
    }
  }
}

export async function createKernel(options: RuntimeKernelOptions): Promise<RuntimeKernel> {
  return new RuntimeKernel(options);
}

export { createToken };
export type { DIToken };
