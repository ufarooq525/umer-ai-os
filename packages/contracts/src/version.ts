/**
 * @umer/contracts package version — bump on breaking schema changes.
 * Individual records also carry `schemaVersion` for wire compatibility.
 */
export const CONTRACTS_VERSION = '1.0.0' as const;

export const SCHEMA_VERSION = '1.0.0' as const;

export type ContractsVersion = typeof CONTRACTS_VERSION;
export type SchemaVersion = typeof SCHEMA_VERSION;
