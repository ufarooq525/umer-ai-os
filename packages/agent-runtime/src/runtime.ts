import { parseContract, WorkPackageContractSchema, type WorkPackageContract } from '@umer/contracts';
import type { AuditService } from '@umer/audit';
import type { MemoryAccessPrincipal, MemoryAccessService } from '@umer/memory-access';
import type { TrustRuntime } from '@umer/trust';
import type { SpecialistMandate, RuntimeBinding } from '@umer/specialist-sdk';
import { evaluateRefusal } from '@umer/specialist-sdk';
import { assertMandateBinding } from './bind.js';
import { AgentRuntimeError } from './errors.js';
import {
  runEngineeringApplicationDelivery,
  type SpecialistRunResult,
} from './handlers/engineering.js';

export type AgentRunResult = {
  workPackageId: string;
  runId: string;
  specialistId: string;
  summary: string;
  artifact: SpecialistRunResult['artifact'];
};

export type AgentRuntimeOptions = {
  resolveMandate: (specialistId: string) => Promise<{
    mandate: SpecialistMandate;
    binding: RuntimeBinding;
  } | undefined>;
  memoryAccess?: MemoryAccessService;
  memoryPrincipal?: MemoryAccessPrincipal;
  trustRuntime?: TrustRuntime;
  auditService?: AuditService;
};

export class AgentRuntime {
  private readonly resolveMandate: AgentRuntimeOptions['resolveMandate'];
  private readonly memoryAccess?: MemoryAccessService;
  private readonly memoryPrincipal?: MemoryAccessPrincipal;
  private readonly trustRuntime?: TrustRuntime;
  private readonly auditService?: AuditService;

  constructor(options: AgentRuntimeOptions) {
    this.resolveMandate = options.resolveMandate;
    this.memoryAccess = options.memoryAccess;
    this.memoryPrincipal = options.memoryPrincipal;
    this.trustRuntime = options.trustRuntime;
    this.auditService = options.auditService;
  }

  async execute(commandPayload: unknown, correlationId: string): Promise<AgentRunResult> {
    const workPackage = parseContract(
      WorkPackageContractSchema,
      (commandPayload as { workPackage?: unknown }).workPackage,
      'Invalid workpackage.dispatch payload',
    );

    const resolved = await this.resolveMandate(workPackage.specialistId);
    if (!resolved) {
      throw new AgentRuntimeError(
        'SPECIALIST_NOT_FOUND',
        `No mandate registered for specialist ${workPackage.specialistId}`,
      );
    }

    assertMandateBinding(workPackage, resolved.binding);

    if (this.trustRuntime) {
      const decision = await this.trustRuntime.authorize(
        {
          principal: {
            principalId: workPackage.specialistId,
            kind: 'specialist_run',
          },
          action: 'workpackage:execute',
          resourceType: 'work_package',
          resourceId: workPackage.workPackageId,
        },
        correlationId,
      );
      if (!decision.allowed) {
        await this.auditService?.append(
          {
            action: 'workpackage.execute',
            actor: workPackage.specialistId,
            resourceType: 'work_package',
            resourceId: workPackage.workPackageId,
            outcome: 'denied',
            correlationId,
            detail: { reason: decision.reason },
          },
          correlationId,
        );
        throw new AgentRuntimeError('TRUST_DENIED', decision.reason ?? 'trust denied');
      }
    }

    const refusal = evaluateRefusal(resolved.mandate, {
      action: `execute work package ${workPackage.workPackageId}`,
      toolName: 'git.diff',
    });
    if (refusal.refused) {
      throw new AgentRuntimeError('MANDATE_REFUSED', refusal.reason ?? 'mandate refused');
    }

    try {
      const retrievalBundle =
        this.memoryAccess && this.memoryPrincipal
          ? await this.memoryAccess.retrieve(
              {
                query: `lessons learned ${workPackage.stage} ${resolved.mandate.contract.specialistId}`,
                memoryKinds: ['Lesson', 'Pattern', 'BestPractice'],
                limit: 5,
              },
              this.memoryPrincipal,
              correlationId,
            )
          : undefined;
      const result = await this.runSpecialist(workPackage, resolved.mandate, retrievalBundle);
      await this.auditService?.append(
        {
          action: 'agent.run.completed',
          actor: workPackage.specialistId,
          resourceType: 'work_package',
          resourceId: workPackage.workPackageId,
          outcome: 'success',
          correlationId,
          detail: { artifactId: result.artifact.artifactId },
        },
        correlationId,
      );
      return {
        workPackageId: workPackage.workPackageId,
        runId: `${workPackage.workPackageId}:${correlationId}`,
        specialistId: workPackage.specialistId,
        summary: result.summary,
        artifact: result.artifact,
      };
    } catch (err) {
      throw new AgentRuntimeError(
        'HANDLER_FAILED',
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
  }

  private async runSpecialist(
    workPackage: WorkPackageContract,
    mandate: SpecialistMandate,
    retrievalBundle?: Awaited<ReturnType<MemoryAccessService['retrieve']>>,
  ): Promise<SpecialistRunResult> {
    if (mandate.contract.specialistId === 'eng.app-delivery') {
      return runEngineeringApplicationDelivery(workPackage, mandate, { retrievalBundle });
    }
    return runEngineeringApplicationDelivery(workPackage, mandate, { retrievalBundle });
  }
}
