import type { ActivateSpecialistPayload, SuspendSpecialistPayload } from '@umer/contracts';
import { CommandError } from '../errors.js';
import type { CommandDeps, HandlerOutcome } from '../types.js';
import type { SpecialistControlRecord } from '../ports.js';

async function currentControlState(deps: CommandDeps, specialistId: string): Promise<SpecialistControlRecord['controlState']> {
  const existing = await deps.specialistControl.get(specialistId);
  return existing?.controlState ?? 'active';
}

export async function suspendSpecialist(
  deps: CommandDeps,
  payload: SuspendSpecialistPayload,
  correlationId: string,
): Promise<HandlerOutcome<SpecialistControlRecord>> {
  const state = await currentControlState(deps, payload.specialistId);
  if (state === 'suspended') {
    throw new CommandError('INVALID_TRANSITION', `Specialist ${payload.specialistId} is already suspended`);
  }
  const record = await deps.specialistControl.suspend(payload.specialistId, payload.reason, correlationId);
  return {
    data: record,
    events: [
      {
        name: 'specialist.control.changed',
        payload: { specialistId: record.specialistId, controlState: record.controlState, action: 'suspended', reason: payload.reason },
        alreadyPublished: true,
      },
    ],
  };
}

export async function activateSpecialist(
  deps: CommandDeps,
  payload: ActivateSpecialistPayload,
  correlationId: string,
): Promise<HandlerOutcome<SpecialistControlRecord>> {
  const state = await currentControlState(deps, payload.specialistId);
  if (state !== 'suspended') {
    throw new CommandError('INVALID_TRANSITION', `Specialist ${payload.specialistId} is not suspended`);
  }
  const record = await deps.specialistControl.activate(payload.specialistId, correlationId);
  return {
    data: record,
    events: [
      {
        name: 'specialist.control.changed',
        payload: { specialistId: record.specialistId, controlState: record.controlState, action: 'activated' },
        alreadyPublished: true,
      },
    ],
  };
}
