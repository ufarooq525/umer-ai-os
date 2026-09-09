const DEFAULT_CONTROL_API_URL = 'http://127.0.0.1:4000';

export function controlApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CONTROL_API_URL ?? DEFAULT_CONTROL_API_URL;
}

export type DashboardSummary = {
  pendingGates: number;
  workPackagesAwaitingReview: number;
  resolvedToday: number;
  watchdogFindingsAwaitingReview?: number;
  watchdogFindings?: Array<{
    waitId: string;
    gateId: string;
    workPackageId: string;
    projectId?: string;
    cadence?: string;
    watchdogId?: string;
    intakeId: string;
  }>;
};

export type GateWaitRecord = {
  waitId: string;
  gateId: string;
  execId: string;
  workPackageId: string;
  artifactId?: string;
  stageFrom: string;
  stageTo: string;
  status: string;
  requiredApprovers: string[];
  recordedApprovers: string[];
  humanRequired: boolean;
  requestedAt: string;
  resolvedAt?: string;
  rationale?: string;
};

export type WorkPackageSummary = {
  workPackageId: string;
  execId: string;
  status: string;
  specialistId: string;
  stage: string;
  artifactId?: string;
  projectId?: string;
  /** Set for a real, genuinely-dispatched Work Package that failed — see runtime-work-package-bridge.ts. */
  errorMessage?: string;
  updatedAt?: string;
};

export type WorkGraphNode = {
  nodeId: string;
  projectId: string;
  type: 'Project' | 'Requirements' | 'Product' | 'Architecture' | 'UX' | 'Implementation' | 'QA' | 'Security' | 'Release' | 'Operations';
  status: 'Planned' | 'Ready' | 'Blocked' | 'InProgress' | 'Review' | 'Accepted' | 'Failed' | 'Cancelled';
  title: string;
  workPackageId?: string;
  updatedAt: string;
};

export type WorkGraphEdge = {
  edgeId: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  type: 'blocks' | 'requires';
};

export type AuditRecord = {
  id: string;
  auditId: string;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  correlationId?: string;
  occurredAt: string;
  detail?: Record<string, unknown>;
};

export type ProjectRecord = {
  projectId: string;
  name: string;
  slug: string;
  path: string;
  absolutePath: string;
  status: string;
  category: 'client-task' | 'digital-product' | 'seo-project';
  stack: string[];
  defaultSpecialists: string[];
  constraints: string[];
  tags: string[];
  /** Production URL for SEO verify (optional). */
  seoBaseUrl?: string;
  /** Local dev URL for SEO verify (optional). */
  seoLocalUrl?: string;
  /** True when the catalog path exists under Laragon www. */
  onDisk?: boolean;
  /** Opt-in digital-product eng auto-apply; always present after catalog parse (default false). */
  autoApplyEng: boolean;
};

export type IntakePlan = {
  projectId: string;
  projectName: string;
  absolutePath: string;
  category: 'client-task' | 'digital-product' | 'seo-project';
  type: string;
  goal: string;
  summary: string;
  recommendedSpecialists: string[];
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
  seoAudit?: {
    specialistId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    goal: string;
    summary: string;
    items: Array<{
      id: string;
      category: string;
      title: string;
      priority: string;
      check: string;
      howToVerify: string;
    }>;
    quickWins: string[];
    nextActions: string[];
  };
  securityAudit?: {
    specialistId: string;
    runId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    goal: string;
    summary: string;
    forcesGate: boolean;
    proposedDiff: string;
    findings: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      detail: string;
      evidence: string;
      path?: string;
      remediation: string;
    }>;
    severityCounts: Record<string, number>;
    quickWins: string[];
    nextActions: string[];
  };
  perfAudit?: {
    specialistId: string;
    runId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    goal: string;
    summary: string;
    forcesGate: boolean;
    proposedDiff: string;
    targetUrl: string | null;
    findings: Array<{
      id: string;
      category: string;
      metric: string;
      severity: string;
      title: string;
      detail: string;
      evidence: string;
      remediation: string;
    }>;
    severityCounts: Record<string, number>;
    metrics: {
      performanceScore: number | null;
      lcpMs: number | null;
      cls: number | null;
      inpMs: number | null;
      fidMs: number | null;
      tbtMs: number | null;
    };
    quickWins: string[];
    nextActions: string[];
  };
  qaAudit?: {
    specialistId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    goal: string;
    summary: string;
    items: Array<{
      id: string;
      category: string;
      title: string;
      priority: string;
      check: string;
      howToVerify: string;
    }>;
    quickWins: string[];
    nextActions: string[];
  };
  uxAudit?: {
    specialistId: string;
    runId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    goal: string;
    summary: string;
    proposedDiff: string;
    items: Array<{
      id: string;
      category: string;
      title: string;
      priority: string;
      check: string;
      howToVerify: string;
    }>;
    quickWins: string[];
    nextActions: string[];
  };
  engDelivery?: {
    specialistId: string;
    runId: string;
    projectId: string;
    projectName: string;
    absolutePath: string;
    type: string;
    goal: string;
    summary: string;
    status: string;
    rationale: string;
    proposedDiff: string;
    testsRan: boolean;
    testsPassed: boolean;
    blockers: string[];
    quickWins: string[];
    nextActions: string[];
  };
};

