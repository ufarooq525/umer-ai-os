import { randomUUID } from 'node:crypto';
import {
  CeoCommandEnvelopeSchema,
  parseCeoCommandPayload,
  SCHEMA_VERSION,
  type AssignTaskPayload,
  type CancelProjectPayload,
  type CancelWorkPayload,
  type CeoCommandEnvelope,
  type CeoCommandName,
  type CreateProjectFromOpportunityPayload,
  type CreateProjectPayload,
  type CreateTaskPayload,
  type EventEnvelope,
  type PauseAgentPayload,
  type PauseProjectPayload,
  type ReassignTaskPayload,
  type RejectOpportunityPayload,
  type ResumeAgentPayload,
  type ResumeProjectPayload,
  type SelectOpportunityPayload,
} from '@umer/contracts';
import type { AuditService } from '@umer/audit';
import type { TrustRuntime } from '@umer/trust';
import { systemClock, type Clock } from '../service.js';
import { CommandError } from './errors.js';
import { createNoopCommandEventPublisher, type CommandEventPublisher } from './events.js';
import { InMemoryCommandIdempotencyStore, type CommandIdempotencyStore } from './idempotency.js';
import type { AgentControlPort, OpportunityWritePort, ProjectWritePort, TaskWritePort } from './ports.js';
import type { CommandDeps, CommandResult, HandlerOutcome } from './types.js';
import { pauseAgent, resumeAgent, cancelWork } from './handlers/agent.js';
import { createProjectFromOpportunity, rejectOpportunity, selectOpportunity } from './handlers/opportunity.js';
import { cancelProject, createProject, pauseProject, resumeProject } from './handlers/project.js';
import { assignTask, createTask, reassignTask } from './handlers/task.js';

export type CeoCommandServicePorts = {
  opportunities: OpportunityWritePort;
  projects: ProjectWritePort;
  tasks: TaskWritePort;
  agentControl: AgentControlPort;
};

export type CeoCommandServiceOptions = {
  trust: TrustRuntime;
  auditService: AuditService;
  idempotency?: CommandIdempotencyStore;
  events?: CommandEventPublisher;
  clock?: Clock;
};

/**
 * CEO Command & Decision Plane dispatcher: Command → Authorization → Handler
 * → State mutation → Domain event → Audit. One instance per process; the
 * ports it's constructed with (apps/control-api's ProjectStore/TaskStore,
 * @umer/opportunity-intelligence's OpportunityPersistence, control-api's
 * AgentControlStore) are already the CEO read models' data sources, so a
 * successful command is visible to the next GET with no extra wiring.
 */
export class CeoCommandService {
  private readonly ports: CeoCommandServicePorts;
  private readonly trust: TrustRuntime;
  private readonly auditService: AuditService;
  private readonly idempotency: CommandIdempotencyStore;
  private readonly events: CommandEventPublisher;
  private readonly clock: Clock;

  constructor(ports: CeoCommandServicePorts, options: CeoCommandServiceOptions) {
    this.ports = ports;
    this.trust = options.trust;
    this.auditService = options.auditService;
    this.idempotency = options.idempotency ?? new InMemoryCommandIdempotencyStore();
    this.events = options.events ?? createNoopCommandEventPublisher();
    this.clock = options.clock ?? systemClock;
  }

