import {
  parseContract,
  SCHEMA_VERSION,
  ArtifactContractSchema,
  type ArtifactType,
  type WorkPackageContract,
} from '@umer/contracts';
import type { SpecialistMandate } from '@umer/specialist-sdk';
import type { RetrievalBundle } from '@umer/memory-access';
import { withTimeout, CancelledError, TimeoutError } from '@umer/resilience';
import type { ChatMessage, ChatResponse, LLMProvider, ToolCallRequest } from '@umer/model-routing';
import type { ToolRegistry, ToolRouter } from '@umer/extension';
import { AgentRuntimeError } from '../errors.js';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from '../events.js';
import type { SpecialistRunResult } from './engineering.js';

// Confirmed live against a real model doing genuine multi-file exploration
// (list root -> list a subdirectory -> read a file -> list another
// subdirectory -> ...): 8 iterations was not enough room to reach a real
// finding, only enough to start exploring. Raised alongside the timeout,
// since more iterations of a real model take real wall-clock time.
const DEFAULT_MAX_ITERATIONS = 20;
const DEFAULT_RUN_TIMEOUT_MS = 600_000;
/** How many iterations before the cap to start nudging the model to wrap up — see buildWrapUpNudge. */
const WRAP_UP_THRESHOLD = 2;

export type LlmAgentDependencies = {
  provider: LLMProvider;
  toolRegistry: ToolRegistry;
  toolRouter: ToolRouter;
  events?: AgentEventPublisher;
  maxIterations?: number;
  runTimeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
};

export type LlmAgentRunOptions = {
  retrievalBundle?: RetrievalBundle;
  signal?: AbortSignal;
};

type ToolCallLogEntry = {
  tool: string;
  input: unknown;
  status: string;
  durationMs: number;
};

function readE22Number(mandate: SpecialistMandate, key: string): number | undefined {
  const match = mandate.enterpriseSections.E22?.match(new RegExp(`${key}:\\s*(\\d+)`, 'i'));
  const value = match?.[1] ? Number(match[1]) : undefined;
  return Number.isFinite(value) ? value : undefined;
}

function resolveMaxIterations(mandate: SpecialistMandate, override?: number): number {
  return override ?? readE22Number(mandate, 'max_tools_per_run') ?? DEFAULT_MAX_ITERATIONS;
}

function resolveEffectiveAllowlist(workPackage: WorkPackageContract, mandate: SpecialistMandate): string[] {
  const mandateList = mandate.contract.toolAllowlist;
  const wpList = workPackage.toolAllowlist;
  if (wpList.length === 0) {
    return [...mandateList];
  }
  return wpList.filter((name) => mandateList.includes(name));
}

