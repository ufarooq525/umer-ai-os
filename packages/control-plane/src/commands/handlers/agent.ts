import type { CancelWorkPayload, PauseAgentPayload, ResumeAgentPayload, TaskContract } from '@umer/contracts';
import { CommandError } from '../errors.js';
import type { CommandDeps, HandlerOutcome } from '../types.js';
import type { AgentControlRecord } from '../ports.js';

async function currentControlState(deps: CommandDeps, agentId: string): Promise<AgentControlRecord['controlState']> {
  const existing = await deps.agentControl.get(agentId);
  return existing?.controlState ?? 'active';
}

export async function pauseAgent(
  deps: CommandDeps,
  payload: PauseAgentPayload,
  correlationId: string,
): Promise<HandlerOutcome<AgentControlRecord>> {
  const state = await currentControlState(deps, payload.agentId);
  if (state === 'paused') {
    throw new CommandError('INVALID_TRANSITION', `Agent ${payload.agentId} is already paused`);
  }
  const record = await deps.agentControl.pause(payload.agentId, payload.reason, correlationId);
  return {
    data: record,
    events: [
      {
        name: 'agent.control.changed',
        payload: { agentId: record.agentId, controlState: record.controlState, action: 'paused', reason: payload.reason },
        alreadyPublished: true,
      },
    ],
  };
}

export async function resumeAgent(
  deps: CommandDeps,
  payload: ResumeAgentPayload,
  correlationId: string,
): Promise<HandlerOutcome<AgentControlRecord>> {
  const state = await currentControlState(deps, payload.agentId);
  if (state !== 'paused') {
    throw new CommandError('INVALID_TRANSITION', `Agent ${payload.agentId} is not paused`);
  }
  const record = await deps.agentControl.resume(payload.agentId, correlationId);
  return {
    data: record,
    events: [
      {
        name: 'agent.control.changed',
        payload: { agentId: record.agentId, controlState: record.controlState, action: 'resumed' },
        alreadyPublished: true,
      },
    ],
  };
}

export async function cancelWork(
  deps: CommandDeps,
  payload: CancelWorkPayload,
  correlationId: string,
): Promise<HandlerOutcome<{ agentControl: AgentControlRecord; task?: TaskContract }>> {
  // Validate the task (if named) before mutating anything, so a bad payload
  // never leaves the agent's control record half-updated.
  if (payload.taskId) {
    const task = await deps.tasks.get(payload.taskId);
    if (!task) {
      throw new CommandError('NOT_FOUND', `Task ${payload.taskId} not found`);
    }
    if (task.status === 'Done' || task.status === 'Cancelled') {
      throw new CommandError(
        'INVALID_TRANSITION',
        `Task ${payload.taskId} cannot be cancelled from status "${task.status}"`,
      );
    }
  }

  const record = await deps.agentControl.recordCancelWork(
    payload.agentId,
    { workPackageId: payload.workPackageId, taskId: payload.taskId },
    payload.reason,
    correlationId,
  );

  const events: HandlerOutcome<unknown>['events'] = [
    {
      name: 'agent.control.changed',
      payload: {
        agentId: record.agentId,
        action: 'work_cancelled',
        workPackageId: payload.workPackageId,
        taskId: payload.taskId,
        reason: payload.reason,
      },
      alreadyPublished: true,
    },
  ];

  let task: TaskContract | undefined;
  if (payload.taskId) {
    task = await deps.tasks.updateStatus(payload.taskId, 'Cancelled', correlationId);
    events.push({
      name: 'task.status.changed',
      payload: { taskId: payload.taskId, status: 'Cancelled', reason: payload.reason },
      alreadyPublished: true,
    });
  }

  return { data: { agentControl: record, task }, events };
}