  async execute(command: CeoCommandEnvelope): Promise<CommandResult> {
    const parsed = CeoCommandEnvelopeSchema.safeParse(command);
    if (!parsed.success) {
      await this.auditFailure(command as Partial<CeoCommandEnvelope>, 'failure', parsed.error.message);
      throw new CommandError('MALFORMED_PAYLOAD', `Malformed command envelope: ${parsed.error.message}`, parsed.error);
    }
    const cmd = parsed.data;
    const idempotencyKey = cmd.idempotencyKey ?? cmd.commandId;

    try {
      // Authorization runs BEFORE the idempotency lookup, on every delivery —
      // including replays of a known commandId/idempotencyKey. Checking the
      // cache first would let an unauthorized (or differently-authorized)
      // actor retrieve another actor's command result merely by reusing its
      // commandId, without ever being authorized to see it. A legitimate
      // duplicate from the *same* authorized actor still passes this check
      // every time (their grant hasn't changed) and then hits the cache below.
      const authorization = await this.trust.authorize(
        {
          principal: { principalId: cmd.actor.principalId, kind: cmd.actor.kind },
          action: `ceo.command.${cmd.name}`,
          resourceType: 'command',
          resourceId: cmd.target?.entityId,
        },
        cmd.correlationId,
      );
      if (!authorization.allowed) {
        throw new CommandError(
          'UNAUTHORIZED',
          `Actor ${cmd.actor.principalId} is not authorized to execute ${cmd.name}`,
        );
      }

      const cached = await this.idempotency.get(idempotencyKey);
      if (cached) {
        return { ...cached, commandId: cmd.commandId, status: 'duplicate' };
      }

      let payload: unknown;
      try {
        payload = parseCeoCommandPayload(cmd.name, cmd.payload);
      } catch (err) {
        throw new CommandError(
          'MALFORMED_PAYLOAD',
          `Malformed payload for ${cmd.name}: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }

      const outcome = await this.dispatch(cmd.name, payload, cmd.correlationId);

      const eventEnvelopes: EventEnvelope[] = [];
      for (const event of outcome.events) {
        eventEnvelopes.push({
          eventId: randomUUID(),
          schemaVersion: SCHEMA_VERSION,
          name: event.name,
          occurredAt: this.clock.nowIso(),
          correlationId: cmd.correlationId,
          causationId: cmd.commandId,
          producer: 'ceo-command-plane',
          payload: event.payload,
        });
        if (!event.alreadyPublished) {
          await this.events.publish(event.name, cmd.correlationId, event.payload);
        }
      }

      const result: CommandResult = {
        commandId: cmd.commandId,
        status: 'applied',
        data: outcome.data,
        events: eventEnvelopes,
      };

      await this.auditService.append(
        {
          action: cmd.name,
          actor: cmd.actor.principalId,
          resourceType: cmd.target?.entityType ?? 'command',
          resourceId: cmd.target?.entityId ?? cmd.commandId,
          outcome: 'success',
          correlationId: cmd.correlationId,
          detail: {
            commandId: cmd.commandId,
            payload: cmd.payload,
            events: eventEnvelopes.map((event) => ({ name: event.name, eventId: event.eventId })),
          },
        },
        cmd.correlationId,
      );

      await this.idempotency.save(idempotencyKey, result);
      return result;
    } catch (err) {
      await this.auditFailure(
        cmd,
        err instanceof CommandError && err.code === 'UNAUTHORIZED' ? 'denied' : 'failure',
        err instanceof Error ? err.message : String(err),
        err instanceof CommandError ? err.code : undefined,
      );
      throw err;
    }
  }

  private async auditFailure(
    cmd: Partial<CeoCommandEnvelope>,
    outcome: 'failure' | 'denied',
    message: string,
    code?: string,
  ): Promise<void> {
    const correlationId = cmd.correlationId ?? `corr-unknown-${randomUUID()}`;
    await this.auditService.append(
      {
        action: cmd.name ?? 'UnknownCommand',
        actor: cmd.actor?.principalId ?? 'unknown',
        resourceType: cmd.target?.entityType ?? 'command',
        resourceId: cmd.target?.entityId ?? cmd.commandId ?? 'unknown',
        outcome,
        correlationId,
        detail: { commandId: cmd.commandId, payload: cmd.payload, error: { code, message } },
      },
      correlationId,
    );
  }

  private async dispatch(
    name: CeoCommandName,
    payload: unknown,
    correlationId: string,
  ): Promise<HandlerOutcome> {
    const deps: CommandDeps = { ...this.ports, clock: this.clock };
    switch (name) {
      case 'SelectOpportunity':
        return selectOpportunity(deps, payload as SelectOpportunityPayload);
      case 'RejectOpportunity':
        return rejectOpportunity(deps, payload as RejectOpportunityPayload);
      case 'CreateProjectFromOpportunity':
        return createProjectFromOpportunity(deps, payload as CreateProjectFromOpportunityPayload, correlationId);
      case 'CreateProject':
        return createProject(deps, payload as CreateProjectPayload, correlationId);
      case 'PauseProject':
        return pauseProject(deps, payload as PauseProjectPayload, correlationId);
      case 'ResumeProject':
        return resumeProject(deps, payload as ResumeProjectPayload, correlationId);
      case 'CancelProject':
        return cancelProject(deps, payload as CancelProjectPayload, correlationId);
      case 'CreateTask':
        return createTask(deps, payload as CreateTaskPayload, correlationId);
      case 'AssignTask':
        return assignTask(deps, payload as AssignTaskPayload, correlationId);
      case 'ReassignTask':
        return reassignTask(deps, payload as ReassignTaskPayload, correlationId);
      case 'PauseAgent':
        return pauseAgent(deps, payload as PauseAgentPayload, correlationId);
      case 'ResumeAgent':
        return resumeAgent(deps, payload as ResumeAgentPayload, correlationId);
      case 'CancelWork':
        return cancelWork(deps, payload as CancelWorkPayload, correlationId);
      default: {
        const exhaustive: never = name;
        throw new CommandError('MALFORMED_PAYLOAD', `Unknown command name: ${String(exhaustive)}`);
      }
    }
  }
}
