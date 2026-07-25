import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditContract } from '@umer/contracts';
import type { ControlPlaneService } from '@umer/control-plane';
import type { AuditService } from '@umer/audit';
import {
  applyEngToProject,
  applyQaToProject,
  applySeoToProject,
  createProjectRegistry,
  decideEngGate,
  planIntakeWithEng,
  type EngApplyResult,
  type IntakeInstruction,
  type IntakePlan,
  type ProjectRegistry,
  type QaApplyResult,
  type ResolvedProject,
  type SeoApplyResult,
} from '@umer/registry';

export type WorkPackageSummary = {
  workPackageId: string;
  execId: string;
  status: string;
  specialistId: string;
  stage: string;
  artifactId?: string;
  projectId?: string;
};

export type IntakeRecord = {
  intakeId: string;
  plan: IntakePlan;
  createdAt: string;
  status: 'planned' | 'approved' | 'rejected';
  applyResult?: SeoApplyResult | QaApplyResult | EngApplyResult;
};

export type ControlApiState = {
  controlPlane: ControlPlaneService;
  auditService: AuditService;
  workPackages: WorkPackageSummary[];
  projectRegistry: ProjectRegistry;
  intakes: IntakeRecord[];
};

export function resolveCatalogPath(): string {
  const fromEnv = process.env.UMER_PROJECTS_CATALOG;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  return join(repoRoot, 'projects', 'catalog.json');
}

export async function loadProjectRegistry(): Promise<ProjectRegistry> {
  return createProjectRegistry({ catalogPath: resolveCatalogPath() });
}

export async function seedDemoState(state: ControlApiState): Promise<void> {
  state.workPackages.length = 0;
  state.workPackages.push({
    workPackageId: 'wp-e2e-1',
    execId: 'EXEC-001',
    status: 'AwaitingReview',
    specialistId: 'eng.app-delivery',
    stage: 'Development',
    artifactId: 'art-wp-e2e-1-1',
    projectId: 'nitrotickets-new',
  });

  await state.controlPlane.requestGateReview(
    {
      gateId: 'gate-dev-qa',
      execId: 'EXEC-001',
      workPackageId: 'wp-e2e-1',
      artifactId: 'art-wp-e2e-1-1',
      stageFrom: 'Development',
      stageTo: 'QA',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    },
    'corr-demo-seed',
  );

  await state.auditService.append(
    {
      action: 'agent.run.completed',
      actor: 'eng.app-delivery',
      resourceType: 'work_package',
      resourceId: 'wp-e2e-1',
      outcome: 'success',
      correlationId: 'corr-e2e-flow',
    },
    'corr-e2e-flow',
  );
  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'eng.app-delivery',
      resourceType: 'artifact',
      resourceId: 'art-wp-e2e-1-1',
      outcome: 'success',
      correlationId: 'corr-e2e-flow',
    },
    'corr-e2e-flow',
  );
}

export function listProjects(state: ControlApiState): ResolvedProject[] {
  return state.projectRegistry.list();
}

