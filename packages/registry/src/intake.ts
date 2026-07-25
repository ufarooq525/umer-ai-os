import { IntakeInstructionSchema } from './schema.js';
import { ProjectRegistryError } from './errors.js';
import { buildSeoAuditReport, runSeoAudit } from './seo-audit.js';
import { runQaAudit } from './qa-audit.js';
import { runEngDelivery } from './eng-delivery.js';
import { runSecurityAudit } from './security-audit.js';
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

/**
 * Synchronous intake planning (SEO/QA/PM). Does not run eng delivery (async staging).
 * Prefer {@link planIntakeWithEng} from control-api / feature|bug callers.
 */
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
    // Generic PM/SEO/QA path — eng feature|bug rewrites this in planIntakeWithEng.
    'Human gate Pass before applying to the Laragon repo',
  ];

  const risks = [
    ...project.constraints.map((c) => `Constraint: ${c}`),
    ...(instruction.constraints ?? []).map((c) => `Extra constraint: ${c}`),
  ];

  // SEO-type intake must never construct eng delivery.
  const seoAudit =
    instruction.type === 'seo'
      ? buildSeoAuditReport({
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
    category: project.category,
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

/**
 * Attach eng.app-delivery for feature|bug only. Keeps {@link planIntake} sync for SEO/QA.
 * SEO-type intake never constructs or runs eng delivery / eng gates.
 */
export async function planIntakeWithEng(
  registry: ProjectRegistry,
  raw: IntakeInstruction,
): Promise<IntakePlan> {
  const plan = planIntake(registry, raw);
  if (plan.type !== 'feature' && plan.type !== 'bug') {
    return plan;
  }

  const project = registry.requireActive(plan.projectId);
  const parsed = IntakeInstructionSchema.parse(raw);

  const engDelivery = await runEngDelivery({
    project,
    type: plan.type,
    goal: plan.goal,
    doneWhen: parsed.doneWhen,
    targetFiles: parsed.targetFiles,
    targetModule: parsed.targetModule,
    proposedChanges: parsed.proposedChanges,
  });

  const withoutGenericGate = plan.acceptanceCriteria.filter(
    (c) => c !== 'Human gate Pass before applying to the Laragon repo',
  );

  // client-task always needs an explicit human gate; digital-product may auto when eligible.
  const applyGateWording =
    project.category === 'client-task'
      ? 'Explicit human gate Pass required before applying to the Laragon repo (client-task never auto-applies)'
      : project.category === 'digital-product' && project.autoApplyEng
        ? 'Apply after human Pass, or via eligible digital-product auto-apply when staged suites are all green'
        : 'Human gate Pass before applying to the Laragon repo (auto-apply off or ineligible)';

  const acceptanceCriteria = [
    ...withoutGenericGate,
    engDelivery.status === 'ready'
      ? `Review eng work package ${engDelivery.runId} (${engDelivery.editStats.filesChanged} file(s))`
      : 'Resolve eng manual-scoping blockers before apply',
    applyGateWording,
    'Seal eng evidence under .umer/eng/<runId>/ after Pass or eligible auto-apply',
  ];

  return {
    ...plan,
    summary: engDelivery.summary,
    nextActions: engDelivery.nextActions,
    acceptanceCriteria,
    engDelivery,
  };
}

/**
 * Enrich SEO intake with runSeoAudit proposedDiff / change-set.
 * Always requires an explicit human gate — never inherits autoApplyEng.
 */
export async function planIntakeWithSeo(
  registry: ProjectRegistry,
  raw: IntakeInstruction,
): Promise<IntakePlan> {
  const plan = planIntake(registry, raw);
  if (plan.type !== 'seo') {
    return plan;
  }

  const project = registry.requireActive(plan.projectId);
  const seoAudit = await runSeoAudit({
    project,
    goal: plan.goal,
    doneWhen: IntakeInstructionSchema.parse(raw).doneWhen,
  });

  const withoutGenericGate = plan.acceptanceCriteria.filter(
    (c) =>
      c !== 'Human gate Pass before applying to the Laragon repo' &&
      !c.startsWith('Clear all P0 SEO audit items'),
  );

  const acceptanceCriteria = [
    ...withoutGenericGate,
    `Clear all P0 SEO audit items (${seoAudit.items.filter((i) => i.priority === 'P0').length} items)`,
    seoAudit.fixableItemIds && seoAudit.fixableItemIds.length > 0
      ? `Review proposedDiff for mechanical fixes: ${seoAudit.fixableItemIds.join(', ')}`
      : 'No mechanical proposedDiff this run — content/judgment items stay manual',
    // SEO never auto-applies in v1 (autoApplyEng is eng-only).
    project.category === 'client-task'
      ? 'Explicit human gate Pass required before applying SEO package (client-task; SEO never auto-applies)'
      : 'Explicit human gate Pass required before applying SEO package (SEO never auto-applies in v1)',
    'Seal SEO evidence under .umer/seo/ after Pass',
  ];

  return {
    ...plan,
    summary: seoAudit.summary,
    nextActions: seoAudit.nextActions,
    acceptanceCriteria,
    seoAudit,
  };
}

/**
 * Enrich security intake with runSecurityAudit (static, report-only).
 * Never auto-applies; critical/high force human gate regardless of category.
 */
export async function planIntakeWithSecurity(
  registry: ProjectRegistry,
  raw: IntakeInstruction,
): Promise<IntakePlan> {
  const plan = planIntake(registry, raw);
  if (plan.type !== 'security') {
    return plan;
  }

  const project = registry.requireActive(plan.projectId);
  const securityAudit = await runSecurityAudit({
    project,
    goal: plan.goal,
    doneWhen: IntakeInstructionSchema.parse(raw).doneWhen,
  });

  const withoutGenericGate = plan.acceptanceCriteria.filter(
    (c) => c !== 'Human gate Pass before applying to the Laragon repo',
  );

  const { severityCounts, forcesGate, gateDecision } = securityAudit;
  const acceptanceCriteria = [
    ...withoutGenericGate,
    `Review security findings (critical=${severityCounts.critical} high=${severityCounts.high} medium=${severityCounts.medium} low=${severityCounts.low})`,
    forcesGate
      ? 'Critical/high findings present — explicit human gate required (severity checked before category; autoApplyEng cannot skip)'
      : gateDecision.reason,
    'No proposedDiff / auto-fix in security v1 — remediations are separate eng intakes',
    'Seal security evidence under .umer/security/<runId>/ after Pass',
  ];

  return {
    ...plan,
    summary: securityAudit.summary,
    nextActions: securityAudit.nextActions,
    acceptanceCriteria,
    securityAudit,
  };
}

/**
 * Control-api entry: eng for feature|bug, SEO for seo, security for security, else sync.
 */
export async function planIntakeForControl(
  registry: ProjectRegistry,
  raw: IntakeInstruction,
): Promise<IntakePlan> {
  const parsed = IntakeInstructionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProjectRegistryError(
      'INVALID_INTAKE',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  if (parsed.data.type === 'seo') {
    return planIntakeWithSeo(registry, raw);
  }
  if (parsed.data.type === 'security') {
    return planIntakeWithSecurity(registry, raw);
  }
  if (parsed.data.type === 'feature' || parsed.data.type === 'bug') {
    return planIntakeWithEng(registry, raw);
  }
  return planIntake(registry, raw);
}
