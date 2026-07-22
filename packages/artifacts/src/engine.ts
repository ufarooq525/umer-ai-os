import { randomUUID } from 'node:crypto';
import {
  parseContract,
  ArtifactContractSchema,
  type ArtifactContract,
} from '@umer/contracts';
import type { ArtifactStore } from './store.js';
import type { ArtifactEventPublisher } from './events.js';
import { createNoopArtifactEventPublisher } from './events.js';
import { ArtifactEngineError } from './errors.js';
import { computeArtifactContentHash } from './hash.js';
import { validateArtifact } from './validate.js';
import type {
  SealRecord,
  SupersedeResult,
  TransferPackage,
  TransferReceipt,
  ValidationContext,
  ValidationResult,
} from './types.js';

export type Clock = {
  nowIso(): string;
};

export const systemClock: Clock = {
  nowIso() {
    return new Date().toISOString();
  },
};

export type ArtifactEngineOptions = {
  store: ArtifactStore;
  events?: ArtifactEventPublisher;
  clock?: Clock;
};

export class ArtifactEngine {
  private readonly store: ArtifactStore;
  private readonly events: ArtifactEventPublisher;
  private readonly clock: Clock;
  private readonly transfers = new Map<string, TransferPackage>();
  private readonly sealRecords = new Map<string, SealRecord>();

  constructor(options: ArtifactEngineOptions) {
    this.store = options.store;
    this.events = options.events ?? createNoopArtifactEventPublisher();
    this.clock = options.clock ?? systemClock;
  }

  async registerDraft(artifact: ArtifactContract, correlationId: string): Promise<ArtifactContract> {
    const parsed = parseContract(ArtifactContractSchema, artifact);
    if (parsed.acceptanceStatus !== 'draft') {
      throw new ArtifactEngineError(
        'INVALID_INPUT',
        'registerDraft expects acceptanceStatus draft',
      );
    }
    await this.store.save(parsed);
    await this.events.publish('artifact.created', correlationId, {
      artifactId: parsed.artifactId,
      artifactType: parsed.artifactType,
      producedFor: parsed.producedFor,
    });
    return parsed;
  }

  validate(artifact: ArtifactContract, context: ValidationContext): ValidationResult {
    const result = validateArtifact(artifact, context);
    return result;
  }

  async validateAndRecord(
    artifact: ArtifactContract,
    context: ValidationContext,
    correlationId: string,
  ): Promise<ValidationResult> {
    const result = this.validate(artifact, context);
    await this.events.publish(result.valid ? 'artifact.validated' : 'artifact.rejected', correlationId, {
      artifactId: artifact.artifactId,
      issueCount: result.issues.length,
    });
    return result;
  }

  async seal(artifact: ArtifactContract, correlationId: string): Promise<ArtifactContract> {
    const parsed = parseContract(ArtifactContractSchema, artifact);
    const sealed: ArtifactContract = {
      ...parsed,
      acceptanceStatus: 'submitted',
      updatedAt: this.clock.nowIso(),
    };
    const contentHash = computeArtifactContentHash(sealed);
    await this.store.save(sealed);
    const record: SealRecord = {
      artifactId: sealed.artifactId,
      sealedAt: this.clock.nowIso(),
      contentHash,
      acceptanceStatus: 'submitted',
    };
    this.sealRecords.set(sealed.artifactId, record);
    await this.events.publish('artifact.sealed', correlationId, {
      artifactId: sealed.artifactId,
      contentHash,
      producedFor: sealed.producedFor,
    });
    return sealed;
  }

  getSealRecord(artifactId: string): SealRecord | undefined {
    return this.sealRecords.get(artifactId);
  }

