/**
 * Minimal specialist-request event shape for the shim-first bus.
 *
 * Scoped to what watchdogs need to publish and specialists need to consume —
 * not Envelope v2 / Message Fabric. Fabric remains the eventual substrate.
 *
 * `source` is structured now so a later auditor can answer
 * "nightly sweep vs human intake" without retrofitting.
 */

export type BusEventType = 'specialist.qa.requested';

/**
 * Who/what caused this specialist request.
 * Extend kinds carefully — this is the audit trail seam for watchdogs.
 */
export type BusEventSource =
  | {
      kind: 'human.intake';
      /** Approver / operator id when known. */
      actorId: string;
      /** Which UI/API surface accepted the instruction. */
      channel: 'control-api' | 'quick-task' | 'intake-form' | 'api';
    }
  | {
      kind: 'watchdog';
      /** e.g. qa.watchdog */
      watchdogId: string;
      cadence: 'nightly' | 'hourly' | 'on-commit' | 'on-deploy' | 'manual';
      /** Declared schedule identity when the watchdog has one. */
      scheduleId?: string;
      /** Per-tick id so two nightly runs are distinguishable. */
      tickId?: string;
    }
  | {
      kind: 'system';
      componentId: string;
      reason: string;
    };

export type QaRequestedPayload = {
  goal: string;
  doneWhen?: string;
  constraints?: string[];
};

export type BusEventPayloadByType = {
  'specialist.qa.requested': QaRequestedPayload;
};

export type BusEvent<T extends BusEventType = BusEventType> = {
  eventId: string;
  type: T;
  projectId: string;
  occurredAt: string;
  correlationId: string;
  source: BusEventSource;
  payload: BusEventPayloadByType[T];
};

export type BusHandler<T extends BusEventType = BusEventType> = (
  event: BusEvent<T>,
) => Promise<unknown> | unknown;

export type BusPublishResult = {
  event: BusEvent;
  handlerCount: number;
  results: unknown[];
};
