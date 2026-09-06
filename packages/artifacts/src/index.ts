/**
 * @umer/artifacts — Artifact Runtime (seal, validate, transfer, supersede).
 */

export { packageName } from './types.js';
export type {
  ValidationIssue,
  ValidationIssueCode,
  ValidationContext,
  ValidationResult,
  SealRecord,
  TransferPackage,
  TransferReceipt,
  SupersedeResult,
} from './types.js';
export { ArtifactEngineError, type ArtifactEngineErrorCode } from './errors.js';
export { isArtifactImmutable, computeArtifactContentHash } from './hash.js';
export { InMemoryArtifactStore, type ArtifactStore } from './store.js';
export {
  MySqlArtifactStore,
  type MySqlExecutor,
  type MySqlArtifactStoreOptions,
} from './mysql-store.js';
export { validateArtifact } from './validate.js';
export { type ArtifactEventPublisher, createNoopArtifactEventPublisher } from './events.js';
export {
  ArtifactEngine,
  sealArtifact,
  type ArtifactEngineOptions,
  type Clock,
  systemClock,
} from './engine.js';
export {
  createArtifactEngine,
  createArtifactStack,
  type CreateArtifactEngineOptions,
} from './factory.js';

import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { loadEnv } from '@umer/config';

let client: S3Client | undefined;

/** S3 / MinIO client bootstrap — Artifact Runtime storage plane. */
export function createS3Client(): S3Client {
  if (client) {
    return client;
  }
  const env = loadEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
  return client;
}

export async function ensureArtifactsBucket(s3: S3Client = createS3Client()): Promise<string> {
  const env = loadEnv();
  const bucket = env.S3_BUCKET_ARTIFACTS;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  return bucket;
}

export function getArtifactsBucket(): string {
  return loadEnv().S3_BUCKET_ARTIFACTS;
}

export type { S3Client };
