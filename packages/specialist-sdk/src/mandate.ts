import {
  AuthorityClassSchema,
  InteractionModeSchema,
  MandateDomainSchema,
  parseContract,
  SCHEMA_VERSION,
  SpecialistContractSchema,
  SpecialistLifecycleStatusSchema,
} from '@umer/contracts';
import type {
  AuthorityClass,
  InteractionMode,
  MandateDomain,
  SpecialistContract,
  SpecialistLifecycleStatus,
} from '@umer/contracts';
import { computeSpecHash } from './parser.js';
import type {
  AgentSectionName,
  EnterpriseSectionId,
  ParsedMarkdownSpec,
  RuntimeBinding,
  SpecialistMandate,
} from './types.js';
import { AGENT_SECTIONS } from './constants.js';
import { SpecialistSdkError } from './errors.js';

function readList(section?: string): string[] {
  if (!section) {
    return [];
  }
  return section
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function isCapabilityId(value: string): boolean {
  return /^cap\.[a-z0-9._-]+$/i.test(value);
}

function readCapabilityIds(section?: string): string[] {
  if (!section) {
    return [];
  }
  const fromBullets = readList(section).filter(
    (entry) => !entry.includes(':') && isCapabilityId(entry),
  );
  if (fromBullets.length > 0) {
    return fromBullets;
  }
  const scalar = readScalar(section, 'capability_ids');
  return scalar && isCapabilityId(scalar) ? [scalar] : [];
}

function readScalar(section: string | undefined, key: string, fallback = ''): string {
  if (!section) {
    return fallback;
  }
  const match = section.match(new RegExp(`^${key}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? fallback;
}

function parseEnum<T extends string>(
  value: string | undefined,
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T } },
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? (parsed.data as T) : fallback;
}

export function buildMandate(parsed: ParsedMarkdownSpec): SpecialistMandate {
  const agentSections = {} as Record<AgentSectionName, string>;
  for (const section of AGENT_SECTIONS) {
    agentSections[section] = parsed.agentSections[section] ?? '';
  }

  const enterpriseSections = {} as Record<EnterpriseSectionId, string>;
  for (let i = 1; i <= 22; i += 1) {
    const id = `E${i}` as EnterpriseSectionId;
    enterpriseSections[id] = parsed.enterpriseSections[id] ?? '';
  }

  const specHash = computeSpecHash(parsed.rawContent);
  const specVersion =
    parsed.frontmatter.version ??
    readScalar(agentSections.Metadata, 'version', '1.0.0');

  const department =
    parsed.frontmatter.department ??
    readScalar(enterpriseSections.E1, 'department') ??
    readScalar(agentSections.Identity, 'department', 'Unknown');

  const specialistId =
    parsed.frontmatter.specialist_id ??
    parsed.frontmatter.specialistId ??
    department.toLowerCase().replace(/\s+/g, '.') + '.specialist';

  const mandateDomain = parseEnum<MandateDomain>(
    parsed.frontmatter.mandate_domain ?? readScalar(enterpriseSections.E4, 'mandate_domain'),
    MandateDomainSchema,
    'Delivery',
  );

  const authorityClass = parseEnum<AuthorityClass>(
    parsed.frontmatter.authority_class ??
      readScalar(enterpriseSections.E3, 'authority_class'),
    AuthorityClassSchema,
    'Produce',
  );

  const interactionMode = parseEnum<InteractionMode>(
    parsed.frontmatter.interaction_mode ??
      readScalar(enterpriseSections.E4, 'interaction_mode'),
    InteractionModeSchema,
    'SoloProducer',
  );

  const status = parseEnum<SpecialistLifecycleStatus>(
    parsed.frontmatter.status ?? readScalar(agentSections.Metadata, 'status'),
    SpecialistLifecycleStatusSchema,
    'Registered',
  );

  const capabilityIds = readCapabilityIds(enterpriseSections.E2);

  const toolAllowlist = readList(enterpriseSections.E7);
  const nonGoals = readList(enterpriseSections.E5);
  const humanAccountabilityAnchor =
    parsed.frontmatter.human_accountability_anchor ??
    readScalar(enterpriseSections.E18, 'anchor') ??
    readScalar(enterpriseSections.E18, 'owner') ??
    parsed.frontmatter.owner ??
    'Unassigned';

  const now = new Date().toISOString();
  const contract = parseContract(SpecialistContractSchema, {
    id: specialistId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    metadata: { labels: {}, annotations: {} },
    kind: 'specialist',
    specialistId,
    name: parsed.title,
    department,
    mission: agentSections.Mission.trim(),
    mandateDomain,
    authorityClass,
    interactionMode,
    status,
    capabilityIds: capabilityIds.length > 0 ? capabilityIds : ['cap.unbound'],
    skillBindings: readList(enterpriseSections.E6),
    toolAllowlist,
    nonGoals,
    specVersion,
    specHash,
    humanAccountabilityAnchor,
  });

  return {
    contract,
    agentSections,
    enterpriseSections,
    nonGoals,
    specContent: parsed.rawContent,
    specHash,
    specVersion,
  };
}

export function bindMandate(mandate: SpecialistMandate): RuntimeBinding {
  if (!mandate.contract.mission) {
    throw new SpecialistSdkError('BIND_FAILED', 'Mandate mission is required for runtime binding');
  }

  return {
    specialistId: mandate.contract.specialistId,
    specVersion: mandate.specVersion,
    specHash: mandate.specHash,
    department: mandate.contract.department,
    mandateDomain: mandate.contract.mandateDomain,
    authorityClass: mandate.contract.authorityClass,
    interactionMode: mandate.contract.interactionMode,
    status: mandate.contract.status,
    capabilityIds: [...mandate.contract.capabilityIds],
    toolAllowlist: [...mandate.contract.toolAllowlist],
    nonGoals: [...mandate.nonGoals],
    humanAccountabilityAnchor: mandate.contract.humanAccountabilityAnchor,
  };
}

export type { SpecialistContract };
