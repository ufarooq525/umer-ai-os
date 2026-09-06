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

const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_RUN_TIMEOUT_MS = 300_000;

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

function buildUserMessage(workPackage: WorkPackageContract): string {
  const instruction = workPackage.metadata.annotations?.instruction;
  if (typeof instruction === 'string' && instruction.trim().length > 0) {
    return instruction;
  }
  return (
    `Work Package ${workPackage.workPackageId} for ${workPackage.execId} (stage: ${workPackage.stage}). ` +
    `Tasks: ${workPackage.taskIds.join(', ')}.`
  );
}

function inferArtifactType(mandate: SpecialistMandate): ArtifactType {
  return mandate.contract.mandateDomain === 'Business' ? 'ResearchFinding' : 'Brief';
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
      { role: 'user', content: buildUserMessage(workPackage) },
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
