/**
 * @umer/agent-runtime — execute Work Packages against Specialist mandates.
 */

export { packageName } from './types.js';
export { AgentRuntimeError, type AgentRuntimeErrorCode } from './errors.js';
export { assertMandateBinding } from './bind.js';
export { AgentRuntime, type AgentRunResult, type AgentRuntimeOptions } from './runtime.js';
export { WORK_PACKAGE_DISPATCH_COMMAND } from './constants.js';
export { AgentWorker, createAgentWorker, type AgentWorkerOptions } from './worker.js';
export { createAgentRuntime, createAgentStack, type CreateAgentRuntimeOptions } from './factory.js';
export { runEngineeringApplicationDelivery, type SpecialistRunResult } from './handlers/engineering.js';
