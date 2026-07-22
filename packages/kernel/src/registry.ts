import type { ComponentLifecycle, KernelComponent } from './types.js';

export type RegisteredComponent = KernelComponent & {
  lifecycle: ComponentLifecycle;
  lastError?: string;
};

export class ComponentRegistry {
  private readonly components = new Map<string, RegisteredComponent>();

  register(component: KernelComponent): void {
    if (this.components.has(component.name)) {
      throw new Error(`Component already registered: ${component.name}`);
    }
    for (const dep of component.dependencies ?? []) {
      if (dep === component.name) {
        throw new Error(`Component cannot depend on itself: ${component.name}`);
      }
    }
    this.components.set(component.name, {
      ...component,
      lifecycle: 'registered',
    });
  }

  get(name: string): RegisteredComponent | undefined {
    return this.components.get(name);
  }

  list(): RegisteredComponent[] {
    return [...this.components.values()];
  }

  listByKind(kind: KernelComponent['kind']): RegisteredComponent[] {
    return this.list().filter((c) => c.kind === kind);
  }

  setLifecycle(name: string, lifecycle: ComponentLifecycle, lastError?: string): void {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`Component not found: ${name}`);
    }
    component.lifecycle = lifecycle;
    if (lastError !== undefined) {
      component.lastError = lastError;
    } else if (lifecycle !== 'failed') {
      delete component.lastError;
    }
  }

  /** Topological startup order — dependencies first. */
  resolveStartupOrder(): string[] {
    const names = [...this.components.keys()];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) {
        return;
      }
      if (visiting.has(name)) {
        throw new Error(`Circular component dependency detected involving: ${name}`);
      }
      const component = this.components.get(name);
      if (!component) {
        throw new Error(`Unknown dependency: ${name}`);
      }
      visiting.add(name);
      for (const dep of component.dependencies ?? []) {
        if (!this.components.has(dep)) {
          throw new Error(`Component "${name}" depends on unregistered component "${dep}"`);
        }
        visit(dep);
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of names) {
      visit(name);
    }
    return order;
  }

  /** Shutdown in reverse startup order. */
  resolveShutdownOrder(): string[] {
    return this.resolveStartupOrder().reverse();
  }

  clear(): void {
    this.components.clear();
  }
}
