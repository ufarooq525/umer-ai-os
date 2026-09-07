import { createLogger } from '@umer/observability';
import { applyRequirementDecomposition } from '@umer/orchestration';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Canonical M1 bridge: once the real Requirement and Work Graph stores are
 * connected, every new project-scoped Requirement creates the initial
 * delivery graph exactly once. The Requirements node retains the canonical
 * requirement id in contract metadata; downstream nodes remain
 * Planned/Blocked until their real specialist work is completed, so this
 * never fabricates progress.
 *
 * Wraps `state.requirementStore.create` rather than subscribing to a
 * separate event so a project's Work Graph is guaranteed to exist by the
 * time `create()` resolves — no caller can observe a Requirement without its
 * graph. `applyRequirementDecomposition` fails closed on a duplicate slug
 * (WorkGraph's own DUPLICATE_NODE validation), so the existing-node check
 * here is purely to skip that already-decomposed case quietly instead of
 * throwing on every subsequent Requirement for the same project.
 */
export function connectRequirementWorkGraphBridge(state: ControlApiState): void {
  if (!state.requirementStore || !state.persistentWorkGraph) return;
  const requirementStore = state.requirementStore;
  const persistentWorkGraph = state.persistentWorkGraph;
  const originalCreate = requirementStore.create.bind(requirementStore);
  requirementStore.create = async (input) => {
    const requirement = await originalCreate(input);
    if (!requirement.projectId) return requirement;

    const graph = await persistentWorkGraph.load(requirement.projectId);
    const hasRequirementsNode = graph
      .listNodes(requirement.projectId)
      .some((node) => node.type === 'Requirements');
    if (!hasRequirementsNode) {
      await applyRequirementDecomposition(persistentWorkGraph, {
        projectId: requirement.projectId,
        slug: requirement.requirementId,
        requirementId: requirement.requirementId,
      });
      log.info(
        { requirementId: requirement.requirementId, projectId: requirement.projectId },
        'requirement created canonical Work Graph decomposition',
      );
    }
    return requirement;
  };
}
