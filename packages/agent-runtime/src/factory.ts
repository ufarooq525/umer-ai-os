import type { MessageFabricClient } from '@umer/message-fabric';
import { AgentRuntime, type AgentRuntimeOptions } from './runtime.js';
import { AgentWorker } from './worker.js';

export type CreateAgentRuntimeOptions = AgentRuntimeOptions;

export function createAgentRuntime(options: CreateAgentRuntimeOptions): AgentRuntime {
  return new AgentRuntime(options);
}

export function createAgentStack(input: {
  fabric: MessageFabricClient;
  producer: string;
  resolveMandate: CreateAgentRuntimeOptions['resolveMandate'];
}): { runtime: AgentRuntime; worker: AgentWorker } {
  const runtime = createAgentRuntime({ resolveMandate: input.resolveMandate });
  const worker = new AgentWorker({
    runtime,
    fabric: input.fabric,
    producer: input.producer,
  });
  return { runtime, worker };
}
