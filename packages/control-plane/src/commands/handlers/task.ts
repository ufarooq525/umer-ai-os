import type {
  AssignTaskPayload,
  CreateTaskPayload,
  ReassignTaskPayload,
  TaskContract,
} from '@umer/contracts';
import { CommandError } from '../errors.js';
import type { CommandDeps, HandlerOutcome } from '../types.js';

/**
 * AssignTask/ReassignTask treat `agentId` as an opaque reference, not a
 * foreign key checked against a directory. The only Agent store in this
 * codebase (@umer/observability's AgentRegistryStore) is a read-only
 * projection derived from agent.run.* runtime events — there is no writable
 * Agent persistence layer to validate against, and building one solely to
 * backstop this check would be a second Agent Registry, which the
 * architecture explicitly avoids. Documented limitation for this milestone,
 * not an oversight.
 */
async function requireTask(deps: CommandDeps, taskId: string): Promise<TaskContract> {
  const task = await deps.tasks.get(taskId);
  if (!task) {
    throw new CommandError('NOT_FOUND', `Task ${taskId} not found`);
  }
  return task;
}

export async function createTask(
  deps: CommandDeps,
  payload: CreateTaskPayload,
  correlationId: string,
): Promise<HandlerOutcome<TaskContract>> {
  const task = await deps.tasks.create(
    {
      epicId: payload.epicId,
      projectId: payload.projectId,
      title: payload.title,
      description: payload.description,
      acceptanceCriteria: payload.acceptanceCriteria,
      capabilityIds: payload.capabilityIds,
    },
    correlationId,
  );
  return {
    data: task,
    events: [{ name: 'task.created', payload: { taskId: task.taskId, projectId: task.projectId }, alreadyPublished: true }],
  };
}

export async function assignTask(
  deps: CommandDeps,
  payload: AssignTaskPayload,
  correlationId: string,
): Promise<HandlerOutcome<TaskContract>> {
  const task = await requireTask(deps, payload.taskId);
  if (task.assignedAgentId) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Task ${payload.taskId} is already assigned to ${task.assignedAgentId} — use ReassignTask instead`,
    );
  }
  const updated = await deps.tasks.assign(payload.taskId, payload.agentId, correlationId);
  if (!updated) {
    throw new CommandError('NOT_FOUND', `Task ${payload.taskId} not found`);
  }
  return {
    data: updated,
    events: [
      {
        name: 'task.assigned',
        payload: { taskId: updated.taskId, agentId: payload.agentId, projectId: updated.projectId },
        alreadyPublished: true,
      },
    ],
  };
}

export async function reassignTask(
  deps: CommandDeps,
  payload: ReassignTaskPayload,
  correlationId: string,
): Promise<HandlerOutcome<TaskContract>> {
  const task = await requireTask(deps, payload.taskId);
  if (!task.assignedAgentId) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Task ${payload.taskId} is not currently assigned — use AssignTask instead`,
    );
  }
  if (task.assignedAgentId === payload.agentId) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Task ${payload.taskId} is already assigned to ${payload.agentId}`,
    );
  }
  const previousAgentId = task.assignedAgentId;
  const updated = await deps.tasks.reassign(payload.taskId, payload.agentId, correlationId);
  if (!updated) {
    throw new CommandError('NOT_FOUND', `Task ${payload.taskId} not found`);
  }
  return {
    data: updated,
    events: [
      {
        name: 'task.assigned',
        payload: {
          taskId: updated.taskId,
          agentId: payload.agentId,
          previousAgentId,
          projectId: updated.projectId,
          reason: payload.reason,
        },
        alreadyPublished: true,
      },
    ],
  };
}
