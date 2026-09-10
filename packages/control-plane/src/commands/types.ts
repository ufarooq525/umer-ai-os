import type { EventEnvelope, RuntimeEventName } from '@umer/contracts';
import type { Clock } from '../service.js';
import type { AgentControlPort, OpportunityWritePort, ProjectWritePort, SpecialistControlPort, TaskWritePort } from './ports.js';

export type CommandDeps = {
  opportunities: OpportunityWritePort;
  projects: ProjectWritePort;
  tasks: TaskWritePort;
  agentControl: AgentControlPort;
  specialistControl: SpecialistControlPort;
  clock: Clock;
};

/**
 * One state change a handler produced.
 *
 * `alreadyPublished: true` means the underlying store (ProjectStore,
 * TaskStore, AgentControlStore) already emitted this event itself through its
 * own injected event publisher — the command service records it for the
 * result/audit trail but must not publish it again. Opportunity writes go
 * through a plain persistence port with no publisher of its own, so those
 * events are always `alreadyPublished: false` (or omitted) and the command
 * service is the one that publishes them.
 */
export type HandlerEvent = {
  name: RuntimeEventName;
  payload: Record<string, unknown>;
  alreadyPublished?: boolean;
};

export type HandlerOutcome<TData = unknown> = {
  data?: TData;
  events: HandlerEvent[];
};

export type CommandResultStatus = 'applied' | 'duplicate';

export type CommandResult<TData = unknown> = {
  commandId: string;
  status: CommandResultStatus;
  data?: TData;
  events: EventEnvelope[];
};
