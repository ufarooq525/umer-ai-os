import { parseContract, WorkPackageContractSchema, type WorkPackageContract } from '@umer/contracts';
import type { AuditService } from '@umer/audit';
import type { MemoryAccessPrincipal, MemoryAccessService } from '@umer/memory-access';
import type { TrustRuntime } from '@umer/trust';
import type { SpecialistMandate, RuntimeBinding } from '@umer/specialist-sdk';
import { evaluateRefusal } from '@umer/specialist-sdk';
import { assertMandateBinding } from './bind.js';
import { AgentRuntimeError } from './errors.js';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from './events.js';
import {
  runEngineeringApplicationDelivery,
  type SpecialistRunResult,
} from './handlers/engineering.js';
import { runLlmAgent, type LlmAgentDependencies } from './handlers/llm-agent.js';
import type { CodeProducer } from '@umer/registry';

export type AgentRunResult = {
  workPackageId: string;
  runId: string;
  specialistId: string;
  summary: string;
  artifact: SpecialistRunResult['artifact'];
};

/** Specialists whose mandate forbids LLM-invented content and must stay deterministic. */
const DETERMINISTIC_SPECIALISTS = new Set(['eng.app-delivery']);

export type AgentRuntimeOptions = {
  resolveMandate: (specialistId: string) => Promise<{
    mandate: SpecialistMandate;
    binding: RuntimeBinding;
  } | undefined>;
  memoryAccess?: MemoryAccessService;
  memoryPrincipal?: MemoryAccessPrincipal;
  trustRuntime?: TrustRuntime;
  auditService?: AuditService;
  events?: AgentEventPublisher;
  /** Model Routing + Extension wiring for the generic LLM agent loop. */
  llm?: LlmAgentDependencies;
  /** Code producer for engineering delivery packages. */
  codeProducer?: CodeProducer;
};

export class AgentRuntime {
  private readonly resolveMandate: AgentRuntimeOptions['resolveMandate'];
  private readonly memoryAccess?: MemoryAccessService;
  private readonly memoryPrincipal?: MemoryAccessPrincipal;
  private readonly trustRuntime?: TrustRuntime;
  private readonly auditService?: AuditService;
  private readonly events: AgentEventPublisher;
  private readonly llm?: LlmAgentDependencies;
  private readonly codeProducer?: CodeProducer;

  constructor(options: AgentRuntimeOptions) {
    this.resolveMandate = options.resolveMandate;
    this.memoryAccess = options.memoryAccess;
    this.memoryPrincipal = options.memoryPrincipal;
    this.trustRuntime = options.trustRuntime;
    this.auditService = options.auditService;
    this.events = options.events ?? createNoopAgentEventPublisher();
    this.llm = options.llm;
    this.codeProducer = options.codeProducer;
  }

  async execute(
    commandPayload: unknown,
    correlationId: string,
    signal?: AbortSignal,
  ): Promise<AgentRunResult> {
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

    const toolName =
      workPackage.toolAllowlist[0] ?? resolved.mandate.contract.toolAllowlist[0];
    // No `action` here — deliberately: a synthetic string built from the
    // Work Package's own id/stage is an opaque identifier, not a real
    // description of what's being requested, and checking it against the
    // mandate's own non-goal keywords risks a false refusal from incidental
    // vocabulary overlap alone (confirmed live: every security.review Work
    // Package's id contains "security" — the node type's own name, and also
    // a keyword in that mandate's own non-goals — an unconditional, always-
    // on false refusal with no relationship to what was actually asked).
    // The specialist's non-goals are still surfaced to the model itself via
    // buildSystemPrompt, where real semantic judgment about a real
    // instruction belongs. The toolName-vs-allowlist check below still runs.
    const refusal = evaluateRefusal(resolved.mandate, { toolName });
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
      const result = await this.runSpecialist(
        workPackage,
        resolved.mandate,
        correlationId,
        retrievalBundle,
        signal,
      );
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
      if (err instanceof AgentRuntimeError) {
        throw err;
      }
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
    correlationId: string,
    retrievalBundle?: Awaited<ReturnType<MemoryAccessService['retrieve']>>,
    signal?: AbortSignal,
  ): Promise<SpecialistRunResult> {
    if (DETERMINISTIC_SPECIALISTS.has(mandate.contract.specialistId)) {
      return runEngineeringApplicationDelivery(workPackage, mandate, {
        retrievalBundle,
        codeProducer: this.codeProducer,
      });
    }

    if (!this.llm) {
      throw new AgentRuntimeError(
        'LLM_NOT_CONFIGURED',
        `No Model Routing / LLM provider configured for specialist ${mandate.contract.specialistId}`,
      );
    }

    return runLlmAgent(
      workPackage,
      mandate,
      { ...this.llm, events: this.llm.events ?? this.events },
      correlationId,
      { retrievalBundle, signal },
    );
  }
}
