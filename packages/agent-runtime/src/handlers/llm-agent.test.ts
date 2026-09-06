import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseContract,
  SCHEMA_VERSION,
  WorkPackageContractSchema,
  type RuntimeEventName,
  type WorkPackageContract,
} from '@umer/contracts';
import { loadSpecFromString, type SpecialistMandate } from '@umer/specialist-sdk';
import { createToolRegistry, createToolRouter } from '@umer/extension';
import type { ChatRequest, ChatResponse, LLMProvider } from '@umer/model-routing';
import { AgentRuntimeError } from '../errors.js';
import { runLlmAgent, type LlmAgentDependencies } from './llm-agent.js';

async function loadMandateFromRepo(...relativePath: string[]): Promise<SpecialistMandate> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');
  const content = await readFile(join(root, 'specialists', ...relativePath), 'utf8');
  return loadSpecFromString(content).mandate;
}

async function loadGrowthMandate(): Promise<SpecialistMandate> {
  return loadMandateFromRepo('growth', 'opportunity-research.md');
}

function buildWorkPackage(mandate: SpecialistMandate, overrides: Partial<WorkPackageContract> = {}): WorkPackageContract {
  return parseContract(WorkPackageContractSchema, {
    id: 'wp-hdr-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    metadata: {
      labels: {},
      annotations: { instruction: 'Find profitable SaaS opportunities in the healthcare industry. Use the search_web tool.' },
    },
    kind: 'work_package',
    workPackageId: 'wp-research-1',
    execId: 'EXEC-900',
    stage: 'Research',
    status: 'Dispatched',
    specialistId: mandate.contract.specialistId,
    specialistSpecVersion: mandate.specVersion,
    specialistSpecHash: mandate.specHash,
    taskIds: ['task-research-1'],
    capabilityIds: mandate.contract.capabilityIds,
    contextHandle: 'ctx-1',
    toolAllowlist: mandate.contract.toolAllowlist,
    resourceEnvelope: { parallelism: 1 },
    attempt: 1,
    ...overrides,
  });
}

class ScriptedProvider implements LLMProvider {
  readonly providerId = 'fake';
  readonly calls: ChatRequest[] = [];
  private index = 0;

  constructor(private readonly responses: ChatResponse[]) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.calls.push(request);
    const response = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;
    if (!response) {
      throw new Error('ScriptedProvider ran out of responses');
    }
    return response;
  }
}

function toolCallResponse(name: string, argumentsJson: string, id = `call_${name}`): ChatResponse {
  return {
    message: { role: 'assistant', content: '', toolCalls: [{ id, name, argumentsJson }] },
    finishReason: 'tool_calls',
  };
}

function finalResponse(content: string): ChatResponse {
  return { message: { role: 'assistant', content }, finishReason: 'stop' };
}

function collectEvents() {
  const log: Array<{ name: RuntimeEventName; payload: Record<string, unknown> }> = [];
  return {
    log,
    events: {
      async publish(name: RuntimeEventName, _correlationId: string, payload: Record<string, unknown>) {
        log.push({ name, payload });
      },
    },
  };
}

function baseDeps(provider: LLMProvider, overrides: Partial<LlmAgentDependencies> = {}): LlmAgentDependencies {
  const registry = createToolRegistry();
  registry.register({
    name: 'search_web',
    description: 'search',
    parameters: { type: 'object', properties: { query: { type: 'string' } } },
    handler: async (input) => ({ results: [{ title: 'Result', snippet: 'snippet', input }] }),
  });
  return {
    provider,
    toolRegistry: registry,
    toolRouter: createToolRouter({ registry }),
    maxIterations: 5,
    ...overrides,
  };
}

