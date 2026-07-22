import type { WorkPackageContract } from '@umer/contracts';
import { createCommandEnvelope } from '@umer/message-fabric';
import type { MessageFabricClient } from '@umer/message-fabric';
import { SUBJECTS } from '@umer/message-fabric';
import { AGENT_DISPATCH_COMMAND } from './constants.js';
import { OrchestrationError } from './errors.js';

export type WorkPackageDispatcher = {
  dispatch(workPackage: WorkPackageContract, correlationId: string): Promise<void>;
};

export function createWorkPackageDispatcher(
  fabric: MessageFabricClient,
  producer: string,
): WorkPackageDispatcher {
  return {
    async dispatch(workPackage, correlationId) {
      const command = createCommandEnvelope({
        name: AGENT_DISPATCH_COMMAND,
        producer,
        correlationId,
        idempotencyKey: `${workPackage.workPackageId}:${workPackage.attempt}`,
        payload: { workPackage },
      });

      try {
        await fabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, command);
      } catch (err) {
        throw new OrchestrationError(
          'DISPATCH_FAILED',
          `Failed to dispatch Work Package ${workPackage.workPackageId}`,
          err,
        );
      }
    },
  };
}
