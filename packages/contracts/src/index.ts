/**
 * @umer/contracts — canonical Zod schemas + types for all inter-service communication.
 * Architecture V1 SoR remains markdown; this package is the wire/code SoT.
 */

export { CONTRACTS_VERSION, SCHEMA_VERSION } from './version.js';
export type { ContractsVersion, SchemaVersion } from './version.js';

export * from './common/index.js';
export * from './requests/index.js';
export * from './work-packages/index.js';
export * from './specialists/index.js';
export * from './artifacts/index.js';
export * from './context/index.js';
export * from './memory/index.js';
export * from './tools/index.js';
export * from './approvals/index.js';
export * from './runtime/index.js';
export * from './events/index.js';
export * from './audit/index.js';
export * from './execution/index.js';
export * from './opportunities/index.js';
