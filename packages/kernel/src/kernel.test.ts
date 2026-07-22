import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeHealthSchema, parseContract } from '@umer/contracts';
import { DIContainer, createToken } from './di.js';
import { ComponentRegistry } from './registry.js';
import { aggregateHealth, buildComponentHealth } from './health.js';
import { createKernel, createToken as kernelCreateToken } from './kernel.js';
import { startRuntime, healthCheck, startHealthServer } from './index.js';

describe('DIContainer', () => {
  it('registers and resolves singletons', () => {
    const container = new DIContainer();
    const TOKEN = createToken<{ value: number }>('test');
    let calls = 0;
    container.registerSingleton(TOKEN, () => {
      calls += 1;
      return { value: 42 };
    });
    expect(container.resolve(TOKEN).value).toBe(42);
    expect(container.resolve(TOKEN).value).toBe(42);
    expect(calls).toBe(1);
  });

  it('throws on duplicate registration and missing token', () => {
    const container = new DIContainer();
    const TOKEN = createToken<string>('dup');
    container.registerSingleton(TOKEN, () => 'a');
    expect(() => container.registerSingleton(TOKEN, () => 'b')).toThrow(/already registered/);
    expect(() => container.resolve(createToken('missing'))).toThrow(/not registered/);
  });
});

describe('ComponentRegistry', () => {
  it('orders startup by dependencies and shutdown in reverse', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'b', kind: 'service', dependencies: ['a'] });
    registry.register({ name: 'a', kind: 'service' });
    registry.register({ name: 'c', kind: 'worker', dependencies: ['b'] });
    expect(registry.resolveStartupOrder()).toEqual(['a', 'b', 'c']);
    expect(registry.resolveShutdownOrder()).toEqual(['c', 'b', 'a']);
  });

  it('detects circular and missing dependencies', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'x', kind: 'service', dependencies: ['y'] });
    registry.register({ name: 'y', kind: 'service', dependencies: ['x'] });
    expect(() => registry.resolveStartupOrder()).toThrow(/Circular/);

    const registry2 = new ComponentRegistry();
    registry2.register({ name: 'solo', kind: 'service', dependencies: ['ghost'] });
    expect(() => registry2.resolveStartupOrder()).toThrow(/unregistered/);
  });

  it('lists by kind and clears', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 's', kind: 'service' });
    registry.register({ name: 'w', kind: 'worker' });
    expect(registry.listByKind('worker')).toHaveLength(1);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it('throws when setting lifecycle for unknown component', () => {
    const registry = new ComponentRegistry();
    expect(() => registry.setLifecycle('missing', 'started')).toThrow(/not found/);
  });
});

describe('health helpers', () => {
  const base = {
    name: 'worker-a',
    kind: 'worker' as const,
    lifecycle: 'started' as const,
  };

  it('builds component health from lifecycle', () => {
    const ok = buildComponentHealth('svc', { ...base, lifecycle: 'started' });
    expect(ok.status).toBe('ok');
    const degraded = buildComponentHealth('svc', { ...base, lifecycle: 'registered' });
    expect(degraded.status).toBe('degraded');
    const down = buildComponentHealth('svc', { ...base, lifecycle: 'failed', lastError: 'boom' });
    expect(down.status).toBe('down');
  });

  it('aggregates worst status', () => {
    const ts = new Date().toISOString();
    const ok = parseContract(RuntimeHealthSchema, {
      status: 'ok',
      service: 'a',
      ts,
      details: {},
    });
    const degraded = parseContract(RuntimeHealthSchema, {
      status: 'degraded',
      service: 'b',
      ts,
      details: {},
    });
    expect(aggregateHealth('svc', [ok, ok]).status).toBe('ok');
    expect(aggregateHealth('svc', [ok, degraded]).status).toBe('degraded');
    expect(
      aggregateHealth('svc', [
        ok,
        parseContract(RuntimeHealthSchema, { status: 'down', service: 'c', ts, details: {} }),
      ]).status,
    ).toBe('down');
  });
});

