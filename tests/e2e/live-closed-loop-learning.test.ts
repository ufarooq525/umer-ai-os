import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parseContract,
  ArtifactContractSchema,
  type ProjectId,
} from '@umer/contracts';
import { createArtifactStack } from '@umer/artifacts';
import { createControlPlaneService } from '../../packages/control-plane/src/index.js';
import { createAuditService } from '../../packages/audit/src/index.js';
import { createProjectRegistry, type ResolvedProject } from '../../packages/registry/src/index.js';
import { createLlmCodeProducer } from '../../packages/agent-runtime/src/code-producer-llm.js';
import { CustomerSuccessEngine } from '../../packages/opportunity-intelligence/src/customer-success.js';
import { InMemoryCustomerSuccessStore } from '../../packages/opportunity-intelligence/src/customer-success-store.js';
import { InMemoryOpportunityPersistence } from '../../packages/opportunity-intelligence/src/index.js';
import { buildCompanyGraph } from '../../apps/control-api/src/company-graph-projection.js';
import { applySecurityOnGatePass, type ControlApiState } from '../../apps/control-api/src/state.js';
import type { LLMProvider } from '@umer/model-routing';

describe('Phase 6 — Closed-Loop Company Graph Learning E2E', () => {
  let stagingDir: string;
  let controlState: ControlApiState;
  const oppId = 'opp-closed-loop-e2e';
  const projectId = 'proj-closed-loop-e2e' as ProjectId;
  const wpId = 'wp-closed-loop-sec-1';
  const artifactId = 'art-closed-loop-sec-1';

  beforeAll(async () => {
    stagingDir = await mkdtemp(join(tmpdir(), 'umer-p6-closed-loop-'));

    // Create minimal mock target project files
    await writeFile(
      join(stagingDir, 'package.json'),
      JSON.stringify(
        {
          name: 'healthcare-portal',
          version: '1.0.0',
          private: true,
          dependencies: {
            express: '^4.18.2',
          },
        },
        null,
        2,
      ),
    );

    const artifactStack = createArtifactStack();
    const customerSuccessStore = new InMemoryCustomerSuccessStore();
    const customerSuccess = new CustomerSuccessEngine(customerSuccessStore);

    const projectRegistry = {
      requireActive: () => ({
        projectId,
        name: 'Healthcare Patient Portal',
        slug: 'healthcare-portal',
        path: stagingDir,
        absolutePath: stagingDir,
        status: 'active' as const,
        category: 'digital-product' as const,
        stack: ['node'],
        defaultSpecialists: ['eng.app-delivery', 'security.review'],
        constraints: [],
        tags: [],
        autoApplyEng: false,
        onDisk: true,
      }),
      get: () => ({
        projectId,
        name: 'Healthcare Patient Portal',
      }),
    };

    const opportunityReader = new InMemoryOpportunityPersistence();
    await opportunityReader.saveOpportunity({
      id: oppId,
      nicheId: 'niche-health',
      type: 'product',
      title: 'Autonomous Healthcare Compliance Platform',
      status: 'project_created',
      market: 'Healthcare',
      geography: 'GCC',
      problemIds: ['prob-p6-e2e'],
      score: {
        problemSeverity: 90,
        demandEvidence: 85,
        abilityToPay: 80,
        reachability: 75,
        solutionFit: 85,
        competitiveGap: 75,
        deliveryFeasibility: 90,
        evidenceConfidence: 85,
        overall: 84,
        recommendation: 'product_candidate',
      },
      estimatedValueMin: 60000,
      currency: 'USD',
      evidenceRefs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    controlState = {
      controlPlane: createControlPlaneService(),
      auditService: createAuditService(),
      workPackages: [],
      projectRegistry,
      intakes: [],
      artifactStore: artifactStack.store,
      customerSuccess,
      projectStore: {
        get: async (id: string) => {
          if (id === projectId) {
            return {
              projectId,
              name: 'Healthcare Patient Portal',
              sourceOpportunityId: oppId,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return undefined;
        },
        list: async () => [
          {
            projectId,
            name: 'Healthcare Patient Portal',
            sourceOpportunityId: oppId,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        create: async () => ({ projectId, name: 'Healthcare Patient Portal' } as any),
        update: async () => undefined,
      } as any,
      opportunityReader,
    } as unknown as ControlApiState;
  });

  afterAll(async () => {
    try {
      await rm(stagingDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('executes the full closed-loop company graph learning cycle', async () => {
    // -----------------------------------------------------------------------
    // 1. Seed WorkPackage and sealed Artifact
    // -----------------------------------------------------------------------
    controlState.workPackages.unshift({
      workPackageId: wpId,
      execId: 'EXEC-601',
      status: 'AwaitingReview',
      specialistId: 'security.review',
      stage: 'Security',
      projectId,
      artifactId,
    });

    await controlState.artifactStore?.save(
      parseContract(ArtifactContractSchema, {
        id: artifactId,
        schemaVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { labels: {}, annotations: {} },
        kind: 'artifact',
        artifactId,
        artifactType: 'SecurityReport',
        version: '1.0.0',
        producedBy: wpId,
        producedFor: 'EXEC-601',
        acceptanceStatus: 'submitted',
        acceptanceCriteriaMet: [],
        contentRef: 'security://report/p6-e2e.md',
      }),
    );

    // -----------------------------------------------------------------------
    // 2. Open Quality Gate Review
    // -----------------------------------------------------------------------
    const gateRecord = await controlState.controlPlane.requestGateReview(
      {
        gateId: `gate-wp-${wpId}`,
        execId: 'EXEC-601',
        workPackageId: wpId,
        artifactId,
        stageFrom: 'Execution',
        stageTo: 'Review',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      'corr-p6-e2e-gate',
    );

    expect(gateRecord).toBeDefined();
    expect(gateRecord.status).toBe('waiting');

    // -----------------------------------------------------------------------
    // 3. Resolve Gate Review to PASS via applySecurityOnGatePass
    // -----------------------------------------------------------------------
    const applyOutcome = await applySecurityOnGatePass(controlState, {
      gateId: `gate-wp-${wpId}`,
      workPackageId: wpId,
      rationale: 'CEO approved security audit: package dependencies verified secure.',
    });

    expect(applyOutcome).toBeDefined();
    expect(applyOutcome?.evidenceDir).toBeDefined();
    expect(applyOutcome?.summary).toContain('Security package');

    // -----------------------------------------------------------------------
    // 4. Verify Learning was extracted into authoritative store
    // -----------------------------------------------------------------------
    const learnings = (await controlState.customerSuccess?.listLearnings()) ?? [];
    expect(learnings.length).toBeGreaterThan(0);

    const deliveryLearning = learnings.find((l) => l.projectId === projectId);
    expect(deliveryLearning).toBeDefined();
    expect(deliveryLearning?.opportunityId).toBe(oppId);
    expect(deliveryLearning?.title).toContain('Security Gate Cleared');
    expect(deliveryLearning?.category).toBe('technical_pattern');
    expect(deliveryLearning?.recommendedActions.length).toBeGreaterThan(0);

    // -----------------------------------------------------------------------
    // 5. Verify Closed-Loop on Company Intelligence Graph Projection
    // -----------------------------------------------------------------------
    const graph = await buildCompanyGraph(controlState, {
      projectId,
      depth: 3,
    });

    // Check All Closed-Loop Nodes
    const oppNode = graph.nodes.find((n) => n.id === `opp:${oppId}`);
    const projNode = graph.nodes.find((n) => n.id === `project:${projectId}`);
    const wpNode = graph.nodes.find((n) => n.id === `wp:${wpId}`);
    const gateNode = graph.nodes.find((n) => n.id === `gate:gate-wp-${wpId}`);
    const artNode = graph.nodes.find((n) => n.id === `artifact:${artifactId}`);
    const learnNode = graph.nodes.find((n) => n.id === `learning:${deliveryLearning?.id}`);

    expect(oppNode).toBeDefined();
    expect(projNode).toBeDefined();
    expect(wpNode).toBeDefined();
    expect(gateNode).toBeDefined();
    expect(artNode).toBeDefined();
    expect(learnNode).toBeDefined();

    // Check All Closed-Loop Edges
    // Opportunity → Project
    const oppProjEdge = graph.edges.find((e) => e.type === 'opportunity_project');
    expect(oppProjEdge).toBeDefined();
    expect(oppProjEdge?.source).toBe(`opp:${oppId}`);
    expect(oppProjEdge?.target).toBe(`project:${projectId}`);

    // Project → WorkPackage
    const projWpEdge = graph.edges.find((e) => e.type === 'project_workpackage');
    expect(projWpEdge).toBeDefined();
    expect(projWpEdge?.source).toBe(`project:${projectId}`);
    expect(projWpEdge?.target).toBe(`wp:${wpId}`);

    // WorkPackage → Gate
    const wpGateEdge = graph.edges.find((e) => e.type === 'workpackage_gate');
    expect(wpGateEdge).toBeDefined();
    expect(wpGateEdge?.source).toBe(`wp:${wpId}`);
    expect(wpGateEdge?.target).toBe(`gate:gate-wp-${wpId}`);

    // Gate → Artifact
    const gateArtEdge = graph.edges.find((e) => e.type === 'gate_artifact');
    expect(gateArtEdge).toBeDefined();
    expect(gateArtEdge?.source).toBe(`gate:gate-wp-${wpId}`);
    expect(gateArtEdge?.target).toBe(`artifact:${artifactId}`);

    // WorkPackage → Artifact
    const wpArtEdge = graph.edges.find((e) => e.type === 'workpackage_artifact');
    expect(wpArtEdge).toBeDefined();
    expect(wpArtEdge?.source).toBe(`wp:${wpId}`);
    expect(wpArtEdge?.target).toBe(`artifact:${artifactId}`);

    // Project → Learning
    const projLearnEdge = graph.edges.find((e) => e.type === 'project_learning');
    expect(projLearnEdge).toBeDefined();
    expect(projLearnEdge?.source).toBe(`project:${projectId}`);
    expect(projLearnEdge?.target).toBe(`learning:${deliveryLearning?.id}`);

    // Learning → Opportunity (completing circular loop)
    const learnOppEdge = graph.edges.find((e) => e.type === 'learning_opportunity');
    expect(learnOppEdge).toBeDefined();
    expect(learnOppEdge?.source).toBe(`learning:${deliveryLearning?.id}`);
    expect(learnOppEdge?.target).toBe(`opp:${oppId}`);

    // -----------------------------------------------------------------------
    // 6. Verify Specialist Prompt Knowledge Injection
    // -----------------------------------------------------------------------
    let promptCaptured = '';
    const mockProvider: LLMProvider = {
      providerId: 'qwen-knowledge-tester',
      chat: async (req) => {
        promptCaptured = req.messages.find((m) => m.role === 'user')?.content ?? '';
        return {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              changes: [
                {
                  path: 'package.json',
                  content: '{\n  "name": "healthcare-portal",\n  "auth": true\n}\n',
                  note: 'Updated package.json applying security learnings',
                },
              ],
            }),
          },
          finishReason: 'stop',
        };
      },
    };

    const producer = createLlmCodeProducer({ provider: mockProvider });
    const outcome = await producer.produce({
      projectId,
      projectName: 'Healthcare Patient Portal',
      absolutePath: stagingDir,
      category: 'digital-product',
      type: 'feature',
      goal: 'Implement healthcare patient auth controller',
      maxFiles: 2,
      scopeFiles: [{ path: 'package.json', exists: true }],
      readProjectFile: async () => '{\n  "name": "healthcare-portal"\n}\n',
      knowledgeContext: [
        `${deliveryLearning?.title}: ${deliveryLearning?.keyInsight}`,
        ...(deliveryLearning?.recommendedActions ?? []),
      ],
    });

    expect(outcome.status).toBe('produced');
    expect(promptCaptured).toContain('COMPANY KNOWLEDGE & OPERATIONAL LEARNINGS:');
    expect(promptCaptured).toContain('Security Gate Cleared');
    expect(promptCaptured).toContain('Maintain dependency lockfile');
  });
});
