import type {
  CreateProjectFromOpportunityPayload,
  Opportunity,
  OpportunityStatus,
  ProjectContract,
  RejectOpportunityPayload,
  SelectOpportunityPayload,
} from '@umer/contracts';
import { CommandError } from '../errors.js';
import type { CommandDeps, HandlerOutcome } from '../types.js';

const SELECTABLE_FROM: OpportunityStatus[] = [
  'discovered',
  'researching',
  'validated',
  'outreach_ready',
  'in_sales',
];

const REJECTABLE_FROM: OpportunityStatus[] = [
  'discovered',
  'researching',
  'validated',
  'outreach_ready',
  'in_sales',
  'selected_for_execution',
];

async function requireOpportunity(deps: CommandDeps, opportunityId: string): Promise<Opportunity> {
  const opportunity = await deps.opportunities.getOpportunity(opportunityId);
  if (!opportunity) {
    throw new CommandError('NOT_FOUND', `Opportunity ${opportunityId} not found`);
  }
  return opportunity;
}

export async function selectOpportunity(
  deps: CommandDeps,
  payload: SelectOpportunityPayload,
): Promise<HandlerOutcome<Opportunity>> {
  const opportunity = await requireOpportunity(deps, payload.opportunityId);
  if (!SELECTABLE_FROM.includes(opportunity.status)) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Opportunity ${payload.opportunityId} cannot be selected from status "${opportunity.status}"`,
    );
  }
  const previousStatus = opportunity.status;
  const updated: Opportunity = {
    ...opportunity,
    status: 'selected_for_execution',
    updatedAt: deps.clock.nowIso(),
  };
  await deps.opportunities.saveOpportunity(updated);
  return {
    data: updated,
    events: [
      {
        name: 'opportunity.selected',
        payload: { opportunityId: updated.id, previousStatus, status: updated.status },
      },
    ],
  };
}

export async function rejectOpportunity(
  deps: CommandDeps,
  payload: RejectOpportunityPayload,
): Promise<HandlerOutcome<Opportunity>> {
  const opportunity = await requireOpportunity(deps, payload.opportunityId);
  if (!REJECTABLE_FROM.includes(opportunity.status)) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Opportunity ${payload.opportunityId} cannot be rejected from status "${opportunity.status}"`,
    );
  }
  const previousStatus = opportunity.status;
  const updated: Opportunity = {
    ...opportunity,
    status: 'rejected',
    updatedAt: deps.clock.nowIso(),
  };
  await deps.opportunities.saveOpportunity(updated);
  return {
    data: updated,
    events: [
      {
        name: 'opportunity.status.changed',
        payload: {
          opportunityId: updated.id,
          previousStatus,
          status: updated.status,
          reason: payload.reason,
        },
      },
    ],
  };
}

export async function createProjectFromOpportunity(
  deps: CommandDeps,
  payload: CreateProjectFromOpportunityPayload,
  correlationId: string,
): Promise<HandlerOutcome<{ project: ProjectContract; opportunity: Opportunity }>> {
  const opportunity = await requireOpportunity(deps, payload.opportunityId);
  if (opportunity.status !== 'selected_for_execution') {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Opportunity ${payload.opportunityId} must be selected_for_execution before a project can be created from it (current: "${opportunity.status}")`,
    );
  }
  const existingProjects = await deps.projects.list();
  if (existingProjects.some((project) => project.sourceOpportunityId === opportunity.id)) {
    throw new CommandError(
      'INVALID_TRANSITION',
      `Opportunity ${payload.opportunityId} already has a project`,
    );
  }

  const project = await deps.projects.create(
    {
      name: payload.name ?? opportunity.title,
      owner: payload.owner,
      sourceOpportunityId: opportunity.id,
    },
    correlationId,
  );

  const updatedOpportunity: Opportunity = {
    ...opportunity,
    status: 'project_created',
    updatedAt: deps.clock.nowIso(),
  };
  await deps.opportunities.saveOpportunity(updatedOpportunity);

  return {
    data: { project, opportunity: updatedOpportunity },
    events: [
      // project.created was already published by deps.projects.create() itself.
      { name: 'project.created', payload: { projectId: project.projectId, sourceOpportunityId: opportunity.id }, alreadyPublished: true },
      {
        name: 'opportunity.project.created',
        payload: { opportunityId: opportunity.id, projectId: project.projectId },
      },
    ],
  };
}
