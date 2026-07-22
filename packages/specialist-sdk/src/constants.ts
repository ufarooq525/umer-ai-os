import type { AgentSectionName, EnterpriseSectionId } from './types.js';

/** Agent Spec §§1–16 — Core/AGENT_SPECIFICATION.md */
export const AGENT_SECTIONS: readonly AgentSectionName[] = [
  'Identity',
  'Mission',
  'Responsibilities',
  'Objectives',
  'Knowledge Required',
  'Inputs',
  'Outputs',
  'Workflow',
  'Decision Rules',
  'Constraints',
  'Communication Style',
  'Quality Checklist',
  'Escalation Rules',
  'Success Metrics',
  'Examples',
  'Metadata',
] as const;

/** Enterprise sections E1–E22 — Core/SPECIALIST_ARCHITECTURE_STANDARD.md */
export const ENTERPRISE_SECTIONS: readonly {
  id: EnterpriseSectionId;
  title: string;
}[] = [
  { id: 'E1', title: 'Department Binding' },
  { id: 'E2', title: 'Capability Accountability' },
  { id: 'E3', title: 'Authority Class' },
  { id: 'E4', title: 'Specialist Class' },
  { id: 'E5', title: 'Non-Goals / Anti-Mandate' },
  { id: 'E6', title: 'Skill Bindings' },
  { id: 'E7', title: 'Tool Permission Set' },
  { id: 'E8', title: 'Context Contract' },
  { id: 'E9', title: 'Memory Contract' },
  { id: 'E10', title: 'Artifact I/O Contract' },
  { id: 'E11', title: 'Runtime Binding Contract' },
  { id: 'E12', title: 'Quality Contract' },
  { id: 'E13', title: 'Gate & Approval Contract' },
  { id: 'E14', title: 'Collaboration Affinity' },
  { id: 'E15', title: 'Escalation Matrix' },
  { id: 'E16', title: 'Failure & Recovery Contract' },
  { id: 'E17', title: 'Observability Contract' },
  { id: 'E18', title: 'Human Accountability Anchor' },
  { id: 'E19', title: 'Coverage & Succession' },
  { id: 'E20', title: 'Version & Compatibility' },
  { id: 'E21', title: 'Compliance & Trust Class' },
  { id: 'E22', title: 'Cost & Resource Class' },
] as const;

/** Minimum non-whitespace characters for a section to be considered non-vacuous. */
export const MIN_SECTION_LENGTH = 12;

/** Patterns that indicate model vendor IDs — activation gate rejects these. */
export const VENDOR_ID_PATTERNS = [
  /\bgpt-[0-9]/i,
  /\bclaude-[0-9]/i,
  /\bgemini-[0-9]/i,
  /\bllama-[0-9]/i,
  /\banthropic\./i,
  /\bopenai\./i,
] as const;