export type IntakeRecord = {
  intakeId: string;
  plan: IntakePlan;
  createdAt: string;
  status: string;
};

export type IntakeRouting = {
  suggestedType: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  specialists: string[];
  writesCode: boolean;
  followUp?: string;
  alternatives: Array<{ type: string; reason: string }>;
  signals: string[];
};

export type ReviewFileChange = {
  path: string;
  action: 'create' | 'modify';
  linesAdded: number;
  linesRemoved: number;
  note: string;
  diff: string;
};

export type GateReview = {
  waitId: string;
  gateId: string;
  workPackageId: string;
  intakeId: string;
  projectId: string;
  projectName: string;
  kind: 'code' | 'findings';
  headline: string;
  onApprove: string;
  goal: string;
  requestedType: string;
  routing?: {
    suggestedType: string;
    agreed: boolean;
    note: string;
    confidence: string;
  };
  code?: {
    runId: string;
    status: string;
    rationale: string;
    author: string;
    authorStatus: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    files: ReviewFileChange[];
    testsRan: boolean;
    testsPassed: boolean;
    testCommand?: string;
    runs: Array<{
      kind: string;
      command: string;
      outcome: 'passed' | 'failed' | 'skipped';
      summary: string;
    }>;
    blockers: string[];
  };
  findings?: {
    runId?: string;
    summary: string;
    counts: Record<string, number>;
    items: Array<{ id: string; title: string; severity: string; detail: string; path?: string }>;
  };
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${controlApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      detail = body.message ? `: ${body.message}` : body.error ? `: ${body.error}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`control-api ${path} failed: ${response.status}${detail}`);
  }
  return (await response.json()) as T;
}

export type RuntimeHealth = { status: string; service: string; ts: string; details?: Record<string, unknown> };

export async function getHealth(): Promise<RuntimeHealth | null> {
  try {
    return await fetchJson<RuntimeHealth>('/health');
  } catch {
    return null;
  }
}

export async function getDashboard(): Promise<DashboardSummary> {
  return fetchJson<DashboardSummary>('/v1/dashboard');
}

export async function getPendingGates(): Promise<GateWaitRecord[]> {
  const body = await fetchJson<{ gates: GateWaitRecord[] }>('/v1/gates/pending');
  return body.gates;
}

export async function getWorkPackages(): Promise<WorkPackageSummary[]> {
  const body = await fetchJson<{ workPackages: WorkPackageSummary[] }>('/v1/work-packages');
  return body.workPackages;
}

/**
 * Real, persisted Work Graph for one Project — @umer/orchestration. An
 * unknown or not-yet-decomposed project returns an honest empty graph
 * (`{nodes: [], edges: []}`), never fabricated placeholder nodes.
 */
export async function getWorkGraph(
  projectId: string,
): Promise<{ projectId: string; nodes: WorkGraphNode[]; edges: WorkGraphEdge[] }> {
  return fetchJson(`/v1/work-graph/${encodeURIComponent(projectId)}`);
}

/**
 * Seeds a standalone UX/QA/Security audit node onto a project's Work Graph —
 * the only 3 node types with a real dispatchable Specialist today (see
 * apps/orchestration-worker/src/main.ts's NODE_TYPE_SPECIALISTS) — bypassing
 * the Requirements -> Product -> Architecture chain, which has no
 * dispatchable Specialist of its own. The node comes out Ready immediately;
 * a follow-up POST /v1/work-graph/:projectId/plan is what actually turns it
 * into a dispatched Work Package.
 */
export async function requestAudit(
  projectId: string,
  input: { type: 'UX' | 'QA' | 'Security'; requestedBy: string; title?: string },
): Promise<{ projectId: string; node: WorkGraphNode; nodes: WorkGraphNode[] }> {
  return fetchJson(`/v1/work-graph/${encodeURIComponent(projectId)}/audit`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getRecentAudit(): Promise<AuditRecord[]> {
  const body = await fetchJson<{ records: AuditRecord[] }>('/v1/audit/recent');
  return body.records;
}

export async function resolveGate(
  waitId: string,
  input: { decision: 'Pass' | 'Fail'; approver: string; rationale: string },
): Promise<{
  record: GateWaitRecord;
  applyResult?: {
    summary: string;
    absolutePath: string;
    probeUrl?: string;
    files: Array<{ path: string; action: string; note: string }>;
    stillManual: unknown[];
    verifiedExisting: string[];
    checks?: Array<{ itemId: string; status: string; evidence: string }>;
    patchedItemIds?: string[];
    runs?: Array<{
      kind: string;
      command: string;
      ran: boolean;
      skipped: boolean;
      exitCode: number | null;
      summary: string;
    }>;
  } | null;
}> {
  return fetchJson(`/v1/gates/${waitId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getProjects(): Promise<{ projectsRoot: string; projects: ProjectRecord[] }> {
  return fetchJson('/v1/projects');
}

/** PM's read of a goal before anything is submitted. Suggestion only. */
export async function routeIntakeGoal(input: {
  goal: string;
  doneWhen?: string;
}): Promise<{ routing: IntakeRouting; activeCodeProducer: string | null }> {
  return fetchJson('/v1/intake/route', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getGateReview(waitId: string): Promise<GateReview | null> {
  try {
    const body = await fetchJson<{ review: GateReview }>(`/v1/gates/${waitId}/review`);
    return body.review;
  } catch {
    // Gates without an intake behind them (demo seed) have nothing to review.
    return null;
  }
}

export async function submitIntake(input: {
  projectId: string;
  type: string;
  goal: string;
  constraints?: string[];
  doneWhen?: string;
}): Promise<IntakeRecord> {
  return fetchJson('/v1/intake', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// --- CEO Command & Decision Plane -----------------------------------------
// Read models (GET) and the single write path (POST /v1/commands). See
// implementation/COMPANY_OPERATING_MODEL.md and the CeoCommandService in
// @umer/control-plane for the full command → event → read-model contract.

export type OpportunityScore = {
  problemSeverity: number;
  demandEvidence: number;
  abilityToPay: number;
  reachability: number;
  solutionFit: number;
  competitiveGap: number;
  deliveryFeasibility: number;
  evidenceConfidence: number;
  overall: number;
  recommendation: 'reject' | 'watch' | 'research_more' | 'outreach_ready' | 'product_candidate';
};

export type OpportunityRecord = {
  id: string;
  type: string;
  title: string;
  geography: string;
  market: string;
  nicheId?: string;
  businessId?: string;
  problemIds?: string[];
  score?: OpportunityScore;
  status: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  currency?: string;
  timeToRevenueDays?: number;
  evidenceRefs?: string[];
  createdAt: string;
  updatedAt: string;
};

export type WorkProjectRecord = {
  projectId: string;
  name: string;
  status: string;
  owner?: string;
  sourceOpportunityId?: string;
  registryProjectId?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkTaskRecord = {
  taskId: string;
  epicId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  workClass?: string;
  capabilityIds?: string[];
  assignedAgentId?: string;
  workPackageId?: string;
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentRecord = {
  agentId: string;
  specialistId: string;
  name?: string;
  department?: string;
  capabilityIds?: string[];
  status: string;
  controlState: 'active' | 'paused';
  controlReason?: string;
  currentProjectId?: string;
  currentTaskIds?: string[];
  currentWorkPackageId?: string;
  currentAgentRunId?: string;
  correlationId?: string;
  lastSeenAt: string;
};

// --- Runtime Observability — Agent Run read model --------------------------

export type ToolCallRecord = {
  toolCallId: string;
  tool: string;
  input?: unknown;
  status: 'requested' | 'started' | 'completed' | 'failed';
  error?: string;
  durationMs?: number;
  requestedAt: string;
  updatedAt: string;
};

export type DecisionRecord = {
  action: string;
  tool?: string;
  reason?: string;
  at: string;
};

export type FailureRecord = {
  source: 'llm' | 'tool' | 'run';
  message: string;
  at: string;
};

export type ActionLogEntry = {
  at: string;
  event: string;
  summary: string;
};

export type AgentRunRecord = {
  workPackageId: string;
  runId?: string;
  execId?: string;
  specialistId?: string;
  agentId?: string;
  taskIds?: string[];
  correlationId: string;
  status: 'running' | 'completed' | 'failed';
  currentAction: 'waiting_on_model' | 'executing_tool' | 'idle';
  currentTool?: string;
  currentToolInput?: unknown;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  toolCalls: ToolCallRecord[];
  decisions: DecisionRecord[];
  actionLog: ActionLogEntry[];
  failures: FailureRecord[];
  artifactId?: string;
  summary?: string;
  errorMessage?: string;
};

export type CeoActorKind = 'human' | 'specialist_run' | 'system';
export type CeoActor = { principalId: string; kind: CeoActorKind };

export type CeoCommandName =
  | 'SelectOpportunity'
  | 'RejectOpportunity'
  | 'CreateProject'
  | 'CreateProjectFromOpportunity'
  | 'PauseProject'
  | 'ResumeProject'
  | 'CancelProject'
  | 'CreateTask'
  | 'AssignTask'
  | 'ReassignTask'
  | 'PauseAgent'
  | 'ResumeAgent'
  | 'CancelWork';

export type CeoCommandResult = {
  commandId: string;
  status: 'applied' | 'duplicate';
  data?: unknown;
  events: Array<{ name: string; payload: Record<string, unknown> }>;
};

export async function getOpportunities(): Promise<OpportunityRecord[]> {
  const body = await fetchJson<{ opportunities: OpportunityRecord[] }>('/v1/opportunities');
  return body.opportunities;
}

export type ArtifactRecord = {
  id: string;
  artifactId: string;
  artifactType: string;
  version: string;
  producedBy: string;
  producedFor: string;
  acceptanceStatus: 'draft' | 'submitted' | 'accepted' | 'rejected';
  sourceTaskId?: string;
  contentRef: string;
  createdAt: string;
  updatedAt: string;
};

export async function getArtifacts(execId?: string): Promise<ArtifactRecord[]> {
  const body = await fetchJson<{ artifacts: ArtifactRecord[] }>(
    `/v1/artifacts${execId ? `?execId=${encodeURIComponent(execId)}` : ''}`,
  );
  return body.artifacts;
}

export async function getArtifact(id: string): Promise<ArtifactRecord | null> {
  try {
    return await fetchJson<ArtifactRecord>(`/v1/artifacts/${id}`);
  } catch {
    return null;
  }
}

export async function getOpportunity(id: string): Promise<OpportunityRecord | null> {
  try {
    return await fetchJson<OpportunityRecord>(`/v1/opportunities/${id}`);
  } catch {
    return null;
  }
}

export async function getWorkProjects(): Promise<WorkProjectRecord[]> {
  const body = await fetchJson<{ projects: WorkProjectRecord[] }>('/v1/work-projects');
  return body.projects;
}

export async function getWorkProject(id: string): Promise<WorkProjectRecord | null> {
  try {
    return await fetchJson<WorkProjectRecord>(`/v1/work-projects/${id}`);
  } catch {
    return null;
  }
}

export async function getTasks(): Promise<WorkTaskRecord[]> {
  const body = await fetchJson<{ tasks: WorkTaskRecord[] }>('/v1/tasks');
  return body.tasks;
}

export async function getTask(id: string): Promise<WorkTaskRecord | null> {
  try {
    return await fetchJson<WorkTaskRecord>(`/v1/tasks/${id}`);
  } catch {
    return null;
  }
}

export async function getAgents(): Promise<AgentRecord[]> {
  const body = await fetchJson<{ agents: AgentRecord[] }>('/v1/agents');
  return body.agents;
}

export async function getAgent(id: string): Promise<AgentRecord | null> {
  try {
    return await fetchJson<AgentRecord>(`/v1/agents/${id}`);
  } catch {
    return null;
  }
}

export async function getAgentRuns(status?: 'running' | 'completed' | 'failed'): Promise<AgentRunRecord[]> {
  const body = await fetchJson<{ agentRuns: AgentRunRecord[] }>(
    `/v1/agent-runs${status ? `?status=${status}` : ''}`,
  );
  return body.agentRuns;
}

export async function getAgentRun(workPackageId: string): Promise<AgentRunRecord | null> {
  try {
    return await fetchJson<AgentRunRecord>(`/v1/agent-runs/${workPackageId}`);
  } catch {
    return null;
  }
}

// --- Commercial Intelligence — read-only over BusinessProspect / Evidence /
// DiscoveryCandidate / Problem / OutreachDraft (@umer/opportunity-intelligence,
// already-real MySQL data — see /v1/businesses, /v1/niches/:id/prospects).

export type EvidenceRecord = {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
  observedAt: string;
  excerpt?: string;
  observation: string;
  strength: 'weak' | 'moderate' | 'strong' | 'verified';
};

export type DiscoveryCandidateRecord = {
  id: string;
  runId: string;
  nicheId: string;
  externalId?: string;
  name: string;
  websiteUrl?: string;
  phone?: string;
  address?: string;
  geography: string;
  industry?: string;
  /** In practice the real Google Places discovery path only ever writes phone/address here — see deriveContactChannels. */
  sourceRefs?: string[];
  discoveredAt: string;
};

export type BusinessProspectRecord = {
  id: string;
  name: string;
  website?: string;
  geography: string;
  industry?: string;
  nicheId?: string;
  sourceRefs?: string[];
  discoveredAt: string;
  lastResearchedAt?: string;
};

export type ProblemRecord = {
  id: string;
  businessId: string;
  nicheId: string;
  runId: string;
  statement: string;
  severity: number;
  frequency: number;
  financialImpact: number;
  evidenceConfidence: number;
  evidenceRefs: string[];
};

export type OutreachDraftRecord = {
  id: string;
  opportunityId: string;
  businessId: string;
  nicheId: string;
  channel: 'email' | 'whatsapp' | 'linkedin' | 'phone';
  recipient?: string;
  subject?: string;
  body: string;
  language: 'ar' | 'en' | 'bilingual';
  valueProposition: string;
  evidenceRefs: string[];
  status: 'drafted' | 'ready' | 'sent' | 'replied' | 'converted' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type NicheRecord = {
  id: string;
  name: string;
  description: string;
  geographies: string[];
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  outreachMode: 'disabled' | 'draft' | 'approval_required' | 'bounded_autonomous';
};

export type BusinessDetail = {
  business: BusinessProspectRecord;
  discoveryCandidate: DiscoveryCandidateRecord | null;
  runId: string | null;
  problems: ProblemRecord[];
  opportunities: OpportunityRecord[];
  outreach: OutreachDraftRecord[];
  evidence: EvidenceRecord[];
};

export type NicheProspectSummary = {
  businessId: string;
  business: BusinessProspectRecord | null;
  candidate: DiscoveryCandidateRecord;
  problemCount: number;
  opportunityCount: number;
  bestScore: number;
  hasContactChannel: boolean;
};

export type OpportunityRunEventRecord = {
  id: string;
  runId: string;
  nicheId: string;
  stage: string;
  agentName: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  occurredAt: string;
};

export type CommercialIntelligenceSummary = {
  niches: Array<{
    nicheId: string;
    nicheName: string;
    runId: string | null;
    discovered: number;
    contactComplete: number;
    contactIncomplete: number;
  }>;
  outreachDraftsAwaitingReview: number;
  businessesConsidered: number;
  cap: number;
};

export async function getNiches(): Promise<NicheRecord[]> {
  const body = await fetchJson<{ niches: NicheRecord[] }>('/v1/niches');
  return body.niches;
}

export async function getBusiness(id: string, runId?: string): Promise<BusinessDetail | null> {
  try {
    return await fetchJson<BusinessDetail>(`/v1/businesses/${id}${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`);
  } catch {
    return null;
  }
}

export async function getNicheProspects(nicheId: string, runId?: string): Promise<{ runId: string | null; prospects: NicheProspectSummary[] }> {
  return fetchJson(`/v1/niches/${nicheId}/prospects${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`);
}

export async function getNicheEvents(nicheId: string, runId?: string): Promise<{ runId: string | null; events: OpportunityRunEventRecord[] }> {
  return fetchJson(`/v1/niches/${nicheId}/events${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`);
}

export async function getCommercialIntelligenceSummary(): Promise<CommercialIntelligenceSummary> {
  return fetchJson('/v1/commercial-intelligence/summary');
}

/** The single write path for the CEO Command Plane. `actor` is trusted client input — see the milestone's auth-boundary notes. */
export async function executeCommand(input: {
  name: CeoCommandName;
  actor: CeoActor;
  payload: Record<string, unknown>;
  target?: { entityType: 'opportunity' | 'project' | 'task' | 'agent'; entityId: string };
}): Promise<CeoCommandResult> {
  return fetchJson('/v1/commands', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type CompanyOverview = {
  whatCompanyIsDoing: {
    activeProjectsCount: number;
    activeWorkPackagesCount: number;
    activeLoopCyclesCount: number;
    summary: string;
  };
  opportunitiesPursued: Array<{
    id: string;
    title: string;
    status: string;
    overallScore: number;
    estimatedValue?: number;
    recommendation: string;
  }>;
  prospectsThatMatter: Array<{
    prospectId: string;
    dealId?: string;
    companyName: string;
    stage?: string;
    estimatedValue?: number;
  }>;
  agentsWorking: Array<{
    agentId: string;
    name?: string;
    department: string;
    specialistId: string;
    status: string;
    currentProjectId?: string;
    currentTaskId?: string;
  }>;
  projectsByAgent: Record<
    string,
    {
      agentId: string;
      projectId: string;
      taskId?: string;
    }
  >;
  evidenceSummary: {
    totalSealedArtifacts: number;
    testPlanResultsCount: number;
    securityReportsCount: number;
    signedDeliveryOutcomesCount: number;
  };
  blockedItems: Array<{
    type: 'work_graph_node' | 'gate' | 'support_case' | 'deal';
    id: string;
    reason: string;
    blockedSince: string;
  }>;
  decisionsNeeded: Array<{
    type: 'deal_approval' | 'deployment_approval' | 'gate_review' | 'incident_review';
    id: string;
    title: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    requiredApprovers: string[];
  }>;
  nextActions: Array<{
    action: string;
    targetType: string;
    targetId: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  revenueAndOutcomes: {
    totalWonRevenue: number;
    recognizedRevenue: number;
    pipelineValue: number;
    averageMarginPercent: number;
    averageCustomerHealthScore: number;
    activeCustomersCount: number;
    completedDeliveriesCount: number;
    recommendedPriceMultiplier: number;
  };
  generatedAt: string;
};

export async function getCompanyOverview(): Promise<CompanyOverview | null> {
  try {
    const res = await fetchJson<{ overview: CompanyOverview }>('/v1/company/overview');
    return res.overview;
  } catch {
    return null;
  }
}

