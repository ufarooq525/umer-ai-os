import type { SpecialistContract } from '@umer/contracts';
import type { SpecialistRegistry } from '@umer/registry';
import type { WorkGraphNode } from '@umer/contracts';

export class SpecialistResolutionError extends Error {
  constructor(
    public readonly code: 'NO_CAPABILITY_MATCH' | 'AMBIGUOUS_MATCH',
    message: string,
  ) {
    super(message);
    this.name = 'SpecialistResolutionError';
  }
}

export type SpecialistResolution = {
  node: WorkGraphNode;
  specialist: SpecialistContract;
};

/**
 * Resolves planned graph work to an already-registered active specialist.
 * No specialist or agent is created as a side effect.
 */
export function resolveSpecialistForNode(
  node: WorkGraphNode,
  registry: SpecialistRegistry,
): SpecialistResolution {
  if (node.requiredCapabilityIds.length === 0) {
    throw new SpecialistResolutionError(
      'NO_CAPABILITY_MATCH',
      `Work Graph node ${node.nodeId} has no required capabilities`,
    );
  }

  const required = new Set(node.requiredCapabilityIds);
  const candidates = registry
    .resolve({})
    .filter((specialist) => node.requiredCapabilityIds.every((capabilityId) => specialist.capabilityIds.includes(capabilityId)))
    .sort((a, b) => a.specialistId.localeCompare(b.specialistId));

  if (candidates.length === 0) {
    throw new SpecialistResolutionError(
      'NO_CAPABILITY_MATCH',
      `No active specialist can satisfy node ${node.nodeId} capabilities: ${[...required].join(', ')}`,
    );
  }

  if (candidates.length > 1) {
    // Do not silently choose between equally valid owners. The Control Plane
    // can introduce an explicit policy later; ambiguity is safer than guessing.
    throw new SpecialistResolutionError(
      'AMBIGUOUS_MATCH',
      `Multiple active specialists can satisfy node ${node.nodeId}: ${candidates.map((candidate) => candidate.specialistId).join(', ')}`,
    );
  }

  return { node, specialist: candidates[0] };
}
