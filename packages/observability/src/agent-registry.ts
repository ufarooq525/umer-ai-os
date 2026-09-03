import type { EventEnvelope } from '@umer/contracts';

/**
 * Agent Registry — a live projection of "which worker identities exist and
 * what are they doing right now", derived from the SAME evt.runtime.agent.>
 * stream the Agent Run read model (./agent-run-read-model.ts) already
 * consumes. Deliberately reuses agent.run.started/completed/failed/killed
 * rather than introducing new agent.created/agent.status.changed events —
 * those three already carry everything this registry needs (see
 * implementation/COMPANY_OPERATING_MODEL.md §Events for the reasoning).
 *
 * An Agent here is the worker identity (Enterprise_Architecture/
 * ENTERPRISE_TAXONOMY.md: Agent = taxonomy-parent identity, Specialist = its
 * governed mandate refinement). This store never duplicates mandate content
 * (mission, tool allowlist, authority class, ...) — only `specialistId` plus
 * whatever display fields (`name`/`department`/`capabilityIds`) happen to
 * have been included on an event payload.
 */

export type AgentSnapshotStatus = 'idle' | 'active' | 'blocked' | 'offline';

export type AgentSnapshot = {
  /** Primary key. */
  agentId: string;
  specialistId: string;
  name?: string;
  department?: string;
  capabilityIds?: string[];
  status: AgentSnapshotStatus;
  lastSeenAt: string;
  currentWorkPackageId?: string;
  currentTaskIds?: string[];
  currentAgentRunId?: string;
  correlationId?: string;
};

export type AgentRegistryStore = {
  upsert(snapshot: AgentSnapshot): Promise<void>;
  get(agentId: string): Promise<AgentSnapshot | undefined>;
  list(filter?: {
    status?: AgentSnapshotStatus;
    department?: string;
    specialistId?: string;
  }): Promise<AgentSnapshot[]>;
  /** Atomic single entry point for applying an event — see InMemoryAgentRegistryStore. */
  project(event: EventEnvelope): Promise<AgentSnapshot | undefined>;
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function strArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : undefined;
}

/**
 * Pure reducer — same shape/guarantees as projectRuntimeEvent in
 * agent-run-read-model.ts. Only agent.run.started/completed/failed/killed are
 * tracked; every other event (including this package's own agent.llm, agent.tool
 * and agent.decision events) returns undefined ("not applicable"), exactly
 * like projectRuntimeEvent does for events outside its own domain.
 */
export function projectAgentEvent(
  existing: AgentSnapshot | undefined,
  event: EventEnvelope,
): AgentSnapshot | undefined {
  const payload = event.payload;
  const agentId = str(payload.agentId) ?? existing?.agentId;
  if (!agentId) {
    return undefined;
  }

  switch (event.name) {
    case 'agent.run.started': {
      const base: AgentSnapshot =
        existing ?? {
          agentId,
          specialistId: str(payload.specialistId) ?? 'unknown',
          status: 'idle',
          lastSeenAt: event.occurredAt,
        };
      return {
        ...base,
        specialistId: str(payload.specialistId) ?? base.specialistId,
        name: str(payload.name) ?? base.name,
        department: str(payload.department) ?? base.department,
        capabilityIds: strArray(payload.capabilityIds) ?? base.capabilityIds,
        status: 'active',
        lastSeenAt: event.occurredAt,
        currentWorkPackageId: str(payload.workPackageId) ?? base.currentWorkPackageId,
        currentTaskIds: strArray(payload.taskIds) ?? base.currentTaskIds,
        currentAgentRunId: str(payload.runId) ?? `${str(payload.workPackageId) ?? ''}:${event.correlationId}`,
        correlationId: event.correlationId,
      };
    }
    case 'agent.run.completed':
    case 'agent.run.failed':
    case 'agent.run.killed': {
      const base: AgentSnapshot =
        existing ?? {
          agentId,
          specialistId: str(payload.specialistId) ?? 'unknown',
          status: 'idle',
          lastSeenAt: event.occurredAt,
        };
      return {
        ...base,
        status: 'idle',
        lastSeenAt: event.occurredAt,
        currentWorkPackageId: undefined,
        currentTaskIds: undefined,
        currentAgentRunId: undefined,
        correlationId: event.correlationId,
      };
    }
    default:
      return undefined;
  }
}

export class InMemoryAgentRegistryStore implements AgentRegistryStore {
  private readonly byAgentId = new Map<string, AgentSnapshot>();

  async upsert(snapshot: AgentSnapshot): Promise<void> {
    this.byAgentId.set(snapshot.agentId, snapshot);
  }

  async get(agentId: string): Promise<AgentSnapshot | undefined> {
    return this.byAgentId.get(agentId);
  }

  async list(filter?: {
    status?: AgentSnapshotStatus;
    department?: string;
    specialistId?: string;
  }): Promise<AgentSnapshot[]> {
    const all = [...this.byAgentId.values()];
    return all.filter((agent) => {
      if (filter?.status && agent.status !== filter.status) return false;
      if (filter?.department && agent.department !== filter.department) return false;
      if (filter?.specialistId && agent.specialistId !== filter.specialistId) return false;
      return true;
    });
  }

  /** No `await` between read and write — see InMemoryAgentRunReadModelStore.project() for why this is race-free. */
  async project(event: EventEnvelope): Promise<AgentSnapshot | undefined> {
    const payload = event.payload;
    const agentId = str(payload.agentId) ?? undefined;
    const existing = agentId ? this.byAgentId.get(agentId) : undefined;
    const next = projectAgentEvent(existing, event);
    if (next) {
      this.byAgentId.set(next.agentId, next);
    }
    return next;
  }
}
