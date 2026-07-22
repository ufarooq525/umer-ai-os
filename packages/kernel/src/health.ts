import {
  RuntimeHealthSchema,
  parseContract,
  type RuntimeHealth,
} from '@umer/contracts';
import type { RegisteredComponent } from './registry.js';

export function buildComponentHealth(
  serviceName: string,
  component: RegisteredComponent,
  health?: RuntimeHealth,
): RuntimeHealth {
  if (health) {
    return parseContract(RuntimeHealthSchema, health);
  }

  if (component.lifecycle === 'failed') {
    return parseContract(RuntimeHealthSchema, {
      status: 'down',
      service: `${serviceName}/${component.name}`,
      ts: new Date().toISOString(),
      details: {
        kind: component.kind,
        lifecycle: component.lifecycle,
        error: component.lastError ?? 'unknown',
      },
    });
  }

  if (component.lifecycle === 'started') {
    return parseContract(RuntimeHealthSchema, {
      status: 'ok',
      service: `${serviceName}/${component.name}`,
      ts: new Date().toISOString(),
      details: { kind: component.kind, lifecycle: component.lifecycle },
    });
  }

  return parseContract(RuntimeHealthSchema, {
    status: 'degraded',
    service: `${serviceName}/${component.name}`,
    ts: new Date().toISOString(),
    details: { kind: component.kind, lifecycle: component.lifecycle },
  });
}

export function aggregateHealth(
  serviceName: string,
  componentHealths: RuntimeHealth[],
): RuntimeHealth {
  const ts = new Date().toISOString();
  const details: Record<string, unknown> = {
    components: componentHealths.map((h) => ({
      service: h.service,
      status: h.status,
    })),
  };

  if (componentHealths.some((h) => h.status === 'down')) {
    return parseContract(RuntimeHealthSchema, {
      status: 'down',
      service: serviceName,
      ts,
      details,
    });
  }

  if (componentHealths.some((h) => h.status === 'degraded')) {
    return parseContract(RuntimeHealthSchema, {
      status: 'degraded',
      service: serviceName,
      ts,
      details,
    });
  }

  return parseContract(RuntimeHealthSchema, {
    status: 'ok',
    service: serviceName,
    ts,
    details,
  });
}
