import { describe, expect, it } from 'vitest';
import {
  RequestContractSchema,
  WorkPackageContractSchema,
  SpecialistContractSchema,
  ArtifactContractSchema,
  ContextContractSchema,
  MemoryContractSchema,
  ToolContractSchema,
  ApprovalContractSchema,
  AgentRunContractSchema,
  RuntimeHealthSchema,
  EventEnvelopeSchema,
  CommandEnvelopeSchema,
  AuditContractSchema,
  ExecInstanceContractSchema,
  TaskContractSchema,
  DependencyContractSchema,
  parseContract,
  safeParseContract,
  serializeContract,
  deserializeContract,
  freezeContract,
  SCHEMA_VERSION,
  type ContractHeader,
} from './index.js';

const at = '2026-07-22T00:00:00.000Z';

function header(id: string): ContractHeader {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: at,
    updatedAt: at,
    metadata: { labels: {}, annotations: {} },
  };
}

describe('RequestContract', () => {
  const valid = {
    ...header('req-hdr-1', at),
    kind: 'request' as const,
    requestId: 'req-1',
    slug: 'checkout-slow',
    status: 'Intake' as const,
    source: { kind: 'HumanPrincipal' as const },
    rawDescription: 'checkout feels slow',
  };

  it('accepts intake request', () => {
    const parsed = parseContract(RequestContractSchema, valid);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.status).toBe('Intake');
  });

  it('accepts classified + scoped request', () => {
    const full = {
      ...valid,
      status: 'Scoping' as const,
      type: 'Defect' as const,
      scopeClass: 'SingleDepartment' as const,
      priorityScore: 80,
      scoping: {
        clarifiedGoal: 'Fix p95 latency',
        constraints: [],
        successCriteria: ['p95 < 2s'],
        openQuestionsResolved: [],
        stillAmbiguous: [],
      },
    };
    expect(parseContract(RequestContractSchema, full).type).toBe('Defect');
  });

  it('rejects empty rawDescription', () => {
    const bad = safeParseContract(RequestContractSchema, { ...valid, rawDescription: '' });
    expect(bad.success).toBe(false);
  });
});

describe('WorkPackageContract', () => {
  const valid = {
    ...header('wp-hdr-1', at),
    kind: 'work_package' as const,
    workPackageId: 'wp-1',
    execId: 'EXEC-203',
    stage: 'Development',
    status: 'Queued' as const,
    specialistId: 'eng.spec.1',
    specialistSpecVersion: '1.0.0',
    specialistSpecHash: 'abc',
    taskIds: ['task-1'],
    capabilityIds: ['cap.delivery'],
    contextHandle: 'ctx-1',
    toolAllowlist: ['git.diff'],
    resourceEnvelope: { parallelism: 1, maxToolCalls: 20 },
    attempt: 1,
  };

  it('parses keystone work package', () => {
    expect(parseContract(WorkPackageContractSchema, valid).execId).toBe('EXEC-203');
  });

  it('rejects invalid exec id', () => {
    const bad = safeParseContract(WorkPackageContractSchema, { ...valid, execId: '203' });
    expect(bad.success).toBe(false);
  });

  it('round-trips freeze + serialize', () => {
    const parsed = freezeContract(parseContract(WorkPackageContractSchema, valid));
    const again = deserializeContract(WorkPackageContractSchema, serializeContract(parsed));
    expect(again.workPackageId).toBe('wp-1');
  });
});

describe('SpecialistContract', () => {
  const valid = {
    ...header('sp-hdr-1', at),
    kind: 'specialist' as const,
    specialistId: 'eng.app-delivery',
    name: 'Application Delivery Specialist',
    department: 'Engineering',
    mission: 'Deliver application changes safely',
    mandateDomain: 'Delivery' as const,
    authorityClass: 'Produce' as const,
    interactionMode: 'SoloProducer' as const,
    status: 'Active' as const,
    capabilityIds: ['cap.app.delivery'],
    skillBindings: [],
    toolAllowlist: [],
    nonGoals: ['Own Business portfolio'],
    specVersion: '1.0.0',
    specHash: 'hash',
    humanAccountabilityAnchor: 'Engineering Lead',
  };

  it('parses specialist mandate surface', () => {
    expect(parseContract(SpecialistContractSchema, valid).department).toBe('Engineering');
  });
});

describe('ArtifactContract', () => {
  const valid = {
    ...header('art-hdr-1', at),
    kind: 'artifact' as const,
    artifactId: 'art-1',
    artifactType: 'Code' as const,
    version: 'git:abc1234',
    producedBy: 'Engineering',
    producedFor: 'EXEC-203',
    acceptanceStatus: 'submitted' as const,
    acceptanceCriteriaMet: [
      { criterion: 'p95 < 2s', status: 'VERIFIED' as const, evidenceRef: 'load.json' },
    ],
    sourceTaskId: 'task-1',
    contentRef: 's3://umer-artifacts/art-1',
  };

  it('parses artifact header', () => {
    expect(parseContract(ArtifactContractSchema, valid).artifactType).toBe('Code');
  });
});

describe('ContextContract', () => {
  it('parses context package handle', () => {
    const valid = {
      ...header('ctx-hdr-1', at),
      kind: 'context' as const,
      contextHandle: 'ctx-1',
      execId: 'EXEC-1',
      entries: [{ key: 'brief', valueRef: 'mem://brief', required: true, freshness: 'fresh' as const }],
      intelligenceRefs: [],
    };
    expect(parseContract(ContextContractSchema, valid).entries).toHaveLength(1);
  });
});