describe('runLlmAgent', () => {
  it('executes a tool call requested by the model and produces a final artifact from the follow-up answer', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider = new ScriptedProvider([
      toolCallResponse('search_web', '{"query":"profitable SaaS opportunities in healthcare"}'),
      finalResponse('Telehealth billing automation looks promising based on search_web results.'),
    ]);
    const { events, log } = collectEvents();

    const result = await runLlmAgent(workPackage, mandate, baseDeps(provider, { events }), 'corr-1');

    expect(provider.calls).toHaveLength(2);
    // second call must carry the tool result back to the model
    const secondCallMessages = provider.calls[1]?.messages ?? [];
    expect(secondCallMessages.some((m) => m.role === 'tool' && m.name === 'search_web')).toBe(true);
    expect(result.summary).toContain('Telehealth');
    expect(result.artifact.artifactType).toBe('ResearchFinding');
    expect(result.artifact.metadata.annotations?.toolCallsSummary).toContain('search_web');

    const names = log.map((e) => e.name);
    expect(names).toContain('agent.llm.requested');
    expect(names).toContain('agent.llm.completed');
    expect(names).toContain('agent.tool.requested');
    expect(names).toContain('agent.tool.started');
    expect(names).toContain('agent.tool.completed');
    expect(names).toContain('agent.decision');

    // The run finishing is not independent verification that each task's
    // acceptance criterion was actually met — that's what the human Gate
    // review is for. Never claim VERIFIED (or an unresolvable evidenceRef)
    // for a self-reported LLM run.
    for (const criterion of result.artifact.acceptanceCriteriaMet) {
      expect(criterion.status).toBe('N_A');
      expect(criterion.evidenceRef).toBeUndefined();
    }
  });

  it('maps a Design department mandate to a DesignArtifact and a QA department mandate to TestPlanResults', async () => {
    const uxMandate = await loadMandateFromRepo('design', 'ux-design.md');
    const uxWorkPackage = buildWorkPackage(uxMandate);
    const uxResult = await runLlmAgent(
      uxWorkPackage,
      uxMandate,
      baseDeps(new ScriptedProvider([finalResponse('No tools needed; answering directly.')])),
      'corr-design',
    );
    expect(uxResult.artifact.artifactType).toBe('DesignArtifact');

    const qaMandate = await loadMandateFromRepo('qa', 'qa-verify.md');
    const qaWorkPackage = buildWorkPackage(qaMandate);
    const qaResult = await runLlmAgent(
      qaWorkPackage,
      qaMandate,
      baseDeps(new ScriptedProvider([finalResponse('No tools needed; answering directly.')])),
      'corr-qa',
    );
    expect(qaResult.artifact.artifactType).toBe('TestPlanResults');
  });

  it('grounds the user message with filesystem_list/read/write hints when a real targetPath is present and those tools are allowlisted', async () => {
    const uxMandate = await loadMandateFromRepo('design', 'ux-design.md');
    const workPackage = buildWorkPackage(uxMandate, { targetPath: '/real/registered/project' });
    const provider = new ScriptedProvider([finalResponse('No tools needed; answering directly.')]);

    await runLlmAgent(workPackage, uxMandate, baseDeps(provider), 'corr-grounding');

    const userMessage = provider.calls[0]?.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).toContain('filesystem_list');
    expect(userMessage?.content).toContain('filesystem_read');
    expect(userMessage?.content).toContain('filesystem_write');
    expect(userMessage?.content).toContain('do not ask a human for file paths');
  });

  it('combines a real instruction (e.g. from a real Task) with the grounding hint, not one or the other', async () => {
    const uxMandate = await loadMandateFromRepo('design', 'ux-design.md');
    const workPackage = buildWorkPackage(uxMandate, {
      targetPath: '/real/registered/project',
      metadata: {
        labels: {},
        annotations: { instruction: 'Task: Audit the checkout flow\nReview navigation and error states.' },
      },
    });
    const provider = new ScriptedProvider([finalResponse('No tools needed; answering directly.')]);

    await runLlmAgent(workPackage, uxMandate, baseDeps(provider), 'corr-instruction-plus-grounding');

    const userMessage = provider.calls[0]?.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).toContain('Audit the checkout flow');
    expect(userMessage?.content).toContain('filesystem_list');
  });

  it('omits the grounding hint when the Work Package has no real targetPath', async () => {
    const uxMandate = await loadMandateFromRepo('design', 'ux-design.md');
    const workPackage = buildWorkPackage(uxMandate);
    const provider = new ScriptedProvider([finalResponse('No tools needed; answering directly.')]);

    await runLlmAgent(workPackage, uxMandate, baseDeps(provider), 'corr-no-grounding');

    const userMessage = provider.calls[0]?.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).not.toContain('filesystem_read');
    expect(userMessage?.content).not.toContain('sandboxed access');
  });

  it('omits the grounding hint when a real targetPath is present but filesystem tools are not on the allowlist', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate, { targetPath: '/real/registered/project' });
    const provider = new ScriptedProvider([finalResponse('No tools needed; answering directly.')]);

    await runLlmAgent(workPackage, mandate, baseDeps(provider), 'corr-no-fs-tools');

    const userMessage = provider.calls[0]?.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).not.toContain('sandboxed access');
  });

  it("threads the Work Package's targetPath through to the tool's execution context", async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate, { targetPath: '/real/registered/project' });
    const provider = new ScriptedProvider([
      toolCallResponse('search_web', '{"query":"x"}'),
      finalResponse('done'),
    ]);

    const registry = createToolRegistry();
    let capturedTargetPath: string | undefined;
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
      handler: async (_input, ctx) => {
        capturedTargetPath = ctx.targetPath;
        return { results: [] };
      },
    });

    await runLlmAgent(
      workPackage,
      mandate,
      { provider, toolRegistry: registry, toolRouter: createToolRouter({ registry }), maxIterations: 5 },
      'corr-target-path',
    );

    expect(capturedTargetPath).toBe('/real/registered/project');
  });

  it('supports multiple tool round trips before a final answer (model → tool → model → tool → model → final)', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider = new ScriptedProvider([
      toolCallResponse('search_web', '{"query":"healthcare saas market size"}', 'call_1'),
      toolCallResponse('search_web', '{"query":"telehealth billing automation"}', 'call_2'),
      finalResponse('Two candidate opportunities identified from two searches.'),
    ]);

    const result = await runLlmAgent(workPackage, mandate, baseDeps(provider), 'corr-2');

    expect(provider.calls).toHaveLength(3);
    expect(result.summary).toContain('Two candidate opportunities');
    const summary = JSON.parse(result.artifact.metadata.annotations?.toolCallsSummary as string);
    expect(summary).toHaveLength(2);
  });

  it('denies a tool call outside the allowlist and reports it back to the model instead of crashing', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate, { toolAllowlist: [] });
    const provider = new ScriptedProvider([
      toolCallResponse('filesystem.write', '{"path":"/etc/passwd"}'),
      finalResponse('Cannot access filesystem.write; reporting back without it.'),
    ]);
    const registry = createToolRegistry();
    registry.register({
      name: 'filesystem.write',
      description: 'writes files',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({ ok: true }),
    });
    const { events, log } = collectEvents();

    const result = await runLlmAgent(
      workPackage,
      mandate,
      { provider, toolRegistry: registry, toolRouter: createToolRouter({ registry }), events, maxIterations: 5 },
      'corr-3',
    );

    expect(result.summary).toContain('Cannot access');
    const toolEvent = log.find((e) => e.name === 'agent.tool.failed');
    expect(toolEvent?.payload.status).toBe('denied');
  });

  it('safely rejects a request for a tool that is not registered at all', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider = new ScriptedProvider([
      toolCallResponse('nonexistent_tool', '{}'),
      finalResponse('That tool does not exist; continuing without it.'),
    ]);
    const { events, log } = collectEvents();

    const result = await runLlmAgent(workPackage, mandate, baseDeps(provider, { events }), 'corr-4');

    expect(result.summary).toContain('does not exist');
    const toolEvent = log.find((e) => e.name === 'agent.tool.failed');
    expect(toolEvent?.payload.status).toBe('unknown_tool');
  });

  it('reports a tool handler failure back to the model instead of failing the run', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const registry = createToolRegistry();
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('upstream search provider unavailable');
      },
    });
    const provider = new ScriptedProvider([
      toolCallResponse('search_web', '{"query":"x"}'),
      finalResponse('Search failed; reporting the gap rather than guessing.'),
    ]);

    const result = await runLlmAgent(
      workPackage,
      mandate,
      { provider, toolRegistry: registry, toolRouter: createToolRouter({ registry }), maxIterations: 5 },
      'corr-5',
    );

    expect(result.summary).toContain('reporting the gap');
    const toolCall = provider.calls[1]?.messages.find((m) => m.role === 'tool');
    expect(toolCall && 'content' in toolCall ? toolCall.content : '').toContain('upstream search provider unavailable');
  });

  it('fails closed with MAX_ITERATIONS_EXCEEDED when the model never stops requesting tools', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider = new ScriptedProvider([toolCallResponse('search_web', '{"query":"loop"}')]);

    await expect(
      runLlmAgent(workPackage, mandate, baseDeps(provider, { maxIterations: 3 }), 'corr-6'),
    ).rejects.toMatchObject({ code: 'MAX_ITERATIONS_EXCEEDED' });
    expect(provider.calls).toHaveLength(3);
  });

  it('nudges the model to wrap up as it approaches the iteration cap, escalating on the final turn', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider = new ScriptedProvider([toolCallResponse('search_web', '{"query":"loop"}')]);

    await expect(
      runLlmAgent(workPackage, mandate, baseDeps(provider, { maxIterations: 3 }), 'corr-wrap-up'),
    ).rejects.toMatchObject({ code: 'MAX_ITERATIONS_EXCEEDED' });

    // `messages` is mutated in place across iterations, so every captured
    // request shares the same final array — inspect its content and, more
    // importantly, the order the two nudges were appended in.
    const contents = provider.calls[provider.calls.length - 1]!.messages.map((m) => m.content);
    const generalNudgeIndex = contents.findIndex((c) => c.includes('You have 2 tool-call turns left'));
    const finalNudgeIndex = contents.findIndex((c) => c.includes('This is your last turn'));

    expect(generalNudgeIndex).toBeGreaterThan(-1);
    expect(finalNudgeIndex).toBeGreaterThan(generalNudgeIndex);
  });

  it('wraps a provider failure in AgentRuntimeError LLM_PROVIDER_ERROR', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider: LLMProvider = {
      providerId: 'broken',
      async chat() {
        throw new Error('connection refused');
      },
    };

    await expect(runLlmAgent(workPackage, mandate, baseDeps(provider), 'corr-7')).rejects.toBeInstanceOf(
      AgentRuntimeError,
    );
    await expect(runLlmAgent(workPackage, mandate, baseDeps(provider), 'corr-7')).rejects.toMatchObject({
      code: 'LLM_PROVIDER_ERROR',
    });
  });

  it('enforces the run timeout', async () => {
    const mandate = await loadGrowthMandate();
    const workPackage = buildWorkPackage(mandate);
    const provider: LLMProvider = {
      providerId: 'slow',
      async chat() {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return finalResponse('too slow');
      },
    };

    await expect(
      runLlmAgent(workPackage, mandate, baseDeps(provider, { runTimeoutMs: 20 }), 'corr-8'),
    ).rejects.toMatchObject({ code: 'RUN_TIMEOUT' });
  });
});
