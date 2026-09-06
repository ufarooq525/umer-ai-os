import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import { loadSpecFromString } from '@umer/specialist-sdk';
import { createToolRegistry, createToolRouter } from '@umer/extension';
import type { ChatRequest, ChatResponse, LLMProvider } from '@umer/model-routing';
import { AgentRuntimeError } from './errors.js';
import { createAgentRuntime } from './factory.js';

async function loadGrowthSpec(): Promise<string> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  return readFile(join(root, 'specialists', 'growth', 'opportunity-research.md'), 'utf8');
}

async function loadSecurityReviewSpec(): Promise<string> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  return readFile(join(root, 'specialists', 'security', 'security-review.md'), 'utf8');
}

describe('AgentRuntime — LLM agent path', () => {
  it('fails closed with LLM_NOT_CONFIGURED for a non-deterministic specialist when no llm deps are wired', async () => {
    const loaded = loadSpecFromString(await loadGrowthSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      metadata: { labels: {}, annotations: { instruction: 'research healthcare SaaS opportunities' } },
      kind: 'work_package',
      workPackageId: 'wp-1',
      execId: 'EXEC-900',
      stage: 'Research',
      status: 'Dispatched',
      specialistId: 'growth.opportunity-research',
      specialistSpecVersion: loaded.mandate.specVersion,
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: loaded.mandate.contract.capabilityIds,
      contextHandle: 'ctx-1',
      toolAllowlist: loaded.mandate.contract.toolAllowlist,
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });

    const runtime = createAgentRuntime({
      resolveMandate: async (id) =>
        id === loaded.binding.specialistId ? { mandate: loaded.mandate, binding: loaded.binding } : undefined,
    });

    await expect(runtime.execute({ workPackage }, 'corr-1')).rejects.toMatchObject({
      code: 'LLM_NOT_CONFIGURED',
    });
    await expect(runtime.execute({ workPackage }, 'corr-1')).rejects.toBeInstanceOf(AgentRuntimeError);
  });

  it('runs the full Specialist mandate → Model Routing → Tool Router → Artifact path end-to-end', async () => {
    const loaded = loadSpecFromString(await loadGrowthSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      metadata: {
        labels: {},
        annotations: {
          instruction: 'Find profitable SaaS opportunities in the healthcare industry. Use the search_web tool.',
        },
      },
      kind: 'work_package',
      workPackageId: 'wp-2',
      execId: 'EXEC-900',
      stage: 'Research',
      status: 'Dispatched',
      specialistId: 'growth.opportunity-research',
      specialistSpecVersion: loaded.mandate.specVersion,
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: loaded.mandate.contract.capabilityIds,
      contextHandle: 'ctx-1',
      toolAllowlist: loaded.mandate.contract.toolAllowlist,
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });

    const registry = createToolRegistry();
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
      handler: async () => ({ results: [{ title: 'Telehealth billing', snippet: 'Billing automation demand' }] }),
    });

    let callCount = 0;
    const provider: LLMProvider = {
      providerId: 'fake',
      async chat(_request: ChatRequest): Promise<ChatResponse> {
        callCount += 1;
        if (callCount === 1) {
          return {
            message: {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'search_web',
                  argumentsJson: '{"query":"profitable SaaS opportunities in the healthcare industry"}',
                },
              ],
            },
            finishReason: 'tool_calls',
          };
        }
        return {
          message: { role: 'assistant', content: 'Telehealth billing automation is a promising opportunity.' },
          finishReason: 'stop',
        };
      },
    };

    const runtime = createAgentRuntime({
      resolveMandate: async (id) =>
        id === loaded.binding.specialistId ? { mandate: loaded.mandate, binding: loaded.binding } : undefined,
      llm: {
        provider,
        toolRegistry: registry,
        toolRouter: createToolRouter({ registry }),
      },
    });

    const result = await runtime.execute({ workPackage }, 'corr-2');

    expect(callCount).toBe(2);
    expect(result.summary).toContain('Telehealth billing automation');
    expect(result.artifact.artifactType).toBe('ResearchFinding');
    expect(result.artifact.producedBy).toBe('growth.opportunity-research');
  });

  it('does not refuse a real security.review Work Package whose id contains the specialist\'s own domain name — regression for a real live bug', async () => {
    // Confirmed live: every security.review Work Package's id contains
    // "security" (the Security node type's own name), which is also a
    // keyword this mandate's own E5 non-goal text happens to use ("...
    // auto-fixing security issues ..."). The old runtime.ts fed the raw
    // workPackageId into the non-goal keyword check, so this permanently and
    // unconditionally refused every single security.review dispatch.
    const loaded = loadSpecFromString(await loadSecurityReviewSpec());
    const workPackage = parseContract(WorkPackageContractSchema, {
      id: 'wp-hdr',
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
      metadata: { labels: {}, annotations: {} },
      kind: 'work_package',
      workPackageId: 'wp-proj-1-security-live-test-1',
      execId: 'EXEC-900',
      stage: 'Security',
      status: 'Dispatched',
      specialistId: 'security.review',
      specialistSpecVersion: loaded.mandate.specVersion,
      specialistSpecHash: loaded.mandate.specHash,
      taskIds: ['task-1'],
      capabilityIds: loaded.mandate.contract.capabilityIds,
      contextHandle: 'ctx-1',
      toolAllowlist: loaded.mandate.contract.toolAllowlist,
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });

    const provider: LLMProvider = {
      providerId: 'fake',
      async chat(): Promise<ChatResponse> {
        return { message: { role: 'assistant', content: 'No issues found.' }, finishReason: 'stop' };
      },
    };

    const runtime = createAgentRuntime({
      resolveMandate: async (id) =>
        id === loaded.binding.specialistId ? { mandate: loaded.mandate, binding: loaded.binding } : undefined,
      llm: { provider, toolRegistry: createToolRegistry(), toolRouter: createToolRouter({ registry: createToolRegistry() }) },
    });

    const result = await runtime.execute({ workPackage }, 'corr-security-regression');
    expect(result.summary).toContain('No issues found');
  });
});
