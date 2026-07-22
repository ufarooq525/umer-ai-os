import type { AuditContract } from '@umer/contracts';
import type { ControlPlaneService } from '@umer/control-plane';
import type { AuditService } from '@umer/audit';

export type WorkPackageSummary = {
  workPackageId: string;
  execId: string;
  status: string;
  specialistId: string;
  stage: string;
  artifactId?: string;
};

export type ControlApiState = {
  controlPlane: ControlPlaneService;
  auditService: AuditService;
  workPackages: WorkPackageSummary[];
};

export async function seedDemoState(state: ControlApiState): Promise<void> {
  state.workPackages.length = 0;
  state.workPackages.push({
    workPackageId: 'wp-e2e-1',
    execId: 'EXEC-001',
    status: 'AwaitingReview',
    specialistId: 'eng.app-delivery',
    stage: 'Development',
    artifactId: 'art-wp-e2e-1-1',
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

export async function listRecentAudit(state: ControlApiState): Promise<AuditContract[]> {
  return state.auditService.query();
}
