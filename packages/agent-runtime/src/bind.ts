import type { WorkPackageContract } from '@umer/contracts';
import type { RuntimeBinding } from '@umer/specialist-sdk';
import { AgentRuntimeError } from './errors.js';

export function assertMandateBinding(
  workPackage: WorkPackageContract,
  binding: RuntimeBinding,
): void {
  if (workPackage.specialistId !== binding.specialistId) {
    throw new AgentRuntimeError(
      'MANDATE_MISMATCH',
      `Work Package specialist ${workPackage.specialistId} does not match binding ${binding.specialistId}`,
    );
  }

  if (workPackage.specialistSpecHash !== binding.specHash) {
    throw new AgentRuntimeError(
      'MANDATE_MISMATCH',
      `Work Package spec hash does not match registered mandate for ${binding.specialistId}`,
    );
  }
}
