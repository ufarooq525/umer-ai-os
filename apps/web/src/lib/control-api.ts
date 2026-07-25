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
      const body = (await response.json()) as { error?: string };
      detail = body.error ? `: ${body.error}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`control-api ${path} failed: ${response.status}${detail}`);
  }
  return (await response.json()) as T;
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
