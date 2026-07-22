import { randomUUID } from 'node:crypto';
import {
  SCHEMA_VERSION,
  CommandEnvelopeSchema,
  EventEnvelopeSchema,
  parseContract,
  type CommandEnvelope,
  type EventEnvelope,
  type RuntimeEventName,
} from '@umer/contracts';

export function createCommandEnvelope(input: {
  name: string;
  producer: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  replyTo?: string;
  tenantId?: string;
  idempotencyKey?: string;
  commandId?: string;
  issuedAt?: string;
}): CommandEnvelope {
  return parseContract(CommandEnvelopeSchema, {
    commandId: input.commandId ?? randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    name: input.name,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    replyTo: input.replyTo,
    tenantId: input.tenantId,
    producer: input.producer,
    payload: input.payload ?? {},
    idempotencyKey: input.idempotencyKey,
  });
}

export function createEventEnvelope(input: {
  name: RuntimeEventName;
  producer: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  causationId?: string;
  tenantId?: string;
  eventId?: string;
  occurredAt?: string;
}): EventEnvelope {
  return parseContract(EventEnvelopeSchema, {
    eventId: input.eventId ?? randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    name: input.name,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    causationId: input.causationId,
    tenantId: input.tenantId,
    producer: input.producer,
    payload: input.payload ?? {},
  });
}

export function parseCommandEnvelope(data: unknown): CommandEnvelope {
  return parseContract(CommandEnvelopeSchema, data, 'Invalid command envelope');
}

export function parseEventEnvelope(data: unknown): EventEnvelope {
  return parseContract(EventEnvelopeSchema, data, 'Invalid event envelope');
}
