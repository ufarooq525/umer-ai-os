import type { EventEnvelope, RuntimeEventName } from '@umer/contracts';

/**
 * Agent Run read-model — Runtime Observability domain (MONOREPO_BLUEPRINT.md §15:
 * "Correlate: request_id, exec_id, work_package_id, agent_run_id, artifact_id").
 *
 * Publishing events to the Message Fabric is not itself a queryable read model —
 * nothing in this codebase currently folds runtime events into state a dashboard
 * can ask "what is this agent doing right now" against. This module is that
 * projection: a pure reducer over the existing agent.run, agent.llm, agent.tool
 * and agent.decision events, plus a pluggable store, following the same
 * interface + InMemory-default pattern already used by trust (GrantStore),
 * artifacts (ArtifactStore) and audit (AuditStore).
 */

export type ToolCallStatus = 'requested' | 'started' | 'completed' | 'failed';

export type ToolCallRecord = {
  toolCallId: string;
  tool: string;
  input?: unknown;
  status: ToolCallStatus;
  error?: string;
  durationMs?: number;
  requestedAt: string;
  updatedAt: string;
};

export type DecisionRecord = {
  action: string;
  tool?: string;
  reason?: string;
  at: string;
};

export type FailureRecord = {
  source: 'llm' | 'tool' | 'run';
  message: string;
  at: string;
};

/** One line per transition — structural facts only, never model reasoning text. */
export type ActionLogEntry = {
  at: string;
  event: RuntimeEventName;
  summary: string;
};

export type AgentRunCurrentAction = 'waiting_on_model' | 'executing_tool' | 'idle';

export type AgentRunStatus = 'running' | 'completed' | 'failed';

export type AgentRunSnapshot = {
  /** Primary key — one snapshot per Work Package attempt. */
  workPackageId: string;
  runId?: string;
  execId?: string;
  specialistId?: string;
  /** Worker identity that executed this run — see @umer/observability's agent-registry.ts. */
  agentId?: string;
  /**
   * Task ids this run's Work Package traces back to (IDs only, per the "don't
   * put business-domain data into the runtime reducer" rule — a project
   * relationship is resolved by joining these against the Task store at read
   * time, not baked in here).
   */
  taskIds?: string[];
  correlationId: string;
  status: AgentRunStatus;
  currentAction: AgentRunCurrentAction;
  currentTool?: string;
  currentToolInput?: unknown;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  toolCalls: ToolCallRecord[];
  decisions: DecisionRecord[];
  actionLog: ActionLogEntry[];
  failures: FailureRecord[];
  artifactId?: string;
  summary?: string;
  errorMessage?: string;
};

export type AgentRunReadModelStore = {
  upsert(snapshot: AgentRunSnapshot): Promise<void>;
  get(workPackageId: string): Promise<AgentRunSnapshot | undefined>;
  list(filter?: { status?: AgentRunStatus }): Promise<AgentRunSnapshot[]>;
  /**
   * Atomically folds one runtime event into the snapshot for its Work Package
   * via `projectRuntimeEvent` — the single required entry point for applying
   * events, so every implementation (in-memory today, a future durable store
   * later) is responsible for making its own read-modify-write safe under
   * concurrent callers. Returns the resulting snapshot, or `undefined` when
   * the event wasn't applicable (see `projectRuntimeEvent`).
   */
  project(event: EventEnvelope): Promise<AgentRunSnapshot | undefined>;
};

export class InMemoryAgentRunReadModelStore implements AgentRunReadModelStore {
  private readonly byWorkPackageId = new Map<string, AgentRunSnapshot>();

  async upsert(snapshot: AgentRunSnapshot): Promise<void> {
    this.byWorkPackageId.set(snapshot.workPackageId, snapshot);
  }

  async get(workPackageId: string): Promise<AgentRunSnapshot | undefined> {
    return this.byWorkPackageId.get(workPackageId);
  }

