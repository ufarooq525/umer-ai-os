import {
  parseContract,
  touchTimestamps,
  WorkPackageContractSchema,
  type WorkPackageContract,
  type WorkPackageStatus,
} from '@umer/contracts';
import { DEFAULT_MAX_ATTEMPTS } from './constants.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { WorkPackageDispatcher } from './dispatcher.js';
import { OrchestrationError } from './errors.js';
import type { EventPublisher } from './events.js';
import { assertTransition } from './state-machine.js';
import type { WorkPackageRecord, WorkPackageStore } from './store.js';

export type OrchestratorOptions = {
  store: WorkPackageStore;
  events: EventPublisher;
  dispatcher: WorkPackageDispatcher;
  clock?: Clock;
  maxAttempts?: number;
};

export class Orchestrator {
  private readonly store: WorkPackageStore;
  private readonly events: EventPublisher;
  private readonly dispatcher: WorkPackageDispatcher;
  private readonly clock: Clock;
  private readonly maxAttempts: number;

  constructor(options: OrchestratorOptions) {
    this.store = options.store;
    this.events = options.events;
    this.dispatcher = options.dispatcher;
    this.clock = options.clock ?? systemClock;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  async get(workPackageId: string): Promise<WorkPackageContract | undefined> {
    const record = await this.store.get(workPackageId);
    return record?.workPackage;
  }

  async queue(
    input: WorkPackageContract,
    correlationId: string,
  ): Promise<WorkPackageContract> {
    const workPackage = parseContract(WorkPackageContractSchema, input);
    const existing = await this.store.get(workPackage.workPackageId);

    if (existing?.workPackage.status === 'Queued') {
      return existing.workPackage;
    }

    if (existing) {
      assertTransition(existing.workPackage.status, 'Queued');
    } else if (workPackage.status !== 'Queued') {
      assertTransition(workPackage.status, 'Queued');
    }

    const updated = this.applyStatus(workPackage, 'Queued');
    const record: WorkPackageRecord = {
      workPackage: updated,
      queuedAt: this.clock.nowIso(),
      dispatchedAt: existing?.dispatchedAt,
      startedAt: existing?.startedAt,
      lastError: existing?.lastError,
    };
    await this.store.save(record);
    await this.events.publish('workpackage.queued', correlationId, {
      workPackageId: updated.workPackageId,
      execId: updated.execId,
      attempt: updated.attempt,
    });
    return updated;
  }

  async dispatch(workPackageId: string, correlationId: string): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Dispatched');

    const updated = this.applyStatus(record.workPackage, 'Dispatched');
    const next: WorkPackageRecord = {
      ...record,
      workPackage: updated,
      dispatchedAt: this.clock.nowIso(),
    };
    await this.store.save(next);
    await this.dispatcher.dispatch(updated, correlationId);
    await this.events.publish('workpackage.dispatched', correlationId, {
      workPackageId: updated.workPackageId,
      execId: updated.execId,
      attempt: updated.attempt,
      specialistId: updated.specialistId,
    });
    return updated;
  }

  async markRunning(workPackageId: string, correlationId: string): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Running');

