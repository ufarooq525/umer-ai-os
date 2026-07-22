import type {
  AuthorityClass,
  InteractionMode,
  MandateDomain,
  SpecialistContract,
  SpecialistLifecycleStatus,
} from '@umer/contracts';

export const packageName = '@umer/specialist-sdk' as const;

export type AgentSectionName =
  | 'Identity'
  | 'Mission'
  | 'Responsibilities'
  | 'Objectives'
  | 'Knowledge Required'
  | 'Inputs'
  | 'Outputs'
  | 'Workflow'
  | 'Decision Rules'
  | 'Constraints'
  | 'Communication Style'
  | 'Quality Checklist'
  | 'Escalation Rules'
  | 'Success Metrics'
  | 'Examples'
  | 'Metadata';

export type EnterpriseSectionId =
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'E7'
  | 'E8'
  | 'E9'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E13'
  | 'E14'
  | 'E15'
  | 'E16'
  | 'E17'
  | 'E18'
  | 'E19'
  | 'E20'
  | 'E21'
  | 'E22';

export type ParsedMarkdownSpec = {
  title: string;
  frontmatter: Record<string, string>;
  agentSections: Partial<Record<AgentSectionName, string>>;
  enterpriseSections: Partial<Record<EnterpriseSectionId, string>>;
  rawContent: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  section?: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type SpecialistMandate = {
  contract: SpecialistContract;
  agentSections: Record<AgentSectionName, string>;
  enterpriseSections: Record<EnterpriseSectionId, string>;
  nonGoals: string[];
  specContent: string;
  specHash: string;
  specVersion: string;
};

export type RuntimeBinding = {
  specialistId: string;
  specVersion: string;
  specHash: string;
  department: string;
  mandateDomain: MandateDomain;
  authorityClass: AuthorityClass;
  interactionMode: InteractionMode;
  status: SpecialistLifecycleStatus;
  capabilityIds: string[];
  toolAllowlist: string[];
  nonGoals: string[];
  humanAccountabilityAnchor: string;
};

export type RegistryAdapter = {
  register(binding: RuntimeBinding): Promise<void>;
};
