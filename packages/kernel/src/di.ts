export type DIToken<T> = symbol & { readonly __type?: T };

export function createToken<T>(description: string): DIToken<T> {
  return Symbol(description) as DIToken<T>;
}

type Factory<T> = () => T;

/**
 * Minimal dependency-injection container for kernel-scoped services.
 * Infrastructure only — no business logic.
 */
export class DIContainer {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly singletons = new Map<symbol, unknown>();

  registerSingleton<T>(token: DIToken<T>, factory: Factory<T>): void {
    if (this.factories.has(token)) {
      throw new Error(`DI token already registered: ${String(token.description)}`);
    }
    this.factories.set(token, factory as Factory<unknown>);
  }

  resolve<T>(token: DIToken<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`DI token not registered: ${String(token.description)}`);
    }
    const instance = factory() as T;
    this.singletons.set(token, instance);
    return instance;
  }

  has(token: DIToken<unknown>): boolean {
    return this.factories.has(token);
  }

  clear(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}