function buildSystemPrompt(mandate: SpecialistMandate): string {
  const { contract, agentSections } = mandate;
  const lines = [
    `You are ${contract.name} (${contract.specialistId}), a ${contract.department} department specialist.`,
    `Mission: ${agentSections.Mission.trim()}`,
    contract.nonGoals.length > 0 ? `You must refuse: ${contract.nonGoals.join('; ')}` : undefined,
    agentSections.Constraints ? `Constraints: ${agentSections.Constraints.trim()}` : undefined,
    agentSections['Decision Rules'] ? `Decision rules: ${agentSections['Decision Rules'].trim()}` : undefined,
    'Use the provided tools only when you need external information you do not already have. ' +
      'Never invent tool results. When you have enough information, respond with a concise final ' +
      'answer and no further tool calls.',
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n\n');
}

/**
 * Without this, a Work Package with a real `targetPath` gave the model no
 * concrete signal that project files were actually reachable — a smaller
 * local model (confirmed live against qwen3-8b) asked a human for file
 * paths instead of calling `filesystem_read`, even with the tool registered
 * and available. Only appears when there is something real to point at:
 * never claims file access the Work Package doesn't actually have.
 */
function buildGroundingHint(workPackage: WorkPackageContract, allowlist: readonly string[]): string | undefined {
  if (!workPackage.targetPath) {
    return undefined;
  }
  const hints: string[] = [];
  if (allowlist.includes('filesystem_list')) {
    hints.push(
      'Use filesystem_list first to see what files and directories actually exist (start with no "path" ' +
        'argument to list the project root) — do not guess file paths.',
    );
  }
  if (allowlist.includes('filesystem_read')) {
    hints.push(
      'Use filesystem_read to read the real files most relevant to this task (paths are relative to the ' +
        'project root, e.g. "src/app.tsx") before answering.',
    );
  }
  if (allowlist.includes('filesystem_write')) {
    hints.push(
      'Once you have real findings, use filesystem_write to seal them as an evidence file under your own ' +
        '.umer/<specialist>/ subtree.',
    );
  }
  if (allowlist.includes('process_run_audit')) {
    hints.push(
      'Use process_run_audit (tool: "npm" or "composer") to run security dependency advisories against the real codebase.',
    );
  }
  if (allowlist.includes('process_recommend')) {
    hints.push(
      'Use process_recommend to evaluate and classify test suite commands against the allowlist.',
    );
  }
  if (hints.length === 0) {
    return undefined;
  }
  return (
    'You have real, sandboxed access to the project you are reviewing — do not ask a human for file paths ' +
    `or assume you lack access. ${hints.join(' ')}`
  );
}

/**
 * Confirmed live: a real model doing genuine multi-file exploration ran out
 * of iterations mid-exploration with no warning, three times in a row, on
 * the same Work Package. Raising the cap alone just delays the same
 * failure at a bigger number — this gives the model a chance to actually
 * converge on a final answer using what it has already found, instead of
 * continuing to explore right up to (and past) the limit.
 */
function buildWrapUpNudge(remaining: number): string {
  if (remaining <= 1) {
    return (
      'This is your last turn before this run ends without an answer. Stop calling tools now and give your ' +
      'final answer based on what you have already found.'
    );
  }
  return (
    `You have ${remaining} tool-call turns left before this run ends. Wrap up soon: use any remaining turns ` +
    'only to confirm essential details, then give your final answer without further tool calls.'
  );
}

function buildUserMessage(workPackage: WorkPackageContract, allowlist: readonly string[]): string {
  const instruction = workPackage.metadata.annotations?.instruction;
  const base =
    typeof instruction === 'string' && instruction.trim().length > 0
      ? instruction
      : `Work Package ${workPackage.workPackageId} for ${workPackage.execId} (stage: ${workPackage.stage}). ` +
        `Tasks: ${workPackage.taskIds.join(', ')}.`;

  const groundingHint = buildGroundingHint(workPackage, allowlist);
  return groundingHint ? `${base}\n\n${groundingHint}` : base;
}

function inferArtifactType(mandate: SpecialistMandate): ArtifactType {
  if (mandate.contract.department === 'Commercial') return 'CommercialProposal';
  if (mandate.contract.department === 'CustomerSuccess') return 'CustomerSuccessReport';
  if (mandate.contract.mandateDomain === 'Business') return 'ResearchFinding';
  if (mandate.contract.department === 'Design') return 'DesignArtifact';
  if (mandate.contract.department === 'QA') return 'TestPlanResults';
  if (mandate.contract.department === 'Security') return 'SecurityReport';
  if (mandate.contract.department === 'Requirements') return 'RequirementsBrief';
  if (mandate.contract.department === 'Product') return 'ProductBrief';
  if (mandate.contract.department === 'Architecture') return 'ArchitectureDesign';
  if (mandate.contract.department === 'Release') return 'ReleasePackage';
  if (mandate.contract.department === 'Operations') return 'OperationalReport';
  return 'Brief';
}

function toolResultContent(status: string, output: unknown, error: string | undefined): string {
  if (status === 'completed') {
    try {
      return JSON.stringify(output ?? {});
    } catch {
      return String(output);
    }
  }
  return JSON.stringify({ error: error ?? 'tool execution did not complete', status });
}

/**
 * Generic Agent Runtime execution path: Specialist mandate + tool allowlist →
 * Model Routing → LLM Provider → tool_call → Tool Router → tool result → …
 * → final answer → typed Artifact. Used for every registered specialist except
 * eng.app-delivery, whose mandate explicitly forbids invented (LLM-authored)
 * content and stays on the deterministic structured-change-set handler.
 */
export async function runLlmAgent(
  workPackage: WorkPackageContract,
  mandate: SpecialistMandate,
  deps: LlmAgentDependencies,
  correlationId: string,
  options: LlmAgentRunOptions = {},
): Promise<SpecialistRunResult> {
  const events = deps.events ?? createNoopAgentEventPublisher();
  const maxIterations = resolveMaxIterations(mandate, deps.maxIterations);
  const runTimeoutMs = deps.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const allowlist = resolveEffectiveAllowlist(workPackage, mandate);
  const tools = deps.toolRegistry.listForAllowlist(allowlist);

  const baseEventPayload = {
    workPackageId: workPackage.workPackageId,
    execId: workPackage.execId,
    specialistId: mandate.contract.specialistId,
  };

  try {
    return await withTimeout(
      (signal) => runLoop(signal),
      runTimeoutMs,
      `agent-run:${workPackage.workPackageId}`,
      options.signal,
    );
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new AgentRuntimeError('RUN_TIMEOUT', err.message, err);
    }
    if (err instanceof CancelledError) {
      throw new AgentRuntimeError('RUN_CANCELLED', err.message, err);
    }
    throw err;
  }

  async function runLoop(signal: AbortSignal): Promise<SpecialistRunResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(mandate) },
      { role: 'user', content: buildUserMessage(workPackage, allowlist) },
    ];
    const toolCallLog: ToolCallLogEntry[] = [];
    let finalText: string | undefined;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      await events.publish('agent.llm.requested', correlationId, { ...baseEventPayload, iteration });

      let response: ChatResponse;
      try {
        response = await deps.provider.chat({
          messages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice: tools.length > 0 ? 'auto' : undefined,
          temperature: deps.temperature,
          maxTokens: deps.maxTokens,
          signal,
        });
      } catch (err) {
        await events.publish('agent.llm.failed', correlationId, {
          ...baseEventPayload,
          iteration,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw new AgentRuntimeError(
          'LLM_PROVIDER_ERROR',
          err instanceof Error ? err.message : String(err),
          err,
        );
      }

      await events.publish('agent.llm.completed', correlationId, {
        ...baseEventPayload,
        iteration,
        finishReason: response.finishReason,
        toolCallCount: response.message.toolCalls?.length ?? 0,
      });

      messages.push({
        role: 'assistant',
        content: response.message.content,
        toolCalls: response.message.toolCalls,
      });

      // Confirmed live against a real reasoning model (qwen3-8b): `length`
      // means the provider's own output-token budget ran out mid-generation
      // -- often because the model spends most of that budget on its own
      // hidden reasoning before ever writing the visible answer, leaving
      // `content` empty or a mid-sentence fragment. The loop below used to
      // treat any non-tool_calls finishReason as "the specialist's real
      // final answer", so a truncated, empty response silently fell through
      // to buildResult()'s "Agent run completed for <id>" placeholder --
      // fabricating the appearance of a real conclusion the model never
      // actually reached. Same reasoning for content_filter: a provider
      // refusal/redaction is not a real answer either. Both are treated as
      // a genuine failure so the Orchestrator's retry mechanism gets a
      // fresh attempt (a clean conversation, not more of the same budget
      // problem) instead of a fabricated summary.
      if (response.finishReason === 'length' || response.finishReason === 'content_filter') {
        await events.publish('agent.decision', correlationId, {
          ...baseEventPayload,
          action: 'response_truncated',
          reason: `Model response ended with finishReason "${response.finishReason}" instead of a real answer (iteration ${iteration}) — not accepted as complete.`,
        });
        throw new AgentRuntimeError(
          'RESPONSE_TRUNCATED',
          `Agent loop for ${workPackage.workPackageId} ended with finishReason "${response.finishReason}" ` +
            `(iteration ${iteration}) instead of a complete answer — the provider's output budget likely ran out ` +
            'mid-generation.',
        );
      }

      const toolCalls = response.message.toolCalls ?? [];
      if (response.finishReason !== 'tool_calls' || toolCalls.length === 0) {
        finalText = response.message.content;
        await events.publish('agent.decision', correlationId, {
          ...baseEventPayload,
          action: 'final_answer',
          reason: 'Specialist produced a final response with no further tool calls',
        });
        break;
      }

      for (const toolCall of toolCalls) {
        await handleToolCall(toolCall, messages, toolCallLog, signal, iteration);
      }

      const remaining = maxIterations - iteration;
      if (remaining > 0 && remaining <= WRAP_UP_THRESHOLD) {
        messages.push({ role: 'user', content: buildWrapUpNudge(remaining) });
      }
    }

    if (finalText === undefined) {
      throw new AgentRuntimeError(
        'MAX_ITERATIONS_EXCEEDED',
        `Agent loop for ${workPackage.workPackageId} exceeded ${maxIterations} iterations without a final answer`,
      );
    }

    return buildResult(finalText, toolCallLog, options.retrievalBundle);
  }

  async function handleToolCall(
    toolCall: ToolCallRequest,
    messages: ChatMessage[],
    toolCallLog: ToolCallLogEntry[],
    signal: AbortSignal,
    iteration: number,
  ): Promise<void> {
    let previewInput: unknown = toolCall.argumentsJson;
    try {
      previewInput = JSON.parse(toolCall.argumentsJson);
    } catch {
      // left as raw string preview — the router will also report this as malformed
    }

    await events.publish('agent.tool.requested', correlationId, {
      ...baseEventPayload,
      iteration,
      toolCallId: toolCall.id,
      tool: toolCall.name,
      input: previewInput,
    });
    await events.publish('agent.decision', correlationId, {
      ...baseEventPayload,
      action: 'tool_call',
      tool: toolCall.name,
      reason: `Specialist requested tool "${toolCall.name}" to continue Work Package ${workPackage.workPackageId}`,
    });
    await events.publish('agent.tool.started', correlationId, {
      ...baseEventPayload,
      toolCallId: toolCall.id,
      tool: toolCall.name,
    });

    const result = await deps.toolRouter.execute(toolCall, allowlist, {
      specialistId: mandate.contract.specialistId,
      workPackageId: workPackage.workPackageId,
      correlationId,
      signal,
      targetPath: workPackage.targetPath,
    });

    await events.publish(result.status === 'completed' ? 'agent.tool.completed' : 'agent.tool.failed', correlationId, {
      ...baseEventPayload,
      toolCallId: toolCall.id,
      tool: toolCall.name,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error,
    });

    toolCallLog.push({ tool: toolCall.name, input: previewInput, status: result.status, durationMs: result.durationMs });

    messages.push({
      role: 'tool',
      toolCallId: toolCall.id,
      name: toolCall.name,
      content: toolResultContent(result.status, result.output, result.error),
    });
  }

  function buildResult(
    finalText: string,
    toolCallLog: ToolCallLogEntry[],
    retrievalBundle?: RetrievalBundle,
  ): SpecialistRunResult {
    const now = new Date().toISOString();
    const artifactId = `art-${workPackage.workPackageId}-${workPackage.attempt}`;
    const citations = retrievalBundle?.citations ?? [];

    const artifact = parseContract(ArtifactContractSchema, {
      id: artifactId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: {
        labels: {},
        annotations: {
          toolCallsSummary: JSON.stringify(toolCallLog),
          ...(citations.length > 0
            ? { memoryCitations: JSON.stringify(citations.map((c) => c.memoryId)) }
            : {}),
        },
      },
      kind: 'artifact',
      artifactId,
      artifactType: inferArtifactType(mandate),
      version: `wp:${workPackage.workPackageId}:${workPackage.attempt}`,
      producedBy: mandate.contract.specialistId,
      producedFor: workPackage.execId,
      acceptanceStatus: 'submitted',
      // 'N_A', not 'VERIFIED': the agent's own run completing is not
      // independent verification that each task's criterion was actually
      // met, and `mem://runs/<id>` here was never a real, resolvable memory
      // reference — nothing writes to it (see engineering.ts's handler doc
      // comment for the sibling fabrication this replaced). The real
      // evidence is the run's own toolCallsSummary/summary text above; a
      // human reviewer at the Gate is the actual verification step.
      acceptanceCriteriaMet: workPackage.taskIds.map((taskId) => ({
        criterion: `Task ${taskId} delivery evidence`,
        status: 'N_A' as const,
      })),
      sourceTaskId: workPackage.taskIds[0],
      contentRef: `memory://artifacts/${artifactId}`,
      contentHash: mandate.specHash,
    });

    return {
      summary: finalText.trim().slice(0, 4_000) || `Agent run completed for ${workPackage.workPackageId}`,
      artifact,
      memoryCitations: citations,
    };
  }
}
