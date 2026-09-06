import type { ArtifactContract, EventEnvelope } from '@umer/contracts';
import { createLogger } from '@umer/observability';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Real sealed Artifacts never reached `state.artifactStore` in production
 * before this bridge: `apps/agent-worker` seals into its OWN separate
 * ArtifactEngine/store (see its main.ts's `createArtifactStack()`), a
 * different process with no shared storage, and the `artifact.sealed` event
 * it already publishes used to carry only IDs — nothing in control-api ever
 * called `.save()` on `state.artifactStore` outside of tests. `GET
 * /v1/artifacts` was permanently empty regardless of how much real work
 * happened.
 *
 * `packages/agent-runtime`'s `AgentWorker` now includes the full sealed
 * `ArtifactContract` on `artifact.sealed` when a real `ArtifactEngine`
 * sealed one — this projects that straight into `state.artifactStore`, no
 * second cross-process store to query, no new event.
 */
export async function projectArtifactSealedEvent(state: ControlApiState, event: EventEnvelope): Promise<void> {
  const artifact = event.payload.artifact as ArtifactContract | undefined;
  if (!artifact || !state.artifactStore) return;

  try {
    await state.artifactStore.save(artifact);
  } catch (err) {
    log.warn(
      { artifactId: artifact.artifactId, err: err instanceof Error ? err.message : String(err) },
      'could not save sealed artifact into state.artifactStore',
    );
  }
}
