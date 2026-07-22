import type { ArtifactContract } from '@umer/contracts';
import { ArtifactEngineError } from './errors.js';
import { isArtifactImmutable } from './hash.js';

export type ArtifactStore = {
  save(artifact: ArtifactContract): Promise<void>;
  get(artifactId: string): Promise<ArtifactContract | undefined>;
  list(): Promise<ArtifactContract[]>;
  listByExecId(execId: string): Promise<ArtifactContract[]>;
};

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly artifacts = new Map<string, ArtifactContract>();

  async save(artifact: ArtifactContract): Promise<void> {
    const existing = this.artifacts.get(artifact.artifactId);
    if (existing && isArtifactImmutable(existing)) {
      throw new ArtifactEngineError(
        'SEAL_VIOLATION',
        `Artifact ${artifact.artifactId} is sealed and cannot be modified`,
      );
    }
    this.artifacts.set(artifact.artifactId, structuredClone(artifact));
  }

  async get(artifactId: string): Promise<ArtifactContract | undefined> {
    return this.artifacts.get(artifactId);
  }

  async list(): Promise<ArtifactContract[]> {
    return [...this.artifacts.values()];
  }

  async listByExecId(execId: string): Promise<ArtifactContract[]> {
    return [...this.artifacts.values()].filter((artifact) => artifact.producedFor === execId);
  }

  clear(): void {
    this.artifacts.clear();
  }
}
