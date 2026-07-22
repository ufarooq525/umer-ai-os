import { randomUUID } from 'node:crypto';
import {
  parseContract,
  SCHEMA_VERSION,
  ApprovalContractSchema,
  type ApprovalContract,
} from '@umer/contracts';
import type { GateWaitStore } from './store.js';
import { InMemoryGateWaitStore } from './store.js';
import type { ControlPlaneEventPublisher } from './events.js';
import { createNoopControlPlaneEventPublisher } from './events.js';
import { ControlPlaneError } from './errors.js';
import type {
  DashboardSummary,
  GateWaitRecord,
  RequestGateReviewInput,
  ResolveGateInput,
} from './types.js';

export type Clock = {
  nowIso(): string;
};

export const systemClock: Clock = {
  nowIso() {
    return new Date().toISOString();
  },
};

export type ControlPlaneServiceOptions = {
  store?: GateWaitStore;
  events?: ControlPlaneEventPublisher;
  clock?: Clock;
  workPackagesAwaitingReview?: () => number;
};

export class ControlPlaneService {
  private readonly store: GateWaitStore;
  private readonly events: ControlPlaneEventPublisher;
  private readonly clock: Clock;
  private readonly workPackagesAwaitingReview: () => number;
  private resolvedToday = 0;

  constructor(options: ControlPlaneServiceOptions = {}) {
    this.store = options.store ?? new InMemoryGateWaitStore();
    this.events = options.events ?? createNoopControlPlaneEventPublisher();
    this.clock = options.clock ?? systemClock;
    this.workPackagesAwaitingReview = options.workPackagesAwaitingReview ?? (() => 0);
  }

  async requestGateReview(
    input: RequestGateReviewInput,
    correlationId: string,
  ): Promise<GateWaitRecord> {
    const record: GateWaitRecord = {
      waitId: randomUUID(),
      gateId: input.gateId,
      execId: input.execId,
      workPackageId: input.workPackageId,
      artifactId: input.artifactId,
      stageFrom: input.stageFrom,
      stageTo: input.stageTo,
      status: 'waiting',
      requiredApprovers: input.requiredApprovers ?? ['human.approver'],
      recordedApprovers: [],
      humanRequired: input.humanRequired ?? true,
      requestedAt: this.clock.nowIso(),
    };
    await this.store.save(record);
    await this.events.publish('control.gate.wait', correlationId, {
      waitId: record.waitId,
      gateId: record.gateId,
      workPackageId: record.workPackageId,
    });
    await this.events.publish('control.approval.requested', correlationId, {
      waitId: record.waitId,
      gateId: record.gateId,
    });
    return record;
  }

  async listPending(): Promise<GateWaitRecord[]> {
    return this.store.listPending();
  }

  async get(waitId: string): Promise<GateWaitRecord> {
    const record = await this.store.get(waitId);
    if (!record) {
      throw new ControlPlaneError('NOT_FOUND', `Gate wait ${waitId} not found`);
    }
    return record;
  }

  async resolveGate(
    waitId: string,
    input: ResolveGateInput,
    correlationId: string,
  ): Promise<{ record: GateWaitRecord; approval: ApprovalContract }> {
    const existing = await this.get(waitId);
    if (existing.status !== 'waiting') {
      throw new ControlPlaneError('ALREADY_RESOLVED', `Gate wait ${waitId} is already resolved`);
    }
    if (
      existing.requiredApprovers.length > 0 &&
      !existing.requiredApprovers.includes(input.approver)
    ) {
      throw new ControlPlaneError(
        'UNAUTHORIZED_APPROVER',
        `Approver ${input.approver} is not authorized for gate ${existing.gateId}`,
      );
    }

    const resolvedAt = this.clock.nowIso();
    const status = input.decision === 'Pass' ? 'passed' : 'failed';
    const record: GateWaitRecord = {
      ...existing,
      status,
      recordedApprovers: [...existing.recordedApprovers, input.approver],
      resolvedAt,
      rationale: input.rationale,
    };
    await this.store.save(record);

    const approval = parseContract(ApprovalContractSchema, {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      createdAt: resolvedAt,
      updatedAt: resolvedAt,
      metadata: { labels: {}, annotations: {} },
      kind: 'approval',
      gateId: record.gateId,
      execId: record.execId,
      stageFrom: record.stageFrom,
      stageTo: record.stageTo,
      result: input.decision,
      requiredApprovers: record.requiredApprovers,
      recordedApprovers: record.recordedApprovers,
      humanRequired: record.humanRequired,
      rationale: input.rationale,
      decidedAt: resolvedAt,
    });

    const eventName = input.decision === 'Pass' ? 'control.gate.pass' : 'control.gate.fail';
    await this.events.publish(eventName, correlationId, {
      waitId: record.waitId,
      gateId: record.gateId,
      approver: input.approver,
    });
    await this.events.publish('control.approval.resolved', correlationId, {
      waitId: record.waitId,
      decision: input.decision,
    });
    await this.events.publish(input.decision === 'Pass' ? 'gate.passed' : 'gate.failed', correlationId, {
      gateId: record.gateId,
      execId: record.execId,
      workPackageId: record.workPackageId,
    });

    this.resolvedToday += 1;
    return { record, approval };
  }

  async dashboard(): Promise<DashboardSummary> {
    const pending = await this.listPending();
    return {
      pendingGates: pending.length,
      workPackagesAwaitingReview: this.workPackagesAwaitingReview(),
      resolvedToday: this.resolvedToday,
    };
  }
}