describe('MemoryContract', () => {
  it('parses memory access record', () => {
    const valid = {
      ...header('mem-hdr-1', at),
      kind: 'memory' as const,
      memoryId: 'mem-1',
      memoryKind: 'Lesson' as const,
      scope: 'read' as const,
      title: 'Handoff ack required',
      contentRef: 'intel://lessons/1',
      tags: ['handoff'],
      retentionClass: 'durable' as const,
    };
    expect(parseContract(MemoryContractSchema, valid).memoryKind).toBe('Lesson');
  });
});

describe('ToolContract', () => {
  it('parses tool registry entry', () => {
    const valid = {
      ...header('tool-hdr-1', at),
      kind: 'tool' as const,
      toolId: 'tool.git.diff',
      toolKind: 'Tool' as const,
      name: 'git.diff',
      version: '1.0.0',
      description: 'Show diff',
      inputSchemaRef: 'schemas/git-diff-in.json',
      outputSchemaRef: 'schemas/git-diff-out.json',
      permissions: { networkEgress: false, filesystem: 'read' as const, secretsScopes: [] },
      extensionOnly: true,
    };
    expect(parseContract(ToolContractSchema, valid).extensionOnly).toBe(true);
  });
});

describe('ApprovalContract', () => {
  it('parses gate result', () => {
    const valid = {
      ...header('gate-hdr-1', at),
      kind: 'approval' as const,
      gateId: 'gate-dev-qa',
      execId: 'EXEC-203',
      stageFrom: 'Development',
      stageTo: 'QA',
      result: 'Pass' as const,
      requiredApprovers: ['QA'],
      recordedApprovers: ['QA'],
      humanRequired: false,
      rationale: 'All AC evidenced',
      decidedAt: at,
    };
    expect(parseContract(ApprovalContractSchema, valid).result).toBe('Pass');
  });
});

describe('Runtime + Events', () => {
  it('parses agent run and health', () => {
    const run = {
      ...header('run-hdr-1', at),
      kind: 'agent_run' as const,
      runId: 'run-1',
      workPackageId: 'wp-1',
      status: 'started' as const,
      specialistSpecHash: 'abc',
      mandateViolated: false,
      startedAt: at,
    };
    expect(parseContract(AgentRunContractSchema, run).status).toBe('started');
    expect(
      parseContract(RuntimeHealthSchema, {
        status: 'ok',
        service: 'kernel',
        ts: at,
        details: {},
      }).status,
    ).toBe('ok');
  });

  it('parses event and command envelopes', () => {
    const event = {
      eventId: 'evt-1',
      schemaVersion: SCHEMA_VERSION,
      name: 'workpackage.dispatched' as const,
      occurredAt: at,
      correlationId: 'corr-1',
      producer: 'orchestration',
      payload: { workPackageId: 'wp-1' },
    };
    expect(parseContract(EventEnvelopeSchema, event).name).toBe('workpackage.dispatched');

    const cmd = {
      commandId: 'cmd-1',
      schemaVersion: SCHEMA_VERSION,
      name: 'workpackage.dispatch',
      issuedAt: at,
      correlationId: 'corr-1',
      producer: 'control-api',
      payload: {},
      idempotencyKey: 'idem-1',
    };
    expect(parseContract(CommandEnvelopeSchema, cmd).idempotencyKey).toBe('idem-1');
  });
});

describe('AuditContract', () => {
  it('parses audit record', () => {
    const valid = {
      ...header('aud-hdr-1', at),
      kind: 'audit' as const,
      auditId: 'aud-1',
      action: 'gate.decide',
      actor: 'system',
      resourceType: 'approval',
      resourceId: 'gate-1',
      severity: 'notice' as const,
      outcome: 'success' as const,
      detail: {},
      occurredAt: at,
    };
    expect(parseContract(AuditContractSchema, valid).outcome).toBe('success');
  });
});

describe('Execution contracts', () => {
  it('parses exec instance, task, dependency', () => {
    const exec = {
      ...header('exec-hdr-1', at),
      kind: 'exec_instance' as const,
      execId: 'EXEC-1',
      requestId: 'req-1',
      projectId: 'proj-1',
      currentStage: 'Development' as const,
      completedStages: ['Research' as const],
      skippedStages: [{ stage: 'SEO' as const, reason: 'no public surface' }],
    };
    expect(parseContract(ExecInstanceContractSchema, exec).currentStage).toBe('Development');

    const task = {
      ...header('task-hdr-1', at),
      kind: 'task' as const,
      taskId: 'task-1',
      epicId: 'epic-1',
      projectId: 'proj-1',
      title: 'Implement API',
      description: 'Add endpoint',
      status: 'Ready' as const,
      workClass: 'Standard' as const,
      acceptanceCriteria: ['returns 200'],
      capabilityIds: ['cap.api'],
    };
    expect(parseContract(TaskContractSchema, task).acceptanceCriteria).toHaveLength(1);

    const dep = {
      ...header('dep-hdr-1', at),
      kind: 'dependency' as const,
      dependencyId: 'dep-1',
      fromId: 'task-1',
      toId: 'task-2',
      dependencyType: 'finish_to_start' as const,
      status: 'Open' as const,
    };
    expect(parseContract(DependencyContractSchema, dep).status).toBe('Open');
  });
});