  async createTransfer(input: {
    execId: string;
    fromProducer: string;
    toConsumer: string;
    artifactIds: string[];
    correlationId: string;
  }): Promise<TransferPackage> {
    const artifacts: ArtifactContract[] = [];
    for (const artifactId of input.artifactIds) {
      const artifact = await this.store.get(artifactId);
      if (!artifact) {
        throw new ArtifactEngineError('NOT_FOUND', `Artifact ${artifactId} not found`);
      }
      if (artifact.producedFor !== input.execId) {
        throw new ArtifactEngineError(
          'TRANSFER_FAILED',
          `Artifact ${artifactId} does not belong to ${input.execId}`,
        );
      }
      if (artifact.acceptanceStatus !== 'submitted' && artifact.acceptanceStatus !== 'accepted') {
        throw new ArtifactEngineError(
          'TRANSFER_FAILED',
          `Artifact ${artifactId} must be sealed before transfer`,
        );
      }
      artifacts.push(artifact);
    }

    const transfer: TransferPackage = {
      transferId: randomUUID(),
      execId: input.execId,
      fromProducer: input.fromProducer,
      toConsumer: input.toConsumer,
      artifactIds: artifacts.map((artifact) => artifact.artifactId),
      createdAt: this.clock.nowIso(),
    };
    this.transfers.set(transfer.transferId, transfer);
    await this.events.publish('artifact.transferred', input.correlationId, {
      transferId: transfer.transferId,
      artifactIds: transfer.artifactIds,
      toConsumer: transfer.toConsumer,
    });
    return transfer;
  }

  async acknowledgeTransfer(transferId: string, correlationId: string): Promise<TransferReceipt> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      return {
        transferId,
        status: 'rejected',
        artifactIds: [],
        receivedAt: this.clock.nowIso(),
        reason: 'Transfer package not found',
      };
    }
    const receipt: TransferReceipt = {
      transferId,
      status: 'delivered',
      artifactIds: transfer.artifactIds,
      receivedAt: this.clock.nowIso(),
    };
    await this.events.publish('artifact.transferred', correlationId, {
      transferId,
      status: receipt.status,
    });
    return receipt;
  }

  async supersede(
    previousArtifactId: string,
    nextArtifact: ArtifactContract,
    correlationId: string,
  ): Promise<SupersedeResult> {
    const previous = await this.store.get(previousArtifactId);
    if (!previous) {
      throw new ArtifactEngineError('NOT_FOUND', `Artifact ${previousArtifactId} not found`);
    }

    const parsed = parseContract(ArtifactContractSchema, {
      ...nextArtifact,
      supersedesArtifactId: previousArtifactId,
      updatedAt: this.clock.nowIso(),
    });

    if (parsed.artifactId === previousArtifactId) {
      throw new ArtifactEngineError(
        'SUPERSEDE_FAILED',
        'Superseding artifact must use a new artifactId',
      );
    }

    const existingNext = await this.store.get(parsed.artifactId);
    if (existingNext) {
      throw new ArtifactEngineError(
        'SUPERSEDE_FAILED',
        `Artifact ${parsed.artifactId} already exists`,
      );
    }

    await this.store.save(parsed);
    const lineageRootId = previous.supersedesArtifactId ?? previous.artifactId;
    await this.events.publish('artifact.superseded', correlationId, {
      previousArtifactId,
      nextArtifactId: parsed.artifactId,
      lineageRootId,
    });
    return {
      previousArtifactId,
      nextArtifactId: parsed.artifactId,
      lineageRootId,
    };
  }

  async getLineage(artifactId: string): Promise<ArtifactContract[]> {
    const all = await this.store.list();
    const byId = new Map<string, ArtifactContract>(
      all.map((artifact) => [artifact.artifactId, artifact]),
    );
    const chain: ArtifactContract[] = [];
    let current = byId.get(artifactId);
    while (current) {
      chain.unshift(current);
      current = current.supersedesArtifactId
        ? byId.get(current.supersedesArtifactId)
        : undefined;
    }
    return chain;
  }
}

export async function sealArtifact(
  artifact: ArtifactContract,
  store: ArtifactStore,
  correlationId = 'legacy-seal',
): Promise<ArtifactContract> {
  const engine = new ArtifactEngine({ store });
  return engine.seal(artifact, correlationId);
}
