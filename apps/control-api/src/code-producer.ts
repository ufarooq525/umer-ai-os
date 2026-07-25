/**
 * Chooses which code producer authors eng change-sets for this deployment.
 *
 * Adding a real generator (LLM adapter, scripted recipe, external agent) means adding
 * one entry to {@link PRODUCER_FACTORIES} — nothing in the registry, gate policy, or
 * apply path changes, because every producer's output goes through the same validation
 * and the same human gate.
 */

import { createManualCodeProducer, type CodeProducer } from '@umer/registry';

export const CODE_PRODUCER_ENV = 'UMER_ENG_CODE_PRODUCER';

const PRODUCER_FACTORIES: Record<string, () => CodeProducer> = {
  manual: createManualCodeProducer,
};

export const DEFAULT_CODE_PRODUCER = 'manual';

export type CodeProducerResolution = {
  producer: CodeProducer;
  /** Value requested via env, when it was set. */
  requested?: string;
  /** Set when the requested producer is unknown and manual was used instead. */
  fallbackReason?: string;
};

/**
 * Fail closed: an unknown producer name never silently disables the change-set
 * contract — it falls back to manual, which writes nothing.
 */
export function resolveCodeProducer(
  env: NodeJS.ProcessEnv = process.env,
): CodeProducerResolution {
  const requested = env[CODE_PRODUCER_ENV]?.trim();
  if (!requested) {
    return { producer: PRODUCER_FACTORIES[DEFAULT_CODE_PRODUCER]!() };
  }

  const factory = PRODUCER_FACTORIES[requested.toLowerCase()];
  if (!factory) {
    return {
      producer: PRODUCER_FACTORIES[DEFAULT_CODE_PRODUCER]!(),
      requested,
      fallbackReason: `Unknown ${CODE_PRODUCER_ENV}="${requested}" — known producers: ${Object.keys(
        PRODUCER_FACTORIES,
      ).join(', ')}. Falling back to manual (writes nothing).`,
    };
  }

  return { producer: factory(), requested };
}

export function listCodeProducers(): string[] {
  return Object.keys(PRODUCER_FACTORIES);
}