  async list(filter?: { status?: AgentRunStatus }): Promise<AgentRunSnapshot[]> {
    const all = [...this.byWorkPackageId.values()];
    return filter?.status ? all.filter((s) => s.status === filter.status) : all;
  }

  /**
   * No `await` appears between the map read and the map write below, so this
   * critical section always runs to completion in one synchronous turn (JS
   * run-to-completion semantics) — two "concurrent" callers can never
   * interleave mid-update, even though the method signature is async. This is
   * what makes concurrent event processing for the same Work Package safe
   * without an explicit lock.
   */
  async project(event: EventEnvelope): Promise<AgentRunSnapshot | undefined> {
    const workPackageId = typeof event.payload.workPackageId === 'string' ? event.payload.workPackageId : '';
    if (!workPackageId) {
      return undefined;
    }
    const existing = this.byWorkPackageId.get(workPackageId);
    const next = projectRuntimeEvent(existing, event);
    if (next) {
      this.byWorkPackageId.set(workPackageId, next);
    }
    return next;
  }

  clear(): void {
    this.byWorkPackageId.clear();
  }
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function strArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : undefined;
}

function findToolCall(snapshot: AgentRunSnapshot, toolCallId: string): ToolCallRecord | undefined {
  return snapshot.toolCalls.find((t) => t.toolCallId === toolCallId);
}

/**
 * Folds one runtime EventEnvelope into the Agent Run snapshot for its Work
 * Package. Pure: same inputs always produce the same output, no I/O. Returns
 * `undefined` when the event isn't an agent.* event this read model tracks
 * (e.g. trust.*, artifact.*, gate.* belong to their own domains) or arrives
 * with no workPackageId to key on.
 */
