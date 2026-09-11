/**
 * @umer/agent-runtime — execute Work Packages against Specialist mandates.
 */

export { packageName } from './types.js';
export { AgentRuntimeError, type AgentRuntimeErrorCode } from './errors.js';
export { assertMandateBinding } from './bind.js';
export { AgentRuntime, type AgentRunResult, type AgentRuntimeOptions } from './runtime.js';
export { WORK_PACKAGE_DISPATCH_COMMAND } from './constants.js';
export {
  AgentWorker,
  createAgentWorker,
  type AgentDisplayInfo,
  type AgentWorkerOptions,
} from './worker.js';
export { createAgentRuntime, createAgentStack, type CreateAgentRuntimeOptions } from './factory.js';
export { runEngineeringApplicationDelivery, type SpecialistRunResult } from './handlers/engineering.js';
export { runLlmAgent, type LlmAgentDependencies, type LlmAgentRunOptions } from './handlers/llm-agent.js';
export {
  createNoopAgentEventPublisher,
  createMessageFabricAgentEventPublisher,
  type AgentEventPublisher,
} from './events.js';
export {
  subscribeAgentRunReadModel,
  type RuntimeEventSource,
  type SubscribeAgentRunReadModelOptions,
} from './read-model.js';
export {
  createLlmCodeProducer,
  type LlmCodeProducerOptions,
} from './code-producer-llm.js';
