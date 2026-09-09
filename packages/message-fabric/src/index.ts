/**
 * @umer/message-fabric — NATS JetStream command/event plane with @umer/contracts envelopes.
 */

export { packageName } from './connection.js';
export { STREAMS, SUBJECTS, DEFAULT_MAX_DELIVER, DEFAULT_ACK_WAIT_MS, DEFAULT_REQUEST_TIMEOUT_MS } from './constants.js';
export { MessageFabricError } from './errors.js';
export {
  createCommandEnvelope,
  createEventEnvelope,
  parseCommandEnvelope,
  parseEventEnvelope,
} from './envelopes.js';
export { InMemoryIdempotencyStore, type IdempotencyStore } from './idempotency.js';
export { withRetry, computeBackoff, DEFAULT_RETRY, type RetryOptions } from './retry.js';
export { injectTraceContext, extractTraceContext, withMessageSpan } from './tracing.js';
export {
  MessageFabricClient,
  type MessageFabricClientOptions,
  type CommandHandler,
  type EventHandler,
  type MessageAckContext,
  type SubscribeOptions,
  type SubscriptionHandle,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from './client.js';
export { createMessageFabric, closeMessageFabric, resetMessageFabricSingleton, type CreateMessageFabricOptions } from './connection.js';
export { DeliverPolicy, AckPolicy } from 'nats';