export function projectRuntimeEvent(
  existing: AgentRunSnapshot | undefined,
  event: EventEnvelope,
): AgentRunSnapshot | undefined {
  const payload = event.payload;
  const workPackageId = str(payload.workPackageId, existing?.workPackageId ?? '');
  if (!event.name.startsWith('agent.') || !workPackageId) {
    return undefined;
  }

  const base: AgentRunSnapshot =
    existing ?? {
      workPackageId,
      correlationId: event.correlationId,
      status: 'running',
      currentAction: 'idle',
      startedAt: event.occurredAt,
      updatedAt: event.occurredAt,
      toolCalls: [],
      decisions: [],
      actionLog: [],
      failures: [],
    };

  const snapshot: AgentRunSnapshot = {
    ...base,
    execId: str(payload.execId) || base.execId,
    specialistId: str(payload.specialistId) || base.specialistId,
    agentId: str(payload.agentId) || base.agentId,
    taskIds: strArray(payload.taskIds) ?? base.taskIds,
    correlationId: event.correlationId,
    updatedAt: event.occurredAt,
  };

  const pushLog = (summary: string): void => {
    snapshot.actionLog = [...snapshot.actionLog, { at: event.occurredAt, event: event.name, summary }];
  };

  switch (event.name) {
    case 'agent.run.started': {
      snapshot.status = 'running';
      snapshot.currentAction = 'waiting_on_model';
      pushLog(`Run started for specialist ${snapshot.specialistId ?? 'unknown'}`);
      break;
    }
    case 'agent.llm.requested': {
      snapshot.currentAction = 'waiting_on_model';
      pushLog(`Requested a model turn (iteration ${str(payload.iteration, '?')})`);
      break;
    }
    case 'agent.llm.completed': {
      const finishReason = str(payload.finishReason, 'unknown');
      const toolCallCount = num(payload.toolCallCount) ?? 0;
      pushLog(`Model turn finished (${finishReason}, ${toolCallCount} tool call(s) requested)`);
      break;
    }
    case 'agent.llm.failed': {
      const message = str(payload.errorMessage, 'model call failed');
      snapshot.failures = [...snapshot.failures, { source: 'llm', message, at: event.occurredAt }];
      pushLog(`Model call failed: ${message}`);
      break;
    }
    case 'agent.tool.requested': {
      const toolCallId = str(payload.toolCallId);
      const tool = str(payload.tool, 'unknown');
      snapshot.currentAction = 'executing_tool';
      snapshot.currentTool = tool;
      snapshot.currentToolInput = payload.input;
      snapshot.toolCalls = [
        ...snapshot.toolCalls,
        { toolCallId, tool, input: payload.input, status: 'requested', requestedAt: event.occurredAt, updatedAt: event.occurredAt },
      ];
      pushLog(`Requested tool "${tool}"`);
      break;
    }
    case 'agent.tool.started': {
      const toolCallId = str(payload.toolCallId);
      const record = findToolCall(snapshot, toolCallId);
      if (record) {
        record.status = 'started';
        record.updatedAt = event.occurredAt;
      }
      break;
    }
    case 'agent.tool.completed':
    case 'agent.tool.failed': {
      const toolCallId = str(payload.toolCallId);
      const tool = str(payload.tool, 'unknown');
      const status = str(payload.status, event.name === 'agent.tool.completed' ? 'completed' : 'failed') as ToolCallStatus;
      const durationMs = num(payload.durationMs);
      const error = payload.error ? str(payload.error) : undefined;
      const record = findToolCall(snapshot, toolCallId);
      if (record) {
        record.status = status;
        record.durationMs = durationMs;
        record.error = error;
        record.updatedAt = event.occurredAt;
      } else {
        snapshot.toolCalls = [
          ...snapshot.toolCalls,
          { toolCallId, tool, status, durationMs, error, requestedAt: event.occurredAt, updatedAt: event.occurredAt },
        ];
      }
      snapshot.currentAction = 'waiting_on_model';
      snapshot.currentTool = undefined;
      snapshot.currentToolInput = undefined;
      if (status === 'failed') {
        snapshot.failures = [
          ...snapshot.failures,
          { source: 'tool', message: error ?? `tool "${tool}" failed`, at: event.occurredAt },
        ];
        pushLog(`Tool "${tool}" failed: ${error ?? 'unknown error'}`);
      } else {
        pushLog(`Tool "${tool}" completed in ${durationMs ?? '?'}ms`);
      }
      break;
    }
    case 'agent.decision': {
      snapshot.decisions = [
        ...snapshot.decisions,
        { action: str(payload.action), tool: payload.tool ? str(payload.tool) : undefined, reason: str(payload.reason), at: event.occurredAt },
      ];
      break;
    }
    case 'agent.run.completed': {
      snapshot.status = 'completed';
      snapshot.currentAction = 'idle';
      snapshot.currentTool = undefined;
      snapshot.currentToolInput = undefined;
      snapshot.finishedAt = event.occurredAt;
      snapshot.artifactId = payload.artifactId ? str(payload.artifactId) : snapshot.artifactId;
      snapshot.summary = payload.summary ? str(payload.summary) : snapshot.summary;
      snapshot.runId = payload.runId ? str(payload.runId) : snapshot.runId;
      pushLog(`Run completed${snapshot.artifactId ? ` (artifact ${snapshot.artifactId})` : ''}`);
      break;
    }
    case 'agent.run.failed':
    case 'agent.run.killed': {
      snapshot.status = 'failed';
      snapshot.currentAction = 'idle';
      snapshot.currentTool = undefined;
      snapshot.currentToolInput = undefined;
      snapshot.finishedAt = event.occurredAt;
      snapshot.errorMessage = str(payload.errorMessage, snapshot.errorMessage ?? 'run failed');
      snapshot.failures = [...snapshot.failures, { source: 'run', message: snapshot.errorMessage, at: event.occurredAt }];
      pushLog(`Run failed: ${snapshot.errorMessage}`);
      break;
    }
    default:
      return undefined;
  }

  return snapshot;
}
