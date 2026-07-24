import { IntakeInstructionSchema } from './schema.js';
import { ProjectRegistryError } from './errors.js';
import { runSeoAudit } from './seo-audit.js';
import { runQaAudit } from './qa-audit.js';
import type { IntakeInstruction, IntakePlan, ResolvedProject } from './types.js';
import type { ProjectRegistry } from './registry.js';

const TYPE_SPECIALISTS: Record<IntakeInstruction['type'], string[]> = {
  feature: ['pm.intake', 'eng.app-delivery', 'qa.verify'],
  bug: ['pm.intake', 'eng.app-delivery', 'qa.verify'],
  seo: ['pm.intake', 'seo.audit', 'perf.optimize'],
  security: ['pm.intake', 'security.review', 'qa.verify'],
  ux: ['pm.intake', 'ux.design', 'eng.app-delivery'],
  qa: ['pm.intake', 'qa.verify'],
  perf: ['pm.intake', 'perf.optimize', 'eng.app-delivery'],
  brainstorm: ['pm.intake', 'ux.design'],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function planIntake(registry: ProjectRegistry, raw: IntakeInstruction): IntakePlan {
  const parsed = IntakeInstructionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProjectRegistryError(
      'INVALID_INTAKE',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  const instruction = parsed.data;
  const project: ResolvedProject = registry.requireActive(instruction.projectId);
  const recommendedSpecialists = unique([
    ...TYPE_SPECIALISTS[instruction.type],
    ...project.defaultSpecialists,
  ]);

  const acceptanceCriteria = [
    instruction.doneWhen?.trim() || `Goal achieved for ${project.name}: ${instruction.goal}`,
    'Changes reviewed against project constraints',
    'Human gate Pass before applying to the Laragon repo',
  ];

  const risks = [
    ...project.constraints.map((c) => `Constraint: ${c}`),
    ...(instruction.constraints ?? []).map((c) => `Extra constraint: ${c}`),
  ];

  const seoAudit =
    instruction.type === 'seo'
      ? runSeoAudit({
          project,
          goal: instruction.goal,
          doneWhen: instruction.doneWhen,
        })
      : undefined;

  const qaAudit =
    instruction.type === 'qa'
      ? runQaAudit({
          project,
          goal: instruction.goal,
          doneWhen: instruction.doneWhen,
        })
      : undefined;

  if (seoAudit) {
    acceptanceCriteria.push(
      `Clear all P0 SEO audit items (${seoAudit.items.filter((i) => i.priority === 'P0').length} items)`,
    );
  }

  if (qaAudit) {
    acceptanceCriteria.push(
      `Clear all P0 QA verify items (${qaAudit.items.filter((i) => i.priority === 'P0').length} items)`,
      'Seal functional + NFR evidence under .umer/qa/ after gate Pass',
    );
  }

  const summary = seoAudit
    ? seoAudit.summary
    : qaAudit
      ? qaAudit.summary
      : `PM intake for ${project.name} (${instruction.type}): ${instruction.goal}`;

  const nextActions = seoAudit
    ? seoAudit.nextActions
    : qaAudit
      ? qaAudit.nextActions
      : [
          `Open project at ${project.absolutePath}`,
          `Dispatch work to: ${recommendedSpecialists.join(', ')}`,
          'Produce sealed artifact(s), then request gate review',
          'Apply only after gate Pass',
        ];

  return {
    projectId: project.projectId,
    projectName: project.name,
    absolutePath: project.absolutePath,
    type: instruction.type,
    goal: instruction.goal,
    summary,
    recommendedSpecialists,
    acceptanceCriteria,
    risks,
    nextActions,
    seoAudit,
    qaAudit,
  };
}
