const DEFAULT_CONTROL_API_URL = 'http://127.0.0.1:4000';

export function controlApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CONTROL_API_URL ?? DEFAULT_CONTROL_API_URL;
}

export type DashboardSummary = {
  pendingGates: number;
  workPackagesAwaitingReview: number;
  resolvedToday: number;
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
};

export type ProjectRecord = {
  projectId: string;
  name: string;
  slug: string;
  path: string;
  absolutePath: string;
  status: string;
  stack: string[];
  defaultSpecialists: string[];
  constraints: string[];
  tags: string[];
};

export type IntakePlan = {
  projectId: string;
  projectName: string;
  absolutePath: string;
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
};

export type IntakeRecord = {
  intakeId: string;
  plan: IntakePlan;
  createdAt: string;
  status: string;
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