describe('RuntimeKernel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boots and shuts down registered service and worker in order', async () => {
    const events: string[] = [];
    const order: string[] = [];

    const kernel = await createKernel({
      serviceName: 'test-kernel',
      registerSignalHandlers: false,
      onEvent: (e) => events.push(e.type),
    });

    kernel.registerService({
      name: 'db',
      start: async () => {
        order.push('start:db');
      },
      stop: async () => {
        order.push('stop:db');
      },
    });

    kernel.registerWorker({
      name: 'consumer',
      dependencies: ['db'],
      start: async () => {
        order.push('start:consumer');
      },
      stop: async () => {
        order.push('stop:consumer');
      },
    });

    await kernel.boot();
    expect(kernel.state).toBe('running');
    expect(order).toEqual(['start:db', 'start:consumer']);
    expect(events).toContain('kernel.booted');

    const health = await kernel.getHealth();
    expect(health.status).toBe('ok');

    await kernel.shutdown();
    expect(kernel.state).toBe('stopped');
    expect(order).toEqual(['start:db', 'start:consumer', 'stop:consumer', 'stop:db']);
    expect(events).toContain('kernel.stopped');
  });

  it('fails boot when component start throws and shuts down', async () => {
    const kernel = await createKernel({
      serviceName: 'fail-kernel',
      registerSignalHandlers: false,
    });
    kernel.registerService({
      name: 'bad',
      start: async () => {
        throw new Error('start failed');
      },
    });

    await expect(kernel.boot()).rejects.toThrow(/Failed to start component "bad"/);
    expect(kernel.state).toBe('stopped');
    const component = kernel.listComponents()[0];
    expect(component?.lifecycle).toBe('failed');
  });

  it('registers DI tokens and resolves', async () => {
    const kernel = await createKernel({
      serviceName: 'di-kernel',
      registerSignalHandlers: false,
    });
    const TOKEN = kernelCreateToken<number>('answer');
    kernel.registerSingleton(TOKEN, () => 7);
    await kernel.boot();
    expect(kernel.resolve(TOKEN)).toBe(7);
    await kernel.shutdown();
  });

  it('rejects registration after boot', async () => {
    const kernel = await createKernel({
      serviceName: 'late-reg',
      registerSignalHandlers: false,
    });
    await kernel.boot();
    expect(() => kernel.registerService({ name: 'late' })).toThrow(/after kernel has booted/);
    await kernel.shutdown();
  });

  it('uses custom healthCheck when provided', async () => {
    const kernel = await createKernel({
      serviceName: 'health-kernel',
      registerSignalHandlers: false,
    });
    kernel.registerWorker({
      name: 'w',
      healthCheck: () => ({
        status: 'degraded',
        service: 'health-kernel/w',
        ts: new Date().toISOString(),
        details: { reason: 'warming' },
      }),
    });
    await kernel.boot();
    const health = await kernel.getHealth();
    expect(health.status).toBe('degraded');
    await kernel.shutdown();
  });
});

describe('startRuntime + healthCheck', () => {
  it('startRuntime returns handle with kernel', async () => {
    const handle = await startRuntime({
      serviceName: 'handle-test',
      registerSignalHandlers: false,
    });
    expect(handle.kernel.state).toBe('running');
    const health = await healthCheck();
    expect(health.status).toBe('ok');
    await handle.shutdown();
  });

  it('healthCheck fallback when no active kernel', async () => {
    const health = await healthCheck('standalone');
    expect(health.service).toBe('standalone');
    expect(health.details).toMatchObject({ kernel: 'not_booted' });
  });

  it('startHealthServer serves /health', async () => {
    const handle = await startRuntime({
      serviceName: 'health-http',
      registerSignalHandlers: false,
    });
    const probe = await startHealthServer({
      serviceName: 'health-http',
      port: 0,
      getHealth: () => healthCheck('health-http'),
    });
    const response = await fetch(`http://127.0.0.1:${probe.port}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('health-http');
    await probe.close();
    await handle.shutdown();
  });
});

describe('edge cases', () => {
  it('reports degraded health when not running', async () => {
    const kernel = await createKernel({
      serviceName: 'lifecycle-health',
      registerSignalHandlers: false,
    });
    (kernel as unknown as { lifecycle: string }).lifecycle = 'booting';
    const degraded = await kernel.getHealth();
    expect(degraded.status).toBe('degraded');
  });

  it('reports down health after stop', async () => {
    const kernel = await createKernel({
      serviceName: 'stopped-health',
      registerSignalHandlers: false,
    });
    await kernel.boot();
    await kernel.shutdown();
    const down = await kernel.getHealth();
    expect(down.status).toBe('down');
  });

  it('handles component stop failure and no-op stop components', async () => {
    const kernel = await createKernel({
      serviceName: 'stop-edge',
      registerSignalHandlers: false,
    });
    kernel.registerService({ name: 'noop', start: async () => undefined });
    kernel.registerWorker({
      name: 'flaky',
      start: async () => undefined,
      stop: async () => {
        throw new Error('stop failed');
      },
    });
    await kernel.boot();
    await kernel.shutdown();
    expect(kernel.listComponents().find((c) => c.name === 'flaky')?.lifecycle).toBe('failed');
  });

  it('is idempotent on double shutdown and rejects re-boot after stop', async () => {
    const kernel = await createKernel({
      serviceName: 'idempotent',
      registerSignalHandlers: false,
    });
    await kernel.boot();
    await kernel.shutdown();
    await kernel.shutdown();
    await expect(kernel.boot()).rejects.toThrow(/Cannot boot/);
  });

  it('returns early when boot called while already running', async () => {
    const kernel = await createKernel({
      serviceName: 'double-boot',
      registerSignalHandlers: false,
    });
    await kernel.boot();
    await kernel.boot();
    expect(kernel.state).toBe('running');
    await kernel.shutdown();
  });

  it('registers signal handlers when enabled', async () => {
    const once = vi.spyOn(process, 'once');
    const kernel = await createKernel({
      serviceName: 'signals',
      registerSignalHandlers: true,
    });
    await kernel.boot();
    expect(once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    await kernel.shutdown();
    once.mockRestore();
  });

  it('DI container has() and clear()', () => {
    const container = new DIContainer();
    const TOKEN = createToken<string>('has-test');
    expect(container.has(TOKEN)).toBe(false);
    container.registerSingleton(TOKEN, () => 'x');
    expect(container.has(TOKEN)).toBe(true);
    container.clear();
    expect(container.has(TOKEN)).toBe(false);
  });
});