export async function submitIntake(
  state: ControlApiState,
  instruction: IntakeInstruction,
): Promise<IntakeRecord> {
  // planIntakeWithEng keeps SEO/QA sync planning and only awaits eng for feature|bug.
  const plan = await planIntakeWithEng(state.projectRegistry, instruction);
  const intakeId = `intake-${Date.now()}`;
  const record: IntakeRecord = {
    intakeId,
    plan,
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
  state.intakes.unshift(record);

  const isSeo = instruction.type === 'seo';
  const isQa = instruction.type === 'qa';
  const isEng =
    (instruction.type === 'feature' || instruction.type === 'bug') && Boolean(plan.engDelivery);

  if (isEng && plan.engDelivery) {
    const project = state.projectRegistry.requireActive(plan.projectId);
    const gateDecision = decideEngGate({
      category: project.category,
      autoApplyEng: project.autoApplyEng === true,
      package: plan.engDelivery,
    });

    const execId = 'EXEC-9300';
    const specialistId = 'eng.app-delivery';
    const stage = 'Eng Delivery';
    const workPackageId = `wp-${intakeId}`;

    if (gateDecision.autoApply) {
      // Apply first — only then mark Accepted / approved (do not pre-claim success).
      const applyResult = await applyEngToProject({
        project,
        report: plan.engDelivery,
        approval: {
          kind: 'auto',
          reason: gateDecision.reason,
        },
      });

      state.workPackages.unshift({
        workPackageId,
        execId,
        status: 'Accepted',
        specialistId,
        stage,
        projectId: plan.projectId,
      });
      record.status = 'approved';
      record.applyResult = applyResult;

      await state.auditService.append(
        {
          action: 'artifact.sealed',
          actor: specialistId,
          resourceType: 'project',
          resourceId: plan.projectId,
          outcome: 'success',
          correlationId: `corr-${intakeId}`,
          detail: {
            intakeId,
            type: plan.type,
            goal: plan.goal,
            autoApply: true,
            approval: { kind: 'auto', reason: gateDecision.reason },
            gateDecision: gateDecision.reason,
            summary: applyResult.summary,
            evidenceDir: applyResult.evidenceDir,
            files: applyResult.files.map((f) => f.path),
          },
        },
        `corr-${intakeId}`,
      );

      return record;
    }

    const gateId = `gate-eng-${plan.projectId}`;
    state.workPackages.unshift({
      workPackageId,
      execId,
      status: 'AwaitingReview',
      specialistId,
      stage,
      projectId: plan.projectId,
    });

    await state.controlPlane.requestGateReview(
      {
        gateId,
        execId,
        workPackageId,
        stageFrom: stage,
        stageTo: 'Dispatch',
        requiredApprovers: ['human.approver'],
        // client-task / ineligible digital-product / seo-project: always human.
        humanRequired: true,
      },
      `corr-${intakeId}`,
    );

    await state.auditService.append(
      {
        action: 'control.approval.requested',
        actor: specialistId,
        resourceType: 'project',
        resourceId: plan.projectId,
        outcome: 'success',
        correlationId: `corr-${intakeId}`,
        detail: {
          intakeId,
          type: plan.type,
          goal: plan.goal,
          engRunId: plan.engDelivery.runId,
          engStatus: plan.engDelivery.status,
          humanRequired: true,
          gateDecision: gateDecision.reason,
        },
      },
      `corr-${intakeId}`,
    );

    return record;
  }

  const execId = isSeo ? 'EXEC-9100' : isQa ? 'EXEC-9200' : 'EXEC-9000';
  const specialistId = isSeo ? 'seo.audit' : isQa ? 'qa.verify' : 'pm.intake';
  const stage = isSeo ? 'SEO Audit' : isQa ? 'QA Verify' : 'Intake';
  const gateId = isSeo
    ? `gate-seo-${plan.projectId}`
    : isQa
      ? `gate-qa-${plan.projectId}`
      : `gate-intake-${plan.projectId}`;

  state.workPackages.unshift({
    workPackageId: `wp-${intakeId}`,
    execId,
    status: 'AwaitingReview',
    specialistId,
    stage,
    projectId: plan.projectId,
  });

  await state.controlPlane.requestGateReview(
    {
      gateId,
      execId,
      workPackageId: `wp-${intakeId}`,
      stageFrom: stage,
      stageTo: 'Dispatch',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    },
    `corr-${intakeId}`,
  );

  await state.auditService.append(
    {
      action: 'control.approval.requested',
      actor: specialistId,
      resourceType: 'project',
      resourceId: plan.projectId,
      outcome: 'success',
      correlationId: `corr-${intakeId}`,
      detail: {
        intakeId,
        type: plan.type,
        goal: plan.goal,
        seoItemCount: plan.seoAudit?.items.length ?? 0,
        qaItemCount: plan.qaAudit?.items.length ?? 0,
      },
    },
    `corr-${intakeId}`,
  );

  return record;
}

export async function applySeoOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<SeoApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-seo-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.seoAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applySeoToProject({
    project,
    audit: intake.plan.seoAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'seo.audit',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        files: applyResult.files.map((f) => f.path),
        stillManual: applyResult.stillManual.length,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applyQaOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<QaApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-qa-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.qaAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyQaToProject({
    project,
    audit: intake.plan.qaAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'qa.verify',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        files: applyResult.files.map((f) => f.path),
        stillManual: applyResult.stillManual.length,
        recommendedCommand: applyResult.recommendedCommand,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applyEngOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
    approver: string;
  },
): Promise<EngApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-eng-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.engDelivery) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyEngToProject({
    project,
    report: intake.plan.engDelivery,
    approval: {
      kind: 'human-gate',
      gateId: input.gateId,
      approver: input.approver,
      rationale: input.rationale,
    },
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'eng.app-delivery',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        evidenceDir: applyResult.evidenceDir,
        files: applyResult.files.map((f) => f.path),
        changedFiles: applyResult.changedFiles,
        approval: {
          kind: 'human-gate',
          gateId: input.gateId,
          approver: input.approver,
        },
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function listRecentAudit(state: ControlApiState): Promise<AuditContract[]> {
  return state.auditService.query();
}
