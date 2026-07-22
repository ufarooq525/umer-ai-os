/**
 * @umer/specialist-sdk — parse, validate, hash, bind, and register Specialist Specs.
 */

export { packageName } from './types.js';
export type {
  AgentSectionName,
  EnterpriseSectionId,
  ParsedMarkdownSpec,
  ValidationIssue,
  ValidationResult,
  SpecialistMandate,
  RuntimeBinding,
  RegistryAdapter,
} from './types.js';
export { SpecialistSdkError, type SpecialistSdkErrorCode } from './errors.js';
export {
  AGENT_SECTIONS,
  ENTERPRISE_SECTIONS,
  MIN_SECTION_LENGTH,
  VENDOR_ID_PATTERNS,
} from './constants.js';
export {
  parseMarkdownSpec,
  parseYamlBlock,
  normalizeSpecContent,
  computeSpecHash,
} from './parser.js';
export { validateActivationGate } from './validator.js';
export { buildMandate, bindMandate, type SpecialistContract } from './mandate.js';
export {
  evaluateRefusal,
  getRefusalSurface,
  type RefusalRequest,
  type RefusalDecision,
} from './refuse.js';
export {
  InMemoryRegistryAdapter,
  registerBinding,
} from './registry.js';
export {
  loadSpecFromString,
  loadSpecFromFile,
  loadAndRegisterSpec,
  type LoadSpecOptions,
  type LoadedSpec,
} from './loader.js';
