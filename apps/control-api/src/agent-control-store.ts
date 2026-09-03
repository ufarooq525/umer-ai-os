import { createNoopAgentEventPublisher, type AgentEventPublisher } from '@umer/agent-runtime';
import type { AgentControlPort, AgentControlRecord } from '@umer/control-plane';

/**
 * Agent control-state store — the durable half of the CEO Command Plane's
 * PauseAgent/ResumeAgent/CancelWork commands (implementation/
 * COMPANY_OPERATING_MODEL.md's Agent Registry only tracks execution status —
 * idle/active/blocked/offline, derived from agent.run.* events — which is
 * deliberately NOT the same axis as "should this agent be allowed to pick up
 * new work". This store tracks that second, orthogonal axis. In-memory only,
 * same reasoning as project-store.ts / task-store.ts.
 */
export type AgentControlStore = AgentControlPort;

export class InMemoryAgentControlStore implements AgentControlStore {
  private readonly byAgentId = new Map<string, AgentControlRecord>();
  private readonly events: AgentEventPublisher;

  constructor(options: { events?: AgentEventPublisher } = {}) {
    this.events = options.events ?? createNoopAgentEventPublisher();
  }

  async get(agentId: string): Promise<AgentControlRecord | undefined> {
    return this.byAgentId.get(agentId);
  }

  async pause(agentId: string, reason: string | undefined, correlationId: string): Promise<AgentControlRecord> {
    const record: AgentControlRecord = {
      agentId,
      controlState: 'paused',
      reason,
      updatedAt: new Date().toISOString(),
    };
    this.byAgentId.set(agentId, record);
    await this.events.publish('agent.control.changed', correlationId, {
      agentId,
      controlState: 'paused',
      action: 'paused',
      reason,
    });
    return record;
  }

  async resume(agentId: string, correlationId: string): Promise<AgentControlRecord> {
    const record: AgentControlRecord = {
      agentId,
      controlState: 'active',
      updatedAt: new Date().toISOString(),
    };
    this.byAgentId.set(agentId, record);
    await this.events.publish('agent.control.changed', correlationId, {
      agentId,
      controlState: 'active',
      action: 'resumed',
    });
    return record;
  }

  async recordCancelWork(
    agentId: string,
    target: { workPackageId?: string; taskId?: string },
    reason: string | undefined,
    correlationId: string,
  ): Promise<AgentControlRecord> {
    const existing = this.byAgentId.get(agentId);
    const record: AgentControlRecord = {
      agentId,
      controlState: existing?.controlState ?? 'active',
      reason: existing?.reason,
      updatedAt: new Date().toISOString(),
      lastCancelledWorkPackageId: target.workPackageId,
      lastCancelledTaskId: target.taskId,
    };
    this.byAgentId.set(agentId, record);
    await this.events.publish('agent.control.changed', correlationId, {
      agentId,
      action: 'work_cancelled',
      workPackageId: target.workPackageId,
      taskId: target.taskId,
      reason,
    });
    return record;
  }
}