    const updated = this.applyStatus(record.workPackage, 'Running');
    const next: WorkPackageRecord = {
      ...record,
      workPackage: updated,
      startedAt: this.clock.nowIso(),
    };
    await this.store.save(next);
    await this.events.publish('workpackage.running', correlationId, {
      workPackageId: updated.workPackageId,
      attempt: updated.attempt,
    });
    return updated;
  }

  async markAwaitingReview(
    workPackageId: string,
    correlationId: string,
  ): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'AwaitingReview');

    const updated = this.applyStatus(record.workPackage, 'AwaitingReview');
    await this.store.save({ ...record, workPackage: updated });
    await this.events.publish('workpackage.completed', correlationId, {
      workPackageId: updated.workPackageId,
      attempt: updated.attempt,
    });
    return updated;
  }

  async accept(workPackageId: string, correlationId: string): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Accepted');

    const updated = this.applyStatus(record.workPackage, 'Accepted');
    await this.store.save({ ...record, workPackage: updated });
    await this.events.publish('workpackage.completed', correlationId, {
      workPackageId: updated.workPackageId,
      status: 'Accepted',
    });
    return updated;
  }

  async reject(
    workPackageId: string,
    correlationId: string,
    reason?: string,
  ): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Rejected');

    const updated = this.applyStatus(record.workPackage, 'Rejected');
    await this.store.save({
      ...record,
      workPackage: updated,
      lastError: reason,
    });
    await this.events.publish('workpackage.failed', correlationId, {
      workPackageId: updated.workPackageId,
      status: 'Rejected',
      reason,
    });
    return updated;
  }

  async fail(
    workPackageId: string,
    correlationId: string,
    errorMessage: string,
  ): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Failed');

    const updated = this.applyStatus(record.workPackage, 'Failed');
    await this.store.save({
      ...record,
      workPackage: updated,
      lastError: errorMessage,
    });
    await this.events.publish('workpackage.failed', correlationId, {
      workPackageId: updated.workPackageId,
      errorMessage,
      attempt: updated.attempt,
    });
    return updated;
  }

  async cancel(
    workPackageId: string,
    correlationId: string,
    reason: string,
  ): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Cancelled');

    const updated = this.applyStatus(record.workPackage, 'Cancelled');
    await this.store.save({
      ...record,
      workPackage: updated,
      lastError: reason,
    });
    await this.events.publish('workpackage.cancelled', correlationId, {
      workPackageId: updated.workPackageId,
      reason,
    });
    return updated;
  }

  async retry(workPackageId: string, correlationId: string): Promise<WorkPackageContract> {
    const record = await this.requireRecord(workPackageId);
    assertTransition(record.workPackage.status, 'Queued');

    if (record.workPackage.attempt >= this.maxAttempts) {
      throw new OrchestrationError(
        'MAX_ATTEMPTS_EXCEEDED',
        `Work Package ${workPackageId} exceeded max attempts (${this.maxAttempts})`,
      );
    }

    const updated = this.applyStatus(
      {
        ...record.workPackage,
        attempt: record.workPackage.attempt + 1,
      },
      'Queued',
    );
    const next: WorkPackageRecord = {
      workPackage: updated,
      queuedAt: this.clock.nowIso(),
      lastError: record.lastError,
    };
    await this.store.save(next);
    await this.events.publish('workpackage.queued', correlationId, {
      workPackageId: updated.workPackageId,
      attempt: updated.attempt,
      retry: true,
    });
    return updated;
  }

  async handleAgentFailure(
    workPackageId: string,
    correlationId: string,
    errorMessage: string,
  ): Promise<WorkPackageContract> {
    const failed = await this.fail(workPackageId, correlationId, errorMessage);
    if (failed.attempt >= this.maxAttempts) {
      return failed;
    }
    return this.retry(workPackageId, correlationId);
  }

  async checkTimeouts(): Promise<string[]> {
    const running = await this.store.listByStatus('Running');
    const timedOut: string[] = [];

    for (const record of running) {
      const maxDurationMs = record.workPackage.resourceEnvelope.maxDurationMs;
      if (!maxDurationMs || !record.startedAt) {
        continue;
      }

      const deadline = new Date(record.startedAt).getTime() + maxDurationMs;
      if (this.clock.now() > deadline) {
        const correlationId = record.workPackage.correlationId ?? record.workPackage.workPackageId;
        await this.fail(record.workPackage.workPackageId, correlationId, 'Work Package timed out');
        timedOut.push(record.workPackage.workPackageId);
      }
    }

    return timedOut;
  }

  private applyStatus(
    workPackage: WorkPackageContract,
    status: WorkPackageStatus,
  ): WorkPackageContract {
    return {
      ...workPackage,
      ...touchTimestamps(workPackage, this.clock.nowIso()),
      status,
    };
  }

  private async requireRecord(workPackageId: string): Promise<WorkPackageRecord> {
    const record = await this.store.get(workPackageId);
    if (!record) {
      throw new OrchestrationError(
        'WORK_PACKAGE_NOT_FOUND',
        `Work Package not found: ${workPackageId}`,
      );
    }
    return record;
  }
}
