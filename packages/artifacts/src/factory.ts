import { InMemoryArtifactStore } from './store.js';
import { ArtifactEngine, type ArtifactEngineOptions } from './engine.js';

export type CreateArtifactEngineOptions = ArtifactEngineOptions;

export function createArtifactEngine(
  options?: Partial<CreateArtifactEngineOptions>,
): ArtifactEngine {
  return new ArtifactEngine({
    store: options?.store ?? new InMemoryArtifactStore(),
    events: options?.events,
    clock: options?.clock,
  });
}

export function createArtifactStack(): {
  engine: ArtifactEngine;
  store: InMemoryArtifactStore;
} {
  const store = new InMemoryArtifactStore();
  const engine = createArtifactEngine({ store });
  return { engine, store };
}
