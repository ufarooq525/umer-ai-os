import type {
  CancelProjectPayload,
  CreateProjectPayload,
  PauseProjectPayload,
  ProjectContract,
  ProjectStatus,
  ResumeProjectPayload,
} from '@umer/contracts';
import { CommandError } from '../errors.js';
import type { CommandDeps, HandlerOutcome } from '../types.js';

const PAUSABLE_FROM: ProjectStatus[] = ['Forming', 'Active', 'Stabilizing'];
const CANCELLABLE_FROM_EXCLUDED: ProjectStatus[] = ['Archived', 'Abandoned'];

async function requireProject(deps: CommandDeps, projectId: string): Promise<ProjectContract> {
  const project = await deps.projects.get(projectId);
  if (!project) {
    throw new CommandError('NOT_FOUND', `Project ${projectId} not found`);
  }
  return project;
}

export async function createProject(
  deps: CommandDeps,
  payload: CreateProjectPayload,
  correlationId: string,
): Promise<HandlerOutcome<ProjectContract>> {
  const project = await deps.projects.create({ name: payload.name, owner: payload.owner }, correlationId);
  return {
    data: project,
    events: [{ name: 'project.created', payload: { projectId: project.projectId }, alreadyPublished: true }],
  };
}

export async function pauseProject(
  deps: CommandDeps,
  payload: PauseProjectPayload,
  correlationId: string,
): Promise<HandlerOutcome<ProjectContract>> {
  const project = await requireProject(deps, payload.projectId);
  if (!PAUSABLE_FROM.includes(project.status)) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Project ${payload.projectId} cannot be paused from status "${project.status}"`,
    );
  }
  const updated = await deps.projects.updateStatus(payload.projectId, 'Paused', correlationId);
  if (!updated) {
    throw new CommandError('NOT_FOUND', `Project ${payload.projectId} not found`);
  }
  return {
    data: updated,
    events: [
      {
        name: 'project.status.changed',
        payload: { projectId: updated.projectId, status: updated.status, previousStatus: project.status, reason: payload.reason },
        alreadyPublished: true,
      },
    ],
  };
}

export async function resumeProject(
  deps: CommandDeps,
  payload: ResumeProjectPayload,
  correlationId: string,
): Promise<HandlerOutcome<ProjectContract>> {
  const project = await requireProject(deps, payload.projectId);
  if (project.status !== 'Paused') {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Project ${payload.projectId} cannot be resumed from status "${project.status}"`,
    );
  }
  const updated = await deps.projects.updateStatus(payload.projectId, 'Active', correlationId);
  if (!updated) {
    throw new CommandError('NOT_FOUND', `Project ${payload.projectId} not found`);
  }
  return {
    data: updated,
    events: [
      {
        name: 'project.status.changed',
        payload: { projectId: updated.projectId, status: updated.status, previousStatus: project.status },
        alreadyPublished: true,
      },
    ],
  };
}

export async function cancelProject(
  deps: CommandDeps,
  payload: CancelProjectPayload,
  correlationId: string,
): Promise<HandlerOutcome<ProjectContract>> {
  const project = await requireProject(deps, payload.projectId);
  if (CANCELLABLE_FROM_EXCLUDED.includes(project.status)) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Project ${payload.projectId} cannot be cancelled from status "${project.status}"`,
    );
  }
  const updated = await deps.projects.updateStatus(payload.projectId, 'Abandoned', correlationId);
  if (!updated) {
    throw new CommandError('NOT_FOUND', `Project ${payload.projectId} not found`);
  }
  return {
    data: updated,
    events: [
      {
        name: 'project.status.changed',
        payload: { projectId: updated.projectId, status: updated.status, previousStatus: project.status, reason: payload.reason },
        alreadyPublished: true,
      },
    ],
  };
}
